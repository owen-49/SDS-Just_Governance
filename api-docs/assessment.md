# 一、认证接口 / 非业务接口

## 1) 邮箱注册

### 1.1 `POST /api/v1/auth/register`

- **鉴权**：无需
- **前端情形：** 用户在 **注册** 页面，输入 **注册邮箱、输入密码、确认密码，用户名称** 等字段，然后点击注册按钮。
- **请求体**

```json
{ 
  "email":"zoe@example.com", 
  "password":"12345678", 	// 8-64 位，前端简单校验，后端强校验
  "name":"Zoe" 	// 可选
}	
```

#### **<u>成功 200（账号未被注册）</u>**

- **后端处理：** 后端会根据信息创建一条账号记录。
- **前端处理：** 跳转邮箱验证页，提供发送验证邮件按钮。

```json
{ 
    "code":0, 
    "message":"registered",
    "data":{
        "user_id":"uuid",
        "email":"zoe@example.com",
        "need_verify":true
    },
    "request_id":"uuid" 
}
```

#### <u>**特殊成功 200（账号已经注册，但用户尚未验证）**</u>

- **后端处理：** 后端不会再重复创建账号记录，但是会返回相同的成功响应。
- **前端处理：** 跳转邮箱验证页，提供发送验证邮件按钮。

```json
{ 
    "code":0, 
    "message":"registered",
    "data":{
  	  "user_id":"uuid",
  	  "email":"zoe@example.com",
  	  "need_verify":true
  	  },
    "request_id":"uuid"
}
```

### **失败情况**

- #### <u>**409**：**邮箱已经注册且被验证过**</u>

  ``` json
  { "code":4002, "message":"email_exists", "data":null, "request_id":"uuid" }
  ```

  - **前端处理：提示“该邮箱已注册，去登录“**

- #### <u>**422**：**字段校验错误**</u>

  ``` json
  { "code":2001, "message":"validation_error", "data":{"errors":[...]}, "request_id":"uuid" }
  ```

  - **前端处理：逐字段渲染错误。**
  - **常见原因：密码长度问题、邮箱格式问题。**

- #### <u>**500：后端服务器内部错误**</u>

- ``` json
  { "code":9001, "message":"internal_error", "data":null, "request_id":"uuid" }
  ```

  - **前端处理：糟糕，服务器出错了。**

------

## 2) 发送验证邮件

### 2.1 `POST /api/v1/auth/verify-email/resend`

- **鉴权**：无需
- **前端情形：** 用户在邮箱验证页，可 **点击“发送验证邮件”** 或 **“重新发送”**（前端设置间隔 60 秒）。
- **请求体**

```json
{ 
    "email": "zoe@example.com" 
}
```

#### **<u>成功：HTTP 200</u>（用户账号注册过且尚未验证）**

- **后端处理：** 发送携带验证链接的验证邮件。
- **前端处理：** 显示 **“邮件已发送，请前往邮箱验证”**，并倒计时 60 秒可点击 ”再次发送“。

```json
{ 
   	"code":0, 
   	"message":"verification_sent",
  	"data":{
       	"email":"zoe@example.com",
        "expires_in_hours":24
    },
  	"request_id":"uuid" 
}
```

#### **<u>特殊成功 1：HTTP 200</u>（用户不存在，为了防止枚举邮箱攻击，照样返回成功）**

- **后端处理：** 虽然返回成功，但实际上什么也不做，不会发验证邮件。
- **前端处理：** 仍然显示 **“邮件已发送，请前往邮箱验证”**，并倒计时 60 秒可点击 ”再次发送“。

```json
{ 
    "code":0, 
    "message":"verification_sent",
  	"data":{
        "email":"zoe@example.com"
    },
  	"request_id":"uuid" 
}
```

#### **<u>特殊成功 2：HTTP 200</u>（用户账号已创建且已经验证过）**

- **后端处理：** 不做处理，返回 **“already verified"** 信息。
- **前端处理：** 提示 **用户账号已被验证**，前往登录。

