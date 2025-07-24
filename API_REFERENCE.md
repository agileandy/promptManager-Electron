# API Reference Guide

## Table of Contents
1. [Database API](#database-api)
2. [AI Service API](#ai-service-api)
3. [Tag Management API](#tag-management-api)
4. [Version Control API](#version-control-api)
5. [IPC Communication API](#ipc-communication-api)
6. [Configuration API](#configuration-api)

## Database API

### Database Schema

The application uses IndexedDB through Dexie.js with the following schema:

```javascript
// Database version 4 schema
db.version(4).stores({
  prompts: '++id,isLatest,parentId,version,title,text,description,folderId,createdAt,lastUsedAt,timesUsed',
  tags: '++id,name,fullPath,parentId,level',
  promptTags: '++id,promptId,tagId'
});
```

**Note**: The `folders` table exists in the schema for legacy compatibility but is not actively used. Organization is handled through the hierarchical tag system using the `/` separator (e.g., `development/frontend/react`).

### Core Database Operations

#### Prompt Operations
```javascript
// Create a new prompt
async function createPrompt(promptData) {
  const prompt = await db.prompts.add({
    title: promptData.title,
    description: promptData.description,
    text: promptData.text,
    version: 1,
    isLatest: true,
    parentId: null,
    folderId: promptData.folderId || null,
    createdAt: new Date(),
    lastUsedAt: null,
    timesUsed: 0
  });
  return prompt;
}

// Get all latest prompts
async function getLatestPrompts() {
  return await db.prompts
    .where('isLatest')
    .equals(1)
    .orderBy('createdAt')
    .reverse()
    .toArray();
}

// Update prompt usage statistics
async function incrementPromptUsage(promptId) {
  return await db.prompts.update(promptId, {
    lastUsedAt: new Date(),
    timesUsed: (await db.prompts.get(promptId)).timesUsed + 1
  });
}

// Search prompts by title and content
async function searchPrompts(searchTerm) {
  const term = searchTerm.toLowerCase();
  return await db.prompts
    .where('isLatest')
    .equals(1)
    .filter(prompt =>
      prompt.title.toLowerCase().includes(term) ||
      prompt.text.toLowerCase().includes(term)
    )
    .toArray();
}
```

#### Tag Operations
```javascript
// Get all tags in hierarchical order
async function getAllTags() {
  return await db.tags
    .orderBy('fullPath')
    .toArray();
}

// Get tag by full path
async function getTagByPath(fullPath) {
  return await db.tags
    .where('fullPath')
    .equals(fullPath)
    .first();
}

// Get child tags for a parent
async function getChildTags(parentId) {
  return await db.tags
    .where('parentId')
    .equals(parentId)
    .orderBy('name')
    .toArray();
}

// Get prompts by tag
async function getPromptsByTag(tagId) {
  const promptIds = await db.promptTags
    .where('tagId')
    .equals(tagId)
    .toArray();

  const prompts = await Promise.all(
    promptIds.map(pt => db.prompts.get(pt.promptId))
  );

  return prompts.filter(p => p && p.isLatest);
}
```

#### Relationship Operations
```javascript
// Add tag to prompt
async function addTagToPrompt(promptId, tagId) {
  return await db.promptTags.add({
    promptId: promptId,
    tagId: tagId
  });
}

// Remove tag from prompt
async function removeTagFromPrompt(promptId, tagId) {
  return await db.promptTags
    .where(['promptId', 'tagId'])
    .equals([promptId, tagId])
    .delete();
}

// Get all tags for a prompt
async function getPromptTags(promptId) {
  const tagRelations = await db.promptTags
    .where('promptId')
    .equals(promptId)
    .toArray();

  return await Promise.all(
    tagRelations.map(rel => db.tags.get(rel.tagId))
  );
}
```

## AI Service API

### Service Initialization
```javascript
// Initialize AI service
const result = await window.electronAPI.ai.initialize();
if (result.success) {
  console.log('Available providers:', result.providers);
} else {
  console.error('AI initialization failed:', result.error);
}
```

### Provider Management
```javascript
// Get available providers
const providers = await window.electronAPI.ai.getProviders();

// Get default provider
const defaultProvider = await window.electronAPI.ai.getDefaultProvider();

// Get models for a specific provider
const modelsResult = await window.electronAPI.ai.getProviderModels('openrouter');
if (modelsResult.success) {
  console.log('Available models:', modelsResult.models);
}

// Test provider connection
const testResult = await window.electronAPI.ai.testProvider('ollama', {
  endpoint: 'http://localhost:11434',
  model: 'llama2'
});
console.log('Connection test:', testResult);
```

### AI Generation Operations
```javascript
// Generate prompt from description
try {
  const result = await window.electronAPI.ai.generateDescription(
    "Create a prompt for code review",
    "openrouter"
  );
  console.log('Generated prompt:', result);
} catch (error) {
  console.error('Generation failed:', error);
}

// Optimize existing prompt
try {
  const optimized = await window.electronAPI.ai.optimizePrompt(
    "Review this code for bugs",
    "openrouter"
  );
  console.log('Optimized prompt:', optimized);
} catch (error) {
  console.error('Optimization failed:', error);
}
```

### Configuration Management
```javascript
// Get current AI configuration
const config = await window.electronAPI.ai.getConfig();
console.log('Current config:', config);

// Save AI configuration
const newConfig = {
  openrouter: {
    enabled: true,
    apiKey: 'your-api-key',
    model: 'anthropic/claude-3.5-sonnet',
    timeout: 30000,
    retries: 3
  },
  ollama: {
    enabled: true,
    endpoint: 'http://localhost:11434',
    model: 'llama2',
    timeout: 30000,
    retries: 3
  },
  defaultProvider: 'openrouter',
  systemPrompts: {
    generation: 'Custom generation prompt...',
    optimization: 'Custom optimization prompt...'
  },
  temperature: {
    generation: 0.7,
    optimization: 0.3
  }
};

const saveResult = await window.electronAPI.ai.saveConfig(newConfig);
if (saveResult.success) {
  console.log('Configuration saved successfully');
}
```

### Response Processing (Decorator Pattern)
```javascript
// Access decorator chain for response processing
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

## Tag Management API

### Tag Creation and Hierarchy
```javascript
// Create hierarchical tag using Command Pattern
const createTagCommand = new CreateTagCommand({
  tagName: 'development/frontend/react',
  tagColor: '#007bff',
  description: 'React.js development prompts',
  promptIds: [] // Optional initial prompt associations
});

// Execute with proper context
const context = {
  tagStateManager: new DatabaseTagStateManager(db),
  eventPublisher: new SimpleEventPublisher(),
  transactionManager: new DatabaseTransactionManager(db)
};

const result = await createTagCommand.executeWithContext(context);

if (result.success) {
  console.log('Tag created:', result.data);
} else {
  console.error('Tag creation failed:', result.error);
}

// Execute with proper context
const context = {
  tagStateManager: new DatabaseTagStateManager(db),
  eventPublisher: new SimpleEventPublisher(),
  transactionManager: new DatabaseTransactionManager(db)
};

const result = await createTagCommand.executeWithContext(context);

if (result.success) {
  console.log('Tag created:', result.data);
} else {
  console.error('Tag creation failed:', result.error);
}

// Alternative: Use tag manager directly for simpler operations
const tag = await tagOnlyManager.createOrGetTag('development/backend/nodejs');
console.log('Created tag:', tag);
```

### Tag Tree Operations
```javascript
// Get complete tag tree
const tagTree = await tagOnlyManager.getTagTree();

// Build hierarchical structure
function buildTagHierarchy(tags) {
  const tagMap = new Map();
  const rootTags = [];

  // Create tag lookup map
  tags.forEach(tag => {
    tagMap.set(tag.id, {
      ...tag,
      children: []
    });
  });

  // Build parent-child relationships
  tags.forEach(tag => {
    if (tag.parentId) {
      const parent = tagMap.get(tag.parentId);
      if (parent) {
        parent.children.push(tagMap.get(tag.id));
      }
    } else {
      rootTags.push(tagMap.get(tag.id));
    }
  });

  return rootTags;
}
```

### Tag Operations
```javascript
// Rename tag (cascades to children)
const renameCommand = new RenameTagCommand({
  tagId: tagId,
  newName: 'new-name',
  updateChildren: true
});

const renameResult = await renameCommand.executeWithContext(context);
if (renameResult.success) {
  console.log('Tag renamed successfully');
}

// Delete tag (with validation)
const deleteCommand = new DeleteTagCommand({
  tagId: tagId,
  forceDelete: false,
  cascadeToChildren: true
});

const deleteResult = await deleteCommand.executeWithContext(context);
if (deleteResult.success) {
  console.log('Tag deleted successfully');
} else {
  console.error('Delete failed:', deleteResult.error);
}

// Command validation example
const validation = createTagCommand.validate({
  tagName: 'invalid//name',
  tagColor: 'invalid-color'
});

if (!validation.isValid) {
  console.error('Validation errors:', validation.messages);
}

// Get tag usage statistics
async function getTagStats(tagId) {
  const promptCount = await db.promptTags
    .where('tagId')
    .equals(tagId)
    .count();

  const childTags = await db.tags
    .where('parentId')
    .equals(tagId)
    .toArray();

  const totalPrompts = await Promise.all(
    childTags.map(child =>
      db.promptTags.where('tagId').equals(child.id).count()
    )
  ).then(counts =>
    counts.reduce((sum, count) => sum + count, promptCount)
  );

  return {
    directPrompts: promptCount,
    totalPrompts: totalPrompts,
    childCount: childTags.length
  };
}
```

## Version Control API

### Version Management
```javascript
// Create new version of existing prompt
async function createPromptVersion(originalPromptId, changes) {
  const original = await db.prompts.get(originalPromptId);

  // Mark original as not latest
  await db.prompts.update(originalPromptId, { isLatest: false });

  // Create new version
  const newVersion = await db.prompts.add({
    ...original,
    ...changes,
    id: undefined, // Let Dexie assign new ID
    parentId: original.parentId || originalPromptId,
    version: original.version + 1,
    isLatest: true,
    createdAt: new Date()
  });

  return newVersion;
}

// Get version history for a prompt
async function getVersionHistory(promptId) {
  const prompt = await db.prompts.get(promptId);
  const parentId = prompt.parentId || promptId;

  return await db.prompts
    .where('parentId')
    .equals(parentId)
    .or('id')
    .equals(parentId)
    .orderBy('version')
    .toArray();
}

// Revert to specific version
async function revertToVersion(versionId) {
  const targetVersion = await db.prompts.get(versionId);
  const parentId = targetVersion.parentId || versionId;

  // Mark all versions as not latest
  await db.prompts
    .where('parentId')
    .equals(parentId)
    .modify({ isLatest: false });

  // Mark target version as latest
  await db.prompts.update(versionId, { isLatest: true });
}
```

### Version Deletion (Chain of Responsibility)
```javascript
// Delete version using the Chain of Responsibility pattern
const versionService = new VersionService(db, versionStateManager);
const result = await versionService.deleteVersion(promptId, {
  force: false,
  cascade: true,
  skipValidation: false
});

// Get version information
const versionInfo = await versionService.getVersionInfo(promptId);
if (versionInfo.success) {
  console.log('Version details:', versionInfo);
}

// Check dependencies before deletion
const dependencies = await versionService.getVersionDependencies(promptId);
if (dependencies.success) {
  console.log('Dependencies found:', dependencies.dependencies);
}

if (result.success) {
  console.log('Version deleted successfully');
  console.log('Deletion metadata:', result.metadata);
} else {
  console.error('Deletion failed:', result.error);
  console.log('Failure stage:', result.stage);
}

// Get version information
const versionInfo = await versionService.getVersionInfo(promptId);
if (versionInfo.success) {
  console.log('Version details:', versionInfo);
}

// Check dependencies before deletion
const dependencies = await versionService.getVersionDependencies(promptId);
if (dependencies.success) {
  console.log('Dependencies found:', dependencies.dependencies);
}
```

## IPC Communication API

### Main Process IPC Handlers

The main process handles various IPC channels for secure communication:

```javascript
// AI Service IPC handlers
ipcMain.handle('ai-initialize', async () => { /* ... */ });
ipcMain.handle('ai-get-providers', () => { /* ... */ });
ipcMain.handle('ai-generate-description', async (event, description, provider) => { /* ... */ });
ipcMain.handle('ai-optimize-prompt', async (event, promptText, provider) => { /* ... */ });
ipcMain.handle('ai-save-config', async (event, config) => { /* ... */ });
ipcMain.handle('ai-get-config', async () => { /* ... */ });
ipcMain.handle('ai-test-provider', async (event, providerName, config) => { /* ... */ });

// Database and utility handlers
ipcMain.handle('get-data-dir', () => app.getPath('userData'));
ipcMain.handle('open-database-viewer', () => { /* ... */ });
```

### Renderer Process IPC Usage

The renderer process communicates with main through the preload script:

```javascript
// Available through window.electronAPI
const electronAPI = {
  // Data directory access
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // Database viewer
  openDatabaseViewer: () => ipcRenderer.invoke('open-database-viewer'),

  // AI services
  ai: {
    initialize: () => ipcRenderer.invoke('ai-initialize'),
    getProviders: () => ipcRenderer.invoke('ai-get-providers'),
    getDefaultProvider: () => ipcRenderer.invoke('ai-get-default-provider'),
    getProviderModels: (provider) => ipcRenderer.invoke('ai-get-provider-models', provider),
    generateDescription: (desc, provider) => ipcRenderer.invoke('ai-generate-description', desc, provider),
    optimizePrompt: (text, provider) => ipcRenderer.invoke('ai-optimize-prompt', text, provider),
    saveConfig: (config) => ipcRenderer.invoke('ai-save-config', config),
    getConfig: () => ipcRenderer.invoke('ai-get-config'),
    testProvider: (name, config) => ipcRenderer.invoke('ai-test-provider', name, config),
    getOllamaModels: (endpoint) => ipcRenderer.invoke('ai-get-ollama-models', endpoint),
    getOpenRouterModels: (apiKey) => ipcRenderer.invoke('ai-get-openrouter-models', apiKey)
  }
};
```

## Configuration API

### Configuration Structure
```javascript
// Complete configuration object
const fullConfig = {
  ai: {
    defaultProvider: 'openrouter',
    providers: {
      openrouter: {
        enabled: true,
        name: "OpenRouter",
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        model: 'anthropic/claude-3.5-sonnet',
        apiKey: 'your-api-key',
        timeout: 30000,
        maxRetries: 3
      },
      ollama: {
        enabled: true,
        name: "Ollama",
        endpoint: "http://localhost:11434/api/chat",
        model: 'llama2',
        apiKey: null,
        timeout: 30000,
        maxRetries: 3
      }
    },
    generation: {
      systemPrompt: 'You are an AI assistant that helps generate high-quality prompts...',
      maxTokens: 2000,
      temperature: 0.7
    },
    optimization: {
      systemPrompt: 'You are an AI assistant that helps optimize and improve existing prompts...',
      maxTokens: 2000,
      temperature: 0.3
    }
  },
  ui: {
    theme: 'light', // 'light' or 'dark'
    sidebarWidth: 256,
    defaultView: 'all-prompts'
  },
  data: {
    backupEnabled: true,
    backupInterval: 24, // hours
    autoSave: true
  }
};
```

### Configuration Management
```javascript
class ConfigManager {
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.getDefaultConfig();
      }
      throw error;
    }
  }

  async saveConfig(config) {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  async getAIConfig() {
    const config = await this.loadConfig();
    return config.ai || this.getDefaultAIConfig();
  }

  async updateAIConfig(aiConfig) {
    const config = await this.loadConfig();
    config.ai = aiConfig;
    await this.saveConfig(config);
  }
}
```

## Event System

### Custom Event Handling
```javascript
// Event dispatcher for cross-component communication
class EventDispatcher {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

// Global event dispatcher instance
const eventDispatcher = new EventDispatcher();

// Usage examples
eventDispatcher.on('prompt-saved', (prompt) => {
  updatePromptList();
  updateTagTree();
});

eventDispatcher.on('tag-created', (tag) => {
  refreshTagTree();
});

eventDispatcher.emit('prompt-saved', newPrompt);
```

### UI Event Handling
```javascript
// Standard DOM event handling patterns
function initializeEventHandlers() {
  // Prompt form submission
  document.getElementById('prompt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const promptData = Object.fromEntries(formData);

    try {
      await savePrompt(promptData);
      eventDispatcher.emit('prompt-saved', promptData);
    } catch (error) {
      showError('Failed to save prompt: ' + error.message);
    }
  });

  // Tag tree interactions
  document.getElementById('tag-tree').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-item')) {
      const tagId = e.target.dataset.tagId;
      filterPromptsByTag(tagId);
    }
  });

  // Search functionality
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce(async (e) => {
    const searchTerm = e.target.value;
    const results = await searchPrompts(searchTerm);
    displaySearchResults(results);
  }, 300));
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

### UI Components API

#### ReadOnlyViewerModal
```javascript
// Show read-only modal with prompt data
function showReadOnlyModal(promptData) {
  // Set prompt title
  document.getElementById('viewer-prompt-title').textContent = promptData.title;

  // Set version badge
  document.getElementById('viewer-version-badge').textContent = `Version ${promptData.version}`;

  // Set description
  document.getElementById('viewer-prompt-description').textContent = promptData.description;

  // Set prompt text
  document.getElementById('viewer-prompt-text').textContent = promptData.text;

  // Clear and populate tags
  const tagsContainer = document.getElementById('viewer-prompt-tags');
  tagsContainer.innerHTML = '';
  promptData.tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    tagElement.textContent = tag.name;
    tagsContainer.appendChild(tagElement);
  });

  // Set metadata
  document.getElementById('viewer-created-at').textContent = new Date(promptData.createdAt).toLocaleString();
  document.getElementById('viewer-last-used').textContent = promptData.lastUsedAt ? new Date(promptData.lastUsedAt).toLocaleString() : 'Never';
  document.getElementById('viewer-times-used').textContent = promptData.timesUsed;
  document.getElementById('viewer-parent-id').textContent = promptData.parentId || 'None';

  // Show modal
  document.getElementById('read-only-viewer-modal').classList.remove('hidden');
}

// Close the read-only modal
function closeReadOnlyModal() {
  document.getElementById('read-only-viewer-modal').classList.add('hidden');
}

// Copy prompt text to clipboard
document.getElementById('viewer-copy-btn').addEventListener('click', async () => {
  const promptText = document.getElementById('viewer-prompt-text').textContent;
  await navigator.clipboard.writeText(promptText);

  // Update button text temporarily
  const button = document.getElementById('viewer-copy-btn');
  const originalText = button.textContent;
  button.textContent = 'Copied!';
  setTimeout(() => {
    button.textContent = originalText;
  }, 2000);
});

// Navigate between versions
document.getElementById('viewer-prev-version-btn').addEventListener('click', () => {
  // Logic to navigate to previous version
});

document.getElementById('viewer-next-version-btn').addEventListener('click', () => {
  // Logic to navigate to next version
});

// Close modal with close button
document.getElementById('viewer-close-btn').addEventListener('click', closeReadOnlyModal);

// Close modal with escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeReadOnlyModal();
  }
});
```

This API reference provides comprehensive documentation for all the major APIs and interfaces in the AI Prompt Manager application, making it easier for developers to understand and extend the codebase.