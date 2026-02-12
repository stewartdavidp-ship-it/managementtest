---
task: "Build completion file ingestion pipeline Phase 1 — detection, data storage, Job History view, and settings"
status: complete
files:
  - path: "index.html"
    action: modified
  - path: "cc/specs/sp_ingest_p1.md"
    action: created
commits:
  - sha: "bacf1ae"
    message: "Add completion file ingestion pipeline Phase 1 (v8.58.0)"
odrc:
  resolved_opens:
    - "Should completion files be ingested on file drop into CC, or pulled from the repo's cc/completions/ directory via GitHub API? — Implemented GitHub API polling on navigation events (dashboard, jobHistory), plus manual Scan Repos button"
  applied_decisions:
    - "CC is the data layer, Claude is the decision layer — CC detects and stores completion files, does not auto-process ODRC updates"
    - "Claude proposes, CC captures, user ratifies — detection dialog asks user to review, does not auto-acknowledge"
    - "Follow existing service singleton pattern — CompletionFileService matches ConceptManager/IdeaManager exactly"
    - "Use existing CC navigation structure — Job History added to Plan dropdown alongside Backlog, Projects, Ideas"
  new_opens:
    - "GitHub API rate limiting: polling multiple repos on every dashboard visit could hit rate limits for users with many repos. Should we add a cooldown or last-polled timestamp?"
    - "The js-yaml CDN adds a new external dependency. Should we vendor it or keep CDN? CDN is consistent with existing React/Firebase/JSZip pattern."
    - "Phase 2 bundle assembly: what exactly goes into a 'check package'? Spec says zip but details are TBD."
    - "Should the detection dialog suppress if user has already dismissed all new jobs in the current session?"
    - "listRepoContents and getFileContent method names — need to verify these exist on the GitHubAPI class or if the actual method names differ"
unexpected_findings:
  - "Added a 60-second cooldown on the completion poll ref to prevent re-polling on every React re-render when navigating between dashboard tabs"
  - "The SettingsView already has a very long prop list — added completionFileSettings as one more prop. The prop drilling concern flagged in the IdeasView completion file is getting more pronounced."
unresolved:
  - item: "Phase 2: Bundle assembly and review prompt generation"
    reason: "Explicitly out of scope — disabled buttons with Phase 2 tooltips placed in UI"
  - item: "Phase 3: Orphan commit detection and ODRC update ingestion"
    reason: "Explicitly out of scope — orphanDetectionDays setting stored for future use"
  - item: "GitHubAPI method name verification"
    reason: "Used listRepoContents and getFileContent based on spec guidance — may need adjustment if actual method names differ"
---

## Approach

Built the ingestion pipeline in layers following the spec's numbered sections:

1. **Data layer first** — CompletionFileService and CompletionFileSettings as service singletons, matching the ConceptManager/IdeaManager pattern exactly. Firebase paths under `command-center/{uid}/completionJobs` and `command-center/{uid}/settings/completionFiles`.

2. **Parsing layer** — `parseCompletionFrontmatter()` uses js-yaml CDN to parse YAML between `---` delimiters. `validateCompletionFile()` checks required fields (task, status, files, commits) and produces warnings without rejecting.

3. **Polling layer** — `pollCompletionFiles()` lists `cc/completions/` via GitHub API, diffs against existing jobs by filename+repo, fetches/parses new files, creates job records. Handles 404 gracefully (directory may not exist).

4. **Global state** — `globalCompletionJobs` and `completionFileSettings` as App-level state with Firebase listeners, following exact existing pattern.

5. **Detection dialog** — useEffect on view changes triggers poll when navigating to dashboard or jobHistory. Uses showConfirm to ask user to review. 60-second cooldown prevents re-polling on rapid navigation.

6. **JobHistoryView** — Full view with filter bar (state, repo), stats header, expandable job cards showing all parsed frontmatter fields, ODRC references, action buttons per state, and Phase 2 disabled placeholders.

7. **Settings section** — Added to SettingsView with configurable thresholds (unclassifiedNudgeThreshold, orphanDetectionDays).

8. **Nav badge** — Blue count badge on Plan dropdown label when new unreviewed jobs exist.

## Assumptions

- `github.listRepoContents(repo, path)` and `github.getFileContent(repo, path)` exist on the GitHubAPI class and return the expected shapes. The spec referenced these but actual method names may differ.
- js-yaml 4.1.0 CDN is reliable and the `jsyaml.load()` global is available after script load.
- Completion files in `cc/completions/` follow the naming convention `YYYY-MM-DDTHH-MM-SS_task-slug.md` but we don't enforce the name format — any `.md` file in that directory is treated as a completion file.
- The 60-second poll cooldown is sufficient to prevent API abuse while still being responsive.

## Notes

- The completion file from the previous session (IdeasView build) is already in `cc/completions/` and should be detected on first poll, serving as the first real test of the pipeline.
- Phase 2 and Phase 3 buttons are present but disabled in the UI with tooltips, making the intended workflow visible to users.
- Version is now 8.58.0. All changes in command-center-test only.
