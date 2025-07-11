# AI Prompt Manager

A desktop application built with Electron for managing and organizing AI prompts with advanced tagging, version control, and AI-powered prompt generation.

<img width="1844" height="1067" alt="image" src="https://github.com/user-attachments/assets/c3888cfe-2031-41e0-95c0-edc0a1949636" />


## Features

### Core Functionality
- **Create and manage AI prompts** with titles, descriptions, and content
- **Hierarchical tag system** for organizing prompts by category
- **Version control** - Edit prompts while keeping history of changes
- **Search functionality** - Find prompts by title or content
- **Import/Export** - Backup and share your prompts as JSON files
- **Dark/Light theme** toggle for comfortable viewing
- **Usage tracking** - See how often you use each prompt

### AI-Powered Features
- **AI Prompt Generation** - Generate new prompts based on simple descriptions
- **Prompt Optimization** - Enhance existing prompts with AI suggestions
- **Multiple AI Providers**:
  - **OpenRouter** - Access cloud-based models like GPT-4, Claude, and more
  - **Ollama** - Use local open-source models for privacy and offline use
- **Response Processing** - Smart sanitization of AI responses for clean results
- **Customizable System Prompts** - Configure how the AI generates content

### Advanced Tag Management
- **Smart tag counts** - See how many prompts use each tag with hierarchical rollup
- **Tag editing** - Rename tags with automatic cascading updates to all child tags
- **Safe tag deletion** - Remove unused tags with validation and orphan cleanup
- **Hover interactions** - Clean UI with edit/delete options appearing on hover
- **Duplicate prevention** - Intelligent validation prevents conflicting tag names
- **Expandable/collapsible hierarchy** - Toggle visibility of nested tag levels
- **Alphabetical sorting** - Tags are sorted alphabetically for easy navigation
- **Scrollable tag tree** - Access all tags regardless of list size

### Developer Tools
- **Integrated database viewer** - Access via Help menu to inspect all data tables
- **Real-time debugging** - View tag relationships, prompt versions, and data integrity
- **Data location display** - See exactly where your data is stored
- **Comprehensive logging** - Detailed console output for troubleshooting

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Run the application: `npm start`

## Data Storage

The application stores all data in a common location for consistency across development and distribution versions:
- **macOS**: `~/.proman/`
- **Windows**: `%USERPROFILE%\.proman\`
- **Linux**: `~/.proman/`

This ensures your prompts and tags are preserved when switching between different versions of the app.

## Usage

### Creating Prompts
1. Click the "+" button to create a new prompt
2. Fill in the title, description, and content
3. Add tags using the hierarchical tag system (e.g., `development/frontend/react`)
4. Save your prompt

### Using AI Generation
1. Click "Generate with AI" when creating a new prompt
2. Enter a description of what you want the prompt to accomplish
3. Select your preferred AI provider and model
4. Review and edit the generated prompt before saving

### Optimizing Prompts
1. Open an existing prompt and click "Optimize with AI"
2. The AI will suggest improvements to your prompt's effectiveness
3. Accept the changes or further edit as needed

### Managing Tags
- **View counts**: Each tag shows how many prompts use it
- **Edit names**: Hover over a tag and click the pencil icon to rename
- **Delete unused**: Hover over unused tags to see the delete option
- **Hierarchical organization**: Use `/` to create nested tag structures
- **Expand/collapse**: Click the arrow icons to show or hide nested tags
- **Scrollable view**: Access all tags in the scrollable sidebar

### Database Viewer
Access the database viewer through Help → View Database to:
- Inspect all data tables and relationships
- Debug tag counting and prompt versions
- Verify data integrity
- See storage location details

## Development

### Project Structure
```
src/app/
├── main.js              # Electron main process
├── preload.js           # Preload script for secure IPC
├── index.html           # Main application UI
├── src/
│   ├── renderer.js      # Application logic and UI interactions
│   ├── ai/              # AI integration services
│   │   ├── AIService.js # Core AI service manager
│   │   ├── providers/   # AI provider implementations
│   │   └── decorators/  # Response processing pipeline
│   ├── tags/            # Tag management system
│   ├── prompts/         # Prompt management system
│   └── version/         # Version control system
└── db_viewer_template.html  # Database inspection tool
```

### Key Technologies
- **Electron** - Cross-platform desktop framework
- **Dexie.js** - IndexedDB wrapper for data storage
- **Tailwind CSS** - Utility-first CSS framework
- **Hierarchical data structures** - For tag organization
- **AI Integration** - OpenRouter and Ollama API integration

### Git Workflow
This project follows trunk-based development:
- Short-lived feature branches
- Regular merges to main
- Clean commit history with meaningful messages

## Contributing

1. Create a feature branch from main
2. Implement your changes with tests
3. Ensure all features work in both development and built versions
4. Submit a pull request with clear description

## License

ISC License - see LICENSE file for details.

## Changelog

### Latest Features (v1.2.0)
- **AI Integration**:
  - Added AI prompt generation and optimization capabilities
  - Integrated OpenRouter for cloud AI models
  - Added Ollama support for local AI models
  - Implemented response processing pipeline
- **Enhanced Tag Management**:
  - Improved tag tree with expandable/collapsible hierarchy
  - Added alphabetical sorting of tags
  - Reduced spacing between child tags for better visibility
  - Made tag tree scrollable to handle large tag collections
- **UI Improvements**:
  - Refined hover interactions for better usability
  - Enhanced modal dialogs for AI operations
  - Improved dark/light theme consistency

### Previous Updates (v1.1.0)
- **Tag Management Suite**: Complete tag counting, editing, and deletion system
- **Database Viewer**: Integrated debugging and inspection tools
- **Improved Data Handling**: Consistent storage location and orphan cleanup
- **Enhanced UI**: Hover interactions and professional modal dialogs
