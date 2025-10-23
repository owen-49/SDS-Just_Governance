// frontend/src/services/adminApi.js
/**
 * Admin API Service
 * Handles all API calls for admin management operations
 */

import { request } from '../lib/api';

const BASE_URL = '/api/v1/admin/learning';

// Simple cache with TTL
const cache = {
  boards: null,
  modules: null,
  topics: null,
  ttl: 5 * 60 * 1000, // 5 minutes
  timestamps: {},
};

function getCache(key) {
  if (!cache[key]) return null;
  const now = Date.now();
  const cached = cache[key];
  if (now - cache.timestamps[key] > cache.ttl) {
    cache[key] = null;
    return null;
  }
  return cached;
}

function setCache(key, data) {
  cache[key] = data;
  cache.timestamps[key] = Date.now();
}

function invalidateCache(keys) {
  keys.forEach(key => {
    cache[key] = null;
  });
}

export const adminApi = {
  // ============================================
  // Universal Entity Management
  // ============================================

  /**
   * Generic method to fetch any entity list
   * @param {string} endpoint - API endpoint (e.g., '/api/v1/boards')
   * @param {Object} options - { page, size, sort, order, cacheKey }
   * @returns {Promise}
   */
  async getEntityList(endpoint, options = {}) {
    const {
      page = 1,
      size = 100,
      sort = 'sort_order',
      order = 'asc',
      cacheKey = null,
    } = options;

    // Check cache if provided
    if (cacheKey) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    try {
      const url = `${endpoint}?page=${page}&size=${size}&sort=${sort}&order=${order}`;
      const response = await request(url);
      const data = response.data?.items || [];
      
      // Cache if cache key provided
      if (cacheKey) {
        setCache(cacheKey, data);
      }
      
      return data;
    } catch (err) {
      console.error(`Failed to fetch from ${endpoint}:`, err);
      throw new Error(`Failed to load data from ${endpoint}`);
    }
  },

  /**
   * Generic method to create any entity
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Entity data
   * @param {Array} cacheKeysToInvalidate - Cache keys to invalidate after creation
   * @returns {Promise}
   */
  async createEntity(endpoint, data, cacheKeysToInvalidate = []) {
    try {
      const response = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Invalidate relevant caches
      if (cacheKeysToInvalidate.length > 0) {
        invalidateCache(cacheKeysToInvalidate);
      }
      
      return response.data;
    } catch (err) {
      console.error(`Failed to create entity at ${endpoint}:`, err);
      throw new Error(`Failed to create entity: ${err.message}`);
    }
  },

  // ============================================
  // Boards Management
  // ============================================

  /**
   * Get all boards
   * @returns {Promise}
   */
  async getBoards() {
    const cached = getCache('boards');
    if (cached) return cached;
    
    try {
      const response = await request('/api/v1/boards?page=1&size=100&sort=sort_order&order=asc');
      const data = response.data?.items || [];
      setCache('boards', data);
      return data;
    } catch (err) {
      console.error('Failed to fetch boards:', err);
      throw new Error('Failed to load boards');
    }
  },

  /**
   * Create a new board
   * @param {Object} data - { name, sort_order }
   * @returns {Promise}
   */
  async createBoard(data) {
    const response = await request(`${BASE_URL}/boards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateCache(['boards']);
    return response.data;
  },

  // ============================================
  // Modules Management
  // ============================================

  /**
   * Get all modules from all boards
   * @returns {Promise}
   */
  async getModules() {
    const cached = getCache('modules');
    if (cached) return cached;
    
    try {
      const boards = await this.getBoards();
      const allModules = [];
      
      // Fetch modules for each board
      for (const board of boards) {
        try {
          const response = await request(
            `/api/v1/boards/${board.board_id}/modules?page=1&size=100&sort=sort_order&order=asc`
          );
          const modules = response.data?.items || [];
          modules.forEach(module => {
            allModules.push({
              ...module,
              boardId: board.board_id,
              boardName: board.name,
            });
          });
        } catch (err) {
          console.error(`Failed to fetch modules for board ${board.board_id}:`, err);
        }
      }
      
      setCache('modules', allModules);
      return allModules;
    } catch (err) {
      console.error('Failed to fetch modules:', err);
      throw new Error('Failed to load modules');
    }
  },

  /**
   * Create a new module
   * @param {Object} data - { board_id, name, sort_order }
   * @returns {Promise}
   */
  async createModule(data) {
    const response = await request(`${BASE_URL}/modules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateCache(['modules', 'boards']);
    return response.data;
  },

  // ============================================
  // Topics Management
  // ============================================

  /**
   * Create a new topic
   * @param {Object} data - { module_id, name, sort_order, pass_threshold, is_active }
   * @returns {Promise}
   */
  async createTopic(data) {
    const response = await request(`${BASE_URL}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateCache(['topics', 'modules', 'boards']);
    return response.data;
  },

  /**
   * Get all topics from all modules
   * @returns {Promise}
   */
  async getTopics() {
    const cached = getCache('topics');
    if (cached) return cached;
    
    try {
      const boards = await this.getBoards();
      const allTopics = [];
      
      // For each board, fetch modules and their topics
      for (const board of boards) {
        try {
          const modulesResponse = await request(
            `/api/v1/boards/${board.board_id}/modules?page=1&size=100&sort=sort_order&order=asc`
          );
          const modules = modulesResponse.data?.items || [];
          
          // For each module, fetch topics
          for (const module of modules) {
            try {
              const topicsResponse = await request(
                `/api/v1/modules/${module.module_id}/topics?page=1&size=100&sort=sort_order&order=asc`
              );
              const topics = topicsResponse.data?.items || [];
              
              topics.forEach(topic => {
                allTopics.push({
                  id: topic.topic_id || topic.id,
                  topic_id: topic.topic_id,
                  title: topic.name,
                  name: topic.name,
                  boardId: board.board_id,
                  board: board.name,
                  moduleId: module.module_id,
                  module: module.name,
                  is_active: topic.is_active !== false,
                  pass_threshold: topic.pass_threshold || 0.8,
                  sort_order: topic.sort_order || 0,
                });
              });
            } catch (err) {
              console.error(`Failed to fetch topics for module ${module.module_id}:`, err);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch modules for board ${board.board_id}:`, err);
        }
      }
      
      setCache('topics', allTopics);
      return allTopics;
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      throw new Error('Failed to load topics');
    }
  },

  // ============================================
  // Content Management
  // ============================================

  /**
   * Update topic content
   * @param {string} topicId - Topic UUID
   * @param {Object} data - { body_format, body_markdown, summary, resources }
   * @returns {Promise}
   */
  async updateTopicContent(topicId, data) {
    const response = await request(`${BASE_URL}/topics/${topicId}/content`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    invalidateCache(['topics']);
    return response.data;
  },

  // ============================================
  // Documents Management (RAG)
  // ============================================

  /**
   * Upload documents for RAG
   * @param {string} topicId - Topic UUID
   * @param {Object} data - { title, source, metadata, chunks }
   * @returns {Promise}
   */
  async uploadDocument(topicId, data) {
    try {
      console.log('📤 Uploading document to topic:', topicId);
      console.log('📝 Document data:', data);
      
      const response = await request(`${BASE_URL}/topics/${topicId}/documents`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      console.log('✅ Document upload response:', response);
      invalidateCache(['topics']);
      return response.data;
    } catch (error) {
      console.error('❌ Document upload failed:', error);
      throw error;
    }
  },

  // ============================================
  // Questions Management
  // ============================================

  /**
   * Create a new question for a topic
   * @param {string} topicId - Topic UUID
   * @param {Object} data - { stem, qtype, choices, correct_options, explanation, is_active }
   * @returns {Promise}
   */
  async createQuestion(topicId, data) {
    const response = await request(`${BASE_URL}/topics/${topicId}/quiz/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    invalidateCache(['topics']);
    return response.data;
  },
};

/**
 * Extract error message from API error
 */
export const getAdminErrorMessage = (error) => {
  if (error?.body?.message) {
    return error.body.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};
