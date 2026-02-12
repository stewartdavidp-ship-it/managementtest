# CLAUDE.md — CC Completion File Ingestion Pipeline (Phase 1 of 3)
# cc-spec-id: sp_ingest_p1
# App: Command Center (index.html)
# Base version: 8.57.0
# Target version: 8.58.0

---

## Task Summary

Build the completion file detection, ingestion, and Job History infrastructure into Command Center. This is Phase 1 of the ingestion pipeline — focused on detection, data storage, and the Job History view. Phase 2 (bundle assembly) and Phase 3 (orphan detection, ODRC update ingestion) depend on this work.

---

## What to Build

### 1. CompletionFileService (Data Service Layer)

**Location:** Place between the existing service objects (after `IdeaManager`, before `MAIN APP`) following the established service singleton pattern.

**Firebase path:** `command-center/{uid}/completionJobs`

**Schema per job record:**
```javascript
{
  id: string,              // Firebase push key
  repoFullName: string,    // e.g. "stewartdavidp-ship-it/gameshelf"
  fileName: string,        // e.g. "2026-02-12T14-30-00_fix-shared-files.md"
  detectedAt: string,      // ISO timestamp when CC first saw the file
  state: string,           // "new" | "acknowledged" | "reviewed" | "checked"
  validationStatus: string, // "pass" | "warning"
  validationErrors: [],     // Array of strings if warning
  classified: boolean,      // true if spec-id present or manually classified
  specId: string | null,    // cc-spec-id from the completion file, if present
  // Parsed frontmatter (cached from repo file)
  task: string,
  status: string,           // "complete" | "partial" | "blocked"
  files: [],                // Array of { path, action }
  commits: [],              // Array of { sha, message }
  odrc: object | null,      // ODRC section if present
  unexpectedFindings: [],   // Array of strings
  unresolved: [],           // Array of { item, reason }
  // Check outcome (populated when state = "checked")
  checkOutcome: string | null,  // "confirmed" | "challenged" | "escalated"
  checkNotes: string | null
}
```

**Methods to implement:**
```
_ref(uid)                              → Firebase ref
create(uid, jobData)                   → Create new job record
getAll(uid)                            → Get all jobs
getByRepo(uid, repoFullName)           → Filter by repo
getByState(uid, state)                 → Filter by state
updateState(uid, jobId, newState)      → Transition state
updateCheckOutcome(uid, jobId, outcome, notes) → Record validation result
listen(uid, callback)                  → Real-time listener (return unsubscribe)
```

**Follow the ConceptManager pattern exactly:** `_ref()`, `create()`, `listen()` with `ref.on('value', handler)` returning cleanup function.

### 2. CompletionFileSettings (Settings Extension)

**Firebase path:** `command-center/{uid}/settings/completionFiles`

**Settings schema:**
```javascript
{
  unclassifiedNudgeThreshold: 5,   // Number before nudge
  orphanNudgeThreshold: 5,         // Number before nudge (future use, store now)
  bundleSizeLimit: 5242880,        // 5MB in bytes (future use, store now)
  orphanDetectionDays: 14          // Lookback window (future use, store now)
}
```

**Service methods:**
```
getDefaults()                       → Return default settings object
load(uid)                           → Read from Firebase, merge with defaults
save(uid, settings)                 → Write to Firebase
listen(uid, callback)               → Real-time listener
```

Add a "Completion Files" section to the existing SettingsView component with inputs for the configurable values. Follow the existing SettingsView pattern — labeled inputs with descriptions.

### 3. GitHub Polling for Completion Files

**Add to GitHubAPI class:**
```
listCompletionFiles(repo)           → List contents of cc/completions/ directory
getCompletionFileContent(repo, path) → Read and return file content
```

These are thin wrappers around existing `listRepoContents()` and `getFileContent()`.

**Add a polling function** (standalone, not in GitHubAPI class):
```javascript
async function pollCompletionFiles(github, repoFullName, uid, existingJobs) {
  // 1. List cc/completions/ via GitHub API
  // 2. Compare filenames against existingJobs (by fileName + repoFullName)
  // 3. For each new file:
  //    a. Fetch content
  //    b. Parse YAML frontmatter
  //    c. Validate required fields (task, status, files, commits)
  //    d. Create job record via CompletionFileService
  // 4. Return array of newly detected jobs
}
```

