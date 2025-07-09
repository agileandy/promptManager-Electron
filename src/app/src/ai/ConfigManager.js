/**
 * AI Configuration Manager
 * Handles loading, saving, and encrypting AI provider configurations
 */
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = null;
        this.encryptionKey = null;
        this.defaultConfig = {
            ai: {
                defaultProvider: "openrouter",
                providers: {
                    openrouter: {
                        enabled: false,
                        name: "OpenRouter",
                        endpoint: "https://openrouter.ai/api/v1/chat/completions",
                        model: "anthropic/claude-3.5-sonnet",
                        apiKey: null,
                        timeout: 30000,
                        maxRetries: 2
                    },
                    ollama: {
                        enabled: false,
                        name: "Ollama",
                        endpoint: "http://localhost:11434/api/chat",
                        model: "llama3.1:8b",
                        apiKey: null,
                        timeout: 60000,
                        maxRetries: 1
                    }
                },
                generation: {
                    systemPrompt: "Your role is to create AI generated user prompts based on the description provided to you",
                    maxTokens: 2000,
                    temperature: 0.7
                },
                optimization: {
                    systemPrompt: "Optimize this prompt for use in AI systems to improve clarity, specificity, and effectiveness",
                    maxTokens: 2000,
                    temperature: 0.3
                }
            }
        };
    }

    /**
     * Initialize the configuration manager
     * @param {string} dataDir - Application data directory
     */
    async initialize(dataDir) {
        this.configPath = path.join(dataDir, 'ai-config.json');
        this.encryptionKey = this.generateEncryptionKey();

        // Ensure config file exists
        await this.ensureConfigFile();
    }

    /**
     * Generate encryption key based on machine-specific identifiers
     * @returns {string} Encryption key
     */
    generateEncryptionKey() {
        const os = require('os');
        const machineId = os.hostname() + os.platform() + os.arch();
        return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32);
    }

    /**
     * Encrypt sensitive data
     * @param {string} text - Text to encrypt
     * @returns {string} Encrypted text
     */
    encrypt(text) {
        if (!text) return null;

        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    /**
     * Decrypt sensitive data
     * @param {string} encryptedText - Encrypted text
     * @returns {string} Decrypted text
     */
    decrypt(encryptedText) {
        if (!encryptedText) return null;

        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    /**
     * Ensure configuration file exists
     */
    async ensureConfigFile() {
        try {
            await fs.access(this.configPath);
        } catch (error) {
            // File doesn't exist, create it with default config
            await this.saveConfig(this.defaultConfig);
        }
    }

    /**
     * Load configuration from file
     * @returns {Object} Configuration object
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);

            // Decrypt API keys
            if (config.ai?.providers) {
                for (const [providerName, providerConfig] of Object.entries(config.ai.providers)) {
                    if (providerConfig.apiKey) {
                        providerConfig.apiKey = this.decrypt(providerConfig.apiKey);
                    }
                }
            }

            return config;
        } catch (error) {
            console.error('Failed to load AI config:', error);
            return this.defaultConfig;
        }
    }

    /**
     * Save configuration to file
     * @param {Object} config - Configuration object to save
     */
    async saveConfig(config) {
        try {
            // Create a copy to avoid modifying the original
            const configToSave = JSON.parse(JSON.stringify(config));

            // Encrypt API keys before saving
            if (configToSave.ai?.providers) {
                for (const [providerName, providerConfig] of Object.entries(configToSave.ai.providers)) {
                    if (providerConfig.apiKey) {
                        providerConfig.apiKey = this.encrypt(providerConfig.apiKey);
                    }
                }
            }

            await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');
            console.log('AI configuration saved successfully');
        } catch (error) {
            console.error('Failed to save AI config:', error);
            throw error;
        }
    }

    /**
     * Update provider configuration
     * @param {string} providerName - Name of the provider
     * @param {Object} providerConfig - Provider configuration
     */
    async updateProviderConfig(providerName, providerConfig) {
        const config = await this.loadConfig();

        if (!config.ai.providers[providerName]) {
            throw new Error(`Provider ${providerName} not found`);
        }

        config.ai.providers[providerName] = {
            ...config.ai.providers[providerName],
            ...providerConfig
        };

        await this.saveConfig(config);
        return config;
    }

    /**
     * Get provider configuration
     * @param {string} providerName - Name of the provider
     * @returns {Object} Provider configuration
     */
    async getProviderConfig(providerName) {
        const config = await this.loadConfig();
        return config.ai?.providers?.[providerName] || null;
    }

    /**
     * Set default provider
     * @param {string} providerName - Name of the provider to set as default
     */
    async setDefaultProvider(providerName) {
        const config = await this.loadConfig();
        config.ai.defaultProvider = providerName;
        await this.saveConfig(config);
    }

    /**
     * Get full AI configuration
     * @returns {Object} Full AI configuration
     */
    async getAIConfig() {
        const config = await this.loadConfig();
        return config.ai || this.defaultConfig.ai;
    }
}

// Export singleton instance
export const configManager = new ConfigManager();