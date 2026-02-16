---
task: "Build Argument Game Search prototype from claude-3.md spec"
status: complete
cc-spec-id: null
app: argument-game-search
files:
  - path: "index.html"
    action: created
    lines: 1310
commits:
  - sha: "b65d16c"
    message: "Build Argument Game Search prototype (1310 lines)"
    repo: "stewartdavidp-ship-it/argument-game-search"
odrc:
  new_decisions:
    - "CONFIG.MODEL constant at top of script for easy model name changes"
    - "parallelWithLimit() with concurrency 3 for attacks and exchanges"
    - "Position-aware scoring: flip evaluator score (100 - score) when user argues AGAINST"
    - "JSON fragility fix: all three system prompts include RESPOND IN JSON FORMAT ONLY"
    - "Context window management: keep last 2 exchanges + original context, summarize dropped"
    - "Error recovery: failedNodes array, retry button in detail panel per node"
    - "Multi-rebuttal branching: isBranch/branchSourceId fields on nodes"
  resolved_opens: []
  new_opens:
    - "Model name claude-sonnet-4-20250514 needs verification against live Anthropic API"
    - "Should failed ground generation (Phase 1) be recoverable or require restart?"
unexpected_findings:
  - "1310 lines (slightly over 1200 target) — extra lines from comprehensive error handling and multi-rebuttal branching"
unresolved: []
---

## Summary

Built the complete Argument Game Search prototype — a single-file HTML app (1310 lines) that explores argument spaces using three AI agents in adversarial debate.

## Architecture
- Single `index.html`: embedded CSS (~200 lines) + HTML (~90 lines) + JS (~1020 lines)
- Vanilla JS, no frameworks, no build tools
- Anthropic API called directly from browser with `anthropic-dangerous-direct-browser-access` header
- Dark theme with 13 CSS custom properties
- Two views: Setup panel → Main split-panel

## Issues Fixed from Spec Review
1. Model name → configurable `CONFIG.MODEL` constant
2. Error recovery → `failedNodes[]` + retry button
3. JSON fragility → "RESPOND IN JSON FORMAT ONLY" in ALL agent prompts + retry-on-parse-failure
4. Sequential too slow → `parallelWithLimit()` for attacks and exchanges (3 concurrent)
5. Context window → `buildExchangeMessages()` truncates to last 2 exchanges
6. Position scoring → flip score when user argues AGAINST
7. Multi-rebuttal → `isBranch`/`branchSourceId` fields, sibling nodes created
