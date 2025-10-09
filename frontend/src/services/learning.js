import { request } from './http';

// 简单的内存缓存，避免重复请求
const cache = {
  boards: null,
  modules: {},
  topics: {},
  content: {},
  ttl: 5 * 60 * 1000, // 5分钟缓存
};

function getCacheKey(type, id) {
  return id ? `${type}_${id}` : type;
}

function getCache(type, id) {
  const key = getCacheKey(type, id);
  const cached = id ? cache[type]?.[id] : cache[type];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > cache.ttl) {
    if (id) delete cache[type][id];
    else cache[type] = null;
    return null;
  }
  return cached.data;
}

function setCache(type, id, data) {
  const timestamp = Date.now();
  if (id) {
    if (!cache[type]) cache[type] = {};
    cache[type][id] = { data, timestamp };
  } else {
    cache[type] = { data, timestamp };
  }
}

function unwrap(body) {
  return body?.data ?? body ?? null;
}

function normalizeTopic(topic, { fillDefaults = false } = {}) {
  if (!topic) return null;

  const normalized = {};
  const id = topic.topic_id ?? topic.topicId ?? topic.id ?? null;

  if (id !== null || fillDefaults) {
    normalized.id = id;
    normalized.topicId = id;
  }

  if (topic.name !== undefined || fillDefaults) {
    normalized.name = topic.name ?? '';
  }

  const sortOrder = topic.sort_order ?? topic.sortOrder;
  if (sortOrder !== undefined || fillDefaults) {
    normalized.sortOrder = sortOrder ?? 0;
  }

  const passThreshold = topic.pass_threshold ?? topic.passThreshold;
  if (passThreshold !== undefined || fillDefaults) {
    normalized.passThreshold = passThreshold ?? null;
  }

  const isActive = topic.is_active ?? topic.isActive;
  if (isActive !== undefined || fillDefaults) {
    normalized.isActive = isActive ?? true;
  }

  return normalized;
}

function createEmptyProgress() {
  return {
    status: 'not_started',
    lastScore: null,
    bestScore: null,
    attemptCount: 0,
    markedComplete: false,
    completedAt: null,
    lastVisitedAt: null,
    quizState: 'none',
    lastQuizSessionId: null,
  };
}

function mergeProgress(summary, progress) {
  const merged = createEmptyProgress();

  if (summary) {
    if (summary.progress_status) merged.status = summary.progress_status;
    if (summary.best_score !== undefined && summary.best_score !== null) {
      merged.bestScore = summary.best_score;
    }
    if (summary.last_score !== undefined && summary.last_score !== null) {
      merged.lastScore = summary.last_score;
    }
    if (summary.marked_complete !== undefined) {
      merged.markedComplete = Boolean(summary.marked_complete);
    }
  }

  if (progress) {
    if (progress.progress_status) merged.status = progress.progress_status;
    if (progress.best_score !== undefined && progress.best_score !== null) {
      merged.bestScore = progress.best_score;
    }
    if (progress.last_score !== undefined && progress.last_score !== null) {
      merged.lastScore = progress.last_score;
    }
    if (progress.attempt_count !== undefined && progress.attempt_count !== null) {
      merged.attemptCount = progress.attempt_count;
    }
    if (progress.marked_complete !== undefined) {
      merged.markedComplete = Boolean(progress.marked_complete);
    }
    if (progress.completed_at) merged.completedAt = progress.completed_at;
    if (progress.last_visited_at) merged.lastVisitedAt = progress.last_visited_at;
    if (progress.quiz_state) merged.quizState = progress.quiz_state;
    if (progress.last_quiz_session_id) {
      merged.lastQuizSessionId = progress.last_quiz_session_id;
    }
  }

  return merged;
}

async function listBoards({ page = 1, size = 100, sort = 'sort_order', order = 'asc' } = {}) {
  const cached = getCache('boards');
  if (cached) return cached;
  
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/boards?${search.toString()}`);
  const result = unwrap(body);
  
  setCache('boards', null, result);
  return result;
}

async function listModules(boardId, { page = 1, size = 100, sort = 'sort_order', order = 'asc' } = {}) {
  const cached = getCache('modules', boardId);
  if (cached) return cached;
  
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/boards/${boardId}/modules?${search.toString()}`);
  const result = unwrap(body);
  
  setCache('modules', boardId, result);
  return result;
}

