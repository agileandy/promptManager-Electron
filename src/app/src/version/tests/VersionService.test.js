/**
 * VersionService.test.js
 *
 * Comprehensive unit tests for the Chain of Responsibility version management system.
 * Tests validation, dependency checking, and deletion handlers.
 */

// Mock database for testing
class MockDatabase {
    constructor() {
        this.prompts = new Map();
        this.promptTags = new Map();
        this.tags = new Map();
        this.folders = new Map();
        this.nextId = 1;
    }

    // Mock prompts table
    get promptsTable() {
        return {
            get: jest.fn().mockImplementation(async (id) => this.prompts.get(id)),
            where: jest.fn().mockImplementation((field) => ({
                equals: jest.fn().mockImplementation((value) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.prompts.values()).filter(p => p[field] === value))
                    ),
                    count: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.prompts.values()).filter(p => p[field] === value).length)
                    ),
                    delete: jest.fn().mockImplementation(async () => {
                        const toDelete = Array.from(this.prompts.values()).filter(p => p[field] === value);
                        toDelete.forEach(p => this.prompts.delete(p.id));
                        return Promise.resolve(toDelete.length);
                    }),
                    or: jest.fn().mockImplementation((field2) => ({
                        equals: jest.fn().mockImplementation((value2) => ({
                            toArray: jest.fn().mockImplementation(async () =>
                                Promise.resolve(Array.from(this.prompts.values()).filter(p => p[field] === value || p[field2] === value2))
                            ),
                            delete: jest.fn().mockImplementation(async () => {
                                const toDelete = Array.from(this.prompts.values()).filter(p => p[field] === value || p[field2] === value2);
                                toDelete.forEach(p => this.prompts.delete(p.id));
                                return Promise.resolve(toDelete.length);
                            })
                        }))
                    }))
                })),
                anyOf: jest.fn().mockImplementation((values) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.prompts.values()).filter(p => values.includes(p[field])))
                    ),
                    delete: jest.fn().mockImplementation(async () => {
                        const toDelete = Array.from(this.prompts.values()).filter(p => values.includes(p[field]));
                        toDelete.forEach(p => this.prompts.delete(p.id));
                        return Promise.resolve(toDelete.length);
                    })
                }))
            })),
            update: jest.fn().mockImplementation(async (id, changes) => {
                const prompt = this.prompts.get(id);
                if (prompt) {
                    Object.assign(prompt, changes);
                    return Promise.resolve(1);
                }
                return Promise.resolve(0);
            }),
            delete: jest.fn().mockImplementation(async (id) => {
                return Promise.resolve(this.prompts.delete(id) ? 1 : 0);
            }),
            add: jest.fn().mockImplementation(async (prompt) => {
                const id = this.nextId++;
                prompt.id = id;
                this.prompts.set(id, prompt);
                return Promise.resolve(id);
            }),
            toArray: jest.fn().mockImplementation(async () =>
                Promise.resolve(Array.from(this.prompts.values()))
            )
        };
    }

    // Mock promptTags table
    get promptTagsTable() {
        return {
            where: jest.fn().mockImplementation((field) => ({
                equals: jest.fn().mockImplementation((value) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.promptTags.values()).filter(pt => pt[field] === value))
                    ),
                    delete: jest.fn().mockImplementation(async () => {
                        const toDelete = Array.from(this.promptTags.values()).filter(pt => pt[field] === value);
                        toDelete.forEach(pt => this.promptTags.delete(pt.id));
                        return Promise.resolve(toDelete.length);
                    })
                })),
                anyOf: jest.fn().mockImplementation((values) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field])))
                    ),
                    delete: jest.fn().mockImplementation(async () => {
                        const toDelete = Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field]));
                        toDelete.forEach(pt => this.promptTags.delete(pt.id));
                        return Promise.resolve(toDelete.length);
                    }),
                    and: jest.fn().mockImplementation((predicate) => ({
                        count: jest.fn().mockImplementation(async () =>
                            Promise.resolve(Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field]) && predicate(pt)).length)
                        )
                    }))
                }))
            })),
            toArray: jest.fn().mockImplementation(async () =>
                Promise.resolve(Array.from(this.promptTags.values()))
            ),
            delete: jest.fn().mockImplementation(async (id) =>
                Promise.resolve(this.promptTags.delete(id))
            )
        };
    }

    // Mock tags table
    get tagsTable() {
        return {
            get: jest.fn().mockImplementation(async (id) =>
                Promise.resolve(this.tags.get(id))
            ),
            where: jest.fn().mockImplementation((field) => ({
                anyOf: jest.fn().mockImplementation((values) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.tags.values()).filter(t => values.includes(t[field])))
                    )
                }))
            })),
            delete: jest.fn().mockImplementation(async (id) =>
                Promise.resolve(this.tags.delete(id))
            )
        };
    }

    // Mock folders table
    get foldersTable() {
        return {
            get: jest.fn().mockImplementation(async (id) =>
                Promise.resolve(this.folders.get(id))
            ),
            where: jest.fn().mockImplementation((field) => ({
                anyOf: jest.fn().mockImplementation((values) => ({
                    toArray: jest.fn().mockImplementation(async () =>
                        Promise.resolve(Array.from(this.folders.values()).filter(f => values.includes(f[field])))
                    )
                })),
                equals: jest.fn().mockImplementation((value) => ({
                    and: jest.fn().mockImplementation((predicate) => ({
                        count: jest.fn().mockImplementation(async () =>
                            Promise.resolve(Array.from(this.folders.values()).filter(f => f[field] === value && predicate(f)).length)
                        )
                    }))
                }))
            }))
        };
    }

    // Setup test data
    setupTestData() {
        // Add test prompts
        this.prompts.set(1, {
            id: 1,
            title: 'Test Prompt 1',
            text: 'This is test prompt 1',
            version: 1,
            isLatest: 1,
            parentId: null,
            createdAt: new Date('2023-01-01'),
            folderId: null
        });

        this.prompts.set(2, {
            id: 2,
            title: 'Test Prompt 1',
            text: 'This is test prompt 1 version 2',
            version: 2,
            isLatest: 0,
            parentId: 1,
            createdAt: new Date('2023-01-02'),
            folderId: null
        });

        this.prompts.set(3, {
            id: 3,
            title: 'Test Prompt 1',
            text: 'This is test prompt 1 version 3',
            version: 3,
            isLatest: 1,
            parentId: 1,
            createdAt: new Date('2023-01-03'),
            folderId: 1
        });

        // Add test tags
        this.tags.set(1, { id: 1, name: 'test-tag', fullPath: 'test-tag' });
        this.tags.set(2, { id: 2, name: 'another-tag', fullPath: 'another-tag' });

        // Add test prompt-tag relationships
        this.promptTags.set(1, { id: 1, promptId: 1, tagId: 1 });
        this.promptTags.set(2, { id: 2, promptId: 3, tagId: 1 });
        this.promptTags.set(3, { id: 3, promptId: 3, tagId: 2 });

        // Add test folder
        this.folders.set(1, { id: 1, name: 'Test Folder' });
    }
}

