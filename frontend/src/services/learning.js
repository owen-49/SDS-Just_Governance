import { request } from './http';

function unwrap(body) {
  return body?.data ?? body ?? null;
}

async function listBoards({ page = 1, size = 100, sort = 'sort_order', order = 'asc' } = {}) {
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/boards?${search.toString()}`);
  return unwrap(body);
}

async function listModules(boardId, { page = 1, size = 100, sort = 'sort_order', order = 'asc' } = {}) {
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/boards/${boardId}/modules?${search.toString()}`);
  return unwrap(body);
}

async function listTopics(moduleId, { page = 1, size = 200, sort = 'sort_order', order = 'asc' } = {}) {
  const search = new URLSearchParams({ page: String(page), size: String(size), sort, order });
  const body = await request(`/api/v1/modules/${moduleId}/topics?${search.toString()}`);
  return unwrap(body);
}

async function getTopicDetail(topicId) {
  const body = await request(`/api/v1/topics/${topicId}`);
  return unwrap(body);
}

async function getTopicContent(topicId) {
  const body = await request(`/api/v1/topics/${topicId}/content`);
  return unwrap(body);
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
  return {
    id: topic.topic_id,
    moduleId: module.module_id,
    boardId: module.boardId,
    name: topic.name,
    sortOrder: topic.sort_order ?? 0,
    passThreshold: topic.pass_threshold ?? null,
    isActive: topic.is_active !== false,
    // Content will be loaded lazily when requested
    contentLoaded: false,
    content: null,
    summary: null,
    resources: [],
  };
}

function buildModuleNode(board, module, topics) {
  return {
    id: module.module_id,
    boardId: board.board_id,
    name: module.name,
    sortOrder: module.sort_order ?? 0,
    topics,
  };
}

function buildBoardNode(board, modules) {
  return {
    id: board.board_id,
    name: board.name,
    sortOrder: board.sort_order ?? 0,
    modules,
  };
}

async function fetchStructure() {
  const boardsPayload = await listBoards({ size: 100 });
  const boardItems = boardsPayload?.items ?? [];

  const boards = await Promise.all(
    boardItems.map(async (board) => {
      const modulesPayload = await listModules(board.board_id, { size: 100 });
      const moduleItems = modulesPayload?.items ?? [];

      const modules = await Promise.all(
        moduleItems.map(async (module) => {
          const topicsPayload = await listTopics(module.module_id, { size: 200 });
          const topicItems = (topicsPayload?.items ?? []).filter((topic) => topic.is_active !== false);
          const topics = topicItems
            .map((topic) => buildTopicNode({ ...module, boardId: board.board_id }, topic))
            .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

          return buildModuleNode({ ...board }, module, topics);
        })
      );

      modules.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      return buildBoardNode(board, modules);
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
};

export default learningApi;
