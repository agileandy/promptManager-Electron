/**
 * OpenRouter AI Provider
 * Implements the BaseProvider interface for OpenRouter API
 */
import { BaseProvider } from './BaseProvider.js';

export class OpenRouterProvider extends BaseProvider {
    constructor(config) {
        super(config);
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
     * Test connection to OpenRouter
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            const testMessages = this.buildMessages(
                "You are a helpful assistant.",
                "Say 'Hello' to test the connection."
            );

            const response = await this.makeCompletion(testMessages, { maxTokens: 10 });
            return response && response.length > 0;
        } catch (error) {
            console.error('OpenRouter connection test failed:', error);
            return false;
        }
    }

    /**
     * Make completion request to OpenRouter API
     * @param {Array} messages - Messages array
     * @param {Object} options - Request options
     * @returns {Promise<string>} Completion text
     */
    async makeCompletion(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key not configured');
        }

        const requestBody = {
            model: this.model,
            messages: messages,
            max_tokens: options.maxTokens || 2000,
            temperature: options.temperature || 0.7,
            stream: false
        };

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://github.com/agileandy/promptManager-Electron',
                'X-Title': 'AI Prompt Manager'
            },
            body: JSON.stringify(requestBody)
        };

        try {
            const response = await this.makeRequest(this.endpoint, requestOptions);
            const data = await response.json();

            if (data.error) {
                throw new Error(`OpenRouter API error: ${data.error.message || data.error}`);
            }

            if (!data.choices || data.choices.length === 0) {
                throw new Error('No completion choices returned from OpenRouter');
            }

            const content = data.choices[0].message?.content;
            if (!content) {
                throw new Error('Empty content returned from OpenRouter');
            }

            return content.trim();
        } catch (error) {
            console.error('OpenRouter completion failed:', error);
            throw error;
        }
    }

    /**
     * Get available models for OpenRouter
     * @returns {Promise<Array>} Array of available models
     */
    async getAvailableModels() {
        try {
            const response = await this.makeRequest('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Failed to fetch OpenRouter models:', error);
            return [];
        }
    }
}