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

  test('should remove <think> tags and their content', () => {
    const input = "Here's a prompt for you:\n\n" +
      "<think>This user wants a creative writing prompt. I should focus on something engaging.</think>\n\n" +
      "Write a short story about a robot discovering emotions for the first time.";

    const expected = "Here's a prompt for you:\n\n\n\nWrite a short story about a robot discovering emotions for the first time.";

    expect(decorator.process(input)).toBe(expected);
  });

  test('should remove multiple XML tags of different types', () => {
    const input = "<context>User is asking for a programming challenge</context>\n" +
      "Create a function that calculates the factorial of a number recursively.\n" +
      "<explanation>This is a good recursive problem that tests understanding of base cases.</explanation>";

    const expected = "Create a function that calculates the factorial of a number recursively.";

    expect(decorator.process(input)).toBe(expected);
  });

  test('should handle nested XML tags', () => {
    const input = "<think>I should create a database design prompt <think>focusing on normalization</think></think>\n" +
      "Design a database schema for a social media application.";

    const expected = "Design a database schema for a social media application.";

    expect(decorator.process(input)).toBe(expected);
  });

  test('should remove markdown code block markers when configured', () => {
    const input = "```prompt\n" +
      "Write a function to reverse a string in JavaScript.\n" +
      "```";

    const expected = "Write a function to reverse a string in JavaScript.";

    expect(decorator.process(input)).toBe(expected);
  });

  test('should not remove code block markers when configured not to', () => {
    const noCodeBlockRemoval = new ResponseSanitizationDecorator({
      removeCodeBlocks: false
    });

    const input = "```prompt\n" +
      "Write a function to reverse a string in JavaScript.\n" +
      "```";

    expect(noCodeBlockRemoval.process(input)).toBe(input);
  });

  test('should handle empty or null input', () => {
    expect(decorator.process('')).toBe('');
    expect(decorator.process(null)).toBe(null);
  });

  test('should respect custom XML tag list', () => {
    const customDecorator = new ResponseSanitizationDecorator({
      xmlTagsToRemove: ['custom', 'tags']
    });

    const input = "<custom>This should be removed</custom>\n" +
      "<tags>This should also be removed</tags>\n" +
      "<think>But this should remain</think>\n" +
      "Keep this content.";

    const expected = "But this should remain\nKeep this content.";

    expect(customDecorator.process(input)).toBe(expected);
  });

  test('should not remove XML tags when configured not to', () => {
    const noXmlRemoval = new ResponseSanitizationDecorator({
      removeXmlTags: false
    });

    const input = "<think>This should remain</think>\n" +
      "Keep this content.";

    expect(noXmlRemoval.process(input)).toBe(input);
  });
});