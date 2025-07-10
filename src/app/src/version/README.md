# Version Management Architecture

This module implements the Chain of Responsibility pattern for version management operations, specifically focusing on version deletion with proper validation, dependency checking, and referential integrity.

## Architecture Overview

The version management system follows the Chain of Responsibility design pattern to ensure structured and reliable version operations. Each handler in the chain performs specific validation or operation steps before passing control to the next handler.

## Components

### Core Services

#### VersionService
- **Purpose**: Main service class that orchestrates version management operations
- **Responsibilities**:
  - Initialize and manage the Chain of Responsibility
  - Provide public API for version operations
  - Handle service-level error management
- **Key Methods**:
  - `deleteVersion(promptId, options)`: Delete a version using the chain
  - `getVersionInfo(promptId)`: Get version information
  - `getVersionDependencies(promptId)`: Get dependency information

#### VersionStateManager
- **Purpose**: Manages version state and ensures database integrity
- **Responsibilities**:
  - Validate database state for version integrity
  - Track operation history
  - Emit events for version operations
  - Repair database state issues
- **Key Methods**:
  - `validateDatabaseState()`: Check for integrity issues
  - `notifyVersionDeleted(context)`: Handle deletion notifications
  - `repairDatabaseState(issues)`: Fix database integrity issues

### Chain of Responsibility Handlers

#### BaseHandler
- **Purpose**: Abstract base class for all handlers
- **Responsibilities**:
  - Define common handler interface
  - Manage chain progression
  - Provide error handling framework
- **Key Methods**:
  - `handle(context)`: Process request and pass to next handler
  - `execute(context)`: Abstract method for handler-specific logic
  - `setNext(handler)`: Set the next handler in the chain

#### ValidationHandler
- **Purpose**: First handler - performs validation checks
- **Responsibilities**:
  - Validate prompt existence
  - Check user permissions (placeholder for future)
  - Validate deletion constraints
- **Validation Checks**:
  - Prompt exists in database
  - User has deletion permissions
  - No protection flags prevent deletion
  - System constraints allow deletion

#### DependencyHandler
- **Purpose**: Second handler - checks dependencies and referential integrity
- **Responsibilities**:
  - Check tag dependencies
  - Check folder dependencies
  - Analyze version sequence integrity
  - Identify orphaned relationships
- **Dependency Checks**:
  - Tag relationships that will be affected
  - Tags that will become orphaned
  - Folders that will become empty
  - Version sequence gaps and resequencing needs

#### DeletionHandler
- **Purpose**: Final handler - performs actual deletion operations
- **Responsibilities**:
  - Execute atomic deletion operations
  - Handle version resequencing
  - Clean up orphaned dependencies
  - Maintain referential integrity
- **Operations**:
  - Delete prompt versions and related data
  - Resequence remaining versions
  - Clean up orphaned tags (if configured)
  - Update latest version flags

## Chain Flow

```
Request → ValidationHandler → DependencyHandler → DeletionHandler → Success
            ↓                    ↓                   ↓
          Failure              Failure            Failure
            ↓                    ↓                   ↓
          Return Error        Return Error      Return Error
```

## Usage Examples

### Basic Version Deletion

```javascript
const { VersionService, VersionStateManager } = require('./src/version');

// Initialize services
const stateManager = new VersionStateManager(database);
await stateManager.initialize();

const versionService = new VersionService(database, stateManager);

// Delete a specific version
const result = await versionService.deleteVersion(promptId, {
    deleteAllVersions: false,
    cleanupOrphanedTags: true
});

if (result.success) {
    console.log('Version deleted successfully');
} else {
    console.error('Deletion failed:', result.error);
}
```

### Delete All Versions

```javascript
const result = await versionService.deleteVersion(promptId, {
    deleteAllVersions: true,
    cleanupOrphanedTags: true
});
```

### Get Version Information

```javascript
const info = await versionService.getVersionInfo(promptId);
console.log(`Total versions: ${info.totalVersions}`);
console.log(`Is latest: ${info.isLatestVersion}`);
```

### Check Dependencies

```javascript
const deps = await versionService.getVersionDependencies(promptId);
console.log('Orphaned tags:', deps.dependencies.tags.orphanedTags);
console.log('Affected folders:', deps.dependencies.folders.emptyingFolders);
```

## Integration with Main Process

The version management system integrates with the Electron main process through IPC handlers:

- `version-initialize`: Initialize version management services
- `version-delete`: Delete version using Chain of Responsibility
- `version-get-info`: Get version information
- `version-get-dependencies`: Get dependency information
- `version-init-with-db`: Initialize services with database proxy
- `version-validate-state`: Validate database state
- `version-repair-state`: Repair database state issues

## Error Handling

The system provides comprehensive error handling at multiple levels:

1. **Service Level**: VersionService catches and wraps all errors
2. **Handler Level**: Each handler manages its own error conditions
3. **Chain Level**: Failed handlers stop chain progression
4. **Integration Level**: IPC handlers provide fallback error responses

## Testing

Comprehensive unit tests are provided in `tests/VersionService.test.js`:

- Mock database and state manager implementations
- Tests for each handler in isolation
- Integration tests for the complete chain
- Error handling and edge case testing

Run tests with:
```javascript
const { VersionServiceTests } = require('./tests/VersionService.test.js');
const tests = new VersionServiceTests();
await tests.runAllTests();
```

## Configuration Options

### Deletion Options

- `deleteAllVersions`: Boolean - Delete all versions or just the specified one
- `cleanupOrphanedTags`: Boolean - Remove tags that become orphaned
- `validateConstraints`: Boolean - Perform additional constraint validation

### State Manager Options

- `maxHistorySize`: Number - Maximum operation history entries to keep
- `enableEventLogging`: Boolean - Enable detailed event logging
- `autoRepair`: Boolean - Automatically repair minor database issues

## Future Enhancements

1. **Permission System**: Implement user-based deletion permissions
2. **Backup Integration**: Create backups before major deletions
3. **Undo Functionality**: Allow reversal of deletion operations
4. **Batch Operations**: Support bulk version deletions
5. **Advanced Constraints**: More sophisticated deletion rules
6. **Audit Trail**: Detailed logging of all version operations

## Database Schema Requirements

The system expects the following database structure:

### prompts table
- `id`: Primary key
- `title`: Prompt title
- `text`: Prompt content
- `version`: Version number
- `isLatest`: Boolean flag (1 for latest, 0 for older)
- `parentId`: Reference to original prompt (null for first version)
- `createdAt`: Creation timestamp
- `folderId`: Optional folder reference

### promptTags table
- `id`: Primary key
- `promptId`: Reference to prompt
- `tagId`: Reference to tag

### tags table
- `id`: Primary key
- `name`: Tag name
- `fullPath`: Full hierarchical path

### folders table
- `id`: Primary key
- `name`: Folder name
- `parentId`: Parent folder reference

## Performance Considerations

- Handlers execute sequentially, not in parallel
- Database operations are batched where possible
- Large version families may require optimization
- Consider indexing on `parentId` and `isLatest` fields
- Memory usage scales with version count per prompt family

## Security Considerations

- All database operations use parameterized queries
- Input validation prevents injection attacks
- Permission checks prevent unauthorized deletions
- Audit trail maintains operation accountability