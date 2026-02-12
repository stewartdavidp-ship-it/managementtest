const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.CC_TEST_PORT || 3333;
const ROOT = path.resolve(__dirname, '../..');

// Read the original index.html
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Read mock and fixture files
const mocks = fs.readFileSync(path.join(__dirname, 'mocks.js'), 'utf8');
const fixtureCompletions = fs.readFileSync(path.join(__dirname, 'fixtures/completion-files.js'), 'utf8');
const fixtureConcepts = fs.readFileSync(path.join(__dirname, 'fixtures/odrc-concepts.js'), 'utf8');
const fixtureOrphans = fs.readFileSync(path.join(__dirname, 'fixtures/orphan-commits.js'), 'utf8');

// Build the mock injection script
const mockScript = `
<script>
// === CC TEST MOCKS ===
window.__CC_TEST_MODE = true;
${mocks}
${fixtureCompletions}
${fixtureConcepts}
${fixtureOrphans}

// Pre-seed localStorage with mock tokens so the app doesn't prompt for setup
MockLocalStorage._seed({
    'cc_github_token': 'mock-github-token',
    'cc_anthropic_api_key': 'mock-anthropic-key',
    'cc_api_key': 'mock-cc-api-key'
});

// Override the real localStorage with our mock
Object.defineProperty(window, 'localStorage', {
    value: MockLocalStorage,
    writable: true,
    configurable: true
});

// Override firebase global so direct firebase.database() / firebase.auth() calls use mocks
// This handles service objects that call firebase.database() directly instead of using firebaseDb
if (typeof firebase !== 'undefined') {
    const origDatabase = firebase.database ? firebase.database.bind(firebase) : null;
    const origAuth = firebase.auth ? firebase.auth.bind(firebase) : null;

    firebase.database = function() { return MockFirebaseDb; };
    firebase.auth = function() { return MockFirebaseAuth; };

    // Also ensure firebase.apps reports as initialized to prevent initializeApp errors
    if (!firebase.apps || firebase.apps.length === 0) {
        // Create a minimal mock app so firebase.apps.length > 0
        try { firebase.initializeApp({ apiKey: 'mock', authDomain: 'mock', databaseURL: 'https://mock.firebaseio.com', projectId: 'mock' }); } catch(e) {}
    }
}

console.log('[CC-TEST] Mock services injected');
</script>
`;

// Insert mock script before the babel script block
html = html.replace(
    '<script type="text/babel">',
    `${mockScript}\n<script type="text/babel">`
);

// MIME type mapping
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    } else {
        // Serve static files
        const filePath = path.join(ROOT, url.pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(fs.readFileSync(filePath));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    }
});

server.listen(PORT, () => {
    console.log(`CC Test Server running at http://localhost:${PORT}`);
});
