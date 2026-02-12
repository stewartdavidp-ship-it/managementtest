// Sample commits for orphan detection testing
const FIXTURE_COMMITS = [
    {
        sha: 'aaa111',
        commit: { message: 'Fix typo in header', author: { date: '2026-02-10T10:00:00Z' } },
        parents: [{ sha: 'parent1' }],
        files: [{ filename: 'index.html', status: 'modified' }]
    },
    {
        sha: 'bbb222',
        commit: { message: 'Update shared CSS colors', author: { date: '2026-02-11T14:00:00Z' } },
        parents: [{ sha: 'parent2' }],
        files: [{ filename: 'shared/cc-shared.css', status: 'modified' }]
    },
    {
        sha: 'ccc333',
        commit: { message: 'Merge branch feature-x', author: { date: '2026-02-11T15:00:00Z' } },
        parents: [{ sha: 'parent3' }, { sha: 'parent4' }],  // Merge commit — should be filtered
        files: []
    },
    {
        sha: 'ddd444',
        commit: { message: 'Add completion file', author: { date: '2026-02-11T16:00:00Z' } },
        parents: [{ sha: 'parent5' }],
        files: [{ filename: 'cc/completions/test.md', status: 'added' }]  // cc/ only — should be filtered
    }
];
