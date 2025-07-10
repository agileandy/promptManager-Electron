/**
 * Tag-Only Manager
 *
 * Provides tag modification interface that bypasses content versioning.
 * Implements ADR-001: Tag-Only Modification Interface
 */

const {
    CreateTagCommand,
    DeleteTagCommand,
    RenameTagCommand,
    TagCommandExecutor,
    TagOperationError
} = require('./index');

/**
 * Tag-Only Manager Class
 *
 * Manages tag operations without creating content versions
 */
class TagOnlyManager {
    constructor(db) {
        this.db = db;
        this.context = this._createExecutionContext();
    }

    /**
     * Add tag to prompt without creating new version
     *
     * @param {number} promptId - ID of the prompt
     * @param {string} tagPath - Full path of the tag to add
     * @returns {Promise<boolean>} Success status
     */
    async addTagToPrompt(promptId, tagPath) {
        try {
            // Check if tag is already assigned to this prompt
            const tag = await this._findOrCreateTag(tagPath);
            const existingRelation = await this.db.promptTags
                .where('promptId').equals(promptId)
                .and(pt => pt.tagId === tag.id)
                .first();

            if (existingRelation) {
                console.log('Tag already assigned to prompt');
                return false;
            }

            // Add the tag-prompt relationship directly (no versioning)
            await this.db.promptTags.add({
                promptId: promptId,
                tagId: tag.id
            });

            console.log(`Tag "${tagPath}" added to prompt ${promptId} without creating version`);
            return true;

        } catch (error) {
            console.error('Error adding tag to prompt:', error);
            throw new TagOperationError(
                `Failed to add tag to prompt: ${error.message}`,
                'ADD_TAG_ERROR'
            );
        }
    }

    /**
     * Remove tag from prompt without creating new version
     *
     * @param {number} promptId - ID of the prompt
     * @param {number} tagId - ID of the tag to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeTagFromPrompt(promptId, tagId) {
        try {
            const deletedCount = await this.db.promptTags
                .where('promptId').equals(promptId)
                .and(pt => pt.tagId === tagId)
                .delete();

            if (deletedCount > 0) {
                console.log(`Tag ${tagId} removed from prompt ${promptId} without creating version`);
                return true;
            } else {
                console.log('Tag was not assigned to this prompt');
                return false;
            }

        } catch (error) {
            console.error('Error removing tag from prompt:', error);
            throw new TagOperationError(
                `Failed to remove tag from prompt: ${error.message}`,
                'REMOVE_TAG_ERROR'
            );
        }
    }

    /**
     * Create new tag using command system
     *
     * @param {Object} params - Tag creation parameters
     * @returns {Promise<Object>} Creation result
     */
    async createTag(params) {
        const command = new CreateTagCommand(params);
        const result = await TagCommandExecutor.execute(command, this.context);

        if (!result.success) {
            throw result.error;
        }

        return result.data;
    }

    /**
     * Delete tag using command system
     *
     * @param {Object} params - Tag deletion parameters
     * @returns {Promise<Object>} Deletion result
     */
    async deleteTag(params) {
        const command = new DeleteTagCommand(params);
        const result = await TagCommandExecutor.execute(command, this.context);

        if (!result.success) {
            throw result.error;
        }

        return result.data;
    }

    /**
     * Rename tag using command system
     *
     * @param {Object} params - Tag rename parameters
     * @returns {Promise<Object>} Rename result
     */
    async renameTag(params) {
        const command = new RenameTagCommand(params);
        const result = await TagCommandExecutor.execute(command, this.context);

        if (!result.success) {
            throw result.error;
        }

        return result.data;
    }

    /**
     * Get all tags assigned to a prompt
     *
     * @param {number} promptId - ID of the prompt
     * @returns {Promise<Array>} Array of tag objects
     */
    async getPromptTags(promptId) {
        try {
            const promptTags = await this.db.promptTags.where('promptId').equals(promptId).toArray();
            const tagIds = promptTags.map(pt => pt.tagId);

            if (tagIds.length === 0) {
                return [];
            }

            const tags = await this.db.tags.where('id').anyOf(tagIds).toArray();
            return tags;

        } catch (error) {
            console.error('Error getting prompt tags:', error);
            return [];
        }
    }

