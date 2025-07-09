/**
 * AI Service Manager - Main interface for AI operations
 * Handles provider selection, configuration, and request routing
 */
class AIService {
    constructor() {
        this.providers = new Map();
        this.defaultProvider = null;
        this.config = null;
    }

    /**
     * Initialize the AI service with configuration
     * @param {Object} config - AI configuration object
     */
    async initialize(config) {
        this.config = config;
        this.defaultProvider = config.defaultProvider;

        // Initialize providers based on configuration
        const { OpenRouterProvider } = require('./providers/OpenRouterProvider.js');
        const { OllamaProvider } = require('./providers/OllamaProvider.js');

        // Register available providers
        if (config.providers.openrouter?.enabled) {
            this.providers.set('openrouter', new OpenRouterProvider(config.providers.openrouter));
        }

        if (config.providers.ollama?.enabled) {
            this.providers.set('ollama', new OllamaProvider(config.providers.ollama));
        }

        console.log('AI Service initialized with providers:', Array.from(this.providers.keys()));
    }

    /**
     * Get list of available providers
     * @returns {Array} Array of provider names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Get provider instance by name
     * @param {string} providerName - Name of the provider
     * @returns {Object|null} Provider instance or null if not found
     */
    getProvider(providerName) {
        return this.providers.get(providerName) || null;
    }

    /**
     * Generate a prompt using AI based on description
     * @param {string} description - User's description of the desired prompt
     * @param {string} providerName - Optional provider name, uses default if not specified
     * @returns {Promise<string>} Generated prompt text
     */
    async generatePrompt(description, providerName = null) {
        const provider = this.getProvider(providerName || this.defaultProvider);
        if (!provider) {
            throw new Error(`Provider ${providerName || this.defaultProvider} not available`);
        }

        try {
            const systemPrompt = this.config.generation.systemPrompt;
            return await provider.generatePrompt(description, systemPrompt, this.config.generation);
        } catch (error) {
            console.error('AI prompt generation failed:', error);
            throw error;
        }
    }

    /**
     * Optimize an existing prompt using AI
     * @param {string} promptText - Current prompt text to optimize
     * @param {string} providerName - Optional provider name, uses default if not specified
     * @returns {Promise<string>} Optimized prompt text
     */
    async optimizePrompt(promptText, providerName = null) {
        const provider = this.getProvider(providerName || this.defaultProvider);
        if (!provider) {
            throw new Error(`Provider ${providerName || this.defaultProvider} not available`);
        }

        try {
            const systemPrompt = this.config.optimization.systemPrompt;
            return await provider.optimizePrompt(promptText, systemPrompt, this.config.optimization);
        } catch (error) {
            console.error('AI prompt optimization failed:', error);
            throw error;
        }
    }

    /**
     * Get default provider name
     * @returns {string} Default provider name
     */
    getDefaultProvider() {
        return this.defaultProvider;
    }

    /**
     * Get available models for a specific provider
     * @param {string} providerName - Name of the provider
     * @returns {Promise<Array>} Array of available models
     */
    async getAvailableModels(providerName) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        try {
            return await provider.getAvailableModels();
        } catch (error) {
            console.error(`Failed to get models for ${providerName}:`, error);
            return [];
        }
    }

    /**
     * Test connection to a specific provider
     * @param {string} providerName - Name of the provider to test
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection(providerName) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        try {
            return await provider.testConnection();
        } catch (error) {
            console.error(`Connection test failed for ${providerName}:`, error);
            return false;
        }
    }

    /**
     * Update provider configuration
     * @param {string} providerName - Name of the provider
     * @param {Object} config - New configuration for the provider
     */
    async updateProviderConfig(providerName, config) {
        const provider = this.getProvider(providerName);
        if (provider) {
            await provider.updateConfig(config);
        }
    }
}

// Export singleton instance
const aiService = new AIService();
module.exports = { AIService, aiService };