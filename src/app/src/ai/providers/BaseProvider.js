/**
 * Base AI Provider Interface
 * Defines the contract that all AI providers must implement
 */
class BaseProvider {
    constructor(config) {
        this.config = config;
        this.name = config.name;
        this.endpoint = config.endpoint;
        this.model = config.model;
        this.apiKey = config.apiKey;
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 2;
    }

    /**
     * Generate a prompt based on description
     * @param {string} description - User's description
     * @param {string} systemPrompt - System prompt to use
     * @param {Object} options - Generation options (maxTokens, temperature, etc.)
     * @returns {Promise<string>} Generated prompt text
     */
    async generatePrompt(description, systemPrompt, options = {}) {
        throw new Error('generatePrompt method must be implemented by provider');
    }

    /**
     * Optimize an existing prompt
     * @param {string} promptText - Current prompt text
     * @param {string} systemPrompt - System prompt to use
     * @param {Object} options - Optimization options (maxTokens, temperature, etc.)
     * @returns {Promise<string>} Optimized prompt text
     */
    async optimizePrompt(promptText, systemPrompt, options = {}) {
        throw new Error('optimizePrompt method must be implemented by provider');
    }

    /**
     * Test connection to the provider
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        throw new Error('testConnection method must be implemented by provider');
    }

    /**
     * Update provider configuration
     * @param {Object} newConfig - New configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.endpoint = this.config.endpoint;
        this.model = this.config.model;
        this.apiKey = this.config.apiKey;
        this.timeout = this.config.timeout || 30000;
        this.maxRetries = this.config.maxRetries || 2;
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async makeRequest(url, options = {}) {
        let lastError;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response;
            } catch (error) {
                lastError = error;

                // Don't retry on authentication errors
                if (error.message.includes('401') || error.message.includes('403')) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Build messages array for chat completion
     * @param {string} systemPrompt - System prompt
     * @param {string} userMessage - User message
     * @returns {Array} Messages array
     */
    buildMessages(systemPrompt, userMessage) {
        return [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userMessage
            }
        ];
    }
}
module.exports = { BaseProvider };