    /**
     * Replace all tags for a prompt without creating version
     *
     * @param {number} promptId - ID of the prompt
     * @param {Array<string>} tagPaths - Array of tag paths to assign
     * @returns {Promise<boolean>} Success status
     */
    async replacePromptTags(promptId, tagPaths) {
        try {
            // Remove all existing tag relationships for this prompt
            await this.db.promptTags.where('promptId').equals(promptId).delete();

            // Add new tag relationships
            for (const tagPath of tagPaths) {
                const tag = await this._findOrCreateTag(tagPath);
                await this.db.promptTags.add({
                    promptId: promptId,
                    tagId: tag.id
                });
            }

            console.log(`Replaced tags for prompt ${promptId} without creating version`);
            return true;

        } catch (error) {
            console.error('Error replacing prompt tags:', error);
            throw new TagOperationError(
                `Failed to replace prompt tags: ${error.message}`,
                'REPLACE_TAGS_ERROR'
            );
        }
    }

    /**
     * Find existing tag or create new one
     *
     * @private
     * @param {string} tagPath - Full path of the tag
     * @returns {Promise<Object>} Tag object
     */
    async _findOrCreateTag(tagPath) {
        // Try to find existing tag
        let tag = await this.db.tags.where('fullPath').equals(tagPath).first();

        if (!tag) {
            // Create new tag if it doesn't exist
            const tagParts = tagPath.split('/');
            const tagName = tagParts[tagParts.length - 1];

            const tagId = await this.db.tags.add({
                name: tagName,
                fullPath: tagPath,
                parentId: null, // Simplified - could be enhanced for hierarchy
                level: tagParts.length - 1
            });

            tag = await this.db.tags.get(tagId);
        }

        return tag;
    }

    /**
     * Create execution context for command system
     *
     * @private
     * @returns {Object} Execution context
     */
    _createExecutionContext() {
        return {
            tagStateManager: new DatabaseTagStateManager(this.db),
            eventPublisher: new SimpleEventPublisher(),
            transactionManager: new DatabaseTransactionManager(this.db)
        };
    }
}

/**
 * Database Tag State Manager
 *
 * Implements tag state management using the existing database
 */
class DatabaseTagStateManager {
    constructor(db) {
        this.db = db;
    }

    async findTagById(tagId) {
        return await this.db.tags.get(tagId);
    }

    async findTagByName(tagName) {
        return await this.db.tags.where('name').equals(tagName).first();
    }

    async createTag(tagEntity, transaction) {
        const id = await this.db.tags.add(tagEntity);
        return { ...tagEntity, id };
    }

    async updateTag(tagId, updatedTag, transaction) {
        await this.db.tags.update(tagId, updatedTag);
        return updatedTag;
    }

    async deleteTag(tagId, transaction) {
        await this.db.tags.delete(tagId);
        return true;
    }

    async getPromptsForTag(tagId) {
        const promptTags = await this.db.promptTags.where('tagId').equals(tagId).toArray();
        const promptIds = promptTags.map(pt => pt.promptId);

        if (promptIds.length === 0) {
            return [];
        }

        return await this.db.prompts.where('id').anyOf(promptIds).and(p => p.isLatest === 1).toArray();
    }

    async associatePromptsWithTag(tagId, promptIds, transaction) {
        for (const promptId of promptIds) {
            await this.db.promptTags.add({ promptId, tagId });
        }
        return true;
    }

    async removeAllTagAssociations(tagId, transaction) {
        await this.db.promptTags.where('tagId').equals(tagId).delete();
        return true;
    }

    async updatePromptTagReferences(promptId, updatedPrompt, transaction) {
        // This would update prompt content if needed
        // For now, we just handle the tag relationships
        return true;
    }
}

/**
 * Simple Event Publisher
 *
 * Basic event publishing for UI updates
 */
class SimpleEventPublisher {
    async publishTagCreated(event) {
        console.log('Tag created event:', event);
        // Could dispatch custom events here for UI updates
        window.dispatchEvent(new CustomEvent('tagCreated', { detail: event }));
    }

    async publishTagDeleted(event) {
        console.log('Tag deleted event:', event);
        window.dispatchEvent(new CustomEvent('tagDeleted', { detail: event }));
    }

    async publishTagRenamed(event) {
        console.log('Tag renamed event:', event);
        window.dispatchEvent(new CustomEvent('tagRenamed', { detail: event }));
    }
}

/**
 * Database Transaction Manager
 *
 * Simple transaction wrapper for Dexie
 */
class DatabaseTransactionManager {
    constructor(db) {
        this.db = db;
    }

    async executeTransaction(callback) {
        // Dexie handles transactions automatically for most operations
        // For more complex transactions, we could use db.transaction()
        return await callback({ id: Date.now() });
    }
}

module.exports = TagOnlyManager;