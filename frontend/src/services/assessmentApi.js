// frontend/src/services/assessmentApi.js
/**
 * Assessment API Service
 * Handles all API calls for Topic Quiz and Global Assessment modules
 */

import { request } from './http';

const BASE_URL = '/api/v1';

export const assessmentApi = {
  // ========================================
  // Topic Quiz APIs
  // ========================================

  /**
   * Generate or get pending quiz for a topic
   * @param {string} topicId - Topic UUID
   * @returns {Promise} Quiz questions data
   */
  async getPendingQuiz(topicId) {
    const response = await request(`${BASE_URL}/topics/${topicId}/quiz/pending`, {
      method: 'POST'
    });
    return response?.data ?? response;
  },

  /**
   * Submit topic quiz answers
   * @param {string} topicId - Topic UUID
   * @param {Object} answers - Answer object mapping item_id to answer
   * @returns {Promise} Quiz result with score and explanations
   */
  async submitTopicQuiz(topicId, answers) {
    const response = await request(`${BASE_URL}/topics/${topicId}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    return response?.data ?? response;
  },

  // ========================================
  // Global Assessment APIs
  // ========================================

  /**
   * Start a new global assessment
   * @param {Object} options - {difficulty, count}
   * @returns {Promise} Session with questions
   */
  async startGlobalAssessment(options = {}) {
    const response = await request(`${BASE_URL}/assessments/global/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        difficulty: options.difficulty || 'mixed',
        count: options.count || 20
      })
    });
    return response;
  },

  /**
   * Fetch availability metadata for the global assessment.
   * @returns {Promise<{available_total:number, default_count:number, max_count:number}>}
   */
  async getGlobalAvailability() {
    const response = await request(`${BASE_URL}/assessments/global/availability`);
    return response?.data ?? response;
  },

  /**
   * Save answer for a single question (auto-save)
   * @param {string} sessionId - Assessment session UUID
   * @param {string} itemId - Question item UUID
   * @param {string} answer - User's answer
   * @returns {Promise} Save status and progress
   */
  async saveAnswer(sessionId, itemId, answer) {
    const response = await request(`${BASE_URL}/assessments/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        answer
      })
    });
    return response;
  },

  /**
   * Submit completed assessment
   * @param {string} sessionId - Assessment session UUID
   * @param {boolean} force - Force submit even with unanswered questions
   * @returns {Promise} Assessment result with AI recommendations
   */
  async submitAssessment(sessionId, force = false) {
    const url = `${BASE_URL}/assessments/${sessionId}/submit${force ? '?force=true' : ''}`;
    const response = await request(url, {
      method: 'POST'
    });
    return response;
  },

  /**
   * Get assessment history (paginated)
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise} List of past assessments
  */
  async getAssessmentHistory(page = 1, limit = 10) {
    const response = await request(`${BASE_URL}/assessments/history?page=${page}&limit=${limit}`);
    return response?.data ?? response;
  },

  /**
   * Get detailed result of a specific assessment
   * @param {string} sessionId - Assessment session UUID
   * @returns {Promise} Full assessment details with all questions and answers
   */
  async getAssessmentDetail(sessionId) {
    const response = await request(`${BASE_URL}/assessments/${sessionId}`);
    return response?.data ?? response;
  }
};

// Error message mapping for user-friendly display
export const ERROR_MESSAGES = {
  // 404 errors
  'not_found': 'Topic or assessment not found',
  'item_not_found': 'Question not found',
  'assessment_not_found': 'Assessment record not found',
  
  // 409 conflicts
  'no_pending_quiz': 'No pending quiz found. Please start a new quiz.',
  'unfinished_assessment_exists': 'You have an unfinished quiz. Please complete it first or go to the Quiz page to continue.',
  'unfinished_assessment': 'You have an unfinished quiz. Please complete it first or go to the Quiz page to continue.',
  'assessment_already_submitted': 'This assessment has already been submitted.',
  
  // 422 validation
  'validation_error': 'Invalid input. Please check your answers.',
  'missing_answers': 'Some questions are not answered yet.',
  'invalid_answer_reference': 'Invalid answer format. Please try again.',
  'duplicate_answers': 'Duplicate answers detected.',
  
  // 400 errors
  'insufficient_questions': 'Not enough questions available in the question bank.',
  
  // 403 errors
  'forbidden': 'You do not have permission to access this resource.',
  
  // Generic
  'internal_error': 'Server error. Please try again later.',
  'default': 'An error occurred. Please try again.'
};

/**
 * Get user-friendly error message
 * @param {Object} error - Error object from API
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  const message = error.body?.message || error.message;
  return ERROR_MESSAGES[message] || ERROR_MESSAGES.default;
}
