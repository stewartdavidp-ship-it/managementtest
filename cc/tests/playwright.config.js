const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './',
    testMatch: '*.spec.js',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: 'http://localhost:3333',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry'
    },
    webServer: {
        command: 'node serve.js',
        port: 3333,
        cwd: __dirname,
        reuseExistingServer: true,
        timeout: 10000
    },
    reporter: [
        ['list'],
        ['json', { outputFile: 'results/latest.json' }]
    ]
});
