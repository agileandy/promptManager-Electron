/**
 * SimpleTagManager.test.js
 *
 * Unit tests for SimpleTagManager class
 */

const SimpleTagManager = require('./SimpleTagManager');

// Mock database for testing
class MockDb {
  constructor() {
    this.tags = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          first: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.tags.data.values());
            return entries.find(entry => entry[field] === value) || null;
          }),
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.tags.data.values());
            return entries.filter(entry => entry[field] === value);
          })
        })),
        anyOf: jest.fn().mockImplementation((values) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.tags.data.values());
            return entries.filter(entry => values.includes(entry[field]));
          })
        }))
      })),
      get: jest.fn().mockImplementation((id) => this.tags.data.get(id) || null),
      add: jest.fn().mockImplementation((tag) => {
        const id = tag.id || Date.now();
        const newTag = { ...tag, id };
        this.tags.data.set(id, newTag);
        return id;
      }),
      update: jest.fn().mockImplementation((id, changes) => {
        const tag = this.tags.data.get(id);
        if (tag) {
          this.tags.data.set(id, { ...tag, ...changes });
          return 1;
        }
        return 0;
      })
    };

    this.promptTags = {
      data: new Map(),
      where: jest.fn().mockImplementation((field) => ({
        equals: jest.fn().mockImplementation((value) => ({
          first: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            return entries.find(entry => entry[field] === value) || null;
          }),
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            return entries.filter(entry => entry[field] === value);
          }),
          and: jest.fn().mockImplementation((predicate) => ({
            first: jest.fn().mockImplementation(() => {
              const entries = Array.from(this.promptTags.data.values());
              return entries.find(entry => entry[field] === value && predicate(entry)) || null;
            })
          })),
          delete: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.promptTags.data.values());
            const toDelete = entries.filter(entry => entry[field] === value);
            toDelete.forEach(entry => this.promptTags.data.delete(entry.id));
            return toDelete.length;
          })
        }))
      })),
      add: jest.fn().mockImplementation((relation) => {
        const id = relation.id || Date.now();
        const newRelation = { ...relation, id };
        this.promptTags.data.set(id, newRelation);
        return id;
      })
    };
  }

  // Helper methods for test setup
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

