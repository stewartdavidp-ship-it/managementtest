---
task: "Add StorageManager auto-cleanup on app load to prevent localStorage bloat"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "81259a4"
    message: "Add StorageManager auto-cleanup on app load (v8.64.3)"
odrc:
  new_decisions:
    - "StorageManager runs automatic cleanup on app initialization to evict stale localStorage entries"
  resolved_opens: []
  new_opens: []
unexpected_findings:
  - "localStorage had accumulated stale entries from previous sessions that were never cleaned up"
unresolved: []
---

## Approach

Added automatic StorageManager cleanup that runs on app load to evict stale localStorage entries and prevent gradual bloat over time.

## Implementation

- StorageManager auto-cleanup invoked during app initialization
- Cleans up entries that exceed age thresholds

## Verification

- 34/34 Playwright tests pass
- Version: v8.64.3
