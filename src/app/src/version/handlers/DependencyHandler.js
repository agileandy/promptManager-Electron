/**
 * DependencyHandler.js
 *
 * Second handler in the Chain of Responsibility for version deletion.
 * Checks for dependencies and referential integrity before allowing deletion.
 */

import BaseHandler from './BaseHandler.js';

class DependencyHandler extends BaseHandler {
    /**
     * Execute dependency checking logic
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Dependency check result
     */
    async execute(context) {
        this.log('Starting dependency checks', { promptId: context.promptId });

        // Check tag dependencies
        const tagDependencies = await this.checkTagDependencies(context);
        if (!tagDependencies.success) {
            return tagDependencies;
        }

        // Check folder dependencies
        const folderDependencies = await this.checkFolderDependencies(context);
        if (!folderDependencies.success) {
            return folderDependencies;
        }

        // Check version sequence integrity
        const sequenceIntegrity = await this.checkVersionSequenceIntegrity(context);
        if (!sequenceIntegrity.success) {
            return sequenceIntegrity;
        }

        // Store dependency information in context
        context.dependencies = {
            tags: tagDependencies.data || [],
            folders: folderDependencies.data || [],
            versionSequence: sequenceIntegrity.data || {},
            checkedAt: new Date()
        };

        this.log('All dependency checks passed', {
            promptId: context.promptId,
            tagCount: context.dependencies.tags.length,
            folderCount: context.dependencies.folders.length
        });

        return { success: true };
    }

    /**
     * Check tag dependencies for the prompt versions
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Tag dependency check result
     */
    async checkTagDependencies(context) {
        try {
            const allVersionIds = context.allVersions.map(v => v.id);

            // Get all tag relationships for all versions
            const tagRelationships = await this.db.promptTags
                .where('promptId')
                .anyOf(allVersionIds)
                .toArray();

            if (tagRelationships.length === 0) {
                this.log('No tag dependencies found', { promptId: context.promptId });
                return { success: true, data: [] };
            }

            // Get tag details
            const tagIds = [...new Set(tagRelationships.map(rel => rel.tagId))];
            const tags = await this.db.tags.where('id').anyOf(tagIds).toArray();

            // Check if any tags will become orphaned
            const orphanedTags = [];
            for (const tag of tags) {
                const otherUsages = await this.db.promptTags
                    .where('tagId').equals(tag.id)
                    .and(rel => !allVersionIds.includes(rel.promptId))
                    .count();

                if (otherUsages === 0) {
                    orphanedTags.push(tag);
                }
            }

            // For now, we allow deletion even if tags become orphaned
            // Future implementation could ask user for confirmation
            if (orphanedTags.length > 0) {
                this.log('Warning: Some tags will become orphaned after deletion', {
                    promptId: context.promptId,
                    orphanedTags: orphanedTags.map(t => t.name)
                });
            }

            this.log('Tag dependency check completed', {
                promptId: context.promptId,
                totalTagRelationships: tagRelationships.length,
                uniqueTags: tags.length,
                orphanedTags: orphanedTags.length
            });

            return {
                success: true,
                data: {
                    relationships: tagRelationships,
                    tags: tags,
                    orphanedTags: orphanedTags
                }
            };
        } catch (error) {
            this.logError('Failed to check tag dependencies', error);
            return {
                success: false,
                error: `Tag dependency check failed: ${error.message}`,
                code: 'TAG_DEPENDENCY_ERROR'
            };
        }
    }