**YAML parsing:** Use a simple frontmatter parser. The file format is `---\n{yaml}\n---\n{body}`. Split on `---` delimiters, parse the YAML block. For YAML parsing, use a minimal approach — the frontmatter uses simple key-value pairs, arrays, and nested objects. Implement a lightweight parser or use `js-yaml` from CDN (`https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js`).

**Validation logic:** Check that these fields exist and have correct types:
- `task` — string, non-empty
- `status` — string, one of: "complete", "partial", "blocked"
- `files` — array, each item has `path` (string) and `action` (string)
- `commits` — array, each item has `sha` (string) and `message` (string)

If validation fails, set `validationStatus: "warning"` and populate `validationErrors` array. Still create the job — never reject.

### 4. Detection Dialog

**Trigger:** Poll on user-active moments. Specifically:
- When App component mounts (initial load)
- When user navigates to Dashboard view
- When user navigates to Job History view (the new view)

Poll each configured repo that has a GitHub connection. Use the apps array from config to determine which repos to check.

**Dialog UI:** Reuse the existing `dialog` state pattern in App component (`setDialog`). When new completion files are detected, show a dialog:

```
Title: "New Completed Work Detected"
Message: "Found {N} new completion file(s) in {repoName}"
```

**Three action buttons:**
- **Dismiss** → Set all detected jobs to state "acknowledged"
- **Review** → Set jobs to state "reviewed", navigate to Job History view
- **Package for Check** → (Phase 2 — for now, show as disabled button with tooltip "Coming in Phase 2")

If multiple repos have new files, show one dialog per repo, or combine into a single dialog listing all repos. Developer judgment on what feels cleaner — single combined dialog is likely better.

### 5. Job History View

**New view:** `jobHistory` — add to nav under the "Plan" dropdown alongside backlog, projects, and ideas.

**Nav update:**
```javascript
{ id: 'plan', icon: '📋', label: 'Plan', views: ['backlog', 'projects', 'ideas', 'jobHistory'] }
```

**Display name in nav dropdown:** "Job History"

**Global state:** Add to App component following the existing pattern:
```javascript
const [globalCompletionJobs, setGlobalCompletionJobs] = React.useState([]);
```

Add listener in the auth useEffect block:
```javascript
unsubscribeCompletionJobs = CompletionFileService.listen(u.uid, setGlobalCompletionJobs);
```

Add cleanup in the return function and clear on sign-out.

**Pass as props** to JobHistoryView and DashboardView (for badge count display).

**JobHistoryView component props:**
```
globalCompletionJobs, firebaseUid, github, apps, showAlert, showConfirm, config
```

**View layout:**

**Header area:**
- Title: "📦 Job History" with subtitle "Completion files from Claude Code sessions"
- Summary stats: Total jobs, by state counts, unclassified count
- Filter controls: filter by state (All, New, Acknowledged, Reviewed, Checked), filter by repo

**Job list:** Table or card layout (cards preferred, matching existing CC patterns). Each card shows:
- Task description (from frontmatter `task` field)
- Repo name
- State badge (color-coded: New=blue, Acknowledged=slate, Reviewed=amber, Checked=green)
- Validation status indicator (⚠️ if warning)
- Classified/Unclassified indicator
- File count and commit count
- Detection date
- Status from frontmatter (complete/partial/blocked)

**Card actions (context-appropriate by state):**
| State | Actions |
|-------|---------|
| New | Review, Dismiss |
| Acknowledged | Review, Package for Check (disabled Phase 2) |
| Reviewed | Package for Check (disabled Phase 2) |
| Checked | View Details (read-only) |

**Review action:** Opens an expandable detail panel or modal showing:
- Full task description
- Files changed (path + action)
- Commits (SHA + message)
- ODRC references if present
- Unexpected findings
- Unresolved items
- Body content (approach, assumptions, notes) if present
- Sets state to "reviewed"

**Unclassified nudge:** If unclassified job count >= threshold from settings, show a banner at the top of Job History:
"You have {N} unclassified jobs. Package them for classification?" with a button. Button is disabled for Phase 2 with tooltip.

