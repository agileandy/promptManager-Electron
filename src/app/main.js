const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use Electron's default userData directory (no custom path)
// This will automatically use: ~/Library/Application Support/promptmanager-electron

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'), // Updated to include icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Restore default Electron menu

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

// Database viewer function for IPC
ipcMain.handle('open-database-viewer', () => {
  const viewerWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'Database Viewer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  viewerWindow.loadFile(path.join(__dirname, 'db_viewer_template.html'));
});

// IPC handlers for data directory access
ipcMain.handle('get-data-dir', () => {
  return app.getPath('userData');
});

// AI Service variables
let aiService = null;
let aiConfig = null;

// Version Management Service variables
let versionService = null;
let versionStateManager = null;

// Register AI IPC handlers when app is ready
function registerAIHandlers() {
  console.log('Registering AI IPC handlers...');

  // Initialize AI service
  ipcMain.handle('ai-initialize', async () => {
    console.log('ai-initialize handler called');
    try {
      const { aiService: service } = require(path.resolve(__dirname, 'src/ai/AIService.js'));
      const { configManager } = require(path.resolve(__dirname, 'src/ai/ConfigManager.js'));

      // Initialize configuration manager
      const dataDir = app.getPath('userData');
      await configManager.initialize(dataDir);

      // Load AI configuration
      aiConfig = await configManager.getAIConfig();

      // Initialize AI service
      await service.initialize(aiConfig);
      aiService = service;

      console.log('AI Service initialized successfully');
      console.log('Available providers:', aiService.getAvailableProviders());
      return { success: true, providers: aiService.getAvailableProviders() };
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      return { success: false, error: error.message };
    }
  });

  // Get available AI providers
  ipcMain.handle('ai-get-providers', () => {
    console.log('ai-get-providers handler called');
    if (!aiService) {
      return [];
    }
    return aiService.getAvailableProviders();
  });

  // Get default AI provider
  ipcMain.handle('ai-get-default-provider', () => {
    console.log('ai-get-default-provider handler called');
    if (!aiService) {
      return null;
    }
    return aiService.getDefaultProvider();
  });

  // Get available models for a provider
  ipcMain.handle('ai-get-provider-models', async (event, providerName) => {
    console.log('ai-get-provider-models handler called for:', providerName);
    if (!aiService) {
      return { success: false, error: 'AI service not initialized', models: [] };
    }

    try {
      const models = await aiService.getAvailableModels(providerName);
      return { success: true, models };
    } catch (error) {
      console.error(`Failed to get models for ${providerName}:`, error);
      return { success: false, error: error.message, models: [] };
    }
  });

  // Generate prompt description
  ipcMain.handle('ai-generate-description', async (event, description, providerName) => {
    console.log('ai-generate-description handler called');
    if (!aiService) {
      throw new Error('AI service not initialized');
    }

    try {
      return await aiService.generateDescription(description, providerName);
    } catch (error) {
      console.error('AI generation failed:', error);
      throw error;
    }
  });

  // Optimize prompt
  ipcMain.handle('ai-optimize-prompt', async (event, promptText, providerName) => {
    console.log('ai-optimize-prompt handler called');
    if (!aiService) {
      throw new Error('AI service not initialized');
    }

    try {
      return await aiService.optimizePrompt(promptText, providerName);
    } catch (error) {
      console.error('AI optimization failed:', error);
      throw error;
    }
  });

  // Save AI configuration
  ipcMain.handle('ai-save-config', async (event, config) => {
    console.log('ai-save-config handler called');
    try {
      const { configManager } = require(path.resolve(__dirname, 'src/ai/ConfigManager.js'));

      // Convert the UI config format to the ConfigManager format
      const fullConfig = await configManager.loadConfig();
      fullConfig.ai = {
        defaultProvider: config.defaultProvider,
        providers: {
          openrouter: {
            enabled: config.openrouter.enabled, // Save the user's enabled preference regardless of API key
            name: "OpenRouter",
            endpoint: "https://openrouter.ai/api/v1/chat/completions",
            model: config.openrouter.model,
            apiKey: config.openrouter.apiKey,
            timeout: config.openrouter.timeout,
            maxRetries: config.openrouter.retries
          },
          ollama: {
            enabled: config.ollama.enabled, // Save the user's enabled preference regardless of endpoint
            name: "Ollama",
            endpoint: config.ollama.endpoint.endsWith('/api/chat') ? config.ollama.endpoint : config.ollama.endpoint + "/api/chat",
            model: config.ollama.model,
            apiKey: null,
            timeout: config.ollama.timeout,
            maxRetries: config.ollama.retries
          }
        },
        generation: {
          systemPrompt: config.systemPrompts.generation,
          maxTokens: 2000,
          temperature: config.temperature.generation
        },
        optimization: {
          systemPrompt: config.systemPrompts.optimization,
          maxTokens: 2000,
          temperature: config.temperature.optimization
        }
      };

      await configManager.saveConfig(fullConfig);

      // Reinitialize AI service with new config
      const { aiService: service } = require(path.resolve(__dirname, 'src/ai/AIService.js'));
      await service.initialize(fullConfig.ai);
      aiService = service;
      aiConfig = fullConfig.ai;

      console.log('AI configuration saved and service reinitialized');
      return { success: true, providers: aiService.getAvailableProviders() };
    } catch (error) {
      console.error('Failed to save AI configuration:', error);
      return { success: false, error: error.message };
    }
  });

  // Get current AI configuration
  ipcMain.handle('ai-get-config', async () => {
    console.log('ai-get-config handler called');
    try {
      const { configManager } = require(path.resolve(__dirname, 'src/ai/ConfigManager.js'));
      const aiConfig = await configManager.getAIConfig();

      // Convert ConfigManager format to UI format
      const uiConfig = {
        openrouter: {
          enabled: aiConfig.providers?.openrouter?.enabled !== false, // Default to true if not explicitly false
          apiKey: aiConfig.providers?.openrouter?.apiKey || '',
          model: aiConfig.providers?.openrouter?.model || 'anthropic/claude-3.5-sonnet',
          timeout: aiConfig.providers?.openrouter?.timeout || 30000,
          retries: aiConfig.providers?.openrouter?.maxRetries || 3
        },
        ollama: {
          enabled: aiConfig.providers?.ollama?.enabled !== false, // Default to true if not explicitly false
          endpoint: aiConfig.providers?.ollama?.endpoint?.replace('/api/chat', '') || 'http://localhost:11434',
          model: aiConfig.providers?.ollama?.model || 'llama2',
          timeout: aiConfig.providers?.ollama?.timeout || 30000,
          retries: aiConfig.providers?.ollama?.maxRetries || 3
        },
        defaultProvider: aiConfig.defaultProvider || 'openrouter',
        systemPrompts: {
          generation: aiConfig.generation?.systemPrompt || 'You are an AI assistant that helps generate high-quality prompts based on user descriptions.',
          optimization: aiConfig.optimization?.systemPrompt || 'You are an AI assistant that helps optimize and improve existing prompts for better clarity and effectiveness.'
        },
        temperature: {
          generation: aiConfig.generation?.temperature || 0.7,
          optimization: aiConfig.optimization?.temperature || 0.3
        }
      };

      return uiConfig;
    } catch (error) {
      console.error('Failed to get AI configuration:', error);
      return {};
    }
  });

  // Test AI provider connection
  ipcMain.handle('ai-test-provider', async (event, providerName, providerConfig) => {
    console.log('ai-test-provider handler called for:', providerName);
    console.log('Provider config:', providerConfig);
    try {
      // Create temporary provider instance for testing
      let provider;
      if (providerName === 'openrouter') {
        const { OpenRouterProvider } = require(path.resolve(__dirname, 'src/ai/providers/OpenRouterProvider.js'));
        // Ensure OpenRouter has the correct endpoint
        const config = {
          ...providerConfig,
          endpoint: providerConfig.endpoint || 'https://openrouter.ai/api/v1/chat/completions'
        };
        provider = new OpenRouterProvider(config);
      } else if (providerName === 'ollama') {
        const { OllamaProvider } = require(path.resolve(__dirname, 'src/ai/providers/OllamaProvider.js'));
        provider = new OllamaProvider(providerConfig);
      } else {
        throw new Error(`Unknown provider: ${providerName}`);
      }

      const result = await provider.testConnection();
      return { success: true, connected: result };
    } catch (error) {
      console.error(`Failed to test ${providerName} connection:`, error);
      return { success: false, error: error.message };
    }
  });

  // Get available Ollama models
  ipcMain.handle('ai-get-ollama-models', async (event, endpoint) => {
    console.log('ai-get-ollama-models handler called for:', endpoint);
    try {
      const { OllamaProvider } = require(path.resolve(__dirname, 'src/ai/providers/OllamaProvider.js'));
      const provider = new OllamaProvider({ endpoint: endpoint + '/api/chat' });
      const models = await provider.getAvailableModels();
      return { success: true, models };
    } catch (error) {
      console.error('Failed to get Ollama models:', error);
      return { success: false, error: error.message, models: [] };
    }
  });

  // Get available OpenRouter models
  ipcMain.handle('ai-get-openrouter-models', async (event, apiKey) => {
    console.log('ai-get-openrouter-models handler called');
    try {
      const { OpenRouterProvider } = require(path.resolve(__dirname, 'src/ai/providers/OpenRouterProvider.js'));
      const provider = new OpenRouterProvider({
        apiKey: apiKey,
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
      });
      const models = await provider.getAvailableModels();
      return { success: true, models };
    } catch (error) {
      console.error('Failed to get OpenRouter models:', error);
      return { success: false, error: error.message, models: [] };
    }
  });

  console.log('All AI IPC handlers registered successfully');
}

