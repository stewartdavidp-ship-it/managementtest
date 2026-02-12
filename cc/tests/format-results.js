// Transform Playwright JSON output into CC completion file test format
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'results/latest.json');

if (!fs.existsSync(resultsPath)) {
    console.error('No results file found at results/latest.json');
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Recursively collect specs from nested suites
function collectSpecs(suites) {
    const results = [];
    for (const suite of (suites || [])) {
        for (const spec of (suite.specs || [])) {
            results.push({
                suite: suite.title,
                spec
            });
        }
        // Recurse into child suites
        results.push(...collectSpecs(suite.suites));
    }
    return results;
}

const allSpecs = collectSpecs(raw.suites);

const formatted = {
    specId: process.argv[2] || 'unknown',
    runAt: new Date().toISOString(),
    framework: 'playwright',
    duration: Math.round((raw.stats?.duration || 0) / 1000),
    summary: {
        total: (raw.stats?.expected || 0) + (raw.stats?.unexpected || 0) + (raw.stats?.skipped || 0),
        passed: raw.stats?.expected || 0,
        failed: raw.stats?.unexpected || 0,
        skipped: raw.stats?.skipped || 0
    },
    tests: allSpecs.map(({ suite, spec }) => ({
        name: `${suite} > ${spec.title}`,
        status: spec.ok ? 'passed' : 'failed',
        duration: spec.tests?.[0]?.results?.[0]?.duration || 0
    })),
    errors: allSpecs
        .filter(({ spec }) => !spec.ok)
        .map(({ suite, spec }) => ({
            test: `${suite} > ${spec.title}`,
            message: spec.tests?.[0]?.results?.[0]?.error?.message || 'Unknown error'
        }))
};

const timestamp = formatted.runAt.replace(/[:.]/g, '-');
const outPath = path.join(__dirname, `results/${formatted.specId}-${timestamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(formatted, null, 2));
console.log(`Formatted results: ${outPath}`);
console.log(`Summary: ${formatted.summary.passed}/${formatted.summary.total} passed, ${formatted.summary.failed} failed, ${formatted.summary.skipped} skipped`);
