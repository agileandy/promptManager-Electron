/**
 * VersionManager.test.js
 *
 * Unit tests for prompt versioning functionality
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
          or: jest.fn().mockImplementation((field2) => ({
            equals: jest.fn().mockImplementation((value2) => ({
              toArray: jest.fn().mockImplementation(() => {
                const entries = Array.from(this.prompts.data.values());
                return Promise.resolve(entries.filter(entry => entry[field] === value || entry[field2] === value2));
              }),
              count: jest.fn().mockImplementation(() => {
                const entries = Array.from(this.prompts.data.values());
                return entries.filter(entry => entry[field] === value || entry[field2] === value2).length;
              })
            }))
          }))
        })),
        anyOf: jest.fn().mockImplementation((values) => ({
          toArray: jest.fn().mockImplementation(() => {
            const entries = Array.from(this.prompts.data.values());
            return Promise.resolve(entries.filter(entry => values.includes(entry[field])));
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
      update: jest.fn().mockImplementation((id, changes) => {
        const prompt = this.prompts.data.get(id);
        if (prompt) {
          this.prompts.data.set(id, { ...prompt, ...changes });
          return 1;
        }
        return 0;
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
            return Promise.resolve(entries.filter(entry => entry[field] === value));
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
  addPrompt(prompt) {
    const id = prompt.id || Date.now();
    this.prompts.data.set(id, { ...prompt, id });
    return id;
  }
}

// Mock SimpleVersionManager for testing
class SimpleVersionManager {
  constructor(db) {
    this.db = db;
  }

  async resequenceVersionNumbers() {
    // Get all prompts
    const allPrompts = await this.db.prompts.toArray();

    // Group prompts by family (parentId or id if it's the root)
    const promptFamilies = new Map();

    for (const prompt of allPrompts) {
      const familyId = prompt.parentId || prompt.id;
      if (!promptFamilies.has(familyId)) {
        promptFamilies.set(familyId, []);
      }
      promptFamilies.get(familyId).push(prompt);
    }

    // Process each family
    for (const [familyId, family] of promptFamilies) {
      if (family.length <= 1) continue; // Skip single-version families

      // Sort by creation date to maintain chronological order
      family.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Resequence version numbers
      for (let i = 0; i < family.length; i++) {
        const prompt = family[i];
        const newVersion = i + 1;
        const isLatest = i === family.length - 1;

        if (prompt.version !== newVersion || prompt.isLatest !== (isLatest ? 1 : 0)) {
          await this.db.prompts.update(prompt.id, {
            version: newVersion,
            isLatest: isLatest ? 1 : 0
          });
        }
      }
    }

    return true;
  }
}

describe('Version Management', () => {
  let mockDb;
  let versionManager;

  beforeEach(() => {
    // Setup fresh mock database before each test
    mockDb = new MockDb();
    versionManager = new SimpleVersionManager(mockDb);

    // Add test prompts
    // Family 1: Prompts with versions
    mockDb.addPrompt({
      id: 1,
      title: 'Test Prompt 1',
      description: 'Test description 1',
      text: 'Test prompt text 1',
      version: 1,
      isLatest: 0, // Not latest anymore
      parentId: null,
      createdAt: new Date('2023-01-01'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 2,
      title: 'Test Prompt 1 v2',
      description: 'Test description 1 updated',
      text: 'Test prompt text 1 updated',
      version: 2,
      isLatest: 0, // Not latest anymore
      parentId: 1,
      createdAt: new Date('2023-01-02'),
      lastUsedAt: null,
      timesUsed: 0
    });

    mockDb.addPrompt({
      id: 3,
      title: 'Test Prompt 1 v3',
      description: 'Test description 1 updated again',
      text: 'Test prompt text 1 updated again',
      version: 3,
      isLatest: 1, // Latest version
      parentId: 1,
      createdAt: new Date('2023-01-03'),
      lastUsedAt: null,
      timesUsed: 0
    });

    // Family 2: Single prompt without versions
    mockDb.addPrompt({
      id: 4,
      title: 'Test Prompt 2',
      description: 'Test description 2',
      text: 'Test prompt text 2',
      version: 1,
      isLatest: 1,
      parentId: null,
      createdAt: new Date('2023-01-04'),
      lastUsedAt: null,
      timesUsed: 0
    });
  });

  describe('getVersions', () => {
    test('should get all versions of a prompt', async () => {
      const parentId = 1;

      // Get all versions (rows whose parentId matches or id matches parentId)
      const versions = await mockDb.prompts.where('parentId').equals(parentId).or('id').equals(parentId).toArray();

      expect(versions.length).toBe(3);
      expect(versions[0].id).toBe(1);
      expect(versions[1].id).toBe(2);
      expect(versions[2].id).toBe(3);
    });

    test('should get the latest version of a prompt', async () => {
      const parentId = 1;

      // Get the latest version
      const latestVersion = await mockDb.prompts.where('parentId').equals(parentId).or('id').equals(parentId).toArray()
        .then(versions => versions.find(v => v.isLatest === 1));

      expect(latestVersion).toBeTruthy();
      expect(latestVersion.id).toBe(3);
      expect(latestVersion.version).toBe(3);
      expect(latestVersion.isLatest).toBe(1);
    });

    test('should handle prompts without versions', async () => {
      const promptId = 4;

      // Get all versions
      const versions = await mockDb.prompts.where('parentId').equals(promptId).or('id').equals(promptId).toArray();

      expect(versions.length).toBe(1);
      expect(versions[0].id).toBe(4);
      expect(versions[0].version).toBe(1);
      expect(versions[0].isLatest).toBe(1);
    });
  });

  describe('resequenceVersionNumbers', () => {
    test('should resequence version numbers correctly', async () => {
      // Add a prompt with incorrect version number
      mockDb.addPrompt({
        id: 5,
        title: 'Test Prompt 1 v4',
        description: 'Test description 1 updated yet again',
        text: 'Test prompt text 1 updated yet again',
        version: 5, // Incorrect version number (should be 4)
        isLatest: 1,
        parentId: 1,
        createdAt: new Date('2023-01-04'),
        lastUsedAt: null,
        timesUsed: 0
      });

      // Update previous latest to not be latest
      await mockDb.prompts.update(3, { isLatest: 0 });

      // Resequence version numbers
      await versionManager.resequenceVersionNumbers();

      // Get all versions after resequencing
      const versions = await mockDb.prompts.where('parentId').equals(1).or('id').equals(1).toArray();

      // Sort by version number
      versions.sort((a, b) => a.version - b.version);

      // Verify version numbers are sequential
      expect(versions.length).toBe(4);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(3);
      expect(versions[3].version).toBe(4);

      // Verify only the last one is marked as latest
      expect(versions[0].isLatest).toBe(0);
      expect(versions[1].isLatest).toBe(0);
      expect(versions[2].isLatest).toBe(0);
      expect(versions[3].isLatest).toBe(1);
    });

    test('should handle out-of-order creation dates', async () => {
      // Add prompts with out-of-order creation dates
      mockDb.addPrompt({
        id: 5,
        title: 'Test Prompt 3 v1',
        description: 'Test description 3',
        text: 'Test prompt text 3',
        version: 1,
        isLatest: 0,
        parentId: null,
        createdAt: new Date('2023-02-01'),
        lastUsedAt: null,
        timesUsed: 0
      });

      mockDb.addPrompt({
        id: 6,
        title: 'Test Prompt 3 v2',
        description: 'Test description 3 updated',
        text: 'Test prompt text 3 updated',
        version: 3, // Incorrect version number
        isLatest: 0,
        parentId: 5,
        createdAt: new Date('2023-01-15'), // Earlier than the parent!
        lastUsedAt: null,
        timesUsed: 0
      });

      mockDb.addPrompt({
        id: 7,
        title: 'Test Prompt 3 v3',
        description: 'Test description 3 updated again',
        text: 'Test prompt text 3 updated again',
        version: 2, // Incorrect version number
        isLatest: 1,
        parentId: 5,
        createdAt: new Date('2023-02-15'),
        lastUsedAt: null,
        timesUsed: 0
      });

      // Resequence version numbers
      await versionManager.resequenceVersionNumbers();

      // Get all versions after resequencing
      const versions = await mockDb.prompts.where('parentId').equals(5).or('id').equals(5).toArray();

      // Sort by version number
      versions.sort((a, b) => a.version - b.version);

      // Verify version numbers are sequential and based on creation date
      expect(versions.length).toBe(3);

      // The versions should be ordered by creation date
      expect(versions[0].id).toBe(6); // 2023-01-15 (earliest)
      expect(versions[0].version).toBe(1);

      expect(versions[1].id).toBe(5); // 2023-02-01 (middle)
      expect(versions[1].version).toBe(2);

      expect(versions[2].id).toBe(7); // 2023-02-15 (latest)
      expect(versions[2].version).toBe(3);

      // Verify only the last one is marked as latest
      expect(versions[0].isLatest).toBe(0);
      expect(versions[1].isLatest).toBe(0);
      expect(versions[2].isLatest).toBe(1);
    });

    test('should not modify single-version prompts', async () => {
      const promptId = 4;
      const originalPrompt = await mockDb.prompts.get(promptId);

      // Resequence version numbers
      await versionManager.resequenceVersionNumbers();

      // Get the prompt after resequencing
      const updatedPrompt = await mockDb.prompts.get(promptId);

      // Verify the prompt was not modified
      expect(updatedPrompt.version).toBe(originalPrompt.version);
      expect(updatedPrompt.isLatest).toBe(originalPrompt.isLatest);
    });
  });
});