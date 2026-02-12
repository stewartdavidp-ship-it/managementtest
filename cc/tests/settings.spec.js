const { test, expect } = require('@playwright/test');

// Helper to navigate to Settings
async function navigateToSettings(page) {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
    // The Settings nav section button is "⚙️ Settings ▼", hover to reveal dropdown
    const navBtn = page.locator('button:has-text("Settings")').first();
    await navBtn.hover();
    // Click the specific "🔑 Settings" dropdown item
    await page.locator('button:has-text("🔑 Settings")').click();
    await page.waitForTimeout(500);
}

test.describe('Settings View', () => {
    test('settings view shows completion files section', async ({ page }) => {
        await navigateToSettings(page);
        // Scroll down to see the Completion Files section
        await page.evaluate(() => window.scrollBy(0, 500));
        await expect(page.locator('text=Completion Files')).toBeVisible({ timeout: 5000 });
    });

    test('nudge threshold input is visible and configurable', async ({ page }) => {
        await navigateToSettings(page);
        const input = page.locator('[data-testid="nudge-threshold"]');
        await expect(input).toBeVisible({ timeout: 5000 });
        // Verify it has a default value
        const val = await input.inputValue();
        expect(parseInt(val)).toBeGreaterThan(0);
    });

    test('Anthropic API key section exists', async ({ page }) => {
        await navigateToSettings(page);
        await expect(page.locator('text=/Anthropic API Key/i')).toBeVisible({ timeout: 5000 });
    });

    test('API key status indicator shows configured in test mode', async ({ page }) => {
        await navigateToSettings(page);
        // In test mode, we seeded the mock localStorage with a key
        await expect(page.locator('text=Configured').first()).toBeVisible({ timeout: 5000 });
    });

    test('orphan detection window input exists', async ({ page }) => {
        await navigateToSettings(page);
        // There should be an orphan detection days input
        await expect(page.locator('text=/Orphan Detection/i')).toBeVisible({ timeout: 5000 });
    });
});
