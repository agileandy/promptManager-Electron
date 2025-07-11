// Initialize the database
let db;
let dataDir;

// AI Service integration
let aiService = null;
let aiConfig = null;

// Tag-only manager for state isolation
let tagOnlyManager = null;

// Simple version manager for version resequencing
let simpleVersionManager = null;

// Version service for read-only viewer
let versionService = null;
let versionStateManager = null;

// Initialize database with common data directory
async function initializeDatabase() {
    try {
        dataDir = await window.electronAPI.getDataDir();
        console.log('Using data directory:', dataDir);

        // Use Dexie with a specific name that will be stored in the userData directory
        db = new Dexie('AIPromptManagerDB');

        db.version(4).stores({
            // Explicitly index isLatest and parentId to support queries
            prompts: '++id,isLatest,parentId,version,title,text,description,folderId,createdAt,lastUsedAt,timesUsed',
            folders: '++id, name, parentId',
            tags: '++id, name, fullPath, parentId, level', // Added fullPath, parentId, level for hierarchy
            promptTags: '++id, promptId, tagId' // Join table for many-to-many relationship
        });

        await db.open();
        console.log('Database initialized successfully in:', dataDir);

        // Test that existing tags are still accessible
        const existingTags = await db.tags.toArray();
        console.log(`Found ${existingTags.length} existing tags in database`);

        return true;
    } catch (e) {
        console.error('Dexie open failed:', e);
        if (e.name === 'SchemaError' || e.name === 'VersionError' || e.name === 'InvalidStateError') {
            console.warn('Deleting old/corrupt IndexedDB and reloading…');
            await Dexie.delete('AIPromptManagerDB');
            location.reload();
        }
        return false;
    }
}

// Initialize AI service
async function initializeAIService() {
    try {
        console.log('Starting AI service initialization...');

        // Initialize AI service via IPC
        const result = await window.electronAPI.ai.initialize();

        if (result.success) {
            // Get default provider and AI config
            const defaultProvider = await window.electronAPI.ai.getDefaultProvider();
            aiConfig = await window.electronAPI.ai.getConfig();

            aiService = {
                getAvailableProviders: () => result.providers,
                getDefaultProvider: () => defaultProvider,
                getProviderModels: (providerName) => window.electronAPI.ai.getProviderModels(providerName),
                generateDescription: (description, providerName) =>
                    window.electronAPI.ai.generateDescription(description, providerName),
                optimizePrompt: (promptText, providerName) =>
                    window.electronAPI.ai.optimizePrompt(promptText, providerName)
            };

            console.log('AI Service initialized successfully');
            console.log('Available providers:', result.providers);
            console.log('Default provider:', defaultProvider);
            return true;
        } else {
            console.error('AI service initialization failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Failed to initialize AI service:', error);
        console.error('Error stack:', error.stack);
        return false;
    }
}


// Load the read-only viewer modal HTML
async function loadReadOnlyViewerModal() {
    try {
        const response = await fetch('./html-partials/ReadOnlyViewerModal.html');
        if (!response.ok) {
            throw new Error(`Failed to load ReadOnlyViewerModal.html: ${response.status}`);
        }
        const html = await response.text();
        document.getElementById('read-only-viewer-modal-container').innerHTML = html;
        console.log('Read-only viewer modal loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load read-only viewer modal:', error);
        return false;
    }
}

// Initialize version service for read-only viewer
async function initializeVersionService() {
    try {
        console.log('Initializing VersionService and VersionStateManager...');

        // Import the required modules
        console.log('Importing VersionService...');
        const versionServiceModule = await import('./version/VersionService.js');
        console.log('VersionService module imported:', versionServiceModule);

        console.log('Importing VersionStateManager...');
        const versionStateManagerModule = await import('./version/VersionStateManager.js');
        console.log('VersionStateManager module imported:', versionStateManagerModule);

        const { VersionService } = versionServiceModule;
        const { VersionStateManager } = versionStateManagerModule;

        console.log('VersionService class:', VersionService);
        console.log('VersionStateManager class:', VersionStateManager);

        // Initialize the state manager first
        versionStateManager = new VersionStateManager(db);
        console.log('VersionStateManager instance created:', versionStateManager);
        await versionStateManager.initialize();
        console.log('VersionStateManager initialized');

        // Then initialize the version service with the state manager
        versionService = new VersionService(db, versionStateManager);
        console.log('VersionService instance created:', versionService);

        console.log('VersionService and VersionStateManager initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize version service:', error);
        console.error('Error details:', error.stack);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database first
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.error('Failed to initialize database');
        return;
    }

    // Initialize AI service
    await initializeAIService();

    // Initialize version service
    await initializeVersionService();

    // Load the read-only viewer modal
    await loadReadOnlyViewerModal();

    // Set up event listeners for the read-only viewer buttons
    console.log('Setting up read-only viewer event listeners');

    // Close buttons
    const closeViewerBtn = document.getElementById('close-viewer-btn');
    const viewerCloseBtn = document.getElementById('viewer-close-btn');

    if (closeViewerBtn) {
        closeViewerBtn.addEventListener('click', hideReadOnlyViewer);
        console.log('Added event listener to close-viewer-btn');
    } else {
        console.error('close-viewer-btn not found');
    }

    if (viewerCloseBtn) {
        viewerCloseBtn.addEventListener('click', hideReadOnlyViewer);
        console.log('Added event listener to viewer-close-btn');
    } else {
        console.error('viewer-close-btn not found');
    }

    // Copy button
    const viewerCopyBtn = document.getElementById('viewer-copy-btn');
    if (viewerCopyBtn) {
        viewerCopyBtn.addEventListener('click', () => {
            const promptText = document.getElementById('viewer-prompt-text').textContent;
            navigator.clipboard.writeText(promptText)
                .then(() => {
                    // Show a temporary "Copied!" message
                    const originalText = viewerCopyBtn.innerHTML;
                    viewerCopyBtn.innerHTML = '<span>✓</span><span>Copied!</span>';
                    setTimeout(() => {
                        viewerCopyBtn.innerHTML = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text to clipboard');
                });
        });
        console.log('Added event listener to viewer-copy-btn');
    } else {
        console.error('viewer-copy-btn not found');
    }

    // Version navigation buttons
    const prevVersionBtn = document.getElementById('viewer-prev-version-btn');
    const nextVersionBtn = document.getElementById('viewer-next-version-btn');

    if (prevVersionBtn) {
        prevVersionBtn.addEventListener('click', () => navigateToVersion(-1));
        console.log('Added event listener to viewer-prev-version-btn');
    } else {
        console.error('viewer-prev-version-btn not found');
    }

    if (nextVersionBtn) {
        nextVersionBtn.addEventListener('click', () => navigateToVersion(1));
        console.log('Added event listener to viewer-next-version-btn');
    } else {
        console.error('viewer-next-version-btn not found');
    }

    // Initialize AI settings modal
    initializeAISettingsModal();

    // --- Tag Input Logic ---
    const tagInput = document.getElementById('prompt-tags');
    const tagSuggestions = document.getElementById('tag-suggestions');
    const selectedTagsContainer = document.getElementById('selected-tags');

    const editTagInput = document.getElementById('edit-prompt-tags');
    const editTagSuggestions = document.getElementById('edit-tag-suggestions');
    const editSelectedTagsContainer = document.getElementById('edit-selected-tags');

    // --- Tag Management Functions ---
    let currentPromptTags = new Set();
    let currentEditTags = new Set();

    async function setupTagInput(inputElement, suggestionsElement, containerElement, tagSet) {
        inputElement.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (!query) {
                suggestionsElement.classList.add('hidden');
                return;
            }

            const matchedTags = await db.tags.where('fullPath').startsWithIgnoreCase(query).limit(10).toArray();

            // Get counts for each matched tag (only latest versions)
            const tagsWithCounts = await Promise.all(matchedTags.map(async (tag) => {
                const promptTagRelations = await db.promptTags.where('tagId').equals(tag.id).toArray();
                const promptIds = promptTagRelations.map(pt => pt.promptId);
                const latestPrompts = await db.prompts.where('id').anyOf(promptIds).and(p => p.isLatest === 1).toArray();
                const promptCount = latestPrompts.length;
                return { ...tag, promptCount };
            }));

            suggestionsElement.innerHTML = tagsWithCounts.map(tag =>
                `<li class="p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" data-tag-path="${tag.fullPath}">${tag.fullPath} <span class="text-xs text-gray-500 dark:text-gray-400">(${tag.promptCount})</span></li>`
            ).join('');
            suggestionsElement.classList.toggle('hidden', matchedTags.length === 0);
        });

        suggestionsElement.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const tagPath = e.target.getAttribute('data-tag-path');
                addTagToContainer(tagPath, containerElement, tagSet);
                inputElement.value = '';
                suggestionsElement.classList.add('hidden');
            }
        });

        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const newTag = inputElement.value.trim();
                if (newTag && !tagSet.has(newTag)) {
                    addTagToContainer(newTag, containerElement, tagSet);
                    inputElement.value = '';
                    suggestionsElement.classList.add('hidden');
                }
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !suggestionsElement.contains(e.target)) {
                suggestionsElement.classList.add('hidden');
            }
        });
    }

    function addTagToContainer(tagPath, container, tagSet) {
        if (tagSet.has(tagPath)) return; // Prevent duplicates

        tagSet.add(tagPath);
        const tagElement = document.createElement('span');
        tagElement.className = 'inline-flex items-center bg-blue-100 text-blue-800 text-sm font-medium mr-2 mb-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300';
        tagElement.innerHTML = `
            ${tagPath}
            <button type="button" class="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100" onclick="removeTag('${tagPath}', this)">
                ✕
            </button>
        `;
        tagElement.setAttribute('data-tag-path', tagPath);
        container.appendChild(tagElement);
    }

    // Global function to remove tags
    window.removeTag = function(tagPath, buttonElement) {
        const tagElement = buttonElement.parentElement;
        const container = tagElement.parentElement;

        // Determine which tag set to update
        if (container.id === 'selected-tags') {
            currentPromptTags.delete(tagPath);
        } else if (container.id === 'edit-selected-tags') {
            currentEditTags.delete(tagPath);
        }

        tagElement.remove();
    };

    // Setup tag inputs for both forms
    setupTagInput(tagInput, tagSuggestions, selectedTagsContainer, currentPromptTags);
    setupTagInput(editTagInput, editTagSuggestions, editSelectedTagsContainer, currentEditTags);

    // --- Tag Creation and Hierarchy Management ---
    async function createOrGetTag(tagPath) {
        // Check if tag already exists
        const existingTag = await db.tags.where('fullPath').equals(tagPath).first();
        if (existingTag) return existingTag;

        // Parse hierarchical path
        const parts = tagPath.split('/');
        let currentPath = '';
        let parentId = null;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            currentPath += (i > 0 ? '/' : '') + part;

            const existingPart = await db.tags.where('fullPath').equals(currentPath).first();
            if (existingPart) {
                parentId = existingPart.id;
            } else {
                const newTag = await db.tags.add({
                    name: part,
                    fullPath: currentPath,
                    parentId: parentId,
                    level: i
                });
                parentId = newTag;
            }
        }

        return await db.tags.get(parentId);
    }

    // --- Tag-Only Manager for State Isolation ---
    // Import and initialize the proper TagOnlyManager with command pattern
    const { TagOnlyManager } = await import('./tags/index.js');
    tagOnlyManager = new TagOnlyManager(db);

    // --- Simple Version Manager for Version Resequencing ---
    // Import and initialize the SimpleVersionManagerAdapter (ES module compatible)
    const versionModule = await import('./version/SimpleVersionManagerAdapter.js');
    simpleVersionManager = versionModule;

    console.log('Tag-only manager and Simple Version Manager initialized');

    // --- Element Selectors ---
    const newPromptBtn = document.getElementById('new-prompt-btn');
    const cancelPromptBtn = document.getElementById('cancel-prompt-btn');
    const newPromptModal = document.getElementById('new-prompt-modal');
    const newPromptForm = document.getElementById('new-prompt-form');
    const editPromptModal = document.getElementById('edit-prompt-modal');
    const editPromptForm = document.getElementById('edit-prompt-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const historyModal = document.getElementById('history-modal');
    const historyModalTitle = document.getElementById('history-modal-title');
    const historyModalBody = document.getElementById('history-modal-body');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const promptGrid = document.querySelector('.grid');
    const searchInput = document.querySelector('input[type="search"]');
    // Holds the current search term in lowercase for simple matching
    let searchTerm = '';

    // --- Modal Control ---
    function showModal(modal) {
        modal.classList.remove('hidden');
    }

    function hideModal(modal) {
        modal.classList.add('hidden');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
        // Clear tag containers when hiding modals
        if (modal.id === 'new-prompt-modal') {
            currentPromptTags.clear();
            selectedTagsContainer.innerHTML = '';
        } else if (modal.id === 'edit-prompt-modal') {
            currentEditTags.clear();
            editSelectedTagsContainer.innerHTML = '';
        }
    }

    // --- Read-Only Viewer Modal Control ---
    let currentViewingPrompt = null;
    let currentVersions = [];
    let currentVersionIndex = 0;

    function showReadOnlyViewer(promptId) {
        const viewerModal = document.getElementById('read-only-viewer-modal');
        if (!viewerModal) {
            console.error('Read-only viewer modal not found');
            return;
        }

        loadPromptForViewing(promptId);
        showModal(viewerModal);
    }

    function hideReadOnlyViewer() {
        const viewerModal = document.getElementById('read-only-viewer-modal');
        if (viewerModal) {
            hideModal(viewerModal);
            currentViewingPrompt = null;
            currentVersions = [];
            currentVersionIndex = 0;
        }
    }

    async function loadPromptForViewing(promptId) {
        try {
            console.log('Loading prompt for viewing, promptId:', promptId);
            console.log('versionService:', versionService);

            if (!versionService) {
                console.error('Version service not initialized');
                return;
            }

            console.log('Calling versionService.getVersionInfo...');
            // Get version info using the version service
            const versionInfo = await versionService.getVersionInfo(promptId);
            console.log('versionInfo result:', versionInfo);

            if (!versionInfo.success) {
                console.error('Failed to get version info:', versionInfo.error);
                return;
            }

            // Store the current versions and set the current index
            currentVersions = versionInfo.allVersions.sort((a, b) => a.version - b.version);
            console.log('currentVersions:', currentVersions);

            const currentVersion = versionInfo.prompt;
            console.log('currentVersion:', currentVersion);

            currentVersionIndex = currentVersions.findIndex(v => v.id === currentVersion.id);
            console.log('currentVersionIndex:', currentVersionIndex);

            currentViewingPrompt = currentVersion;

            // Update the UI with the prompt details
            console.log('Updating viewer UI...');
            updateViewerUI(currentVersion, currentVersionIndex, currentVersions.length);

            // Load tags for the prompt
            console.log('Loading prompt tags...');
            await loadPromptTagsForViewer(currentVersion.id);

            // Update navigation buttons state
            console.log('Updating version navigation buttons...');
            updateVersionNavigationButtons();

            console.log('Prompt loaded for viewing successfully');
        } catch (error) {
            console.error('Error loading prompt for viewing:', error);
            console.error('Error details:', error.stack);
        }
    }

    async function loadPromptTagsForViewer(promptId) {
        try {
            // Get tags for the prompt
            const promptTagRelations = await db.promptTags.where('promptId').equals(promptId).toArray();
            const tagIds = promptTagRelations.map(relation => relation.tagId);
            const tags = await db.tags.where('id').anyOf(tagIds).toArray();

            // Update the tags container
            const tagsContainer = document.getElementById('viewer-prompt-tags');
            tagsContainer.innerHTML = '';

            if (tags.length === 0) {
                tagsContainer.innerHTML = '<span class="text-gray-500 dark:text-gray-400">No tags</span>';
                return;
            }

            // Add each tag to the container
            tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'inline-flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300';
                tagElement.textContent = tag.fullPath;
                tagsContainer.appendChild(tagElement);
            });
        } catch (error) {
            console.error('Error loading tags for viewer:', error);
        }
    }

    function updateViewerUI(prompt, versionIndex, totalVersions) {
        // Update title
        document.getElementById('viewer-prompt-title').textContent = prompt.title;

        // Update version badge
        document.getElementById('viewer-version-badge').textContent = `Version ${prompt.version}`;

        // Update description
        document.getElementById('viewer-prompt-description').textContent = prompt.description || 'No description';

        // Update prompt text
        document.getElementById('viewer-prompt-text').textContent = prompt.text;

        // Update metadata
        document.getElementById('viewer-created-at').textContent = new Date(prompt.createdAt).toLocaleString();
        document.getElementById('viewer-last-used').textContent = prompt.lastUsedAt ? new Date(prompt.lastUsedAt).toLocaleString() : 'Never';
        document.getElementById('viewer-times-used').textContent = prompt.timesUsed || 0;
        document.getElementById('viewer-parent-id').textContent = prompt.parentId || prompt.id;
    }

    function updateVersionNavigationButtons() {
        const prevButton = document.getElementById('viewer-prev-version-btn');
        const nextButton = document.getElementById('viewer-next-version-btn');

        // Disable previous button if we're at the first version
        prevButton.disabled = currentVersionIndex <= 0;

        // Disable next button if we're at the last version
        nextButton.disabled = currentVersionIndex >= currentVersions.length - 1;
    }

    function navigateToVersion(direction) {
        const newIndex = currentVersionIndex + direction;

        // Check if the new index is valid
        if (newIndex < 0 || newIndex >= currentVersions.length) {
            return;
        }

        // Update the current index and prompt
        currentVersionIndex = newIndex;
        currentViewingPrompt = currentVersions[currentVersionIndex];

        // Update the UI
        updateViewerUI(currentViewingPrompt, currentVersionIndex, currentVersions.length);
        loadPromptTagsForViewer(currentViewingPrompt.id);
        updateVersionNavigationButtons();
    }

    newPromptBtn.addEventListener('click', () => showModal(newPromptModal));
    cancelPromptBtn.addEventListener('click', () => hideModal(newPromptModal));
    cancelEditBtn.addEventListener('click', () => hideModal(editPromptModal));
    closeHistoryBtn.addEventListener('click', () => hideModal(historyModal));

    // --- AI Button Elements ---

