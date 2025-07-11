const { BaseDecorator } = require('./BaseDecorator');

/**
 * @class ResponseSanitizationDecorator
 * @extends BaseDecorator
 * @description Decorator to sanitize LLM responses by removing XML tags and explanatory text.
 * Primarily focuses on removing <think></think> tags and other XML-style tags that
 * contain internal reasoning or explanations.
 */
class ResponseSanitizationDecorator extends BaseDecorator {
  /**
   * @constructor
   * @param {Object} config - Configuration options for the sanitizer
   */
  constructor(config = {}) {
    super();
    this.name = 'ResponseSanitizationDecorator';
    this.description = 'Removes XML tags and explanatory text from LLM responses';

    this.config = {
      // Whether to remove XML tags like <think></think>
      removeXmlTags: config.removeXmlTags !== false,
      // List of XML tag names to remove (without brackets)
      xmlTagsToRemove: config.xmlTagsToRemove || ['think', 'reasoning', 'explanation', 'context'],
      // Whether to also remove markdown code blocks
      removeCodeBlocks: config.removeCodeBlocks !== false
    };
  }

  /**
   * Process the LLM response to remove XML tags and explanatory text
   * @param {string} text - The raw LLM response text
   * @returns {string} - The sanitized text
   */
  process(text) {
    if (!text) return text;

    let sanitizedText = text;

    // Remove XML tags and their content
    if (this.config.removeXmlTags) {
      sanitizedText = this.removeXmlTagsAndContent(sanitizedText);
    }

    // Remove markdown code block markers if configured
    if (this.config.removeCodeBlocks) {
      sanitizedText = this.removeMarkdownCodeBlocks(sanitizedText);
    }

    return sanitizedText.trim();
  }

  /**
   * Remove XML tags and their content from the text
   * @param {string} text - The text to process
   * @returns {string} - Text with XML tags and their content removed
   * @private
   */
  removeXmlTagsAndContent(text) {
    let result = text;

    // Process each tag type in the configured list
    for (const tagName of this.config.xmlTagsToRemove) {
      // Create a regex that matches the tag and all content between opening and closing tags
      // This handles nested tags of the same type correctly
      const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
      result = result.replace(regex, '');
    }

    // Also remove any remaining XML-style tags (without removing their content)
    result = result.replace(/<[^>]+>/g, '');

    return result;
  }

  /**
   * Remove markdown code block markers
   * @param {string} text - The text to process
   * @returns {string} - Text with code block markers removed
   * @private
   */
  removeMarkdownCodeBlocks(text) {
    // Replace code block markers but keep the content
    return text.replace(/```(?:prompt|[a-z]+)?\s*\n?/g, '')
               .replace(/```\s*$/g, '');
  }
}

module.exports = { ResponseSanitizationDecorator };