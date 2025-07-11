/**
 * BaseDecorator
 * Base class for all response decorators in the chain
 * Each decorator should implement the process method
 */
class BaseDecorator {
    constructor() {
        this.name = 'BaseDecorator';
        this.description = 'Base decorator class';
        this.enabled = true;
    }

    /**
     * Process the LLM response
     * @param {string} response - The LLM response to process
     * @returns {string} The processed response
     */
    process(response) {
        // Base implementation just returns the original response
        // Subclasses should override this method
        return response;
    }

    /**
     * Enable or disable this decorator
     * @param {boolean} enabled - Whether the decorator is enabled
     */
    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
    }

    /**
     * Check if this decorator is enabled
     * @returns {boolean} Whether the decorator is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get decorator name
     * @returns {string} Decorator name
     */
    getName() {
        return this.name;
    }

    /**
     * Get decorator description
     * @returns {string} Decorator description
     */
    getDescription() {
        return this.description;
    }
}

module.exports = { BaseDecorator };