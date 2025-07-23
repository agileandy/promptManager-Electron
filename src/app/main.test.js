const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Mock the app and BrowserWindow for testing
jest.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(),
    getPath: jest.fn()
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn()
  }
}));

describe('Electron Single Instance Detection', () => {
  let originalApp;

  beforeEach(() => {
    // Store the original app object
    originalApp = global.app;
    global.app = require('electron').app;

    // Reset all mocks
    jest.clearAllMocks();

    // Set default mock implementations
    global.app.requestSingleInstanceLock.mockReturnValue(true);
    global.app.whenReady.mockResolvedValue();
    global.app.getPath.mockReturnValue('/mock/user/data/path');
  });

  afterEach(() => {
    // Restore the original app object
    global.app = originalApp;
  });

  test('should acquire single instance lock on first run', () => {
    // Import the main.js file which will execute its code
    require('../main.js');

    // Verify that requestSingleInstanceLock was called
    expect(global.app.requestSingleInstanceLock).toHaveBeenCalled();

    // Verify that the app continues when lock is acquired
    expect(global.app.whenReady).toHaveBeenCalled();
  });

  test('should quit if unable to acquire single instance lock', () => {
    // Mock requestSingleInstanceLock to return false
    global.app.requestSingleInstanceLock.mockReturnValue(false);

    // Import the main.js file
    require('../main.js');

    // Verify that quit was called when lock couldn't be acquired
    expect(global.app.requestSingleInstanceLock).toHaveBeenCalled();
    expect(global.app.quit).toHaveBeenCalled();
  });

  test('should handle second instance by focusing the main window', () => {
    // Mock a mainWindow object
    const mockMainWindow = {
      isMinimized: jest.fn().mockReturnValue(false),
      isDestroyed: jest.fn().mockReturnValue(false),
      restore: jest.fn(),
      focus: jest.fn()
    };

    // Set mainWindow in global scope
    global.mainWindow = mockMainWindow;

    // Import the main.js file
    require('../main.js');

    // Get the second-instance event handler
    const secondInstanceHandler = global.app.on.mock.calls
      .find(call => call[0] === 'second-instance')[1];

    // Call the handler
    secondInstanceHandler({}, [], '');

    // Verify that focus was called on mainWindow
    expect(mockMainWindow.isDestroyed).toHaveBeenCalled();
    expect(mockMainWindow.focus).toHaveBeenCalled();
  });

  test('should restore minimized window when second instance is detected', () => {
    // Mock a mainWindow object that is minimized
    const mockMainWindow = {
      isMinimized: jest.fn().mockReturnValue(true),
      isDestroyed: jest.fn().mockReturnValue(false),
      restore: jest.fn(),
      focus: jest.fn()
    };

    // Set mainWindow in global scope
    global.mainWindow = mockMainWindow;

    // Import the main.js file
    require('../main.js');

    // Get the second-instance event handler
    const secondInstanceHandler = global.app.on.mock.calls
      .find(call => call[0] === 'second-instance')[1];

    // Call the handler
    secondInstanceHandler({}, [], '');

    // Verify that restore was called on mainWindow
    expect(mockMainWindow.restore).toHaveBeenCalled();
    expect(mockMainWindow.focus).toHaveBeenCalled();
  });
});