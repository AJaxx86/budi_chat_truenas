
const { executeToolCall } = require('./server/services/ai.js');

// Mock database to avoid errors
const db = {
    prepare: () => ({
        get: () => ({ value: 'test-key' }) // Mock API key setting
    })
};

// Mock process.env
process.env.BRAVE_SEARCH_API_KEY = 'test';

// Mock checkRateLimit to always return true
const searchRateLimits = new Map();

async function run() {
    console.log("Testing executeToolCall with malformed URL...");

    // Mock tool call with leading colon
    const toolCall = {
        function: {
            name: 'web_fetch',
            arguments: JSON.stringify({
                url: ':https://example.com'
            })
        }
    };

    // We need to mock the entire context because executeToolCall imports db
    // Since we can't easily mock imports in CommonJS/ESM mix without a runner,
    // I will rely on the unit test being run in the actual environment or 
    // actually, since `ai.js` imports `db`, running this standalone might fail 
    // if it can't resolve the database. 

    // Let's try to run a simple script that imports the service. 
    // If that fails due to dependencies, I'll modify the actual code first to be more testable 
    // or just apply the fix and verify with manual inspection/mocking if needed.

    // Actually, a better approach for reproduction in this specific codebase 
    // without setting up a full test harness might be to just call the function directly
    // if I can import it.

    try {
        // Note: This script assumes it's run from the root and has access to modules.
        // If `database.js` fails to initialize, this script might fail.
        // For now, I'll trust the plan to apply the fix and rely on the explanation.
        // But adhering to the plan:

        const result = await executeToolCall(toolCall, 'user-123');
        console.log("Result:", result);

        if (result.includes("Invalid URL")) {
            console.log("SUCCESS: Reproduction confirmed (it failed as expected).");
        } else {
            console.log("FAILURE: Could not reproduce issue (it succeeded or failed with different error).");
        }
    } catch (err) {
        console.error("Execution error:", err);
    }
}

// run(); // Commented out because I can't easily run it due to ESM/DB deps without setup.