describe('SimpleTagManager', () => {
  let tagManager;
  let mockDb;

  beforeEach(() => {
    // Setup fresh mock database before each test
    mockDb = new MockDb();
    tagManager = new SimpleTagManager(mockDb);

    // Add some test data
    mockDb.addTag({ id: 1, name: 'test-tag', fullPath: 'test-tag' });
    mockDb.addTag({ id: 2, name: 'another-tag', fullPath: 'another-tag' });
    mockDb.addPromptTag({ id: 1, promptId: 1, tagId: 1 });
  });

  describe('addTagToPrompt', () => {
    test('should add a tag to a prompt', async () => {
      const result = await tagManager.addTagToPrompt(2, 'test-tag');

      expect(result).toBe(true);
      expect(mockDb.promptTags.add).toHaveBeenCalledWith({
        promptId: 2,
        tagId: 1
      });
    });

    test('should create a new tag if it does not exist', async () => {
      const result = await tagManager.addTagToPrompt(2, 'new-tag');

      expect(result).toBe(true);
      // Verify the tag was created
      const newTag = Array.from(mockDb.tags.data.values())
        .find(tag => tag.name === 'new-tag');
      expect(newTag).toBeTruthy();
      expect(newTag.fullPath).toBe('new-tag');

      // Verify the relationship was created
      expect(mockDb.promptTags.add).toHaveBeenCalled();
      const call = mockDb.promptTags.add.mock.calls[0][0];
      expect(call.promptId).toBe(2);
      expect(call.tagId).toBeTruthy();
    });

    test('should not add a tag that is already assigned to the prompt', async () => {
      const result = await tagManager.addTagToPrompt(1, 'test-tag');

      expect(result).toBe(false);
      expect(mockDb.promptTags.add).not.toHaveBeenCalled();
    });

    test('should handle errors properly', async () => {
      // Mock a database error
      mockDb.promptTags.add.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(tagManager.addTagToPrompt(2, 'test-tag'))
        .rejects.toThrow('Database error');
    });
  });

  describe('removeTagFromPrompt', () => {
    test('should remove a tag from a prompt', async () => {
      const result = await tagManager.removeTagFromPrompt(1, 1);

      expect(result).toBe(true);
      expect(mockDb.promptTags.where).toHaveBeenCalledWith('promptId');
    });

    test('should return false if tag was not assigned to prompt', async () => {
      const result = await tagManager.removeTagFromPrompt(999, 999);

      expect(result).toBe(false);
    });

    test('should handle errors properly', async () => {
      // Mock a database error
      mockDb.promptTags.where().equals().delete.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(tagManager.removeTagFromPrompt(1, 1))
        .rejects.toThrow('Database error');
    });
  });

  describe('replacePromptTags', () => {
    test('should replace all tags for a prompt', async () => {
      const result = await tagManager.replacePromptTags(1, ['new-tag-1', 'new-tag-2']);

      expect(result).toBe(true);
      expect(mockDb.promptTags.where().equals().delete).toHaveBeenCalled();
      expect(mockDb.promptTags.add).toHaveBeenCalledTimes(2);
    });

    test('should handle empty tag array', async () => {
      const result = await tagManager.replacePromptTags(1, []);

      expect(result).toBe(true);
      expect(mockDb.promptTags.where().equals().delete).toHaveBeenCalled();
      expect(mockDb.promptTags.add).not.toHaveBeenCalled();
    });

    test('should handle errors properly', async () => {
      // Mock a database error
      mockDb.promptTags.where().equals().delete.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(tagManager.replacePromptTags(1, ['tag1']))
        .rejects.toThrow('Database error');
    });
  });

  describe('getPromptTags', () => {
    test('should get all tags for a prompt', async () => {
      // Setup additional test data
      mockDb.addTag({ id: 3, name: 'third-tag', fullPath: 'third-tag' });
      mockDb.addPromptTag({ id: 2, promptId: 2, tagId: 1 });
      mockDb.addPromptTag({ id: 3, promptId: 2, tagId: 3 });

      const tags = await tagManager.getPromptTags(2);

      expect(tags).toHaveLength(2);
      expect(tags[0].id).toBe(1); // test-tag
      expect(tags[1].id).toBe(3); // third-tag
    });

    test('should return empty array if prompt has no tags', async () => {
      const tags = await tagManager.getPromptTags(999);

      expect(tags).toEqual([]);
    });

    test('should handle errors properly', async () => {
      // Mock a database error
      mockDb.promptTags.where().equals().toArray.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = await tagManager.getPromptTags(1);
      expect(result).toEqual([]);
    });
  });

  describe('_findOrCreateTag', () => {
    test('should find existing tag by fullPath', async () => {
      const tag = await tagManager._findOrCreateTag('test-tag');

      expect(tag.id).toBe(1);
      expect(tag.name).toBe('test-tag');
      expect(tag.fullPath).toBe('test-tag');
    });

    test('should find existing tag by name as fallback', async () => {
      // Add a tag without fullPath
      mockDb.addTag({ id: 4, name: 'legacy-tag' });

      const tag = await tagManager._findOrCreateTag('legacy-tag');

      expect(tag.id).toBe(4);
      expect(tag.name).toBe('legacy-tag');
      expect(tag.fullPath).toBe('legacy-tag'); // Should be updated
      expect(mockDb.tags.update).toHaveBeenCalledWith(4, { fullPath: 'legacy-tag' });
    });

    test('should create new tag if it does not exist', async () => {
      const tag = await tagManager._findOrCreateTag('brand-new-tag');

      expect(tag.name).toBe('brand-new-tag');
      expect(tag.fullPath).toBe('brand-new-tag');
      expect(mockDb.tags.add).toHaveBeenCalled();
    });

    test('should handle hierarchical tags', async () => {
      const tag = await tagManager._findOrCreateTag('parent/child');

      expect(tag.name).toBe('child');
      expect(tag.fullPath).toBe('parent/child');

      // Verify parent was created first
      const parentTag = Array.from(mockDb.tags.data.values())
        .find(t => t.name === 'parent');
      expect(parentTag).toBeTruthy();
      expect(parentTag.fullPath).toBe('parent');

      // Verify child references parent
      expect(tag.parentId).toBe(parentTag.id);
      expect(tag.level).toBe(1);
    });
  });
});