// --- AI Button Elements ---
    const aiGenerateBtn = document.getElementById('ai-generate-btn');
    const aiOptimizeBtn = document.getElementById('ai-optimize-btn');
    const editAiGenerateBtn = document.getElementById('edit-ai-generate-btn');
    const editAiOptimizeBtn = document.getElementById('edit-ai-optimize-btn');

    // --- AI Helper Functions ---

    function showLoadingState(button, originalText) {
        button.disabled = true;
        button.innerHTML = '<span>⏳</span><span class="hidden sm:inline">Processing...</span>';
    }

    function hideLoadingState(button, originalText) {
        button.disabled = false;
        button.innerHTML = originalText;
    }

    async function handleAIGeneration(descriptionInput, textOutput) {
        const description = descriptionInput.value.trim();
        if (!description) {
            alert('Please enter a description first');
            return false;
        }

        if (!aiService) {
            alert('AI service not initialized. Please check the console for errors.');
            return false;
        }

        const availableProviders = aiService.getAvailableProviders();
        if (availableProviders.length === 0) {
            alert('No AI providers are configured. Please configure an AI provider in the settings first.');
            return false;
        }

        const defaultProvider = aiService.getDefaultProvider();
        if (!defaultProvider) {
            alert('No default AI provider is configured. Please set a default provider in the settings.');
            return false;
        }

        try {
            console.log(`Using default provider: ${defaultProvider} for AI generation`);
            const generatedText = await aiService.generateDescription(description, defaultProvider);
            textOutput.value = generatedText;
            return true;
        } catch (error) {
            console.error('AI generation failed:', error);
            alert(`AI generation failed: ${error.message}`);
            return false;
        }
    }

    async function handleAIOptimization(textInput) {
        const currentText = textInput.value.trim();
        if (!currentText) {
            alert('Please enter some prompt text first');
            return false;
        }

        if (!aiService) {
            alert('AI service not initialized. Please check the console for errors.');
            return false;
        }

        const availableProviders = aiService.getAvailableProviders();
        if (availableProviders.length === 0) {
            alert('No AI providers are configured. Please configure an AI provider in the settings first.');
            return false;
        }

        const defaultProvider = aiService.getDefaultProvider();
        if (!defaultProvider) {
            alert('No default AI provider is configured. Please set a default provider in the settings.');
            return false;
        }

        try {
            console.log(`Using default provider: ${defaultProvider} for AI optimization`);
            const optimizedText = await aiService.optimizePrompt(currentText, defaultProvider);
            textInput.value = optimizedText;
            return true;
        } catch (error) {
            console.error('AI optimization failed:', error);
            alert(`AI optimization failed: ${error.message}`);
            return false;
        }
    }

    // --- AI Button Event Handlers ---
    if (aiGenerateBtn) {
        aiGenerateBtn.addEventListener('click', async () => {
            const originalText = aiGenerateBtn.innerHTML;
            showLoadingState(aiGenerateBtn, originalText);

            const descriptionInput = document.getElementById('prompt-description');
            const textOutput = document.getElementById('prompt-text');

            await handleAIGeneration(descriptionInput, textOutput);
            hideLoadingState(aiGenerateBtn, originalText);
        });
    }

    if (aiOptimizeBtn) {
        aiOptimizeBtn.addEventListener('click', async () => {
            const originalText = aiOptimizeBtn.innerHTML;
            showLoadingState(aiOptimizeBtn, originalText);

            const textInput = document.getElementById('prompt-text');

            await handleAIOptimization(textInput);
            hideLoadingState(aiOptimizeBtn, originalText);
        });
    }

    if (editAiGenerateBtn) {
        editAiGenerateBtn.addEventListener('click', async () => {
            const originalText = editAiGenerateBtn.innerHTML;
            showLoadingState(editAiGenerateBtn, originalText);

            const descriptionInput = document.getElementById('edit-prompt-description');
            const textOutput = document.getElementById('edit-prompt-text');

            await handleAIGeneration(descriptionInput, textOutput);
            hideLoadingState(editAiGenerateBtn, originalText);
        });
    }

    if (editAiOptimizeBtn) {
        editAiOptimizeBtn.addEventListener('click', async () => {
            const originalText = editAiOptimizeBtn.innerHTML;
            showLoadingState(editAiOptimizeBtn, originalText);

            const textInput = document.getElementById('edit-prompt-text');

            await handleAIOptimization(textInput);
            hideLoadingState(editAiOptimizeBtn, originalText);
        });
    }

        // --- Copy and delete functionality inside history modal ---
        historyModalBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (target.classList.contains('copy-history-btn')) {
                const versionId = Number(target.dataset.versionId);
                const promptVersion = await db.prompts.get(versionId);
                if (promptVersion) {
                    try {
                        await navigator.clipboard.writeText(promptVersion.text);
                        target.textContent = '✔️';
                        setTimeout(() => (target.innerHTML = '&#128203;'), 1000);
                    } catch (err) {
                        console.error('Failed to copy version prompt to clipboard:', err);
                    }
                }
            } else if (target.classList.contains('delete-version-btn')) {
                const versionId = Number(target.dataset.versionId);
                if (confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
                    try {
                        // Use SimpleVersionManager to delete the version
                        const parentId = await simpleVersionManager.deletePromptVersion(db, versionId);

                        if (parentId) {
                            // Refresh the history view
                            await showHistory(parentId);

                            // Also refresh the main prompt cards to show updated version numbers
                            await renderPrompts();
                        }
                    } catch (error) {
                        console.error('Failed to delete version:', error);
                        alert('Failed to delete version. Please try again.');
                    }
                }
            }
        });

    // --- Search Functionality ---
    searchInput.addEventListener('input', async (e) => {
        searchTerm = e.target.value.trim().toLowerCase();
        await renderPrompts();
    });

    // --- Delete Tag Function ---
    async function deleteTag(tagId, tagPath) {
        try {
            // Double-check safety: verify tag has no children and no prompts
            const allTags = await db.tags.toArray();
            const hasChildren = allTags.some(t => t.parentId === tagId);
            const promptTagRelations = await db.promptTags.where('tagId').equals(tagId).toArray();

            // Debug: Let's see what's actually in the database
            console.log(`Debug: Attempting to delete tag "${tagPath}" (ID: ${tagId})`);
            console.log('All promptTag relations for this tag:', promptTagRelations);

            // Check which of these relations point to latest prompts
            if (promptTagRelations.length > 0) {
                const promptIds = promptTagRelations.map(pt => pt.promptId);
                const latestPrompts = await db.prompts.where('id').anyOf(promptIds).and(p => p.isLatest === 1).toArray();
                console.log('Latest prompts using this tag:', latestPrompts);

                if (latestPrompts.length > 0) {
                    alert(`Cannot delete tag: it is still in use by ${latestPrompts.length} current prompt(s)`);
                    return;
                }

                // If we get here, the tag is only used by old versions - clean them up
                console.log('Tag only used by old versions, cleaning up orphaned relationships...');
                await db.promptTags.where('tagId').equals(tagId).delete();
            }

            if (hasChildren) {
                alert('Cannot delete tag: it has child tags');
                return;
            }

            // Confirm deletion
            if (!confirm(`Are you sure you want to delete the tag "${tagPath}"?\n\nThis action cannot be undone.`)) {
                return;
            }

            // Safe to delete - remove from database
            await db.tags.delete(tagId);

            // Refresh the tag tree
            await renderTagTree();

            console.log(`Tag "${tagPath}" deleted successfully`);

        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Error deleting tag. Please try again.');
        }
    }

    // --- Edit Tag Name Function ---
    async function editTagName(tagId, currentName, currentFullPath) {
        try {
            console.log(`Starting edit for tag ID: ${tagId}, name: "${currentName}", path: "${currentFullPath}"`);

            // Show edit modal instead of prompt
            const newName = await showEditTagModal(currentName);
            if (!newName || newName.trim() === '') {
                console.log('User cancelled or entered empty name');
                return; // User cancelled or entered empty name
            }

            const trimmedNewName = newName.trim();
            if (trimmedNewName === currentName) {
                console.log('No change in name');
                return; // No change
            }

            console.log(`New name: "${trimmedNewName}"`);

            // Get the tag to edit
            const tagToEdit = await db.tags.get(tagId);
            if (!tagToEdit) {
                console.error('Tag not found in database');
                alert('Tag not found');
                return;
            }

            console.log('Tag found:', tagToEdit);

            // Calculate new full path
            let newFullPath;
            if (tagToEdit.parentId) {
                const parentTag = await db.tags.get(tagToEdit.parentId);
                if (!parentTag) {
                    console.error('Parent tag not found');
                    alert('Parent tag not found');
                    return;
                }
                newFullPath = `${parentTag.fullPath}/${trimmedNewName}`;
            } else {
                newFullPath = trimmedNewName;
            }

            console.log(`New full path: "${newFullPath}"`);

            // Check for duplicate full path
            const existingTag = await db.tags.where('fullPath').equals(newFullPath).first();
            if (existingTag && existingTag.id !== tagId) {
                console.log('Duplicate path found:', existingTag);
                alert(`A tag with the path "${newFullPath}" already exists. Please choose a different name.`);
                return;
            }

            console.log('No duplicates found, proceeding with update');

            // Update the tag name and fullPath
            await db.tags.update(tagId, {
                name: trimmedNewName,
                fullPath: newFullPath
            });

            console.log('Tag updated successfully');

            // Recursively update all descendant tags' fullPaths
            await updateDescendantPaths(tagId, newFullPath);

            console.log('Descendant paths updated');

            // Refresh the tag tree to show changes
            await renderTagTree();

            console.log(`Tag renamed from "${currentFullPath}" to "${newFullPath}"`);

        } catch (error) {
            console.error('Detailed error editing tag name:', error);
            alert(`Error editing tag name: ${error.message}. Check console for details.`);
        }
    }

    // --- Helper function to update descendant tag paths ---
    async function updateDescendantPaths(parentTagId, newParentPath) {
        try {
            // Get all direct children of this tag
            const childTags = await db.tags.where('parentId').equals(parentTagId).toArray();

            for (const childTag of childTags) {
                // Update child's fullPath
                const newChildPath = `${newParentPath}/${childTag.name}`;
                await db.tags.update(childTag.id, {
                    fullPath: newChildPath
                });

                // Recursively update this child's descendants
                await updateDescendantPaths(childTag.id, newChildPath);
            }
        } catch (error) {
            console.error('Error updating descendant paths:', error);
        }
    }

    // --- Show Edit Tag Modal ---
    function showEditTagModal(currentName) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

            // Create modal content
            const modal = document.createElement('div');
            modal.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96';
            modal.innerHTML = `
                <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Tag Name</h3>
                <input type="text" id="edit-tag-input" value="${currentName}"
                       class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-4
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <div class="flex justify-end space-x-2">
                    <button id="cancel-edit-tag" class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500">Cancel</button>
                    <button id="save-edit-tag" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus and select the input
            const input = document.getElementById('edit-tag-input');
            input.focus();
            input.select();

            // Handle save
            const saveBtn = document.getElementById('save-edit-tag');
            const cancelBtn = document.getElementById('cancel-edit-tag');

            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            saveBtn.onclick = () => {
                const newName = input.value.trim();
                cleanup();
                resolve(newName);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };

            // Handle Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const newName = input.value.trim();
                    cleanup();
                    resolve(newName);
                } else if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };

            // Handle click outside modal
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            };
        });
    }

// --- Render Tag Tree ---
    async function renderTagTree() {
        const tagTree = document.getElementById('tag-tree');
        tagTree.innerHTML = '';

        // Helper function to get all descendant tags for a given tag
        const getAllDescendantTags = (tags, parentId) => {
            const descendants = [];
            const children = tags.filter(tag => tag.parentId === parentId);

            for (const child of children) {
                descendants.push(child);
                descendants.push(...getAllDescendantTags(tags, child.id));
            }

            return descendants;
        };

        // Helper function to get unique prompt count for a tag and all its descendants
        const getTagTreePromptCount = async (tags, tagId) => {
            // Get the tag itself and all its descendants
            const allRelevantTags = [
                tags.find(t => t.id === tagId),
                ...getAllDescendantTags(tags, tagId)
            ].filter(Boolean);

            // Get all prompt IDs that have any of these tags
            const allTagIds = allRelevantTags.map(t => t.id);
            const promptTagRelations = await db.promptTags.where('tagId').anyOf(allTagIds).toArray();
            const promptIds = [...new Set(promptTagRelations.map(pt => pt.promptId))]; // Remove duplicates

            // Filter to only latest versions
            const latestPrompts = await db.prompts.where('id').anyOf(promptIds).and(p => p.isLatest === 1).toArray();
            return latestPrompts.length;
        };

        const buildTree = async (tags, parentId = null) => {
            // Get tags for this level and sort them alphabetically by name
            const filteredTags = tags.filter(tag => tag.parentId === parentId)
                .sort((a, b) => a.name.localeCompare(b.name));

            if (filteredTags.length === 0) return null;

            const ul = document.createElement('ul');
            ul.classList.add('ml-2', 'pl-2', 'border-l', 'border-gray-300', 'dark:border-gray-600');

            // Add a class to identify this as a child list for collapsing
            if (parentId !== null) {
                ul.classList.add('tag-children');
            }

            for (const tag of filteredTags) {
                // Get rollup count of unique prompts in this tag's entire subtree
                const promptCount = await getTagTreePromptCount(tags, tag.id);

                // Check if this tag has children
                const hasChildren = tags.some(t => t.parentId === tag.id);

                // Show delete button if tag has no children AND count is 0
                const showDelete = !hasChildren && promptCount === 0;

                const li = document.createElement('li');
                li.classList.add('mb-1', 'cursor-pointer', 'hover:bg-gray-200', 'dark:hover:bg-gray-700', 'p-1', 'group');

                // Create a wrapper div for the tag content and buttons
                const tagWrapper = document.createElement('div');
                tagWrapper.classList.add('flex', 'items-center', 'justify-between');

                // Create a container for the toggle and tag name to keep them together
                const tagNameContainer = document.createElement('div');
                tagNameContainer.classList.add('flex', 'items-center');

                // Add toggle button for parent tags
                if (hasChildren) {
                    const toggleBtn = document.createElement('button');
                    toggleBtn.innerHTML = '▼'; // Down arrow for expanded
                    toggleBtn.className = 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mr-1 text-xs';
                    toggleBtn.title = 'Collapse/Expand';
                    toggleBtn.setAttribute('data-expanded', 'true');
                    toggleBtn.onclick = (e) => {
                        e.stopPropagation();
                        const isExpanded = toggleBtn.getAttribute('data-expanded') === 'true';
                        const childList = li.querySelector('.tag-children');

                        if (childList) {
                            if (isExpanded) {
                                childList.style.display = 'none';
                                toggleBtn.innerHTML = '►'; // Right arrow for collapsed
                                toggleBtn.setAttribute('data-expanded', 'false');
                            } else {
                                childList.style.display = '';
                                toggleBtn.innerHTML = '▼'; // Down arrow for expanded
                                toggleBtn.setAttribute('data-expanded', 'true');
                            }
                        }
                    };
                    tagNameContainer.appendChild(toggleBtn);
                } else {
                    // Add a small spacer for leaf nodes to maintain alignment
                    const spacer = document.createElement('span');
                    spacer.className = 'mr-3 text-xs';
                    spacer.innerHTML = '&nbsp;';
                    tagNameContainer.appendChild(spacer);
                }

                const tagContent = document.createElement('span');
                tagContent.innerHTML = `${tag.name} <span class="text-xs text-gray-500 dark:text-gray-400">(${promptCount})</span>`;
                tagContent.setAttribute('data-tag-path', tag.fullPath);
                tagContent.setAttribute('data-tag-id', tag.id);

                // Make only child nodes (leaf nodes) draggable
                if (!hasChildren) {
                    tagContent.draggable = true;
                    tagContent.classList.add('draggable-tag');
                    tagContent.style.cursor = 'grab';
                }

                tagNameContainer.appendChild(tagContent);
                tagWrapper.appendChild(tagNameContainer);

                // Container for action buttons
                const actionBtns = document.createElement('div');
                actionBtns.classList.add('flex', 'items-center');

                // Add edit button (hidden by default, shown on hover)
                const editBtn = document.createElement('button');
                editBtn.innerHTML = '&#9998;'; // Pencil icon
                editBtn.className = 'text-blue-500 hover:text-blue-700 ml-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity';
                editBtn.title = 'Edit tag name';
                editBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await editTagName(tag.id, tag.name, tag.fullPath);
                };
                actionBtns.appendChild(editBtn);

                if (showDelete) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '&#128465;'; // Trash icon
                    deleteBtn.className = 'text-red-500 hover:text-red-700 ml-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity';
                    deleteBtn.title = 'Delete unused tag';
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await deleteTag(tag.id, tag.fullPath);
                    };
                    actionBtns.appendChild(deleteBtn);
                }

                tagWrapper.appendChild(actionBtns);
                li.appendChild(tagWrapper);

                li.addEventListener('click', async (e) => {
                    // Only handle click if it's not on a button
                    if (e.target.tagName === 'BUTTON') return;
                    e.stopPropagation();
                    await renderPromptsByTag(tag.fullPath);
                    document.querySelectorAll('#tag-tree li').forEach(e => e.classList.remove('bg-gray-300', 'dark:bg-gray-800'));
                    li.classList.add('bg-gray-300', 'dark:bg-gray-800');
                });

                const childrenTree = await buildTree(tags, tag.id);
                if (childrenTree) {
                    li.appendChild(childrenTree);
                }

                ul.appendChild(li);
            }

            return ul;
        };

        const allTags = await db.tags.toArray();
        const tree = await buildTree(allTags);
        if (tree) {
            tagTree.appendChild(tree);
        }
    }

    // --- Drag and Drop Functionality ---
    let draggedTagPath = null;
    let draggedTagId = null;

    // Add drag event listeners to the document
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('draggable-tag')) {
            draggedTagPath = e.target.getAttribute('data-tag-path');
            draggedTagId = e.target.getAttribute('data-tag-id');

            // Create drag image with tag path
            const dragImage = document.createElement('div');
            dragImage.className = 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-3 py-2 rounded-lg shadow-lg border border-blue-300 dark:border-blue-700';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            dragImage.textContent = draggedTagPath;
            document.body.appendChild(dragImage);

            e.dataTransfer.setDragImage(dragImage, 0, 0);
            e.dataTransfer.effectAllowed = 'copy';

            // Clean up drag image after a short delay
            setTimeout(() => {
                if (document.body.contains(dragImage)) {
                    document.body.removeChild(dragImage);
                }
            }, 0);

            // Change cursor style
            e.target.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('draggable-tag')) {
            e.target.style.cursor = 'grab';
            draggedTagPath = null;
            draggedTagId = null;
        }
    });

    // Add drop functionality to prompt cards
    document.addEventListener('dragover', (e) => {
        const promptCard = e.target.closest('.bg-white');
        if (promptCard && promptCard.classList.contains('dark:bg-gray-800') && draggedTagPath) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // Add visual feedback
            promptCard.classList.add('ring-2', 'ring-green-500', 'ring-opacity-50');
        }
    });

    document.addEventListener('dragleave', (e) => {
        const promptCard = e.target.closest('.bg-white');
        if (promptCard && promptCard.classList.contains('dark:bg-gray-800')) {
            // Only remove highlight if we're actually leaving the card
            const rect = promptCard.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;

            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                promptCard.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-50');
            }
        }
    });

    document.addEventListener('drop', async (e) => {
        const promptCard = e.target.closest('.bg-white');
        if (promptCard && promptCard.classList.contains('dark:bg-gray-800') && draggedTagPath) {
            e.preventDefault();

            // Remove visual feedback
            promptCard.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-50');

            // Get prompt ID from the card
            const editBtn = promptCard.querySelector('.edit-prompt-btn');
            if (editBtn) {
                const promptId = Number(editBtn.dataset.id);

                try {
                    // Use TagOnlyManager for state isolation (no version creation)
                    const success = await tagOnlyManager.addTagToPrompt(promptId, draggedTagPath);

                    if (success) {
                        // Show success feedback
                        showTagAssignmentFeedback(promptCard, 'Tag assigned successfully (no version created)', 'success');
                    } else {
                        // Show brief visual feedback for duplicate
                        showTagAssignmentFeedback(promptCard, 'Tag already assigned', 'warning');
                    }

                    // Refresh the UI
                    await renderPrompts();
                    await renderTagTree();

                } catch (error) {
                    console.error('Error assigning tag to prompt:', error);
                    showTagAssignmentFeedback(promptCard, 'Error assigning tag', 'error');
                }
            }
        }
    });

    // Helper function to show tag assignment feedback
    function showTagAssignmentFeedback(promptCard, message, type) {
        const feedback = document.createElement('div');
        feedback.className = `absolute top-2 right-2 px-3 py-1 rounded-lg text-sm font-medium z-50 ${
            type === 'success' ? 'bg-green-100 text-green-800 border border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700' :
            type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700' :
            'bg-red-100 text-red-800 border border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700'
        }`;
        feedback.textContent = message;

        // Position relative to the prompt card
        promptCard.style.position = 'relative';
        promptCard.appendChild(feedback);

        // Remove feedback after 2 seconds
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }

    // --- Render Prompts by Tag ---
    async function renderPromptsByTag(tagPath) {
        console.log('Filtering by tag path:', tagPath);

        // Get all tags that match this path pattern (exact match or children)
        const allTags = await db.tags.toArray();
        const matchingTags = allTags.filter(tag => {
            // Exact match or starts with the path followed by a slash
            return tag.fullPath === tagPath || tag.fullPath.startsWith(tagPath + '/');
        });

        console.log('Matching tags:', matchingTags.map(t => t.fullPath));

        if (matchingTags.length === 0) {
            console.error('No tags found starting with:', tagPath);
            promptGrid.innerHTML = `<p class="text-gray-500">No prompts found with tag "${tagPath}".</p>`;
            return;
        }

        // Get all prompt IDs that have any of these tags
        const tagIds = matchingTags.map(tag => tag.id);
        const promptTagRelations = await db.promptTags.where('tagId').anyOf(tagIds).toArray();
        const promptIdsArray = [...new Set(promptTagRelations.map(pt => pt.promptId))];

        console.log('Found prompt IDs:', promptIdsArray);

        if (promptIdsArray.length === 0) {
            promptGrid.innerHTML = `<p class="text-gray-500">No prompts found with tag "${tagPath}".</p>`;
            return;
        }

        const taggedPrompts = await db.prompts.where('id').anyOf(promptIdsArray).and(p => p.isLatest === 1).toArray();
        await renderPrompts(taggedPrompts);

        console.log(`Found ${taggedPrompts.length} prompts for tag pattern "${tagPath}"`);
    }

    // --- Render Untagged Prompts ---
    async function renderUntaggedPrompts() {
        const allPrompts = await db.prompts.where('isLatest').equals(1).toArray();
        const taggedPromptIds = await db.promptTags.toArray().then(tags => tags.map(t => t.promptId));
        const untaggedPrompts = allPrompts.filter(p => !taggedPromptIds.includes(p.id));
        await renderPrompts(untaggedPrompts);
    }

    // --- Navigation Handlers ---
    const allPromptsLink = document.getElementById('all-prompts-link');
    const untaggedPromptsLink = document.getElementById('untagged-prompts-link');

    allPromptsLink.addEventListener('click', async (e) => {
        e.preventDefault();
        // Clear tag tree selection
        document.querySelectorAll('#tag-tree li').forEach(el => el.classList.remove('bg-gray-300', 'dark:bg-gray-800'));
        // Clear search
        searchTerm = '';
        searchInput.value = '';
        await renderPrompts();

        // Update active nav
        document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
        allPromptsLink.classList.add('active');
    });

    untaggedPromptsLink.addEventListener('click', async (e) => {
        e.preventDefault();
        // Clear tag tree selection
        document.querySelectorAll('#tag-tree li').forEach(el => el.classList.remove('bg-gray-300', 'dark:bg-gray-800'));
        await renderUntaggedPrompts();

        // Update active nav
        document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
        untaggedPromptsLink.classList.add('active');
    });

    renderTagTree();

    newPromptForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = document.getElementById('prompt-title').value;
        const description = document.getElementById('prompt-description').value;
        const text = document.getElementById('prompt-text').value;

        try {
            const promptId = await db.prompts.add({
                title,
                description,
                text,
                version: 1,
                isLatest: 1,
                parentId: null,
                createdAt: new Date(),
                lastUsedAt: null,
                timesUsed: 0
            });

            // Handle tags
            for (const tagPath of currentPromptTags) {
                const tag = await createOrGetTag(tagPath);
                await db.promptTags.add({
                    promptId: promptId,
                    tagId: tag.id
                });
            }

            console.log('Prompt saved successfully.');
            currentPromptTags.clear();
            selectedTagsContainer.innerHTML = '';
            hideModal(newPromptModal);
            await renderPrompts();
            await renderTagTree();
        } catch (error) {
            console.error('Failed to save prompt:', error);
        }
    });

    // --- Form Submission (Edit Prompt) ---
    editPromptForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const originalPromptId = Number(document.getElementById('edit-prompt-id').value);
        const title = document.getElementById('edit-prompt-title').value;
        const description = document.getElementById('edit-prompt-description').value;
        const text = document.getElementById('edit-prompt-text').value;

        try {
            const originalPrompt = await db.prompts.get(originalPromptId);
            if (!originalPrompt) {
                console.error('Original prompt not found for editing.');
                return;
            }

            // Check if only tags have changed (content unchanged)
            const contentChanged = (
                title !== originalPrompt.title ||
                description !== originalPrompt.description ||
                text !== originalPrompt.text
            );

            if (!contentChanged) {
                // Only tags changed - use TagOnlyManager (no version creation)
                console.log('Only tags changed - updating without creating new version');

                const tagPaths = Array.from(currentEditTags);
                await tagOnlyManager.replacePromptTags(originalPromptId, tagPaths);

                console.log(`Tags updated for prompt ${originalPromptId} without creating version.`);
            } else {
                // Content changed - create new version (existing behavior)
                console.log('Content changed - creating new version');

                // Mark the old version as not the latest
                await db.prompts.update(originalPromptId, { isLatest: 0 });

                // Remove old tag relationships from the old version
                await db.promptTags.where('promptId').equals(originalPromptId).delete();

                // Add the new version
                const newPromptId = await db.prompts.add({
                    title,
                    description,
                    text,
                    version: (originalPrompt.version || 1) + 1,
                    isLatest: 1,
                    parentId: originalPrompt.parentId || originalPromptId,
                    createdAt: new Date(), // New version gets a new creation date
                    lastUsedAt: originalPrompt.lastUsedAt,
                    timesUsed: originalPrompt.timesUsed
                });

                // Handle tags for the new version
                for (const tagPath of currentEditTags) {
                    const tag = await createOrGetTag(tagPath);
                    await db.promptTags.add({
                        promptId: newPromptId,
                        tagId: tag.id
                    });
                }

                console.log(`Prompt ${originalPromptId} updated to a new version.`);
            }

            currentEditTags.clear();
            editSelectedTagsContainer.innerHTML = '';
            hideModal(editPromptModal);
            await renderPrompts();
            await renderTagTree();
        } catch (error) {
            console.error('Failed to update prompt:', error);
        }
    });

    // --- Render Prompts ---
    async function renderPrompts(prompts = null) {
        promptGrid.innerHTML = '';
        let allPrompts = prompts || await db.prompts.where('isLatest').equals(1).toArray();
        // Filter prompts client-side based on current search term
        if (searchTerm) {
            allPrompts = allPrompts.filter(p => {
                const haystack = `${p.title} ${p.description} ${p.text}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        if (allPrompts.length === 0) {
            promptGrid.innerHTML = '<p class="text-gray-500">No prompts found. Click \'New Prompt\' to get started!</p>';
            return;
        }

        for (const prompt of allPrompts) {
            try {
            const promptTile = document.createElement('div');
            promptTile.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col justify-between border border-gray-200 dark:border-gray-700';
            const parentId = prompt.parentId || prompt.id;
            // Simplified history count to prevent errors on new prompts where parentId is null
            // Fetch count of all versions (rows whose parentId matches or id matches parentId)
            const totalVersions = await db.prompts
                .where('parentId').equals(parentId)
                .or('id').equals(parentId)
                .count();

            // Get tags for this prompt
            const promptTags = await db.promptTags.where('promptId').equals(prompt.id).toArray();
            const tags = [];
            for (const pt of promptTags) {
                const tag = await db.tags.get(pt.tagId);
                if (tag) tags.push(tag);
            }

            const tagsHtml = tags.length > 0 ?
                `<div class="mb-2">
                    ${tags.map(tag => `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1 dark:bg-blue-900 dark:text-blue-300">${tag.fullPath}</span>`).join('')}
                </div>` : '';

            promptTile.innerHTML = `
                <div>
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-lg mb-2 truncate">${prompt.title}</h3>
                        <div class="flex items-center">
                            ${totalVersions > 1 ? `<span class="history-icon mr-2 cursor-pointer" title="View History" data-parent-id="${parentId}">&#128336;</span>` : ''}
                            <span class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">v${prompt.version}</span>
                        </div>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 h-10 overflow-hidden">${prompt.description || 'No description'}</p>
                    ${tagsHtml}
                </div>
                <div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                        <p><strong>Used:</strong> ${prompt.timesUsed} times</p>
                        <p><strong>Last Used:</strong> ${prompt.lastUsedAt ? new Date(prompt.lastUsedAt).toLocaleDateString() : 'Never'}</p>
                        <p><strong>Created:</strong> ${new Date(prompt.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="flex justify-end border-t pt-2 border-gray-200 dark:border-gray-700">
                        <button data-id="${prompt.id}" class="view-prompt-btn text-sm text-purple-500 hover:text-purple-700 mr-4" title="View (Read-only)">&#128065;</button>
                        <button data-id="${prompt.id}" class="copy-prompt-btn text-sm text-green-500 hover:text-green-700 mr-4" title="Copy to Clipboard">&#128203;</button>
                        <button data-id="${prompt.id}" class="edit-prompt-btn text-blue-500 hover:text-blue-700 mr-4" title="Edit">&#9998;</button>
                        <button data-id="${prompt.id}" class="delete-prompt-btn text-red-500 hover:text-red-700" title="Delete">&#128465;</button>
                    </div>
                </div>
            `;
                promptGrid.appendChild(promptTile);
            } catch (error) {
                console.error('Failed to render prompt:', prompt.title, error);
            }
        }
    }

    // --- Event Delegation for Edit, Delete, and History ---
    promptGrid.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('edit-prompt-btn')) {
            const promptId = Number(target.dataset.id);
            const prompt = await db.prompts.get(promptId);
            if (prompt) {
                document.getElementById('edit-prompt-id').value = prompt.id;
                document.getElementById('edit-prompt-title').value = prompt.title;
                document.getElementById('edit-prompt-description').value = prompt.description || '';
                document.getElementById('edit-prompt-text').value = prompt.text;

                // Load existing tags
                currentEditTags.clear();
                editSelectedTagsContainer.innerHTML = '';
                const promptTags = await db.promptTags.where('promptId').equals(promptId).toArray();
                for (const pt of promptTags) {
                    const tag = await db.tags.get(pt.tagId);
                    if (tag) {
                        addTagToContainer(tag.fullPath, editSelectedTagsContainer, currentEditTags);
                    }
                }

                showModal(editPromptModal);
            }
        } else if (target.classList.contains('copy-prompt-btn')) {
            const promptId = Number(target.dataset.id);
            const prompt = await db.prompts.get(promptId);
            if (prompt) {
                try {
                    await navigator.clipboard.writeText(prompt.text);
                    // Update usage stats
                    await db.prompts.update(promptId, {
                        timesUsed: (prompt.timesUsed || 0) + 1,
                        lastUsedAt: new Date()
                    });
                    // Optional: give quick visual feedback
                    target.textContent = '✔️';
                    setTimeout(() => (target.innerHTML = '&#128203;'), 1000);
                    // Re-render to reflect updated stats
                    await renderPrompts();
                } catch (err) {
                    console.error('Failed to copy prompt to clipboard:', err);
                }
            }
        } else if (target.classList.contains('view-prompt-btn')) {
            const promptId = Number(target.dataset.id);
            showReadOnlyViewer(promptId);
        } else if (target.classList.contains('delete-prompt-btn')) {
            const promptId = Number(target.dataset.id);
            if (confirm('Are you sure you want to delete this prompt and all its history? This action cannot be undone.')) {
                await simpleVersionManager.deletePromptWithResequencing(db, renderPrompts, promptId);
            }
        } else if (target.classList.contains('history-icon')) {
            const parentId = Number(target.dataset.parentId);
            await showHistory(parentId);
        }
    });

    // --- History Functionality ---
    async function showHistory(parentId) {
        const history = await db.prompts.where('parentId').equals(parentId).or('id').equals(parentId).reverse().sortBy('version');
        const historyModalBody = document.getElementById('history-modal-body');
        const historyModalTitle = document.getElementById('history-modal-title');
        historyModalBody.innerHTML = ''; // Clear previous history

        if (history.length > 0) {
            historyModalTitle.textContent = `History for: ${history[0].title}`;
        }

        history.forEach(promptVersion => {
            const item = document.createElement('div');
            item.className = 'p-3 mb-2 border rounded-md dark:border-gray-600 text-left';

            // Check if this is the latest version (should not have delete button)
            const isLatest = promptVersion.isLatest === 1;

            item.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-bold mr-2">v${promptVersion.version}</span>
                        <span class="text-xs text-gray-500">${new Date(promptVersion.createdAt).toLocaleString()}</span>
                        ${isLatest ? '<span class="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Latest</span>' : ''}
                    </div>
                    <div>
                        <button class="copy-history-btn text-green-500 hover:text-green-700 mr-2" data-version-id="${promptVersion.id}" title="Copy to Clipboard">&#128203;</button>
                        ${!isLatest ? `<button class="delete-version-btn text-red-500 hover:text-red-700" data-version-id="${promptVersion.id}" title="Delete Version">&#128465;</button>` : ''}
                    </div>
                </div>
                <pre class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">${promptVersion.text}</pre>
            `;
            historyModalBody.appendChild(item);
        });

        showModal(historyModal);
    }

    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('toggle-theme');

    // Apply previous theme mode
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        console.log('Dark mode enabled from localStorage');
    }

    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        document.body.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        console.log('Theme toggled. Dark mode:', isDark);
        console.log('HTML classes:', document.documentElement.className);
        console.log('Body classes:', document.body.className);
    });

    // --- Import/Export Functionality ---
    const importBtn = document.getElementById('import-prompts');
    const exportBtn = document.getElementById('export-prompts');

    importBtn.addEventListener('click', () => {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const prompts = JSON.parse(text);

                    // Import prompts to database
                    for (const prompt of prompts) {
                        await db.prompts.add(prompt);
                    }

                    alert(`Successfully imported ${prompts.length} prompts!`);
                    await renderPrompts();
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Failed to import prompts. Please check the file format.');
                }
            }
        };
        input.click();
    });

    exportBtn.addEventListener('click', async () => {
        try {
            const allPrompts = await db.prompts.toArray();
            const jsonStr = JSON.stringify(allPrompts, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });

            // Create a link to download the file
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'prompts.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export prompts.');
        }
    });

    // --- Help Modal ---
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const viewDatabaseBtn = document.getElementById('view-database-btn');

    helpBtn.addEventListener('click', () => {
        showModal(helpModal);
    });

    closeHelpBtn.addEventListener('click', () => {
        hideModal(helpModal);
    });

    viewDatabaseBtn.addEventListener('click', async () => {
        await window.electronAPI.openDatabaseViewer();
    });

    // --- Help Modal Tab Functionality ---
    const helpTabBtns = document.querySelectorAll('.help-tab-btn');
    const helpTabContents = document.querySelectorAll('.help-tab-content');

    // Function to switch help tabs
    function switchHelpTab(targetTab) {
        // Remove active class from all tab buttons
        helpTabBtns.forEach(btn => {
            btn.classList.remove('active', 'text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
            btn.classList.add('text-gray-500', 'dark:text-gray-400');
        });

        // Hide all tab contents
        helpTabContents.forEach(content => {
            content.classList.add('hidden');
        });

        // Activate the clicked tab button
        const activeBtn = document.querySelector(`[data-tab="${targetTab}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
            activeBtn.classList.add('active', 'text-blue-600', 'dark:text-blue-400', 'border-b-2', 'border-blue-600', 'dark:border-blue-400');
        }

        // Show the corresponding tab content
        const activeContent = document.getElementById(`help-tab-${targetTab}`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    // Add click event listeners to all tab buttons
    helpTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            switchHelpTab(targetTab);
        });
    });

    // Initialize with the first tab active when help modal opens
    helpBtn.addEventListener('click', () => {
        showModal(helpModal);
        // Reset to first tab when opening
        switchHelpTab('basics');
    });

    // --- Sort Options ---
    const sortOptions = document.getElementById('sort-options');

    sortOptions.addEventListener('change', async (e) => {
        const sortBy = e.target.value;
        let sortedPrompts;

        if (sortBy === 'title') {
            sortedPrompts = await db.prompts.where('isLatest').equals(1).sortBy('title');
        } else if (sortBy === 'timesUsed') {
            sortedPrompts = await db.prompts.where('isLatest').equals(1).reverse().sortBy('timesUsed');
        } else if (sortBy === 'lastUsedAt') {
            sortedPrompts = await db.prompts.where('isLatest').equals(1).reverse().sortBy('lastUsedAt');
        } else {
            // Default to createdAt
            sortedPrompts = await db.prompts.where('isLatest').equals(1).reverse().sortBy('createdAt');
        }

        renderPrompts(sortedPrompts);
    });

    // Initial render
    renderPrompts();
});

