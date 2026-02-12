const { test, expect } = require('@playwright/test');

test.describe('Bundle Assembly (Phase 2)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // Seed a reviewed job ready for packaging
        await page.evaluate(() => {
            MockGitHubAPI.loadFixtures({
                'test/repo/cc/completions/test.md': {
                    textContent: '---\ntask: "Test task"\nstatus: complete\nfiles:\n  - path: "index.html"\n    action: modified\ncommits:\n  - sha: "abc"\n    message: "test"\n---\nBody text.'
                },
                'test/repo/CLAUDE.md': {
                    textContent: '# CLAUDE.md\n## Rules\n- Test rule'
                },
                'test/repo/index.html': {
                    textContent: '<html>test content</html>'
                }
            });
            MockClaudeAPIService.setResponse('review', '# Review Prompt\n\nCheck correctness of implementation.');
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': {
                                id: 'job1', state: 'reviewed', task: 'Test bundleable task',
                                status: 'complete', repoFullName: 'test/repo',
                                fileName: 'test.md', specId: null,
                                files: [{ path: 'index.html', action: 'modified' }],
                                commits: [{ sha: 'abc', message: 'test' }],
                                validationStatus: 'pass', classified: false,
                                detectedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            });
        });
    });

    test('Package for Check button is visible for reviewed jobs', async ({ page }) => {
        await page.locator('button:has-text("Plan")').first().hover();
        await page.locator('button:has-text("Job History")').click();
        await page.waitForTimeout(1000);
        // Click job card to expand it (action buttons are inside expanded detail)
        await page.locator('text=Test bundleable task').click();
        await page.waitForTimeout(300);
        const btn = page.locator('button:has-text("Package for Check")');
        await expect(btn).toBeVisible({ timeout: 5000 });
    });

    test('Bundle assembly modal shows progress steps', async ({ page }) => {
        await page.locator('button:has-text("Plan")').first().hover();
        await page.locator('button:has-text("Job History")').click();
        await page.waitForTimeout(1000);
        // Expand the card first
        await page.locator('text=Test bundleable task').click();
        await page.waitForTimeout(300);
        await page.locator('button:has-text("Package for Check")').click();
        // Modal should appear with bundle progress
        await expect(page.locator('[data-testid="bundle-progress"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Bundle Assembly')).toBeVisible();
    });

    test('Mark as Checked button visible for reviewed jobs', async ({ page }) => {
        await page.locator('button:has-text("Plan")').first().hover();
        await page.locator('button:has-text("Job History")').click();
        await page.waitForTimeout(1000);
        // Expand the card
        await page.locator('text=Test bundleable task').click();
        await page.waitForTimeout(300);
        const btn = page.locator('button:has-text("Mark as Checked")');
        await expect(btn).toBeVisible({ timeout: 5000 });
    });

    test('Import ODRC Updates button visible for reviewed jobs', async ({ page }) => {
        await page.locator('button:has-text("Plan")').first().hover();
        await page.locator('button:has-text("Job History")').click();
        await page.waitForTimeout(1000);
        // Expand the card
        await page.locator('text=Test bundleable task').click();
        await page.waitForTimeout(300);
        const btn = page.locator('button:has-text("Import ODRC Updates")');
        await expect(btn).toBeVisible({ timeout: 5000 });
    });
});
