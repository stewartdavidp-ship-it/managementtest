---
task: "Fix staged files hidden inside collapsed Projects/Apps wrapper"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - "ccf2b5c"
odrc:
  new_decisions: []
  resolved_opens: []
  new_opens: []
unexpected_findings:
  - "Staged files (multi-app and single-file views) and active deployments were nested inside the collapsible Projects/Apps div which defaults to display:none — file drops were processed correctly but the UI was invisible"
unresolved: []
---

## Approach

The v8.65.1 collapsible Projects/Apps wrapper (`projectsCollapsed` state, default `true`) enclosed both the app cards AND the staged files + active deployments sections. Dropping a file staged it correctly (console logs confirmed), but the staged area was hidden by `display: none`.

## Implementation

Moved the staged files (multi-app view, single-file view) and active deployments sections out of the collapsible wrapper. They now render in their own conditionally-visible `<div>` between the Projects/Apps toggle header and the collapsible app cards section. The wrapper only renders when there are staged files or active deployments.

Lines affected: ~10787-11844 in index.html.

## Verification

- Version bumped to 8.65.4
- File drop now shows staged files area immediately below the drop zone regardless of Projects/Apps collapse state
