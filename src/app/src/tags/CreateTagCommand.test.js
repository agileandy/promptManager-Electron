/**
 * CreateTagCommand.test.js
 *
 * Unit tests for CreateTagCommand class
 */

import { TagOperationResult, ValidationResult, TagOperationError } from './TagCommandInterface.js';
import CreateTagCommand from './CreateTagCommand.js';
import DeleteTagCommand from './DeleteTagCommand.js';

// Mock dependencies
class MockTagStateManager {
  constructor() {
    this.tags = new Map();
    this.tagPromptRelations = new Map();
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

  async associatePromptsWithTag(tagId, promptIds, transaction) {
    this.tagPromptRelations.set(tagId, promptIds);
    return true;
  }
}

class MockEventPublisher {
  constructor() {
    this.publishedEvents = [];
  }

  async publishTagCreated(event) {
    this.publishedEvents.push({ type: 'TAG_CREATED', ...event });
    return true;
  }
}

class MockTransactionManager {
  async executeTransaction(callback) {
    const transaction = { id: Date.now() };
    return await callback(transaction);
  }
}

describe('CreateTagCommand', () => {
  let command;
  let context;
  let mockTagStateManager;
  let mockEventPublisher;
  let mockTransactionManager;

  beforeEach(() => {
    // Setup fresh mocks before each test
    mockTagStateManager = new MockTagStateManager();
    mockEventPublisher = new MockEventPublisher();
    mockTransactionManager = new MockTransactionManager();

    context = {
      tagStateManager: mockTagStateManager,
      eventPublisher: mockEventPublisher,
      transactionManager: mockTransactionManager
    };

    // Create a command with valid parameters
    command = new CreateTagCommand({
      tagName: 'Test Tag',
      tagColor: '#ff6b6b',
      description: 'A test tag for validation',
      promptIds: ['prompt1', 'prompt2']
    });
  });

  describe('constructor', () => {
    test('should initialize with provided parameters', () => {
      expect(command.params.tagName).toBe('Test Tag');
      expect(command.params.tagColor).toBe('#ff6b6b');
      expect(command.params.description).toBe('A test tag for validation');
      expect(command.params.promptIds).toEqual(['prompt1', 'prompt2']);
    });

    test('should use default values for optional parameters', () => {
      const minimalCommand = new CreateTagCommand({
        tagName: 'Minimal Tag'
      });

      expect(minimalCommand.params.tagName).toBe('Minimal Tag');
      expect(minimalCommand.params.tagColor).toBe('#007bff'); // Default color
      expect(minimalCommand.params.description).toBe(''); // Default empty description
      expect(minimalCommand.params.promptIds).toEqual([]); // Default empty array
    });
  });

  describe('validate', () => {
    test('should validate valid parameters', () => {
      const result = command.validate(command.params);
      expect(result.isValid).toBe(true);
      expect(result.messages).toEqual([]);
    });

    test('should reject empty tag name', () => {
      const result = command.validate({ ...command.params, tagName: '' });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Tag name cannot be empty');
    });

    test('should reject tag name that is too long', () => {
      const longName = 'A'.repeat(51);
      const result = command.validate({ ...command.params, tagName: longName });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Tag name cannot exceed 50 characters');
    });

    test('should reject tag name with invalid characters', () => {
      const result = command.validate({ ...command.params, tagName: 'Invalid@Tag#Name' });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
    });

    test('should reject invalid color format', () => {
      const result = command.validate({ ...command.params, tagColor: 'not-a-color' });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Tag color must be a valid hex color code (e.g., #007bff)');
    });

    test('should reject description that is too long', () => {
      const longDesc = 'A'.repeat(201);
      const result = command.validate({ ...command.params, description: longDesc });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Tag description cannot exceed 200 characters');
    });

    test('should reject non-array promptIds', () => {
      const result = command.validate({ ...command.params, promptIds: 'not-an-array' });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('Prompt IDs must be an array');
    });

    test('should reject invalid promptIds', () => {
      const result = command.validate({ ...command.params, promptIds: ['valid', ''] });
      expect(result.isValid).toBe(false);
      expect(result.messages).toContain('All prompt IDs must be non-empty strings');
    });
  });

  describe('executeWithContext', () => {
    test('should successfully create a tag', async () => {
      const result = await command.executeWithContext(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.name).toBe('Test Tag');
      expect(result.data.color).toBe('#ff6b6b');
      expect(result.data.description).toBe('A test tag for validation');

      // Verify tag was created in state manager
      const createdTag = await mockTagStateManager.findTagByName('Test Tag');
      expect(createdTag).toBeTruthy();

      // Verify prompt associations were created
      expect(mockTagStateManager.tagPromptRelations.get(createdTag.id)).toEqual(['prompt1', 'prompt2']);

      // Verify event was published
      expect(mockEventPublisher.publishedEvents.length).toBe(1);
      expect(mockEventPublisher.publishedEvents[0].type).toBe('TAG_CREATED');
      expect(mockEventPublisher.publishedEvents[0].tagName).toBe('Test Tag');
    });

    test('should fail if validation fails', async () => {
      const invalidCommand = new CreateTagCommand({
        tagName: '', // Invalid empty name
        tagColor: '#ff6b6b'
      });

      const result = await invalidCommand.executeWithContext(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TagOperationError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    test('should fail if tag already exists', async () => {
      // Add existing tag
      mockTagStateManager.tags.set('existing', {
        id: 'existing',
        name: 'Test Tag', // Same name as our command
        color: '#000000'
      });

      const result = await command.executeWithContext(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TagOperationError);
      expect(result.error.code).toBe('TAG_ALREADY_EXISTS');
    });

    test('should handle errors during execution', async () => {
      // Mock an error in createTag
      mockTagStateManager.createTag = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await command.executeWithContext(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TagOperationError);
      expect(result.error.code).toBe('CREATE_TAG_ERROR');
    });
  });

  describe('getCommandType', () => {
    test('should return correct command type', () => {
      expect(command.getCommandType()).toBe('CREATE_TAG');
    });
  });

  describe('isUndoable', () => {
    test('should be undoable', () => {
      expect(command.isUndoable()).toBe(true);
    });
  });

  describe('createUndoCommand', () => {
    test('should create a DeleteTagCommand for undo', async () => {
      // First execute the command to get a result
      const result = await command.executeWithContext(context);

      // Then create an undo command
      const undoCommand = command.createUndoCommand(result);

      expect(undoCommand).toBeInstanceOf(DeleteTagCommand);
      expect(undoCommand.params.tagId).toBe(result.data.id);
      expect(undoCommand.params.tagName).toBe('Test Tag');
    });

    test('should return null for failed execution', () => {
      const failedResult = TagOperationResult.failure(new Error('Failed'));
      const undoCommand = command.createUndoCommand(failedResult);

      expect(undoCommand).toBeNull();
    });
  });

  describe('_generateTagId', () => {
    test('should generate a unique tag ID', async () => {
      // We can test this indirectly through executeWithContext
      const result1 = await command.executeWithContext(context);

      // Create a new command with a different name
      const command2 = new CreateTagCommand({
        tagName: 'Another Tag'
      });
      const result2 = await command2.executeWithContext(context);

      expect(result1.data.id).not.toBe(result2.data.id);
      expect(result1.data.id).toMatch(/^tag_\d+_[a-z0-9]+$/);
      expect(result2.data.id).toMatch(/^tag_\d+_[a-z0-9]+$/);
    });
  });
});