// --- AI Settings Modal Functions ---
function initializeAISettingsModal() {
    const aiSettingsBtn = document.getElementById('ai-settings-btn');
    const aiSettingsModal = document.getElementById('ai-settings-modal');
    const aiSettingsClose = document.getElementById('close-ai-settings');
    const aiSettingsCancel = document.getElementById('cancel-ai-settings');
    const aiSettingsSave = document.getElementById('save-ai-settings');
    const aiSettingsReset = document.getElementById('reset-ai-settings');

    // Tab elements
    const openrouterTab = document.getElementById('openrouter-tab');
    const ollamaTab = document.getElementById('ollama-tab');
    const generalTab = document.getElementById('general-tab');
    const openrouterPanel = document.getElementById('openrouter-content');
    const ollamaPanel = document.getElementById('ollama-content');
    const generalPanel = document.getElementById('general-content');

    // Test connection buttons
    const testOpenrouterBtn = document.getElementById('test-openrouter');
    const testOllamaBtn = document.getElementById('test-ollama');

    // Current active tab
    let activeTab = 'openrouter';

    // Tab switching function
    function switchTab(tabName) {
        // Update tab buttons - remove active class from all
        [openrouterTab, ollamaTab, generalTab].forEach(tab => {
            tab.classList.remove('active', 'bg-purple-100', 'dark:bg-purple-900');
        });

        // Update panels - hide all
        [openrouterPanel, ollamaPanel, generalPanel].forEach(panel => {
            panel.classList.add('hidden');
        });

        // Activate selected tab and panel
        if (tabName === 'openrouter') {
            openrouterTab.classList.add('active', 'bg-purple-100', 'dark:bg-purple-900');
            openrouterPanel.classList.remove('hidden');
        } else if (tabName === 'ollama') {
            ollamaTab.classList.add('active', 'bg-purple-100', 'dark:bg-purple-900');
            ollamaPanel.classList.remove('hidden');
        } else if (tabName === 'general') {
            generalTab.classList.add('active', 'bg-purple-100', 'dark:bg-purple-900');
            generalPanel.classList.remove('hidden');
        }

        activeTab = tabName;
    }

    // Event listeners for tabs
    openrouterTab.addEventListener('click', () => switchTab('openrouter'));
    ollamaTab.addEventListener('click', () => switchTab('ollama'));
    generalTab.addEventListener('click', () => switchTab('general'));

    // Open modal
    aiSettingsBtn.addEventListener('click', async () => {
        await loadAISettings();
        aiSettingsModal.classList.remove('hidden');
        switchTab('openrouter'); // Default to first tab
    });

    // Close modal handlers
    const closeModal = () => {
        aiSettingsModal.classList.add('hidden');
    };

    aiSettingsClose.addEventListener('click', closeModal);
    aiSettingsCancel.addEventListener('click', closeModal);

    // Click outside to close
    aiSettingsModal.addEventListener('click', (e) => {
        if (e.target === aiSettingsModal) {
            closeModal();
        }
    });

    // Save settings
    aiSettingsSave.addEventListener('click', async () => {
        await saveAISettings();
        closeModal();
    });

    // Reset settings
    aiSettingsReset.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all AI settings to defaults? This will clear all API keys and configurations.')) {
            await resetAISettings();
        }
    });

    // Test connection handlers
    testOpenrouterBtn.addEventListener('click', async () => {
        await testProviderConnection('openrouter');
    });

    testOllamaBtn.addEventListener('click', async () => {
        await testProviderConnection('ollama');
    });
