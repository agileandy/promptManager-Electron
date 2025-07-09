// Initialize the database
let db;
let dataDir;

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

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database first
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.error('Failed to initialize database');
        return;
    }
    
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

    newPromptBtn.addEventListener('click', () => showModal(newPromptModal));
    cancelPromptBtn.addEventListener('click', () => hideModal(newPromptModal));
    cancelEditBtn.addEventListener('click', () => hideModal(editPromptModal));
    closeHistoryBtn.addEventListener('click', () => hideModal(historyModal));

        // --- Copy functionality inside history modal ---
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
            }
        });

    // --- Search Functionality ---
    searchInput.addEventListener('input', async (e) => {
        searchTerm = e.target.value.trim().toLowerCase();
        await renderPrompts();
    });

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
            const filteredTags = tags.filter(tag => tag.parentId === parentId);
            if (filteredTags.length === 0) return null;

            const ul = document.createElement('ul');
            ul.classList.add('ml-2', 'pl-3', 'border-l', 'border-gray-300', 'dark:border-gray-600');

            for (const tag of filteredTags) {
                // Get rollup count of unique prompts in this tag's entire subtree
                const promptCount = await getTagTreePromptCount(tags, tag.id);

                const li = document.createElement('li');
                li.classList.add('mb-2', 'cursor-pointer', 'hover:bg-gray-200', 'dark:hover:bg-gray-700', 'p-1');
                li.innerHTML = `${tag.name} <span class="text-xs text-gray-500 dark:text-gray-400">(${promptCount})</span>`;
                li.setAttribute('data-tag-path', tag.fullPath);

                li.addEventListener('click', async (e) => {
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

            // Mark the old version as not the latest
            await db.prompts.update(originalPromptId, { isLatest: 0 });

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
        } else if (target.classList.contains('delete-prompt-btn')) {
            const promptId = Number(target.dataset.id);
            if (confirm('Are you sure you want to delete this prompt and all its history? This action cannot be undone.')) {
                const promptToDelete = await db.prompts.get(promptId);
                const parentId = promptToDelete.parentId || promptId;
                // Delete all versions of the prompt
                await db.prompts.where('parentId').equals(parentId).or('id').equals(parentId).delete();
                await renderPrompts();
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
            item.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-bold mr-2">v${promptVersion.version}</span>
                        <span class="text-xs text-gray-500">${new Date(promptVersion.createdAt).toLocaleString()}</span>
                    </div>
                    <button class="copy-history-btn text-green-500 hover:text-green-700" data-version-id="${promptVersion.id}" title="Copy to Clipboard">&#128203;</button>
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
