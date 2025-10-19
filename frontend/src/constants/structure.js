// Just Governance Learning Content Structure
// Note: Content is now dynamically loaded from the backend API.
// This file only contains helper functions for backward compatibility.

// Legacy hardcoded data has been removed.
// Use the Learning API endpoints instead:
// - GET /api/v1/boards - Get all boards with modules and topics
// - GET /api/v1/topics/:id - Get specific topic details

export const sections = [];

export function findTopicById(topicId) {
  console.warn('findTopicById is deprecated. Use API: GET /api/v1/topics/:id');
  return null;
}

export function findModuleById(moduleId) {
  console.warn('findModuleById is deprecated. Use API: GET /api/v1/boards');
  return null;
}

export function getAllModules() {
  console.warn('getAllModules is deprecated. Use API: GET /api/v1/boards');
  return [];
}
