// CC Test Infrastructure — Mock Service Layer
// Replaces Firebase, GitHub API, Claude API, and localStorage with in-memory implementations

// ============================================================
// Mock Firebase Database
// ============================================================
const MockFirebaseDb = {
    _store: {},
    _listeners: [],

    ref(path) {
        const self = this;
        return {
            _path: path,

            on(event, callback) {
                const listener = { path, event, callback };
                self._listeners.push(listener);
                const data = self._getPath(path);
                callback({ val: () => data, exists: () => data !== undefined && data !== null });
                return callback;
            },

            off(event, callback) {
                self._listeners = self._listeners.filter(l => !(l.path === path && l.callback === callback));
            },

            once(event) {
                const data = self._getPath(path);
                return Promise.resolve({ val: () => data, exists: () => data !== undefined && data !== null });
            },

            push() {
                const key = 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                const childPath = path ? `${path}/${key}` : key;
                return {
                    key,
                    set(value) {
                        self._setPath(childPath, value);
                        self._notifyListeners(path);
                        return Promise.resolve();
                    }
                };
            },

            child(key) {
                return self.ref(path ? `${path}/${key}` : key);
            },

            set(value) {
                self._setPath(path, value);
                self._notifyListeners(path);
                return Promise.resolve();
            },

            update(value) {
                const current = self._getPath(path) || {};
                self._setPath(path, { ...current, ...value });
                self._notifyListeners(path);
                return Promise.resolve();
            },

            remove() {
                self._deletePath(path);
                self._notifyListeners(path);
                return Promise.resolve();
            },

            orderByChild(key) { return this; },
            limitToLast(n) { return this; }
        };
    },

    _getPath(path) {
        if (!path) return this._store;
        const segments = path.split('/').filter(Boolean);
        let current = this._store;
        for (const seg of segments) {
            if (current === undefined || current === null || typeof current !== 'object') return undefined;
            current = current[seg];
        }
        return current;
    },

    _setPath(path, value) {
        if (!path) { this._store = value; return; }
        const segments = path.split('/').filter(Boolean);
        let current = this._store;
        for (let i = 0; i < segments.length - 1; i++) {
            if (current[segments[i]] === undefined || current[segments[i]] === null || typeof current[segments[i]] !== 'object') {
                current[segments[i]] = {};
            }
            current = current[segments[i]];
        }
        current[segments[segments.length - 1]] = value;
    },

    _deletePath(path) {
        if (!path) { this._store = {}; return; }
        const segments = path.split('/').filter(Boolean);
        let current = this._store;
        for (let i = 0; i < segments.length - 1; i++) {
            if (!current[segments[i]]) return;
            current = current[segments[i]];
        }
        delete current[segments[segments.length - 1]];
    },

    _notifyListeners(changedPath) {
        for (const listener of this._listeners) {
            // Notify if the listener path is a prefix of the changed path or vice versa
            if (changedPath.startsWith(listener.path) || listener.path.startsWith(changedPath)) {
                const data = this._getPath(listener.path);
                try {
                    listener.callback({ val: () => data, exists: () => data !== undefined && data !== null });
                } catch (e) {
                    console.warn('[MockFirebaseDb] Listener error:', e);
                }
            }
        }
    },

    _reset() {
        this._store = {};
        this._listeners = [];
    },

    _seed(data) {
        this._store = JSON.parse(JSON.stringify(data));
        // Notify ALL listeners so React state updates when data is seeded mid-test
        for (const listener of this._listeners) {
            const listenerData = this._getPath(listener.path);
            try {
                listener.callback({ val: () => listenerData, exists: () => listenerData !== undefined && listenerData !== null });
            } catch (e) {
                console.warn('[MockFirebaseDb] Seed listener error:', e);
            }
        }
    }
};

// ============================================================
// Mock Firebase Auth
// ============================================================
const MockFirebaseAuth = {
    _currentUser: { uid: 'test-user-123', email: 'test@example.com', displayName: 'Test User' },
    _listeners: [],

    onAuthStateChanged(callback) {
        this._listeners.push(callback);
        // Fire immediately with current user
        setTimeout(() => callback(this._currentUser), 0);
        return () => { this._listeners = this._listeners.filter(l => l !== callback); };
    },

    get currentUser() { return this._currentUser; },

    signOut() {
        this._currentUser = null;
        this._listeners.forEach(cb => cb(null));
        return Promise.resolve();
    },

    _reset() {
        this._currentUser = { uid: 'test-user-123', email: 'test@example.com', displayName: 'Test User' };
        this._listeners = [];
    }
};

