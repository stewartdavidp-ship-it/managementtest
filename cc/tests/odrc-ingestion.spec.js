const { test, expect } = require('@playwright/test');

test.describe('ODRC Update Ingestion (Phase 3)', () => {
    test('parses structured ODRC update text', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(() => {
            const text = `## ODRC Updates
- RESOLVE OPEN: "Shared files not deploying" → matched to concept_id c1
- NEW OPEN: "Deploy needs nested directory support" → tag to Idea Deploy Improvements
- NEW DECISION: "Use flat shared directory only" → untagged
- NEW RULE: "Always validate deploy manifest before push"`;
            return ODRCUpdateIngestionService.parse(text);
        });
        expect(result).toHaveLength(4);
        expect(result[0].action).toBe('resolve');
        expect(result[0].conceptId).toBe('c1');
        expect(result[1].action).toBe('create');
        expect(result[1].type).toBe('OPEN');
        expect(result[2].action).toBe('create');
        expect(result[2].type).toBe('DECISION');
        expect(result[3].type).toBe('RULE');
    });

    test('handles arrow format variations', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(() => {
            const text = `## ODRC Updates
- RESOLVE OPEN: "With arrow variation" -> matched to concept_id c1
- NEW OPEN: "Another variation" ==> tag to Idea Test
- NEW DECISION: "Standard arrow" → untagged`;
            return ODRCUpdateIngestionService.parse(text);
        });
        expect(result.length).toBeGreaterThan(0);
    });

    test('returns empty array for unparseable input', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(() => {
            return ODRCUpdateIngestionService.parse('This is not ODRC format at all');
        });
        expect(result).toHaveLength(0);
    });

    test('parses resolve actions with concept IDs', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(() => {
            const text = `- RESOLVE OPEN: "Test concept" → matched to concept_id abc123`;
            return ODRCUpdateIngestionService.parse(text);
        });
        expect(result).toHaveLength(1);
        expect(result[0].action).toBe('resolve');
        expect(result[0].conceptId).toBe('abc123');
    });

    test('parses create actions with idea tags', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
        const result = await page.evaluate(() => {
            const text = `- NEW CONSTRAINT: "Must support offline mode" → tag to Idea Mobile App Phase 2`;
            return ODRCUpdateIngestionService.parse(text);
        });
        expect(result).toHaveLength(1);
        expect(result[0].action).toBe('create');
        expect(result[0].type).toBe('CONSTRAINT');
        expect(result[0].targetIdea).toBeTruthy();
    });
});
