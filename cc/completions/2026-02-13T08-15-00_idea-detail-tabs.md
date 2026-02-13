---
task: "Replace stacked ODRC concept groups in Idea Detail with tabbed layout, add text search to all IdeasView modes"
status: complete
cc-spec-id: bug_idea_detail_tabs
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "8c2527a"
    message: "Add tabbed ODRC concept layout + search filter to IdeasView (v8.64.2)"
odrc:
  new_decisions:
    - "Mode 3 Idea Detail uses tabbed layout for ODRC types — Opens, Decisions, Rules, Constraints"
    - "Text search filter is cross-mode — shared conceptSearchFilter state works in Mode 1, 2, and 3"
    - "Auto-switch tab: if active tab has 0 filtered items, switch to tab with most items"
  resolved_opens: []
  new_opens:
    - "Should tab selection persist per-idea (e.g., remember last tab for Architecture Rules vs Workflow Model)?"
unexpected_findings: []
unresolved: []
---

## Approach

Replaced the `ODRC_TYPES.map(type => renderConceptGroup(...))` stacked layout in Mode 3 with a tabbed interface. Added shared text search filter across all three IdeasView modes. Reused existing `renderConceptGroup()` and `ConceptCard` components — no changes to those.

## Implementation Notes

- **T1**: `activeConceptTab` state defaults to 'OPEN', resets on idea navigation
- **T2**: Summary bar shows total concepts with per-type breakdown, resolved count shown parenthetically for OPENs only, color-coded per TYPE_STYLES
- **T3**: Tab bar with count badges, indigo active border, muted tabs for zero-count types
- **T4**: Single tab panel renders via existing `renderConceptGroup()`, empty state shows contextual message (filters vs no items)
- **T5**: `conceptSearchFilter` (text) and `conceptStatusFilter` (dropdown) — text search added to all 3 modes, status filter Mode 3 only. Both clear on navigation (navigateToApp, navigateToIdea, goBack)
- **Filtered memos**: `filteredConcepts` (Mode 1) extended with search, `filteredAppConcepts` (Mode 2) and `filteredIdeaConcepts` (Mode 3) added as new useMemo hooks
- **Auto-switch effect**: `React.useEffect` watches `filteredIdeaConcepts` and switches to most populated tab if current tab is empty
- All 34 Playwright tests pass
- Version bumped to 8.64.2
