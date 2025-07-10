import { TagCommandInterface, TagOperationResult, ValidationResult, TagOperationError } from './TagCommandInterface.js';

/**
 * Create Tag Command
 *
 * Command implementation for creating new tags with state isolation.
 * Follows the Command Pattern as specified in ADR-001.
 */
class CreateTagCommand extends TagCommandInterface {
    /**
     * Initialize the create tag command
     *
     * @param {Object} params - Command parameters
     * @param {string} params.tagName - Name of the tag to create
     * @param {string} params.tagColor - Color for the tag (optional)
     * @param {string} params.description - Tag description (optional)
     * @param {Array<string>} params.promptIds - Initial prompt IDs to associate (optional)
     */
    constructor(params) {
        super();
        this.params = {
            tagName: params.tagName,
            tagColor: params.tagColor || '#007bff',
            description: params.description || '',
            promptIds: params.promptIds || []
        };
    }

    /**
     * Execute the create tag command with state isolation
     *
     * @param {Object} context - Execution context
     * @returns {Promise<TagOperationResult>}
     */
    async executeWithContext(context) {
        try {
            // Validate parameters before execution
            const validation = this.validate(this.params);
            if (!validation.isValid) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Validation failed: ${validation.messages.join(', ')}`,
                        'VALIDATION_ERROR'
                    )
                );
            }

            const { tagStateManager, eventPublisher, transactionManager } = context;

            // Check if tag already exists
            const existingTag = await tagStateManager.findTagByName(this.params.tagName);
            if (existingTag) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Tag '${this.params.tagName}' already exists`,
                        'TAG_ALREADY_EXISTS'
                    )
                );
            }

            // Execute within isolated transaction
            const result = await transactionManager.executeTransaction(async (transaction) => {
                // Create the tag entity
                const tagId = await this._generateTagId();
                const tagEntity = {
                    id: tagId,
                    name: this.params.tagName,
                    color: this.params.tagColor,
                    description: this.params.description,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    promptCount: this.params.promptIds.length
                };

                // Persist tag in isolated state
                await tagStateManager.createTag(tagEntity, transaction);

                // Create tag-prompt relationships if specified
                if (this.params.promptIds.length > 0) {
                    await tagStateManager.associatePromptsWithTag(
                        tagId,
                        this.params.promptIds,
                        transaction
                    );
                }

                return tagEntity;
            });

            // Publish events for UI synchronization (outside transaction)
            await eventPublisher.publishTagCreated({
                tagId: result.id,
                tagName: result.name,
                promptIds: this.params.promptIds,
                timestamp: result.createdAt
            });

            return TagOperationResult.success(result, {
                commandType: this.getCommandType(),
                affectedPrompts: this.params.promptIds.length
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
    }

    /**
     * Validate create tag parameters
     *
     * @param {Object} params - Parameters to validate
     * @returns {ValidationResult}
     */
    validate(params) {
        const errors = [];

        // Validate tag name
        if (!params.tagName || typeof params.tagName !== 'string') {
            errors.push('Tag name is required and must be a string');
        } else if (params.tagName.trim().length === 0) {
            errors.push('Tag name cannot be empty');
        } else if (params.tagName.length > 50) {
            errors.push('Tag name cannot exceed 50 characters');
        } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(params.tagName)) {
            errors.push('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
        }

        // Validate tag color
        if (params.tagColor && !/^#[0-9A-Fa-f]{6}$/.test(params.tagColor)) {
            errors.push('Tag color must be a valid hex color code (e.g., #007bff)');
        }

        // Validate description
        if (params.description && params.description.length > 200) {
            errors.push('Tag description cannot exceed 200 characters');
        }

        // Validate prompt IDs
        if (params.promptIds && !Array.isArray(params.promptIds)) {
            errors.push('Prompt IDs must be an array');
        } else if (params.promptIds) {
            const invalidIds = params.promptIds.filter(id => typeof id !== 'string' || id.trim().length === 0);
            if (invalidIds.length > 0) {
                errors.push('All prompt IDs must be non-empty strings');
            }
        }

        return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    /**
     * Get command type identifier
     *
     * @returns {string}
     */
    getCommandType() {
        return 'CREATE_TAG';
    }

    /**
     * Check if command supports undo
     *
     * @returns {boolean}
     */
    isUndoable() {
        return true;
    }

    /**
     * Create undo command (DeleteTagCommand)
     *
     * @param {TagOperationResult} executionResult - Result from create operation
     * @returns {TagCommandInterface}
     */
    createUndoCommand(executionResult) {
        if (!executionResult.success || !executionResult.data) {
            return null;
        }

        const DeleteTagCommand = require('./DeleteTagCommand');
        return new DeleteTagCommand({
            tagId: executionResult.data.id,
            tagName: executionResult.data.name
        });
    }

    /**
     * Generate unique tag ID
     *
     * @private
     * @returns {Promise<string>}
     */
    async _generateTagId() {
        // Generate timestamp-based ID with random suffix for uniqueness
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `tag_${timestamp}_${random}`;
    }
}

export default CreateTagCommand;