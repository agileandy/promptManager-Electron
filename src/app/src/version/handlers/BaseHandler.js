/**
 * BaseHandler.js
 *
 * Base class for Chain of Responsibility pattern handlers.
 * Provides common functionality for all version management handlers.
 */

class BaseHandler {
    constructor(database, stateManager) {
        this.db = database;
        this.stateManager = stateManager;
        this.nextHandler = null;
    }

    /**
     * Set the next handler in the chain
     * @param {BaseHandler} handler - The next handler
     * @returns {BaseHandler} The next handler for chaining
     */
    setNext(handler) {
        this.nextHandler = handler;
        return handler;
    }

    /**
     * Handle the request and pass to next handler if successful
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Result object
     */
    async handle(context) {
        try {
            // Execute this handler's logic
            const result = await this.execute(context);

            if (!result.success) {
                return result;
            }

            // If successful and there's a next handler, continue the chain
            if (this.nextHandler) {
                return await this.nextHandler.handle(context);
            }

            // If this is the last handler and successful, return success
            return { success: true, stage: this.getHandlerName() };
        } catch (error) {
            console.error(`Error in ${this.getHandlerName()}:`, error);
            return {
                success: false,
                error: error.message,
                stage: this.getHandlerName()
            };
        }
    }

    /**
     * Execute the specific logic for this handler
     * Must be implemented by subclasses
     * @param {Object} context - The deletion context
     * @returns {Promise<Object>} Result object
     */
    async execute(context) {
        throw new Error('execute() method must be implemented by subclasses');
    }

    /**
     * Get the name of this handler for logging/debugging
     * @returns {string} Handler name
     */
    getHandlerName() {
        return this.constructor.name;
    }

    /**
     * Log handler activity
     * @param {string} message - Log message
     * @param {Object} context - Current context
     */
    log(message, context = {}) {
        console.log(`[${this.getHandlerName()}] ${message}`, context);
    }

    /**
     * Log handler errors
     * @param {string} message - Error message
     * @param {Error} error - Error object
     */
    logError(message, error) {
        console.error(`[${this.getHandlerName()}] ${message}`, error);
    }
}

export default BaseHandler;