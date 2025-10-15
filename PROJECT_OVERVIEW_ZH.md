# Just Governance 平台概览

## 总体架构
- **后端** —— 基于 FastAPI 的应用，配置了结构化日志、请求 ID 与访问日志中间件、灵活的 CORS 规则，并将 AI 助手、学习评估、身份认证、入职引导与学习内容等路由统一挂载在生命周期钩子下。【F:backend/app/main.py†L1-L76】
- **前端** —— React 单页应用，通过鉴权守护路由、渲染政策页面，并在刷新/启动用户会话后通过 REST API 推动学习体验。【F:frontend/src/App.js†L1-L66】
- **共享资产** —— 领域模型、提示词与问卷保存在后端；前端提供演示数据、全局资源与本地存储模拟，支持离线探索。【F:backend/app/models/__init__.py†L1-L21】【F:backend/app/core/config/config.py†L1-L42】【F:frontend/src/services/localDb.js†L1-L200】

## 后端服务
### 配置与基础设施
环境变量加载自 `backend/.env`，提供 OpenAI 凭证、数据库 URL 以及提示词/问卷路径，使应用能在多环境间最小化改动即可运行。默认 CORS 来源覆盖本地开发端口，方便 SPA 集成。【F:backend/app/core/config/config.py†L1-L42】

### 身份认证与会话管理
`/api/v1/auth` 路由覆盖完整生命周期：注册时保存哈希密码，登录时签发访问令牌并轮换刷新令牌，会话持久化，带轮换保护的刷新操作，以及登出时清理凭证。Cookies 采用安全默认值限定刷新令牌作用域。【F:backend/app/api/routes/auth.py†L26-L200】

### 学习内容 API
REST 端点暴露课程元数据。调用方可以分页获取看板、模块与活跃主题，保持一致的排序与校验。主题详情请求会合并标准化元数据、进度摘要与 Markdown 正文，再封装为 API 响应返回。【F:backend/app/api/routes/learning.py†L1-L200】

### 入职问卷
版本化的入职问卷直接嵌入 API 层，覆盖信心、动机、阻碍与学习兴趣。提交记录按用户去重、评分，并在请求提交前通过仓储助手持久化。【F:backend/app/api/routes/onboarding.py†L13-L200】

### AI 辅助学习
早期 AI 端点通过模板化提示词、调用 OpenAI 对话补全并归一化响应，为主题讲解与自由问答提供支持。提示词模板会缓存与校验，以支持结构化（大纲/清单）和回退到纯文本的响应方式。【F:backend/app/api/old_routes/chat.py†L1-L43】【F:backend/app/services/old/gpt_call.py†L1-L95】

## 前端应用
### 路由与鉴权流程
React 应用在 `REACT_APP_USE_AUTH_V1` 启用时，会尝试依次调用 refresh/me API 以初始化。已登录用户可访问首页仪表盘与入门提问，未登录访客将重定向到登录表单。法律文档保持公开可访问。【F:frontend/src/App.js†L12-L66】

### 首页学习工作区
`Home.jsx` 组合布局、Markdown 渲染、评估组件与 AI 聊天窗口。它索引课程结构，通过本地存储同步每个主题的对话与进度，并借助学习 API 加载服务器数据（详情、进度、内容、访问追踪）。Markdown 摘要成为重点提示，元数据驱动学习者的状态计算。【F:frontend/src/pages/Home.jsx†L1-L200】

### 客户端服务
- `authApi` 封装注册/登录/刷新/me/登出等 REST 调用，并缓存后续请求所需的 Bearer Token。【F:frontend/src/services/auth.js†L1-L80】
- `dbApi` 基于 localStorage 提供演示用的模拟后端，覆盖用户账户、验证令牌、导航状态、对话记录与测验成绩。【F:frontend/src/services/localDb.js†L1-L200】
- `api.js` 暴露与 FastAPI 端点对接的评估与 AI 提问辅助方法。【F:frontend/src/services/api.js†L1-L57】

## 建议的下一步
- 连接真实数据库并迁移离开本地模拟存储，以提升生产可靠性。【F:frontend/src/services/localDb.js†L27-L200】
- 将 AI 端点迁出 `old_routes`，并让提示词管理对齐最新版 OpenAI SDK 的使用模式，以增强稳健性。【F:backend/app/api/old_routes/chat.py†L1-L43】【F:backend/app/services/old/gpt_call.py†L1-L95】
- 扩展迁移执行与看板/主题数据初始化的文档，帮助新贡献者复现学习目录。【F:backend/app/api/routes/learning.py†L69-L200】