// Add event listener to refresh Ollama models when endpoint changes
    function setupOllamaModelRefresh() {
        const endpointInput = document.getElementById('ollama-endpoint');
        if (endpointInput) {
            endpointInput.addEventListener('blur', async () => {
                await loadOllamaModels();
            });
        }
    }

    // Setup Ollama model refresh functionality
    setupOllamaModelRefresh();
// Setup OpenRouter model refresh functionality
    setupOpenRouterModelRefresh();
}

// Setup OpenRouter model refresh functionality
function setupOpenRouterModelRefresh() {
    const refreshBtn = document.getElementById('refresh-openrouter-models');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadOpenRouterModels();
        });
    }

    // Also refresh when API key changes
    const apiKeyInput = document.getElementById('openrouter-api-key');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('blur', async () => {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                await loadOpenRouterModels();
            }
        });
    }

    // Refresh when "free only" checkbox is toggled
    const freeOnlyCheckbox = document.getElementById('openrouter-free-only');
    if (freeOnlyCheckbox) {
        freeOnlyCheckbox.addEventListener('change', async () => {
            const apiKeyInput = document.getElementById('openrouter-api-key');
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                await loadOpenRouterModels();
            }
        });
    }
}

// Load available OpenRouter models dynamically
async function loadOpenRouterModels() {
    try {
        const apiKeyInput = document.getElementById('openrouter-api-key');
        const apiKey = apiKeyInput.value.trim();
        const currentModel = document.getElementById('openrouter-model').value;
        const modelSelect = document.getElementById('openrouter-model');
        const refreshBtn = document.getElementById('refresh-openrouter-models');

        if (!apiKey) {
            console.warn('OpenRouter API key not provided, cannot fetch models');
            return;
        }

        // Show loading state
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳';
            refreshBtn.classList.add('opacity-50');
        }

        // Try to fetch available models via IPC
        const result = await window.electronAPI.ai.getOpenRouterModels(apiKey);

        if (result.success && result.models.length > 0) {
            let models = result.models;

            // Check if "free only" filter is enabled
            const freeOnlyCheckbox = document.getElementById('openrouter-free-only');
            const showFreeOnly = freeOnlyCheckbox && freeOnlyCheckbox.checked;

            // Filter models if "free only" is enabled
            if (showFreeOnly) {
                models = models.filter(model => {
                    // Check if model is free (pricing.prompt === "0" or pricing.completion === "0")
                    return model.pricing && (
                        (model.pricing.prompt === "0" || model.pricing.prompt === 0) ||
                        (model.pricing.completion === "0" || model.pricing.completion === 0)
                    );
                });
            }

            // Clear the select and populate with available models
            modelSelect.innerHTML = '';

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                // Show pricing info in the model name for better UX
                const pricingInfo = model.pricing && !showFreeOnly ?
                    ` ($${model.pricing.prompt}/$${model.pricing.completion})` : '';
                option.textContent = `${model.name || model.id}${pricingInfo}`;
                if (model.id === currentModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });

            // If current model is not in the list, add it as the first option
            if (!models.some(m => m.id === currentModel) && currentModel) {
                const option = document.createElement('option');
                option.value = currentModel;
                option.textContent = `${currentModel} (not found)`;
                option.selected = true;
                modelSelect.insertBefore(option, modelSelect.firstChild);
            }

            console.log(`Loaded ${models.length} OpenRouter models`);
        } else {
            // No models found or error, keep current options
            if (result.error) {
                console.warn('Failed to fetch OpenRouter models:', result.error);
            }
        }
    } catch (error) {
        console.warn('Could not load OpenRouter models:', error.message);
        // Keep the current model value if fetching fails
    } finally {
        // Reset button state
        const refreshBtn = document.getElementById('refresh-openrouter-models');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄';
            refreshBtn.classList.remove('opacity-50');
        }
    }
}

