# Auth 模块接口文档（注册 / 登录 / 邮箱验证 / 忘记密码）v1

> 目标：让前端 **今天就能对接**。统一响应格式、错误码、字段命名与全局规范一致（`code/message/data/request_id`）。
>
> Base URL（示例）：`https://api.example.com`
>
> 版本前缀：`/api/v1`

------

## 0. 通用约定

- **鉴权**：除注册/登录/邮箱验证/忘记密码外，其余接口需 `Authorization: Bearer <access_token>`。
  - Authorization就是去写一个http的响应头
- **响应结构**（成功 & 失败统一）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "request_id": "uuid"
}
```

- **主要错误码映射**：
  - `1001 unauthenticated` 未登录/Token 失效（401）；
  - `1002 forbidden` 权限不足（403）；
  - `2001 validation_error` 参数校验失败（400/422）；
  - `3001 not_found` 资源不存在（404）；
  - `4001 conflict` 业务冲突（409），如邮箱已存在、token 已用过；
  - `8001 rate_limited` 触发限流（429）；
  - `9001 internal_error` 服务端异常（5xx）。
- **速率限制建议**：
  - 登录：`10 req/min`；公共接口：`60 req/min`。
- **时间**：ISO 8601（UTC）。
- **字段命名**：`snake_case`。

------

## 1. 注册（邮箱）

### 1.1 创建账号并发送验证邮件

- **Method/URL**：`POST /api/v1/auth/register`
- **鉴权**：否
- **请求体**：

```json
{
  "email": "zoe@example.com",
  "password": "12345678",          // 8-64 位，前端简单校验，后端强校验
  "name": "Zoe"                    // 可选
}
```

- **成功响应**（将创建用户，`email_verified_at = null`，并发送验证邮件）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user_id": "11111111-2222-3333-4444-555555555555",
    "email": "zoe@example.com",
    "need_verify": true
  },
  "request_id": "uuid"
}
```

- **失败响应示例**：

```json
{ "code": 2001, "message": "invalid email format", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "email already exists", "data": null, "request_id": "uuid" }
```

> 说明：
>
> - 成功后 **必须** 引导用户去邮箱点验证链接；
> - 也可在注册成功页提供「重新发送验证邮件」按钮（见 2.2）。

------

## 2. 邮箱验证

### 2.1 点击验证链接（后端校验 token）

- **Method/URL**：`GET /api/v1/auth/verify-email?token=<token>`
- **鉴权**：否
- **请求参数**：
  - `token`（必填）：验证邮件中的 token。
- **成功响应**（标记 `email_verified_at`）：

```json
{ "code": 0, "message": "email verified", "data": {"email":"zoe@example.com"}, "request_id": "uuid" }
```

- **失败响应示例**：

```json
{ "code": 3001, "message": "token not found", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "token expired or used", "data": null, "request_id": "uuid" }
```

> 前端：
>
> - 验证成功 → 跳转登录页并提示「邮箱已验证，可登录」。
> - 失败（过期/已用）→ 展示错误并提供「重新发送验证邮件」入口（2.2）。

### 2.2 重新发送验证邮件

- **Method/URL**：`POST /api/v1/auth/resend-verification`
- **鉴权**：否
- **请求体**：

```json
{ "email": "zoe@example.com" }
```

- **成功响应**：

```json
{ "code": 0, "message": "verification email sent", "data": null, "request_id": "uuid" }
```

- **失败响应**：

```json
{ "code": 3001, "message": "user not found", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "email already verified", "data": null, "request_id": "uuid" }
```

------

## 3. 登录 / 登出

### 3.1 登录（邮箱+密码）

- **Method/URL**：`POST /api/v1/auth/login`
- **鉴权**：否
- **请求体**：

```json
{ "email": "zoe@example.com", "password": "12345678" }
```

- **成功响应**（首次成功登录时 `show_intro=true`，并在服务端记录 `first_login_at`）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "jwt-token-string",
    "token_type": "bearer",
    "expires_in": 1800,                   // 秒（示例：30 分钟）
    "user": {
      "user_id": "11111111-2222-3333-4444-555555555555",
      "email": "zoe@example.com",
      "name": "Zoe",
      "avatar_url": null
    },
    "show_intro": true                    // 仅账号首次成功登录为 true
  },
  "request_id": "uuid"
}
```

- **失败响应**：

```json
{ "code": 3001, "message": "account not found", "data": null, "request_id": "uuid" }
{ "code": 2001, "message": "incorrect password", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "email not verified", "data": { "resend_available": true }, "request_id": "uuid" }
```

> 前端处理：
>
> - `show_intro=true` → 弹出项目简介（仅首次登录自动展示）；
> - `email not verified` → 提供“重新发送验证邮件”（2.2）。

### 3.2 获取当前用户（校验 token）

- **Method/URL**：`GET /api/v1/auth/me`
- **鉴权**：是（Bearer）
- **请求头**：`Authorization: Bearer <access_token>`
- **成功响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user_id": "11111111-2222-3333-4444-555555555555",
    "email": "zoe@example.com",
    "name": "Zoe",
    "avatar_url": null,
    "email_verified": true
  },
  "request_id": "uuid"
}
```

