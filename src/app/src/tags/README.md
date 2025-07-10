# Tag Command System

This module implements the Tag Modification Architecture using the Command Pattern with State Isolation, as specified in the system architecture blueprint.

## Overview

The Tag Command System provides a clean, isolated interface for tag operations that separates tag modifications from content versioning, following ADR-001 (Tag-Only Modification Interface).

## Architecture

### Core Components

- **TagCommandInterface**: Base interface for all tag commands
- **CreateTagCommand**: Creates new tags with validation
- **DeleteTagCommand**: Deletes tags with rollback capability
- **RenameTagCommand**: Renames tags with reference updates
- **TagCommandFactory**: Factory for creating command instances
- **TagCommandExecutor**: Utility for executing commands with context

### Design Patterns

- **Command Pattern**: Encapsulates tag operations as objects
- **State Isolation**: Separates tag operations from version management
- **Event-Driven Architecture**: Publishes events for UI synchronization
- **Transaction Management**: Ensures atomic operations

## Usage

### Basic Command Execution

```javascript
const { CreateTagCommand, TagCommandExecutor } = require('./tags');

// Create execution context
const context = {
    tagStateManager: tagStateManager,
    eventPublisher: eventPublisher,
    transactionManager: transactionManager
};

// Create and execute command
const command = new CreateTagCommand({
    tagName: 'Important',
    tagColor: '#ff6b6b',
    description: 'High priority items'
});

const result = await TagCommandExecutor.execute(command, context);

if (result.success) {
    console.log('Tag created:', result.data);
} else {
    console.error('Failed:', result.error.message);
}
```

### Using the Factory

```javascript
const { TagCommandFactory } = require('./tags');

// Create commands using factory
const createCmd = TagCommandFactory.createCommand('CREATE_TAG', {
    tagName: 'New Tag',
    tagColor: '#007bff'
});

const deleteCmd = TagCommandFactory.createCommand('DELETE_TAG', {
    tagId: 'tag_123',
    forceDelete: false
});

const renameCmd = TagCommandFactory.createCommand('RENAME_TAG', {
    tagId: 'tag_123',
    currentName: 'Old Name',
    newName: 'New Name'
});
```

### Undo Operations

```javascript
// Execute a command
const result = await TagCommandExecutor.execute(createCommand, context);

// Create undo command if needed
if (result.success && createCommand.isUndoable()) {
    const undoCommand = createCommand.createUndoCommand(result);
    // Store undo command for later use
}
```

## Command Types

### CreateTagCommand

Creates a new tag with the following parameters:

- `tagName` (required): Name of the tag
- `tagColor` (optional): Hex color code (default: #007bff)
- `description` (optional): Tag description
- `promptIds` (optional): Array of prompt IDs to associate

**Validation Rules:**
- Tag name: 1-50 characters, alphanumeric + spaces/hyphens/underscores
- Color: Valid hex format (#RRGGBB)
- Description: Max 200 characters

### DeleteTagCommand

Deletes an existing tag with the following parameters:

- `tagId` (required): ID of the tag to delete
- `tagName` (optional): Name for validation
- `forceDelete` (optional): Delete even if prompts are associated

**Features:**
- Rollback snapshot creation
- Association cleanup
- Force delete option for tags with prompts

### RenameTagCommand

Renames an existing tag with the following parameters:

- `tagId` (required): ID of the tag to rename
- `currentName` (optional): Current name for validation
- `newName` (required): New name for the tag
- `updateReferences` (optional): Update references in prompts (default: true)

**Features:**
- Name conflict detection
- Reference updates in prompt content
- Immutable history maintenance

## Context Dependencies

All commands require an execution context with:

- **tagStateManager**: Handles tag persistence and queries
- **eventPublisher**: Publishes events for UI synchronization
- **transactionManager**: Manages database transactions

## Error Handling

The system uses structured error handling with:

- **TagOperationError**: Custom error class with error codes
- **ValidationResult**: Structured validation feedback
- **TagOperationResult**: Standardized operation results

## Testing

Run the comprehensive test suite:

```bash
node src/app/src/tags/TagCommandTest.js
```

The test suite includes:
- Command execution tests
- Validation error handling
- Factory pattern validation
- Undo operation testing
- Mock dependencies for isolated testing

## Integration

This module integrates with:

- **Tag State Manager**: For tag persistence
- **Event Publisher**: For UI synchronization
- **Transaction Manager**: For atomic operations
- **UI Components**: Through event subscriptions

## State Isolation

The system maintains strict state isolation by:

- Separating tag operations from content versioning
- Using isolated transactions for tag modifications
- Publishing events outside transaction boundaries
- Maintaining immutable rollback snapshots

This ensures that tag modifications don't create unnecessary content versions while maintaining data consistency and providing undo capabilities.