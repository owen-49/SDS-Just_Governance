# backend/app/core/rich_extra_handler.py
from __future__ import annotations
import logging
import time
from typing import Any, Optional

from rich.logging import RichHandler
from rich.console import Group
from rich.text import Text
from rich.pretty import Pretty

class ExtraRichHandler(RichHandler):
    """
    RichHandler 的增强版：
    - 若 LogRecord 上存在 `record.extra` 且为 dict，则将其彩色渲染到 message 下方。
    - 不改变异常回溯的彩色显示（仍用 Rich 的 traceback）。
    """

    def __init__(
        self,
        *args,
        extra_attr: str = "extra",
        pretty_max_length: Optional[int] = 100,   # 控制列表/字典单层最大元素数，None=不限
        pretty_max_string: Optional[int] = 500,   # 控制字符串最大显示长度，None=不限
        pretty_indent_guides: bool = True,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._extra_attr = extra_attr
        self._pretty_max_length = pretty_max_length
        self._pretty_max_string = pretty_max_string
        self._pretty_indent_guides = pretty_indent_guides

    def render_message(self, record: logging.LogRecord, message: Any):
        """
        覆盖 RichHandler 的渲染：
        - 先拿到 Rich 原本渲染后的 message（彩色）
        - 如果带有 record.extra（dict），再追加一个 Pretty(extra) 彩色块
        """
        base_renderable = super().render_message(record, message)

        extra_obj = getattr(record, self._extra_attr, None)
        if isinstance(extra_obj, dict) and extra_obj:

            extra_obj.update({"timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(record.created))})
            # 用 Pretty 把 dict 漂亮地打印（带缩进、折行、类型高亮）
            pretty = Pretty(
                extra_obj,
                expand_all=False,               # 结构很大时避免全展开（更易读）
                indent_guides=self._pretty_indent_guides,
                overflow="fold",                # 终端宽度处自动折行
                max_length=self._pretty_max_length,
                max_string=self._pretty_max_string,
            )

            # 标题行：避免和上面的 base_renderable 混在一起
            header = Text("extra:", style="bold yellow")
            return Group(base_renderable, header, pretty)

        return base_renderable
