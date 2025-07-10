/**
 * ValidationHandler.js
 *
 * First handler in the Chain of Responsibility for version deletion.
 * Performs validation checks before allowing deletion to proceed.
 */

const BaseHandler = require('./BaseHandler');

class ValidationHandler extends BaseHandler {
    /**
     * Execute validation logic
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Validation result
     */
    async execute(context) {
        this.log('Starting validation checks', { promptId: context.promptId });

        // Validate prompt exists
        const promptValidation = await this.validatePromptExists(context);
        if (!promptValidation.success) {
            return promptValidation;
        }

        // Validate user permissions (placeholder for future implementation)
        const permissionValidation = await this.validatePermissions(context);
        if (!permissionValidation.success) {
            return permissionValidation;
        }

        // Validate deletion constraints
        const constraintValidation = await this.validateDeletionConstraints(context);
        if (!constraintValidation.success) {
            return constraintValidation;
        }

        // Store validation results in context
        context.validationResults = {
            promptExists: true,
            hasPermissions: true,
            constraintsPassed: true,
            validatedAt: new Date()
        };

        this.log('All validation checks passed', { promptId: context.promptId });
        return { success: true };
    }

    /**
     * Validate that the prompt exists and populate context
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Validation result
     */
    async validatePromptExists(context) {
        try {
            const prompt = await this.db.prompts.get(context.promptId);

            if (!prompt) {
                return {
                    success: false,
                    error: `Prompt with ID ${context.promptId} not found`,
                    code: 'PROMPT_NOT_FOUND'
                };
            }

            // Populate context with prompt information
            context.prompt = prompt;
            context.parentId = prompt.parentId || context.promptId;

            // Get all versions of this prompt
            const allVersions = await this.db.prompts
                .where('parentId').equals(context.parentId)
                .or('id').equals(context.parentId)
                .toArray();

            context.allVersions = allVersions;

            this.log('Prompt validation passed', {
                promptId: context.promptId,
                parentId: context.parentId,
                totalVersions: allVersions.length,
                isLatest: prompt.isLatest === 1
            });

            return { success: true };
        } catch (error) {
            this.logError('Failed to validate prompt existence', error);
            return {
                success: false,
                error: `Database error during prompt validation: ${error.message}`,
                code: 'DATABASE_ERROR'
            };
        }
    }

    /**
     * Validate user permissions for deletion
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Validation result
     */
    async validatePermissions(context) {
        // Placeholder for future permission system
        // For now, all deletions are allowed

        this.log('Permission validation passed (no restrictions currently)', {
            promptId: context.promptId
        });

        return { success: true };
    }

    /**
     * Validate deletion constraints
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Validation result
     */
    async validateDeletionConstraints(context) {
        try {
            // Check if this is the only version and has special constraints
            if (context.allVersions.length === 1) {
                // Single version - check if it has special protection
                const hasProtection = await this.checkProtectionFlags(context.prompt);
                if (hasProtection) {
                    return {
                        success: false,
                        error: 'This prompt is protected and cannot be deleted',
                        code: 'PROTECTED_PROMPT'
                    };
                }
            }

            // Check for system constraints (e.g., recently used, high usage count)
            const constraintCheck = await this.checkSystemConstraints(context.prompt);
            if (!constraintCheck.success) {
                return constraintCheck;
            }

            this.log('Deletion constraints validation passed', {
                promptId: context.promptId,
                versionsCount: context.allVersions.length
            });

            return { success: true };
        } catch (error) {
            this.logError('Failed to validate deletion constraints', error);
            return {
                success: false,
                error: `Constraint validation error: ${error.message}`,
                code: 'CONSTRAINT_ERROR'
            };
        }
    }

    /**
     * Check if prompt has protection flags
     * @param {Object} prompt - The prompt object
     * @returns {Promise<boolean>} True if protected
     */
    async checkProtectionFlags(prompt) {
        // Future implementation: check for protection flags
        // For now, no prompts are protected
        return false;
    }

    /**
     * Check system-level constraints
     * @param {Object} prompt - The prompt object
     * @returns {Promise<Object>} Constraint check result
     */
    async checkSystemConstraints(prompt) {
        // Example constraints that could be implemented:

        // 1. Recently used constraint (within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (prompt.lastUsedAt && new Date(prompt.lastUsedAt) > oneHourAgo) {
            // For now, just log but don't block
            this.log('Warning: Prompt was recently used', {
                promptId: prompt.id,
                lastUsedAt: prompt.lastUsedAt
            });
        }

        // 2. High usage constraint
        if (prompt.timesUsed && prompt.timesUsed > 100) {
            // For now, just log but don't block
            this.log('Warning: Prompt has high usage count', {
                promptId: prompt.id,
                timesUsed: prompt.timesUsed
            });
        }

        // All constraints pass for now
        return { success: true };
    }
}

module.exports = ValidationHandler;