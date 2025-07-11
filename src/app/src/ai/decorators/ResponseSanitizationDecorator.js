const { BaseDecorator } = require('./BaseDecorator');

/**
 * @class ResponseSanitizationDecorator
 * @extends BaseDecorator
 * @description Decorator to remove explanatory text from LLM responses.
 * This decorator identifies and removes common patterns of explanatory text
 * that LLMs often include before providing the actual prompt content.
 */
class ResponseSanitizationDecorator extends BaseDecorator {
  /**
   * @constructor
   * @param {Object} config - Configuration options for the sanitizer
   */
  constructor(config = {}) {
    super();
    this.name = 'ResponseSanitizationDecorator';
    this.description = 'Removes explanatory text from LLM responses';

    this.config = {
      // Default sanitization level - higher means more aggressive removal
      sanitizationLevel: config.sanitizationLevel || 'standard',
      // Whether to remove all text before the actual prompt content
      removeLeadingExplanations: config.removeLeadingExplanations !== false,
      // Whether to remove all text after the prompt content
      removeTrailingExplanations: config.removeTrailingExplanations !== false,
      // Custom patterns to identify as explanatory text (in addition to defaults)
      customPatterns: config.customPatterns || []
    };

    // Initialize pattern collections based on sanitization level
    this.initializePatterns();
  }

  /**
   * Initialize pattern collections based on the configured sanitization level
   * @private
   */
  initializePatterns() {
    // Common markers that indicate the start of explanatory text
    this.startMarkers = [
      "Here's a thinking process",
      "Here is a thinking process",
      "Here's a possible thought process",
      "I will now generate the prompt",
      "I will now create the prompt",
      "I will now write the prompt",
      "Let me generate a prompt",
      "Let me create a prompt",
      "Let me write a prompt",
      "The following is a prompt",
      "Below is the prompt",
      "Here's the prompt"
    ];

    // Common markers that indicate the end of explanatory text
    this.endMarkers = [
      "Here's the prompt:",
      "The prompt is:",
      "Prompt:",
      "Final prompt:",
      "Generated prompt:",
      "Here is the prompt:",
      "---",
      "```"
    ];

    // Add custom patterns if provided
    if (this.config.customPatterns.length > 0) {
      this.startMarkers = [...this.startMarkers, ...this.config.customPatterns];
    }

    // Adjust patterns based on sanitization level
    if (this.config.sanitizationLevel === 'aggressive') {
      // Add more aggressive patterns for higher sanitization level
      this.startMarkers.push(
        "I'll create",
        "I'll generate",
        "I'll write",
        "I'll provide",
        "I'll craft",
        "I'll design",
        "First,",
        "To start,"
      );
    }
  }

  /**
   * Process the LLM response to remove explanatory text
   * @param {string} text - The raw LLM response text
   * @returns {string} - The sanitized text with explanations removed
   */
  process(text) {
    if (!text) return text;

    let sanitizedText = text;

    // Handle leading explanations
    if (this.config.removeLeadingExplanations) {
      sanitizedText = this.removeLeadingExplanations(sanitizedText);
    }

    // Handle trailing explanations
    if (this.config.removeTrailingExplanations) {
      sanitizedText = this.removeTrailingExplanations(sanitizedText);
    }

    // Remove any remaining explanation markers
    sanitizedText = this.cleanupRemainingMarkers(sanitizedText);

    return sanitizedText.trim();
  }

  /**
   * Remove explanatory text that appears before the actual prompt content
   * @param {string} text - The text to process
   * @returns {string} - Text with leading explanations removed
   * @private
   */
  removeLeadingExplanations(text) {
    let result = text;

    // Check for each start marker and find the earliest end marker after it
    for (const startMarker of this.startMarkers) {
      const startIndex = result.indexOf(startMarker);
      if (startIndex !== -1) {
        // Found a start marker, now look for the end marker
        for (const endMarker of this.endMarkers) {
          const endIndex = result.indexOf(endMarker, startIndex + startMarker.length);
          if (endIndex !== -1) {
            // Found an end marker, extract everything after it
            result = result.substring(endIndex + endMarker.length).trim();
            break;
          }
        }
      }
    }

    // If we're using aggressive sanitization, try to detect the actual prompt content
    // by looking for common prompt patterns even without explicit markers
    if (this.config.sanitizationLevel === 'aggressive') {
      // Look for patterns like "```prompt" or "```" followed by content
      const codeBlockMatch = result.match(/```(?:prompt)?\s*\n([\s\S]+?)```/);
      if (codeBlockMatch) {
        result = codeBlockMatch[1].trim();
      }

      // Look for patterns like "Prompt: " followed by content
      const promptLabelMatch = result.match(/(?:prompt|final prompt|generated prompt):\s*\n?([\s\S]+)/i);
      if (promptLabelMatch) {
        result = promptLabelMatch[1].trim();
      }
    }

    return result;
  }

  /**
   * Remove explanatory text that appears after the actual prompt content
   * @param {string} text - The text to process
   * @returns {string} - Text with trailing explanations removed
   * @private
   */
  removeTrailingExplanations(text) {
    let result = text;

    // Common patterns that indicate the end of the actual prompt content
    const trailingPatterns = [
      "This prompt is designed to",
      "This prompt will help",
      "I hope this prompt",
      "Let me know if",
      "Would you like me to",
      "Is there anything else",
      "Do you want me to",
      "Feel free to",
      "You can use this prompt"
    ];

    // Check for each trailing pattern and truncate the text at that point
    for (const pattern of trailingPatterns) {
      const index = result.indexOf(pattern);
      if (index !== -1) {
        result = result.substring(0, index).trim();
      }
    }

    return result;
  }

  /**
   * Clean up any remaining explanation markers that might be in the text
   * @param {string} text - The text to clean
   * @returns {string} - Cleaned text
   * @private
   */
  cleanupRemainingMarkers(text) {
    let result = text;

    // Remove any remaining markdown code block markers
    result = result.replace(/```prompt\s*\n?/g, '');
    result = result.replace(/```\s*$/g, '');

    // Remove any "Prompt:" prefixes at the beginning
    result = result.replace(/^(?:prompt|final prompt|generated prompt):\s*\n?/i, '');

    // Remove the word "prompt" at the beginning of the text (after code block processing)
    result = result.replace(/^prompt\s*\n?/i, '');

    return result;
  }
}

module.exports = { ResponseSanitizationDecorator };