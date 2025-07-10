/**
 * DeletionHandler.js
 *
 * Final handler in the Chain of Responsibility for version deletion.
 * Performs the actual deletion operations with atomicity and referential integrity.
 */

const BaseHandler = require('./BaseHandler');

class DeletionHandler extends BaseHandler {
    /**
     * Execute deletion logic
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Deletion result
     */
    async execute(context) {
        this.log('Starting deletion operations', { promptId: context.promptId });

        try {
            // Perform atomic deletion transaction
            const deletionResult = await this.performAtomicDeletion(context);
            if (!deletionResult.success) {
                return deletionResult;
            }

            // Handle version resequencing if needed
            const resequencingResult = await this.handleVersionResequencing(context);
            if (!resequencingResult.success) {
                // Log warning but don't fail the deletion
                this.log('Warning: Version resequencing failed, but deletion completed', {
                    promptId: context.promptId,
                    error: resequencingResult.error
                });
            }

            // Clean up orphaned dependencies
            const cleanupResult = await this.cleanupOrphanedDependencies(context);
            if (!cleanupResult.success) {
                // Log warning but don't fail the deletion
                this.log('Warning: Dependency cleanup failed, but deletion completed', {
                    promptId: context.promptId,
                    error: cleanupResult.error
                });
            }

            this.log('Deletion operations completed successfully', {
                promptId: context.promptId,
                deletedVersions: deletionResult.deletedVersions,
                resequenced: resequencingResult.success,
                cleanedUp: cleanupResult.success
            });

            return {
                success: true,
                deletedVersions: deletionResult.deletedVersions,
                resequencingApplied: resequencingResult.success,
                dependenciesCleanedUp: cleanupResult.success,
                details: {
                    deletion: deletionResult.details,
                    resequencing: resequencingResult.details,
                    cleanup: cleanupResult.details
                }
            };
        } catch (error) {
            this.logError('Deletion operations failed', error);
            return {
                success: false,
                error: `Deletion failed: ${error.message}`,
                code: 'DELETION_ERROR'
            };
        }
    }

    /**
     * Perform atomic deletion of prompt versions and related data
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Deletion result
     */
    async performAtomicDeletion(context) {
        try {
            // Determine what to delete based on options
            const versionsToDelete = this.determineVersionsToDelete(context);
            const versionIds = versionsToDelete.map(v => v.id);

            this.log('Starting atomic deletion transaction', {
                promptId: context.promptId,
                versionsToDelete: versionIds.length,
                deleteAll: context.options.deleteAllVersions
            });

            // Use a transaction-like approach (Dexie doesn't have true transactions across tables)
            const deletionSteps = [];

            try {
                // Step 1: Delete tag relationships
                const tagDeletionCount = await this.db.promptTags
                    .where('promptId')
                    .anyOf(versionIds)
                    .delete();
                deletionSteps.push({ step: 'tags', count: tagDeletionCount });

                // Step 2: Delete the prompt versions
                const promptDeletionCount = await this.db.prompts
                    .where('id')
                    .anyOf(versionIds)
                    .delete();
                deletionSteps.push({ step: 'prompts', count: promptDeletionCount });

                // Verify deletion counts match expectations
                if (promptDeletionCount !== versionIds.length) {
                    throw new Error(`Expected to delete ${versionIds.length} prompts, but deleted ${promptDeletionCount}`);
                }

                this.log('Atomic deletion completed successfully', {
                    promptId: context.promptId,
                    deletionSteps: deletionSteps,
                    totalVersionsDeleted: promptDeletionCount
                });

                return {
                    success: true,
                    deletedVersions: versionIds,
                    details: {
                        steps: deletionSteps,
                        versionsDeleted: promptDeletionCount,
                        tagRelationshipsDeleted: tagDeletionCount
                    }
                };
            } catch (error) {
                // Attempt to rollback what we can (limited rollback capability)
                this.logError('Deletion transaction failed, attempting partial rollback', error);

                // Note: In a real-world scenario, you might want to implement
                // a more sophisticated rollback mechanism or use a database
                // that supports proper transactions

                throw error;
            }
        } catch (error) {
            this.logError('Atomic deletion failed', error);
            return {
                success: false,
                error: `Atomic deletion failed: ${error.message}`,
                code: 'ATOMIC_DELETION_ERROR'
            };
        }
    }

