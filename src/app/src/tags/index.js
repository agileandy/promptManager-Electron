/**
 * Tag Command System - Main Export Module
 *
 * Exports all tag command classes and interfaces following the Command Pattern
 * with State Isolation as specified in the Tag Modification Architecture.
 */

import {
    TagCommandInterface,
    TagOperationResult,
    ValidationResult,
    TagOperationError
} from './TagCommandInterface.js';

import CreateTagCommand from './CreateTagCommand.js';
import DeleteTagCommand from './DeleteTagCommand.js';
import RenameTagCommand from './RenameTagCommand.js';
import { TagOnlyManager } from './TagOnlyManager.js';

/**
 * Tag Command Factory
 *
 * Factory class for creating tag command instances with proper validation
 */
class TagCommandFactory {
    /**
     * Create a tag command instance
     *
     * @param {string} commandType - Type of command to create
     * @param {Object} params - Command parameters
     * @returns {TagCommandInterface} Command instance
     * @throws {TagOperationError} When command type is invalid
     */
    static createCommand(commandType, params) {
        switch (commandType.toUpperCase()) {
            case 'CREATE_TAG':
            case 'CREATE':
                return new CreateTagCommand(params);

            case 'DELETE_TAG':
            case 'DELETE':
                return new DeleteTagCommand(params);

            case 'RENAME_TAG':
            case 'RENAME':
                return new RenameTagCommand(params);

            default:
                throw new TagOperationError(
                    `Unknown command type: ${commandType}`,
                    'INVALID_COMMAND_TYPE'
                );
        }
    }

    /**
     * Get list of supported command types
     *
     * @returns {string[]} Array of supported command types
     */
    static getSupportedCommands() {
        return ['CREATE_TAG', 'DELETE_TAG', 'RENAME_TAG'];
    }

    /**
     * Validate command type
     *
     * @param {string} commandType - Command type to validate
     * @returns {boolean} True if command type is supported
     */
    static isValidCommandType(commandType) {
        return this.getSupportedCommands().includes(commandType.toUpperCase());
    }
}

/**
 * Tag Command Executor
 *
 * Utility class for executing tag commands with proper context management
 */
class TagCommandExecutor {
    /**
     * Execute a tag command with context
     *
     * @param {TagCommandInterface} command - Command to execute
     * @param {Object} context - Execution context
     * @returns {Promise<TagOperationResult>} Execution result
     */
    static async execute(command, context) {
        if (!(command instanceof TagCommandInterface)) {
            return TagOperationResult.failure(
                new TagOperationError(
                    'Invalid command: must implement TagCommandInterface',
                    'INVALID_COMMAND'
                )
            );
        }

        // Validate context has required dependencies
        const requiredContextKeys = ['tagStateManager', 'eventPublisher', 'transactionManager'];
        const missingKeys = requiredContextKeys.filter(key => !context[key]);

        if (missingKeys.length > 0) {
            return TagOperationResult.failure(
                new TagOperationError(
                    `Missing required context dependencies: ${missingKeys.join(', ')}`,
                    'INVALID_CONTEXT'
                )
            );
        }

        try {
            return await command.executeWithContext(context);
        } catch (error) {
            return TagOperationResult.failure(
                new TagOperationError(
                    `Command execution failed: ${error.message}`,
                    'EXECUTION_ERROR',
                    { originalError: error }
                )
            );
        }
    }

    /**
     * Execute multiple commands in sequence
     *
     * @param {TagCommandInterface[]} commands - Commands to execute
     * @param {Object} context - Execution context
     * @returns {Promise<TagOperationResult[]>} Array of execution results
     */
    static async executeSequence(commands, context) {
        const results = [];

        for (const command of commands) {
            const result = await this.execute(command, context);
            results.push(result);

            // Stop execution if a command fails
            if (!result.success) {
                break;
            }
        }

        return results;
    }
}

export {
    // Core interfaces and classes
    TagCommandInterface,
    TagOperationResult,
    ValidationResult,
    TagOperationError,

    // Command implementations
    CreateTagCommand,
    DeleteTagCommand,
    RenameTagCommand,

    // Tag Manager
    TagOnlyManager,

    // Utility classes
    TagCommandFactory,
    TagCommandExecutor
};