    /**
     * Check folder dependencies
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Folder dependency check result
     */
    async checkFolderDependencies(context) {
        try {
            // Check if any versions are in folders
            const folderedVersions = context.allVersions.filter(v => v.folderId);

            if (folderedVersions.length === 0) {
                this.log('No folder dependencies found', { promptId: context.promptId });
                return { success: true, data: [] };
            }

            // Get folder information
            const folderIds = [...new Set(folderedVersions.map(v => v.folderId))];
            const folders = await this.db.folders.where('id').anyOf(folderIds).toArray();

            // Check if folders will become empty
            const emptyingFolders = [];
            for (const folder of folders) {
                const otherPromptsInFolder = await this.db.prompts
                    .where('folderId').equals(folder.id)
                    .and(p => !context.allVersions.some(v => v.id === p.id))
                    .count();

                if (otherPromptsInFolder === 0) {
                    emptyingFolders.push(folder);
                }
            }

            this.log('Folder dependency check completed', {
                promptId: context.promptId,
                folderedVersions: folderedVersions.length,
                affectedFolders: folders.length,
                emptyingFolders: emptyingFolders.length
            });

            return {
                success: true,
                data: {
                    folderedVersions: folderedVersions,
                    folders: folders,
                    emptyingFolders: emptyingFolders
                }
            };
        } catch (error) {
            this.logError('Failed to check folder dependencies', error);
            return {
                success: false,
                error: `Folder dependency check failed: ${error.message}`,
                code: 'FOLDER_DEPENDENCY_ERROR'
            };
        }
    }

    /**
     * Check version sequence integrity
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Version sequence check result
     */
    async checkVersionSequenceIntegrity(context) {
        try {
            const versions = context.allVersions.sort((a, b) => a.version - b.version);

            // Check for version sequence gaps
            const versionNumbers = versions.map(v => v.version);
            const expectedSequence = Array.from({length: versions.length}, (_, i) => i + 1);
            const hasGaps = !versionNumbers.every((v, i) => v === expectedSequence[i]);

            // Check for latest version integrity
            const latestVersions = versions.filter(v => v.isLatest === 1);
            const hasMultipleLatest = latestVersions.length > 1;
            const hasNoLatest = latestVersions.length === 0;

            // Identify which versions will need resequencing after deletion
            const remainingVersions = versions.filter(v => v.id !== context.promptId);
            const needsResequencing = remainingVersions.length > 0 && (
                hasGaps ||
                hasMultipleLatest ||
                hasNoLatest ||
                context.prompt.isLatest === 1
            );

            this.log('Version sequence integrity check completed', {
                promptId: context.promptId,
                totalVersions: versions.length,
                hasGaps: hasGaps,
                hasMultipleLatest: hasMultipleLatest,
                hasNoLatest: hasNoLatest,
                needsResequencing: needsResequencing,
                remainingVersions: remainingVersions.length
            });

            return {
                success: true,
                data: {
                    versions: versions,
                    versionNumbers: versionNumbers,
                    hasGaps: hasGaps,
                    hasMultipleLatest: hasMultipleLatest,
                    hasNoLatest: hasNoLatest,
                    needsResequencing: needsResequencing,
                    remainingVersions: remainingVersions,
                    latestVersions: latestVersions
                }
            };
        } catch (error) {
            this.logError('Failed to check version sequence integrity', error);
            return {
                success: false,
                error: `Version sequence integrity check failed: ${error.message}`,
                code: 'SEQUENCE_INTEGRITY_ERROR'
            };
        }
    }

    /**
     * Public method to check dependencies without deletion
     * @param {Object} context - Context with promptId
     * @returns {Promise<Object>} Dependencies information
     */
    async checkDependencies(context) {
        // This method can be called independently to get dependency information
        const tagDeps = await this.checkTagDependencies(context);
        const folderDeps = await this.checkFolderDependencies(context);
        const sequenceDeps = await this.checkVersionSequenceIntegrity(context);

        return {
            tags: tagDeps.success ? tagDeps.data : null,
            folders: folderDeps.success ? folderDeps.data : null,
            sequence: sequenceDeps.success ? sequenceDeps.data : null,
            errors: [
                ...(tagDeps.success ? [] : [tagDeps.error]),
                ...(folderDeps.success ? [] : [folderDeps.error]),
                ...(sequenceDeps.success ? [] : [sequenceDeps.error])
            ]
        };
    }
}

export default DependencyHandler;