/**
 * Tag Command Interface
 *
 * Base interface for all tag modification commands following the Command Pattern.
 * Provides state isolation between tag operations and versioning as per ADR-001.
 *
 * @interface TagCommandInterface
 */
class TagCommandInterface {
    /**
     * Execute the tag command with proper state isolation
     *
     * @param {Object} context - Execution context containing state and dependencies
     * @param {Object} context.tagStateManager - Tag state management service
     * @param {Object} context.eventPublisher - Event publishing service for UI updates
     * @param {Object} context.transactionManager - Database transaction manager
     * @returns {Promise<TagOperationResult>} Result of the tag operation
     * @throws {TagOperationError} When operation fails validation or execution
     */
    async executeWithContext(context) {
        throw new Error('executeWithContext must be implemented by concrete command classes');
    }

    /**
     * Validate the command parameters before execution
     *
     * @param {Object} params - Command-specific parameters
     * @returns {ValidationResult} Validation result with success/failure and messages
     */
    validate(params) {
        throw new Error('validate must be implemented by concrete command classes');
    }

    /**
     * Get the command type identifier
     *
     * @returns {string} Command type for logging and event tracking
     */
    getCommandType() {
        throw new Error('getCommandType must be implemented by concrete command classes');
    }

    /**
     * Check if the command can be undone
     *
     * @returns {boolean} True if command supports undo operations
     */
    isUndoable() {
        return false; // Default implementation - override in concrete classes
    }

    /**
     * Create undo command if supported
     *
     * @param {TagOperationResult} executionResult - Result from the original execution
     * @returns {TagCommandInterface|null} Undo command or null if not supported
     */
    createUndoCommand(executionResult) {
        return null; // Default implementation - override in concrete classes
    }
}

/**
 * Tag Operation Result
 *
 * Standardized result object for all tag operations
 */
class TagOperationResult {
    constructor(success, data = null, error = null, metadata = {}) {
        this.success = success;
        this.data = data;
        this.error = error;
        this.metadata = {
            timestamp: new Date().toISOString(),
            ...metadata
        };
    }

    /**
     * Create a successful result
     *
     * @param {*} data - Operation result data
     * @param {Object} metadata - Additional metadata
     * @returns {TagOperationResult}
     */
    static success(data, metadata = {}) {
        return new TagOperationResult(true, data, null, metadata);
    }

    /**
     * Create a failure result
     *
     * @param {Error|string} error - Error information
     * @param {Object} metadata - Additional metadata
     * @returns {TagOperationResult}
     */
    static failure(error, metadata = {}) {
        const errorObj = error instanceof Error ? error : new Error(error);
        return new TagOperationResult(false, null, errorObj, metadata);
    }
}

/**
 * Validation Result
 *
 * Result object for command parameter validation
 */
class ValidationResult {
    constructor(isValid, messages = []) {
        this.isValid = isValid;
        this.messages = messages;
    }

    /**
     * Create a valid result
     *
     * @returns {ValidationResult}
     */
    static valid() {
        return new ValidationResult(true);
    }

    /**
     * Create an invalid result with error messages
     *
     * @param {string|string[]} messages - Validation error messages
     * @returns {ValidationResult}
     */
    static invalid(messages) {
        const messageArray = Array.isArray(messages) ? messages : [messages];
        return new ValidationResult(false, messageArray);
    }
}

/**
 * Tag Operation Error
 *
 * Custom error class for tag operation failures
 */
class TagOperationError extends Error {
    constructor(message, code = 'TAG_OPERATION_ERROR', details = {}) {
        super(message);
        this.name = 'TagOperationError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

module.exports = {
    TagCommandInterface,
    TagOperationResult,
    ValidationResult,
    TagOperationError
};