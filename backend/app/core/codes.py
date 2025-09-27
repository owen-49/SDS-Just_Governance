# -*- coding: utf-8 -*-
"""
业务码与 HTTP 映射的“单一事实源”（Single Source of Truth）

设计要点（来自团队规范）：
- 一个 HTTP 状态码 → 可对应多个业务码（细因），是**一对多**关系；不要追求一一对应。
- 框架/协议层错误（HTTPException 等）→ 走 “HTTP → 默认业务码” 兜底映射；
- 业务层错误（BizError）→ 在抛出时**显式指定 http_status + code**，不查表；
- message 使用稳定的“短标签”，不要把内部异常/SQL 直出到响应体。
- 3xx（含 304）不包统一响应壳，遵循 HTTP 规范直接返回。
"""
from __future__ import annotations
from enum import IntEnum
from dataclasses import dataclass


# 业务码枚举类：防止乱填业务码
class BizCode(IntEnum):
    # 成功
    OK = 0

    # 1xxx 鉴权/权限
    UNAUTHENTICATED = 1001  # 未登录/无凭证 401
    TOKEN_EXPIRED = 1003    # 凭证过期 401
    TOKEN_INVALID = 1004    # 凭证无效/伪造/非法/签名失败 401

    FORBIDDEN = 1002        # 权限不足/策略禁止 403
    FORBIDDEN_ROLE = 1101   #  角色不匹配 403
    FEATURE_FLAG_OFF = 1102 # 功能未开启 403
    QUOTA_EXCEEDED = 1103   # 配额/策略额度已满 403

    # 2xxx 请求/校验/协议
    VALIDATION_ERROR = 2001
    MALFORMED_JSON = 2002
    INVALID_REQUEST = 2003
    NOT_ACCEPTABLE = 2004
    UNSUPPORTED_MEDIA_TYPE = 2005
    PAYLOAD_TOO_LARGE = 2006
    UNSUPPORTED_PARAM_COMBO = 2007
    METHOD_NOT_ALLOWED = 2008

    # 3xxx 资源/存在性
    NOT_FOUND = 3001
    GONE = 3002
    PRIVATE_RESOURCE = 3003

    # 4xxx 业务冲突/状态非法
    CONFLICT = 4001
    EMAIL_EXISTS = 4002
    VERSION_CONFLICT = 4003
    STATE_INVALID = 4004
    ALREADY_DONE = 4005
    PRECONDITION_FAILED = 4006  # ETag/If-* 不满足，常配 412

    # 5xxx 下游/依赖
    UPSTREAM_ERROR = 5001       # 502
    SERVICE_UNAVAILABLE = 5002  # 503
    UPSTREAM_TIMEOUT = 5003     # 504

    # 8xxx 流控
    RATE_LIMITED = 8001

    # 9xxx 系统/未知
    INTERNAL_ERROR = 9001


@dataclass(frozen=True)
class CodeMeta:
    # 稳定短标签（写入响应的 message；真正给用户看的文案由前端 i18n 表来做）
    label: str
    # 期望/常见的 HTTP（仅用于校验/文档提示，不做强制转换）
    http_hint: int | None = None


