# 学习主题（Topic）接口说明

> 本文档覆盖“学习板块 → 模块 → 主题”相关接口，重点说明前端在首页/主题页中如何与后端联动完成主题内容加载、进度同步与完成标记。

---

## 1. 数据模型速览

| 名称 | 说明 | 关键字段 |
| ---- | ---- | -------- |
| Board | 学习板块（Learning Board），用于聚合多个模块 | `board_id`, `name`, `sort_order` |
| Module | 模块（Learning Module），隶属于某个板块 | `module_id`, `board_id`, `name`, `sort_order` |
| Topic | 主题（Learning Topic），隶属于某个模块 | `topic_id`, `module_id`, `name`, `pass_threshold`, `sort_order`, `is_active` |
| TopicContent | 主题的正文/资源 | `body_markdown`, `summary`, `resources` |
| UserTopicProgress | 用户与主题的进度关系 | `progress_status`, `best_score`, `last_score`, `marked_complete`, `completed_at`, `last_visited_at`, `quiz_state` |

- 所有接口统一返回格式：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": { "..." },
    "request_id": "uuid"
  }
  ```
- 鉴权：除特别说明外，下列接口均要求携带 `Authorization: Bearer <access_token>`。
- `progress_status` 取值：`not_started` / `in_progress` / `completed`。

---

## 2. 前端加载流程

1. **获取结构树**：
   1. `GET /api/v1/boards`
   2. `GET /api/v1/boards/{board_id}/modules`
   3. `GET /api/v1/modules/{module_id}/topics`
   
   前端需要依次调用并构建 “板块 → 模块 → 主题” 树；若任一步骤失败则可以回退到本地示例数据。

2. **进入主题页时加载详情**：并行请求以下接口：
   - `GET /api/v1/topics/{topic_id}`：主题基础信息 + 概要进度
   - `GET /api/v1/topics/{topic_id}/content`：主题正文内容
   - `GET /api/v1/topics/{topic_id}/progress`：详细进度
   - 请求成功后再调用 `POST /api/v1/topics/{topic_id}/visit` 记录浏览时间

3. **主题完成操作**：
   - `POST /api/v1/topics/{topic_id}/complete`
   - 后端会校验分数是否达到 `pass_threshold`，失败时返回 409。

---

## 3. 接口详情

### 3.1 `GET /api/v1/boards`
- **用途**：获取学习板块列表。
- **请求参数**：
  | 字段 | 类型 | 默认 | 说明 |
  | ---- | ---- | ---- | ---- |
  | `page` | int | 1 | 分页页码（>=1） |
  | `size` | int | 20 | 单页数量（1~100） |
  | `sort` | string | `sort_order` | 排序字段：`sort_order` / `name` / `id` |
  | `order` | string | `asc` | 顺序：`asc` / `desc` |
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "items": [
        {
          "board_id": "92b6c5f5-...",
          "name": "Foundations of Governance",
          "sort_order": 1
        }
      ],
      "page": 1,
      "size": 20,
      "total": 2
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 422：`invalid_order` / `invalid_sort`（排序参数非法）。

### 3.2 `GET /api/v1/boards/{board_id}/modules`
- **用途**：获取指定板块下的模块列表。
- **请求参数**：与 3.1 相同。
- **成功响应**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "items": [
        {
          "module_id": "35c8...",
          "name": "Community Engagement",
          "sort_order": 1
        }
      ],
      "page": 1,
      "size": 50,
      "total": 3
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 404：`module_not_found`（板块不存在）。
  - 422：排序参数非法。

### 3.3 `GET /api/v1/modules/{module_id}/topics`
- **用途**：获取模块内的主题（仅返回 `is_active = true` 的主题）。
- **成功响应**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "items": [
        {
          "topic_id": "0ce2...",
          "name": "Building Trust with Stakeholders",
          "pass_threshold": 0.7,
          "sort_order": 1,
          "is_active": true
        }
      ],
      "page": 1,
      "size": 50,
      "total": 8
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 404：`module_not_found`。
  - 422：排序参数非法。

### 3.4 `GET /api/v1/topics/{topic_id}`
- **用途**：拉取单个主题的基础信息与概要进度。
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "topic": {
        "topic_id": "0ce2...",
        "name": "Building Trust with Stakeholders",
        "pass_threshold": 0.7,
        "is_active": true
      },
      "progress_summary": {
        "progress_status": "in_progress",
        "best_score": 0.82,
        "last_score": 0.75,
        "marked_complete": false
      }
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 404：`topic_not_found`。

### 3.5 `GET /api/v1/topics/{topic_id}/content`
- **用途**：获取主题正文、摘要及学习资源。
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "topic_id": "0ce2...",
      "body_format": "markdown",
      "body_markdown": "# Lesson\n...",
      "summary": "Key takeaways ...",
      "resources": [
        { "title": "Toolkit", "url": "https://..." },
        { "title": "Case Study", "url": "https://..." }
      ]
    },
    "request_id": "..."
  }
  ```
