# Just Governance 项目全局规范（FastAPI + React）

> 目标：让一个新人进组一小时能上手；让多人并行不互相打架；让接口与数据库持续可演化、可测试、可回滚。

## 0. 项目结构（建议）

```ABAP
project-root/
├─ api-docs/                    # 接口文档（Markdown）
│  ├─ _guidelines.md           # ← 本文档：全局规范“宪法”
│  ├─ auth.md
│  ├─ users.md
│  └─ survey.md
├─ mock-data/                   # 接口示例/Mock JSON
│  ├─ auth_login_success.json
│  └─ survey_submit_success.json
├─ backend/                     # FastAPI
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/                 # 配置/日志/中间件/安全/常量
│  │  ├─ api/                  # 路由（按模块）
│  │  ├─ schemas/              # Pydantic 模型
│  │  ├─ services/             # 业务逻辑
│  │  ├─ repositories/         # 数据访问
│  │  └─ tests/
│  └─ requirements.txt
├─ frontend/                    # React + TS
│  ├─ src/
│  │  ├─ api/                  # 请求封装 & 类型
│  │  ├─ pages/
│  │  ├─ components/
│  │  └─ utils/
│  └─ package.json
├─ db/
│  ├─ baseline.sql              # 基线建库（可重建环境用）
│  ├─ migrations/               # 迁移脚本（up/down 成对）
│  ├─ schema-changelog.md       # 变更记录（人类可读）
│  └─ entity-notes.md           # 表字段说明（中文注释）
├─ .env.example                 # 环境变量模板（不含敏感值）
└─ README.md
```

------

## 1. 命名与数据约定

- **JSON 字段**：统一 `snake_case`（后端/文档/数据库一致）。

- **时间**：统一 ISO-8601（UTC），例如 `2025-09-11T03:20:00Z`。

- **ID**：统一 `UUIDv4`，字段名 `xxx_id`（如 `user_id`）。

- **分页**：查询参数 `page`（默认 1）、`size`（默认 20，最大 100）；响应为：

  ```sql
  { "code": 0, "message": "ok", "data": { "items": [], "page": 1, "size": 20, "total": 0 } }
  ```

------

## 2. 统一响应/错误码（必须）

**响应结构**（成功 & 失败统一）：

```json
{
  "code": 0,                              // 0 表示成功
  "message": "ok",
  "data": { ... },                        // 失败可为 null
  "request_id": "uuid"                    // 由后端中间件注入
}
```

**HTTP ↔ 业务 code 规则**（精选）：

- 200：`code=0` 正常；
- 400：`code=2001` 参数校验失败（字段错误细节在 data.errors）；
- 401：`code=1001` 未登录或 token 失效；
- 403：`code=1002` 权限不足；
- 404：`code=3001` 资源不存在；
- 409：`code=4001` 业务冲突（如已存在/状态冲突）；
- 429：`code=8001` 频率限制；
- 5xx：`code=9001` 系统异常（内部错误）。

> 所有接口文档必须写清：**HTTP 状态码 + 业务 code + message 示例**。

------

## 3. 接口设计与版本

- **风格**：REST 优先，资源名用复数：`/api/v1/users/{user_id}`；动作确实无法表达时可用动词：`/api/v1/users/{id}/activate`。
- **版本**：URL 前缀 `/api/v1/...`。破坏性变更走 `/api/v2/...`。
- **路径参数**：`{resource_id}` 必为 UUID。
- **查询参数**：分页 `page/size`，排序 `sort`（字段名）、`order`（asc/desc）。

------

## 4. 安全与鉴权

- **鉴权**：JWT（`Authorization: Bearer <token>`）。访问频次敏感接口加 **滑动续期**（可选 refresh token）。
- **权限**：在路由层声明所需角色/权限（Decorator/Depends）。
- **速率限制**：公共接口 60 req/min，登录 10 req/min（SlowAPI/Redis）。
- **输入清洗**：白名单 MIME、上传大小（默认 ≤ 10MB）、文件名去危险字符。
- **CORS**：仅允许前端域名；Prod 默认关闭 `*`。
- **Secrets**：不进仓库，用 `.env` + 环境注入。

