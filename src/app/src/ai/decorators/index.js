/**
 * Decorators Module Index
 * Exports all decorator-related classes
 */
const { BaseDecorator } = require('./BaseDecorator');
const { DecoratorChainManager } = require('./DecoratorChainManager');
const { ResponseSanitizationDecorator } = require('./ResponseSanitizationDecorator');

// Export a singleton instance of the DecoratorChainManager
const decoratorChainManager = new DecoratorChainManager();

module.exports = {
    BaseDecorator,
    DecoratorChainManager,
    ResponseSanitizationDecorator,
    decoratorChainManager
};