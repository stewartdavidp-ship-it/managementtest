const { test, expect } = require('@playwright/test');

test.describe('App Loading', () => {
    test('loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // Filter out expected warnings (favicon, Babel deprecation notices, etc.)
        const realErrors = errors.filter(e =>
            !e.includes('favicon') &&
            !e.includes('Babel') &&
            !e.includes('DevTools') &&
            !e.includes('third-party cookie')
        );
        expect(realErrors).toHaveLength(0);
    });

    test('displays correct version', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const versionText = await page.locator('text=/v\\d+\\.\\d+/').first().textContent();
        expect(versionText).toBeTruthy();
    });

    test('shows navigation with all sections', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        await expect(page.locator('button:has-text("Deploy")').first()).toBeVisible();
        await expect(page.locator('button:has-text("Plan")').first()).toBeVisible();
        await expect(page.locator('button:has-text("Sessions")').first()).toBeVisible();
        await expect(page.locator('button:has-text("Settings")').first()).toBeVisible();
    });

    test('renders in test mode', async ({ page }) => {
        const testModeLogged = [];
        page.on('console', msg => {
            if (msg.text().includes('[CC] Running in TEST MODE')) testModeLogged.push(msg.text());
        });
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        expect(testModeLogged.length).toBeGreaterThan(0);
    });

    test('mock Firebase auth fires with test user', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        // In test mode, the app should have received the mock user
        const uid = await page.evaluate(() => {
            return MockFirebaseAuth.currentUser?.uid;
        });
        expect(uid).toBe('test-user-123');
    });
});
