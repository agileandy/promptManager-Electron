const { ResponseSanitizationDecorator } = require('./ResponseSanitizationDecorator');

/**
 * Test suite for the ResponseSanitizationDecorator
 */
describe('ResponseSanitizationDecorator', () => {
  let decorator;

  beforeEach(() => {
    // Create a new decorator instance with default settings before each test
    decorator = new ResponseSanitizationDecorator();
  });

  test('should remove leading explanatory text with standard markers', () => {
    const input = "Here's a thinking process that could lead to the prompt:\n\n" +
      "First, I need to consider what makes a good prompt for creative writing.\n" +
      "Then, I should structure it with clear instructions.\n\n" +
      "Here's the prompt:\n\n" +
      "Write a short story about a robot discovering emotions for the first time.";

    const expected = 'Write a short story about a robot discovering emotions for the first time.';

    expect(decorator.process(input)).toBe(expected);
  });

  test('should handle text with code block markers', () => {
    const input = "I will now generate the prompt you requested.\n\n" +
      "```prompt\n" +
      "Create a function that calculates the factorial of a number recursively.\n" +
      "```\n\n" +
      "This prompt will help you practice recursive functions.";

    const expected = 'Create a function that calculates the factorial of a number recursively.';

    expect(decorator.process(input)).toBe(expected);
  });

  test('should handle text with trailing explanations', () => {
    const input = "Design a database schema for a social media application.\n\n" +
      "This prompt is designed to test your database design skills.";

    const expected = 'Design a database schema for a social media application.';

    expect(decorator.process(input)).toBe(expected);
  });

  test('should not modify text without explanatory markers', () => {
    const input = 'Write a function to reverse a string in JavaScript.';

    expect(decorator.process(input)).toBe(input);
  });

  test('should handle empty or null input', () => {
    expect(decorator.process('')).toBe('');
    expect(decorator.process(null)).toBe(null);
  });

  test('should use aggressive sanitization when configured', () => {
    const aggressiveDecorator = new ResponseSanitizationDecorator({
      sanitizationLevel: 'aggressive'
    });

    const input = "First, I'll create a prompt about data structures.\n\n" +
      "Prompt: Implement a binary search tree in Python and explain its time complexity.\n\n" +
      "This will help you understand tree data structures better.";

    const expected = 'Implement a binary search tree in Python and explain its time complexity.';

    expect(aggressiveDecorator.process(input)).toBe(expected);
  });

  test('should respect custom patterns', () => {
    const customDecorator = new ResponseSanitizationDecorator({
      customPatterns: ['Starting with a prompt about']
    });

    const input = "Starting with a prompt about algorithms:\n\n" +
      "Implement quicksort and explain why it's typically faster than merge sort.";

    const expected = "Implement quicksort and explain why it's typically faster than merge sort.";

    expect(customDecorator.process(input)).toBe(expected);
  });

  test('should keep explanations when configured not to remove them', () => {
    const preservingDecorator = new ResponseSanitizationDecorator({
      removeLeadingExplanations: false,
      removeTrailingExplanations: false
    });

    const input = "Here's a thinking process:\n\n" +
      "A good prompt should be clear and specific.\n\n" +
      "Prompt: Write a function that validates email addresses using regex.\n\n" +
      "This prompt will test your regex knowledge.";

    // Should preserve the explanatory text
    expect(preservingDecorator.process(input)).toBe(input);
  });
});