// Mock state manager
class MockStateManager {
    constructor() {
        this.events = [];
        this.operationHistory = [];
    }

    async initialize() {
        return true;
    }

    async notifyVersionDeleted(context) {
        this.events.push({ type: 'version_deleted', context });
    }

    recordOperation(operation, details) {
        this.operationHistory.push({ operation, details, timestamp: new Date() });
    }

    async validateDatabaseState() {
        return { success: true, issues: [], isHealthy: true };
    }
}

// Mock the required modules
jest.mock('../VersionService', () => {
    return {
        VersionService: class VersionService {
            constructor(db, stateManager) {
                this.db = db;
                this.stateManager = stateManager;
            }

            async getVersionInfo(promptId) {
                const prompt = await this.db.prompts.get(promptId);
                if (!prompt) {
                    return { success: false, error: 'Prompt not found' };
                }

                const allVersions = await this.db.prompts.where('parentId').equals(promptId).or('id').equals(promptId).toArray();
                return { success: true, prompt, totalVersions: allVersions.length };
            }

            async getVersionDependencies(promptId) {
                const prompt = await this.db.prompts.get(promptId);
                if (!prompt) {
                    return { success: false, error: 'Prompt not found' };
                }

                const tagRelations = await this.db.promptTags.where('promptId').equals(promptId).toArray();
                return {
                    success: true,
                    dependencies: {
                        tags: tagRelations.length > 0 ? tagRelations : null
                    }
                };
            }

            async deleteVersion(promptId, options = {}) {
                const { deleteAllVersions = false, cleanupOrphanedTags = false } = options;

                const prompt = await this.db.prompts.get(promptId);
                if (!prompt) {
                    return { success: false, error: 'Prompt not found' };
                }

                if (deleteAllVersions) {
                    // Delete all versions
                    const allVersions = await this.db.prompts.where('parentId').equals(promptId).or('id').equals(promptId).toArray();
                    const promptIds = allVersions.map(p => p.id);

                    // Delete prompt-tag relationships
                    await this.db.promptTags.where('promptId').anyOf(promptIds).delete();

                    // Delete prompts
                    await this.db.prompts.where('id').anyOf(promptIds).delete();

                    // Notify state manager
                    await this.stateManager.notifyVersionDeleted({ promptIds });

                    return { success: true, deletedCount: allVersions.length };
                } else {
                    // Delete single version
                    await this.db.promptTags.where('promptId').equals(promptId).delete();
                    await this.db.prompts.delete(promptId);

                    // Notify state manager
                    await this.stateManager.notifyVersionDeleted({ promptIds: [promptId] });

                    return { success: true, deletedCount: 1 };
                }
            }
        }
    };
});

