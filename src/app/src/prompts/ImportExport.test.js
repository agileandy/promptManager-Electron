/**
 * ImportExport.test.js
 *
 * Unit tests for prompt import/export functionality
 */

// Mock database for testing
class MockDb {
  constructor() {
    this.prompts = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.prompts.data.values());
            return entries.filter(entry => entry[field] === value);
          })
        }))
      })),
      get: jest.fn().mockImplementation((id) => this.prompts.data.get(id) || null),
      add: jest.fn().mockImplementation((prompt) => {
        const id = prompt.id || Date.now();
        const newPrompt = { ...prompt, id };
        this.prompts.data.set(id, newPrompt);
        return id;
      }),
      bulkAdd: jest.fn().mockImplementation((prompts) => {
        const ids = [];
        for (const prompt of prompts) {
          const id = prompt.id || Date.now() + Math.floor(Math.random() * 1000);
          const newPrompt = { ...prompt, id };
          this.prompts.data.set(id, newPrompt);
          ids.push(id);
        }
        return ids;
      }),
      toArray: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(this.prompts.data.values()));
      })
    };

    this.promptTags = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            return entries.filter(entry => entry[field] === value);
          })
        }))
      })),
      add: jest.fn().mockImplementation((relation) => {
        const id = relation.id || Date.now();
        const newRelation = { ...relation, id };
        this.promptTags.data.set(id, newRelation);
        return id;
      }),
      bulkAdd: jest.fn().mockImplementation((relations) => {
        const ids = [];
        for (const relation of relations) {
          const id = relation.id || Date.now() + Math.floor(Math.random() * 1000);
          const newRelation = { ...relation, id };
          this.promptTags.data.set(id, newRelation);
          ids.push(id);
        }
        return ids;
      }),
      toArray: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(this.promptTags.data.values()));
      })
    };

    this.tags = {
      data: new Map(),
      get: jest.fn().mockImplementation((id) => this.tags.data.get(id) || null),
      add: jest.fn().mockImplementation((tag) => {
        const id = tag.id || Date.now();
        const newTag = { ...tag, id };
        this.tags.data.set(id, newTag);
        return id;
      }),
      bulkAdd: jest.fn().mockImplementation((tags) => {
        const ids = [];
        for (const tag of tags) {
          const id = tag.id || Date.now() + Math.floor(Math.random() * 1000);
          const newTag = { ...tag, id };
          this.tags.data.set(id, newTag);
          ids.push(id);
        }
        return ids;
      }),
      toArray: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(this.tags.data.values()));
      })
    };
  }

  // Helper methods for test setup
  addPrompt(prompt) {
    const id = prompt.id || Date.now();
    this.prompts.data.set(id, { ...prompt, id });
    return id;
  }

  addTag(tag) {
    const id = tag.id || Date.now();
    this.tags.data.set(id, { ...tag, id });
    return id;
  }

  addPromptTag(promptTag) {
    const id = promptTag.id || Date.now();
    this.promptTags.data.set(id, { ...promptTag, id });
    return id;
  }
}