``` json
{ 
    "code":0, 
    "message":"already_verified",
  	"data":{
        "email":"zoe@example.com"
    },
  	"request_id":"uuid" 
}
```

### **失败情况**

- #### **<u>429：请求太频繁。</u>**

  - **响应体：**

  ``` json
  { 
      "code":8001, 
      "message":"rate_limited", 
      "data":null,
      "request_id":"uuid" 
  }	
  ```

  - **响应头**：`Retry-After: 30` 表示 N 秒后可以再请求。

  - **前端处理：** 展示统一的 **“请求太频繁”** 提示，冷却几秒钟后允许重新尝试。

- #### **<u>500：后端服务器内部错误。</u>**

  ``` json
  { "code":9001, "message":"internal_error", "data":null, "request_id":"uuid" }
  ```

  - **前端处理**：糟糕，服务器出错了。

---

## 3) 点击验证邮箱

### 3.1 `GET /api/v1/auth/verify-email?token=...`

- **鉴权**：否
- **触发情形：** 用户前往邮箱验收邮件，点击收到的 **验证链接**，会跳转到链接对应的 **前端页面**，**前端页面** 从该 URL 链接中提取出 **Token**，**调用本 3.1 后端 GET 接口**，获取响应结果并展示给用户。
  - **发送到用户邮箱的验证链接**：https://your-frontend.com/verify-email?token=xxxx
- **请求体：无**

#### <u>**成功响应 200（邮箱成功验证，完成注册）**</u>

- **后端处理：** 后端会标记该账号为 **“已验证”**。
- **前端处理：** 跳转 **验证完成页**，并 **引导用户登录**。

```json
{ 
    "code":0, 
 	"message":"email_verified",
  	"data":{
        "user_id":"uuid"
 	},
  	"request_id":"uuid" 
}
```

#### **<u>特殊成功响应 200（Token 已被使用，表明账号邮箱在之前就已经验证过）</u>**

- **后端处理：** 后端不重复标记 “已验证”，否则会造成验证时间不一致。
- **前端处理：** 跳转 **验证完成页**，并引导 **用户登录**。

``` json
{ 
    "code":0, 
 	"message":"email_verified",
  	"data":{
        "user_id":"uuid"
 	},
  	"request_id":"uuid" 
}
```

### **失败情况**

- #### <u>**401 未授权**：验证 token 不存在或不符合规范</u>

  ``` json
  { 
      "code":1004, 	// BizCode.TOKEN_INVALID
      "message":"token_invalid", 
      "data":null, 
      "request_id":"uuid" 
  }
  ```

  - **前端处理：** 显示 **“链接无效，请重新发送验证邮件”**。

- #### **<u>401 未授权：验证 token 已被撤销</u>**

  ``` json
  { 
     	"code":1005, 	// BizCode.TOKEN_REVOKED
   	"message":"token_revoked", 
      "data":null, 
      "request_id":"uuid"
  }
  ```

  - **前端处理：** 显示 **“该链接已失效，请使用最新链接”**。
  - **常见原因：** 用户点击的不是最新发送的链接，而 **一旦发送新链接，旧链接就会失效**。

- #### **<u>401 未授权：token 已经过期</u>**

  ```json
  { 
  	"code":1003, 	// BizCode.TOKEN_EXPIRED
  	"message":"token_expired", 
  	"data":null,
      "request_id":"uuid" 
  }
  ```

  - **前端处理：** 显示 **“链接已过期，请重新发送”**。

- #### **<u>500：后端服务器内部错误</u>**

  ``` json
  { "code":9001, "message":"internal_error", "data":null, "request_id":"uuid" }
  ```

  - **前端处理：** 糟糕，服务器出错了。

------

## 4) 邮箱登录

### `POST /api/v1/auth/login`

- **鉴权**：无需
- **前端情形：** 用户在登录页面 **输入注册邮箱和密码**，前端实时校验输入，格式均正确后用户点击 “登录” 按钮。登录成功，后端返回 **访问令牌（AT）**，并通过 **Cookie** 设置 **刷新令牌（RT）**。
- **请求体**

```json
{ 
    "email":"zoe@example.com", 
 	"password":"12345678"
}
```

