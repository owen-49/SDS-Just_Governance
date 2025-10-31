# backend/app/core/logging_config.py
from __future__ import annotations
import json, logging, sys, time
import os
from typing import Any, Dict

# 日志记录格式器：用于将每一条日志记录按json字符串格式打印到控制台上
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # LogRecord是一条日志记录对象，有很多内置属性，在调用.info(),.error()等函数写日志时，就是在自动创建一个LogRecord对象，一些内置属性会被自动填写，比如：
            # record.name, record.level
            # record.pathname / filename / module / lineno / funcName：源文件、行号、函数等
            # record.created / msecs / relativeCreated
            # 这些属性，不用在.info(),.error()中主动声明，因为系统会自动记录。

        # record.message:String message是要求开发者填写的。
            # 在本项目中，对于message的填写，分两种情况：
            # 情况1) 日志要记录的信息不多，一个字符串即可，则可以直接把错误信息填到message参数中。
            # 情况2) 日志要记录的信息很多，必须结构化存储。此时我们传入一个extra字典(见下），而把record自带的message属性保留为空。

        # extra是logRecord的可选属性，一般是传入一个字典。本项目中，大多数需要记录的日志信息都存到extra字典中。
        # exc_info:一个三元组，也是logRecord的可选属性，可以封装一个异常对象的信息。只有在严重异常(status=500)的时候使用。

        # 把日志记录中我们需要的属性抽取到字典payload中，最后转为json字符串
        payload: Dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
                    # 记录日志的时间
            "level": record.levelname.lower(),
                    # 记录的级别
            "logger": record.name,
                    # 在哪个logger对象记录的
            "message": record.getMessage(),
                    # 日志记录的message
        }
            # 一般情况下，记录异常日志的时候不会传入异常对象，而是把异常信息和其他业务信息一同写入extra字段中
            # 但如果出现了服务器内部错误：
            # 则写异常日志时，使用的方法是logger.error("", extra={"extra": payload}, exc_info=exc)，这里面传入了异常对象exc
                # 形参exc_info收到异常对象exc，最终会变成logRecord的固有属性exc_info，exc_info是一个三元组：
                    # exc_info[0]存的是异常的类型对象
                    # exc_info[1]存的是异常的实例对象本身，因此可以通过__str__直接转为字符串描述
                    # exc_info[2]存的是异常的堆栈信息，即异常对象的__traceback__对象
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__
            payload["exc_message"] = str(record.exc_info[1])
            payload["stack"] = self.formatException(record.exc_info)  # 多行字符串

        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload.update(extra)   # 把extra中的键值都提升到payload顶层

        return json.dumps(payload, ensure_ascii=False)   # 转成json格式字符串


# 该函数用来初始化整个日志环境
def setup_logging(level: int = logging.INFO, fmt:str | None = None) -> None:

    # 指定日志输出格式（默认Json字符串）
    fmt = fmt or os.getenv("LOG_FORMAT", "json").lower()

    # 获取根日志器对象
    root = logging.getLogger()
    # 清空根日志器所有的原始处理器
    root.handlers.clear()
    # 设置日志输出级别
    root.setLevel(level)
    # 若选择使用友好输出格式：
    if fmt == "pretty":
        # 彩色、带高亮堆栈
        from app.core.logging.rich_extra_handler import ExtraRichHandler
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


