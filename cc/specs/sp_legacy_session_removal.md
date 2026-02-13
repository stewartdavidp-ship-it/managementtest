# CLAUDE.md — Legacy Session System Removal
# cc-spec-id: sp_legacy_session_removal
# App: Command Center (index.html)
# Base version: 8.62.0 (or current after sp_ideation_ux_pipeline)
# Target version: 8.63.0
# Depends on: sp_ideation_ux_pipeline

---

## Before You Begin

This is a removal-focused task. You are deleting ~3,000+ lines of legacy code that has been replaced by the Ideation Pipeline (v8.61.0+). The goal is clean removal — no rewrites, no replacements. The new pipeline already exists.

Review the removal plan, verify each component's dependencies before deleting, and tell me:
1. Do you see any dependencies I missed that would break if removed?
2. Can you complete this in one session?

---

## Task Summary

Remove the legacy session management system from Command Center. This system predates the Idea-to-Chat pipeline and includes: session types, session brief generator, session package builder, Sessions tab UI, session history panel, CLAUDE_INSTRUCTIONS.md generator, and the legacy GenerateCLAUDEModal. These have been replaced by IdeationBriefGenerator, ExploreInChatModal, and the ODRC-driven pipeline.

**Key principle:** Remove only. Do not rebuild or replace anything in this spec. The replacement (ideation pipeline) already exists. If removing a component would break something unrelated to the legacy session system, leave a stub or note it as unresolved.

---

## What to Remove

### SAFE TO REMOVE — No external dependencies

#### R1: SESSION_TYPES object
**Lines:** ~2871-3106 (~235 lines)
**What it is:** 7 hardcoded session types (build, design, fix, test, research, review, refactor) with doc requirements, token budgets, descriptions.
**Replaced by:** IdeationBriefGenerator's 3 phase-driven session types (exploration, spec, claude-md).
**References to clean up:**
- `validateSessionReturn()` at ~line 21018 — references `SESSION_TYPES` for validation. Remove validation check or replace with simple string check.
- SessionLaunchModal references (~21883, 22444, 22954) — these are in code being removed (R5).
- SESSION_RETURN.json instructions embedded in each session type (~2890-3095) — removed with the block.

#### R2: SessionBriefGenerator
**Lines:** ~3109-3380 (~271 lines)
**What it is:** Generates session briefs from app context, picks docs to include, suggests session type from work items.
**Replaced by:** `IdeationBriefGenerator` at ~line 3386.
**References to clean up:**
- `generateSessionBrief()` wrapper at ~line 21725 — remove wrapper function.
- SessionLaunchModal at ~21868, 21877 — calls `suggestFromWorkItem()`. Being removed (R5).
- Settings session type selector at ~22101, 22792, 25183 — calls `getAll()`. Being removed (R5).

#### R3: generateSessionBrief() wrapper
**Line:** ~21725
**What it is:** One-line wrapper that calls `SessionBriefGenerator.generate()`.
**Remove:** The whole function.

#### R4: CLAUDE_INSTRUCTIONS.md Generator
**Lines:** ~15163-15400 (~238 lines)
**What it is:** Generates a `CLAUDE_INSTRUCTIONS.md` file from app scope data.
**Replaced by:** Pipeline's CLAUDE.md generation via Chat with locked template.
**References to clean up:**
- Called at ~22350 in the session package build flow (being removed in R5).
- Called at ~23468 — check if this is in Settings or another flow. If in a remaining flow, leave a stub that returns empty string.

#### R5: SessionLaunchModal
**Lines:** ~21840-22142 (~302 lines)
**What it is:** Modal for starting a session — pick work items, pick session type, generate prep package zip, copy prompt to clipboard.
**Replaced by:** ExploreInChatModal (Idea-to-Chat pipeline).
**References to clean up:**
- Rendered at ~9271 in app card expanded view. Remove the render and the `showSessionLaunch` state variable.
- Any `setShowSessionLaunch` calls — remove.

#### R6: GenerateCLAUDEModal (legacy)
**Lines:** ~17831-17918 (~87 lines)
**What it is:** Modal on App Aggregate view that generates basic CLAUDE.md from app concepts with copy/push.
**Replaced by:** Pipeline's phase-aware CLAUDE.md generation (B1 in sp_ideation_ux_pipeline).
**References to clean up:**
- `showGenerateModal` state at ~17513. Remove.
- Green "Generate CLAUDE.md" button at ~18250-18251. Remove.
- Modal render at ~18418-18419. Remove.

