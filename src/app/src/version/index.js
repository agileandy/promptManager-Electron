/**
 * Version Management Module Index
 *
 * Exports all version management components for easy importing.
 * Part of Version Management Architecture Epic - Task 1
 */

const { VersionService } = require('./VersionService');
const { VersionStateManager } = require('./VersionStateManager');

// Handler exports
const BaseHandler = require('./handlers/BaseHandler');
const ValidationHandler = require('./handlers/ValidationHandler');
const DependencyHandler = require('./handlers/DependencyHandler');
const DeletionHandler = require('./handlers/DeletionHandler');

// Simple version management
const SimpleVersionManager = require('./SimpleVersionManager');

module.exports = {
    // Main service classes
    VersionService,
    VersionStateManager,

    // Handler classes
    BaseHandler,
    ValidationHandler,
    DependencyHandler,
    DeletionHandler,

    // Simple version management
    SimpleVersionManager
};