- **备注**：`resources` 返回数组；若数据库存储为对象，后端已转换为数组。
- **错误**：
  - 404：`topic_content_not_found` / `topic_not_found`。

### 3.6 `GET /api/v1/topics/{topic_id}/progress`
- **用途**：获取主题的完整进度数据。
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "progress_status": "in_progress",
      "last_score": 0.75,
      "attempt_count": 2,
      "best_score": 0.82,
      "last_quiz_session_id": "9d0a...",
      "quiz_state": "eligible",
      "marked_complete": false,
      "completed_at": null,
      "last_visited_at": "2024-05-20T08:30:12+00:00"
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 404：`topic_not_found`。

### 3.7 `POST /api/v1/topics/{topic_id}/visit`
- **用途**：记录“用户访问主题”的时间，并在首次访问时将进度置为 `in_progress`。
- **请求体**：无。
- **成功响应**：`{"code":0,"message":"ok","data":null,...}`。
- **错误**：
  - 404：`topic_not_found`。

### 3.8 `POST /api/v1/topics/{topic_id}/complete`
- **用途**：标记主题完成。
- **请求体**：无。
- **成功响应**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "marked_complete": true,
      "completed_at": "2024-05-21T10:12:00+00:00"
    },
    "request_id": "..."
  }
  ```
- **错误**：
  - 404：`topic_not_found`。
  - 409：
    - `score_below_threshold`：`data.pass_threshold` 提供要求分数，前端应提示“成绩未达标，请复习后再试”。
    - `already_marked_complete`：重复提交时返回。

### 3.9 `GET /api/v1/progress/overview`
- **用途**：在“进度概览”弹窗中展示各板块/模块的完成数量。
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "boards": [
        {
          "board_id": "92b6c5f5-...",
          "name": "Foundations of Governance",
          "modules": [
            {
              "module_id": "35c8...",
              "name": "Community Engagement",
              "topics_total": 8,
              "topics_completed": 3
            }
          ]
        }
      ]
    },
    "request_id": "..."
  }
  ```

---

## 4. 前端对接要点

1. **结构构建**：
   - 通过 `fetchStructure()`（封装顺序调用上述 3 个列表接口）生成侧边导航数据；接口失败时回退到 `constants/structure.js` 中的离线样例。

2. **主题详情加载**：
   - 并发请求详情 / 内容 / 进度，失败时提示用户并保留本地缓存。
   - 请求成功后调用 `visit` 接口更新 `last_visited_at`，并在 UI 上刷新状态。

3. **完成校验**：
   - 调用 `complete` 前可根据 `progress.best_score` 与 `topic.pass_threshold` 判断是否有必要引导用户先完成测验；若后端返回 409，也要读取 `data.pass_threshold` 给出友好文案。

4. **资源归一化**：
   - 前端在渲染推荐资源时统一把 `resources` 转换为数组（已在服务层做兼容）。

5. **缓存策略**：
   - 首页 `TopicPage` 在 `isApiSource` 下不会写入本地离线库，只读取后端数据；当 API 不可用时，才回退到 `localDb` 模式。

---

## 5. 错误码对照

| HTTP | `message` | 常见场景 | 前端处理 |
| ---- | --------- | -------- | -------- |
| 401 | `unauthenticated` / `token_expired` | 未登录或凭证过期 | 触发统一的登录态拦截流程 |
| 404 | `board_not_found` / `module_not_found` / `topic_not_found` | 路径参数无效 / 资源被删除 | 返回首页或提示“主题不存在” |
| 409 | `score_below_threshold` | 成绩未达标 | 弹出提示，附带 `data.pass_threshold` |
| 409 | `already_marked_complete` | 重复完成 | 显示“已完成”提示 |
| 422 | `invalid_sort` / `invalid_order` | 列表排序参数错误 | 开发/测试阶段排查参数；正式环境避免传错 |
| 500+ | `internal_error` 等 | 服务器异常 | 显示重试按钮，记录 `request_id` |

---

## 6. 示例前端调用

```ts
import { learningApi } from '@/services/learning';

async function openTopic(topicId: string) {
  try {
    const [detail, progress, content] = await Promise.all([
      learningApi.getTopicDetail(topicId),
      learningApi.getTopicProgress(topicId),
      learningApi.getTopicContent(topicId),
    ]);

    // 规范化主题信息（将 topic_id → id / topicId）
    const topicMeta = {
      ...learningApi.normalizeTopic(detail?.topic),
      progress: learningApi.mergeProgress(detail?.progress_summary, progress),
    };

    // 资源列表一定是数组
    const resources = learningApi.normalizeResourceList(content?.resources);

    // 访问上报
    await learningApi.visitTopic(topicId);

    return { topicMeta, resources, content };
  } catch (error) {
    // 统一错误处理
    throw error;
  }
}
```

---

> 如需扩展主题相关能力（如测验、情景模拟），建议沿用本规范的命名与鉴权方式。
