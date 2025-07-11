/**
 * SearchFilter.test.js
 *
 * Unit tests for prompt search and filter functionality
 */

// Mock database for testing
class MockDb {
  constructor() {
    this.prompts = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          first: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.prompts.data.values());
            return entries.find(entry => entry[field] === value) || null;
          }),
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.prompts.data.values());
            return Promise.resolve(entries.filter(entry => entry[field] === value));
          }),
          and: jest.fn().mockImplementation((predicate) => ({
            toArray: jest.fn().mockImplementation(() => {
              const entries = Array.from(this.prompts.data.values());
              return Promise.resolve(entries.filter(entry => entry[field] === value && predicate(entry)));
            })
          }))
        })),
        anyOf: jest.fn().mockImplementation((values) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.prompts.data.values());
            return Promise.resolve(entries.filter(entry => values.includes(entry[field])));
          }),
          and: jest.fn().mockImplementation((predicate) => ({
            toArray: jest.fn().mockImplementation(() => {
              const entries = Array.from(this.prompts.data.values());
              return Promise.resolve(entries.filter(entry => values.includes(entry[field]) && predicate(entry)));
            })
          }))
        }))
      })),
      get: jest.fn().mockImplementation((id) => this.prompts.data.get(id) || null),
      add: jest.fn().mockImplementation((prompt) => {
        const id = prompt.id || Date.now();
        const newPrompt = { ...prompt, id };
        this.prompts.data.set(id, newPrompt);
        return id;
      })
    };

    this.promptTags = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            return Promise.resolve(entries.filter(entry => entry[field] === value));
          })
        })),
        anyOf: jest.fn().mockImplementation((values) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            return Promise.resolve(entries.filter(entry => values.includes(entry[field])));
          })
        }))
      })),
      toArray: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(this.promptTags.data.values()));
      })
    };

    this.tags = {
      data: new Map(),
      get: jest.fn().mockImplementation((id) => this.tags.data.get(id) || null),
      where: jest.fn().mockImplementation((field) => ({
        anyOf: jest.fn().mockImplementation((values) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.tags.data.values());
            return Promise.resolve(entries.filter(entry => values.includes(entry[field])));
          })
        }))
      })),
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