#### <u>**成功 200**</u>

- **后端处理：** 后端校验账号密码成功，在数据库创建一个用户会话，返回 AT（短时）和 RT（长时）。
- **响应头：**

```http
Set-Cookie: refresh_token=abcdef12312387asdasdadada12746812741; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=Wed, 08 Oct 2025 12:00:00 GMT
```

> 说明：该响应头用于设置 Cookie Refresh Token。前端无需手动读取或保存，浏览器会自动存储并在后续请求中附带发送。（但前端在每次发送请求时必须带上 credentials）

- **响应体**：

``` json
{ 
    "code":0, 
    "message":"ok",
  	"data":{
        "access_token":"jwt-value",		
        "token_type":"bearer", 
        "show_intro": false 
    },
  	"request_id":"uuid" 
}	
```

- **前端处理：** 将 `access_token` 存到一个 **JS 全局变量或状态管理库** 中（页面刷新即丢失）。显示登录成功，然后跳转到主页面。若为 **第一次登录，show_intro 为 true**，则展示项目弹窗并指引用户填写问卷。

- **补充说明：** 登录成功后，之后前端在访问任何非认证接口的时候都应该在请求头中带上 `Authorization`，后端会自动鉴权。

  ```http
  Authorization: Bearer <Access Token>...
  ```

### **失败情形**

- #### <u>**401：认证失败（账号不存在 / 密码错）**</u>

  ``` json
  { 
      "code":1001,  // BizCode.UNAUTHENTICATED
      "message":"unauthenticated", 
      "data":null, 
      "request_id":"uuid"
  }
  ```

  `WWW-Authenticate: Bearer` // 响应头

  - **后端说明：** 统一返回未认证，避免暴露账户存在性。
  - **前端处理：** 显示 **“登录失败”**。

- #### <u>**422：字段校验错误**</u>

  ``` json
  { "code":2001, "message":"validation_error", "data":{"errors":[...]}, "request_id":"uuid" }
  ```

  - **说明：** 如果前端实时校验做到位，一般不会发生。
  - **前端处理：** 表单逐字段渲染错误或给出一般性错误提示。

- #### <u>**500：后端服务器内部错误**</u>

------

## 5) 刷新 Access Token

### 5.1 `POST /api/v1/auth/refresh`

- **鉴权**：否
- **请求**：无请求体，主要解析请求携带的 **Refresh Token Cookie（自动解析）**。
- **前端情形：** 访问令牌 Access Token 过期，前端自动调用 `auth/refresh` 接口。
  - **具体说明：** 在访问业务接口时，鉴权器都会先校验访问令牌 AT，当访问令牌过期时，鉴权器返回 401 + 1003 错误。前端此时应立刻请求 `auth/refresh` 接口，拿到新的有效期 15 分钟的 Access Token，然后重新访问该业务接口。

#### **成功 200**

- **后端动作：** 设置新的刷新令牌 RT。这是为了降低重放攻击的风险，同时用户每次刷新都在延长刷新令牌的期限。
- **前端动作：** 自动设置 RT Cookie，手动提取新的 AT 到内存区域。

```http
Set-Cookie: refresh_token=<new>; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=<t>
```

```json
{ 
	"code":0, 
	"message":"ok",
  	"data":{ 
  		"access_token":"jwt-value", 
  		"token_type":"bearer"
     },
  "request_id":"uuid" 
}
```

### **失败**

- #### <u>**401 未授权（未携带刷新令牌）**</u>

  ``` json
  { 
      "code":1001,	// UNAUTHENTICATED：未登录/无凭证
      "message":"token_expired", 
      "data":null, 
      "request_id":"uuid" 
  }
  ```

  headers = {`WWW-Authenticate`: `Bearer error="invalid_token"`} // HTTP 约定的响应头

  - **前端动作：** 先调用登出接口，跳转登录页。

