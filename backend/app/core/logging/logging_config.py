# backend/app/core/logging_config.py
from __future__ import annotations
import json, logging, sys, time
import os
from typing import Any, Dict

# 日志记录格式器：用于将每一条日志记录按json字符串格式打印到控制台上
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # LogRecord是一条日志记录对象，有很多内置属性，在调用.info(),.error()等函数写日志时，就是在自动创建一个LogRecord对象，一些内置属性会被自动填写，比如：
            # record.name：使用的logger的名字
            # record.level：日志级别（ERROR/INFO）
            # record.pathname / filename / module / lineno / funcName：源文件、行号、函数等
            # record.created / msecs / relativeCreated：时间戳（秒）、毫秒、相对进程启动时间
            # ........
            # 这些属性，我们大多不用在.info(),.error()中主动声明，因为系统可以自动记录。

        # record.message:String message是我们要主动填写的。
            # 情况1) 日志要记录的信息不多，一条字符串即可，我们可以直接把错误信息填到message参数中。
            # 情况2) 日志要记录的信息很多，必须结构化存储。此时我们传入一个extra字典(见下），而把record自带的message属性保留为空。

        # extra:Mapping是logRecord的可选属性，一般是传入一个字典。本项目中，把大多数我们希望记录的信息都存到extra字典中。

        # exc_info:Tuple是一个三元组，也是logRecord的可选属性，可以封装一个异常对象的信息。只有在严重异常(status=500)的时候才使用。

        # 把日志记录中我们需要的属性抽取到字典payload中，最后转为json字符串
        payload: Dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
                    # 日志记录的时间
            "level": record.levelname.lower(),
                    # 日志记录的级别
            "logger": record.name,
                    # 在哪个logger对象记录的
            "message": record.getMessage(),
                    # 日志记录的message
        }
            # 一般情况下，记录异常日志的时候不会传入异常对象，而是把异常信息和其他业务信息一同写入extra字段中
            # 如果出现了严重的服务器内部错误(status=500)，
            # 则写入日志时，使用的方法是logger.error("", extra={"extra": payload}, exc_info=exc)，这里面传入了异常对象exc
                # 形参exc_info收到异常对象exc，最终会变成logRecord的固有属性exc_info，exc_info是一个三元组：
                    # exc_info[0]存的是异常的类型对象
                    # exc_info[1]存的是异常的实例对象本身，因此可以通过__str__直接转为字符串描述
                    # exc_info[2]存的是异常的堆栈信息，即异常对象的__traceback__对象
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__
            payload["exc_message"] = str(record.exc_info[1])    #
            payload["stack"] = self.formatException(record.exc_info)  # 多行字符串

        # extra是我们写到日志记录的主要信息
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload.update(extra)   # update会把字典extra中的键值都提升到payload顶层

        return json.dumps(payload, ensure_ascii=False)   # 转成json格式字符串


# 该函数用来初始化整个日志环境
def setup_logging(level: int = logging.INFO, fmt:str | None = None) -> None:

    # 指定日志输出格式（默认Json字符串）
    fmt = fmt or os.getenv("LOG_FORMAT", "json").lower()

    # 获取根日志器对象root logger
            # 特点：Python 里所有日志默认最终都会冒泡到 root logger，除非你特别关闭。
    root = logging.getLogger()

    # 清空根日志器所有的原始处理器
    root.handlers.clear()

    # 设置日志输出级别
    root.setLevel(level)

    # 若选择使用友好输出格式：
    if fmt == "pretty":
        # 彩色、带高亮堆栈
        from app.core.logging.rich_extra_handler import ExtraRichHandler

        # # 让所有未捕获异常也用彩色回溯
        # install(
        #     show_locals=False,  # 是否显示函数的局部变量
        #     width=120,  # 设置traceback的最大宽度
        #     word_wrap=True, # 是否对长行进行自动换行
        #     extra_lines=0,   # 显示出错行上下文行数
        #     max_frames = 12,     # 最多显示 12 层函数调用栈，避免长得刷屏
        #     suppress = ["uvicorn", "starlette", "fastapi", "anyio", "asyncio"] # 隐藏这些模块的调用栈帧，不在 traceback里显示
        # )

        # handler = ExtraRichHandler(
        #     rich_tracebacks=True,
        #     show_time=True,
        #     show_level=True,
        #     show_path=True,
        #     markup=True,
        #     log_time_format="%Y-%m-%d %H:%M:%S",
        #
        #     # 下面是 extra 的渲染控制
        #     extra_attr="extra",  # 你一直用的 key
        #     pretty_max_length=200,  # 每层最多显示多少元素（ extra 很大时可调）
        #     pretty_max_string=2000,  # 字符串最大显示长度
        #     pretty_indent_guides=True,
        # )

        handler = ExtraRichHandler(
            rich_tracebacks=False,  # 关闭带源码的回溯渲染
            show_time=True,
            show_level=True,
            show_path=True,
            markup=True,
            log_time_format="%Y-%m-%d %H:%M:%S",
            extra_attr="extra",
            pretty_max_length=200,
            pretty_max_string=2000,
            pretty_indent_guides=True,
        )

        # 使用 RichHandler 自带的格式器（不用自定义 Formatter）
        root.addHandler(handler)
    else:
        # 默认还是结构化 JSON，自定义格式，适合被采集
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        root.addHandler(handler)

    # 让这些 logger 都别截流，统一冒泡到 root
    for name in (
            "uvicorn", "uvicorn.error", "uvicorn.access",
            "app", "app.access", "core.exceptions",
    ):
        lg = logging.getLogger(name)
        lg.handlers.clear()  # 不各自绑定 handler
        lg.setLevel(logging.NOTSET)  # 不在本层做级别判断
        lg.propagate = True  # 冒泡到 root，让 root 的 handler/level 决定


