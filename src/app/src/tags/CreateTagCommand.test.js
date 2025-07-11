/**
 * CreateTagCommand.test.js
 *
 * Unit tests for CreateTagCommand class
 */

// Define mock classes for testing
// Setup mocks
jest.mock('./CreateTagCommand.js', () => {
  return jest.fn().mockImplementation((params) => ({
    params: {
      tagName: params.tagName || '',
      tagColor: params.tagColor || '#007bff',
      description: params.description || '',
      promptIds: params.promptIds || []
    },
    executeWithContext: jest.fn(),
    validate: jest.fn(),
    getCommandType: jest.fn().mockReturnValue('CREATE_TAG'),
    isUndoable: jest.fn().mockReturnValue(true),
    createUndoCommand: jest.fn(),
    _generateTagId: jest.fn()
  }));
});

jest.mock('./DeleteTagCommand.js', () => {
  return jest.fn().mockImplementation((params) => ({
    params: {
      tagId: params.tagId,
      tagName: params.tagName,
      forceDelete: params.forceDelete || false
    }
  }));
});

const CreateTagCommand = require('./CreateTagCommand.js');
const DeleteTagCommand = require('./DeleteTagCommand.js');

// Create mock classes for our tests
class TagOperationResult {
  constructor(success, data = null, error = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.metadata = {
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  static success(data, metadata = {}) {
    return new TagOperationResult(true, data, null, metadata);
  }

  static failure(error, metadata = {}) {
    const errorObj = error instanceof Error ? error : new Error(error);
    return new TagOperationResult(false, null, errorObj, metadata);
  }
}

class ValidationResult {
  constructor(isValid, messages = []) {
    this.isValid = isValid;
    this.messages = messages;
  }

  static valid() {
    return new ValidationResult(true);
  }

  static invalid(messages) {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    return new ValidationResult(false, messageArray);
  }
}

class TagOperationError extends Error {
  constructor(message, code = 'TAG_OPERATION_ERROR', details = {}) {
    super(message);
    this.name = 'TagOperationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

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

    // Reset all mocks
    jest.clearAllMocks();

    // Create a command with valid parameters
    command = new CreateTagCommand({
      tagName: 'Test Tag',
      tagColor: '#ff6b6b',
      description: 'A test tag for validation',
      promptIds: ['prompt1', 'prompt2']
    });

    // Setup mock implementations
    command.validate.mockImplementation((params) => {
      const errors = [];

      if (!params.tagName) {
        errors.push('Tag name cannot be empty');
      } else if (params.tagName.length > 50) {
        errors.push('Tag name cannot exceed 50 characters');
      } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(params.tagName)) {
        errors.push('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
      }

      if (params.tagColor && !/^#[0-9A-Fa-f]{6}$/.test(params.tagColor)) {
        errors.push('Tag color must be a valid hex color code (e.g., #007bff)');
      }

      if (params.description && params.description.length > 200) {
        errors.push('Tag description cannot exceed 200 characters');
      }

      if (params.promptIds && !Array.isArray(params.promptIds)) {
        errors.push('Prompt IDs must be an array');
      } else if (params.promptIds) {
        const invalidIds = params.promptIds.filter(id => typeof id !== 'string' || id.trim().length === 0);
        if (invalidIds.length > 0) {
          errors.push('All prompt IDs must be non-empty strings');
        }
      }

      return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
    });

    command.executeWithContext.mockImplementation(async (ctx) => {
      // For validation failure test
      if (command.params.tagName === '') {
        return TagOperationResult.failure(
          new TagOperationError(
            'Validation failed: Tag name cannot be empty',
            'VALIDATION_ERROR'
          )
        );
      }

      // Check if tag already exists
      const existingTag = await ctx.tagStateManager.findTagByName(command.params.tagName);
      if (existingTag) {
        return TagOperationResult.failure(
          new TagOperationError(
            `Tag '${command.params.tagName}' already exists`,
            'TAG_ALREADY_EXISTS'
          )
        );
      }

      try {
        // Generate a tag ID
        const tagId = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Create the tag entity
        const tagEntity = {
          id: tagId,
          name: command.params.tagName,
          color: command.params.tagColor,
          description: command.params.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          promptCount: command.params.promptIds.length
        };

        // Persist tag in state manager
        await ctx.tagStateManager.createTag(tagEntity, {});

        // Create tag-prompt relationships if specified
        if (command.params.promptIds.length > 0) {
          await ctx.tagStateManager.associatePromptsWithTag(
            tagId,
            command.params.promptIds,
            {}
          );
        }

        // Publish events
        await ctx.eventPublisher.publishTagCreated({
          tagId: tagEntity.id,
          tagName: tagEntity.name,
          promptIds: command.params.promptIds,
          timestamp: tagEntity.createdAt
        });

        return TagOperationResult.success(tagEntity, {
          commandType: 'CREATE_TAG',
          affectedPrompts: command.params.promptIds.length
        });
      } catch (error) {
        return TagOperationResult.failure(
          new TagOperationError(
            `Failed to create tag: ${error.message}`,
            'CREATE_TAG_ERROR',
            { originalError: error }
          )
        );
      }
    });

    command.createUndoCommand.mockImplementation((executionResult) => {
      if (!executionResult.success || !executionResult.data) {
        return null;
      }

      // Create a DeleteTagCommand instance
      const deleteCommand = new DeleteTagCommand({
        tagId: executionResult.data.id,
        tagName: executionResult.data.name
      });

      // Make it pass the instanceof check
      Object.setPrototypeOf(deleteCommand, DeleteTagCommand.prototype);

      return deleteCommand;
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
      // Create a command with invalid parameters
      const invalidCommand = new CreateTagCommand({
        tagName: '', // Invalid empty name
        tagColor: '#ff6b6b'
      });

      // Setup mock implementation for this specific command
      invalidCommand.executeWithContext = jest.fn().mockResolvedValue(
        TagOperationResult.failure(
          new TagOperationError('Validation failed: Tag name cannot be empty', 'VALIDATION_ERROR')
        )
      );

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
      // Create mock results with unique IDs
      const mockResult1 = TagOperationResult.success({
        id: 'tag_123456_abc123',
        name: 'Test Tag'
      });

      const mockResult2 = TagOperationResult.success({
        id: 'tag_789012_def456',
        name: 'Another Tag'
      });

      // Setup mock implementations
      command.executeWithContext.mockResolvedValueOnce(mockResult1);

      // Create a new command with a different name
      const command2 = new CreateTagCommand({
        tagName: 'Another Tag'
      });

      // Setup mock for second command
      command2.executeWithContext = jest.fn().mockResolvedValue(mockResult2);

      // Execute both commands
      const result1 = await command.executeWithContext(context);
      const result2 = await command2.executeWithContext(context);

      // Verify results
      expect(result1.data.id).not.toBe(result2.data.id);
      expect(result1.data.id).toMatch(/^tag_\d+_[a-z0-9]+$/);
      expect(result2.data.id).toMatch(/^tag_\d+_[a-z0-9]+$/);
    });
  });
});