async function listTopics(moduleId, { page = 1, size = 200, sort = 'sort_order', order = 'asc' } = {}) {
  const cached = getCache('topics', moduleId);
  if (cached) return cached;
  
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/modules/${moduleId}/topics?${search.toString()}`);
  const result = unwrap(body);
  
  setCache('topics', moduleId, result);
  return result;
}

async function getTopicDetail(topicId) {
  const body = await request(`/api/v1/topics/${topicId}`);
  return unwrap(body);
}

async function getTopicContent(topicId) {
  const cached = getCache('content', topicId);
  if (cached) return cached;
  
  const body = await request(`/api/v1/topics/${topicId}/content`);
  const result = unwrap(body);
  
  setCache('content', topicId, result);
  return result;
}

async function getTopicProgress(topicId) {
  const body = await request(`/api/v1/topics/${topicId}/progress`);
  return unwrap(body);
}

async function visitTopic(topicId) {
  const body = await request(`/api/v1/topics/${topicId}/visit`, { method: 'POST' });
  return unwrap(body);
}

async function completeTopic(topicId) {
  const body = await request(`/api/v1/topics/${topicId}/complete`, { method: 'POST' });
  return unwrap(body);
}

async function getProgressOverview() {
  const body = await request('/api/v1/progress/overview');
  return unwrap(body);
}

function normalizeResourceList(resources) {
  if (!resources) return [];
  if (Array.isArray(resources)) return resources;
  if (typeof resources === 'object') {
    return Object.entries(resources).map(([title, url]) => ({ title, url }));
  }
  return [];
}

function buildTopicNode(module, topic) {
  const normalized = normalizeTopic(topic, { fillDefaults: true });
  return {
    ...normalized,
    moduleId: module.module_id ?? module.moduleId ?? null,
    boardId: module.boardId ?? module.board_id ?? null,
    // Content will be loaded lazily when requested
    contentLoaded: false,
    content: null,
    summary: null,
    resources: [],
  };
}

function buildModuleNode(board, module, topics) {
  const moduleId = module.module_id ?? module.moduleId ?? module.id ?? null;
  const sortOrder = module.sort_order ?? module.sortOrder ?? 0;
  return {
    id: moduleId,
    moduleId,
    boardId: board.board_id ?? board.boardId ?? board.id ?? null,
    name: module.name ?? '',
    sortOrder,
    topics,
  };
}

function buildBoardNode(board, modules) {
  const boardId = board.board_id ?? board.boardId ?? board.id ?? null;
  const sortOrder = board.sort_order ?? board.sortOrder ?? 0;
  return {
    id: boardId,
    boardId,
    name: board.name ?? '',
    sortOrder,
    modules,
  };
}

async function fetchStructure() {
  const boardsPayload = await listBoards({ size: 100 });
  const boardItems = boardsPayload?.items ?? [];

  const boards = await Promise.all(
    boardItems.map(async (board) => {
      const boardContext = {
        ...board,
        boardId: board.board_id ?? board.boardId ?? board.id ?? null,
      };

      const modulesPayload = await listModules(board.board_id, { size: 100 });
      const moduleItems = modulesPayload?.items ?? [];

      const modules = await Promise.all(
        moduleItems.map(async (module) => {
          const moduleContext = {
            ...module,
            moduleId: module.module_id ?? module.moduleId ?? module.id ?? null,
            boardId: boardContext.boardId,
          };

          const topicsPayload = await listTopics(module.module_id, { size: 200 });
          const topicItems = (topicsPayload?.items ?? []).filter((topic) => topic.is_active !== false);
          const topics = topicItems
            .map((topic) => buildTopicNode(moduleContext, topic))
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

          return buildModuleNode(boardContext, moduleContext, topics);
        })
      );

      modules.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      return buildBoardNode(boardContext, modules);
    })
  );

  boards.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return boards;
}

async function ensureTopicContent(structureTopic) {
  if (!structureTopic || structureTopic.contentLoaded) {
    return structureTopic;
  }

  try {
    const content = await getTopicContent(structureTopic.id);
    if (content) {
      structureTopic.contentLoaded = true;
      structureTopic.content = content.body_markdown || '';
      structureTopic.summary = content.summary || '';
      structureTopic.resources = normalizeResourceList(content.resources);
    }
  } catch (error) {
    // Allow missing topic content to fail silently so UI can fallback to placeholders
    structureTopic.contentLoaded = true;
    structureTopic.content = structureTopic.content || '';
    structureTopic.summary = structureTopic.summary || '';
    structureTopic.resources = structureTopic.resources || [];
  }

  return structureTopic;
}

export const learningApi = {
  listBoards,
  listModules,
  listTopics,
  getTopicDetail,
  getTopicContent,
  getTopicProgress,
  visitTopic,
  completeTopic,
  getProgressOverview,
  fetchStructure,
  ensureTopicContent,
  createEmptyProgress,
  mergeProgress,
  normalizeTopic,
  normalizeResourceList,
};

export default learningApi;