// Register Version Management IPC handlers
function registerVersionHandlers() {
  console.log('Registering Version Management IPC handlers...');

  // Initialize version management services
  ipcMain.handle('version-initialize', async () => {
    console.log('version-initialize handler called');
    try {
      const { VersionService, VersionStateManager } = require(path.resolve(__dirname, 'src/version/index.js'));

      // We'll get the database reference from the renderer when needed
      // For now, we'll initialize the services when first used
      console.log('Version Management services ready for initialization');
      return { success: true };
    } catch (error) {
      console.error('Failed to prepare version management services:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete version using Chain of Responsibility pattern
  ipcMain.handle('version-delete', async (event, promptId, options = {}) => {
    console.log('version-delete handler called', { promptId, options });
    try {
      // Initialize services if not already done
      if (!versionService || !versionStateManager) {
        const { VersionService, VersionStateManager } = require(path.resolve(__dirname, 'src/version/index.js'));

        // Note: We need to get the database instance from the renderer
        // This is a limitation of the current architecture where the database is in the renderer
        return {
          success: false,
          error: 'Version services need database initialization from renderer',
          requiresRendererInit: true
        };
      }

      const result = await versionService.deleteVersion(promptId, options);
      console.log('Version deletion result:', result);
      return result;
    } catch (error) {
      console.error('Version deletion failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get version information
  ipcMain.handle('version-get-info', async (event, promptId) => {
    console.log('version-get-info handler called', { promptId });
    try {
      if (!versionService) {
        return {
          success: false,
          error: 'Version service not initialized',
          requiresRendererInit: true
        };
      }

      const result = await versionService.getVersionInfo(promptId);
      return result;
    } catch (error) {
      console.error('Failed to get version info:', error);
      return { success: false, error: error.message };
    }
  });

  // Get version dependencies
  ipcMain.handle('version-get-dependencies', async (event, promptId) => {
    console.log('version-get-dependencies handler called', { promptId });
    try {
      if (!versionService) {
        return {
          success: false,
          error: 'Version service not initialized',
          requiresRendererInit: true
        };
      }

      const result = await versionService.getVersionDependencies(promptId);
      return result;
    } catch (error) {
      console.error('Failed to get version dependencies:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize version services with database (called from renderer)
  ipcMain.handle('version-init-with-db', async (event, dbProxy) => {
    console.log('version-init-with-db handler called');
    try {
      const { VersionService, VersionStateManager } = require(path.resolve(__dirname, 'src/version/index.js'));

      // Create state manager
      versionStateManager = new VersionStateManager(dbProxy);
      await versionStateManager.initialize();

      // Create version service
      versionService = new VersionService(dbProxy, versionStateManager);

      console.log('Version Management services initialized with database');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize version services with database:', error);
      return { success: false, error: error.message };
    }
  });

  // Validate database state
  ipcMain.handle('version-validate-state', async () => {
    console.log('version-validate-state handler called');
    try {
      if (!versionStateManager) {
        return {
          success: false,
          error: 'Version state manager not initialized',
          requiresRendererInit: true
        };
      }

      const result = await versionStateManager.validateDatabaseState();
      return result;
    } catch (error) {
      console.error('Failed to validate database state:', error);
      return { success: false, error: error.message };
    }
  });

  // Repair database state
  ipcMain.handle('version-repair-state', async (event, issues) => {
    console.log('version-repair-state handler called');
    try {
      if (!versionStateManager) {
        return {
          success: false,
          error: 'Version state manager not initialized',
          requiresRendererInit: true
        };
      }

      const result = await versionStateManager.repairDatabaseState(issues);
      return result;
    } catch (error) {
      console.error('Failed to repair database state:', error);
      return { success: false, error: error.message };
    }
  });

  // Get operation history
  ipcMain.handle('version-get-history', async (event, limit = 50) => {
    console.log('version-get-history handler called');
    try {
      if (!versionStateManager) {
        return {
          success: false,
          error: 'Version state manager not initialized',
          requiresRendererInit: true
        };
      }

      const history = versionStateManager.getOperationHistory(limit);
      return { success: true, history };
    } catch (error) {
      console.error('Failed to get operation history:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('All Version Management IPC handlers registered successfully');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Register AI IPC handlers before creating window
  registerAIHandlers();

  // Register Version Management IPC handlers
  registerVersionHandlers();

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});