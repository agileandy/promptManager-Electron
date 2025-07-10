/**
 * VersionStateManager.js
 *
 * Manages version state and ensures atomicity of version operations.
 * Provides state validation methods and event notifications.
 */

class VersionStateManager {
    constructor(database) {
        this.db = database;
        this.eventListeners = new Map();
        this.operationHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Initialize the state manager
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('VersionStateManager initialized');

        // Perform initial state validation
        await this.validateDatabaseState();
    }

    /**
     * Validate the overall database state for version integrity
     * @returns {Promise<Object>} Validation result
     */
    async validateDatabaseState() {
        try {
            console.log('Validating database state for version integrity...');

            const issues = [];

            // Check for orphaned versions (versions without a valid parent)
            const orphanedVersions = await this.findOrphanedVersions();
            if (orphanedVersions.length > 0) {
                issues.push({
                    type: 'orphaned_versions',
                    count: orphanedVersions.length,
                    versions: orphanedVersions
                });
            }

            // Check for multiple latest versions in the same prompt family
            const multipleLatestIssues = await this.findMultipleLatestVersions();
            if (multipleLatestIssues.length > 0) {
                issues.push({
                    type: 'multiple_latest_versions',
                    count: multipleLatestIssues.length,
                    issues: multipleLatestIssues
                });
            }

            // Check for version sequence gaps
            const sequenceGaps = await this.findVersionSequenceGaps();
            if (sequenceGaps.length > 0) {
                issues.push({
                    type: 'version_sequence_gaps',
                    count: sequenceGaps.length,
                    gaps: sequenceGaps
                });
            }

            // Check for orphaned tag relationships
            const orphanedTagRelations = await this.findOrphanedTagRelationships();
            if (orphanedTagRelations.length > 0) {
                issues.push({
                    type: 'orphaned_tag_relationships',
                    count: orphanedTagRelations.length,
                    relationships: orphanedTagRelations
                });
            }

            if (issues.length > 0) {
                console.warn('Database state validation found issues:', issues);
            } else {
                console.log('Database state validation passed - no issues found');
            }

            return {
                success: true,
                issues: issues,
                isHealthy: issues.length === 0
            };
        } catch (error) {
            console.error('Database state validation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find orphaned versions (versions with parentId that doesn't exist)
     * @returns {Promise<Array>} Array of orphaned versions
     */
    async findOrphanedVersions() {
        try {
            const allVersions = await this.db.prompts.toArray();
            const orphaned = [];

            for (const version of allVersions) {
                if (version.parentId) {
                    // Check if parent exists
                    const parent = await this.db.prompts.get(version.parentId);
                    if (!parent) {
                        orphaned.push(version);
                    }
                }
            }

            return orphaned;
        } catch (error) {
            console.error('Failed to find orphaned versions:', error);
            return [];
        }
    }

    /**
     * Find prompt families with multiple latest versions
     * @returns {Promise<Array>} Array of issues
     */
    async findMultipleLatestVersions() {
        try {
            const issues = [];

            // Group versions by parent ID
            const versionGroups = new Map();
            const allVersions = await this.db.prompts.toArray();

            for (const version of allVersions) {
                const parentId = version.parentId || version.id;
                if (!versionGroups.has(parentId)) {
                    versionGroups.set(parentId, []);
                }
                versionGroups.get(parentId).push(version);
            }

            // Check each group for multiple latest versions
            for (const [parentId, versions] of versionGroups) {
                const latestVersions = versions.filter(v => v.isLatest === 1);
                if (latestVersions.length > 1) {
                    issues.push({
                        parentId: parentId,
                        latestVersions: latestVersions,
                        totalVersions: versions.length
                    });
                }
            }

            return issues;
        } catch (error) {
            console.error('Failed to find multiple latest versions:', error);
            return [];
        }
    }

    /**
     * Find version sequence gaps within prompt families
     * @returns {Promise<Array>} Array of sequence gap issues
     */
    async findVersionSequenceGaps() {
        try {
            const gaps = [];

            // Group versions by parent ID
            const versionGroups = new Map();
            const allVersions = await this.db.prompts.toArray();

            for (const version of allVersions) {
                const parentId = version.parentId || version.id;
                if (!versionGroups.has(parentId)) {
                    versionGroups.set(parentId, []);
                }
                versionGroups.get(parentId).push(version);
            }

            // Check each group for sequence gaps
            for (const [parentId, versions] of versionGroups) {
                if (versions.length <= 1) continue;

                const sortedVersions = versions.sort((a, b) => a.version - b.version);
                const versionNumbers = sortedVersions.map(v => v.version);

                // Check for gaps in sequence
                for (let i = 1; i < versionNumbers.length; i++) {
                    if (versionNumbers[i] !== versionNumbers[i-1] + 1) {
                        gaps.push({
                            parentId: parentId,
                            expectedVersion: versionNumbers[i-1] + 1,
                            actualVersion: versionNumbers[i],
                            gap: versionNumbers[i] - versionNumbers[i-1] - 1,
                            versions: sortedVersions
                        });
                    }
                }
            }

            return gaps;
        } catch (error) {
            console.error('Failed to find version sequence gaps:', error);
            return [];
        }
    }

    /**
     * Find orphaned tag relationships (relationships pointing to non-existent prompts or tags)
     * @returns {Promise<Array>} Array of orphaned relationships
     */
    async findOrphanedTagRelationships() {
        try {
            const orphaned = [];
            const allRelationships = await this.db.promptTags.toArray();

            for (const relationship of allRelationships) {
                // Check if prompt exists
                const prompt = await this.db.prompts.get(relationship.promptId);
                if (!prompt) {
                    orphaned.push({
                        ...relationship,
                        issue: 'missing_prompt'
                    });
                    continue;
                }

                // Check if tag exists
                const tag = await this.db.tags.get(relationship.tagId);
                if (!tag) {
                    orphaned.push({
                        ...relationship,
                        issue: 'missing_tag'
                    });
                }
            }

            return orphaned;
        } catch (error) {
            console.error('Failed to find orphaned tag relationships:', error);
            return [];
        }
    }

    /**
     * Notify that a version has been deleted
     * @param {Object} context - Deletion context
     * @returns {Promise<void>}
     */
    async notifyVersionDeleted(context) {
        try {
            // Record the operation in history
            this.recordOperation('version_deleted', {
                promptId: context.promptId,
                parentId: context.parentId,
                deletedVersions: context.allVersions ? context.allVersions.length : 1,
                timestamp: context.timestamp || new Date(),
                dependencies: context.dependencies
            });

            // Emit event to listeners
            this.emitEvent('version_deleted', {
                promptId: context.promptId,
                parentId: context.parentId,
                context: context
            });

            console.log('Version deletion notification processed', {
                promptId: context.promptId,
                parentId: context.parentId
            });
        } catch (error) {
            console.error('Failed to process version deletion notification:', error);
        }
    }

    /**
     * Record an operation in the history
     * @param {string} operation - Operation type
     * @param {Object} details - Operation details
     */
    recordOperation(operation, details) {
        this.operationHistory.push({
            operation,
            details,
            timestamp: new Date()
        });

        // Trim history if it gets too large
        if (this.operationHistory.length > this.maxHistorySize) {
            this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get operation history
     * @param {number} limit - Maximum number of operations to return
     * @returns {Array} Array of operations
     */
    getOperationHistory(limit = 50) {
        return this.operationHistory
            .slice(-limit)
            .reverse(); // Most recent first
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    addEventListener(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener function
     */
    removeEventListener(event, listener) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emitEvent(event, data) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Repair database state issues
     * @param {Array} issues - Issues to repair (from validateDatabaseState)
     * @returns {Promise<Object>} Repair result
     */
    async repairDatabaseState(issues) {
        try {
            const repairResults = {
                orphanedVersions: 0,
                multipleLatestVersions: 0,
                sequenceGaps: 0,
                orphanedTagRelationships: 0,
                errors: []
            };

            for (const issue of issues) {
                try {
                    switch (issue.type) {
                        case 'orphaned_tag_relationships':
                            // Remove orphaned tag relationships
                            for (const relationship of issue.relationships) {
                                await this.db.promptTags.delete(relationship.id);
                                repairResults.orphanedTagRelationships++;
                            }
                            break;

                        case 'multiple_latest_versions':
                            // Fix multiple latest versions by keeping the highest version number
                            for (const issueData of issue.issues) {
                                const sortedLatest = issueData.latestVersions.sort((a, b) => b.version - a.version);
                                for (let i = 1; i < sortedLatest.length; i++) {
                                    await this.db.prompts.update(sortedLatest[i].id, { isLatest: 0 });
                                    repairResults.multipleLatestVersions++;
                                }
                            }
                            break;

                        // Note: Orphaned versions and sequence gaps are more complex to repair
                        // and might require user intervention, so we skip them for now
                    }
                } catch (error) {
                    repairResults.errors.push({
                        issue: issue.type,
                        error: error.message
                    });
                }
            }

            console.log('Database state repair completed:', repairResults);
            return { success: true, results: repairResults };
        } catch (error) {
            console.error('Database state repair failed:', error);
            return { success: false, error: error.message };
        }
    }
}

export { VersionStateManager };