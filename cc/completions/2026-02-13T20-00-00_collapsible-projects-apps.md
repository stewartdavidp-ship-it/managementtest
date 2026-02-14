---
task: "Collapse Projects/Apps section behind a triangle toggle, hidden by default"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "d6b78a6"
    message: "Collapse Projects/Apps section behind triangle toggle (v8.65.1)"
odrc:
  new_decisions:
    - "Projects/Apps section collapsed by default — user clicks triangle to expand"
    - "Drop box and ODRC import banner extracted outside collapsible section — always visible"
    - "CSS display:none/block approach used instead of JSX conditional or HTML details element"
  resolved_opens: []
  new_opens:
    - "Should Projects/Apps section eventually be pulled out to its own view/tab?"
unexpected_findings:
  - "Cannot wrap Projects/Apps JSX in <details> or <React.Fragment> with conditional — content spans two div nesting levels causing JSX tag mismatch"
  - "Three approaches failed (HTML details, React.Fragment conditional, wrapping across div boundaries) before CSS display toggle worked"
unresolved: []
---

## Approach

User requested collapsing the entire Projects/Apps view into a single triangle toggle, hidden by default. The content spans complex JSX nesting (inner space-y-6 div closes mid-section), so JSX-level conditional rendering was not feasible. Used CSS `display: none/block` instead.

## Implementation

- Added `projectsCollapsed` state (default: `true`)
- Extracted drop box and ODRC import banner OUTSIDE the collapsible wrapper (always visible)
- Added clickable header: `▶ Projects / Apps` with configured app count and staged files badge
- Wrapped remaining content (staged files, deploy controls, app cards, metrics) in `<div style={{ display: projectsCollapsed ? 'none' : 'block' }}>`
- Chevron rotates 90° when expanded

## Verification

- 34/34 Playwright tests pass
- Version bumped to 8.65.1
- App loads successfully, toggle works correctly
