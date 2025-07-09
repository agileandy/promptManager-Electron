// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  openDatabaseViewer: () => ipcRenderer.invoke('open-database-viewer'),

  // AI Service API
  ai: {
    initialize: () => ipcRenderer.invoke('ai-initialize'),
    getProviders: () => ipcRenderer.invoke('ai-get-providers'),
    generateDescription: (description, providerName) => ipcRenderer.invoke('ai-generate-description', description, providerName),
    optimizePrompt: (promptText, providerName) => ipcRenderer.invoke('ai-optimize-prompt', promptText, providerName),
    saveConfig: (config) => ipcRenderer.invoke('ai-save-config', config),
    getConfig: () => ipcRenderer.invoke('ai-get-config'),
    testProvider: (providerName, providerConfig) => ipcRenderer.invoke('ai-test-provider', providerName, providerConfig),
    getOllamaModels: (endpoint) => ipcRenderer.invoke('ai-get-ollama-models', endpoint)
  }
});
