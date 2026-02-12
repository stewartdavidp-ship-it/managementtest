const { test, expect } = require('@playwright/test');

test.describe('Detection Dialog', () => {
    test('shows completion file count in Plan nav badge', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // Seed new jobs — the Plan nav should show a badge count
        await page.evaluate(() => {
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': { id: 'job1', state: 'new', task: 'New task 1', status: 'complete', repoFullName: 'test/repo', fileName: 'a.md', files: [], commits: [], validationStatus: 'pass', classified: false, detectedAt: new Date().toISOString() },
                            'job2': { id: 'job2', state: 'new', task: 'New task 2', status: 'complete', repoFullName: 'test/repo', fileName: 'b.md', files: [], commits: [], validationStatus: 'pass', classified: false, detectedAt: new Date().toISOString() }
                        }
                    }
                }
            });
        });
        // Wait for the badge to appear near the Plan nav button
        // The badge shows the count of 'new' state jobs as a blue pill
        await page.waitForTimeout(1000);
        await expect(page.locator('.bg-blue-600')).toBeVisible({ timeout: 5000 });
    });

    test('job history accessible from Plan dropdown', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.locator('button:has-text("Plan")').hover();
        const jobHistoryLink = page.locator('button:has-text("Job History")');
        await expect(jobHistoryLink).toBeVisible();
    });

    test('CompletionFileService listen updates state', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // Test that the listener pattern works via mock Firebase
        const result = await page.evaluate(() => {
            return new Promise(resolve => {
                CompletionFileService.listen('test-user-123', (jobs) => {
                    resolve(Array.isArray(jobs));
                });
            });
        });
        expect(result).toBe(true);
    });
});