#### R7: Sessions Tab UI — Session Log sub-tab
**Lines:** ~13418-13735 (~317 lines approx)
**What it is:** The Session Log tab content: Project File (gs-active.zip) upload, Claude Direct Deploy section, Quick Deploy (Paste Code) section.
**Replaced by:** Deploy tab handles all file intake. Ideas pipeline handles Chat sessions.
**References to clean up:**
- Sessions tab navigation at ~8881 (the `v === 'session'` route).
- Related state variables: `gsActiveData`, `quickDeployCode`, etc.
- Firebase upload/download functions for gs-active (~13178-13280).

#### R8: SessionHistoryPanel
**Lines:** ~14584-14650+ (~928 lines)
**What it is:** Shows past sessions with expandable details, status indicators, review actions.
**Replaced by:** Will be rebuilt as activity journal (future sp_sessions_redesign). For now, remove.
**References to clean up:**
- Rendered at ~13739. Remove the render.
- The Session History sub-tab at ~13419 (count display).

---

### KEEP — Still used by other systems

#### WorkItemService
**DO NOT REMOVE.** Used by: deploy flow (completion handling), backlog view, Settings. Has 30+ references outside the session system. Only the SessionLaunchModal references to WorkItemService should be removed (when R5 is removed).

#### SessionService
**EVALUATE.** Has 11 references. Used by SessionLaunchModal (being removed) and possibly the deploy flow for session tracking. Check each reference:
- If ALL references are in code being removed → safe to remove
- If any reference is in surviving code → keep, or stub out

#### SESSION_RETURN.json handling
**KEEP for now.** The deploy tab detection of SESSION_RETURN.json (~7394, 7592) and the `pendingSessionReturn` state are part of the completion file return flow, not the legacy session system. The references inside SESSION_TYPES (the instructions telling Claude to produce a SESSION_RETURN.json) will be removed with R1, but the deploy tab handling stays.

#### CLAUDE_PREP_DOCS array
**KEEP.** Used by `classifyFileAction()` at ~21123 to route doc files as `push-doc`. This is independent of the session system.

#### `validateSessionReturn()` function
**KEEP but simplify.** Currently checks `SESSION_TYPES[data.sessionType]`. After removing SESSION_TYPES, change to a simple string validation or remove the session type check entirely.

---

## Removal Order

Execute in this order to avoid breaking intermediate states:

**Phase 1: Remove the big self-contained blocks**
1. Remove `SESSION_TYPES` (R1) — lines ~2871-3106
2. Remove `SessionBriefGenerator` (R2) — lines ~3109-3380
3. Remove `generateSessionBrief()` (R3) — line ~21725
4. Remove `CLAUDE_INSTRUCTIONS.md` generator (R4) — lines ~15163-15400
5. Run tests — expect some failures from missing references

**Phase 2: Remove UI components**
6. Remove `SessionLaunchModal` (R5) — lines ~21840-22142
7. Remove `GenerateCLAUDEModal` (R6) — lines ~17831-17918
8. Remove Sessions tab Session Log content (R7) — lines ~13418-13735
9. Remove `SessionHistoryPanel` (R8) — lines ~14584-14650+
10. Run tests — fix any remaining references

**Phase 3: Clean up dangling references**
11. Remove all `showSessionLaunch` / `setShowSessionLaunch` state and renders
12. Remove `showGenerateModal` / `setShowGenerateModal` state and renders
13. Remove "Generate CLAUDE.md" button from Mode 2 (line ~18250)
14. Remove Sessions tab navigation entry (`v === 'session'` route)
15. Update `validateSessionReturn()` to not reference SESSION_TYPES
16. Check `generateClaudeInstructions` references at ~22350 and ~23468 — remove or stub
17. Remove gs-active Firebase upload/download functions (~13178-13280)
18. Remove related state variables: `gsActiveData`, `quickDeployCode`, etc.
19. Remove or stub `SessionService` if no surviving references exist
20. Run tests — all should pass