**Empty state:** "No completion files detected yet. When Claude Code produces completion files in cc/completions/, they'll appear here."

### 6. Dashboard Badge

On the Dashboard view, add a small notification indicator if there are jobs in "new" state. This can be a badge on the Plan nav dropdown or a small card in the dashboard. Keep it subtle — a count badge like "3 new" next to the Plan dropdown label is sufficient.

---

## Architecture Rules

Follow these rules from the CC ODRC. Violations will be flagged during validation.

### State Management Rules
- All shared Firebase-backed data lives as top-level state in App component with `global` prefix
- Firebase listeners are set up once in the App component's auth useEffect. Views never create their own listeners for shared data
- Views own local UI state only — filters, modal open/close, form inputs, selected items
- Write to Firebase via service methods, let listener update state. No optimistic UI updates

### Data Flow Rules
- Data flows down via props, events flow up via callbacks
- Service objects are global singletons callable from any component
- One listener per collection per user
- Listener callbacks only call the state setter — no side effects, no cascading writes
- All listener useEffect blocks must return a cleanup function

---

## File Structure

This is a single-file React app. All code goes in `index.html`. Place new sections in this order:

1. **CompletionFileService** — after IdeaManager (line ~5017), before MAIN APP
2. **CompletionFileSettings** — immediately after CompletionFileService
3. **GitHub polling function** — after CompletionFileSettings
4. **JobHistoryView component** — after IdeasView (line ~16700 area), before Release Coordination View
5. **Settings additions** — extend existing SettingsView
6. **App component changes** — new state, listener, dialog trigger, nav update, view routing

---

## Existing Patterns to Follow

- **Service singleton:** See `ConceptManager` (line ~4827) and `IdeaManager` (line ~5030) for the exact pattern
- **Firebase listener:** See `ConceptManager.listen()` (line ~5008) — `ref.on('value', handler)` returning `() => ref.off('value', handler)`
- **Auth useEffect listeners:** See line ~5537 for how all listeners are set up and cleaned up
- **Dialog pattern:** See `showAlert`, `showConfirm`, `showPrompt` (line ~5356) for the dialog state pattern
- **Nav structure:** See line ~7647 for the dropdown nav sections
- **View routing:** See line ~7914 for how views are conditionally rendered
- **GitHub API methods:** See `GitHubAPI` class (line ~4325) — `listRepoContents()` and `getFileContent()` for the patterns to follow
- **Card-based views:** See BacklogView or IdeasView for card layout patterns

---

## CDN Dependency

Add js-yaml to the `<head>` section, after the existing CDN scripts:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></script>
```

---

## What NOT to Build

- **Bundle assembly (zip creation)** — Phase 2
- **Review prompt generation (API call)** — Phase 2
- **Spec archival to cc/specs/** — Phase 2
- **Orphan commit detection** — Phase 3
- **ODRC update ingestion from Chat** — Phase 3
- **Batch classification packaging** — Phase 3
- **Job queue / multi-phase sequencing** — Future feature

For features deferred to Phase 2 or 3, include disabled buttons with tooltips indicating "Coming in Phase 2/3" so the UI communicates the intended workflow.

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_ingest_p1.md`
3. Generate a completion file to `cc/completions/` per the CC Completion File Spec:
   - File format: Markdown with YAML frontmatter
   - Naming: `YYYY-MM-DDTHH-MM-SS_task-slug.md` (UTC timestamp, kebab-case slug)
   - Required fields: task, status, files, commits
   - Include contextual fields (odrc, unexpected_findings, unresolved) when applicable
   - Include narrative body (approach, assumptions, notes)
4. Commit the spec archive and completion file together in a separate commit after code commits

Do not wait for the developer to ask. Produce the completion file automatically.

---

## Completion File Spec Reference

See CC-Completion-File-Spec.md for the full schema. Key points:
- One file per task
- YAML frontmatter with `---` delimiters
- Required: task (string), status (enum), files (list), commits (list)
- Contextual: odrc, unexpected_findings, unresolved
- Body: free-form markdown (approach, assumptions, notes)
