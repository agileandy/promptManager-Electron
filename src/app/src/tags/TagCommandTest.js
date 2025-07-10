/**
 * Tag Command System - Test Implementation
 *
 * Demonstrates the usage of the Tag Command Interface and validates
 * the implementation with mock dependencies.
 */

const {
    TagCommandInterface,
    TagOperationResult,
    ValidationResult,
    TagOperationError,
    CreateTagCommand,
    DeleteTagCommand,
    RenameTagCommand,
    TagCommandFactory,
    TagCommandExecutor
} = require('./index');

/**
 * Mock Tag State Manager
 *
 * Simulates the tag state management service for testing
 */
class MockTagStateManager {
    constructor() {
        this.tags = new Map();
        this.tagPromptRelations = new Map();
        this.prompts = new Map();
    }

    async findTagById(tagId) {
        return this.tags.get(tagId) || null;
    }

    async findTagByName(tagName) {
        for (const tag of this.tags.values()) {
            if (tag.name === tagName) {
                return tag;
            }
        }
        return null;
    }

    async createTag(tagEntity, transaction) {
        this.tags.set(tagEntity.id, tagEntity);
        return tagEntity;
    }

    async updateTag(tagId, updatedTag, transaction) {
        this.tags.set(tagId, updatedTag);
        return updatedTag;
    }

    async deleteTag(tagId, transaction) {
        this.tags.delete(tagId);
        this.tagPromptRelations.delete(tagId);
        return true;
    }

    async getPromptsForTag(tagId) {
        const promptIds = this.tagPromptRelations.get(tagId) || [];
        return promptIds.map(id => this.prompts.get(id)).filter(Boolean);
    }

    async associatePromptsWithTag(tagId, promptIds, transaction) {
        this.tagPromptRelations.set(tagId, promptIds);
        return true;
    }

    async removeAllTagAssociations(tagId, transaction) {
        this.tagPromptRelations.delete(tagId);
        return true;
    }

    async updatePromptTagReferences(promptId, updatedPrompt, transaction) {
        this.prompts.set(promptId, updatedPrompt);
        return true;
    }

    // Helper methods for testing
    addMockPrompt(id, title, content = '', tagReferences = []) {
        this.prompts.set(id, { id, title, content, tagReferences });
    }

    getAllTags() {
        return Array.from(this.tags.values());
    }
}

/**
 * Mock Event Publisher
 *
 * Simulates event publishing for UI synchronization
 */
class MockEventPublisher {
    constructor() {
        this.publishedEvents = [];
    }

    async publishTagCreated(event) {
        this.publishedEvents.push({ type: 'TAG_CREATED', ...event });
    }

    async publishTagDeleted(event) {
        this.publishedEvents.push({ type: 'TAG_DELETED', ...event });
    }

    async publishTagRenamed(event) {
        this.publishedEvents.push({ type: 'TAG_RENAMED', ...event });
    }

    getPublishedEvents() {
        return this.publishedEvents;
    }

    clearEvents() {
        this.publishedEvents = [];
    }
}

/**
 * Mock Transaction Manager
 *
 * Simulates database transaction management
 */
class MockTransactionManager {
    async executeTransaction(callback) {
        // Simulate transaction execution
        const transaction = { id: Date.now() };
        return await callback(transaction);
    }
}

/**
 * Test Runner
 *
 * Executes comprehensive tests for the tag command system
 */