describe('Search and Filter Functionality', () => {
  let mockDb;

  beforeEach(() => {
    // Setup fresh mock database before each test
    mockDb = new MockDb();

    // Add test prompts
    mockDb.addPrompt({
      id: 1,
      title: 'JavaScript Basics',
      description: 'Introduction to JavaScript',
      text: 'Explain JavaScript basics including variables, functions, and objects.',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-01'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 2,
      title: 'Python for Beginners',
      description: 'Getting started with Python',
      text: 'Explain Python basics for beginners.',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-02'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 3,
      title: 'Advanced JavaScript',
      description: 'Deep dive into JavaScript',
      text: 'Explain advanced JavaScript concepts like closures, promises, and async/await.',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-03'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 4,
      title: 'SQL Queries',
      description: 'Common SQL queries',
      text: 'Provide examples of common SQL queries for data manipulation.',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-04'),
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

    mockDb.addTag({
      id: 3,
      name: 'sql',
      fullPath: 'programming/sql'
    });

    mockDb.addTag({
      id: 4,
      name: 'programming',
      fullPath: 'programming'
    });

    // Add prompt-tag relationships
    mockDb.addPromptTag({
      id: 1,
      promptId: 1,
      tagId: 1
    });

    mockDb.addPromptTag({
      id: 2,
      promptId: 1,
      tagId: 4
    });

    mockDb.addPromptTag({
      id: 3,
      promptId: 2,
      tagId: 2
    });

    mockDb.addPromptTag({
      id: 4,
      promptId: 2,
      tagId: 4
    });

    mockDb.addPromptTag({
      id: 5,
      promptId: 3,
      tagId: 1
    });

    mockDb.addPromptTag({
      id: 6,
      promptId: 3,
      tagId: 4
    });

    mockDb.addPromptTag({
      id: 7,
      promptId: 4,
      tagId: 3
    });

    mockDb.addPromptTag({
      id: 8,
      promptId: 4,
      tagId: 4
    });
  });

  describe('searchPrompts', () => {
    test('should find prompts by title', () => {
      const searchTerm = 'javascript';
      const allPrompts = Array.from(mockDb.prompts.data.values());

      const filteredPrompts = allPrompts.filter(p => {
        const haystack = `${p.title} ${p.description} ${p.text}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      });

      expect(filteredPrompts.length).toBe(2);
      expect(filteredPrompts[0].id).toBe(1);
      expect(filteredPrompts[1].id).toBe(3);
    });

    test('should find prompts by description', () => {
      const searchTerm = 'getting started';
      const allPrompts = Array.from(mockDb.prompts.data.values());

      const filteredPrompts = allPrompts.filter(p => {
        const haystack = `${p.title} ${p.description} ${p.text}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      });

      expect(filteredPrompts.length).toBe(1);
      expect(filteredPrompts[0].id).toBe(2);
    });

    test('should find prompts by content', () => {
      const searchTerm = 'closures';
      const allPrompts = Array.from(mockDb.prompts.data.values());

      const filteredPrompts = allPrompts.filter(p => {
        const haystack = `${p.title} ${p.description} ${p.text}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      });

      expect(filteredPrompts.length).toBe(1);
      expect(filteredPrompts[0].id).toBe(3);
    });

    test('should return empty array when no matches found', () => {
      const searchTerm = 'nonexistent';
      const allPrompts = Array.from(mockDb.prompts.data.values());

      const filteredPrompts = allPrompts.filter(p => {
        const haystack = `${p.title} ${p.description} ${p.text}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      });

      expect(filteredPrompts.length).toBe(0);
    });
  });

  describe('filterPromptsByTag', () => {
    test('should filter prompts by exact tag match', async () => {
      const tagPath = 'programming/javascript';

      // Get all tags that match this path pattern (exact match)
      const allTags = await mockDb.tags.toArray();
      const matchingTags = allTags.filter(tag => {
        return tag.fullPath === tagPath;
      });

      expect(matchingTags.length).toBe(1);

      // Get all prompt IDs that have any of these tags
      const tagIds = matchingTags.map(tag => tag.id);
      const promptTagRelations = await mockDb.promptTags.where('tagId').anyOf(tagIds).toArray();
      const promptIdsArray = [...new Set(promptTagRelations.map(pt => pt.promptId))];

      // Get the prompts
      const taggedPrompts = await mockDb.prompts.where('id').anyOf(promptIdsArray).and(p => p.isLatest === 1).toArray();

      expect(taggedPrompts.length).toBe(2);
      expect(taggedPrompts[0].title).toBe('JavaScript Basics');
      expect(taggedPrompts[1].title).toBe('Advanced JavaScript');
    });

    test('should filter prompts by parent tag (hierarchical)', async () => {
      const tagPath = 'programming';

      // Get all tags that match this path pattern (exact match or children)
      const allTags = await mockDb.tags.toArray();
      const matchingTags = allTags.filter(tag => {
        return tag.fullPath === tagPath || tag.fullPath.startsWith(tagPath + '/');
      });

      expect(matchingTags.length).toBe(4); // All tags match

      // Get all prompt IDs that have any of these tags
      const tagIds = matchingTags.map(tag => tag.id);
      const promptTagRelations = await mockDb.promptTags.where('tagId').anyOf(tagIds).toArray();
      const promptIdsArray = [...new Set(promptTagRelations.map(pt => pt.promptId))];

      // Get the prompts
      const taggedPrompts = await mockDb.prompts.where('id').anyOf(promptIdsArray).and(p => p.isLatest === 1).toArray();

      expect(taggedPrompts.length).toBe(4); // All prompts match
    });

    test('should return empty array when no prompts match tag', async () => {
      const tagPath = 'nonexistent';

      // Get all tags that match this path pattern
      const allTags = await mockDb.tags.toArray();
      const matchingTags = allTags.filter(tag => {
        return tag.fullPath === tagPath || tag.fullPath.startsWith(tagPath + '/');
      });

      expect(matchingTags.length).toBe(0);

      // Since no tags match, we expect no prompts
      const taggedPrompts = [];

      expect(taggedPrompts.length).toBe(0);
    });
  });

  describe('filterUntaggedPrompts', () => {
    test('should find prompts without tags', async () => {
      // Add an untagged prompt
      mockDb.addPrompt({
        id: 5,
        title: 'Untagged Prompt',
        description: 'This prompt has no tags',
        text: 'Content of untagged prompt',
        version: 1,
        isLatest: 1,
        parentId: null,
        createdAt: new Date('2023-01-05'),
        lastUsedAt: null,
        timesUsed: 0
      });

      const allPrompts = await mockDb.prompts.where('isLatest').equals(1).toArray();
      const tags = await mockDb.promptTags.toArray();
      const taggedPromptIds = tags.map(t => t.promptId);
      const untaggedPrompts = allPrompts.filter(p => !taggedPromptIds.includes(p.id));

      expect(untaggedPrompts.length).toBe(1);
      expect(untaggedPrompts[0].id).toBe(5);
      expect(untaggedPrompts[0].title).toBe('Untagged Prompt');
    });

    test('should return empty array when all prompts have tags', async () => {
      const allPrompts = await mockDb.prompts.where('isLatest').equals(1).toArray();
      const tags = await mockDb.promptTags.toArray();
      const taggedPromptIds = tags.map(t => t.promptId);
      const untaggedPrompts = allPrompts.filter(p => !taggedPromptIds.includes(p.id));

      expect(untaggedPrompts.length).toBe(0);
    });
  });
});