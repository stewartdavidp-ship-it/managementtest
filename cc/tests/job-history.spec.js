const { test, expect } = require('@playwright/test');

// Helper to navigate to Job History (v8.63.0: Jobs is a top-level tab)
async function navigateToJobHistory(page) {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
    // Click the Jobs tab directly (flat nav since v8.63.0)
    await page.locator('button:has-text("Jobs")').click();
    // Wait for the view to render
    await page.waitForTimeout(500);
}

// Helper to seed Firebase with completion job data
function seedJobData(jobs) {
    return `
        MockFirebaseDb._seed({
            'command-center': {
                'test-user-123': {
                    completionJobs: ${JSON.stringify(jobs)}
                }
            }
        });
    `;
}

test.describe('Job History View', () => {
    test('navigates to Job History from Jobs tab', async ({ page }) => {
        await navigateToJobHistory(page);
        await expect(page.locator('text=Job History').first()).toBeVisible();
    });

    test('shows empty state when no jobs exist', async ({ page }) => {
        await navigateToJobHistory(page);
        await expect(page.locator('text=No completion files detected yet')).toBeVisible();
    });

    test('displays job cards when jobs exist', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': {
                                id: 'job1',
                                repoFullName: 'test/repo',
                                fileName: '2026-02-12T14-30-00_test-task.md',
                                state: 'new',
                                task: 'Test task description',
                                status: 'complete',
                                files: [{ path: 'index.html', action: 'modified' }],
                                commits: [{ sha: 'abc123', message: 'Test commit' }],
                                validationStatus: 'pass',
                                classified: false,
                                detectedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            });
        });
        await page.locator('button:has-text("Jobs")').click();
        await expect(page.locator('text=Test task description')).toBeVisible({ timeout: 5000 });
    });

    test('filter by state works', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': { id: 'job1', state: 'new', task: 'New job task', status: 'complete', repoFullName: 'test/repo', fileName: 'a.md', files: [], commits: [], validationStatus: 'pass', classified: false, detectedAt: new Date().toISOString() },
                            'job2': { id: 'job2', state: 'reviewed', task: 'Reviewed job task', status: 'complete', repoFullName: 'test/repo', fileName: 'b.md', files: [], commits: [], validationStatus: 'pass', classified: true, detectedAt: new Date().toISOString() }
                        }
                    }
                }
            });
        });
        await page.locator('button:has-text("Jobs")').click();
        await page.waitForTimeout(500);
        // Select "New" filter
        await page.selectOption('[data-testid="state-filter"]', 'new');
        await expect(page.locator('text=New job task')).toBeVisible();
        await expect(page.locator('text=Reviewed job task')).not.toBeVisible();
    });

    test('card expands to show details', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': {
                                id: 'job1', state: 'new', task: 'Expandable job',
                                status: 'complete', repoFullName: 'test/repo',
                                fileName: 'test.md', validationStatus: 'pass', classified: false,
                                files: [{ path: 'src/app.js', action: 'modified' }],
                                commits: [{ sha: 'abc123', message: 'Fix the thing' }],
                                unexpectedFindings: ['Found a stale reference'],
                                detectedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            });
        });
        await page.locator('button:has-text("Jobs")').click();
        await page.waitForTimeout(500);
        // Click to expand
        await page.locator('text=Expandable job').click();
        await expect(page.locator('text=src/app.js')).toBeVisible();
        await expect(page.locator('text=abc123')).toBeVisible();
    });

    test('CompletionFileService updateState changes job state', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // Test the state change mechanism directly
        const result = await page.evaluate(async () => {
            // Seed a job in 'new' state
            MockFirebaseDb._setPath('command-center/test-user-123/completionJobs/job1', {
                id: 'job1', state: 'new', task: 'Test state change', status: 'complete'
            });
            // Update state via service method
            await CompletionFileService.updateState('test-user-123', 'job1', 'acknowledged');
            // Read back the updated state
            const data = MockFirebaseDb._getPath('command-center/test-user-123/completionJobs/job1');
            return data?.state;
        });
        expect(result).toBe('acknowledged');
    });

    test('validation warning indicator shows for invalid files', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: {
                            'job1': { id: 'job1', state: 'new', task: 'Warning job', status: 'complete', repoFullName: 'test/repo', fileName: 'a.md', files: [], commits: [], validationStatus: 'warning', validationErrors: ['Missing commits field'], classified: false, detectedAt: new Date().toISOString() }
                        }
                    }
                }
            });
        });
        await page.locator('button:has-text("Jobs")').click();
        await page.waitForTimeout(1000);
        // The warning emoji should show on the card header
        await expect(page.locator('[title]').filter({ hasText: '⚠' }).first()).toBeVisible({ timeout: 5000 });
    });

    test('unclassified nudge shows when threshold met', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await page.evaluate(() => {
            const jobs = {};
            for (let i = 0; i < 6; i++) {
                jobs[`job${i}`] = { id: `job${i}`, state: 'acknowledged', task: `Unclassified ${i}`, status: 'complete', repoFullName: 'test/repo', fileName: `${i}.md`, files: [], commits: [], validationStatus: 'pass', classified: false, detectedAt: new Date().toISOString() };
            }
            MockFirebaseDb._seed({
                'command-center': {
                    'test-user-123': {
                        completionJobs: jobs,
                        settings: { completionFiles: { unclassifiedNudgeThreshold: 5 } }
                    }
                }
            });
        });
        await page.locator('button:has-text("Jobs")').click();
        await page.waitForTimeout(1000);
        await expect(page.locator('text=/unclassified jobs/i')).toBeVisible({ timeout: 5000 });
    });
});
