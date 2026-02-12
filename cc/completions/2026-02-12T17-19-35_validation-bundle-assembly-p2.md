---
task: "Build validation bundle assembly pipeline Phase 2 — ClaudeAPIService, ODRC summary generator, review prompt generator, bundle assembler, Package for Check, and Mark as Checked"
status: complete
files:
  - path: "index.html"
    action: modified
  - path: "cc/specs/sp_ingest_p2.md"
    action: created
commits:
  - sha: "356c921"
    message: "Add validation bundle assembly pipeline Phase 2 (v8.59.0)"
  - sha: "543ffec"
    message: "Archive Phase 2 spec and generate completion file"
odrc:
  resolved_opens:
    - "Phase 2 bundle assembly: what exactly goes into a 'check package'? — Implemented as zip containing completion file, spec, changed code files, ODRC summary, AI-generated review prompt, and manifest"
  applied_decisions:
    - "CC is the data layer, Claude is the decision layer — bundle assembly packages context for Chat validation, CC does not auto-validate"
    - "Claude proposes, CC captures, user ratifies — review prompt is generated but user controls when/if to use it in Chat"
    - "Follow existing service singleton pattern — ClaudeAPIService, ODRCSummaryGenerator, ReviewPromptGenerator, ValidationBundleAssembler all match ConceptManager/IdeaManager exactly"
  new_opens:
    - "Phase 3 ODRC update ingestion: review prompt instructs Chat to output structured ODRC recommendations, but CC doesn't parse them yet"
    - "Bundle size limit UX: current implementation auto-excludes files over limit with manifest notes. Should there be an interactive file selector before assembly starts?"
    - "ClaudeAPIService uses anthropic-dangerous-direct-browser-access header for browser-based API calls — is this the long-term pattern or should calls go through Firebase Functions?"
    - "Review prompt quality: using claude-haiku-4-5-20251001 for cost efficiency. Should there be a model selector in settings for users who want higher quality prompts?"
unexpected_findings:
  - "The ValidationBundleAssembler progress callback uses React state updates during async operations — needed careful closure handling to avoid stale state in setBundleModal"
  - "The unclassified nudge banner's Phase 2 button was renamed to Phase 3 since batch classification packaging is explicitly Phase 3 scope"
unresolved:
  - item: "Phase 3: ODRC update ingestion from Chat structured output"
    reason: "Explicitly out of scope — review prompts generate structured output format but CC doesn't parse it yet"
  - item: "Phase 3: Orphan commit detection"
    reason: "Explicitly out of scope — orphanDetectionDays setting stored from Phase 1"
  - item: "Phase 3: Batch classification packaging"
    reason: "Explicitly out of scope — nudge banner button disabled with Phase 3 tooltip"
  - item: "Bundle size interactive selector"
    reason: "Spec Section 7 describes interactive include/exclude UI — implemented auto-exclusion with manifest notes as simpler first pass"
---

## Approach

Built the Phase 2 pipeline in layers following the spec's numbered sections:

1. **ClaudeAPIService** — Singleton object for browser-based Anthropic API calls. Uses `localStorage.getItem('cc_api_key')` for authentication and the `anthropic-dangerous-direct-browser-access` header. Placed after EngineRegistryService in the file.

2. **ODRCSummaryGenerator** — Generates markdown summaries of ODRC concept state. Two modes: `generateScoped()` filters concepts by specId in scopeTags for planned work, `generateFull()` renders all active concepts for unplanned work. Follows the CLAUDE.md rendering pattern from IdeasView.

3. **ReviewPromptGenerator** — Two prompt modes via ClaudeAPIService: `generateReviewPrompt()` for planned work (checks correctness, rule compliance, side effects, ODRC alignment) and `generateClassificationPrompt()` for unplanned work (match to OPENs, categorize work type, suggest new OPENs).

4. **ValidationBundleAssembler** — Orchestrates 7-step zip assembly with JSZip: fetch completion file, fetch spec archive, fetch changed code files (with size limit management), generate ODRC summary, generate review prompt via Claude API, create manifest, build zip. Progress callback drives the modal UI. Fallbacks for API failures (static prompt templates) and repo fetch failures (cached data reconstruction).

5. **JobHistoryView updates** — Replaced disabled Phase 2 buttons with functional "Package for Check" button. Added Bundle Assembly Modal with step-by-step progress indicators (pending/active/done/error states). Added "Mark as Checked" inline form with outcome dropdown (confirmed/challenged/escalated) and notes textarea. Updated props to accept globalConcepts, globalIdeas, showPrompt.

6. **State transitions** — Package for Check moves new/acknowledged jobs to reviewed. Mark as Checked moves reviewed jobs to checked with outcome and notes stored via CompletionFileService.updateCheckOutcome().

## Assumptions

- `github.getFileContent(repo, path)` returns `{ textContent }` shape — verified against existing usage in the codebase.
- JSZip is already loaded via CDN (confirmed at line ~18 of index.html) and available as global `JSZip`.
- The `anthropic-dangerous-direct-browser-access` header is the correct pattern for browser-based Anthropic API calls.
- Bundle size limit defaults to 5MB from CompletionFileSettings. Auto-exclusion is sufficient for Phase 2; interactive selector deferred.
- Claude Haiku 4.5 (claude-haiku-4-5-20251001) is appropriate for review/classification prompt generation.

## Notes

- The Bundle Assembly Modal uses React state for progress tracking, with the progress callback updating step statuses via `setBundleModal` setter.
- Errors during assembly don't abort — the assembler continues with fallbacks (static prompts, cached data) and logs all issues in the manifest.
- The "Mark as Checked" flow is inline in the expanded job card rather than a separate modal, keeping the interaction lightweight.
- Version is now 8.59.0. All changes in command-center-test only.