# 码表元数据（覆盖文档所有列举的业务码及其常见 HTTP）
CODE_META: dict[BizCode, CodeMeta] = {
    BizCode.OK: CodeMeta("ok", 200),

    # 1xxx
    BizCode.UNAUTHENTICATED: CodeMeta("unauthenticated", 401),
    BizCode.TOKEN_EXPIRED: CodeMeta("token_expired", 401),
    BizCode.TOKEN_INVALID: CodeMeta("token_invalid", 401),
    BizCode.FORBIDDEN: CodeMeta("forbidden", 403),
    BizCode.FORBIDDEN_ROLE: CodeMeta("forbidden_role", 403),
    BizCode.FEATURE_FLAG_OFF: CodeMeta("feature_flag_off", 403),
    BizCode.QUOTA_EXCEEDED: CodeMeta("quota_exceeded", 403),

    # 2xxx
    BizCode.VALIDATION_ERROR: CodeMeta("validation_error", 422),
    BizCode.MALFORMED_JSON: CodeMeta("malformed_json", 400),
    BizCode.INVALID_REQUEST: CodeMeta("invalid_request", 400),
    BizCode.NOT_ACCEPTABLE: CodeMeta("not_acceptable", 406),
    BizCode.UNSUPPORTED_MEDIA_TYPE: CodeMeta("unsupported_media_type", 415),
    BizCode.PAYLOAD_TOO_LARGE: CodeMeta("payload_too_large", 413),
    BizCode.UNSUPPORTED_PARAM_COMBO: CodeMeta("unsupported_param_combo", 400),
    BizCode.METHOD_NOT_ALLOWED: CodeMeta("method_not_allowed", 405),

    # 3xxx
    BizCode.NOT_FOUND: CodeMeta("not_found", 404),
    BizCode.GONE: CodeMeta("gone", 410),
    BizCode.PRIVATE_RESOURCE: CodeMeta("private_resource", 404),

    # 4xxx
    BizCode.CONFLICT: CodeMeta("conflict", 409),
    BizCode.EMAIL_EXISTS: CodeMeta("email_exists", 409),
    BizCode.VERSION_CONFLICT: CodeMeta("version_conflict", 409),
    BizCode.STATE_INVALID: CodeMeta("state_invalid", 409),
    BizCode.ALREADY_DONE: CodeMeta("already_done", 409),
    BizCode.PRECONDITION_FAILED: CodeMeta("precondition_failed", 412),

    # 5xxx
    BizCode.UPSTREAM_ERROR: CodeMeta("upstream_error", 502),
    BizCode.SERVICE_UNAVAILABLE: CodeMeta("service_unavailable", 503),
    BizCode.UPSTREAM_TIMEOUT: CodeMeta("upstream_timeout", 504),

    # 8xxx
    BizCode.RATE_LIMITED: CodeMeta("rate_limited", 429),

    # 9xxx
    BizCode.INTERNAL_ERROR: CodeMeta("internal_error", 500),
}

# --------------------------------------------------------
# “HTTP → 默认业务码”兜底映射（仅在 HTTPException 场景使用）
# 说明：
# - 400 的默认值选用 INVALID_REQUEST（更贴近“非字段级错误”），
#   字段级错误请走 422 + VALIDATION_ERROR。
# --------------------------------------------------------
HTTP_TO_BIZ_DEFAULT: dict[int, BizCode] = {
    400: BizCode.INVALID_REQUEST,         # 非字段级错误；可在业务中用 2002/2007 等更细分
    401: BizCode.UNAUTHENTICATED,
    403: BizCode.FORBIDDEN,
    404: BizCode.NOT_FOUND,
    405: BizCode.METHOD_NOT_ALLOWED,
    406: BizCode.NOT_ACCEPTABLE,
    409: BizCode.CONFLICT,
    410: BizCode.GONE,
    412: BizCode.PRECONDITION_FAILED,
    413: BizCode.PAYLOAD_TOO_LARGE,
    415: BizCode.UNSUPPORTED_MEDIA_TYPE,
    422: BizCode.VALIDATION_ERROR,        # 字段级错误（data.errors）
    429: BizCode.RATE_LIMITED,
    500: BizCode.INTERNAL_ERROR,
    502: BizCode.UPSTREAM_ERROR,
    503: BizCode.SERVICE_UNAVAILABLE,
    504: BizCode.UPSTREAM_TIMEOUT,
    # 备注：3xx（含 304）不包壳；200/201/202/204 → code=0
}

# 可选：反向映射，用于单测/日志校验一致性（不要在运行时“强改”返回）
CODE_TO_HTTP_HINT: dict[BizCode, int] = {
    k: v.http_hint for k, v in CODE_META.items() if v.http_hint is not None
}

# 工具函数：把 HTTP 映射为默认业务码（用于 HTTPException 兜底）
def default_biz_for_http(http_status: int) -> BizCode:
    if http_status in HTTP_TO_BIZ_DEFAULT:
        return HTTP_TO_BIZ_DEFAULT[http_status]
    if http_status >= 500:
        return BizCode.INTERNAL_ERROR
    if 400 <= http_status < 500:
        # 其它 4xx 默认按“请求错误/校验问题”归类
        return BizCode.INVALID_REQUEST
    return BizCode.INTERNAL_ERROR

# 工具函数：获取稳定短标签
def label_for(code: int | BizCode) -> str:
    try:
        return CODE_META[BizCode(int(code))].label
    except Exception:
        return "error"