- **失败**：`401 / code=1001`。

### 3.3 登出

- **Method/URL**：`POST /api/v1/auth/logout`
- **鉴权**：是（Bearer）
- **请求体**：空
- **成功响应**：

```json
{ "code": 0, "message": "ok", "data": null, "request_id": "uuid" }
```

> 简化实现：前端清除本地 token 即可。若采用刷新令牌或黑名单，则在后端作废相应 token。

### 3.4 刷新令牌（可选）

- **Method/URL**：`POST /api/v1/auth/refresh`
- **鉴权**：否（携带 refresh_token）
- **请求体**：

```json
{ "refresh_token": "refresh-token-string" }
```

- **成功响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": { "access_token": "new-jwt", "token_type": "bearer", "expires_in": 1800 },
  "request_id": "uuid"
}
```

- **失败响应**：

```json
{ "code": 2001, "message": "invalid refresh token", "data": null, "request_id": "uuid" }
```

------

## 4. 忘记密码 / 重置密码

### 4.1 申请重置（发送邮件）

- **Method/URL**：`POST /api/v1/auth/forgot-password`
- **鉴权**：否
- **请求体**：

```json
{ "email": "zoe@example.com" }
```

- **成功响应**（即使 email 不存在也返回 ok，避免暴露用户情况）：

```json
{ "code": 0, "message": "reset email sent if account exists", "data": null, "request_id": "uuid" }
```

### 4.2 提交新密码

- **Method/URL**：`POST /api/v1/auth/reset-password`
- **鉴权**：否
- **请求体**：

```json
{ "token": "reset-token-from-email", "new_password": "NewPassw0rd" }
```

- **成功响应**：

```json
{ "code": 0, "message": "password reset", "data": null, "request_id": "uuid" }
```

- **失败响应**：

```json
{ "code": 3001, "message": "token not found", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "token expired or used", "data": null, "request_id": "uuid" }
```

------

## 5. 第三方登录（Google / Microsoft / LinkedIn / Apple）

> 前端按钮：点击后跳转第三方授权 → 回跳 `redirect_uri`。

### 5.1 获取授权地址（可选：也可前端直拼）

- **Method/URL**：`GET /api/v1/auth/oauth/{provider}/authorize?redirect_uri=<uri>`
- **响应**：

```json
{ "code": 0, "message": "ok", "data": { "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..." }, "request_id": "uuid" }
```

### 5.2 授权回调（服务端与第三方交换 token）

- **Method/URL**：`POST /api/v1/auth/oauth/{provider}/callback`
- **请求体**：

```json
{ "code": "auth_code_from_provider", "redirect_uri": "https://web.example.com/callback" }
```

- **成功响应**（新用户首次第三方登录可能需要前端走“完善资料”页）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "jwt",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": { "user_id": "uuid", "email": "zoe@example.com", "name": "Zoe" },
    "profile_incomplete": false            // 若 true → 跳去完善资料
  },
  "request_id": "uuid"
}
```

- **失败**：

```json
{ "code": 4001, "message": "authorization failed", "data": null, "request_id": "uuid" }
{ "code": 4001, "message": "oauth account already bound to another user", "data": null, "request_id": "uuid" }
```

------

## 6. 表单校验规则（前端建议）

- `email`：合法邮箱格式；
- `password`：8–64 位，至少含字母与数字（后端再次强校验）；
- `name`：0–50 字，去前后空白。

------

## 7. 前端集成要点（最少集成集）

1. 注册成功 → 展示“验证邮件已发送”，并提供“重新发送验证邮件”。
2. 登录：

- 响应中拿 `access_token` 存 `localStorage`（或 Cookie）；
- 后续所有请求带 `Authorization: Bearer <token>`；
- 如返回 `email not verified`，展示引导。
- 如 `show_intro=true`，首次登录自动弹“项目简介”。

1. 忘记密码：

- 提交邮箱后统一返回 `ok`；
- 用户通过邮件中的链接进入“设置新密码”页，提交 `token + new_password`。

------

## 8. 字段字典（速查）

| 字段                 | 说明                                      |
| -------------------- | ----------------------------------------- |
| `user_id`            | UUID                                      |
| `need_verify`        | 注册后需邮箱验证                          |
| `access_token`       | 登录后颁发的 JWT，放到 `Authorization` 里 |
| `expires_in`         | access_token 剩余有效秒数                 |
| `show_intro`         | 首次登录弹“项目简介”                      |
| `email_verified`     | 当前邮箱是否已验证                        |
| `profile_incomplete` | 第三方登录后资料是否需完善                |

------

> **阶段性取舍**
>
> - 立即对接：`register / verify-email / resend-verification / login / me / forgot-password / reset-password`。
> - 可选第二阶段：`logout / refresh / 第三方登录`。