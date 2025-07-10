const { TagCommandInterface, TagOperationResult, ValidationResult, TagOperationError } = require('./TagCommandInterface');

/**
 * Rename Tag Command
 *
 * Command implementation for renaming existing tags with state isolation.
 * Maintains immutable history references and rollback capability.
 */
class RenameTagCommand extends TagCommandInterface {
    /**
     * Initialize the rename tag command
     *
     * @param {Object} params - Command parameters
     * @param {string} params.tagId - ID of the tag to rename
     * @param {string} params.currentName - Current name of the tag (for validation)
     * @param {string} params.newName - New name for the tag
     * @param {boolean} params.updateReferences - Whether to update references in prompts
     */
    constructor(params) {
        super();
        this.params = {
            tagId: params.tagId,
            currentName: params.currentName,
            newName: params.newName,
            updateReferences: params.updateReferences !== false // Default to true
        };
        this.rollbackSnapshot = null;
    }

    /**
     * Execute the rename tag command with state isolation
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

            // Validate current name matches (additional safety check)
            if (this.params.currentName && existingTag.name !== this.params.currentName) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Tag name mismatch: expected '${this.params.currentName}', found '${existingTag.name}'`,
                        'TAG_NAME_MISMATCH'
                    )
                );
            }

            // Check if new name already exists (different tag)
            const conflictingTag = await tagStateManager.findTagByName(this.params.newName);
            if (conflictingTag && conflictingTag.id !== this.params.tagId) {
                return TagOperationResult.failure(
                    new TagOperationError(
                        `Tag name '${this.params.newName}' already exists`,
                        'TAG_NAME_CONFLICT'
                    )
                );
            }

            // No change needed if names are the same
            if (existingTag.name === this.params.newName) {
                return TagOperationResult.success({
                    tag: existingTag,
                    nameChanged: false,
                    referencesUpdated: 0
                }, {
                    commandType: this.getCommandType(),
                    noChangeRequired: true
                });
            }

            // Get associated prompts for reference updates
            const associatedPrompts = await tagStateManager.getPromptsForTag(this.params.tagId);

            // Create rollback snapshot before modification
            this.rollbackSnapshot = {
                tag: { ...existingTag },
                associatedPrompts: associatedPrompts.map(p => ({
                    id: p.id,
                    title: p.title,
                    tagReferences: p.tagReferences || []
                })),
                renamedAt: new Date().toISOString()
            };

            // Execute rename within isolated transaction
            const result = await transactionManager.executeTransaction(async (transaction) => {
                // Update tag name and metadata
                const updatedTag = {
                    ...existingTag,
                    name: this.params.newName,
                    updatedAt: new Date().toISOString()
                };

                await tagStateManager.updateTag(this.params.tagId, updatedTag, transaction);

                let referencesUpdated = 0;

                // Update tag references in associated prompts if requested
                if (this.params.updateReferences && associatedPrompts.length > 0) {
                    for (const prompt of associatedPrompts) {
                        const updated = await this._updateTagReferencesInPrompt(
                            prompt,
                            existingTag.name,
                            this.params.newName,
                            tagStateManager,
                            transaction
                        );
                        if (updated) {
                            referencesUpdated++;
                        }
                    }
                }

                return {
                    tag: updatedTag,
                    nameChanged: true,
                    referencesUpdated,
                    associatedPromptCount: associatedPrompts.length
                };
            });

            // Publish events for UI synchronization (outside transaction)
            await eventPublisher.publishTagRenamed({
                tagId: this.params.tagId,
                oldName: existingTag.name,
                newName: this.params.newName,
                affectedPrompts: associatedPrompts.map(p => p.id),
                referencesUpdated: result.referencesUpdated,
                timestamp: this.rollbackSnapshot.renamedAt
            });

            return TagOperationResult.success(result, {
                commandType: this.getCommandType(),
                rollbackAvailable: true,
                affectedPrompts: associatedPrompts.length
            });

        } catch (error) {
            return TagOperationResult.failure(
                new TagOperationError(
                    `Failed to rename tag: ${error.message}`,
                    'RENAME_TAG_ERROR',
                    { originalError: error }
                )
            );
        }
    }

    /**
     * Validate rename tag parameters
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

        // Validate current name if provided
        if (params.currentName && typeof params.currentName !== 'string') {
            errors.push('Current tag name must be a string');
        }

        // Validate new name
        if (!params.newName || typeof params.newName !== 'string') {
            errors.push('New tag name is required and must be a string');
        } else if (params.newName.trim().length === 0) {
            errors.push('New tag name cannot be empty');
        } else if (params.newName.length > 50) {
            errors.push('New tag name cannot exceed 50 characters');
        } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(params.newName)) {
            errors.push('New tag name can only contain letters, numbers, spaces, hyphens, and underscores');
        }

        // Validate update references flag
        if (params.updateReferences !== undefined && typeof params.updateReferences !== 'boolean') {
            errors.push('Update references flag must be a boolean');
        }

        return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
    }

    /**
     * Get command type identifier
     *
     * @returns {string}
     */
    getCommandType() {
        return 'RENAME_TAG';
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
     * Create undo command (RenameTagCommand with reversed names)
     *
     * @param {TagOperationResult} executionResult - Result from rename operation
     * @returns {TagCommandInterface}
     */
    createUndoCommand(executionResult) {
        if (!executionResult.success || !this.rollbackSnapshot) {
            return null;
        }

        return new RenameTagCommand({
            tagId: this.params.tagId,
            currentName: this.params.newName,
            newName: this.rollbackSnapshot.tag.name,
            updateReferences: this.params.updateReferences
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
     * Get preview of rename impact
     *
     * @param {Object} tagStateManager - Tag state manager instance
     * @returns {Promise<Object>} Rename impact summary
     */
    async getRenameImpact(tagStateManager) {
        try {
            const tag = await tagStateManager.findTagById(this.params.tagId);
            const associatedPrompts = await tagStateManager.getPromptsForTag(this.params.tagId);
            const conflictingTag = await tagStateManager.findTagByName(this.params.newName);

            return {
                tagExists: !!tag,
                currentName: tag?.name || 'Unknown',
                newName: this.params.newName,
                hasNameConflict: !!(conflictingTag && conflictingTag.id !== this.params.tagId),
                associatedPromptCount: associatedPrompts.length,
                associatedPrompts: associatedPrompts.map(p => ({
                    id: p.id,
                    title: p.title || 'Untitled'
                })),
                willUpdateReferences: this.params.updateReferences && associatedPrompts.length > 0
            };
        } catch (error) {
            return {
                tagExists: false,
                error: error.message
            };
        }
    }

    /**
     * Update tag references within a prompt's content
     *
     * @private
     * @param {Object} prompt - Prompt object
     * @param {string} oldName - Old tag name
     * @param {string} newName - New tag name
     * @param {Object} tagStateManager - Tag state manager
     * @param {Object} transaction - Database transaction
     * @returns {Promise<boolean>} True if references were updated
     */
    async _updateTagReferencesInPrompt(prompt, oldName, newName, tagStateManager, transaction) {
        try {
            let updated = false;
            const updatedPrompt = { ...prompt };

            // Update tag references in prompt content (if it contains tag mentions)
            if (prompt.content && typeof prompt.content === 'string') {
                const tagPattern = new RegExp(`\\b${this._escapeRegex(oldName)}\\b`, 'gi');
                if (tagPattern.test(prompt.content)) {
                    updatedPrompt.content = prompt.content.replace(tagPattern, newName);
                    updated = true;
                }
            }

            // Update tag references in metadata
            if (prompt.tagReferences && Array.isArray(prompt.tagReferences)) {
                const tagIndex = prompt.tagReferences.findIndex(ref => ref === oldName);
                if (tagIndex !== -1) {
                    updatedPrompt.tagReferences = [...prompt.tagReferences];
                    updatedPrompt.tagReferences[tagIndex] = newName;
                    updated = true;
                }
            }

            // Persist changes if any updates were made
            if (updated) {
                updatedPrompt.updatedAt = new Date().toISOString();
                await tagStateManager.updatePromptTagReferences(prompt.id, updatedPrompt, transaction);
            }

            return updated;
        } catch (error) {
            // Log error but don't fail the entire operation
            console.warn(`Failed to update tag references in prompt ${prompt.id}:`, error);
            return false;
        }
    }

    /**
     * Escape special regex characters
     *
     * @private
     * @param {string} string - String to escape
     * @returns {string} Escaped string
     */
    _escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = RenameTagCommand;