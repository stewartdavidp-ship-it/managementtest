---
task: "Build ingestion pipeline Phase 3 — orphan commit detection, ODRC update ingestion from Chat, and batch classification packaging"
status: complete
files:
  - path: "index.html"
    action: modified
  - path: "cc/specs/sp_ingest_p3.md"
    action: created
commits:
  - sha: "cd322e1"
    message: "Add orphan detection, ODRC ingestion, batch classification Phase 3 (v8.60.0)"
  - sha: "dfae156"
    message: "Archive Phase 3 spec and generate completion file"
odrc:
  resolved_opens:
    - "Phase 3: Orphan commit detection — Implemented OrphanDetectionService, pollOrphanCommits, reconstruction package generation, orphan auto-matching on completion file ingestion"
    - "Phase 3: ODRC update ingestion from Chat structured output — Implemented ODRCUpdateIngestionService with parser and executor, ODRC Update Modal with input/review/done phases"
    - "Phase 3: Batch classification packaging — Implemented batch classification flow with job selector, zip assembly, generateBatchClassificationPrompt"
  applied_decisions:
    - "CC is the data layer, Claude is the decision layer — ODRC updates from Chat go through confirmation checklist, no auto-applying"
    - "Claude proposes, CC captures, user ratifies — parsed ODRC updates presented as checkboxes, user selects which to apply"
    - "Follow existing service singleton pattern — OrphanDetectionService and ODRCUpdateIngestionService match CompletionFileService exactly"
  new_opens:
    - "Orphan commit rate limiting: polling 30 commits + detail fetch per commit could hit GitHub API rate limits for repos with frequent commits. Should we add commit-level caching?"
    - "ODRC parser error tolerance: the parser handles common variations (arrow styles, quotes), but Chat output may have more diverse formats. Should we add a 'manual entry' fallback for unparseable lines?"
    - "Reconstruction task delivery: currently clipboard-only. Should we add repo push to cc/tasks/ so Code can pick it up automatically?"
    - "Batch classification size: no limit on number of jobs in a batch. For large batches, the Claude API call may exceed token limits. Should we add batching within batches?"
unexpected_findings:
  - "The pollCompletionFiles signature changed to accept existingOrphans parameter for auto-matching, which is a breaking change for any callers. Updated all call sites (App polling useEffect + JobHistoryView manual poll)."
  - "The orphan detection filter skips commits where ALL files are under cc/ directory — this prevents self-referential detection of completion files and specs as orphans."
  - "SHA matching between completion files and orphan commits uses prefix matching (startsWith) to handle abbreviated vs full SHAs."
unresolved:
  - item: "Job queue / multi-phase sequencing"
    reason: "Future feature — not part of ingestion pipeline phases"
  - item: "Bundle split into multiple zips"
    reason: "Deferred — exclusion-only approach sufficient"
  - item: "Real-time Chat integration"
    reason: "All Chat interaction remains manual (upload zip, paste results back)"
---

## Approach

Built the Phase 3 pipeline completing the full ingestion loop, following the spec's numbered sections:

1. **OrphanDetectionService** — Firebase CRUD singleton at `command-center/{uid}/orphanCommits`. State machine: detected → dismissed/reconstructed/ignored. Follows CompletionFileService pattern exactly.

2. **ODRCUpdateIngestionService** — Parser for Chat's structured ODRC output format. Tolerant of format variations: handles →/->/==> arrows, with/without quotes, case-insensitive type matching. Executor resolves OPENs via ConceptManager.resolve() and creates new concepts via ConceptManager.create() with optional idea tagging.

3. **GitHubAPI extensions** — Added `listRecentCommits(repo, perPage)` and `getCommitDetail(repo, sha)` to the existing GitHubAPI class.

4. **pollOrphanCommits** — Standalone async function that: fetches 30 recent commits, filters by detection window (orphanDetectionDays setting), skips merge commits and cc/-only commits, cross-references against known completion file SHAs, creates orphan records for unmatched commits.

5. **pollCompletionFiles extension** — Extended with existingOrphans parameter. After ingesting a new completion file, checks if its commit SHAs match any orphan records and auto-marks them as "reconstructed".

6. **generateOrphanReconstructionPackage** — Generates a markdown task document that can be given to a Claude Code session to reconstruct completion files for orphaned commits. Copies to clipboard with download fallback.

7. **ReviewPromptGenerator.generateBatchClassificationPrompt** — New method for batch classification of multiple unclassified jobs. Uses higher token budget (8192) for batch analysis.

8. **App component updates** — Added globalOrphanCommits state, OrphanDetectionService.listen(), signout cleanup, orphan polling in the navigation-triggered useEffect alongside completion file polling.

9. **JobHistoryView updates** — Added orphan section (collapsible, with cards and action buttons), functional "Classify Batch" nudge banner, "Import ODRC Updates" button on reviewed/checked jobs, ODRC Update Modal (3-phase: input → review checklist → results), Batch Classification Modal (3-phase: select → assembling → done).

## Assumptions

- `github.listRecentCommits()` returns GitHub's standard commit list format with `.sha`, `.commit.author.date`, `.commit.message`, `.parents[]`.
- `github.getCommitDetail()` returns a commit object with `.files[]` containing `{ filename, status }`.
- The ODRC Update format output by Chat follows the pattern from the review prompt templates (may need parser tuning as real Chat output patterns emerge).
- ConceptManager.resolve() marks a concept as resolved without needing a resolvedBy reference.
- 30 commits per poll is sufficient to cover the orphan detection window.

## Notes

- The full ingestion loop is now operational: Code → CC detection → bundle assembly → Chat validation → ODRC ingestion back to CC.
- Orphan commits auto-clear when Code produces reconstruction completion files — the SHA matching happens during normal polling.
- Version is now 8.60.0. All changes in command-center-test only.
- The ODRC Update Modal's idea tag selector pre-populates from globalIdeas for create actions, allowing user to override Chat's suggested tagging.
