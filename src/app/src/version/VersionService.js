/**
 * VersionService.js
 *
 * Implements Chain of Responsibility pattern for version management operations.
 * Provides structured validation, dependency checking, and deletion handling.
 *
 * Part of Version Management Architecture Epic - Task 1
 */

import ValidationHandler from './handlers/ValidationHandler.js';
import DependencyHandler from './handlers/DependencyHandler.js';
import DeletionHandler from './handlers/DeletionHandler.js';

class VersionService {
    constructor(database, stateManager) {
        this.db = database;
        this.stateManager = stateManager;
        this.deletionChain = null;
        this.initializeDeletionChain();
    }

    /**
     * Initialize the Chain of Responsibility for version deletion
     */
    initializeDeletionChain() {
        // Create handler instances
        const validationHandler = new ValidationHandler(this.db, this.stateManager);
        const dependencyHandler = new DependencyHandler(this.db, this.stateManager);
        const deletionHandler = new DeletionHandler(this.db, this.stateManager);

        // Set up the chain
        validationHandler.setNext(dependencyHandler);
        dependencyHandler.setNext(deletionHandler);

        this.deletionChain = validationHandler;
    }

    /**
     * Delete a version using the Chain of Responsibility pattern
     * @param {number} promptId - The ID of the prompt/version to delete
     * @param {Object} options - Additional options for deletion
     * @returns {Promise<Object>} Result object with success status and details
     */
    async deleteVersion(promptId, options = {}) {
        try {
            console.log(`Starting version deletion process for prompt ID: ${promptId}`);

            // Create deletion context
            const context = {
                promptId,
                options,
                prompt: null,
                parentId: null,
                allVersions: [],
                dependencies: [],
                validationResults: {},
                timestamp: new Date()
            };

            // Execute the chain
            const result = await this.deletionChain.handle(context);

            if (result.success) {
                console.log(`Version deletion completed successfully for prompt ID: ${promptId}`);

                // Notify state manager of successful deletion
                await this.stateManager.notifyVersionDeleted(context);
            } else {
                console.warn(`Version deletion failed for prompt ID: ${promptId}`, result.error);
            }

            return result;
        } catch (error) {
            console.error('Version deletion process failed:', error);
            return {
                success: false,
                error: error.message,
                stage: 'service_level'
            };
        }
    }

    /**
     * Get version information without deletion
     * @param {number} promptId - The ID of the prompt/version
     * @returns {Promise<Object>} Version information
     */
    async getVersionInfo(promptId) {
        try {
            const prompt = await this.db.prompts.get(promptId);
            if (!prompt) {
                return { success: false, error: 'Prompt not found' };
            }

            const parentId = prompt.parentId || promptId;
            const allVersions = await this.db.prompts
                .where('parentId').equals(parentId)
                .or('id').equals(parentId)
                .toArray();

            return {
                success: true,
                prompt,
                parentId,
                allVersions,
                totalVersions: allVersions.length,
                isLatestVersion: prompt.isLatest === 1
            };
        } catch (error) {
            console.error('Failed to get version info:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all dependencies for a version
     * @param {number} promptId - The ID of the prompt/version
     * @returns {Promise<Object>} Dependencies information
     */
    async getVersionDependencies(promptId) {
        try {
            const dependencyHandler = new DependencyHandler(this.db, this.stateManager);

            const context = { promptId };
            const dependencies = await dependencyHandler.checkDependencies(context);

            return {
                success: true,
                dependencies
            };
        } catch (error) {
            console.error('Failed to get version dependencies:', error);
            return { success: false, error: error.message };
        }
    }
}

export { VersionService };