- #### <u>**401 未授权（刷新令牌过期）**</u>

  ``` json
  { 
      "code":1003,	// BizCode.TOKEN_EXPIRED
      "message":"token_expired", 
      "data":null, 
      "request_id":"uuid" 
  }
  ```

  headers = {`WWW-Authenticate`: `Bearer error="invalid_token", error_description="expired"`} // HTTP 约定的响应头

  - **前端动作：** 先调用登出接口，跳转登录页。

- #### <u>**401 未授权（刷新令牌非法 / 伪造）**</u>

  ``` json
  { 
      "code":1004,    // BizCode.TOKEN_INVALID
   	"message":"token_invalid", 
      "data":null, 
      "request_id":"uuid" 
  }
  ```

  headers = {`WWW-Authenticate`: `Bearer error="invalid_token"`} // HTTP 约定的响应头

  - **前端动作：** 先调用登出接口，跳转登录页。

- #### <u>**401 未授权（刷新令牌已撤销）**</u>

  ``` json
  { 
      "code":1005,    // BizCode.TOKEN_REVOKED
   	"message":"token_revoked", 
      "data":null, 
      "request_id":"uuid" 
  }
  ```

  headers = {`WWW-Authenticate`: `Bearer error="invalid_token"`} // HTTP 约定的响应头

  - **后端动作：** 非法复用表明 Token 泄露，直接吊销整个用户会话。
  - **前端动作：** 先调用登出接口，跳转登录页。

- #### <u>**500 后端服务器内部错误**</u>

## 6）鉴权器 —— 所有业务接口鉴权失败的错误响应

> 访问业务接口时，请求会先经过鉴权器。鉴权器会通过 `Authorization: Bearer <access_token>` 检查 Access Token 的有效性，并解析出其代表的用户，再将请求流放到业务接口。

**简要总结：** 若 JWT Access Token 非法或不存在，前端拿到 **401 + 1001 / 401 + 1004**，此时调用登出接口并跳转登录页面；若 JWT Access Token 过期，则调用刷新接口去拿新的 Access Token，然后重新访问该业务接口。

### 情况 1：401 未认证（unauthenticated）

- **触发：**
  - 请求头未携带 `Authorization`；
  - JWT 解码成功但 `sub` 缺失；
  - 用户不存在或已被禁用。

- **响应头：**

  ```http
  WWW-Authenticate: Bearer
  ```

- **响应体：**

```json
{ "code": 1001, "message": "unauthenticated", "data": null, "request_id": "uuid" }
```

- **前端动作：** 调用登出接口

------

### 情况 2：401 访问令牌过期（token_expired）

- **触发：** JWT 过期（`ExpiredSignatureError` 等）。

- **响应头：**

  ```http
  WWW-Authenticate: Bearer error="invalid_token", error_description="expired"
  ```

- **响应体：**

```json
{ "code": 1003, "message": "token_expired", "data": null, "request_id": "uuid" }
```

- **前端动作：** 调用 `/auth/refresh`，刷新成功后重试原请求；刷新失败则调用登出接口，跳转登录。

------

### 情况 3：401 访问令牌非法（token_invalid）

- **触发：** JWT 非法（格式错误、签名校验失败等）。

- **响应头：**

  ```http
  WWW-Authenticate: Bearer error="invalid_token"
  ```

- **响应体：**

```json
{ "code": 1004, "message": "token_invalid", "data": null, "request_id": "uuid" }
```

- **前端动作：** 不要尝试 refresh，直接清理本地状态并跳转登录（安全优先）。

---

## 7) 登出

### 7.1 `POST /api/v1/auth/logout`

- **鉴权**： 否
- **请求**： 无请求体
- **成功：** 后端作废当前刷新令牌，设置响应头清除刷新令牌，前端清理本地访问令牌，并跳转登录页。

  - **响应头**

    ```http
    Set-Cookie: refresh_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax
    ```

  - **响应体**

    ```json
    {  "code":0, "message":"ok","data":null,"request_id":"uuid" }
    ```

  - **前端处理：** 清理本地访问令牌，跳转登录页。

# 二、业务接口

## 8) 获取当前用户信息

### 8.1 `GET /api/v1/auth/me`

