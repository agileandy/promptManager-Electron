# Documentation Index

This document provides a comprehensive overview of all available documentation for the AI Prompt Manager project.

## Quick Navigation

### 🚀 Getting Started
- **[README.md](README.md)** - Project overview, features, and basic setup
- **[QUICK_START.md](QUICK_START.md)** - Step-by-step installation and usage guide

### 📖 Understanding the Code  
- **[CODE_EXPLANATION.md](CODE_EXPLANATION.md)** - Complete codebase explanation with examples
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture, design patterns, and data flow
- **[API_REFERENCE.md](API_REFERENCE.md)** - Detailed API documentation for all modules

## Documentation Overview

### 1. README.md
**Purpose**: Project introduction and feature overview  
**Audience**: All users - developers, contributors, and end users  
**Contains**:
- Feature descriptions with screenshots
- Basic installation instructions
- Usage examples
- Changelog and version history

### 2. QUICK_START.md  
**Purpose**: Get users up and running quickly  
**Audience**: New users and developers  
**Contains**:
- Prerequisites and installation steps
- First-time setup instructions
- Core feature walkthroughs
- Common workflows and troubleshooting

### 3. CODE_EXPLANATION.md
**Purpose**: Comprehensive technical documentation  
**Audience**: Developers and contributors  
**Contains**:
- Application architecture overview
- Core component explanations
- Database design and relationships
- Key systems (AI, tags, version control)
- Design patterns used throughout
- Development setup and coding conventions

### 4. ARCHITECTURE.md
**Purpose**: Deep dive into system architecture  
**Audience**: Senior developers and architects  
**Contains**:
- Multi-layered architecture diagrams
- Component interaction patterns
- Data flow documentation
- Security architecture
- Performance considerations
- Scalability patterns

### 5. API_REFERENCE.md
**Purpose**: Complete API documentation  
**Audience**: Developers extending or integrating with the application  
**Contains**:
- Database API with schema and operations
- AI Service API with examples
- Tag Management API
- Version Control API
- IPC Communication patterns
- Configuration management

## Key Concepts Explained

### Application Architecture
The AI Prompt Manager uses a **multi-layered Electron architecture**:

```
User Interface (HTML/CSS/JS)
         ↓
Renderer Process (Application Logic)
         ↓
IPC Communication (Secure Bridge)
         ↓
Main Process (System Integration)
         ↓
External Services (AI APIs, File System)
```

### Core Systems

1. **Prompt Management**
   - CRUD operations for AI prompts
   - Full-text search capabilities
   - Usage tracking and statistics

2. **Hierarchical Tag System**
   - Tree-structured organization
   - Automatic parent/child relationships
   - Smart counting with rollup

3. **Version Control**
   - Automatic versioning on edits
   - Dependency tracking
   - Chain of Responsibility deletion

4. **AI Integration**
   - Multiple provider support (OpenRouter, Ollama)
   - Decorator pattern for response processing
   - Configuration-driven behavior

### Design Patterns Used

- **Chain of Responsibility**: Version deletion handling
- **Command Pattern**: Tag operations
- **Strategy Pattern**: AI provider selection
- **Decorator Pattern**: Response processing pipeline
- **Observer Pattern**: UI updates and event handling

### Data Storage

- **Database**: IndexedDB via Dexie.js
- **Configuration**: JSON files in user data directory
- **Security**: Process isolation and context isolation

## Code Organization

```
src/app/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge  
├── index.html           # Main UI
├── src/
│   ├── renderer.js      # Application coordinator
│   ├── ai/              # AI integration system
│   ├── tags/            # Tag management system
│   ├── version/         # Version control system
│   └── prompts/         # Prompt management
└── assets/              # Static resources
```

## Development Workflow

### Setting Up Development Environment
1. Clone repository
2. Install dependencies: `npm install`
3. Run in development mode: `npm run dev`
4. Use built-in Database Viewer for debugging

### Making Changes
1. Follow architectural patterns documented
2. Add unit tests for new functionality
3. Update documentation as needed
4. Test across different scenarios

### Testing Strategy
- Unit tests for individual components
- Integration tests for system interactions
- Manual testing with real AI providers
- Database integrity validation

## Advanced Topics

### Security Considerations
- Process isolation between main and renderer
- Context isolation for secure IPC
- Content Security Policy implementation
- API key protection and validation

### Performance Optimization
- Indexed database queries
- Debounced search operations
- Virtual scrolling for large datasets
- Memory management and cleanup

### Extension Points
- New AI providers via BaseProvider interface
- Custom tag operations via Command pattern
- Additional response processors via Decorator pattern
- New version handlers via Chain of Responsibility

## Troubleshooting Guide

### Common Issues
1. **AI services not working**: Check API keys and network connectivity
2. **Database performance**: Use Database Viewer to inspect data size
3. **UI not updating**: Check console for JavaScript errors
4. **Tags not counting**: Verify tag hierarchy integrity

### Debugging Tools
- Built-in Database Viewer (Help → View Database)
- Console logging throughout application
- Electron DevTools for UI debugging
- IPC communication monitoring

## Contributing Guidelines

### Before Contributing
1. Read through CODE_EXPLANATION.md for architecture understanding
2. Review ARCHITECTURE.md for design patterns
3. Check API_REFERENCE.md for implementation details
4. Follow existing code patterns and conventions

### Code Quality Standards
- Follow established architectural patterns
- Add comprehensive error handling
- Include unit tests for new features
- Document new APIs and interfaces
- Maintain backward compatibility

### Pull Request Process
1. Create feature branch from main
2. Implement changes following patterns
3. Add/update documentation as needed
4. Test thoroughly including edge cases
5. Submit PR with clear description

## Future Enhancements

The documentation supports future development in areas like:
- Additional AI providers
- Enhanced version control features
- Advanced tag operations
- Performance optimizations
- UI/UX improvements
- Integration with external systems

## Support and Questions

For questions about the codebase:
1. Start with QUICK_START.md for basic usage
2. Check CODE_EXPLANATION.md for implementation details
3. Review ARCHITECTURE.md for design decisions
4. Consult API_REFERENCE.md for specific APIs
5. Use built-in debugging tools for troubleshooting

This comprehensive documentation suite ensures that anyone can understand, use, extend, and contribute to the AI Prompt Manager project effectively.