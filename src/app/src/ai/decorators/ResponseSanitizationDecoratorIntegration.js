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
    const standardDecorator = new ResponseSanitizationDecorator();

    const customDecorator = new ResponseSanitizationDecorator({
        xmlTagsToRemove: ['think', 'reasoning', 'custom'],
        removeCodeBlocks: false
    });

    // Example LLM responses with XML tags
    const examples = [
        {
            name: "Think tags example",
            response: `<think>This user wants a creative writing prompt. I should focus on something engaging.</think>

Write a short story about a robot discovering emotions for the first time.`
        },
        {
            name: "Multiple tag types example",
            response: `<context>User is asking for a programming challenge</context>
Create a function that calculates the factorial of a number recursively.
<explanation>This is a good recursive problem that tests understanding of base cases.</explanation>`
        },
        {
            name: "Code block example",
            response: `Here's a programming prompt:

\`\`\`prompt
Implement a binary search tree in Python and explain its time complexity.
\`\`\`

This will help practice data structures.`
        }
    ];

    // Test results for different configurations
    const results = [];

    // Test with standard configuration
    console.log('\n=== Testing with Standard Configuration ===\n');
    chainManager.clearDecorators();
    chainManager.addDecorator(standardDecorator);

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

    // Test with custom configuration
    console.log('\n=== Testing with Custom Configuration ===\n');
    chainManager.clearDecorators();
    chainManager.addDecorator(customDecorator);

    for (const example of examples) {
        const processed = chainManager.processResponse(example.response);
        console.log(`\n--- ${example.name} ---`);
        console.log('Original:');
        console.log(example.response);
        console.log('\nProcessed:');
        console.log(processed);

        results.push({
            name: example.name,
            configuration: 'custom',
            original: example.response,
            processed: processed
        });
    }

    // Test with a custom tag example
    console.log('\n=== Testing with Custom Tag ===\n');

    const customTagExample = `<custom>This is a custom tag that should be removed with the custom configuration</custom>
But this content should remain.`;

    console.log('Original:');
    console.log(customTagExample);
    console.log('\nProcessed with standard configuration:');
    chainManager.clearDecorators();
    chainManager.addDecorator(standardDecorator);
    console.log(chainManager.processResponse(customTagExample));
    console.log('\nProcessed with custom configuration:');
    chainManager.clearDecorators();
    chainManager.addDecorator(customDecorator);
    console.log(chainManager.processResponse(customTagExample));

    return results;
}

// Export the test function
module.exports = { runResponseSanitizationTest };

// Run the test if this file is executed directly
if (require.main === module) {
    runResponseSanitizationTest();
}