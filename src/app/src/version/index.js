/**
 * Version Management Module Index
 *
 * Exports all version management components for easy importing.
 * Part of Version Management Architecture Epic - Task 1
 */

import { VersionService } from './VersionService.js';
import { VersionStateManager } from './VersionStateManager.js';

// Handler exports
import BaseHandler from './handlers/BaseHandler.js';
import ValidationHandler from './handlers/ValidationHandler.js';
import DependencyHandler from './handlers/DependencyHandler.js';
import DeletionHandler from './handlers/DeletionHandler.js';

// Simple version management
import * as SimpleVersionManager from './SimpleVersionManager.js';

export {
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
