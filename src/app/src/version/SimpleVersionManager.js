/**
 * Simple Version Management with Resequencing
 *
 * Provides simplified version management functions focused on:
 * - Deleting prompts with version resequencing
 * - Resequencing version numbers to be contiguous
 * - Deleting specific versions of a prompt
 */

// Delete prompt with version resequencing
async function deletePromptWithResequencing(db, renderPrompts, promptId) {
    try {
        const promptToDelete = await db.prompts.get(promptId);
        if (!promptToDelete) {
            alert('Prompt not found');
            return;
        }

        const parentId = promptToDelete.parentId || promptId;

        // Get all versions of this prompt family
        const allVersions = await db.prompts
            .where('parentId').equals(parentId)
            .or('id').equals(parentId)
            .toArray();

        // Delete all versions and their tag relationships
        await db.prompts.where('parentId').equals(parentId).or('id').equals(parentId).delete();

        // Delete tag relationships for all versions
        const versionIds = allVersions.map(v => v.id);
        await db.promptTags.where('promptId').anyOf(versionIds).delete();

        console.log(`Deleted prompt family with ${allVersions.length} versions`);

        // Resequence all remaining prompts to ensure contiguous version numbers
        await resequenceAllVersions(db);

        // Refresh the display
        await renderPrompts();
    } catch (error) {
        console.error('Failed to delete prompt with resequencing:', error);
        alert('Failed to delete prompt. Please try again.');
    }
}

// Resequence all version numbers to be contiguous
async function resequenceAllVersions(db) {
    try {
        console.log('Starting version resequencing...');

        // Get all prompts grouped by parent family
        const allPrompts = await db.prompts.toArray();
        const promptFamilies = new Map();

        // Group prompts by family (parentId or original id)
        for (const prompt of allPrompts) {
            const familyId = prompt.parentId || prompt.id;
            if (!promptFamilies.has(familyId)) {
                promptFamilies.set(familyId, []);
            }
            promptFamilies.get(familyId).push(prompt);
        }

        // Resequence each family
        for (const [familyId, family] of promptFamilies) {
            if (family.length <= 1) continue; // Skip single-version families

            // Sort by creation date to maintain chronological order
            family.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            // Resequence version numbers
            for (let i = 0; i < family.length; i++) {
                const prompt = family[i];
                const newVersion = i + 1;
                const isLatest = i === family.length - 1;

                if (prompt.version !== newVersion || prompt.isLatest !== (isLatest ? 1 : 0)) {
                    await db.prompts.update(prompt.id, {
                        version: newVersion,
                        isLatest: isLatest ? 1 : 0
                    });

                    console.log(`Updated prompt ${prompt.id}: version ${prompt.version} -> ${newVersion}, isLatest: ${isLatest}`);
                }
            }
        }

        console.log('Version resequencing completed');
    } catch (error) {
        console.error('Failed to resequence versions:', error);
    }
}

// Delete a specific version of a prompt
async function deletePromptVersion(db, versionId) {
    try {
        // Get the prompt to delete
        const promptToDelete = await db.prompts.get(versionId);
        if (!promptToDelete) {
            alert('Version not found');
            return;
        }

        // Get the parent ID
        const parentId = promptToDelete.parentId || promptToDelete.id;

        // Delete the version
        await db.prompts.delete(versionId);

        // Delete tag relationships for this version
        await db.promptTags.where('promptId').equals(versionId).delete();

        // Resequence all remaining versions
        await resequenceAllVersions(db);

        console.log(`Deleted version ${promptToDelete.version} (ID: ${versionId})`);

        return parentId; // Return the parent ID for refreshing the history view
    } catch (error) {
        console.error('Failed to delete version:', error);
        alert('Failed to delete version. Please try again.');
        return null;
    }
}

// Export the functions using ES modules
export {
    deletePromptWithResequencing,
    resequenceAllVersions,
    deletePromptVersion
};