**Phase 4: Verify**
21. Verify IdeationBriefGenerator still works (it's at ~3386, right after the removed blocks)
22. Verify ExploreInChatModal still works
23. Verify ODRC import flow still works
24. Verify deploy tab file handling still works
25. Verify the Plan dropdown still shows Ideas (Sessions tab may need removal from nav)
26. **Update Playwright tests** — remove or update any tests that reference removed components. Known impacts:
    - Detection Dialog tests may reference modal dialogs that were part of removed flows
    - Any test navigating to Sessions tab content (Session Log, Quick Deploy) needs removal
    - Run full suite and fix all failures before committing

---

## What Stays After Removal

After this cleanup, the session-related code in CC should be:

| Component | Purpose |
|-----------|---------|
| `IdeationBriefGenerator` | Generates briefs for Chat sessions (phase-aware) |
| `ExploreInChatModal` | Outbound flow — prompt + brief + zip |
| `ODRCImportChecklistModal` | Inbound flow — ODRC import with checklist |
| `detectODRCContent()` + utilities | Content detection for inbound files |
| `executeODRCImport()` | Write concepts + session log entry |
| `IdeaManager` with session tracking | Session log, phase, slug |
| `WorkItemService` | Backlog management (independent of sessions) |
| `SESSION_RETURN.json` handling | Deploy tab return manifest processing |
| Sessions tab | **EMPTY** — placeholder for future activity journal redesign |

---

## Sessions Tab After Removal

After removing the legacy content, the Sessions tab will be nearly empty. Options:

**Option A (Recommended):** Replace with a placeholder:
```jsx
<div className="text-center py-20">
  <div className="text-4xl mb-4">📋</div>
  <h2 className="text-xl font-bold mb-2">Activity Journal</h2>
  <p className="text-slate-400">Coming soon — unified timeline of all sessions, specs, and builds.</p>
  <p className="text-slate-500 text-sm mt-2">Use Plan → Ideas to manage ideation sessions.</p>
</div>
```

**Option B:** Remove the Sessions tab from navigation entirely. Add it back when the journal is built.

Use Option A — it tells the developer where to go and signals that the replacement is coming.

---

## Estimated Impact

- **Lines removed:** ~3,000-3,500
- **Lines added:** ~20 (placeholder, stubs, reference cleanup)
- **Net reduction:** ~3,000+ lines
- **Risk:** Low — all removed code is superseded by the ideation pipeline. The primary risk is missing a dangling reference that causes a runtime error.

---

## Architecture Rules

### State Management Rules
- All shared Firebase-backed data lives as top-level state in App component with `global` prefix
- Firebase listeners are set up once in the App component's auth useEffect
- Views own local UI state only
- Write to Firebase via service methods, let listener update state

### Data Flow Rules
- Data flows down via props, events flow up via callbacks
- Service objects are global singletons
- One listener per collection per user

---

## File Structure

```
cc/
  index.html                       ← All changes here (removal)
  specs/
    sp_legacy_session_removal.md   ← This CLAUDE.md archived after completion
```

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Run all Playwright tests — all must pass
2. Manually verify: Plan → Ideas → click an app → click an idea → Explore in Chat still works
3. Verify deploy tab file drop still works (drag an .md file, verify staging)
4. Commit all changes to the repo
5. Archive this CLAUDE.md to `cc/specs/sp_legacy_session_removal.md`
6. Generate a completion file to `.cc/completions/` per the format below
7. Commit the spec archive and completion file together

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_legacy-session-removal.md`

**Completion file format:**

```yaml
---
task: "Remove legacy session system — SESSION_TYPES, SessionBriefGenerator, SessionLaunchModal, GenerateCLAUDEModal, Sessions tab content, SessionHistoryPanel, CLAUDE_INSTRUCTIONS.md generator"
status: complete | partial
cc-spec-id: sp_legacy_session_removal
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{any decisions about what to keep/remove}"
  new_opens:
    - "{any dangling references found}"
unexpected_findings:
  - "{anything unexpected}"
unresolved:
  - "{anything that couldn't be removed safely}"
lines_removed: {N}
lines_added: {N}
---

## Approach

{What was removed in what order, any deviations from the plan}

## What Was Kept and Why

{List anything that was planned for removal but had to stay, with reason}

## Verification

{Test results, manual verification steps taken}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