// Load available Ollama models dynamically
async function loadOllamaModels() {
    try {
        const ollamaEndpoint = document.getElementById('ollama-endpoint').value.trim() || 'http://localhost:11434';
        const currentModel = document.getElementById('ollama-model').value;
        const modelSelect = document.getElementById('ollama-model');

        // Clear existing options except the current one
        modelSelect.innerHTML = `<option value="${currentModel}">${currentModel}</option>`;

        // Try to fetch available models via IPC
        const result = await window.electronAPI.ai.getOllamaModels(ollamaEndpoint);

        if (result.success && result.models.length > 0) {
            const models = result.models;

            // Clear the select and populate with available models
            modelSelect.innerHTML = '';

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                if (model.name === currentModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });

            // If current model is not in the list, add it as the first option
            if (!models.some(m => m.name === currentModel) && currentModel) {
                const option = document.createElement('option');
                option.value = currentModel;
                option.textContent = `${currentModel} (not found)`;
                option.selected = true;
                modelSelect.insertBefore(option, modelSelect.firstChild);
            }

            console.log(`Loaded ${models.length} Ollama models`);
        } else {
            // No models found or error, add default option
            const option = document.createElement('option');
            option.value = currentModel || 'llama3.1:8b';
            option.textContent = currentModel || 'llama3.1:8b';
            option.selected = true;
            modelSelect.appendChild(option);

            if (result.error) {
                console.warn('Failed to fetch Ollama models:', result.error);
            }
        }
    } catch (error) {
        console.warn('Could not load Ollama models:', error.message);
        // Keep the current model value if fetching fails
    }
}
// Load AI settings from backend
async function loadAISettings() {
    try {
        const config = await window.electronAPI.ai.getConfig();
        console.log('Loaded config:', config);

        // OpenRouter settings
        document.getElementById('openrouter-enabled').checked = config.openrouter?.enabled === true;
        document.getElementById('openrouter-api-key').value = config.openrouter?.apiKey || '';
        document.getElementById('openrouter-model').value = config.openrouter?.model || 'anthropic/claude-3.5-sonnet';
        document.getElementById('openrouter-timeout').value = (config.openrouter?.timeout || 30000) / 1000; // Convert to seconds
        document.getElementById('openrouter-retries').value = config.openrouter?.retries || 2;

        // Ollama settings
        document.getElementById('ollama-enabled').checked = config.ollama?.enabled === true;
        document.getElementById('ollama-endpoint').value = config.ollama?.endpoint || 'http://localhost:11434';
        document.getElementById('ollama-model').value = config.ollama?.model || 'llama3.1:8b';
        document.getElementById('ollama-timeout').value = (config.ollama?.timeout || 60000) / 1000; // Convert to seconds
        document.getElementById('ollama-retries').value = config.ollama?.retries || 1;

        // General settings
        document.getElementById('default-provider').value = config.defaultProvider || 'openrouter';
        document.getElementById('generation-prompt').value = config.systemPrompts?.generation || 'You are an AI assistant that helps generate high-quality prompts based on user descriptions.';
        document.getElementById('optimization-prompt').value = config.systemPrompts?.optimization || 'You are an AI assistant that helps optimize and improve existing prompts for better clarity and effectiveness.';
        document.getElementById('generation-temperature').value = config.temperature?.generation || 0.7;
        document.getElementById('optimization-temperature').value = config.temperature?.optimization || 0.3;

        // Load available Ollama models dynamically
        await loadOllamaModels();
// Load available OpenRouter models if API key is present
        if (config.openrouter?.apiKey) {
            await loadOpenRouterModels();
        }

        console.log('AI settings loaded successfully');
    } catch (error) {
        console.error('Failed to load AI settings:', error);
        alert('Failed to load AI settings. Please try again.');
    }
}

