---
task: "Remove legacy session system — SESSION_TYPES, SessionBriefGenerator, SessionLaunchModal, GenerateCLAUDEModal, Sessions tab content, SessionHistoryPanel, CLAUDE_INSTRUCTIONS.md generator"
status: complete
cc-spec-id: sp_legacy_session_removal
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "6030351"
    message: "Remove legacy session system — 3,125 lines removed (v8.63.0)"
odrc:
  new_decisions:
    - "Retain minimal SESSION_TYPES stub (4 types) and SessionBriefGenerator stub for ClaudePrepModal backward compatibility"
    - "Retain generateClaudeInstructions as empty-string stub for ClaudePrepModal backward compatibility"
    - "Sessions tab kept in navigation with Activity Journal placeholder — not removed"
    - "sessionLog state and SessionLogService kept — wired into FirebaseConfigSync overlay"
    - "pendingSessionReturn state kept — used by AutoReviewModal (SESSION_RETURN.json handling)"
  new_opens:
    - "Should ClaudePrepModal be updated to use IdeationBriefGenerator instead of the SESSION_TYPES/SessionBriefGenerator stubs?"
    - "Should the sessionLog localStorage state and SessionLogService be removed in a future cleanup?"
  resolved_opens: []
unexpected_findings:
  - "SessionBriefGenerator had 7 references in ClaudePrepModal + SettingsView — required stubs instead of clean removal"
  - "generateClaudeInstructions had 2 references in ClaudePrepModal build flow — required empty-string stub"
  - "PostSessionReviewModal (~800 lines) existed between SessionLogView and SessionHistoryPanel — not mentioned in spec but safely removed as part of R7/R8 since only referenced from within SessionLogView"
  - "showSessionLaunch state variable did not exist (spec R5 cleanup item) — SessionLaunchModal was triggered via modal.type === 'sessionLaunch' instead"
  - "SessionLogView was ~700 lines, not ~317 as spec estimated"
unresolved: []
lines_removed: 3300
lines_added: 175
---

## Approach

Executed the removal plan in the spec's recommended 4-phase order with some optimizations:

**Phase 1: Big self-contained blocks**
- R1+R2: Removed SESSION_TYPES (236 lines) and SessionBriefGenerator (272 lines) together. Added minimal stubs (12 lines) because ClaudePrepModal and SettingsView still reference both.
- R3: Removed generateSessionBrief() wrapper (3 lines). Replaced surviving call in ClaudePrepModal with direct SessionBriefGenerator.generate().
- R4: Removed CLAUDE_INSTRUCTIONS.md generator (260 lines including STANDARD_DESCRIPTIONS constant). Replaced with 1-line stub returning empty string for ClaudePrepModal backward compat.

**Phase 2: UI components**
- R5: Removed SessionLaunchModal (309 lines). Also removed the "🤖 Session" trigger button and hasReadyItems/readyItems code from DashboardView app cards.
- R6: Removed GenerateCLAUDEModal (107 lines, inside IdeasView). Also removed showGenerateModal state, the "📄 Generate CLAUDE.md" button, and the modal render.
- R7+R8: Removed SessionLogView + PostSessionReviewModal + SessionHistoryPanel together (1,909 lines). All three were self-contained — PostSessionReviewModal and SessionHistoryPanel only referenced from within SessionLogView.

**Phase 3: Dangling references**
- Replaced SessionLogView render with Activity Journal placeholder
- Removed SessionLaunchModal render and trigger button
- Removed "Review this session?" button linking to Sessions tab
- Removed active session badge from DashboardView app cards
- Updated validateSessionReturn to use simple string check instead of SESSION_TYPES lookup
- Updated Session Log label to "Activity Journal" in nav dropdown
- Version bumped 8.62.0 → 8.63.0

**Phase 4: Verify**
- All 34 Playwright tests pass
- No console errors on load

## What Was Kept and Why

| Component | Reason |
|-----------|--------|
| SESSION_TYPES (4-type stub) | ClaudePrepModal reads type metadata (icon, label, contextStrategy, scopeRules, etc.) |
| SessionBriefGenerator (stub) | ClaudePrepModal calls generate(), getAll(), suggestFromWorkItem() |
| generateClaudeInstructions (stub) | ClaudePrepModal generates CLAUDE_INSTRUCTIONS.md in prep packages |
| SessionService | 15 references in surviving code — deploy flow, activity logging |
| sessionLog state + SessionLogService | Wired into FirebaseConfigSync overlay sync |
| pendingSessionReturn state | Used by AutoReviewModal (SESSION_RETURN.json handling) |
| CLAUDE_PREP_DOCS array | Used by classifyFileAction() — independent of session system |
| validateSessionReturn() | Simplified to not reference SESSION_TYPES, but kept for deploy flow |
| Sessions nav entry | Kept with Activity Journal placeholder per spec Option A |
| WorkItemService | 30+ references outside session system |

## Verification

- 34/34 Playwright tests pass (same as before removal)
- No test modifications needed — no tests referenced removed components
- app-load.spec.js passes (Sessions button still visible — placeholder view exists)
- Version displays as 8.63.0
