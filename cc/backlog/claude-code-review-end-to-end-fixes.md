# End-to-End Transition Fixes

**Source:** Deep review of CC <-> Claude Chat and CC <-> Claude Code handoffs (v8.70.4)
**Created:** 2026-02-16

---

## P0 — Silent Data Loss / Confusion

### 1. Silent ODRC Drop on Parse Failure
- **Problem:** Non-standard ODRC format lines are silently ignored during import. No error, no warning. User thinks import succeeded but concepts were lost.
- **Fix:** Add fuzzy ODRC parsing with user confirmation. If parser finds lines that almost match (wrong delimiter, missing dash), show them in a "couldn't parse these — did you mean?" section in the import modal.

### 2. Zero Parsed Items = Silent Nothing
- **Problem:** If the ODRC parser finds 0 valid lines, no banner appears, no modal opens. The drop just does nothing.
- **Fix:** Always show feedback on drop. Even if 0 items parsed, show a toast: "Dropped file processed but no ODRC updates detected. Expected format: `ADD RULE - content here`"

### 3. Post-Task Obligations Path Mismatch
- **Problem:** Post-Task Obligations template references `.cc/completions/` (leading dot) but CC polling code checks `cc/completions/` (no dot). Completion files go to wrong path.
- **Fix:** Standardize on `cc/completions/` everywhere (both the Post-Task Obligations template and the polling code).

### 4. Completion Polling Only on Navigation
- **Problem:** Completion file detection only runs when user navigates to dashboard or jobHistory views. No background polling. User misses finished work.
- **Fix:** Add background polling — poll `cc/completions/` every 60 seconds (or configurable) regardless of active view. Show toast notification when new completions detected.

---

## P1 — Workflow Friction

### 5. Separate Context Package + Brief Downloads
- **Problem:** User downloads a brief ZIP, then separately may want a context package. Two downloads for one session setup.
- **Fix:** Merge into one combined ZIP when both are needed: `SESSION_BRIEF.md`, `CONTEXT_PACKAGE.md`, ODRC snapshots, relevant app config.

### 6. No Return-Path Instructions in Session Brief
- **Problem:** Brief tells Claude Chat what to explore but doesn't include return-path instructions (how to format ODRC updates, how to package session output for CC import).
- **Fix:** Append a section telling Claude Chat: "When this session is complete, output a session package with: `session.json`, `ODRC_UPDATES.md` (using `## ODRC Updates` header format), and any artifact files."

### 7. `includeCodebase` Checkbox is Cosmetic
- **Problem:** ExploreInChatModal renders an `includeCodebase` checkbox with no code path. Toggling does nothing. Misleading UI.
- **Fix:** Either implement it (include relevant files in the ZIP) or remove it.

### 8. Pending Import Lost on Refresh
- **Problem:** ODRC import state is React-only. Page refresh before clicking "Import" loses everything.
- **Fix:** Persist pending imports to `sessionStorage`.

---

## P2 — Nice to Have

### 9. Artifact File Routing
- **Problem:** Session package artifact files (non-JSON, non-debrief `.md`) are listed in UI but have no save/route/copy action. Display-only.
- **Fix:** Offer actions: "Save to idea as attachment", "Push to repo", "Copy to clipboard".

### 10. Hybrid ZIP Handling
- **Problem:** ZIP classification is binary: session package (has `session.json`) OR deploy archive. No hybrid.
- **Fix:** If a ZIP contains both `session.json` AND deployable files, process both: session import + deploy queue.

### 11. Import Queue
- **Problem:** Only one pending import at a time. Dropping a second file before processing overwrites the first.
- **Fix:** Allow stacking/queuing multiple pending imports.

### 12. Checker Return Path
- **Problem:** CC can initiate maker/checker but no structured way for checker results to return.
- **Fix:** Define a `CHECKER_RESULT.json` format with pass/fail, issues found, recommended fixes.

### 13. Auto-Match Orphans
- **Problem:** Orphan completion files require full manual round-trip to resolve.
- **Fix:** Fuzzy-match orphans to recent jobs by repo name, file paths, or timestamp proximity before requiring manual resolution.

### 14. Completion File Validation
- **Problem:** Malformed completion files (bad YAML, wrong fields) may silently fail or show partial data.
- **Fix:** Show malformed files in a "needs attention" section with parse error details.

### 15. Include Completion Template in CLAUDE.md
- **Problem:** Claude Code is expected to write completion files in a specific format, but template isn't in pushed CLAUDE.md.
- **Fix:** Append "When you're done" section to generated CLAUDE.md with expected completion file format and path.
