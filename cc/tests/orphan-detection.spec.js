const { test, expect } = require('@playwright/test');

test.describe('Orphan Commit Detection (Phase 3)', () => {
    test('identifies commits not in any completion file', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            MockGitHubAPI.loadFixtures({
                'test/repo/_commits': [
                    { sha: 'aaa111', commit: { message: 'Fix header', author: { date: '2026-02-10T10:00:00Z' } }, parents: [{ sha: 'p1' }] },
                    { sha: 'bbb222', commit: { message: 'Update CSS', author: { date: '2026-02-11T14:00:00Z' } }, parents: [{ sha: 'p2' }] },
                    { sha: 'ccc333', commit: { message: 'Merge feature-x', author: { date: '2026-02-11T15:00:00Z' } }, parents: [{ sha: 'p3' }, { sha: 'p4' }] },
                    { sha: 'ddd444', commit: { message: 'Add completion file', author: { date: '2026-02-11T16:00:00Z' } }, parents: [{ sha: 'p5' }] }
                ],
                'test/repo/_commit_aaa111': { sha: 'aaa111', files: [{ filename: 'index.html', status: 'modified' }] },
                'test/repo/_commit_bbb222': { sha: 'bbb222', files: [{ filename: 'shared/cc-shared.css', status: 'modified' }] },
                'test/repo/_commit_ddd444': { sha: 'ddd444', files: [{ filename: 'cc/completions/test.md', status: 'added' }] }
            });
        });
        // Existing jobs reference sha 'bbb222' — so only 'aaa111' should be orphaned
        // ccc333 filtered (merge), ddd444 filtered (cc/ only)
        const orphans = await page.evaluate(async () => {
            const existingJobs = [{ commits: [{ sha: 'bbb222' }] }];
            const existingOrphans = [];
            const settings = { orphanDetectionDays: 14 };
            return await pollOrphanCommits(MockGitHubAPI, 'test/repo', 'test-user-123', existingJobs, existingOrphans, settings);
        });
        expect(orphans).toHaveLength(1);
        expect(orphans[0].commitSha).toBe('aaa111');
    });

    test('filters merge commits', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(async () => {
            MockGitHubAPI.loadFixtures({
                'test/repo/_commits': [
                    { sha: 'merge1', commit: { message: 'Merge branch', author: { date: '2026-02-11T10:00:00Z' } }, parents: [{ sha: 'p1' }, { sha: 'p2' }] }
                ]
            });
            return await pollOrphanCommits(MockGitHubAPI, 'test/repo', 'test-user-123', [], [], { orphanDetectionDays: 14 });
        });
        expect(result).toHaveLength(0);
    });

    test('filters cc-only commits', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(async () => {
            MockGitHubAPI.loadFixtures({
                'test/repo/_commits': [
                    { sha: 'cconly1', commit: { message: 'Update spec', author: { date: '2026-02-11T10:00:00Z' } }, parents: [{ sha: 'p1' }] }
                ],
                'test/repo/_commit_cconly1': { sha: 'cconly1', files: [{ filename: 'cc/specs/test.md', status: 'added' }, { filename: 'cc/completions/test.md', status: 'added' }] }
            });
            return await pollOrphanCommits(MockGitHubAPI, 'test/repo', 'test-user-123', [], [], { orphanDetectionDays: 14 });
        });
        expect(result).toHaveLength(0);
    });

    test('OrphanDetectionService CRUD operations work', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(async () => {
            // Create an orphan
            await OrphanDetectionService.create('test-user-123', {
                commitSha: 'test123',
                repoFullName: 'test/repo',
                commitMessage: 'Test orphan',
                state: 'detected',
                detectedAt: new Date().toISOString()
            });
            // Read all orphans
            const all = await OrphanDetectionService.getAll('test-user-123');
            return all;
        });
        expect(result).toBeTruthy();
        const values = Object.values(result);
        expect(values.length).toBeGreaterThan(0);
        expect(values[0].commitSha).toBe('test123');
    });
});
