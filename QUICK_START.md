# Quick Start Guide

## Getting Started with AI Prompt Manager

### Prerequisites
- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (v6 or higher) - Included with Node.js
- **Git** - [Download here](https://git-scm.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/agileandy/promptManager-Electron.git
   cd promptManager-Electron
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

### First Time Setup

#### 1. Configure AI Providers (Optional but Recommended)

The application supports two AI providers:

**OpenRouter (Cloud-based)**:
- Sign up at [openrouter.ai](https://openrouter.ai)
- Get your API key from the dashboard
- In the app: Settings → AI Configuration → OpenRouter
- Enter your API key and select a model

**Ollama (Local)**:
- Install Ollama from [ollama.ai](https://ollama.ai)
- Pull a model: `ollama pull llama2`
- Start Ollama service: `ollama serve`
- In the app: Settings → AI Configuration → Ollama
- Verify endpoint is `http://localhost:11434`

#### 2. Create Your First Prompt

1. Click the **"+"** button in the main interface
2. Fill in:
   - **Title**: "Code Review Prompt"
   - **Description**: "A prompt for reviewing code quality"
   - **Content**: "Please review the following code for bugs, performance issues, and best practices:"
   - **Tags**: "development/quality/review"
3. Click **Save**

#### 3. Organize with Tags

The application uses hierarchical tags with `/` separators:
- `development/frontend/react`
- `development/backend/nodejs`
- `writing/technical/documentation`

Tags automatically create parent hierarchies and show usage counts.

### Core Features

#### Prompt Management
- **Create**: Add new prompts with title, description, and content
- **Edit**: Modify existing prompts (creates new versions automatically)
- **Search**: Find prompts by title or content
- **Usage Tracking**: See how often you use each prompt

#### AI Integration
- **Generate**: Create prompts from simple descriptions
- **Optimize**: Improve existing prompts with AI suggestions
- **Multiple Providers**: Switch between OpenRouter and Ollama

#### Version Control
- **Automatic Versioning**: Every edit creates a new version
- **History**: View all versions of a prompt
- **Revert**: Go back to previous versions
- **Dependencies**: Understand relationships between versions

#### Tag Management
- **Hierarchical**: Organize tags in tree structures
- **Smart Counts**: See prompt counts with child rollup
- **Bulk Operations**: Rename/delete tags with cascading updates
- **Validation**: Prevent orphans and conflicts

### Common Workflows

#### Creating a Prompt Series

1. Create base prompt: "Email Template - Base"
2. Add tags: "email/templates/base"
3. Create variations:
   - "Email Template - Follow Up" → "email/templates/followup"
   - "Email Template - Introduction" → "email/templates/intro"
4. Use tag filtering to see the entire email template collection

#### AI-Assisted Prompt Development

1. Click **"Generate with AI"**
2. Enter description: "A prompt for writing product descriptions that are SEO-friendly and engaging"
3. Select your preferred AI provider
4. Review and edit the generated prompt
5. Save with appropriate tags: "marketing/seo/product"

#### Optimizing Existing Prompts

1. Open an existing prompt
2. Click **"Optimize with AI"**
3. Review the AI's suggestions
4. Accept changes or make manual edits
5. Save (creates new version automatically)

### Keyboard Shortcuts

- **Ctrl/Cmd + N**: New prompt
- **Ctrl/Cmd + S**: Save prompt
- **Ctrl/Cmd + F**: Search prompts
- **Escape**: Close modals
- **Tab**: Navigate between form fields

### Data and Backup

#### Data Location
Your prompts are stored locally in:
- **macOS**: `~/.proman/`
- **Windows**: `%USERPROFILE%\.proman\`
- **Linux**: `~/.proman/`

#### Backup
1. Go to File → Export → All Prompts
2. Choose location to save JSON backup
3. Store safely (contains all prompts, tags, and versions)

#### Restore
1. Go to File → Import → From JSON
2. Select your backup file
3. Choose merge or replace options

### Troubleshooting

#### AI Services Not Working

**OpenRouter Issues**:
- Verify API key is correct
- Check internet connection
- Ensure sufficient credits in account
- Try different model

**Ollama Issues**:
- Verify Ollama is running: `ollama list`
- Check endpoint: `http://localhost:11434`
- Pull required model: `ollama pull llama2`
- Restart Ollama service

#### Database Issues

**Slow Performance**:
- Use Database Viewer (Help → View Database) to check data size
- Consider archiving old prompts
- Clear browser cache if needed

**Data Corruption**:
- Export data first (if possible)
- Close application
- Delete `~/.proman/` directory
- Restart application
- Import data from backup

#### UI Issues

**Tags Not Updating**:
- Refresh the tag tree (F5)
- Check console for errors (F12)
- Verify tag hierarchy is valid

**Search Not Working**:
- Check for JavaScript errors in console
- Verify search index is built
- Try clearing and rebuilding data

### Advanced Usage

#### Custom AI Prompts

Configure custom system prompts in AI settings:

**Generation Prompt**:
```
You are an expert prompt engineer. Create high-quality, specific prompts based on user descriptions. Focus on clarity, specificity, and actionable instructions.
```

**Optimization Prompt**:
```
You are a prompt optimization expert. Improve the given prompt for better clarity, effectiveness, and results. Maintain the original intent while enhancing structure and specificity.
```

#### Tag Strategies

**By Function**:
```
analysis/
├── data/
├── code/
└── business/

creation/
├── content/
├── design/
└── strategy/

communication/
├── email/
├── meetings/
└── documentation/
```

**By Domain**:
```
development/
├── frontend/
├── backend/
└── devops/

marketing/
├── content/
├── seo/
└── social/

business/
├── strategy/
├── operations/
└── finance/
```

#### Version Control Best Practices

1. **Meaningful Changes**: Only save when making substantial modifications
2. **Descriptive Titles**: Update titles to reflect version changes
3. **Tag Consistency**: Maintain consistent tagging across versions
4. **Regular Cleanup**: Periodically review and clean old versions

### Development Mode

For developers wanting to modify the application:

#### Enable Developer Tools
```bash
npm run dev
```

#### Debug Database
- Help → View Database
- Inspect all tables and relationships
- Monitor real-time changes

#### Console Logging
All operations are logged to console:
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'true');
```

#### Custom CSS
Modify `src/app/tailwind.config.js` for theme customization:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'custom-blue': '#1e40af',
        'custom-green': '#10b981'
      }
    }
  }
}
```

### Tips and Best Practices

#### Effective Prompt Writing
1. **Be Specific**: Include context, constraints, and desired output format
2. **Use Examples**: Provide sample inputs and outputs when possible
3. **Test Iterations**: Use AI optimization to refine prompts
4. **Version Control**: Keep track of what works best

#### Organization Strategies
1. **Consistent Tagging**: Establish and follow tag naming conventions
2. **Regular Maintenance**: Clean up unused tags and old versions
3. **Logical Hierarchy**: Create intuitive tag structures
4. **Document Decisions**: Use descriptions to explain prompt purposes

#### Performance Optimization
1. **Regular Exports**: Backup data frequently
2. **Tag Cleanup**: Remove unused tags periodically
3. **Version Management**: Archive old versions that aren't needed
4. **Search Optimization**: Use specific keywords in titles and descriptions

This quick start guide should get you up and running with the AI Prompt Manager efficiently!