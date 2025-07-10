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
            get: async (id) => this.prompts.get(id),
            where: (field) => ({
                equals: (value) => ({
                    toArray: async () => Array.from(this.prompts.values()).filter(p => p[field] === value),
                    count: async () => Array.from(this.prompts.values()).filter(p => p[field] === value).length,
                    delete: async () => {
                        const toDelete = Array.from(this.prompts.values()).filter(p => p[field] === value);
                        toDelete.forEach(p => this.prompts.delete(p.id));
                        return toDelete.length;
                    },
                    or: (field2) => ({
                        equals: (value2) => ({
                            toArray: async () => Array.from(this.prompts.values()).filter(p => p[field] === value || p[field2] === value2),
                            delete: async () => {
                                const toDelete = Array.from(this.prompts.values()).filter(p => p[field] === value || p[field2] === value2);
                                toDelete.forEach(p => this.prompts.delete(p.id));
                                return toDelete.length;
                            }
                        })
                    })
                }),
                anyOf: (values) => ({
                    toArray: async () => Array.from(this.prompts.values()).filter(p => values.includes(p[field])),
                    delete: async () => {
                        const toDelete = Array.from(this.prompts.values()).filter(p => values.includes(p[field]));
                        toDelete.forEach(p => this.prompts.delete(p.id));
                        return toDelete.length;
                    }
                })
            }),
            update: async (id, changes) => {
                const prompt = this.prompts.get(id);
                if (prompt) {
                    Object.assign(prompt, changes);
                    return 1;
                }
                return 0;
            },
            delete: async (id) => {
                return this.prompts.delete(id) ? 1 : 0;
            },
            add: async (prompt) => {
                const id = this.nextId++;
                prompt.id = id;
                this.prompts.set(id, prompt);
                return id;
            },
            toArray: async () => Array.from(this.prompts.values())
        };
    }

    // Mock promptTags table
    get promptTagsTable() {
        return {
            where: (field) => ({
                equals: (value) => ({
                    toArray: async () => Array.from(this.promptTags.values()).filter(pt => pt[field] === value),
                    delete: async () => {
                        const toDelete = Array.from(this.promptTags.values()).filter(pt => pt[field] === value);
                        toDelete.forEach(pt => this.promptTags.delete(pt.id));
                        return toDelete.length;
                    }
                }),
                anyOf: (values) => ({
                    toArray: async () => Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field])),
                    delete: async () => {
                        const toDelete = Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field]));
                        toDelete.forEach(pt => this.promptTags.delete(pt.id));
                        return toDelete.length;
                    },
                    and: (predicate) => ({
                        count: async () => Array.from(this.promptTags.values()).filter(pt => values.includes(pt[field]) && predicate(pt)).length
                    })
                })
            }),
            toArray: async () => Array.from(this.promptTags.values()),
            delete: async (id) => this.promptTags.delete(id)
        };
    }

    // Mock tags table
    get tagsTable() {
        return {
            get: async (id) => this.tags.get(id),
            where: (field) => ({
                anyOf: (values) => ({
                    toArray: async () => Array.from(this.tags.values()).filter(t => values.includes(t[field]))
                })
            }),
            delete: async (id) => this.tags.delete(id)
        };
    }

    // Mock folders table
    get foldersTable() {
        return {
            get: async (id) => this.folders.get(id),
            where: (field) => ({
                anyOf: (values) => ({
                    toArray: async () => Array.from(this.folders.values()).filter(f => values.includes(f[field]))
                }),
                equals: (value) => ({
                    and: (predicate) => ({
                        count: async () => Array.from(this.folders.values()).filter(f => f[field] === value && predicate(f)).length
                    })
                })
            })
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

// Test suite
class VersionServiceTests {
    constructor() {
        this.testResults = [];
        this.mockDb = null;
        this.mockStateManager = null;
        this.versionService = null;
    }

    async runAllTests() {
        console.log('Starting Version Service Tests...');

        // Setup tests
        await this.setupTest();

        // Run individual tests
        await this.testValidationHandler();
        await this.testDependencyHandler();
        await this.testDeletionHandler();
        await this.testVersionServiceIntegration();
        await this.testErrorHandling();

        // Report results
        this.reportResults();

        return this.testResults;
    }

    async setupTest() {
        // Import the classes (in a real environment, these would be proper imports)
        const { VersionService } = require('../VersionService');
        const { VersionStateManager } = require('../VersionStateManager');

        // Setup mock database and state manager
        this.mockDb = new MockDatabase();
        this.mockDb.setupTestData();

        // Create database proxy
        this.dbProxy = {
            prompts: this.mockDb.promptsTable,
            promptTags: this.mockDb.promptTagsTable,
            tags: this.mockDb.tagsTable,
            folders: this.mockDb.foldersTable
        };

        this.mockStateManager = new MockStateManager();
        await this.mockStateManager.initialize();

        // Create version service
        this.versionService = new VersionService(this.dbProxy, this.mockStateManager);
    }

    async testValidationHandler() {
        console.log('Testing ValidationHandler...');

        try {
            // Test 1: Valid prompt deletion
            const result1 = await this.versionService.getVersionInfo(1);
            this.assert(result1.success, 'Should successfully get version info for existing prompt');
            this.assert(result1.prompt.id === 1, 'Should return correct prompt');
            this.assert(result1.totalVersions === 3, 'Should count all versions correctly');

            // Test 2: Non-existent prompt
            const result2 = await this.versionService.getVersionInfo(999);
            this.assert(!result2.success, 'Should fail for non-existent prompt');
            this.assert(result2.error.includes('not found'), 'Should have appropriate error message');

            console.log('✓ ValidationHandler tests passed');
        } catch (error) {
            console.error('✗ ValidationHandler tests failed:', error);
            this.testResults.push({ test: 'ValidationHandler', passed: false, error: error.message });
        }
    }

    async testDependencyHandler() {
        console.log('Testing DependencyHandler...');

        try {
            // Test dependency checking
            const dependencies = await this.versionService.getVersionDependencies(1);
            this.assert(dependencies.success, 'Should successfully get dependencies');

            // Check tag dependencies
            this.assert(dependencies.dependencies.tags !== null, 'Should have tag dependency information');

            console.log('✓ DependencyHandler tests passed');
        } catch (error) {
            console.error('✗ DependencyHandler tests failed:', error);
            this.testResults.push({ test: 'DependencyHandler', passed: false, error: error.message });
        }
    }

    async testDeletionHandler() {
        console.log('Testing DeletionHandler...');

        try {
            // Test single version deletion
            const initialCount = this.mockDb.prompts.size;

            const result = await this.versionService.deleteVersion(2, { deleteAllVersions: false });
            this.assert(result.success, 'Should successfully delete single version');

            const finalCount = this.mockDb.prompts.size;
            this.assert(finalCount === initialCount - 1, 'Should delete exactly one version');

            // Verify the correct version was deleted
            const deletedPrompt = this.mockDb.prompts.get(2);
            this.assert(!deletedPrompt, 'Deleted prompt should no longer exist');

            console.log('✓ DeletionHandler tests passed');
        } catch (error) {
            console.error('✗ DeletionHandler tests failed:', error);
            this.testResults.push({ test: 'DeletionHandler', passed: false, error: error.message });
        }
    }

    async testVersionServiceIntegration() {
        console.log('Testing VersionService integration...');

        try {
            // Test full deletion workflow
            const result = await this.versionService.deleteVersion(1, {
                deleteAllVersions: true,
                cleanupOrphanedTags: true
            });

            this.assert(result.success, 'Should successfully complete full deletion workflow');

            // Verify state manager was notified
            this.assert(this.mockStateManager.events.length > 0, 'Should notify state manager of deletion');

            console.log('✓ VersionService integration tests passed');
        } catch (error) {
            console.error('✗ VersionService integration tests failed:', error);
            this.testResults.push({ test: 'VersionService Integration', passed: false, error: error.message });
        }
    }

    async testErrorHandling() {
        console.log('Testing error handling...');

        try {
            // Test deletion of non-existent prompt
            const result = await this.versionService.deleteVersion(999);
            this.assert(!result.success, 'Should fail gracefully for non-existent prompt');
            this.assert(result.error, 'Should provide error message');

            console.log('✓ Error handling tests passed');
        } catch (error) {
            console.error('✗ Error handling tests failed:', error);
            this.testResults.push({ test: 'Error Handling', passed: false, error: error.message });
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    reportResults() {
        console.log('\n=== Test Results ===');
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;

        if (total === 0) {
            console.log('✓ All tests passed successfully!');
        } else {
            console.log(`${passed}/${total} test suites passed`);

            this.testResults.forEach(result => {
                if (!result.passed) {
                    console.log(`✗ ${result.test}: ${result.error}`);
                }
            });
        }
    }
}

// Export for use in testing environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VersionServiceTests, MockDatabase, MockStateManager };
}

// Auto-run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
    const tests = new VersionServiceTests();
    tests.runAllTests().then(() => {
        console.log('Test execution completed');
    }).catch(error => {
        console.error('Test execution failed:', error);
    });
}