// Save AI settings to backend
async function saveAISettings() {
    try {
        const config = {
            openrouter: {
                enabled: document.getElementById('openrouter-enabled').checked,
                apiKey: document.getElementById('openrouter-api-key').value.trim(),
                model: document.getElementById('openrouter-model').value,
                timeout: parseInt(document.getElementById('openrouter-timeout').value) * 1000, // Convert to milliseconds
                retries: parseInt(document.getElementById('openrouter-retries').value)
            },
            ollama: {
                enabled: document.getElementById('ollama-enabled').checked,
                endpoint: document.getElementById('ollama-endpoint').value.trim(),
                model: document.getElementById('ollama-model').value.trim(),
                timeout: parseInt(document.getElementById('ollama-timeout').value) * 1000, // Convert to milliseconds
                retries: parseInt(document.getElementById('ollama-retries').value)
            },
            defaultProvider: document.getElementById('default-provider').value,
            systemPrompts: {
                generation: document.getElementById('generation-prompt').value.trim(),
                optimization: document.getElementById('optimization-prompt').value.trim()
            },
            temperature: {
                generation: parseFloat(document.getElementById('generation-temperature').value),
                optimization: parseFloat(document.getElementById('optimization-temperature').value)
            }
        };

        const result = await window.electronAPI.ai.saveConfig(config);

        if (result.success) {
            // Reload AI config
            aiConfig = config;

            console.log('AI settings saved successfully');
        } else {
            throw new Error(result.error || 'Failed to save configuration');
        }
    } catch (error) {
        console.error('Failed to save AI settings:', error);
        alert('Failed to save AI settings: ' + error.message);
    }
}