class TagCommandTestRunner {
    constructor() {
        this.tagStateManager = new MockTagStateManager();
        this.eventPublisher = new MockEventPublisher();
        this.transactionManager = new MockTransactionManager();

        this.context = {
            tagStateManager: this.tagStateManager,
            eventPublisher: this.eventPublisher,
            transactionManager: this.transactionManager
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Tag Command System Tests...\n');

        try {
            await this.testCreateTagCommand();
            await this.testDeleteTagCommand();
            await this.testRenameTagCommand();
            await this.testCommandFactory();
            await this.testCommandExecutor();
            await this.testValidationErrors();
            await this.testUndoOperations();

            console.log('✅ All tests passed successfully!');
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            throw error;
        }
    }

    /**
     * Test CreateTagCommand
     */
    async testCreateTagCommand() {
        console.log('📝 Testing CreateTagCommand...');

        // Test successful tag creation
        const createCommand = new CreateTagCommand({
            tagName: 'Test Tag',
            tagColor: '#ff6b6b',
            description: 'A test tag for validation',
            promptIds: []
        });

        const result = await createCommand.executeWithContext(this.context);

        if (!result.success) {
            throw new Error(`Create command failed: ${result.error.message}`);
        }

        // Verify tag was created
        const createdTag = await this.tagStateManager.findTagByName('Test Tag');
        if (!createdTag) {
            throw new Error('Tag was not created in state manager');
        }

        // Verify event was published
        const events = this.eventPublisher.getPublishedEvents();
        if (!events.some(e => e.type === 'TAG_CREATED' && e.tagName === 'Test Tag')) {
            throw new Error('Tag creation event was not published');
        }

        console.log('  ✅ CreateTagCommand passed');
    }

    /**
     * Test DeleteTagCommand
     */
    async testDeleteTagCommand() {
        console.log('🗑️  Testing DeleteTagCommand...');

        // First create a tag to delete
        const tag = {
            id: 'tag_test_delete',
            name: 'Delete Me',
            color: '#ff0000',
            description: 'Tag to be deleted',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tagStateManager.tags.set(tag.id, tag);

        // Test deletion
        const deleteCommand = new DeleteTagCommand({
            tagId: tag.id,
            tagName: tag.name,
            forceDelete: false
        });

        const result = await deleteCommand.executeWithContext(this.context);

        if (!result.success) {
            throw new Error(`Delete command failed: ${result.error.message}`);
        }

        // Verify tag was deleted
        const deletedTag = await this.tagStateManager.findTagById(tag.id);
        if (deletedTag) {
            throw new Error('Tag was not deleted from state manager');
        }

        console.log('  ✅ DeleteTagCommand passed');
    }

    /**
     * Test RenameTagCommand
     */
    async testRenameTagCommand() {
        console.log('✏️  Testing RenameTagCommand...');

        // First create a tag to rename
        const tag = {
            id: 'tag_test_rename',
            name: 'Old Name',
            color: '#00ff00',
            description: 'Tag to be renamed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tagStateManager.tags.set(tag.id, tag);

        // Add a mock prompt with tag references
        this.tagStateManager.addMockPrompt('prompt_1', 'Test Prompt', 'Content with Old Name tag', ['Old Name']);

        // Test renaming
        const renameCommand = new RenameTagCommand({
            tagId: tag.id,
            currentName: 'Old Name',
            newName: 'New Name',
            updateReferences: true
        });

        const result = await renameCommand.executeWithContext(this.context);

        if (!result.success) {
            throw new Error(`Rename command failed: ${result.error.message}`);
        }

        // Verify tag was renamed
        const renamedTag = await this.tagStateManager.findTagById(tag.id);
        if (!renamedTag || renamedTag.name !== 'New Name') {
            throw new Error('Tag was not renamed correctly');
        }

        console.log('  ✅ RenameTagCommand passed');
    }

    /**
     * Test TagCommandFactory
     */
    async testCommandFactory() {
        console.log('🏭 Testing TagCommandFactory...');

        // Test command creation
        const createCmd = TagCommandFactory.createCommand('CREATE_TAG', { tagName: 'Factory Test' });
        if (!(createCmd instanceof CreateTagCommand)) {
            throw new Error('Factory did not create CreateTagCommand');
        }

        const deleteCmd = TagCommandFactory.createCommand('DELETE', { tagId: 'test' });
        if (!(deleteCmd instanceof DeleteTagCommand)) {
            throw new Error('Factory did not create DeleteTagCommand');
        }

        const renameCmd = TagCommandFactory.createCommand('RENAME_TAG', { tagId: 'test', newName: 'New' });
        if (!(renameCmd instanceof RenameTagCommand)) {
            throw new Error('Factory did not create RenameTagCommand');
        }

        // Test invalid command type
        try {
            TagCommandFactory.createCommand('INVALID_COMMAND', {});
            throw new Error('Factory should have thrown error for invalid command');
        } catch (error) {
            if (!(error instanceof TagOperationError)) {
                throw new Error('Factory should throw TagOperationError for invalid command');
            }
        }

        console.log('  ✅ TagCommandFactory passed');
    }

    /**
     * Test TagCommandExecutor
     */
    async testCommandExecutor() {
        console.log('⚡ Testing TagCommandExecutor...');

        const command = new CreateTagCommand({
            tagName: 'Executor Test',
            tagColor: '#800080'
        });

        const result = await TagCommandExecutor.execute(command, this.context);

        if (!result.success) {
            throw new Error(`Executor failed: ${result.error.message}`);
        }

        // Test invalid context
        const invalidResult = await TagCommandExecutor.execute(command, {});
        if (invalidResult.success) {
            throw new Error('Executor should fail with invalid context');
        }

        console.log('  ✅ TagCommandExecutor passed');
    }

    /**
     * Test validation errors
     */
    async testValidationErrors() {
        console.log('🔍 Testing validation errors...');

        // Test invalid tag name
        const invalidCommand = new CreateTagCommand({
            tagName: '', // Empty name should fail
            tagColor: '#invalid' // Invalid color should fail
        });

        const result = await invalidCommand.executeWithContext(this.context);
        if (result.success) {
            throw new Error('Command should fail validation with empty name');
        }

        if (result.error.code !== 'VALIDATION_ERROR') {
            throw new Error('Expected VALIDATION_ERROR code');
        }

        console.log('  ✅ Validation errors handled correctly');
    }

    /**
     * Test undo operations
     */
    async testUndoOperations() {
        console.log('↩️  Testing undo operations...');

        // Create a tag
        const createCommand = new CreateTagCommand({
            tagName: 'Undo Test',
            tagColor: '#123456'
        });

        const createResult = await createCommand.executeWithContext(this.context);
        if (!createResult.success) {
            throw new Error('Failed to create tag for undo test');
        }

        // Test undo capability
        if (!createCommand.isUndoable()) {
            throw new Error('CreateTagCommand should be undoable');
        }

        const undoCommand = createCommand.createUndoCommand(createResult);
        if (!(undoCommand instanceof DeleteTagCommand)) {
            throw new Error('Undo command should be DeleteTagCommand');
        }

        console.log('  ✅ Undo operations working correctly');
    }
}

/**
 * Main test execution
 */
async function runTests() {
    const testRunner = new TagCommandTestRunner();
    await testRunner.runAllTests();
}

// Export for external use
module.exports = {
    TagCommandTestRunner,
    MockTagStateManager,
    MockEventPublisher,
    MockTransactionManager,
    runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}