import React from 'react';
import DocumentNavigation from './DocumentNavigation';
import '../../styles/document.css';

const DocumentLayout = ({ title, children, lastUpdated }) => {
  return (
    <div className="document-wrapper">
      <DocumentNavigation />
      <div className="document-layout">
        <div className="document-header">
          <h1 className="document-title">{title}</h1>
          {lastUpdated && (
            <p className="document-updated">Last updated: {lastUpdated}</p>
          )}
        </div>
        <div className="document-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DocumentLayout;