- **鉴权**： 是（`Authorization: Bearer <access_token>`）
- **前端情形：** 前端需要在主页面展示用户名称、头像，或在个人中心显示个人信息。

#### **成功**

- **前端动作：** 提取需要的字段进行信息展示。

```json
{ 
    "code":0, 
    "message":"ok",
    "data":{
        "user_id":"uuid",
        "email":"zoe@example.com",
        "name":"Zoe",
        "avatar_url": null,
        "email_verified": true,
        "roles": ["user"],
        "connected_providers": [
          { "provider":"google", "linked":false },
          { "provider":"microsoft", "linked":false }
        ]
      },
  	 "request_id":"uuid" 
}
```

### **失败**

- #### <u>**401：鉴权失败**</u>

  - **前端处理：** 见第六部分鉴权错误响应统一规范

- #### <u>**500：后端服务器内部错误**</u>

# 三、前端建议（纯 AI 生成，仅供参考）

给你一套 **前端全局错误处理“决策树 + 极简拦截器流程”**。目标：同一套逻辑适配所有接口，同时对 401 / 422 / 500 分场景细化，最后才看业务码。

------

## 1. 总原则（判定优先级）

1. **先看 HTTP 状态码**（稳定、跨接口一致）
2. **再看业务码 `code` / `message`**（分支展示、人话文案）
3. **必要时看响应体上下文**（如 422 的 `data.errors`）

> 这样可以把“传输 / 鉴权问题”与“业务结果”分开，不会混淆。

------

## 2. 统一决策树（所有接口共用）

```markdown
收到响应 →
├─ 2xx 成功 → 进入业务流程（必要时根据 code/message 分流）
│
├─ 401 Unauthorized →
│   ├─ message == "token_expired"       → 触发 refresh 流程（成功后重试；失败→跳登录）
│   ├─ message == "token_invalid"       → 不刷新，直接清理状态→跳登录
│   ├─ message == "unauthenticated"     → 跳登录（未登录/用户不存在/禁用）
│   └─ 其它                             → 按未登录处理
│
├─ 422 Unprocessable Entity →
│   ├─ 若接口在“表单白名单”             → 按字段渲染：读取 data.errors，映射到控件
│   └─ 否则（普通/程序构造参数）         → 用统一 toast：“参数不合法/格式不正确”，给埋点，**不**逐字段展示
│
├─ 409 Conflict（常见：重复/状态冲突） →
│   └─ 按接口定义的 message 分流（如 email_exists / token_revoked）
│
├─ 429 Too Many Requests →
│   └─ 显示“请求太频繁”，若有 Retry-After 则展示秒数；可禁用按钮倒计时
│
├─ 403 Forbidden →
│   └─ 显示“无权限”，可引导联系管理员/切换账号
│
├─ 404 Not Found →
│   └─ 资源不存在/被删除 → 友好提示/回列表
│
├─ 5xx（500/502/503…） →
│   └─ 统一错误页/重试按钮；上报日志，显示 request_id
│
└─ 其它状态码 →
    └─ 走兜底提示：“操作失败，请稍后再试”
```

------

## 3. 接口分层 “精细化” 策略

### 1) 鉴权保护的业务接口（需要登录）

- **401**：按上面三分支处理（过期 → 刷新；非法 → 登出；未登录 → 登录）
- 其它码：按通用分支

### 2) 登录 / 注册等 “认证接口”

- **401**：代表账号口令失败或未认证（可带 `WWW-Authenticate`）；不触发 refresh
- **422**：真正表单错误（逐字段渲染）
- **409**：如 `email_exists` → 明确文案与引导（去登录）

### 3) 一般非表单接口（程序构造参数）

- **422**：仅做 “通用格式错误” toast，不逐字段
- **400 / 409**：按 message 做业务提示（如状态冲突）
- 其余按通用分支

> 关键点：是否 “逐字段渲染 422” 由 “表单接口白名单” 控制（路径 / Tag 标记），而不是靠状态码本身判断。

# 四、测评 Assessment 模块

## 1) 生成 / 获取待做小测题单

### 1.1 `POST /api/v1/topics/{topic_id}/quiz/pending`

