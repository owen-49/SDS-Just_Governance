# Frontend Project Structure

This document explains the organization of the frontend codebase.

## Directory Structure

```
src/
├── components/           # React Components
│   ├── features/        # Feature-specific components
│   │   ├── AssessmentModal.jsx
│   │   ├── GlobalChat.jsx
│   │   └── index.js
│   ├── layout/          # Layout components
│   │   ├── DocumentLayout.jsx
│   │   ├── DocumentNavigation.jsx
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── index.js
│   └── ui/              # Basic UI components
│       ├── Modal.jsx
│       └── index.js
├── constants/           # Application constants
│   └── structure.js     # Topic/Module data structure
├── hooks/              # Custom React hooks
│   └── useConversations.js
├── pages/              # Page components (route handlers)
│   ├── Auth.jsx
│   ├── Home.jsx
│   ├── IntroductoryQuestions.jsx
│   ├── PrivacyPolicy.jsx
│   └── TermsAndConditions.jsx
├── services/           # API and data services
│   ├── api.js          # External API calls
│   ├── localDb.js      # Local storage operations
│   └── index.js
├── styles/             # CSS stylesheets
│   ├── app.css
│   ├── auth.css
│   ├── document.css
│   └── global.css
├── App.js              # Main App component
└── index.js            # Entry point
```

## Import Conventions

### Components
```javascript
// Layout components
import { Header, Sidebar } from '../components/layout';

// UI components  
import { Modal } from '../components/ui';

// Feature components
import { GlobalChat, AssessmentModal } from '../components/features';
```

### Services
```javascript
// API services
import { aiAsk } from '../services/api';
import { dbApi } from '../services/localDb';

// Or import all services
import { aiAsk, dbApi } from '../services';
```

### Constants
```javascript
// Data structures
import { sections, findTopicById } from '../constants/structure';
```

### Hooks
```javascript
// Custom hooks
import useConversations from '../hooks/useConversations';
```

## Component Categories

### Layout Components (`components/layout/`)
Components that define the overall layout and navigation structure:
- `Header.jsx` - Top navigation bar
- `Sidebar.jsx` - Side navigation panel
- `DocumentLayout.jsx` - Layout for documentation pages
- `DocumentNavigation.jsx` - Navigation for documents

### UI Components (`components/ui/`)
Reusable basic UI elements:
- `Modal.jsx` - Generic modal dialog

### Feature Components (`components/features/`)
Components that implement specific application features:
- `GlobalChat.jsx` - Main chat interface
- `AssessmentModal.jsx` - Assessment dialog

### Pages (`pages/`)
Top-level page components that correspond to routes:
- `Home.jsx` - Main application page
- `Auth.jsx` - Login/authentication page
- Various documentation pages

### Services (`services/`)
Data layer and external integrations:
- `api.js` - REST API calls
- `localDb.js` - Browser storage management

### Hooks (`hooks/`)
Custom React hooks for shared logic:
- `useConversations.js` - Chat conversation management

### Constants (`constants/`)
Application-wide constants and configurations:
- `structure.js` - Learning content structure
