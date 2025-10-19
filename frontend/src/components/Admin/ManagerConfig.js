// frontend/src/components/Admin/ManagerConfig.js
/**
 * Universal Manager Configuration System
 * Scalable configuration for all admin managers
 * 
 * Usage:
 * const config = new ManagerConfig('Board')
 *   .setEndpoint('/api/v1/boards')
 *   .setFields([
 *     { name: 'name', type: 'text', label: 'Board Name' },
 *     { name: 'sort_order', type: 'number', label: 'Sort Order' }
 *   ])
 *   .setDisplay(['name', 'sort_order']);
 */

class ManagerConfig {
  constructor(entityName) {
    this.entityName = entityName;
    this.endpoint = null;
    this.fields = [];
    this.displayFields = [];
    this.parentField = null;
    this.childEndpoint = null;
    this.cacheKey = null;
    this.pageSize = 100;
  }

  setEndpoint(endpoint) {
    this.endpoint = endpoint;
    this.cacheKey = this.entityName.toLowerCase();
    return this;
  }

  setFields(fields) {
    this.fields = fields;
    return this;
  }

  setDisplay(fieldNames) {
    this.displayFields = fieldNames;
    return this;
  }

  setParentRelation(parentFieldName, parentEndpoint) {
    this.parentField = parentFieldName;
    this.childEndpoint = this.endpoint;
    this.endpoint = parentEndpoint;
    return this;
  }

  setPageSize(size) {
    this.pageSize = Math.min(size, 100); // Backend max is 100
    return this;
  }

  getFormFields() {
    return this.fields.filter(f => f.name !== 'id' && f.name !== 'created_at');
  }

  getCardFields() {
    return this.displayFields.map(name => 
      this.fields.find(f => f.name === name)
    ).filter(Boolean);
  }

  validate(data) {
    const errors = [];
    this.fields.forEach(field => {
      if (field.required && !data[field.name]) {
        errors.push(`${field.label} is required`);
      }
      if (field.type === 'email' && data[field.name] && !isValidEmail(data[field.name])) {
        errors.push(`${field.label} must be a valid email`);
      }
      if (field.type === 'number' && data[field.name] && isNaN(data[field.name])) {
        errors.push(`${field.label} must be a number`);
      }
    });
    return errors;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default ManagerConfig;
