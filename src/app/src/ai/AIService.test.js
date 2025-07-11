/**
 * AIService.test.js
 *
 * Unit tests for AI integration functionality
 */

// Mock electron API for testing
const mockElectronAPI = {
  ai: {
    initialize: jest.fn().mockResolvedValue({
      success: true,
      providers: ['openai', 'anthropic', 'local']
    }),
    getDefaultProvider: jest.fn().mockResolvedValue('openai'),
    getProviderModels: jest.fn().mockImplementation((provider) => {
      if (provider === 'openai') {
        return Promise.resolve(['gpt-3.5-turbo', 'gpt-4']);
      } else if (provider === 'anthropic') {
        return Promise.resolve(['claude-instant', 'claude-2']);
      } else if (provider === 'local') {
        return Promise.resolve(['llama2', 'mistral']);
      }
      return Promise.resolve([]);
    }),
    generateDescription: jest.fn().mockImplementation((description, provider) => {
      return Promise.resolve({
        success: true,
        result: `AI-generated description for: ${description}`,
        provider
      });
    }),
    optimizePrompt: jest.fn().mockImplementation((promptText, provider) => {
      return Promise.resolve({
        success: true,
        result: `Optimized version of: ${promptText}`,
        provider
      });
    }),
    getConfig: jest.fn().mockResolvedValue({
      systemPrompts: {
        generation: 'You are an AI assistant that helps generate high-quality prompts based on user descriptions.',
        optimization: 'You are an AI assistant that helps optimize and improve existing prompts for better clarity and effectiveness.'
      },
      defaultProvider: 'openai',
      providers: {
        openai: {
          apiKey: 'sk-mock-key',
          defaultModel: 'gpt-3.5-turbo'
        },
        anthropic: {
          apiKey: 'sk-mock-key',
          defaultModel: 'claude-instant'
        }
      }
    })
  }
};

// Mock AIService implementation
class AIService {
  constructor(electronAPI) {
    this.electronAPI = electronAPI;
    this.providers = [];
    this.defaultProvider = null;
    this.config = null;
  }

  async initialize() {
    try {
      const result = await this.electronAPI.ai.initialize();

      if (result.success) {
        this.providers = result.providers;
        this.defaultProvider = await this.electronAPI.ai.getDefaultProvider();
        this.config = await this.electronAPI.ai.getConfig();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      return false;
    }
  }

  getAvailableProviders() {
    return this.providers;
  }

  getDefaultProvider() {
    return this.defaultProvider;
  }

  async getProviderModels(providerName) {
    return await this.electronAPI.ai.getProviderModels(providerName);
  }

  async generateDescription(description, providerName = null) {
    const provider = providerName || this.defaultProvider;
    return await this.electronAPI.ai.generateDescription(description, provider);
  }

  async optimizePrompt(promptText, providerName = null) {
    const provider = providerName || this.defaultProvider;
    return await this.electronAPI.ai.optimizePrompt(promptText, provider);
  }
}

describe('AI Service', () => {
  let aiService;

  beforeEach(() => {
    // Reset mock function calls
    jest.clearAllMocks();

    // Create a new AIService instance with mock electronAPI
    aiService = new AIService(mockElectronAPI);
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const result = await aiService.initialize();

      expect(result).toBe(true);
      expect(mockElectronAPI.ai.initialize).toHaveBeenCalled();
      expect(mockElectronAPI.ai.getDefaultProvider).toHaveBeenCalled();
      expect(mockElectronAPI.ai.getConfig).toHaveBeenCalled();

      expect(aiService.providers).toEqual(['openai', 'anthropic', 'local']);
      expect(aiService.defaultProvider).toBe('openai');
      expect(aiService.config).toBeTruthy();
    });

    test('should handle initialization failure', async () => {
      // Mock initialization failure
      mockElectronAPI.ai.initialize.mockResolvedValueOnce({
        success: false,
        error: 'Failed to initialize'
      });

      const result = await aiService.initialize();

      expect(result).toBe(false);
      expect(mockElectronAPI.ai.initialize).toHaveBeenCalled();
      expect(mockElectronAPI.ai.getDefaultProvider).not.toHaveBeenCalled();
      expect(mockElectronAPI.ai.getConfig).not.toHaveBeenCalled();
    });

    test('should handle initialization error', async () => {
      // Mock initialization error
      mockElectronAPI.ai.initialize.mockRejectedValueOnce(new Error('API error'));

      const result = await aiService.initialize();

      expect(result).toBe(false);
      expect(mockElectronAPI.ai.initialize).toHaveBeenCalled();
      expect(mockElectronAPI.ai.getDefaultProvider).not.toHaveBeenCalled();
      expect(mockElectronAPI.ai.getConfig).not.toHaveBeenCalled();
    });
  });