------

## 5. 日志与可观测

- **结构化日志**：`timestamp, level, request_id, user_id, path, method, latency_ms, code, message`。
- **请求跟踪**：中间件注入 `request_id`，贯穿日志与响应。
- **指标**：暴露 `/healthz`（liveness/readiness），Prometheus 指标（QPS、P95/P99、错误率）。
- **错误上报**：集中化（如 Sentry），按严重度报警。

------

## 6. 参数校验与文档生成

- **后端**：Pydantic 模型 + FastAPI 自动 OpenAPI；字段加示例与校验（min/max/regex/enum）。
- **前端**：TypeScript 类型 + zod/yup 校验（可选）；对枚举/限制同步于接口文档。

**FastAPI 示例（统一响应 + 校验）**：

```python
# backend/app/api/routes/survey.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from uuid import UUID
from typing import List, Optional

router = APIRouter(prefix="/api/v1/surveys", tags=["survey"])

class SurveySubmitItem(BaseModel):
    key: str = Field(..., examples=["confidence_in_boards"])
    value: Optional[str] = None
    values: Optional[List[str]] = None
    text: Optional[str] = None  # other 的补充文本

class SurveySubmitRequest(BaseModel):
    user_id: UUID
    answers: List[SurveySubmitItem]

class ApiResp(BaseModel):
    code: int = 0
    message: str = "ok"
    data: dict | None = None
    request_id: str | None = None

@router.post("/onboarding", response_model=ApiResp)
def submit_onboarding(req: SurveySubmitRequest, current_user=Depends(...)):
    # 业务处理...
    return ApiResp(data={"survey_id": "..."})
```

------

## 7. 测试策略（DoD：完成定义）

- **单元测试**：核心服务/校验逻辑覆盖 ≥ 80%（pytest）。
- **契约测试（强烈建议）**：对外 API 用 schema 校验或 Pact；确保前端/后端对齐。
- **集成测试**：关键路径（登录→填写问卷→查询结果）。
- **E2E（阶段性）**：冒烟用例。
- **基线数据**：`db/baseline.sql` 可 1 命令重建开发环境。
- **性能冒烟**：关键接口做 95/99 分位简单压测（可用 k6）。

------

## 8. CI / 代码质量

- **后端**：`ruff + black + mypy + pytest`；Pre-commit 钩子。
- **前端**：`eslint + prettier + typecheck`；`vitest` 单测（可选）。
- **PR 规则**：必须附带接口文档更新/Mock 更新；破坏性变更标注。
- **提交规范**（可选）：`feat: xxx` / `fix: xxx` / `docs: xxx` / `db: migration xxx`。

------

## 9. 接口文档模板（Markdown）

> 存放路径：`/api-docs/<module>.md`。**实现前必须审过**。

~~~json
# 模块：Onboarding Survey

## 接口：提交问卷
- **Method/URL**：POST /api/v1/surveys/onboarding
- **鉴权**：必需（Bearer Token）
- **请求体**：
```json
{
  "user_id": "8cfa8b27-....",
  "answers": [
    { "key": "confidence_in_boards", "value": "somewhat_confident" },
    { "key": "familiar_terms", "values": ["companies","not_for_profits"] },
    { "key": "interest_motivation", "values": ["get_board_role", {"value":"other","text":"想了解结构"}] }
  ]
}
~~~

- **成功响应**（200，code=0）：

```
{ "code": 0, "message": "ok", "data": { "survey_id": "..." }, "request_id": "..." }
```

- **失败响应**：

  - 401 未登录：

  ```
  { "code": 1001, "message": "unauthorized", "data": null, "request_id": "..." }
  ```

  - 422 参数校验失败：

  ```
  { "code": 2001, "message": "validation_error",
    "data": { "errors": [{"field":"answers[0].key","msg":"required"}] },
    "request_id":"..." }
  ```

- **备注**：`key/value(s)/text` 规则、最大多选数、允许为空的题等。

~~~json
---

## 10. Mock 数据（最轻量做法）

- 写在接口文档“响应示例”里 + 同步一个 JSON 到 `/mock-data/`，前端可直接引用。
- 后端可先提供 **Stub**（固定 JSON），前端即可联调页面；再逐步填充业务逻辑。

示例：`/mock-data/survey_submit_success.json`
```json
{ "code": 0, "message": "ok", "data": { "survey_id": "11111111-2222-3333-4444-555555555555" } }
~~~