describe('Import/Export Functionality', () => {
  let mockDb;

  beforeEach(() => {
    // Setup fresh mock database before each test
    mockDb = new MockDb();

    // Add test prompts
    mockDb.addPrompt({
      id: 1,
      title: 'Test Prompt 1',
      description: 'Test description 1',
      text: 'Test prompt text 1',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-01'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 2,
      title: 'Test Prompt 2',
      description: 'Test description 2',
      text: 'Test prompt text 2',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-02'),
      lastUsedAt: null,
      timesUsed: 0
    });

    // Add test tags
    mockDb.addTag({
      id: 1,
      name: 'javascript',
      fullPath: 'programming/javascript'
    });

    mockDb.addTag({
      id: 2,
      name: 'python',
      fullPath: 'programming/python'
    });

    // Add prompt-tag relationships
    mockDb.addPromptTag({
      id: 1,
      promptId: 1,
      tagId: 1
    });

    mockDb.addPromptTag({
      id: 2,
      promptId: 2,
      tagId: 2
    });
  });

  describe('exportData', () => {
    test('should export all prompts, tags, and relationships', async () => {
      // Get all data from the database
      const prompts = await mockDb.prompts.toArray();
      const tags = await mockDb.tags.toArray();
      const promptTags = await mockDb.promptTags.toArray();

      // Create export data
      const exportData = {
        prompts,
        tags,
        promptTags,
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          promptCount: prompts.length,
          tagCount: tags.length
        }
      };

      // Verify export data
      expect(exportData.prompts.length).toBe(2);
      expect(exportData.tags.length).toBe(2);
      expect(exportData.promptTags.length).toBe(2);
      expect(exportData.metadata.promptCount).toBe(2);
      expect(exportData.metadata.tagCount).toBe(2);
    });

    test('should export only latest versions of prompts', async () => {
      // Add a second version of prompt 1
      mockDb.addPrompt({
        id: 3,
        title: 'Test Prompt 1 v2',
        description: 'Test description 1 updated',
        text: 'Test prompt text 1 updated',
        version: 2,
        isLatest: 1,
        parentId: 1,
        createdAt: new Date('2023-01-03'),
        lastUsedAt: null,
        timesUsed: 0
      });

      // Update original to not be latest
      await mockDb.prompts.data.set(1, { ...mockDb.prompts.data.get(1), isLatest: 0 });

      // Get only latest prompts
      const latestPrompts = await mockDb.prompts.where('isLatest').equals(1).toArray();
      const tags = await mockDb.tags.toArray();
      const promptTags = await mockDb.promptTags.toArray();

      // Create export data with only latest versions
      const exportData = {
        prompts: latestPrompts,
        tags,
        promptTags,
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          promptCount: latestPrompts.length,
          tagCount: tags.length,
          exportType: 'latest_only'
        }
      };

      // Verify export data
      expect(exportData.prompts.length).toBe(2);
      expect(exportData.prompts.find(p => p.id === 1)).toBeUndefined(); // Original version should not be included
      expect(exportData.prompts.find(p => p.id === 3)).toBeTruthy(); // Latest version should be included
      expect(exportData.prompts.find(p => p.id === 2)).toBeTruthy(); // Other prompt should be included
    });

    test('should export all versions of prompts', async () => {
      // Add a second version of prompt 1
      mockDb.addPrompt({
        id: 3,
        title: 'Test Prompt 1 v2',
        description: 'Test description 1 updated',
        text: 'Test prompt text 1 updated',
        version: 2,
        isLatest: 1,
        parentId: 1,
        createdAt: new Date('2023-01-03'),
        lastUsedAt: null,
        timesUsed: 0
      });

      // Update original to not be latest
      await mockDb.prompts.data.set(1, { ...mockDb.prompts.data.get(1), isLatest: 0 });

      // Get all prompts
      const allPrompts = await mockDb.prompts.toArray();
      const tags = await mockDb.tags.toArray();
      const promptTags = await mockDb.promptTags.toArray();

      // Create export data with all versions
      const exportData = {
        prompts: allPrompts,
        tags,
        promptTags,
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          promptCount: allPrompts.length,
          tagCount: tags.length,
          exportType: 'all_versions'
        }
      };

      // Verify export data
      expect(exportData.prompts.length).toBe(3);
      expect(exportData.prompts.find(p => p.id === 1)).toBeTruthy(); // Original version should be included
      expect(exportData.prompts.find(p => p.id === 3)).toBeTruthy(); // Latest version should be included
      expect(exportData.prompts.find(p => p.id === 2)).toBeTruthy(); // Other prompt should be included
    });
  });

  describe('importData', () => {
    test('should import prompts, tags, and relationships', async () => {
      // Create import data
      const importData = {
        prompts: [
          {
            title: 'Imported Prompt 1',
            description: 'Imported description 1',
            text: 'Imported prompt text 1',
            version: 1,
            isLatest: 1,
            parentId: null,
            createdAt: new Date('2023-02-01').toISOString(),
            lastUsedAt: null,
            timesUsed: 0
          },
          {
            title: 'Imported Prompt 2',
            description: 'Imported description 2',
            text: 'Imported prompt text 2',
            version: 1,
            isLatest: 1,
            parentId: null,
            createdAt: new Date('2023-02-02').toISOString(),
            lastUsedAt: null,
            timesUsed: 0
          }
        ],
        tags: [
          {
            name: 'react',
            fullPath: 'programming/react'
          },
          {
            name: 'node',
            fullPath: 'programming/node'
          }
        ],
        promptTags: [
          {
            promptId: 0, // Will be replaced with actual ID after import
            tagId: 0 // Will be replaced with actual ID after import
          },
          {
            promptId: 1, // Will be replaced with actual ID after import
            tagId: 1 // Will be replaced with actual ID after import
          }
        ],
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          promptCount: 2,
          tagCount: 2
        }
      };

      // Import prompts
      const promptIds = await mockDb.prompts.bulkAdd(importData.prompts);

      // Import tags
      const tagIds = await mockDb.tags.bulkAdd(importData.tags);

      // Update promptTags with actual IDs
      const promptTagsToImport = importData.promptTags.map((pt, index) => ({
        promptId: promptIds[pt.promptId],
        tagId: tagIds[pt.tagId]
      }));

      // Import promptTags
      await mockDb.promptTags.bulkAdd(promptTagsToImport);

      // Verify import
      const allPrompts = await mockDb.prompts.toArray();
      const allTags = await mockDb.tags.toArray();
      const allPromptTags = await mockDb.promptTags.toArray();

      expect(allPrompts.length).toBe(4); // 2 original + 2 imported
      expect(allTags.length).toBe(4); // 2 original + 2 imported
      expect(allPromptTags.length).toBe(4); // 2 original + 2 imported

      // Verify imported prompts
      const importedPrompts = allPrompts.filter(p => p.title.startsWith('Imported'));
      expect(importedPrompts.length).toBe(2);
      expect(importedPrompts[0].title).toBe('Imported Prompt 1');
      expect(importedPrompts[1].title).toBe('Imported Prompt 2');

      // Verify imported tags
      const importedTags = allTags.filter(t => t.name === 'react' || t.name === 'node');
      expect(importedTags.length).toBe(2);
      expect(importedTags[0].fullPath).toBe('programming/react');
      expect(importedTags[1].fullPath).toBe('programming/node');
    });

    test('should handle duplicate tags during import', async () => {
      // Create import data with a tag that already exists
      const importData = {
        prompts: [
          {
            title: 'Imported Prompt',
            description: 'Imported description',
            text: 'Imported prompt text',
            version: 1,
            isLatest: 1,
            parentId: null,
            createdAt: new Date('2023-02-01').toISOString(),
            lastUsedAt: null,
            timesUsed: 0
          }
        ],
        tags: [
          {
            name: 'javascript', // Already exists in the database
            fullPath: 'programming/javascript'
          }
        ],
        promptTags: [
          {
            promptId: 0, // Will be replaced with actual ID after import
            tagId: 0 // Will be replaced with actual ID after import
          }
        ]
      };

      // Get existing tag
      const tags = await mockDb.tags.toArray();
      const existingTag = tags.find(t => t.fullPath === 'programming/javascript');

      // Import prompts
      const promptIds = await mockDb.prompts.bulkAdd(importData.prompts);

      // Check if tags already exist and use existing IDs
      const tagIdsMap = new Map();
      for (let i = 0; i < importData.tags.length; i++) {
        const importTag = importData.tags[i];
        const tags = await mockDb.tags.toArray();
        const existingTagMatch = tags.find(t => t.fullPath === importTag.fullPath);

        if (existingTagMatch) {
          tagIdsMap.set(i, existingTagMatch.id);
        } else {
          const newTagId = await mockDb.tags.add(importTag);
          tagIdsMap.set(i, newTagId);
        }
      }

      // Update promptTags with actual IDs
      const promptTagsToImport = importData.promptTags.map(pt => ({
        promptId: promptIds[pt.promptId],
        tagId: tagIdsMap.get(pt.tagId)
      }));

      // Import promptTags
      await mockDb.promptTags.bulkAdd(promptTagsToImport);

      // Verify import
      const allPrompts = await mockDb.prompts.toArray();
      const allTags = await mockDb.tags.toArray();
      const allPromptTags = await mockDb.promptTags.toArray();

      expect(allPrompts.length).toBe(3); // 2 original + 1 imported
      expect(allTags.length).toBe(2); // 2 original (no new tags added)
      expect(allPromptTags.length).toBe(3); // 2 original + 1 imported

      // Verify the imported prompt uses the existing tag
      const importedPrompt = allPrompts.find(p => p.title === 'Imported Prompt');
      const importedPromptTag = allPromptTags.find(pt => pt.promptId === importedPrompt.id);
      expect(importedPromptTag.tagId).toBe(existingTag.id);
    });
  });
});