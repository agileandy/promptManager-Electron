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
            enabled: !!config.openrouter.apiKey,
            name: "OpenRouter",
            endpoint: "https://openrouter.ai/api/v1/chat/completions",
            model: config.openrouter.model,
            apiKey: config.openrouter.apiKey,
            timeout: config.openrouter.timeout,
            maxRetries: config.openrouter.retries
          },
          ollama: {
            enabled: !!config.ollama.endpoint,
            name: "Ollama",
            endpoint: config.ollama.endpoint + "/api/chat",
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
          apiKey: aiConfig.providers?.openrouter?.apiKey || '',
          model: aiConfig.providers?.openrouter?.model || 'anthropic/claude-3.5-sonnet',
          timeout: aiConfig.providers?.openrouter?.timeout || 30000,
          retries: aiConfig.providers?.openrouter?.maxRetries || 3
        },
        ollama: {
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
    try {
      // Create temporary provider instance for testing
      let provider;
      if (providerName === 'openrouter') {
        const { OpenRouterProvider } = require(path.resolve(__dirname, 'src/ai/providers/OpenRouterProvider.js'));
        provider = new OpenRouterProvider(providerConfig);
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

  console.log('All AI IPC handlers registered successfully');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Register AI IPC handlers before creating window
  registerAIHandlers();

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