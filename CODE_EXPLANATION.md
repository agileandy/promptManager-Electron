# AI Prompt Manager - Comprehensive Code Explanation

## Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Database Design](#database-design)
5. [Key Systems](#key-systems)
6. [Design Patterns](#design-patterns)
7. [Development Setup](#development-setup)
8. [Code Organization](#code-organization)

## Application Overview

The AI Prompt Manager is a sophisticated desktop application built with Electron that provides comprehensive management of AI prompts with advanced features including:

- **Hierarchical tag management** with full path support
- **Version control system** for prompt history and dependency tracking
- **AI integration** with multiple providers (OpenRouter, Ollama)
- **Advanced UI** with dark/light theme support
- **Database viewer** for debugging and data inspection
- **Export/Import** functionality for prompt backup and sharing

### Key Technologies
- **Electron**: Cross-platform desktop framework
- **Dexie.js**: IndexedDB wrapper for client-side data storage
- **Tailwind CSS**: Utility-first CSS framework for responsive UI
- **Node.js**: Backend runtime for AI service integration

## Architecture

The application follows a **multi-layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │   Window Mgmt   │  │        IPC Handlers          │  │
│  │                 │  │  (AI, Config, Database)      │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  Electron Renderer Process              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │      UI      │ │   Database   │ │   AI Service    │  │
│  │  Components  │ │   Manager    │ │   Integration   │  │
│  └──────────────┘ └──────────────┘ └─────────────────┘  │
│                              │                          │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │     Tag      │ │   Version    │ │    Prompt       │  │
│  │  Management  │ │   Control    │ │   Management    │  │
│  └──────────────┘ └──────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     IndexedDB Storage                   │
│     (Dexie.js with prompts, tags, folders tables)      │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Main Process (`main.js`)

**Purpose**: Electron's main process that manages application lifecycle, windows, and IPC communication.

**Key Responsibilities**:
- Window creation and management
- IPC handler registration for AI services
- Database viewer functionality
- Application menu and system integration

**Key Code Patterns**:
```javascript
// Window Creation
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false  // Security best practice
    }
  });
}

// IPC Handler Pattern
ipcMain.handle('ai-initialize', async () => {
  try {
    const { aiService } = require('./src/ai/AIService.js');
    await aiService.initialize(aiConfig);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 2. Renderer Process (`renderer.js`)

**Purpose**: Main application logic running in the renderer process, handling UI interactions and data management.

**Key Responsibilities**:
- Database initialization and management
- UI event handling and DOM manipulation
- AI service integration
- Tag and prompt management coordination

**Architecture Pattern**:
```javascript
// Database Initialization
async function initializeDatabase() {
  db = new Dexie('AIPromptManagerDB');
  db.version(4).stores({
    prompts: '++id,isLatest,parentId,version,title,text,description',
    tags: '++id,name,fullPath,parentId,level',
    promptTags: '++id,promptId,tagId'
  });
}

// Service Integration Pattern
async function initializeAIService() {
  const result = await window.electronAPI.ai.initialize();
  if (result.success) {
    aiService = {
      generateDescription: (desc, provider) =>
        window.electronAPI.ai.generateDescription(desc, provider)
    };
  }
}
```

### 3. Preload Script (`preload.js`)

**Purpose**: Secure bridge between main and renderer processes, exposing limited APIs.

**Security Pattern**:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ai: {
    initialize: () => ipcRenderer.invoke('ai-initialize'),
    generateDescription: (desc, provider) =>
      ipcRenderer.invoke('ai-generate-description', desc, provider)
  }
});
```

### 4. UI Components

#### ReadOnlyViewerModal

**Purpose**: Provides a read-only view of prompt content with syntax highlighting and copy functionality.

**Location**: `src/app/html-partials/ReadOnlyViewerModal.html`

**Key Features**:
- **Syntax Highlighting**: Uses Prism.js for code syntax highlighting
- **Copy to Clipboard**: Button to copy prompt text to clipboard
- **Responsive Design**: Works on different screen sizes
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Dark/Light Theme Support**: Adapts to user's theme preference

**HTML Structure**:
```html
<div id="readOnlyModal" class="modal hidden">
  <div class="modal-content bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-90vh overflow-hidden">
    <div class="modal-header bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Prompt Details</h3>
      <button onclick="closeReadOnlyModal()" class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="modal-body p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
        <p id="readOnlyTitle" class="text-gray-900 dark:text-white"></p>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <p id="readOnlyDescription" class="text-gray-900 dark:text-white"></p>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
        <div id="readOnlyTags" class="flex flex-wrap gap-2"></div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt Content</label>
        <div class="relative">
          <button onclick="copyToClipboard()" class="absolute right-2 top-2 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-md text-sm z-10">
            Copy
          </button>
          <pre class="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto mt-2">
            <code id="readOnlyContent" class="language-javascript text-sm"></code>
          </pre>
        </div>
      </div>
    </div>
  </div>
</div>
```

**JavaScript Integration**:
```javascript
// Show modal with prompt data
function showReadOnlyModal(promptData) {
  document.getElementById('readOnlyTitle').textContent = promptData.title;
  document.getElementById('readOnlyDescription').textContent = promptData.description;

  // Clear and populate tags
  const tagsContainer = document.getElementById('readOnlyTags');
  tagsContainer.innerHTML = '';
  promptData.tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    tagElement.textContent = tag.name;
    tagsContainer.appendChild(tagElement);
  });

  // Set content and highlight syntax
  const contentElement = document.getElementById('readOnlyContent');
  contentElement.textContent = promptData.text;
  Prism.highlightElement(contentElement);

  // Show modal
  document.getElementById('readOnlyModal').classList.remove('hidden');
}

// Close modal
function closeReadOnlyModal() {
  document.getElementById('readOnlyModal').classList.add('hidden');
}

// Copy to clipboard
function copyToClipboard() {
  const content = document.getElementById('readOnlyContent').textContent;
  navigator.clipboard.writeText(content).then(() => {
    // Show success feedback
    const button = document.querySelector('#readOnlyModal button');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  });
}
```

**CSS Styling**:
- Uses Tailwind CSS for responsive design
- Dark mode support with `dark:` prefix classes
- Responsive layout that works on mobile and desktop
- Smooth transitions and hover effects
- Proper spacing and typography

**Usage**:
The ReadOnlyViewerModal is used throughout the application to display prompt details in a consistent, user-friendly way. It's triggered when users click on a prompt in the list or use keyboard shortcuts to view details.

## Database Design

The application uses **IndexedDB** via Dexie.js with a well-structured schema:

### Schema Design
```javascript
db.version(4).stores({
  // Core prompt storage with versioning support
  prompts: '++id,isLatest,parentId,version,title,text,description,folderId,createdAt,lastUsedAt,timesUsed',

  // Hierarchical tag system with full path indexing
  tags: '++id,name,fullPath,parentId,level',

  // Many-to-many relationship between prompts and tags
  promptTags: '++id,promptId,tagId'
});
```

**Note**: The `folders` table exists in the schema for legacy compatibility but is not actively used. Organization is handled through the hierarchical tag system using the `/` separator (e.g., `development/frontend/react`).

### Data Relationships
```
┌─────────────┐    1:M    ┌─────────────┐    M:M    ┌─────────────┐
│   Prompts   │◄─────────►│ PromptTags  │◄─────────►│    Tags     │
│             │           │             │           │             │
│ id (PK)     │           │ promptId    │           │ id (PK)     │
│ parentId    │           │ tagId       │           │ name        │
│ version     │           └─────────────┘           │ fullPath    │
│ isLatest    │                                     │ parentId    │
│ title       │           ┌─────────────┐           │ level       │
│ text        │    1:M    │   Folders   │           └─────────────┘
│ description │◄─────────►│             │
│ folderId    │           │ id (PK)     │
│ createdAt   │           │ name        │
│ timesUsed   │           │ parentId    │
└─────────────┘           └─────────────┘
```

### Indexing Strategy
- **Primary Keys**: Auto-incremented IDs for all entities
- **Version Queries**: Indexed on `isLatest` and `parentId` for efficient version lookups
- **Tag Hierarchy**: Indexed on `fullPath`, `parentId`, and `level` for tree operations
- **Performance**: Strategic indexing on frequently queried fields

## Key Systems

### 1. AI Integration System

**Architecture**: Plugin-based provider system with decorator pattern for response processing.

#### AI Service (`src/ai/AIService.js`)
```javascript
class AIService {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  async initialize(config) {
    // Register providers based on configuration
    if (config.providers.openrouter?.enabled) {
      this.providers.set('openrouter', new OpenRouterProvider(config.providers.openrouter));
    }
    if (config.providers.ollama?.enabled) {
      this.providers.set('ollama', new OllamaProvider(config.providers.ollama));
    }
  }

  async generateDescription(description, providerName) {
    const provider = this.providers.get(providerName || this.defaultProvider);
    const response = await provider.generateText(description);
    return decoratorChainManager.process(response);
  }
}
```

#### Provider Pattern
Each AI provider implements a common interface:

```javascript
class BaseProvider {
  async generateText(prompt, options = {}) {
    throw new Error('Must be implemented by subclass');
  }

  async testConnection() {
    throw new Error('Must be implemented by subclass');
  }

  async getAvailableModels() {
    throw new Error('Must be implemented by subclass');
  }
}
```

#### Response Processing (Decorator Pattern)
```javascript
// Response processing pipeline
const { decoratorChainManager } = require('./src/ai/decorators/index.js');

// Add custom decorator
class CustomResponseDecorator extends BaseDecorator {
  async process(response) {
    // Add custom processing logic
    response.processedBy = response.processedBy || [];
    response.processedBy.push('custom-decorator');
    return response;
  }
}

// Register decorator
decoratorChainManager.addDecorator(new CustomResponseDecorator());

// Process AI response through the chain
const processedResponse = await decoratorChainManager.process(rawResponse);
```

### 2. Tag Management System

**Architecture**: Hierarchical tag system with command pattern for operations.

#### Tag Structure
```javascript
// Hierarchical tag representation
{
  id: 1,
  name: "react",
  fullPath: "development/frontend/react",
  parentId: 2,  // Points to "frontend" tag
  level: 2      // Depth in hierarchy (0-based)
}
```

#### Command Pattern Implementation
```javascript
// Base command interface
class TagCommandInterface {
  /**
   * Execute the tag command with proper state isolation
   * @param {Object} context - Execution context containing state and dependencies
   * @returns {Promise<TagOperationResult>} Result of the tag operation
   */
  async executeWithContext(context) {
    throw new Error('executeWithContext must be implemented by concrete command classes');
  }

  /**
   * Validate the command parameters before execution
   * @param {Object} params - Command-specific parameters
   * @returns {ValidationResult} Validation result with success/failure and messages
   */
  validate(params) {
    throw new Error('validate must be implemented by concrete command classes');
  }

  /**
   * Get the command type identifier
   * @returns {string} Command type for logging and event tracking
   */
  getCommandType() {
    throw new Error('getCommandType must be implemented by concrete command classes');
  }

  /**
   * Check if the command can be undone
   * @returns {boolean} True if command supports undo operations
   */
  isUndoable() {
    return false;
  }

  /**
   * Create undo command if supported
   * @param {TagOperationResult} executionResult - Result from the original execution
   * @returns {TagCommandInterface|null} Undo command or null if not supported
   */
  createUndoCommand(executionResult) {
    return null;
  }
}

// Concrete command implementations
class CreateTagCommand extends TagCommandInterface {
  /**
   * Initialize the create tag command
   * @param {Object} params - Command parameters
   * @param {string} params.tagName - Name of the tag to create
   * @param {string} params.tagColor - Color for the tag (optional)
   * @param {string} params.description - Tag description (optional)
   * @param {Array<string>} params.promptIds - Initial prompt IDs to associate (optional)
   */
  constructor(params) {
    super();
    this.params = {
      tagName: params.tagName,
      tagColor: params.tagColor || '#007bff',
      description: params.description || '',
      promptIds: params.promptIds || []
    };
  }

  /**
   * Execute the create tag command with state isolation
   * @param {Object} context - Execution context
   * @returns {Promise<TagOperationResult>}
   */
  async executeWithContext(context) {
    try {
      // Validate parameters before execution
      const validation = this.validate(this.params);
      if (!validation.isValid) {
        return TagOperationResult.failure(
          new TagOperationError(
            `Validation failed: ${validation.messages.join(', ')}`,
            'VALIDATION_ERROR'
          )
        );
      }

      const { tagStateManager, eventPublisher, transactionManager } = context;

      // Check if tag already exists
      const existingTag = await tagStateManager.findTagByName(this.params.tagName);
      if (existingTag) {
        return TagOperationResult.failure(
          new TagOperationError(
            `Tag '${this.params.tagName}' already exists`,
            'TAG_ALREADY_EXISTS'
          )
        );
      }

      // Execute within isolated transaction
      const result = await transactionManager.executeTransaction(async (transaction) => {
        // Create the tag entity
        const tagId = await this._generateTagId();
        const tagEntity = {
          id: tagId,
          name: this.params.tagName,
          color: this.params.tagColor,
          description: this.params.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          promptCount: this.params.promptIds.length
        };

        // Persist tag in isolated state
        await tagStateManager.createTag(tagEntity, transaction);

        // Create tag-prompt relationships if specified
        if (this.params.promptIds.length > 0) {
          await tagStateManager.associatePromptsWithTag(
            tagId,
            this.params.promptIds,
            transaction
          );
        }

        return tagEntity;
      });

      // Publish events for UI synchronization (outside transaction)
      await eventPublisher.publishTagCreated({
        tagId: result.id,
        tagName: result.name,
        promptIds: this.params.promptIds,
        timestamp: result.createdAt
      });

      return TagOperationResult.success(result, {
        commandType: this.getCommandType(),
        affectedPrompts: this.params.promptIds.length
      });

    } catch (error) {
      return TagOperationResult.failure(
        new TagOperationError(
          `Failed to create tag: ${error.message}`,
          'CREATE_TAG_ERROR',
          { originalError: error }
        )
      );
    }
  }

  /**
   * Validate create tag parameters
   * @param {Object} params - Parameters to validate
   * @returns {ValidationResult}
   */
  validate(params) {
    const errors = [];

    // Validate tag name
    if (!params.tagName || typeof params.tagName !== 'string') {
      errors.push('Tag name is required and must be a string');
    } else if (params.tagName.trim().length === 0) {
      errors.push('Tag name cannot be empty');
    } else if (params.tagName.length > 50) {
      errors.push('Tag name cannot exceed 50 characters');
    } else if (!/^[a-zA-Z0-9\s\-_/]+$/.test(params.tagName)) {
      errors.push('Tag name can only contain letters, numbers, spaces, hyphens, underscores, and forward slashes');
    } else if (params.tagName.includes('//')) {
      errors.push('Tag name cannot contain consecutive forward slashes');
    } else if (params.tagName.startsWith('/') || params.tagName.endsWith('/')) {
      errors.push('Tag name cannot start or end with forward slash');
    }

    // Validate tag color
    if (params.tagColor && !/^#[0-9A-Fa-f]{6}$/.test(params.tagColor)) {
      errors.push('Tag color must be a valid hex color code (e.g., #007bff)');
    }

    // Validate description
    if (params.description && params.description.length > 200) {
      errors.push('Tag description cannot exceed 200 characters');
    }

    // Validate prompt IDs
    if (params.promptIds && !Array.isArray(params.promptIds)) {
      errors.push('Prompt IDs must be an array');
    } else if (params.promptIds) {
      const invalidIds = params.promptIds.filter(id => typeof id !== 'string' || id.trim().length === 0);
      if (invalidIds.length > 0) {
        errors.push('All prompt IDs must be non-empty strings');
      }
    }

    return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
  }

  /**
   * Get command type identifier
   * @returns {string}
   */
  getCommandType() {
    return 'CREATE_TAG';
  }

  /**
   * Check if command supports undo
   * @returns {boolean}
   */
  isUndoable() {
    return true;
  }

  /**
   * Create undo command (DeleteTagCommand)
   * @param {TagOperationResult} executionResult - Result from create operation
   * @returns {TagCommandInterface}
   */
  createUndoCommand(executionResult) {
    if (!executionResult.success || !executionResult.data) {
      return null;
    }

    const DeleteTagCommand = require('./DeleteTagCommand');
    return new DeleteTagCommand({
      tagId: executionResult.data.id,
      tagName: executionResult.data.name
    });
  }

  /**
   * Generate unique tag ID
   * @private
   * @returns {Promise<string>}
   */
  async _generateTagId() {
    // Generate timestamp-based ID with random suffix for uniqueness
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `tag_${timestamp}_${random}`;
  }
}
```

#### Tag Tree Operations
```javascript
class SimpleTagManager {
  async getTagTree() {
    const tags = await this.db.tags.orderBy('fullPath').toArray();
    return this.buildHierarchy(tags);
  }

  buildHierarchy(tags) {
    const tagMap = new Map();
    const rootTags = [];

    // Build tag lookup map
    tags.forEach(tag => tagMap.set(tag.id, {...tag, children: []}));

    // Build hierarchy
    tags.forEach(tag => {
      if (tag.parentId) {
        const parent = tagMap.get(tag.parentId);
        parent?.children.push(tagMap.get(tag.id));
      } else {
        rootTags.push(tagMap.get(tag.id));
      }
    });

    return rootTags;
  }
}
```

### 3. Version Control System

**Architecture**: Chain of Responsibility pattern for version management operations.

#### Version Management Chain
```javascript
class VersionService {
  constructor(database, stateManager) {
    this.db = database;
    this.stateManager = stateManager;
    this.deletionChain = null;
    this.initializeDeletionChain();
  }

  /**
   * Initialize the Chain of Responsibility for version deletion
   */
  initializeDeletionChain() {
    // Create handler instances
    const validationHandler = new ValidationHandler(this.db, this.stateManager);
    const dependencyHandler = new DependencyHandler(this.db, this.stateManager);
    const deletionHandler = new DeletionHandler(this.db, this.stateManager);

    // Set up the chain
    validationHandler.setNext(dependencyHandler);
    dependencyHandler.setNext(deletionHandler);

    this.deletionChain = validationHandler;
  }

  /**
   * Delete a version using the Chain of Responsibility pattern
   * @param {number} promptId - The ID of the prompt/version to delete
   * @param {Object} options - Additional options for deletion
   * @returns {Promise<Object>} Result object with success status and details
   */
  async deleteVersion(promptId, options = {}) {
    try {
      console.log(`Starting version deletion process for prompt ID: ${promptId}`);

      // Create deletion context
      const context = {
        promptId,
        options,
        prompt: null,
        parentId: null,
        allVersions: [],
        dependencies: [],
        validationResults: {},
        timestamp: new Date()
      };

      // Execute the chain
      const result = await this.deletionChain.handle(context);

      if (result.success) {
        console.log(`Version deletion completed successfully for prompt ID: ${promptId}`);

        // Notify state manager of successful deletion
        await this.stateManager.notifyVersionDeleted(context);
      } else {
        console.warn(`Version deletion failed for prompt ID: ${promptId}`, result.error);
      }

      return result;
    } catch (error) {
      console.error('Version deletion process failed:', error);
      return {
        success: false,
        error: error.message,
        stage: 'service_level'
      };
    }
  }

  /**
   * Get version information without deletion
   * @param {number} promptId - The ID of the prompt/version
   * @returns {Promise<Object>} Version information
   */
  async getVersionInfo(promptId) {
    try {
      const prompt = await this.db.prompts.get(promptId);
      if (!prompt) {
        return { success: false, error: 'Prompt not found' };
      }

      const parentId = prompt.parentId || promptId;
      const allVersions = await this.db.prompts
        .where('parentId').equals(parentId)
        .or('id').equals(parentId)
        .toArray();

      return {
        success: true,
        prompt,
        parentId,
        allVersions,
        totalVersions: allVersions.length,
        isLatestVersion: prompt.isLatest === 1
      };
    } catch (error) {
      console.error('Failed to get version info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all dependencies for a version
   * @param {number} promptId - The ID of the prompt/version
   * @returns {Promise<Object>} Dependencies information
   */
  async getVersionDependencies(promptId) {
    try {
      const dependencyHandler = new DependencyHandler(this.db, this.stateManager);

      const context = { promptId };
      const dependencies = await dependencyHandler.checkDependencies(context);

      return {
        success: true,
        dependencies
      };
    } catch (error) {
      console.error('Failed to get version dependencies:', error);
      return { success: false, error: error.message };
    }
  }
}
```

#### Handler Implementation
```javascript
class ValidationHandler extends BaseHandler {
  async handle(context) {
    console.log(`Validating deletion for prompt ${context.promptId}`);

    // Perform validation logic
    const prompt = await this.db.prompts.get(context.promptId);
    if (!prompt) {
      return { success: false, error: 'Prompt not found' };
    }

    // Pass to next handler
    return await this.next?.handle(context) || context;
  }
}
```

### 4. Configuration Management

**Architecture**: Centralized configuration with file-based persistence.

```javascript
class ConfigManager {
  async initialize(dataDir) {
    this.configPath = path.join(dataDir, 'config.json');
    this.config = await this.loadConfig();
  }

  async getAIConfig() {
    return this.config.ai || this.getDefaultAIConfig();
  }

  getDefaultAIConfig() {
    return {
      defaultProvider: 'openrouter',
      providers: {
        openrouter: {
          enabled: true,
          name: "OpenRouter",
          endpoint: "https://openrouter.ai/api/v1/chat/completions",
          model: 'anthropic/claude-3.5-sonnet',
          timeout: 30000,
          maxRetries: 3
        },
        ollama: {
          enabled: true,
          name: "Ollama",
          endpoint: "http://localhost:11434/api/chat",
          model: 'llama2',
          timeout: 30000,
          maxRetries: 3
        }
      },
      generation: {
        systemPrompt: 'You are an AI assistant that helps generate high-quality prompts...',
        maxTokens: 2000,
        temperature: 0.7
      }
    };
  }
}
```

## Design Patterns

### 1. Chain of Responsibility (Version Management)
**Purpose**: Handle complex version deletion operations through a series of handlers.

**Benefits**:
- **Separation of Concerns**: Each handler has a single responsibility
- **Flexibility**: Easy to add/remove/reorder handlers
- **Testability**: Each handler can be tested independently

### 2. Command Pattern (Tag Operations)
**Purpose**: Encapsulate tag operations as objects for better organization and potential undo functionality.

**Benefits**:
- **Encapsulation**: Operations are self-contained
- **Extensibility**: Easy to add new tag operations
- **Consistency**: Uniform interface for all operations

### 3. Strategy Pattern (AI Providers)
**Purpose**: Allow runtime selection of AI providers with different implementation strategies.

**Benefits**:
- **Flexibility**: Easy to switch between providers
- **Extensibility**: Simple to add new providers
- **Maintainability**: Provider-specific logic is isolated

### 4. Decorator Pattern (Response Processing)
**Purpose**: Process AI responses through a pipeline of transformations.

**Benefits**:
- **Modularity**: Each decorator has a single transformation responsibility
- **Composability**: Decorators can be combined in different ways
- **Reusability**: Decorators can be used across different AI operations

### 5. Observer Pattern (UI Updates)
**Purpose**: Automatically update UI components when data changes.

**Implementation**:
```javascript
// Event-driven UI updates
async function updateTagTree() {
  const tags = await tagOnlyManager.getTagTree();
  renderTagTree(tags);
  updateTagCounts();
}

// Prompt operations trigger UI updates
async function savePrompt(promptData) {
  await db.prompts.add(promptData);
  await updatePromptList();
  await updateTagTree();
}
```

## Code Organization

### Directory Structure
```
src/app/
├── main.js                 # Electron main process entry point
├── preload.js             # Secure IPC bridge
├── index.html             # Main application UI
├── db_viewer_template.html # Database inspection tool
├── postcss.config.js      # CSS processing configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── assets/                # Static assets (icons, images)
├── html-partials/         # Reusable HTML components
├── dist/                  # Built CSS output
└── src/                   # Application source code
    ├── renderer.js        # Main renderer process logic
    ├── ai/                # AI integration system
    │   ├── AIService.js   # Core AI service manager
    │   ├── ConfigManager.js # Configuration management
    │   ├── providers/     # AI provider implementations
    │   │   ├── OpenRouterProvider.js
    │   │   ├── OllamaProvider.js
    │   │   └── BaseProvider.js
    │   └── decorators/    # Response processing pipeline
    │       ├── index.js
    │       ├── ValidationDecorator.js
    │       ├── SanitizationDecorator.js
    │       └── FormattingDecorator.js
    ├── tags/              # Tag management system
    │   ├── index.js       # Main tag module exports
    │   ├── SimpleTagManager.js # Core tag operations
    │   ├── TagOnlyManager.js   # State-isolated tag operations
    │   ├── TagCommandInterface.js # Command pattern base
    │   ├── CreateTagCommand.js    # Tag creation command
    │   ├── RenameTagCommand.js    # Tag renaming command
    │   ├── DeleteTagCommand.js    # Tag deletion command
    │   └── *.test.js      # Unit tests for tag operations
    ├── version/           # Version control system
    │   ├── VersionService.js # Main version management service
    │   ├── SimpleVersionManager.js # Version operations
    │   ├── VersionStateManager.js  # Version state tracking
    │   ├── handlers/      # Chain of Responsibility handlers
    │   │   ├── BaseHandler.js
    │   │   ├── ValidationHandler.js
    │   │   ├── DependencyHandler.js
    │   │   └── DeletionHandler.js
    │   └── tests/         # Version system tests
    └── prompts/           # Prompt management system
        ├── PromptManager.js
        ├── PromptService.js
        └── PromptValidator.js
```

### Module Dependencies
```
renderer.js (Main coordinator)
    ├── ai/AIService.js
    │   ├── providers/OpenRouterProvider.js
    │   ├── providers/OllamaProvider.js
    │   ├── decorators/ValidationDecorator.js
    │   ├── decorators/SanitizationDecorator.js
    │   └── ConfigManager.js
    ├── tags/SimpleTagManager.js
    │   ├── CreateTagCommand.js
    │   ├── RenameTagCommand.js
    │   ├── DeleteTagCommand.js
    │   └── TagOnlyManager.js
    ├── version/VersionService.js
    │   ├── handlers/ValidationHandler.js
    │   ├── handlers/DependencyHandler.js
    │   ├── handlers/DeletionHandler.js
    │   ├── SimpleVersionManager.js
    │   └── VersionStateManager.js
    └── Database (Dexie.js)
```

### Coding Conventions

#### Error Handling Pattern
```javascript
async function safeOperation() {
  try {
    const result = await riskyOperation();
    console.log('Operation completed successfully');
    return { success: true, data: result };
  } catch (error) {
    console.error('Operation failed:', error);
    return { success: false, error: error.message };
  }
}
```

#### Logging Pattern
```javascript
// Consistent logging throughout the application
console.log(`[${componentName}] Operation started: ${operationName}`);
console.error(`[${componentName}] Error in ${operationName}:`, error);
console.warn(`[${componentName}] Warning: ${warningMessage}`);
```

#### Database Transaction Pattern
```javascript
async function complexDatabaseOperation() {
  const transaction = db.transaction('rw', db.prompts, db.tags, db.promptTags);

  try {
    await transaction.exec(async () => {
      // Multiple database operations
      const prompt = await db.prompts.add(promptData);
      const tag = await db.tags.add(tagData);
      await db.promptTags.add({ promptId: prompt.id, tagId: tag.id });
    });

    console.log('Transaction completed successfully');
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}
```

## Development Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Git

### Installation Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/agileandy/promptManager-Electron.git
   cd promptManager-Electron
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **Development mode** (with DevTools):
   ```bash
   npm run dev
   ```

### Development Workflow

#### 1. Making Changes
- Modify files in `src/app/src/` for application logic
- Update `src/app/index.html` for UI changes
- Modify `src/app/main.js` for main process changes

#### 2. Testing Changes
- Use `npm run dev` to run with DevTools open
- Test AI integration features with proper API keys
- Use the integrated Database Viewer (Help → View Database) for debugging

#### 3. Database Development
- Database files are stored in `~/.proman/` directory
- Use the Database Viewer to inspect data structure
- Clear database by deleting the directory if needed

#### 4. Adding New Features

**For AI Providers**:
1. Create new provider in `src/app/src/ai/providers/`
2. Implement `BaseProvider` interface
3. Register in `AIService.js`
4. Add configuration options in `ConfigManager.js`

**For Tag Operations**:
1. Create new command in `src/app/src/tags/`
2. Implement `TagCommandInterface`
3. Add to tag manager operations
4. Write unit tests

**For Version Operations**:
1. Create new handler in `src/app/src/version/handlers/`
2. Implement `BaseHandler` interface
3. Add to version service chain
4. Test with various scenarios

### Debugging Tips

#### 1. Enable DevTools
```javascript
// In main.js, uncomment this line during development
mainWindow.webContents.openDevTools();
```

#### 2. Database Inspection
- Use Help → View Database in the application
- Inspect all tables and relationships
- Monitor tag counts and prompt versions

#### 3. Console Logging
The application includes comprehensive logging:
```javascript
// Enable verbose logging
console.log('Debug info:', debugData);
console.error('Error details:', error);
```

#### 4. IPC Debugging
```javascript
// In renderer.js, log IPC communication
console.log('Sending IPC:', channel, data);
const result = await window.electronAPI.someMethod(data);
console.log('IPC result:', result);
```

This completes the comprehensive code explanation for the AI Prompt Manager Electron application. The documentation covers all major aspects of the codebase, from high-level architecture to specific implementation details and development workflows.