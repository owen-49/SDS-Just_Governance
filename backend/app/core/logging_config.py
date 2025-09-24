# backend/app/core/logging_config.py
from __future__ import annotations
import json, logging, sys, time
from typing import Any, Dict

# 日志记录格式器：用于将每一条日志记录按json字符串格式打印到控制台上
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # LogRecord是一条日志记录对象，有很多内置属性，调用.info(),.error()等函数写日志时，就是在自动创建一个LogRecord对象，一些内置属性会被自动填写，比如：
            # record.name：logger的名字（如 uvicorn.error, app.access）
            # record.level：日志级别（ERROR/INFO）
            # record.pathname / filename / module / lineno / funcName：源文件、行号、函数
            # record.created / msecs / relativeCreated：时间戳（秒）、毫秒、相对进程启动时间
            # ........
            # 这些属性，我们大多不用在.info(),.error()中主动声明，因为系统可以自动记录。
        # record.message:String message是我们要主动填写的，但本项目中统一保留为空，把message都写到extra字典中。
        # extra:Mapping是logRecord的可选属性，一般是传入一个字典。本项目中，把大多数我们希望记录的信息都存到extra字典中。
            # 之所以把业务/异常上下文字段都填入extra而不是message，是因为message字符串类型的，只适合存储短消息。
        # exc_info:Tuple是一个三元组，也是logRecord的可选属性，可以封装一个异常对象的信息。只有在严重异常(status=500)的时候才使用。

        # 把日志记录的属性全部抽取到字典payload中，最后转为json字符串
        payload: Dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
                    # 先将时间浮点数转成时间结构体，再格式化成时间戳字符串
            "level": record.levelname.lower(),
                    # 日志记录的level
            "logger": record.name,
                    # logger对象的名称
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
def setup_logging(level: int = logging.INFO) -> None:

    # 创建一个日志处理器（用于输出到控制台）
    handler = logging.StreamHandler(sys.stdout)

    # 这个处理器使用我们定义的jsonFormatter格式器，则该处理器会把日志信息按json字符串形式输出
    handler.setFormatter(JsonFormatter())

    # 获取根日志器对象root logger
        # 特点：Python 里所有日志默认最终都会冒泡到 root logger，除非你特别关闭。
    root = logging.getLogger()

    # 清空根日志器对象里原有所有的处理器，改成我们自己定义格式的日志处理器
    root.handlers.clear()
    root.addHandler(handler)

    # 统一日志级别（形参）
    root.setLevel(level)

    # 让 uvicorn 的日志也走我们格式
    #     说明：uvicorn是主日志，uvicorn.error,uvicorn.access是uvicorn的子日志器。
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        # 根据名字获取到日志器对象
        lg = logging.getLogger(name)
        # 清空它们自己的日志处理器，防止它们按照自己的格式在控制台乱输出
        lg.handlers.clear()
        # 保证它们冒泡到根日志root logger
        lg.propagate = True