  describe('provider management', () => {
    beforeEach(async () => {
      // Initialize the service before each test
      await aiService.initialize();
    });

    test('should get available providers', () => {
      const providers = aiService.getAvailableProviders();

      expect(providers).toEqual(['openai', 'anthropic', 'local']);
    });

    test('should get default provider', () => {
      const defaultProvider = aiService.getDefaultProvider();

      expect(defaultProvider).toBe('openai');
    });

    test('should get provider models', async () => {
      const openaiModels = await aiService.getProviderModels('openai');
      const anthropicModels = await aiService.getProviderModels('anthropic');
      const localModels = await aiService.getProviderModels('local');

      expect(openaiModels).toEqual(['gpt-3.5-turbo', 'gpt-4']);
      expect(anthropicModels).toEqual(['claude-instant', 'claude-2']);
      expect(localModels).toEqual(['llama2', 'mistral']);

      expect(mockElectronAPI.ai.getProviderModels).toHaveBeenCalledTimes(3);
      expect(mockElectronAPI.ai.getProviderModels).toHaveBeenCalledWith('openai');
      expect(mockElectronAPI.ai.getProviderModels).toHaveBeenCalledWith('anthropic');
      expect(mockElectronAPI.ai.getProviderModels).toHaveBeenCalledWith('local');
    });
  });

  describe('AI generation', () => {
    beforeEach(async () => {
      // Initialize the service before each test
      await aiService.initialize();
    });

    test('should generate description with default provider', async () => {
      const description = 'A prompt for explaining JavaScript closures';
      const result = await aiService.generateDescription(description);

      expect(result.success).toBe(true);
      expect(result.result).toBe('AI-generated description for: A prompt for explaining JavaScript closures');
      expect(result.provider).toBe('openai');

      expect(mockElectronAPI.ai.generateDescription).toHaveBeenCalledWith(description, 'openai');
    });

    test('should generate description with specified provider', async () => {
      const description = 'A prompt for explaining JavaScript closures';
      const result = await aiService.generateDescription(description, 'anthropic');

      expect(result.success).toBe(true);
      expect(result.result).toBe('AI-generated description for: A prompt for explaining JavaScript closures');
      expect(result.provider).toBe('anthropic');

      expect(mockElectronAPI.ai.generateDescription).toHaveBeenCalledWith(description, 'anthropic');
    });

    test('should handle generation error', async () => {
      // Mock generation error
      mockElectronAPI.ai.generateDescription.mockRejectedValueOnce(new Error('API error'));

      const description = 'A prompt for explaining JavaScript closures';

      await expect(aiService.generateDescription(description)).rejects.toThrow('API error');
      expect(mockElectronAPI.ai.generateDescription).toHaveBeenCalledWith(description, 'openai');
    });
  });

  describe('AI optimization', () => {
    beforeEach(async () => {
      // Initialize the service before each test
      await aiService.initialize();
    });

    test('should optimize prompt with default provider', async () => {
      const promptText = 'Explain JavaScript closures';
      const result = await aiService.optimizePrompt(promptText);

      expect(result.success).toBe(true);
      expect(result.result).toBe('Optimized version of: Explain JavaScript closures');
      expect(result.provider).toBe('openai');

      expect(mockElectronAPI.ai.optimizePrompt).toHaveBeenCalledWith(promptText, 'openai');
    });

    test('should optimize prompt with specified provider', async () => {
      const promptText = 'Explain JavaScript closures';
      const result = await aiService.optimizePrompt(promptText, 'anthropic');

      expect(result.success).toBe(true);
      expect(result.result).toBe('Optimized version of: Explain JavaScript closures');
      expect(result.provider).toBe('anthropic');

      expect(mockElectronAPI.ai.optimizePrompt).toHaveBeenCalledWith(promptText, 'anthropic');
    });

    test('should handle optimization error', async () => {
      // Mock optimization error
      mockElectronAPI.ai.optimizePrompt.mockRejectedValueOnce(new Error('API error'));

      const promptText = 'Explain JavaScript closures';

      await expect(aiService.optimizePrompt(promptText)).rejects.toThrow('API error');
      expect(mockElectronAPI.ai.optimizePrompt).toHaveBeenCalledWith(promptText, 'openai');
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      // Initialize the service before each test
      await aiService.initialize();
    });

    test('should have correct system prompts', () => {
      expect(aiService.config.systemPrompts.generation).toBe(
        'You are an AI assistant that helps generate high-quality prompts based on user descriptions.'
      );
      expect(aiService.config.systemPrompts.optimization).toBe(
        'You are an AI assistant that helps optimize and improve existing prompts for better clarity and effectiveness.'
      );
    });

    test('should have correct provider configurations', () => {
      expect(aiService.config.providers.openai.apiKey).toBe('sk-mock-key');
      expect(aiService.config.providers.openai.defaultModel).toBe('gpt-3.5-turbo');

      expect(aiService.config.providers.anthropic.apiKey).toBe('sk-mock-key');
      expect(aiService.config.providers.anthropic.defaultModel).toBe('claude-instant');
    });
  });
});