// ============================================================
// Mock GitHub API
// ============================================================
const MockGitHubAPI = {
    _fixtures: {},
    _token: 'mock-github-token',

    loadFixtures(fixtures) { this._fixtures = { ...this._fixtures, ...fixtures }; },

    // Core methods used by the app
    async listRepos() { return []; },

    async listRepoContents(repo, path) {
        const prefix = `${repo}/${path || ''}/`.replace(/\/+/g, '/').replace(/\/$/, '/');
        return Object.keys(this._fixtures)
            .filter(k => {
                const normalized = k.replace(/\/+/g, '/');
                return normalized.startsWith(prefix) && !normalized.slice(prefix.length).includes('/');
            })
            .map(k => ({
                name: k.split('/').pop(),
                path: k.replace(`${repo}/`, ''),
                type: 'file',
                sha: this._fixtures[k]?.sha || 'mock-sha'
            }));
    },

    async getFileContent(repo, path) {
        const key = `${repo}/${path}`;
        return this._fixtures[key] || null;
    },

    async getFile(repo, path) {
        const key = `${repo}/${path}`;
        return this._fixtures[key] || null;
    },

    async getFileContentAtCommit(repo, path, commitSha) {
        return this.getFileContent(repo, path);
    },

    async getFileAtCommit(repo, path, commitSha) {
        return this.getFile(repo, path);
    },

    async getBlobContent(repo, sha) {
        return null;
    },

    cleanBase64(content) { return content; },
    decodeContent(content) { return content; },

    async listRecentCommits(repo, perPage) {
        return this._fixtures[`${repo}/_commits`] || [];
    },

    async getCommitDetail(repo, sha) {
        return this._fixtures[`${repo}/_commit_${sha}`] || null;
    },

    async createOrUpdateFile(repo, path, content, message, sha, branch) {
        return { content: { sha: 'mock-new-sha' } };
    },

    async deleteFile(repo, path, message, sha) {
        return {};
    },

    async batchCommit(repo, files, message) {
        return { sha: 'mock-batch-sha' };
    },

    async createTag(repo, tagName, sha, message) {
        return {};
    },

    async enablePages(repo) {
        return {};
    },

    async checkPushAccess(repo) {
        return true;
    },

    async fileExists(repo, path) {
        const key = `${repo}/${path}`;
        return !!this._fixtures[key];
    },

    async repoExists(repo) {
        return true;
    },

    async createRepo(name, options) {
        return { full_name: `mock-owner/${name}` };
    },

    async getWorkflowRuns(repo, options) {
        return { workflow_runs: [] };
    },

    async getWorkflowRun(repo, runId) {
        return { id: runId, status: 'completed', conclusion: 'success' };
    },

    async getWorkflowRunLogsUrl(repo, runId) {
        return 'https://mock-logs-url.example.com';
    },

    async waitForWorkflowRun(repo, runId, maxWaitMs, onStatus) {
        return { id: runId, status: 'completed', conclusion: 'success' };
    },

    async findRecentWorkflowRun(repo, afterTime, maxWaitMs) {
        return null;
    },

    async request(endpoint, options) {
        console.warn(`[MockGitHubAPI] Unmocked request: ${endpoint}`);
        return {};
    },

    getRateLimit() {
        return { remaining: 4999, limit: 5000, resetTime: Date.now() + 3600000 };
    },

    _reset() { this._fixtures = {}; }
};

// ============================================================
// Mock Claude API Service
// ============================================================
const MockClaudeAPIService = {
    _responses: {},
    _callLog: [],

    setResponse(keyword, response) {
        this._responses[keyword] = response;
    },

    async call({ model, system, userMessage, maxTokens }) {
        this._callLog.push({ model, system: system?.substring(0, 100), userMessage: userMessage?.substring(0, 100) });

        for (const [keyword, response] of Object.entries(this._responses)) {
            if (system?.includes(keyword) || userMessage?.includes(keyword)) {
                return response;
            }
        }

        return '# Review Prompt\n\nPlease review the attached completion file for correctness and alignment.';
    },

    isConfigured() { return true; },
    getApiKey() { return 'mock-api-key'; },

    _reset() { this._responses = {}; this._callLog = []; }
};

// ============================================================
// Mock localStorage
// ============================================================
const MockLocalStorage = {
    _store: {},
    getItem(key) { return this._store[key] || null; },
    setItem(key, value) { this._store[key] = String(value); },
    removeItem(key) { delete this._store[key]; },
    clear() { this._store = {}; },
    get length() { return Object.keys(this._store).length; },
    key(index) { return Object.keys(this._store)[index] || null; },
    _seed(data) { this._store = { ...data }; }
};

// ============================================================
// Expose globally for test server injection
// ============================================================
if (typeof window !== 'undefined') {
    window.MockFirebaseDb = MockFirebaseDb;
    window.MockFirebaseAuth = MockFirebaseAuth;
    window.MockGitHubAPI = MockGitHubAPI;
    window.MockClaudeAPIService = MockClaudeAPIService;
    window.MockLocalStorage = MockLocalStorage;
}