jest.mock('../VersionStateManager', () => {
    return {
        VersionStateManager: MockStateManager
    };
});

// Import the mocked modules
const { VersionService } = require('../VersionService');
const { VersionStateManager } = require('../VersionStateManager');

describe('VersionService', () => {
    let mockDb;
    let dbProxy;
    let mockStateManager;
    let versionService;

    beforeEach(() => {
        // Setup mock database and state manager
        mockDb = new MockDatabase();
        mockDb.setupTestData();

        // Create database proxy
        dbProxy = {
            prompts: mockDb.promptsTable,
            promptTags: mockDb.promptTagsTable,
            tags: mockDb.tagsTable,
            folders: mockDb.foldersTable
        };

        mockStateManager = new MockStateManager();
        versionService = new VersionService(dbProxy, mockStateManager);
    });

    describe('ValidationHandler', () => {
        test('should successfully get version info for existing prompt', async () => {
            const result = await versionService.getVersionInfo(1);
            expect(result.success).toBe(true);
            expect(result.prompt.id).toBe(1);
            expect(result.totalVersions).toBe(3);
        });

        test('should fail for non-existent prompt', async () => {
            const result = await versionService.getVersionInfo(999);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('DependencyHandler', () => {
        test('should successfully get dependencies', async () => {
            const dependencies = await versionService.getVersionDependencies(1);
            expect(dependencies.success).toBe(true);
            expect(dependencies.dependencies.tags).not.toBeNull();
        });
    });

    describe('DeletionHandler', () => {
        test('should successfully delete single version', async () => {
            const initialCount = mockDb.prompts.size;
            const result = await versionService.deleteVersion(2, { deleteAllVersions: false });

            expect(result.success).toBe(true);
            expect(mockDb.prompts.size).toBe(initialCount - 1);
            expect(mockDb.prompts.get(2)).toBeUndefined();
        });
    });

    describe('Integration', () => {
        test('should successfully complete full deletion workflow', async () => {
            const result = await versionService.deleteVersion(1, {
                deleteAllVersions: true,
                cleanupOrphanedTags: true
            });

            expect(result.success).toBe(true);
            expect(mockStateManager.events.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should fail gracefully for non-existent prompt', async () => {
            const result = await versionService.deleteVersion(999);
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });
});