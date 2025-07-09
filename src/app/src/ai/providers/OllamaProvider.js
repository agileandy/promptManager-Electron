/**
 * Ollama AI Provider
 * Implements the BaseProvider interface for local Ollama API
 */
import { BaseProvider } from './BaseProvider.js';

export class OllamaProvider extends BaseProvider {
    constructor(config) {
        super(config);
        // Ollama doesn't require API key
        this.apiKey = null;
    }

    /**
     * Generate a prompt based on description
     * @param {string} description - User's description
     * @param {string} systemPrompt - System prompt to use
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated prompt text
     */
    async generatePrompt(description, systemPrompt, options = {}) {
        const messages = this.buildMessages(systemPrompt, description);
        return await this.makeCompletion(messages, options);
    }

    /**
     * Optimize an existing prompt
     * @param {string} promptText - Current prompt text
     * @param {string} systemPrompt - System prompt to use
     * @param {Object} options - Optimization options
     * @returns {Promise<string>} Optimized prompt text
     */
    async optimizePrompt(promptText, systemPrompt, options = {}) {
        const messages = this.buildMessages(systemPrompt, promptText);
        return await this.makeCompletion(messages, options);
    }

    /**
     * Test connection to Ollama
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            // First check if Ollama is running
            const healthResponse = await fetch(`${this.getBaseUrl()}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (!healthResponse.ok) {
                return false;
            }

            // Check if the specified model is available
            const models = await healthResponse.json();
            const modelExists = models.models?.some(m => m.name === this.model);

            if (!modelExists) {
                console.warn(`Ollama model ${this.model} not found. Available models:`,
                    models.models?.map(m => m.name) || []);
                return false;
            }

            // Test with a simple completion
            const testMessages = this.buildMessages(
                "You are a helpful assistant.",
                "Say 'Hello' to test the connection."
            );

            const response = await this.makeCompletion(testMessages, { maxTokens: 10 });
            return response && response.length > 0;
        } catch (error) {
            console.error('Ollama connection test failed:', error);
            return false;
        }
    }

    /**
     * Get base URL for Ollama API
     * @returns {string} Base URL
     */
    getBaseUrl() {
        return this.endpoint.replace('/api/chat', '');
    }

    /**
     * Make completion request to Ollama API
     * @param {Array} messages - Messages array
     * @param {Object} options - Request options
     * @returns {Promise<string>} Completion text
     */
    async makeCompletion(messages, options = {}) {
        const requestBody = {
            model: this.model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: options.maxTokens || 2000
            }
        };

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        };

        try {
            const response = await this.makeRequest(this.endpoint, requestOptions);
            const data = await response.json();

            if (data.error) {
                throw new Error(`Ollama API error: ${data.error}`);
            }

            if (!data.message || !data.message.content) {
                throw new Error('No content returned from Ollama');
            }

            return data.message.content.trim();
        } catch (error) {
            console.error('Ollama completion failed:', error);
            throw error;
        }
    }

    /**
     * Get available models from Ollama
     * @returns {Promise<Array>} Array of available models
     */
    async getAvailableModels() {
        try {
            const response = await this.makeRequest(`${this.getBaseUrl()}/api/tags`, {
                method: 'GET'
            });

            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Failed to fetch Ollama models:', error);
            return [];
        }
    }

    /**
     * Pull a model from Ollama registry
     * @param {string} modelName - Name of the model to pull
     * @returns {Promise<boolean>} True if successful
     */
    async pullModel(modelName) {
        try {
            const response = await fetch(`${this.getBaseUrl()}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: modelName })
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to pull Ollama model:', error);
            return false;
        }
    }
}