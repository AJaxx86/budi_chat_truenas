
function extractUrl(url) {
    let cleanUrl = url ? url.trim() : '';
    const urlMatch = cleanUrl.match(/(https?:\/\/[^\s]+)/);

    if (urlMatch) {
        cleanUrl = urlMatch[1];
    }
    return cleanUrl;
}

const testCases = [
    { input: 'https://example.com', expected: 'https://example.com' },
    { input: ':https://example.com', expected: 'https://example.com' },
    { input: 'URL: https://example.com', expected: 'https://example.com' },
    { input: '  https://example.com  ', expected: 'https://example.com' },
    { input: 'invalid', expected: 'invalid' } // Should return original trimmed input if no match
];

console.log('Running regex verification...');
let failed = false;

testCases.forEach(({ input, expected }, index) => {
    const result = extractUrl(input);
    if (result === expected) {
        console.log(`Test Case ${index + 1}: PASS ("${input}" -> "${result}")`);
    } else {
        console.log(`Test Case ${index + 1}: FAIL ("${input}" -> "${result}", expected "${expected}")`);
        failed = true;
    }
});

if (failed) {
    console.log('Verification FAILED');
    process.exit(1);
} else {
    console.log('Verification PASSED');
}
