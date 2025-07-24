// Import the necessary modules
const { JSDOM } = require('jsdom');
const fs = require('fs');

// Load the renderer.js file content
const rendererContent = fs.readFileSync('./src/app/src/renderer.js', 'utf8');

// Set up a mock DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
  <body>
    <div id="tag-tree"></div>
    <div id="prompt-grid"></div>
    <input type="search" id="search-input" />
  </body>
  </html>
`, { url: 'http://localhost' });

// Set up global variables for the test
global.window = dom.window;
global.document = dom.window.document;
global.navigator = { clipboard: { writeText: jest.fn() } };

// Mock the database and Electron API
global.db = {
  tags: {
    toArray: jest.fn()
  },
  promptTags: {
    where: jest.fn().mockReturnThis(),
    anyOf: jest.fn().mockReturnThis(),
    toArray: jest.fn()
  },
  prompts: {
    where: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    toArray: jest.fn()
  }
};

global.window.electronAPI = {
  getDataDir: jest.fn().mockResolvedValue('/test/data/dir'),
  ai: {
    initialize: jest.fn().mockResolvedValue({ success: true, providers: [] }),
    getDefaultProvider: jest.fn().mockResolvedValue('openrouter'),
    getConfig: jest.fn().mockResolvedValue({})
  },
  openDatabaseViewer: jest.fn()
};

// Execute the renderer.js code in the test environment
eval(rendererContent);

// Test suite for tag filtering functionality
describe('Tag Filtering Functionality', () => {
  let allTags;
  let promptTagRelations;
  let prompts;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up test data
    allTags = [
      { id: 1, name: 'ai', fullPath: 'ai', parentId: null, level: 0 },
      { id: 2, name: 'ml', fullPath: 'ai/ml', parentId: 1, level: 1 },
      { id: 3, name: 'nlp', fullPath: 'ai/nlp', parentId: 1, level: 1 },
      { id: 4, name: 'web', fullPath: 'web', parentId: null, level: 0 },
      { id: 5, name: 'frontend', fullPath: 'web/frontend', parentId: 4, level: 1 },
      { id: 6, name: 'backend', fullPath: 'web/backend', parentId: 4, level: 1 },
      { id: 7, name: 'aide', fullPath: 'aide', parentId: null, level: 0 } // Similar but different tag
    ];

    promptTagRelations = [
      { id: 1, promptId: 1, tagId: 1 }, // ai tag
      { id: 2, promptId: 2, tagId: 2 }, // ai/ml tag
      { id: 3, promptId: 3, tagId: 3 }, // ai/nlp tag
      { id: 4, promptId: 4, tagId: 4 }, // web tag
      { id: 5, promptId: 5, tagId: 5 }, // web/frontend tag
      { id: 6, promptId: 6, tagId: 6 }, // web/backend tag
      { id: 7, promptId: 7, tagId: 7 }  // aide tag
    ];

    prompts = [
      { id: 1, title: 'AI Prompt', isLatest: 1 },
      { id: 2, title: 'ML Prompt', isLatest: 1 },
      { id: 3, title: 'NLP Prompt', isLatest: 1 },
      { id: 4, title: 'Web Prompt', isLatest: 1 },
      { id: 5, title: 'Frontend Prompt', isLatest: 1 },
      { id: 6, title: 'Backend Prompt', isLatest: 1 },
      { id: 7, title: 'Aide Prompt', isLatest: 1 }
    ];
  });

  test('should filter prompts by exact tag match', async () => {
    // Mock database responses
    global.db.tags.toArray.mockResolvedValue(allTags);
    global.db.promptTags.where.mockReturnValue({
      anyOf: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          promptTagRelations[0] // Only the ai tag relation
        ])
      })
    });
    global.db.prompts.where.mockReturnValue({
      equals: jest.fn().mockReturnValue({
        and: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            prompts[0] // Only the AI prompt
          ])
        })
      })
    });

    // Call the function
    await renderPromptsByTag('ai');

    // Verify the results
    expect(global.db.tags.toArray).toHaveBeenCalled();
    expect(global.db.promptTags.where).toHaveBeenCalledWith('tagId');
    expect(global.db.prompts.where).toHaveBeenCalledWith('id');
    expect(document.getElementById('prompt-grid').innerHTML).toContain('AI Prompt');
    expect(document.getElementById('prompt-grid').innerHTML).not.toContain('ML Prompt');
    expect(document.getElementById('prompt-grid').innerHTML).not.toContain('NLP Prompt');
  });

  test('should filter prompts by parent tag including all children', async () => {
    // Mock database responses
    global.db.tags.toArray.mockResolvedValue(allTags);
    global.db.promptTags.where.mockReturnValue({
      anyOf: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          promptTagRelations[0], // ai tag
          promptTagRelations[1], // ai/ml tag
          promptTagRelations[2]  // ai/nlp tag
        ])
      })
    });
    global.db.prompts.where.mockReturnValue({
      equals: jest.fn().mockReturnValue({
        and: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            prompts[0], // AI prompt
            prompts[1], // ML prompt
            prompts[2]  // NLP prompt
          ])
        })
      })
    });

    // Call the function
    await renderPromptsByTag('ai');

    // Verify the results
    expect(document.getElementById('prompt-grid').innerHTML).toContain('AI Prompt');
    expect(document.getElementById('prompt-grid').innerHTML).toContain('ML Prompt');
    expect(document.getElementById('prompt-grid').innerHTML).toContain('NLP Prompt');
    expect(document.getElementById('prompt-grid').innerHTML).not.toContain('Web Prompt');
  });

  test('should not match partial tag names', async () => {
    // Mock database responses
    global.db.tags.toArray.mockResolvedValue(allTags);
    global.db.promptTags.where.mockReturnValue({
      anyOf: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          promptTagRelations[0] // ai tag
        ])
      })
    });
    global.db.prompts.where.mockReturnValue({
      equals: jest.fn().mockReturnValue({
        and: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            prompts[0] // AI prompt
          ])
        })
      })
    });

    // Call the function
    await renderPromptsByTag('ai');

    // Verify that 'aide' tag is not included when filtering by 'ai'
    expect(document.getElementById('prompt-grid').innerHTML).not.toContain('Aide Prompt');
  });

  test('should handle non-existent tag path', async () => {
    // Mock database responses
    global.db.tags.toArray.mockResolvedValue(allTags);

    // Call the function with a non-existent tag
    await renderPromptsByTag('nonexistent');

    // Verify the error message is displayed
    expect(document.getElementById('prompt-grid').innerHTML).toContain('No prompts found with tag "nonexistent"');
  });

  test('should properly handle tag with special characters', async () => {
    // Add a tag with special characters
    const specialTags = [...allTags, { id: 8, name: 'ai-dev', fullPath: 'ai-dev', parentId: null, level: 0 }];

    global.db.tags.toArray.mockResolvedValue(specialTags);
    global.db.promptTags.where.mockReturnValue({
      anyOf: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { id: 8, promptId: 8, tagId: 8 }
        ])
      })
    });
    global.db.prompts.where.mockReturnValue({
      equals: jest.fn().mockReturnValue({
        and: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { id: 8, title: 'AI Dev Prompt', isLatest: 1 }
          ])
        })
      })
    });

    // Call the function
    await renderPromptsByTag('ai-dev');

    // Verify the results
    expect(document.getElementById('prompt-grid').innerHTML).toContain('AI Dev Prompt');
  });
});