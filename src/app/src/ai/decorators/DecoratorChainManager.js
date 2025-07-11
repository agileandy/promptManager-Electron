/**
 * DecoratorChainManager
 * Manages a chain of decorators for processing LLM responses
 * Decorators are executed in the order they are added to the chain
 */
class DecoratorChainManager {
    constructor() {
        this.decorators = [];
        this.enabled = true;
    }

    /**
     * Add a decorator to the chain
     * @param {BaseDecorator} decorator - The decorator to add
     * @returns {DecoratorChainManager} This instance for chaining
     */
    addDecorator(decorator) {
        if (!decorator || typeof decorator.process !== 'function') {
            throw new Error('Invalid decorator: must implement process method');
        }

        this.decorators.push(decorator);
        return this;
    }

    /**
     * Remove a decorator from the chain
     * @param {string|BaseDecorator} decoratorOrName - The decorator or decorator name to remove
     * @returns {boolean} True if the decorator was removed, false otherwise
     */
    removeDecorator(decoratorOrName) {
        const name = typeof decoratorOrName === 'string'
            ? decoratorOrName
            : decoratorOrName.getName();

        const initialLength = this.decorators.length;
        this.decorators = this.decorators.filter(d => d.getName() !== name);

        return this.decorators.length < initialLength;
    }

    /**
     * Process a response through the decorator chain
     * @param {string} response - The LLM response to process
     * @returns {string} The processed response
     */
    processResponse(response) {
        if (!this.enabled || !response) {
            return response;
        }

        let processedResponse = response;

        for (const decorator of this.decorators) {
            if (decorator.isEnabled()) {
                try {
                    processedResponse = decorator.process(processedResponse);
                } catch (error) {
                    console.error(`Error in decorator ${decorator.getName()}:`, error);
                    // Continue with the chain even if one decorator fails
                }
            }
        }

        return processedResponse;
    }

    /**
     * Enable or disable the entire decorator chain
     * @param {boolean} enabled - Whether the chain is enabled
     */
    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
    }

    /**
     * Check if the decorator chain is enabled
     * @returns {boolean} Whether the chain is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get all decorators in the chain
     * @returns {Array} Array of decorators
     */
    getDecorators() {
        return [...this.decorators];
    }

    /**
     * Get a decorator by name
     * @param {string} name - The name of the decorator to get
     * @returns {BaseDecorator|null} The decorator or null if not found
     */
    getDecorator(name) {
        return this.decorators.find(d => d.getName() === name) || null;
    }

    /**
     * Clear all decorators from the chain
     */
    clearDecorators() {
        this.decorators = [];
    }

    /**
     * Reorder decorators in the chain
     * @param {Array} newOrder - Array of decorator names in the desired order
     * @returns {boolean} True if reordering was successful
     */
    reorderDecorators(newOrder) {
        if (!Array.isArray(newOrder)) {
            return false;
        }

        // Create a map of decorators by name
        const decoratorMap = new Map();
        this.decorators.forEach(d => decoratorMap.set(d.getName(), d));

        // Create a new array based on the new order
        const newDecorators = [];

        for (const name of newOrder) {
            const decorator = decoratorMap.get(name);
            if (decorator) {
                newDecorators.push(decorator);
                decoratorMap.delete(name);
            }
        }

        // Add any remaining decorators not in the new order
        decoratorMap.forEach(decorator => newDecorators.push(decorator));

        // Update the decorators array
        this.decorators = newDecorators;
        return true;
    }
}

module.exports = { DecoratorChainManager };