- **鉴权**：是（`Authorization: Bearer <access_token>`）
- **前端情形：** 用户打开主题详情页的小测卡片时调用。若之前抽过题且还未提交，会直接返回原题单；否则生成新题单并存入 `user_topic_progress.pending_quiz`，状态置为 `pending`。
- **请求体**：无

#### **<u>成功 200</u>**

- **后端处理：** 若无未提交题单，则生成题目并落库；若已有待完成题单，返回原数据。
- **前端处理：** 渲染题目列表，缓存 `item_id` 与 `order_no`，供提交时使用。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "topic_id": "a03a68c8-8a7f-45f6-aba8-a052af72a289",
    "quiz_state": "pending",
    "questions": [
      {
        "item_id": "9b259b48-2bb8-492f-9348-06bf5bb2810e",
        "order_no": 1,
        "snapshot": {
          "qtype": "single",
          "stem": "What is the purpose of a code of conduct in an organization?",
          "choices": [
            { "id": "A", "label": "To promote productivity goals only" },
            { "id": "B", "label": "To define ethical standards and behavior" }
          ]
        }
      }
    ]
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**404：主题不存在**</u>

  ```json
  { "code": 3001, "message": "not_found", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 展示“主题不存在或已下线”，并禁用操作。

- #### <u>**400：题库不足**</u>

  ```json
  { "code": 2003, "message": "insufficient_questions", "data": { "actual": 3, "required": 5 }, "request_id": "uuid" }
  ```

  - **前端处理：** 提示题库不足，隐藏“开始小测”按钮或引导反馈。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 显示通用错误提示，并提供重试。

------

## 2) 提交小测并判分

### 2.1 `POST /api/v1/topics/{topic_id}/quiz/submit`

- **鉴权**：是
- **前端情形：** 用户答完题点击“提交”。
- **请求体**

```json
{
  "answers": [
    {
      "order_no": 1,
      "item_id": "9b259b48-2bb8-492f-9348-06bf5bb2810e",
      "answer": "B"
    }
  ]
}
```

#### **<u>成功 200</u>**

- **后端处理：** 校验 `pending_quiz`，创建 `assessment_sessions(kind='topic_quiz')`，写入 `assessment_items / assessment_responses`，更新 `user_topic_progress`（`last_score`、`attempt_count`、`best_score`、`last_quiz_session_id`），清空 `pending_quiz`，状态置为 `completed`。
- **前端处理：** 展示得分与每题对错；若 `can_mark_complete=true`，启用“标记为完成”操作。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "e216c622-0d13-406c-ac65-585fff079e7d",
    "total_score": 60,
    "items": [
      {
        "item_id": "198937b7-8d0b-4ffe-b987-8df4614f6f11",
        "order_no": 1,
        "snapshot": { "...": "..." },
        "your_answer": "A",
        "is_correct": true,
        "correct_answer": "A",
        "explanation": "Sharing consistent, accurate updates improves transparency.",
        "score": 1
      }
    ],
    "can_mark_complete": false,
    "threshold": 80
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**409：未生成待提交题单**</u>

  ```json
  { "code": 4005, "message": "no_pending_quiz", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 引导用户先调用 `/quiz/pending` 重新生成题单。

- #### <u>**422：答案缺失或引用错误**</u>

  ```json
  { "code": 2001, "message": "validation_error", "data": { "missing_orders": [2, 3] }, "request_id": "uuid" }
  ```

  - **前端处理：** 高亮缺失题或错误题，提示补答；如 `invalid_answer_reference` / `duplicate_answers`，需清理本地缓存后重试。

- #### <u>**404：主题不存在**</u>

  ```json
  { "code": 3001, "message": "not_found", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示主题不存在或已下线。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 显示通用错误提示。

------

## 3) 开始整体评测

### 3.1 `POST /api/v1/assessments/global/start`

- **鉴权**：是
- **前端情形：** 用户点击“开始整体评测”（弹窗第一步）。
- **请求体（可选）**

```json
{
  "difficulty": "mixed",
  "count": 20
}
```

> `difficulty` 支持 `mixed / beginner / intermediate / advanced`；`count` 取值 5-50。

#### **<u>成功 200</u>**

- **后端处理：** 创建新的整体评测会话，抽题并写入 `assessment_items`，初始化进度。
- **前端处理：** 缓存题目数组，初始化答题 UI 和本地进度状态。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "fa0fd48c-97fb-4d3c-b6a2-149b34382d1a",
    "items": [
      {
        "item_id": "4a1e6c2d-0d77-410d-a860-a06f0ea1ad04",
        "order_no": 1,
        "snapshot": { "qtype": "single", "stem": "...", "choices": [] }
      }
    ],
    "progress": { "total": 20, "answered": 0, "last_question_index": 0 }
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**409：已有未完成的整体评测**</u>

  ```json
  { "code": 4001, "message": "unfinished_assessment_exists", "data": { "session_id": "uuid", "message": "请先完成或删除现有评测" }, "request_id": "uuid" }
  ```

  - **前端处理：** 提示继续此前会话或提供“放弃”入口。

- #### <u>**400：题库不足**</u>

  ```json
  { "code": 2003, "message": "insufficient_questions", "data": { "actual": 15, "required": 20 }, "request_id": "uuid" }
  ```

  - **前端处理：** 提示题库不足，可建议调低题量或稍后重试。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 展示通用错误提醒。

------

## 4) 逐题保存答案（自动保存）

### 4.1 `POST /api/v1/assessments/{session_id}/answer`

- **鉴权**：是
- **前端情形：** 作答过程中勾选 / 修改答案时调用，支持多次覆盖保存。
- **请求体**

```json
{
  "item_id": "4a1e6c2d-0d77-410d-a860-a06f0ea1ad04",
  "answer": "A"
}
```

#### **成功 200**

- **后端处理：** 校验会话归属与状态，写入 / 更新对应回答；刷新进度统计。
- **前端处理：** 更新本地进度条、已答题数、最后答题位置。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "saved": true,
    "progress": { "total": 20, "answered": 7, "last_question_index": 6 }
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**403：无权限操作该会话**</u>

  ```json
  { "code": 1002, "message": "forbidden", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示会话不属于当前用户，跳转历史列表。

- #### <u>**404：题目不存在**</u>

  ```json
  { "code": 3001, "message": "item_not_found", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 刷新题单；不可回答，提示联系管理员。

- #### <u>**409：评测已提交**</u>

  ```json
  { "code": 4005, "message": "assessment_already_submitted", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示评测已结束，重定向至结果页。

- #### <u>**422：输入校验失败**</u>

  ```json
  { "code": 2001, "message": "validation_error", "data": { "errors": [] }, "request_id": "uuid" }
  ```

  - **前端处理：** 显示表单错误，阻止继续提交。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示稍后重试。

------

## 5) 提交整体评测

### 5.1 `POST /api/v1/assessments/{session_id}/submit`

- **鉴权**：是
- **前端情形：** 用户在结果页点击“提交评测”；如仍有题未答，可选择 `force=true` 强制提交。
- **查询参数**
  - `force`（boolean，默认 `false`）：为 `true` 时允许未答题目直接提交，未答题记 0 分。
- **请求体**：无

#### **<u>成功 200</u>**

- **后端处理：** 计算总分；调用 AI 生成总结（失败时回落默认文案）；更新 `assessment_sessions`（`submitted_at`、`total_score`、`ai_summary`、`ai_recommendation` 等）。
- **前端处理：** 展示总分、题目拆解与 AI 建议；根据 `can_mark_complete` 决定是否展示“标记完成”入口。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "3b6458f3-cb6a-40f6-96dd-65877ccf762f",
    "total_score": 20,
    "breakdown": [],
    "ai_summary": "Don't be discouraged by your score...",
    "ai_recommendation": {
      "level": "beginner",
      "focus_topics": [],
      "suggested_actions": [
        "Identify specific areas of governance you find challenging and seek resources or mentorship.",
        "Set a consistent study schedule to gradually build your understanding and confidence."
      ]
    },
    "submitted_at": "2025-10-18T06:59:31.939652Z"
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**422：存在未答题**</u>

  ```json
  { "code": 2001, "message": "missing_answers", "data": { "missing_orders": [3, 5] }, "request_id": "uuid" }
  ```

  - **前端处理：** 当 `force=false` 时，引导补答或允许用户切换 `force=true` 重试。

- #### <u>**409：评测已提交**</u>

  ```json
  { "code": 4005, "message": "assessment_already_submitted", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示评测已结束，跳转结果页。

- #### <u>**403：无权提交该会话**</u>

  ```json
  { "code": 1002, "message": "forbidden", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 阻止操作并提示切换账号或联系管理员。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 展示通用错误提示。

------

## 6) 查看评测历史

### 6.1 `GET /api/v1/assessments/history`

- **鉴权**：是
- **前端情形：** 个人中心“评测历史”列表，需要分页加载历史会话。
- **查询参数**
  - `page`：默认为 1
  - `limit`：每页条数（1-50），默认 10
- **请求体**：无

#### **成功 200**

- **前端处理：** 渲染列表与分页；总数为 0 时展示“暂无评测记录”。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "session_id": "3b6458f3-cb6a-40f6-96dd-65877ccf762f",
        "kind": "global",
        "started_at": "2025-10-18T06:55:00Z",
        "submitted_at": "2025-10-18T06:59:31Z",
        "total_score": 20.0,
        "question_count": 20
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 3, "total_pages": 1 }
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**401：未登录 / 凭证失效**</u>

  ```json
  { "code": 1001, "message": "unauthenticated", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 按鉴权策略调用刷新令牌或跳转登录。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 展示通用错误并提供重试。

------

## 7) 查看评测详情（逐题回放）

### 7.1 `GET /api/v1/assessments/{session_id}`

- **鉴权**：是
- **前端情形：** 从历史列表进入某次评测的逐题回放详情。
- **请求体**：无

#### **成功 200**

- **前端处理：** 渲染会话信息、题目列表与用户回答；可提供导出或重做入口。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session": {
      "session_id": "3b6458f3-cb6a-40f6-96dd-65877ccf762f",
      "kind": "global",
      "started_at": "2025-10-18T06:55:00Z",
      "submitted_at": "2025-10-18T06:59:31Z",
      "total_score": 20.0,
      "ai_summary": "...",
      "ai_recommendation": { "...": "..." }
    },
    "items": [
      {
        "order_no": 1,
        "snapshot": { "qtype": "single", "stem": "...", "choices": [] },
        "response": {
          "item_id": "198937b7-8d0b-4ffe-b987-8df4614f6f11",
          "your_answer": "A",
          "is_correct": true,
          "correct_answer": "A",
          "score": 1
        }
      }
    ]
  },
  "request_id": "uuid"
}
```

### **失败情况**

- #### <u>**403：无权限查看**</u>

  ```json
  { "code": 1002, "message": "forbidden", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示会话不属于当前用户，返回列表页。

- #### <u>**404：未提交或不存在**</u>

  ```json
  { "code": 3001, "message": "assessment_not_found", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 提示记录不存在或未提交，建议刷新。

- #### <u>**500：后端服务器内部错误**</u>

  ```json
  { "code": 9001, "message": "internal_error", "data": null, "request_id": "uuid" }
  ```

  - **前端处理：** 展示通用错误提示。

------

## 二、前端建议（适用于测评模块）

- **鉴权处理：** 继续复用认证部分的决策树；401 时先区分 `token_expired / token_invalid / unauthenticated`，避免错误刷新。
- **422 反馈：** 测评接口常见 `missing_answers`、`invalid_answer_reference`，建议直接高亮对应题目或弹出提示。
- **409 业务冲突：** 如 `unfinished_assessment_exists`、`no_pending_quiz`，需引导用户按流程继续或重新开始。
- **500 内部错误：** 展示“系统繁忙，请稍后重试”，同时附上 `request_id` 方便排查。
- **UI 状态：** 建议在抽题、自动保存、提交等操作时展示加载态或防抖，避免重复提交。
