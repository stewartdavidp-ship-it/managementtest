---
task: "Add developer work cards to DashboardView (Home tab) below existing deploy/app content"
status: complete
cc-spec-id: feature_developer_landing_page
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "fb58ec7"
    message: "Revert DashboardView to v8.64.3, re-add work cards below existing content (v8.65.0)"
odrc:
  new_decisions:
    - "Work cards are ADDITIVE — placed below existing DashboardView content, not replacing it"
    - "IdeaWorkCard shows minimal metadata: phase stripe, idea name, app tag, session count, OPEN count, and Continue button"
  resolved_opens: []
  new_opens:
    - "Should IdeaWorkCard show more metadata (concept counts, last session summary) or stay minimal?"
unexpected_findings:
  - "Initial approach (commit 3f23d7e) incorrectly replaced ALL existing DashboardView content with work cards — user reported 'we lost all the previous functionality'"
  - "Had to revert index.html to v8.64.3 (commit 81259a4) via git checkout and re-add work cards BELOW existing content"
  - "Original attempt to wrap legacy JSX in {false && <React.Fragment>} caused bracket mismatch due to embedded IIFEs — fully removing was the wrong approach"
unresolved: []
---

## Approach

Added developer work cards BELOW the existing DashboardView content. The original spec said "drop box stays with all the same capabilities" — the correct interpretation was to add work cards alongside existing functionality, not replace it.

After the initial wrong approach (replacing everything, committed as 3f23d7e), reverted to v8.64.3 and re-added only the new features on top.

## Implementation

### New components and helpers:
- `getRecentIdeas(globalIdeas, globalConcepts, apps, maxCount)` — enriches active ideas with concept counts, phase, app name, session info
- `IdeaWorkCard({ idea, onNavigateIdea, onNavigateApp, onContinue })` — card with phase-colored left stripe, idea name, app tag, phase badge, session label, date, OPEN count, and Continue button
- `PHASE_COLORS` constant — color definitions for exploring/building/converging/spec-ready phases

### DashboardView additions (not replacements):
- Added `setViewPayload` prop for cross-view deep-linking
- New state: `workCardContinueIdea`, work card derived data from `getRecentIdeas()`
- New handlers: `workCardNavigateIdea` (deep-links to IdeasView), `workCardNavigateApp`, `workCardContinue` (opens ExploreInChatModal)
- Work cards section appended AFTER all existing content (deploy controls, app cards, metrics all preserved)

### Parent wiring:
- Added `viewPayload`/`setViewPayload` state to parent App component
- Passed `setViewPayload` to DashboardView and IdeasView
- IdeasView deep-link effect: consumes `viewPayload.ideaId` to navigate to Idea Detail mode

## Verification

- 34/34 Playwright tests pass
- Version bumped to 8.65.0
- App loads successfully in headless browser
- All existing deploy/app functionality preserved