// Reset AI settings to defaults
async function resetAISettings() {
    try {
        // Clear all form fields to defaults
        document.getElementById('openrouter-enabled').checked = true;
        document.getElementById('openrouter-api-key').value = '';
        document.getElementById('openrouter-model').value = 'anthropic/claude-3.5-sonnet';
        document.getElementById('openrouter-timeout').value = '30';
        document.getElementById('openrouter-retries').value = '2';

        document.getElementById('ollama-enabled').checked = true;
        document.getElementById('ollama-endpoint').value = 'http://localhost:11434';
        document.getElementById('ollama-model').value = 'llama3.1:8b';
        document.getElementById('ollama-timeout').value = '60';
        document.getElementById('ollama-retries').value = '1';

        document.getElementById('default-provider').value = 'openrouter';
        document.getElementById('generation-prompt').value = 'You are an AI assistant that helps generate high-quality prompts based on user descriptions.';
        document.getElementById('optimization-prompt').value = 'You are an AI assistant that helps optimize and improve existing prompts for better clarity and effectiveness.';
        document.getElementById('generation-temperature').value = '0.7';
        document.getElementById('optimization-temperature').value = '0.3';

        console.log('AI settings reset to defaults');
    } catch (error) {
        console.error('Failed to reset AI settings:', error);
        alert('Failed to reset AI settings. Please try again.');
    }
}