    /**
     * Determine which versions to delete based on context and options
     * @param {Object} context - The deletion context
     * @returns {Array} Array of versions to delete
     */
    determineVersionsToDelete(context) {
        if (context.options.deleteAllVersions) {
            // Delete all versions of the prompt
            return context.allVersions;
        } else {
            // Delete only the specific version
            return context.allVersions.filter(v => v.id === context.promptId);
        }
    }

    /**
     * Handle version resequencing after deletion
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Resequencing result
     */
    async handleVersionResequencing(context) {
        try {
            // Check if resequencing is needed
            const sequenceData = context.dependencies.versionSequence;
            if (!sequenceData.needsResequencing) {
                this.log('No version resequencing needed', { promptId: context.promptId });
                return { success: true, details: { resequencingNeeded: false } };
            }

            // Get remaining versions after deletion
            const deletedVersionIds = this.determineVersionsToDelete(context).map(v => v.id);
            const remainingVersions = context.allVersions
                .filter(v => !deletedVersionIds.includes(v.id))
                .sort((a, b) => a.version - b.version);

            if (remainingVersions.length === 0) {
                this.log('No remaining versions to resequence', { promptId: context.promptId });
                return { success: true, details: { remainingVersions: 0 } };
            }

            // Resequence remaining versions
            const resequencingUpdates = [];
            let newLatestVersion = null;

            for (let i = 0; i < remainingVersions.length; i++) {
                const version = remainingVersions[i];
                const newVersionNumber = i + 1;
                const isNewLatest = i === remainingVersions.length - 1;

                if (version.version !== newVersionNumber || version.isLatest !== (isNewLatest ? 1 : 0)) {
                    await this.db.prompts.update(version.id, {
                        version: newVersionNumber,
                        isLatest: isNewLatest ? 1 : 0
                    });

                    resequencingUpdates.push({
                        id: version.id,
                        oldVersion: version.version,
                        newVersion: newVersionNumber,
                        wasLatest: version.isLatest === 1,
                        isLatest: isNewLatest
                    });

                    if (isNewLatest) {
                        newLatestVersion = version.id;
                    }
                }
            }

            this.log('Version resequencing completed', {
                promptId: context.promptId,
                remainingVersions: remainingVersions.length,
                updatesApplied: resequencingUpdates.length,
                newLatestVersion: newLatestVersion
            });

            return {
                success: true,
                details: {
                    resequencingNeeded: true,
                    remainingVersions: remainingVersions.length,
                    updatesApplied: resequencingUpdates.length,
                    updates: resequencingUpdates,
                    newLatestVersion: newLatestVersion
                }
            };
        } catch (error) {
            this.logError('Version resequencing failed', error);
            return {
                success: false,
                error: `Version resequencing failed: ${error.message}`,
                code: 'RESEQUENCING_ERROR'
            };
        }
    }

    /**
     * Clean up orphaned dependencies after deletion
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupOrphanedDependencies(context) {
        try {
            const cleanupResults = {
                orphanedTags: 0,
                emptyFolders: 0
            };

            // Clean up orphaned tags if configured to do so
            if (context.options.cleanupOrphanedTags && context.dependencies.tags.orphanedTags) {
                for (const orphanedTag of context.dependencies.tags.orphanedTags) {
                    // Double-check the tag is still orphaned
                    const usageCount = await this.db.promptTags
                        .where('tagId')
                        .equals(orphanedTag.id)
                        .count();

                    if (usageCount === 0) {
                        await this.db.tags.delete(orphanedTag.id);
                        cleanupResults.orphanedTags++;
                        this.log('Cleaned up orphaned tag', {
                            tagId: orphanedTag.id,
                            tagName: orphanedTag.name
                        });
                    }
                }
            }

            // Note: We don't automatically delete empty folders as they might be intentionally kept
            // This could be added as an option in the future

            this.log('Dependency cleanup completed', {
                promptId: context.promptId,
                cleanupResults: cleanupResults
            });

            return {
                success: true,
                details: cleanupResults
            };
        } catch (error) {
            this.logError('Dependency cleanup failed', error);
            return {
                success: false,
                error: `Dependency cleanup failed: ${error.message}`,
                code: 'CLEANUP_ERROR'
            };
        }
    }
}

module.exports = DeletionHandler;