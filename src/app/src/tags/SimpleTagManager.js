/**
 * Simple Tag Manager
 *
 * Provides tag modification without version creation, working directly with existing database.
 * Implements state isolation for tag operations per ADR-001.
 */

class SimpleTagManager {
    constructor(db) {
        this.db = db;
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
            // Find or create the tag using existing createOrGetTag function
            const tag = await this._findOrCreateTag(tagPath);

            // Check if tag is already assigned to this prompt
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
            throw error;
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
            throw error;
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
            throw error;
        }
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
     * Find existing tag or create new one (compatible with existing system)
     *
     * @private
     * @param {string} tagPath - Full path of the tag
     * @returns {Promise<Object>} Tag object
     */
    async _findOrCreateTag(tagPath) {
        // Try to find existing tag by fullPath first
        let tag = await this.db.tags.where('fullPath').equals(tagPath).first();

        if (!tag) {
            // Try to find by name as fallback for existing tags
            const tagName = tagPath.split('/').pop();
            const possibleTags = await this.db.tags.where('name').equals(tagName).toArray();

            // If we find tags with the same name, try to match by fullPath
            for (const possibleTag of possibleTags) {
                if (possibleTag.fullPath === tagPath || !possibleTag.fullPath) {
                    tag = possibleTag;
                    // Update with fullPath if missing
                    if (!tag.fullPath) {
                        await this.db.tags.update(tag.id, { fullPath: tagPath });
                        tag.fullPath = tagPath;
                    }
                    break;
                }
            }
        }

        if (!tag) {
            // Create new tag if it doesn't exist - use the existing createOrGetTag logic
            const tagParts = tagPath.split('/');
            const tagName = tagParts[tagParts.length - 1];

            // Calculate parent info for hierarchy
            let parentId = null;
            let level = 0;

            if (tagParts.length > 1) {
                const parentPath = tagParts.slice(0, -1).join('/');
                const parentTag = await this._findOrCreateTag(parentPath);
                parentId = parentTag.id;
                level = tagParts.length - 1;
            }

            const tagId = await this.db.tags.add({
                name: tagName,
                fullPath: tagPath,
                parentId: parentId,
                level: level
            });

            tag = await this.db.tags.get(tagId);
        }

        return tag;
    }
}

module.exports = SimpleTagManager;