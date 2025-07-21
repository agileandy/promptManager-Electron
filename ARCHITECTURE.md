# Architecture Overview

## System Architecture

The AI Prompt Manager follows a **layered architecture** with clear separation between the Electron main process, renderer process, and data persistence layer.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Prompt UI     │ │    Tag Tree     │ │   AI Settings   │   │
│  │   Components    │ │   Components    │ │   Components    │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON RENDERER PROCESS                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Application Core                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │   Event     │ │    State    │ │      Component      │  │  │
│  │  │  Manager    │ │  Manager    │ │      Manager        │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Business Logic Layer                   │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │     Tag     │ │   Version   │ │       Prompt        │  │  │
│  │  │  Management │ │   Control   │ │     Management      │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Service Layer                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ AI Service  │ │  Database   │ │   Configuration     │  │  │
│  │  │ Integration │ │   Service   │ │     Service         │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Process Management                     │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │   Window    │ │     IPC     │ │      Security       │  │  │
│  │  │  Manager    │ │   Handlers  │ │     Manager         │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  External Integrations                   │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ AI Provider │ │    File     │ │    Configuration    │  │  │
│  │  │   Proxies   │ │   System    │ │      Storage        │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SYSTEMS                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   OpenRouter    │ │      Ollama     │ │    IndexedDB    │   │
│  │   (Cloud AI)    │ │   (Local AI)    │ │   (Local DB)    │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Main Process Architecture

**Purpose**: System-level operations, security, and external service integration.

```
Main Process (main.js)
├── Window Management
│   ├── Main Window Creation
│   ├── Database Viewer Window
│   └── Modal Window Management
├── IPC Handler Registration
│   ├── AI Service Handlers
│   ├── Configuration Handlers
│   └── Utility Handlers
├── Security Management
│   ├── Context Isolation
│   ├── Node Integration Disabled
│   └── Preload Script Loading
└── External Service Integration
    ├── AI Provider Communication
    ├── File System Access
    └── Configuration Persistence
```

### 2. Renderer Process Architecture

**Purpose**: Application logic, UI management, and data orchestration.

```
Renderer Process (renderer.js)
├── Initialization Layer
│   ├── Database Initialization
│   ├── AI Service Initialization
│   └── Component Initialization
├── Event Management Layer
│   ├── DOM Event Handlers
│   ├── Custom Event Dispatcher
│   └── IPC Communication
├── State Management Layer
│   ├── Application State
│   ├── UI State
│   └── Data Synchronization
└── UI Coordination Layer
    ├── Component Orchestration
    ├── Modal Management
    └── Theme Management
```

### 3. Business Logic Architecture

Each major feature is organized as a self-contained module:

#### Tag Management Module
```
src/tags/
├── index.js (Public API)
├── SimpleTagManager.js (Core operations)
├── TagOnlyManager.js (State isolation)
├── Commands/
│   ├── TagCommandInterface.js (Base interface)
│   ├── CreateTagCommand.js
│   ├── RenameTagCommand.js
│   └── DeleteTagCommand.js
└── Tests/
    └── *.test.js
```

#### Version Control Module
```
src/version/
├── VersionService.js (Main service)
├── SimpleVersionManager.js (Operations)
├── VersionStateManager.js (State tracking)
├── handlers/ (Chain of Responsibility)
│   ├── BaseHandler.js
│   ├── ValidationHandler.js
│   ├── DependencyHandler.js
│   └── DeletionHandler.js
└── tests/
    └── *.test.js
```

#### AI Integration Module
```
src/ai/
├── AIService.js (Main service)
├── ConfigManager.js (Configuration)
├── providers/ (Strategy pattern)
│   ├── BaseProvider.js
│   ├── OpenRouterProvider.js
│   └── OllamaProvider.js
└── decorators/ (Response processing)
    ├── index.js
    ├── ValidationDecorator.js
    ├── SanitizationDecorator.js
    └── FormattingDecorator.js
```

## Data Flow Architecture

### 1. Prompt Management Flow

```
User Action (Create/Edit Prompt)
         │
         ▼
UI Form Validation
         │
         ▼
Event Handler (renderer.js)
         │
         ▼
Business Logic (PromptManager)
         │
         ▼
Database Transaction (Dexie)
         │
         ▼
UI Update (Event Dispatcher)
         │
         ▼
Tag Tree Refresh
         │
         ▼
Version History Update
```