------

## 11. 数据库变更治理

- **任何表结构变更**：模块负责人提交“变更申请”，你审核后发迁移。
- **迁移脚本**：`/db/migrations/yyyymmddHHMM_<slug>_up.sql` 与 `_down.sql` 成对。
- **记录**：`/db/schema-changelog.md` 增加变更条目（目的/影响/回滚指引/关联接口）。
- **发布**：合并前必须可在本地一键执行 up/down；生产变更先备份。

**变更申请模板（提交到 PR 描述或单独 md）**：

```
# DB 变更申请
- 变更人/模块：
- 目标环境：dev/stg/prod
- 变更内容（DDL）：
- 目的/影响：
- 兼容性：是否破坏性（Y/N），兼容方案
- 回滚脚本：
- 关联接口/文档：
```

------

## 12. 前端请求封装（React + TS）

统一处理 code/message、request_id、token 续期、snake→camel（可选）：

```
// frontend/src/api/http.ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
      ...(init.headers || {})
    }
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.code !== 0) {
    const msg = payload?.message || res.statusText;
    throw Object.assign(new Error(msg), { status: res.status, code: payload?.code, request_id: payload?.request_id });
  }
  return payload.data as T;
}
```

------

## 13. 鉴权与中间件（FastAPI 片段）

```python
# backend/app/core/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
import uuid, time, logging
logger = logging.getLogger(__name__)

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        rid = str(uuid.uuid4())
        start = time.time()
        response = await call_next(request)
        latency = int((time.time() - start) * 1000)
        response.headers["X-Request-Id"] = rid
        logger.info({"request_id": rid, "path": request.url.path, "latency_ms": latency, "status": response.status_code})
        return response
```

------

## 14. 文件上传规范（如需要）

- 允许类型白名单：`pdf, docx, xlsx, pptx, txt`（禁止可执行/脚本）。
- 单文件 ≤ 10MB；多文件 ≤ 50MB。
- 存储：对象存储（推荐）或专用目录；记录 `file_id, original_name, mime, size, hash`。
- 扫描：可对外部上传接入病毒扫描（有条件再上）。

------

## 15. 定义完成（DoD）Checklist（合并 PR 必须满足）

-  接口文档更新并通过审核（路径/参数/响应/错误码/示例）。
-  有 Mock/Stub，可供前端先行调试。
-  单测通过（核心路径 ≥ 80%）。
-  契约/Schema 校验通过。
-  产生或更新 DB 迁移脚本（含回滚）。
-  结构化日志与错误处理就绪。
-  性能冒烟（关键接口 P95 < 200ms，示例标准，按需调整）。

------

### 结尾：怎么用这份“规范”

- 把这份文档放在 `api-docs/_guidelines.md`，**PR 每次引用**（对不齐就打回）。
- 每个模块先出接口文档（按模板），你审核“冻结”后并行开发。
- DB 变更严格走申请 + 迁移 + changelog。
- 前后端统一响应格式与错误码，减少对齐成本。

需要的话我也可以把这份内容拆分为仓库里的实际文件（含空白模板、示例接口文档、示例迁移 up/down），你直接复制粘贴即可用。