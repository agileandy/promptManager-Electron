import { TagCommandInterface, TagOperationResult, ValidationResult, TagOperationError } from './TagCommandInterface.js';

/**
 * Delete Tag Command
 *
 * Command implementation for deleting existing tags with state isolation.
 * Maintains rollback capability through snapshot creation.
 */
class DeleteTagCommand extends TagCommandInterface {
    /**
     * Initialize the delete tag command
     *
     * @param {Object} params - Command parameters
     * @param {string} params.tagId - ID of the tag to delete
     * @param {string} params.tagName - Name of the tag to delete (for validation)
     * @param {boolean} params.forceDelete - Force deletion even if tag has associated prompts
     */
    constructor(params) {
        super();
        this.params = {
            tagId: params.tagId,
            tagName: params.tagName,
            forceDelete: params.forceDelete || false
        };
        this.rollbackSnapshot = null;
    }

    /**
     * Execute the delete tag command with state isolation
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

            // Verify tag exists and get current state for rollback
            const existingTag = await tagStateManager.findTagById(this.params.tagId);
            if (!existingTag) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Tag with ID '${this.params.tagId}' not found`,
                        'TAG_NOT_FOUND'
                    )
                );
            }

            // Validate tag name matches (additional safety check)
            if (this.params.tagName && existingTag.name !== this.params.tagName) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Tag name mismatch: expected '${this.params.tagName}', found '${existingTag.name}'`,
                        'TAG_NAME_MISMATCH'
                    )
                );
            }

            // Check for associated prompts
            const associatedPrompts = await tagStateManager.getPromptsForTag(this.params.tagId);
            if (associatedPrompts.length > 0 && !this.params.forceDelete) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Cannot delete tag '${existingTag.name}': ${associatedPrompts.length} prompts are still associated. Use forceDelete to override.`,
                        'TAG_HAS_ASSOCIATIONS',
                        { associatedPromptCount: associatedPrompts.length }
                    )
                );
            }

            // Create rollback snapshot before deletion
            this.rollbackSnapshot = {
                tag: { ...existingTag },
                associatedPrompts: associatedPrompts.map(p => ({ id: p.id, title: p.title })),
                deletedAt: new Date().toISOString()
            };

            // Execute deletion within isolated transaction
            const result = await transactionManager.executeTransaction(async (transaction) => {
                // Remove tag-prompt associations first
                if (associatedPrompts.length > 0) {
                    await tagStateManager.removeAllTagAssociations(this.params.tagId, transaction);
                }

                // Delete the tag entity
                await tagStateManager.deleteTag(this.params.tagId, transaction);

                return {
                    deletedTag: existingTag,
                    removedAssociations: associatedPrompts.length,
                    canRollback: true
                };
            });

            // Publish events for UI synchronization (outside transaction)
            await eventPublisher.publishTagDeleted({
                tagId: this.params.tagId,
                tagName: existingTag.name,
                affectedPrompts: associatedPrompts.map(p => p.id),
                timestamp: this.rollbackSnapshot.deletedAt
            });

            return TagOperationResult.success(result, {
                commandType: this.getCommandType(),
                rollbackAvailable: true,
                affectedPrompts: associatedPrompts.length
            });

        } catch (error) {
            return TagOperationResult.failure(
                new TagOperationError(
                    `Failed to delete tag: ${error.message}`,
                    'DELETE_TAG_ERROR',
                    { originalError: error }
                )
            );
        }
    }

    /**
     * Validate delete tag parameters
     *
     * @param {Object} params - Parameters to validate
     * @returns {ValidationResult}
     */
    validate(params) {
        const errors = [];

        // Validate tag ID
        if (!params.tagId || typeof params.tagId !== 'string') {
            errors.push('Tag ID is required and must be a string');
        } else if (params.tagId.trim().length === 0) {
            errors.push('Tag ID cannot be empty');
        }

        // Validate tag name if provided
        if (params.tagName && typeof params.tagName !== 'string') {
            errors.push('Tag name must be a string');
        }

        // Validate force delete flag
        if (params.forceDelete !== undefined && typeof params.forceDelete !== 'boolean') {
            errors.push('Force delete flag must be a boolean');
        }

        return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    /**
     * Get command type identifier
     *
     * @returns {string}
     */
    getCommandType() {
        return 'DELETE_TAG';
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
     * Create undo command (CreateTagCommand with rollback data)
     *
     * @param {TagOperationResult} executionResult - Result from delete operation
     * @returns {TagCommandInterface}
     */
    createUndoCommand(executionResult) {
        if (!executionResult.success || !this.rollbackSnapshot) {
            return null;
        }

        const CreateTagCommand = require('./CreateTagCommand');
        const snapshot = this.rollbackSnapshot;

        return new CreateTagCommand({
            tagName: snapshot.tag.name,
            tagColor: snapshot.tag.color,
            description: snapshot.tag.description,
            promptIds: snapshot.associatedPrompts.map(p => p.id)
        });
    }

    /**
     * Get rollback snapshot for external undo operations
     *
     * @returns {Object|null} Rollback snapshot or null if not available
     */
    getRollbackSnapshot() {
        return this.rollbackSnapshot;
    }

    /**
     * Check if tag can be safely deleted (no associations)
     *
     * @param {Object} tagStateManager - Tag state manager instance
     * @returns {Promise<boolean>}
     */
    async canSafelyDelete(tagStateManager) {
        try {
            const associatedPrompts = await tagStateManager.getPromptsForTag(this.params.tagId);
            return associatedPrompts.length === 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get preview of deletion impact
     *
     * @param {Object} tagStateManager - Tag state manager instance
     * @returns {Promise<Object>} Deletion impact summary
     */
    async getDeletionImpact(tagStateManager) {
        try {
            const tag = await tagStateManager.findTagById(this.params.tagId);
            const associatedPrompts = await tagStateManager.getPromptsForTag(this.params.tagId);

            return {
                tagExists: !!tag,
                tagName: tag?.name || 'Unknown',
                associatedPromptCount: associatedPrompts.length,
                associatedPrompts: associatedPrompts.map(p => ({
                    id: p.id,
                    title: p.title || 'Untitled'
                })),
                requiresForceDelete: associatedPrompts.length > 0
            };
        } catch (error) {
            return {
                tagExists: false,
                error: error.message
            };
        }
    }
}

export default DeleteTagCommand;