#!/bin/bash
# Run CC Playwright test suite
# Usage: ./cc/tests/run.sh [--headed] [--filter pattern]

cd "$(dirname "$0")"

# Install Playwright if not present
if ! npx playwright --version > /dev/null 2>&1; then
    echo "Installing Playwright..."
    npm init -y > /dev/null 2>&1
    npm install @playwright/test > /dev/null 2>&1
    npx playwright install chromium > /dev/null 2>&1
fi

# Create results directory
mkdir -p results

# Run tests
if [ "$1" = "--headed" ]; then
    npx playwright test --config=playwright.config.js --headed "${@:2}"
elif [ "$1" = "--filter" ]; then
    npx playwright test --config=playwright.config.js --grep "$2"
else
    npx playwright test --config=playwright.config.js "$@"
fi

# Copy results to standardized location
if [ -f results/latest.json ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
    cp results/latest.json "results/run-${TIMESTAMP}.json"
    echo "Results saved to results/run-${TIMESTAMP}.json"
fi
