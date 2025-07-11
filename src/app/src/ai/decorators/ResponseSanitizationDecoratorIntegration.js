/**
 * Response Sanitization Decorator Integration Test
 * Demonstrates how to use the ResponseSanitizationDecorator with the DecoratorChainManager
 */
const { BaseDecorator, DecoratorChainManager, ResponseSanitizationDecorator } = require('./index');

/**
 * Run a test to demonstrate the ResponseSanitizationDecorator functionality
 * @returns {Object} Test results with original and processed responses
 */
function runResponseSanitizationTest() {
    // Create a new chain manager
    const chainManager = new DecoratorChainManager();

    // Create sanitization decorators with different configurations
    const standardSanitizer = new ResponseSanitizationDecorator({
        sanitizationLevel: 'standard'
    });

    const aggressiveSanitizer = new ResponseSanitizationDecorator({
        sanitizationLevel: 'aggressive'
    });

    // Example LLM responses with explanatory text
    const examples = [
        {
            name: "Standard explanation pattern",
            response: `Here's a thinking process that could lead to the prompt:

First, I need to consider what makes a good prompt for creative writing.
Then, I should structure it with clear instructions.

Here's the prompt:

Write a short story about a robot discovering emotions for the first time.`
        },
        {
            name: "Code block pattern",
            response: `I will now generate the prompt you requested.

\`\`\`prompt
Create a function that calculates the factorial of a number recursively.
\`\`\`

This prompt will help you practice recursive functions.`
        },
        {
            name: "Trailing explanation pattern",
            response: `Design a database schema for a social media application.

This prompt is designed to test your database design skills.`
        }
    ];

    // Test results for different configurations
    const results = [];

    // Test with standard sanitization
    console.log('\n=== Testing with Standard Sanitization ===\n');
    chainManager.clearDecorators();
    chainManager.addDecorator(standardSanitizer);

    for (const example of examples) {
        const processed = chainManager.processResponse(example.response);
        console.log(`\n--- ${example.name} ---`);
        console.log('Original:');
        console.log(example.response);
        console.log('\nProcessed:');
        console.log(processed);

        results.push({
            name: example.name,
            configuration: 'standard',
            original: example.response,
            processed: processed
        });
    }

    // Test with aggressive sanitization
    console.log('\n=== Testing with Aggressive Sanitization ===\n');
    chainManager.clearDecorators();
    chainManager.addDecorator(aggressiveSanitizer);

    for (const example of examples) {
        const processed = chainManager.processResponse(example.response);
        console.log(`\n--- ${example.name} ---`);
        console.log('Original:');
        console.log(example.response);
        console.log('\nProcessed:');
        console.log(processed);

        results.push({
            name: example.name,
            configuration: 'aggressive',
            original: example.response,
            processed: processed
        });
    }

    // Test with custom configuration
    console.log('\n=== Testing with Custom Configuration ===\n');
    const customSanitizer = new ResponseSanitizationDecorator({
        sanitizationLevel: 'standard',
        customPatterns: ['Design a database schema'],
        removeTrailingExplanations: false
    });

    chainManager.clearDecorators();
    chainManager.addDecorator(customSanitizer);

    const customExample = examples[2]; // Using the trailing explanation example
    const customProcessed = chainManager.processResponse(customExample.response);

    console.log(`\n--- Custom Configuration Test ---`);
    console.log('Original:');
    console.log(customExample.response);
    console.log('\nProcessed with custom patterns:');
    console.log(customProcessed);

    results.push({
        name: 'Custom Configuration Test',
        configuration: 'custom',
        original: customExample.response,
        processed: customProcessed
    });

    return results;
}

// Export the test function
module.exports = { runResponseSanitizationTest };

// Run the test if this file is executed directly
if (require.main === module) {
    runResponseSanitizationTest();
}