// Test provider connection
async function testProviderConnection(provider) {
    const testBtn = provider === 'openrouter' ?
        document.getElementById('test-openrouter') :
        document.getElementById('test-ollama');

    const originalText = testBtn.textContent;

    try {
        // Show loading state
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        testBtn.classList.add('opacity-50');

        // Get current form values for testing
        let config;
        if (provider === 'openrouter') {
            config = {
                apiKey: document.getElementById('openrouter-api-key').value.trim(),
                model: document.getElementById('openrouter-model').value,
                timeout: parseInt(document.getElementById('openrouter-timeout').value) * 1000, // Convert to milliseconds
                retries: parseInt(document.getElementById('openrouter-retries').value)
            };
        } else {
            config = {
                endpoint: document.getElementById('ollama-endpoint').value.trim(),
                model: document.getElementById('ollama-model').value.trim(),
                timeout: parseInt(document.getElementById('ollama-timeout').value) * 1000, // Convert to milliseconds
                retries: parseInt(document.getElementById('ollama-retries').value)
            };
        }

        const result = await window.electronAPI.ai.testProvider(provider, config);

        if (result.success) {
            testBtn.textContent = '✓ Connected';
            testBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            testBtn.classList.add('bg-green-500');

            setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.classList.remove('bg-green-500');
                testBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            }, 2000);
        } else {
            throw new Error(result.error || 'Connection test failed');
        }


    } catch (error) {
        console.error(`${provider} connection test failed:`, error);

        testBtn.textContent = '✗ Failed';
        testBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        testBtn.classList.add('bg-red-500');

        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.classList.remove('bg-red-500');
            testBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }, 2000);

        alert(`Connection test failed: ${error.message}`);
    } finally {
        // Restore button state
        testBtn.disabled = false;
        testBtn.classList.remove('opacity-50');
    }
}

// --- Tag Modal Management ---
function initializeTagModal() {
    const tagModal = document.getElementById('tag-modal');
    const tagManagementBtn = document.getElementById('tag-management-btn');
    const closeTagModalBtn = document.getElementById('close-tag-modal');
    const closeTagModalFooterBtn = document.getElementById('close-tag-modal-footer');
    const createTagForm = document.getElementById('create-tag-form');
    const refreshTagsBtn = document.getElementById('refresh-tags-btn');
    const tagSearchInput = document.getElementById('tag-search');
    const tagsListContainer = document.getElementById('tags-list-container');

    // Rename and delete modal elements
    const renameTagModal = document.getElementById('rename-tag-modal');
    const deleteTagModal = document.getElementById('delete-tag-modal');
    const renameTagForm = document.getElementById('rename-tag-form');
    const cancelRenameBtn = document.getElementById('cancel-rename-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    let currentTags = [];
    let filteredTags = [];

    // Open tag modal
    tagManagementBtn.addEventListener('click', async () => {
        tagModal.classList.remove('hidden');
        await loadTagsList();
    });

    // Close tag modal
    const closeTagModal = () => {
        tagModal.classList.add('hidden');
        // Clear form
        createTagForm.reset();
        tagSearchInput.value = '';
    };

    closeTagModalBtn.addEventListener('click', closeTagModal);
    closeTagModalFooterBtn.addEventListener('click', closeTagModal);

    // Close modal when clicking outside
    tagModal.addEventListener('click', (e) => {
        if (e.target === tagModal) {
            closeTagModal();
        }
    });

    // Create new tag
    createTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tagName = document.getElementById('new-tag-name').value.trim();
        const description = document.getElementById('new-tag-description').value.trim();

        if (!tagName) return;

        try {
            const result = await tagOnlyManager.createTag(tagName, description);

            if (result.success) {
                console.log('Tag created successfully:', result.tag);
                createTagForm.reset();
                await loadTagsList();
                await renderTagTree(); // Refresh the sidebar tag tree
            } else {
                alert('Failed to create tag: ' + result.error);
            }
        } catch (error) {
            console.error('Error creating tag:', error);
            alert('Error creating tag: ' + error.message);
        }
    });

    // Refresh tags list
    refreshTagsBtn.addEventListener('click', async () => {
        await loadTagsList();
    });

    // Search/filter tags
    tagSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterTags(searchTerm);
    });

    // Load and display tags
    async function loadTagsList() {
        try {
            const loadingDiv = document.getElementById('tags-loading');
            loadingDiv.style.display = 'block';
            loadingDiv.textContent = 'Loading tags...';

            // Get all tags with usage counts
            const allTags = await db.tags.orderBy('fullPath').toArray();

            // Get usage counts for each tag
            const tagsWithCounts = await Promise.all(allTags.map(async (tag) => {
                const promptTagRelations = await db.promptTags.where('tagId').equals(tag.id).toArray();
                const promptIds = promptTagRelations.map(pt => pt.promptId);
                const latestPrompts = await db.prompts.where('id').anyOf(promptIds).and(p => p.isLatest === 1).toArray();
                const usageCount = latestPrompts.length;
                return { ...tag, usageCount };
            }));

            currentTags = tagsWithCounts;
            filteredTags = [...currentTags];

            loadingDiv.style.display = 'none';
            renderTagsList();
        } catch (error) {
            console.error('Error loading tags:', error);
            const loadingDiv = document.getElementById('tags-loading');
            loadingDiv.textContent = 'Error loading tags';
        }
    }

    // Filter tags based on search term
    function filterTags(searchTerm) {
        if (!searchTerm) {
            filteredTags = [...currentTags];
        } else {
            filteredTags = currentTags.filter(tag =>
                tag.fullPath.toLowerCase().includes(searchTerm) ||
                (tag.description && tag.description.toLowerCase().includes(searchTerm))
            );
        }
        renderTagsList();
    }

    // Render the tags list
    function renderTagsList() {
        const template = document.getElementById('tag-item-template');
        tagsListContainer.innerHTML = '';

        if (filteredTags.length === 0) {
            tagsListContainer.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4">No tags found</div>';
            return;
        }

        filteredTags.forEach(tag => {
            const tagElement = template.content.cloneNode(true);

            // Set hierarchy indicator
            const hierarchyIndicator = tagElement.querySelector('.tag-hierarchy-indicator');
            const level = tag.level || 0;
            hierarchyIndicator.textContent = '  '.repeat(level) + (level > 0 ? '└─ ' : '');

            // Set tag name
            const tagName = tagElement.querySelector('.tag-name');
            tagName.textContent = tag.name;

            // Set usage count
            const usageCount = tagElement.querySelector('.tag-usage-count');
            usageCount.textContent = tag.usageCount || 0;

            // Set description
            const tagDescription = tagElement.querySelector('.tag-description');
            if (tag.description) {
                tagDescription.textContent = tag.description;
            } else {
                tagDescription.style.display = 'none';
            }

            // Add event listeners for rename and delete buttons
            const renameBtn = tagElement.querySelector('.rename-tag-btn');
            const deleteBtn = tagElement.querySelector('.delete-tag-btn');

            renameBtn.addEventListener('click', () => openRenameModal(tag));
            deleteBtn.addEventListener('click', () => openDeleteModal(tag));

            tagsListContainer.appendChild(tagElement);
        });
    }

    // Open rename modal
    function openRenameModal(tag) {
        document.getElementById('rename-tag-id').value = tag.id;
        document.getElementById('rename-tag-name').value = tag.fullPath;
        renameTagModal.classList.remove('hidden');
    }

    // Open delete modal
    function openDeleteModal(tag) {
        document.getElementById('delete-tag-name').textContent = tag.fullPath;
        confirmDeleteBtn.setAttribute('data-tag-id', tag.id);
        confirmDeleteBtn.setAttribute('data-tag-path', tag.fullPath);
        deleteTagModal.classList.remove('hidden');
    }

    // Close rename modal
    const closeRenameModal = () => {
        renameTagModal.classList.add('hidden');
        renameTagForm.reset();
    };

    cancelRenameBtn.addEventListener('click', closeRenameModal);

    // Close delete modal
    const closeDeleteModal = () => {
        deleteTagModal.classList.add('hidden');
    };

    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // Handle rename form submission
    renameTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tagId = parseInt(document.getElementById('rename-tag-id').value);
        const newTagName = document.getElementById('rename-tag-name').value.trim();

        if (!newTagName) return;

        try {
            const result = await tagOnlyManager.renameTag(tagId, newTagName);

            if (result.success) {
                console.log('Tag renamed successfully');
                closeRenameModal();
                await loadTagsList();
                await renderTagTree(); // Refresh the sidebar tag tree
            } else {
                alert('Failed to rename tag: ' + result.error);
            }
        } catch (error) {
            console.error('Error renaming tag:', error);
            alert('Error renaming tag: ' + error.message);
        }
    });

    // Handle delete confirmation
    confirmDeleteBtn.addEventListener('click', async () => {
        const tagId = parseInt(confirmDeleteBtn.getAttribute('data-tag-id'));
        const tagPath = confirmDeleteBtn.getAttribute('data-tag-path');

        try {
            const result = await tagOnlyManager.deleteTag(tagId);

            if (result.success) {
                console.log('Tag deleted successfully');
                closeDeleteModal();
                await loadTagsList();
                await renderTagTree(); // Refresh the sidebar tag tree
            } else {
                alert('Failed to delete tag: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Error deleting tag: ' + error.message);
        }
    });

    // Close modals when clicking outside
    renameTagModal.addEventListener('click', (e) => {
        if (e.target === renameTagModal) {
            closeRenameModal();
        }
    });

    deleteTagModal.addEventListener('click', (e) => {
        if (e.target === deleteTagModal) {
            closeDeleteModal();
        }
    });
}

// Initialize tag modal after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the main initialization to complete
    setTimeout(() => {
        initializeTagModal();
    }, 100);
});
