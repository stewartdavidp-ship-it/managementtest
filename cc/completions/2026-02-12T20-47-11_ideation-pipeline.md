---
task: "Implement Ideation Workflow: Idea-to-Chat Pipeline — data model extensions, outbound brief generation, phase computation, and UI enhancements (Phases 1+2+4p)"
task_type: feature
status: partial
tracking:
  type: feature
  source_spec: sp_ideation_pipeline
  priority: high
cc-spec-id: sp_ideation_pipeline
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "9383d39"
    message: "Add Idea-to-Chat Pipeline — Phases 1+2+4p (v8.61.0)"
tests:
  framework: playwright
  passed: 34
  failed: 0
  skipped: 0
  note: "All existing tests pass — no regressions from new code"
odrc:
  new_decisions:
    - "IdeationBriefGenerator falls back to template-based brief when ClaudeAPIService is unavailable, ensuring the feature works without API keys"
    - "Session history in Idea Detail is collapsible to avoid cluttering the view for ideas with many sessions"
    - "Phase badge shows computed phase with mismatch indicator when manual override differs from computed value"
    - "Stale indicator (>14 days) only shows when the idea has active OPENs, not for converging/spec-ready ideas"
    - "Explore in Chat button only visible for active ideas (not archived/graduated)"
  resolved_opens:
    - "Session ID format confirmed as S-YYYY-MM-DD-NNN via generateSessionId() utility function"
  new_opens:
    - "Phase 3 (inbound return path) still needs implementation — deploy tab ODRC detection, editable confirmation checklist, dual-track file handling"
    - "ExploreInChatModal 'include codebase' checkbox is present but zip packaging of index.html is not yet implemented"
    - "Slug uniqueness check queries all ideas for an app on every create — may need optimization for apps with many ideas"
unexpected_findings:
  - "IdeaManager.create() needed async slug generation (via _uniqueSlug) which queries Firebase for existing ideas — this makes create() slightly slower but ensures uniqueness"
  - "React hooks cannot be used inside IIFEs in JSX — session history expanded state had to be lifted to IdeasView component level"
unresolved:
  - item: "Phase 3: Inbound return path (ODRC detection, checklist modal, dual-track routing)"
    reason: "Deferred to session 2 per scope split — this is the most complex interaction pattern and needs deploy tab integration tracing"
  - item: "Codebase inclusion in zip"
    reason: "The checkbox is present in ExploreInChatModal but actual index.html packaging is deferred — need to handle the 24k+ line file size concern"
---

## Approach

Split the 4-phase spec into two sessions. This session covers Phases 1+2 plus partial Phase 4:

**Phase 1 (Data Model):** Extended IdeaManager with slug auto-generation (kebab-case, unique within app scope), sessionLog array, lastSessionDate, and phase field. Added `generateSlug()`, `_uniqueSlug()`, and `addSessionLogEntry()` methods. Extended `update()` allowlist to include `slug` and `phase`. Added standalone `computeIdeaPhase()` utility and `generateSessionId()` utility.

**Phase 2 (Outbound Brief):** Built `IdeationBriefGenerator` service object with AI-powered brief generation via ClaudeAPIService (claude-sonnet-4-20250514) plus template fallback. Built `ExploreInChatModal` with brief preview, package contents display, Copy Prompt/Copy Brief/Download Zip/Push to Repo actions. Size-aware output: small briefs get Copy to Clipboard as primary, large briefs get zip download. Zip includes brief + previous session ODRC output when available.

**Phase 4 partial (UI):** Added phase badges (exploring=blue, converging=amber, spec-ready=green) to Idea Detail header and Idea History chain in Mode 2. Added session history collapsible section with session ID, date, summary, and concept counts. Added stale session indicator (>14 days with active OPENs). Added slug display in idea detail header.

## Implementation Notes

- `IdeationBriefGenerator` placed in END DATA SERVICE LAYER section alongside other service objects
- `ExploreInChatModal` defined as a const arrow function inside IdeasView (same pattern as other modals)
- Template fallback brief includes session history table, ODRC state, and expected output format — ensures the feature is usable even without Anthropic API key
- Phase computation: spec-ready when no OPENs or (≤2 OPENs + ≥10 DECISIONs), converging when decisions ≥ opens with rules/constraints present, exploring otherwise
- 532 lines added, ~530 net new (matching the spec's 400-700 estimate)
