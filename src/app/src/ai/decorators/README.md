# Decorator Chain for LLM Response Processing

This module implements a decorator chain pattern for processing LLM responses. It provides a flexible way to filter, transform, and enhance responses from language models.

## Overview

The decorator chain allows for:
- Sanitizing LLM responses by removing unwanted content
- Stripping XML tags and metadata
- Enhancing instruction clarity
- Applying multiple transformations in sequence

## Core Components

### DecoratorChainManager

The central class that manages the decorator chain. It:
- Maintains an ordered list of decorators
- Processes responses through each decorator in sequence
- Allows adding, removing, and reordering decorators
- Provides methods to enable/disable individual decorators or the entire chain

```javascript
const { decoratorChainManager } = require('./ai/decorators');

// Process a response
const processedResponse = decoratorChainManager.processResponse(originalResponse);
```

### BaseDecorator

The abstract base class for all decorators. Each decorator must:
- Implement the `process(response)` method
- Return the processed response

```javascript
const { BaseDecorator } = require('./ai/decorators');

class MyCustomDecorator extends BaseDecorator {
    constructor() {
        super();
        this.name = 'MyCustomDecorator';
        this.description = 'Performs custom processing on LLM responses';
    }

    process(response) {
        // Implement custom processing logic
        return modifiedResponse;
    }
}

// Add to the chain
decoratorChainManager.addDecorator(new MyCustomDecorator());
```

## Integration

The decorator chain is integrated with the OpenRouterProvider to automatically process all LLM responses. This ensures consistent handling of responses without requiring changes to other parts of the application.

## Future Enhancements

Future tasks will implement specific decorators for:
- Response sanitization (removing explanations)
- XML tag stripping (removing `<think>` tags)
- Instruction clarity enhancement