import unicodedata

def normalize_email(e: str) -> str:
    # 去空白 + Unicode 兼容归一化 + 大小写折叠
    e = unicodedata.normalize("NFKC", e).strip()
    local, sep, domain = e.partition("@")
    if not sep:
        return e.casefold()  # 兜底
    return f"{local.casefold()}@{domain.casefold()}"