### 2. AI Integration Flow

```
User Request (Generate/Optimize)
         │
         ▼
UI Modal (AI Configuration)
         │
         ▼
IPC Call (renderer → main)
         │
         ▼
AI Service (main process)
         │
         ▼
Provider Selection (Strategy)
         │
         ▼
External API Call
         │
         ▼
Response Processing (Decorators)
         │
         ▼
IPC Response (main → renderer)
         │
         ▼
UI Update (Result Display)
```

### 3. Tag Management Flow

```
User Action (Create/Edit/Delete Tag)
         │
         ▼
Tag Command Creation
         │
         ▼
Command Execution
         │
         ├─ Create: Find or Create Hierarchy
         ├─ Rename: Cascade to Children
         └─ Delete: Validate Dependencies
         │
         ▼
Database Updates (Transaction)
         │
         ▼
Event Emission
         │
         ▼
UI Refresh (Tag Tree + Counts)
```

## Security Architecture

### 1. Process Isolation

```
Main Process (Privileged)
├── File System Access
├── Network Access
├── AI Service Configuration
└── IPC Handler Management

Renderer Process (Sandboxed)
├── No Node Integration
├── Context Isolation Enabled
├── Preload Script Only
└── Limited API Access
```

### 2. IPC Security

```javascript
// Preload script (secure bridge)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Only expose necessary APIs
  ai: {
    initialize: () => ipcRenderer.invoke('ai-initialize'),
    // ... other safe AI methods
  },
  // No direct access to file system or shell
});
```

### 3. Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
  style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
  connect-src 'self' https://openrouter.ai http://localhost:*;
">
```

## Performance Architecture

### 1. Database Optimization

```javascript
// Indexed queries for performance
db.version(4).stores({
  prompts: '++id,isLatest,parentId,version,title',
  tags: '++id,name,fullPath,parentId,level',
  promptTags: '++id,promptId,tagId'
});

// Optimized query patterns
const latestPrompts = await db.prompts
  .where('isLatest').equals(1)
  .orderBy('createdAt')
  .limit(50)
  .toArray();
```

### 2. UI Optimization

```javascript
// Debounced search for performance
const debouncedSearch = debounce(async (searchTerm) => {
  const results = await searchPrompts(searchTerm);
  displayResults(results);
}, 300);

// Virtual scrolling for large lists
function renderVisibleItems(startIndex, endIndex) {
  const visibleItems = allItems.slice(startIndex, endIndex);
  updateDOM(visibleItems);
}
```

### 3. Memory Management

```javascript
// Cleanup event listeners
function cleanup() {
  eventDispatcher.removeAllListeners();
  if (db) {
    db.close();
  }
}

window.addEventListener('beforeunload', cleanup);
```

## Scalability Architecture

### 1. Modular Design

Each major feature is designed as an independent module that can be:
- **Extended**: Add new functionality without affecting others
- **Replaced**: Swap implementations without breaking dependencies
- **Tested**: Unit test in isolation
- **Maintained**: Update independently

### 2. Plugin Architecture

The AI provider system demonstrates plugin architecture:

```javascript
// Easy to add new providers
class CustomAIProvider extends BaseProvider {
  async generateText(prompt, options) {
    // Custom implementation
  }
}

// Register in AIService
aiService.registerProvider('custom', new CustomAIProvider(config));
```

### 3. Configuration-Driven

Most behavior is controlled through configuration:

```javascript
// Easy to modify without code changes
const config = {
  ai: {
    providers: {
      // Add new providers here
    },
    generation: {
      // Modify generation behavior
    }
  },
  ui: {
    // Control UI behavior
  }
};
```

## Error Handling Architecture

### 1. Layered Error Handling

```
UI Layer → Business Logic → Service Layer → Data Layer
    ↓           ↓              ↓             ↓
User-friendly  Validation    Service       Database
Messages       Errors        Errors        Errors
    ↓           ↓              ↓             ↓
Modal/Toast → Console Log → IPC Error → Exception Log
```

### 2. Error Recovery

```javascript
// Graceful degradation
async function initializeAIService() {
  try {
    await aiService.initialize();
  } catch (error) {
    console.warn('AI service unavailable, continuing without AI features');
    // Application continues without AI functionality
  }
}

// Retry mechanisms
async function robustOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

This architecture provides a solid foundation for a maintainable, scalable, and secure desktop application that can evolve with changing requirements while maintaining reliability and performance.