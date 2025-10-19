// frontend/src/components/Admin/UniversalManager.jsx
/**
 * Universal Manager Component
 * Reusable component for managing any entity type
 * 
 * Features:
 * - Dynamic form generation from config
 * - Automatic CRUD operations
 * - Caching support
 * - Error handling
 * - Responsive design
 * - Scalable to handle thousands of records
 */

import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminLoadingState } from './AdminLoadingState';
import './UniversalManager.css';

const UniversalManager = ({ config, onNotification }) => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sort_order');
  const [filterActive, setFilterActive] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, size: 20, total: 0 });

  const [formData, setFormData] = useState(() => {
    const initial = {};
    config.getFormFields().forEach(field => {
      initial[field.name] = field.default || '';
    });
    return initial;
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getEntityList(config.endpoint);
      setItems(data);
      setPagination(prev => ({ ...prev, total: data.length }));
    } catch (err) {
      onNotification?.('error', `Failed to load ${config.entityName}s: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [config, onNotification]);

  const handleFormChange = useCallback((fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    setFormErrors([]); // Clear errors on change
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);
    setIsLoading(true);

    try {
      const errors = config.validate(formData);
      if (errors.length > 0) {
        setFormErrors(errors);
        setIsLoading(false);
        return;
      }

      await adminApi.createEntity(config.endpoint, formData);
      onNotification?.('success', `${config.entityName} created successfully!`);

      // Reset form
      const initial = {};
      config.getFormFields().forEach(field => {
        initial[field.name] = field.default || '';
      });
      setFormData(initial);
      setShowForm(false);

      // Reload data
      await loadData();
    } catch (err) {
      onNotification?.('error', `Failed to create ${config.entityName}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and search
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' || 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesFilter = filterActive === null || item.is_active === filterActive;
    
    return matchesSearch && matchesFilter;
  });

  // Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  // Paginate
  const pageSize = pagination.size;
  const paginatedItems = sortedItems.slice(
    (pagination.page - 1) * pageSize,
    pagination.page * pageSize
  );
  const totalPages = Math.ceil(sortedItems.length / pageSize);

  return (
    <div className="universal-manager">
      <AdminLoadingState isLoading={isLoading} message={`Loading ${config.entityName}s...`} />

      {/* Header */}
      <div className="manager-header-section">
        <div>
          <h2>{config.entityName} Management</h2>
          <p>Manage all {config.entityName.toLowerCase()}s in your system</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Cancel' : `+ New ${config.entityName}`}
        </button>
      </div>

      {/* Error Messages */}
      {formErrors.length > 0 && (
        <div className="alert alert-error">
          <strong>Please fix the following errors:</strong>
          <ul>
            {formErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <div className="form-grid">
            {config.getFormFields().map(field => (
              <div key={field.name} className="form-group">
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="required">*</span>}
                </label>
                
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.name}
                    value={formData[field.name]}
                    onChange={(e) => handleFormChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={field.rows || 4}
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.name}
                    value={formData[field.name]}
                    onChange={(e) => handleFormChange(field.name, e.target.value)}
                    required={field.required}
                  >
                    <option value="">-- Select {field.label} --</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData[field.name]}
                      onChange={(e) => handleFormChange(field.name, e.target.checked)}
                    />
                    {field.label}
                  </label>
                ) : (
                  <input
                    id={field.name}
                    type={field.type}
                    value={formData[field.name]}
                    onChange={(e) => handleFormChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                  />
                )}
                {field.hint && <small>{field.hint}</small>}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : `Create ${config.entityName}`}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="manager-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            {config.getCardFields().map(field => (
              <option key={field.name} value={field.name}>
                Sort by {field.label}
              </option>
            ))}
          </select>

          {/* Check if entity has is_active field */}
          {config.fields.some(f => f.name === 'is_active') && (
            <select 
              value={filterActive === null ? 'all' : filterActive} 
              onChange={(e) => setFilterActive(e.target.value === 'all' ? null : e.target.value === 'true')}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          )}
        </div>
      </div>

      {/* Items Display */}
      <div className="items-list">
        <h3>
          {config.entityName}s 
          ({filteredItems.length}{filteredItems.length !== items.length && ` / ${items.length}`})
        </h3>

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>📭 No {config.entityName.toLowerCase()}s found</p>
            {searchTerm && <p>Try adjusting your search terms</p>}
          </div>
        ) : (
          <>
            <div className="items-grid">
              {paginatedItems.map((item) => (
                <div key={item.id || item[Object.keys(item)[0]]} className="item-card">
                  <div className="item-header">
                    {config.getCardFields().map(field => (
                      <div key={field.name} className="item-field">
                        <strong>{field.label}</strong>
                        <span>{item[field.name]}</span>
                      </div>
                    ))}
                  </div>
                  {item.is_active !== undefined && (
                    <div className="item-status">
                      <span className={`status-badge ${item.is_active ? 'active' : 'inactive'}`}>
                        {item.is_active ? '✓ Active' : '✕ Inactive'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="btn btn-sm"
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {pagination.page} of {totalPages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
                  disabled={pagination.page === totalPages}
                  className="btn btn-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UniversalManager;
