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