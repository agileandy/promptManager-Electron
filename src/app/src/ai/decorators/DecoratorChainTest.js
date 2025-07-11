/**
 * Decorator Chain Test
 * Demonstrates how to use the DecoratorChainManager
 */
const { BaseDecorator, DecoratorChainManager } = require('./index');

// Example decorator that removes XML tags
class XMLTagRemoverDecorator extends BaseDecorator {
    constructor() {
        super();
        this.name = 'XMLTagRemover';
        this.description = 'Removes XML tags from LLM responses';
    }

    process(response) {
        if (!response) return response;

        // Simple regex to remove XML tags
        // Note: This is a simplified example. A real implementation would be more robust.
        return response.replace(/<[^>]*>/g, '');
    }
}

// Example decorator that trims explanations
class ExplanationTrimmerDecorator extends BaseDecorator {
    constructor() {
        super();
        this.name = 'ExplanationTrimmer';
        this.description = 'Removes explanations from LLM responses';
    }

    process(response) {
        if (!response) return response;

        // Simple example - in a real implementation, this would use more sophisticated
        // NLP techniques to identify and remove explanations
        const explanationMarkers = [
            'Here\'s why:',
            'Let me explain:',
            'To explain:',
            'The reason is:'
        ];

        let processedResponse = response;
        for (const marker of explanationMarkers) {
            const index = processedResponse.indexOf(marker);
            if (index !== -1) {
                processedResponse = processedResponse.substring(0, index).trim();
            }
        }

        return processedResponse;
    }
}

// Function to run the test
function runDecoratorChainTest() {
    // Create a new chain manager
    const chainManager = new DecoratorChainManager();

    // Add decorators to the chain
    chainManager.addDecorator(new XMLTagRemoverDecorator());
    chainManager.addDecorator(new ExplanationTrimmerDecorator());

    // Example LLM response with XML tags and explanations
    const exampleResponse = `
        <think>This user wants a prompt about cats.</think>

        Create a detailed image of a cat in a garden.

        Here's why: Cats in natural settings like gardens create visually appealing images with good contrast between the animal and background.
    `;

    // Process the response through the chain
    const processedResponse = chainManager.processResponse(exampleResponse);

    console.log('Original Response:');
    console.log(exampleResponse);
    console.log('\nProcessed Response:');
    console.log(processedResponse);

    return {
        original: exampleResponse,
        processed: processedResponse
    };
}

// Export the test function
module.exports = { runDecoratorChainTest };

// Run the test if this file is executed directly
if (require.main === module) {
    runDecoratorChainTest();
}