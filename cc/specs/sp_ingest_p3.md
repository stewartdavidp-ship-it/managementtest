# CLAUDE.md — CC Completion File Ingestion Pipeline (Phase 3 of 3)
# cc-spec-id: sp_ingest_p3
# App: Command Center (index.html)
# Base version: 8.59.0
# Target version: 8.60.0
# Depends on: Phase 1 (sp_ingest_p1) — CompletionFileService, Job History, polling
# Depends on: Phase 2 (sp_ingest_p2) — ValidationBundleAssembler, ClaudeAPIService, ODRCSummaryGenerator

---

## Task Summary

Build the remaining ingestion pipeline features: orphan commit detection with Code-based reconstruction, ODRC update ingestion from Chat's structured output, and batch classification packaging for unplanned work. This completes the ingestion pipeline — after this phase, the full loop from Code output → CC detection → bundle assembly → Chat validation → ODRC updates is functional.

---

## What to Build

### 1. Orphan Commit Detection

**Purpose:** When Code fails to produce a completion file (session crash, developer abort, instruction drift), CC detects commits that don't appear in any completion file and offers recovery options.

**Add `OrphanDetectionService` as a singleton object.** Place after ValidationBundleAssembler, before MAIN APP.

**Firebase path:** `command-center/{uid}/orphanCommits`

**Schema per orphan record:**
```javascript
{
  id: string,              // Firebase push key
  repoFullName: string,    // e.g. "stewartdavidp-ship-it/command-center-test"
  commitSha: string,       // Full commit SHA
  commitMessage: string,   // Commit message
  commitDate: string,      // ISO timestamp of the commit
  filesChanged: [],        // Array of { path, status } from the commit
  detectedAt: string,      // ISO timestamp when CC detected the orphan
  state: string            // "detected" | "dismissed" | "reconstructed" | "ignored"
}
```

**Methods:**
```
_ref(uid)                              → Firebase ref
create(uid, orphanData)                → Create orphan record
getAll(uid)                            → Get all orphans
getByRepo(uid, repoFullName)           → Filter by repo
updateState(uid, orphanId, newState)   → Transition state
listen(uid, callback)                  → Real-time listener (return unsubscribe)
```

**Detection logic — add to the existing polling flow:**

Extend the polling that runs on user-active moments (dashboard/jobHistory navigation). After checking `cc/completions/`, also check recent commits:

```javascript
async function pollOrphanCommits(github, repoFullName, uid, existingJobs, existingOrphans, settings) {
    // 1. Fetch recent commits via GitHub API
    //    GET /repos/{owner}/{repo}/commits?per_page=30
    //    (GitHub API: github.request(`/repos/${owner}/${repo}/commits?per_page=30`))
    //
    // 2. Apply filters:
    //    - Only commits within the orphan detection window (settings.orphanDetectionDays, default 14)
    //    - Ignore merge commits (commit.parents.length > 1)
    //    - Ignore commits where ALL changed files are under cc/ directory
    //    - Ignore commits already tracked as orphans (by SHA match)
    //
    // 3. Build a set of all commit SHAs referenced in completion files
    //    (existingJobs.flatMap(j => j.commits.map(c => c.sha)))
    //
    // 4. Any commit not in that set AND not already an orphan record = new orphan
    //
    // 5. For each new orphan, fetch commit details to get files changed:
    //    GET /repos/{owner}/{repo}/commits/{sha}
    //    Extract files array: commit.files.map(f => ({ path: f.filename, status: f.status }))
    //
    // 6. Create orphan records via OrphanDetectionService
    //
    // 7. Return array of newly detected orphans
}
```

**Add `listRecentCommits` to GitHubAPI class:**
```javascript
async listRecentCommits(repo, perPage = 30) {
    const [owner, repoName] = repo.split('/');
    return await this.request(`/repos/${owner}/${repoName}/commits?per_page=${perPage}&_=${Date.now()}`);
}

async getCommitDetail(repo, sha) {
    const [owner, repoName] = repo.split('/');
    return await this.request(`/repos/${owner}/${repoName}/commits/${sha}`);
}
```

**Detection dialog:** When orphans are detected, use the same dialog pattern as completion file detection:

```
Title: "Orphaned Commits Detected"
Message: "Found {N} commit(s) in {repoName} with no completion file"
```

Three actions:
- **Dismiss** → Set all detected orphans to state "dismissed"
- **View** → Navigate to Job History (orphan section)
- **Reconstruct** → Package orphan details for Code to produce completion files (see Section 2)

**Nudge threshold:** Use `settings.orphanNudgeThreshold` (default 5). If orphan count exceeds threshold, show nudge banner in Job History similar to the unclassified jobs nudge.

### 2. Orphan Reconstruction Package

When the developer chooses "Reconstruct," CC assembles a task package that can be given to a Claude Code session:

**Generate a markdown file** that Code can work from:

```markdown
# Reconstruction Task — Orphaned Commits

The following commits were made without completion files. Please reconstruct
completion files for each commit (or group related commits into single completion files).

## Instructions
- Use `git show {sha}` to inspect each commit
- Read the current CLAUDE.md for rules and decisions context
- Produce completion files to cc/completions/ following the standard format
- One completion file per logical task (group related commits if they're part of the same task)
- Required fields: task, status, files, commits
- Include what you can infer for contextual fields
- Note in the body that this is a reconstruction and narrative context may be incomplete

## Orphaned Commits

### Commit 1
- SHA: {sha}
- Date: {date}
- Message: {message}
- Files changed:
  - {path} ({status})
  - ...

### Commit 2
...
```

**Delivery:** Generate the markdown and either:
- Copy to clipboard (simplest — developer pastes into Code)
- Download as a file
- Push to repo as `cc/tasks/reconstruct-orphans-{timestamp}.md` (if you want Code to pick it up from the repo)

For MVP, copy to clipboard + download as file. Follow the pattern from CLAUDE.md generation in IdeasView (clipboard copy + optional repo push).

**After reconstruction:** When Code produces completion files for orphaned commits, CC's normal polling detects them. The orphan records should be updated to "reconstructed" state. Matching logic: when a new completion file is ingested and its `commits` SHAs match existing orphan records, auto-update those orphans to "reconstructed."

### 3. ODRC Update Ingestion

**Purpose:** After a Chat validation session, the developer brings back structured ODRC recommendations. CC parses them and presents a confirmation checklist.

**Create `ODRCUpdateIngestionService` as a singleton object.** Place after OrphanDetectionService.

**The structured format Chat outputs** (instructed by the review prompt):
```markdown
## ODRC Updates
- RESOLVE OPEN: "description" → matched to concept_id {id}
- NEW OPEN: "description" → tag to Idea {ideaName}
- NEW OPEN: "description" → untagged
- NEW DECISION: "description"
- NEW RULE: "description"
```

**Parser:**
```javascript
const ODRCUpdateIngestionService = {
    // Parse structured ODRC update text into actionable items
    parse(text) {
        const updates = [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));

        for (const line of lines) {
            // RESOLVE OPEN: "desc" → matched to concept_id xyz
            const resolveMatch = line.match(/^- RESOLVE OPEN:\s*"(.+?)"\s*→\s*matched to concept_id\s+(.+)$/);
            if (resolveMatch) {
                updates.push({
                    action: 'resolve',
                    type: 'OPEN',
                    description: resolveMatch[1],
                    conceptId: resolveMatch[2].trim()
                });
                continue;
            }

            // NEW {TYPE}: "desc" → tag to Idea {name}
            const newTaggedMatch = line.match(/^- NEW (OPEN|DECISION|RULE|CONSTRAINT):\s*"(.+?)"\s*→\s*tag to Idea\s+(.+)$/);
            if (newTaggedMatch) {
                updates.push({
                    action: 'create',
                    type: newTaggedMatch[1],
                    description: newTaggedMatch[2],
                    targetIdea: newTaggedMatch[3].trim()
                });
                continue;
            }

            // NEW {TYPE}: "desc" → untagged
            const newUntaggedMatch = line.match(/^- NEW (OPEN|DECISION|RULE|CONSTRAINT):\s*"(.+?)"\s*→\s*untagged$/);
            if (newUntaggedMatch) {
                updates.push({
                    action: 'create',
                    type: newUntaggedMatch[1],
                    description: newUntaggedMatch[2],
                    targetIdea: null
                });
                continue;
            }

            // NEW {TYPE}: "desc" (no routing specified)
            const newSimpleMatch = line.match(/^- NEW (OPEN|DECISION|RULE|CONSTRAINT):\s*"(.+?)"$/);
            if (newSimpleMatch) {
                updates.push({
                    action: 'create',
                    type: newSimpleMatch[1],
                    description: newSimpleMatch[2],
                    targetIdea: null
                });
                continue;
            }
        }

        return updates;
    },

    // Execute confirmed updates against Firebase
    async execute(uid, updates, globalIdeas) {
        const results = [];

        for (const update of updates) {
            try {
                if (update.action === 'resolve' && update.conceptId) {
                    await ConceptManager.resolve(uid, update.conceptId);
                    results.push({ ...update, status: 'success' });
                }
                else if (update.action === 'create') {
                    // Find idea ID from idea name if tagged
                    let ideaId = null;
                    if (update.targetIdea) {
                        const idea = globalIdeas.find(i =>
                            i.name.toLowerCase().includes(update.targetIdea.toLowerCase())
                        );
                        ideaId = idea?.id || null;
                    }

                    await ConceptManager.create(uid, {
                        type: update.type,
                        content: update.description,
                        ideaOrigin: ideaId,
                        scopeTags: []
                    });
                    results.push({ ...update, status: 'success', resolvedIdeaId: ideaId });
                }
            } catch (e) {
                results.push({ ...update, status: 'error', error: e.message });
            }
        }

        return results;
    }
};
```

**UI — ODRC Update Modal:**

Triggered from Job History on a "reviewed" or "checked" job. Add an action button: "Import ODRC Updates"

The modal flow:
1. **Text input area** — developer pastes Chat's structured output (the `## ODRC Updates` section)
2. **Parse button** — runs `ODRCUpdateIngestionService.parse()` and displays results as a checklist
3. **Confirmation checklist** — each parsed update shown as a row with:
   - Checkbox (all checked by default)
   - Action icon (resolve ✅, create ➕)
   - Type badge (OPEN, DECISION, RULE, CONSTRAINT)
   - Description
   - Target (concept ID for resolves, idea name for creates)
   - For creates with `targetIdea`: show a dropdown to confirm/change the target idea (pre-populated from fuzzy match, allow manual selection from globalIdeas)
   - For creates with no target: show an optional idea selector dropdown
4. **Execute button** — runs `ODRCUpdateIngestionService.execute()` for checked items
5. **Results display** — success/error status per item
6. **Close** — done

**Validation:** If parse returns zero items, show a message: "No ODRC updates could be parsed from the input. Check the format matches the expected pattern."

**Error tolerance in parsing:** Chat may not follow the exact format. The parser should be forgiving:
- Allow with or without quotes around descriptions
- Allow minor variations in arrow format (→, ->, ==>)
- Trim whitespace generously
- Log unparseable lines to console but don't fail

### 4. Batch Classification Packaging

**Purpose:** When the unclassified nudge threshold is reached, CC offers to package multiple unclassified jobs into a single Chat session for efficient classification.

**Add a "Classify Batch" action** to the unclassified nudge banner in Job History (currently shows a disabled button from Phase 1).

**The batch flow:**
1. Developer clicks "Classify Batch" on the nudge banner
2. CC shows a selection dialog with all unclassified jobs (checkboxes, all selected by default)
3. Developer confirms selection
4. CC assembles a **classification bundle** — similar to a validation bundle but containing multiple completion files:

```
classification-bundle-{timestamp}/
  completion-files/
    2026-02-10T14-30-00_fix-deploy.md
    2026-02-11T09-15-00_css-cleanup.md
    2026-02-11T16-00-00_api-error-handling.md
  odrc-summary.md              ← Full active ODRC landscape
  classification-prompt.md     ← API-generated prompt covering all jobs
  manifest.json
```

5. The classification prompt is generated via ClaudeAPIService, summarizing all included jobs and asking Chat to classify each one
6. Zip is downloaded, developer takes to Chat
7. Developer brings back ODRC updates and uses the Import ODRC Updates flow (Section 3) to ingest them

**Classification prompt generation:**

```javascript
async generateBatchClassificationPrompt(jobs, odrcSummary) {
    const system = `You are helping classify multiple pieces of unplanned development work into a 
project's ODRC (Opens, Decisions, Rules, Constraints) framework. For each job, determine:
(1) if it resolves any existing OPENs, (2) if it aligns with existing DECISIONs or RULEs,
(3) what new OPENs were discovered, and (4) the work category (UX fix, performance, integration, 
bug fix, tech debt, feature, refactor).

Output your analysis for each job, then a consolidated ODRC Updates section at the end using 
this exact format:

## ODRC Updates
- RESOLVE OPEN: "description" → matched to concept_id {id}
- NEW OPEN: "description" → tag to Idea {name}
- NEW OPEN: "description" → untagged
- NEW DECISION: "description"`;

    const jobSummaries = jobs.map((job, i) => `### Job ${i + 1}: ${job.task}
Status: ${job.status}
Files: ${(job.files || []).map(f => f.path).join(', ')}
Commits: ${(job.commits || []).map(c => c.message).join('; ')}
${job.unexpectedFindings?.length ? `Unexpected: ${job.unexpectedFindings.join('; ')}` : ''}
${job.unresolved?.length ? `Unresolved: ${job.unresolved.map(u => u.item).join('; ')}` : ''}`
    ).join('\n\n');

    const userMessage = `Classify the following ${jobs.length} unplanned jobs:

${jobSummaries}

## Full ODRC Landscape
${odrcSummary}`;

    return await ClaudeAPIService.call({
        system,
        userMessage,
        maxTokens: 8192  // Larger budget for batch analysis
    });
}
```

**After classification:** Jobs that get classified (matched to an ODRC item or categorized) through the Import flow should have their `classified` field updated to `true` in Firebase via CompletionFileService.

### 5. Job History View Enhancements

**Orphan Commits Section:**

Add a collapsible section to Job History below the completion file list:

```
📍 Orphaned Commits (3)
```

When expanded, shows orphan cards with:
- Commit SHA (abbreviated), message, date
- Files changed
- State badge (detected=red, dismissed=slate, reconstructed=green, ignored=gray)
- Actions by state:
  - Detected: Reconstruct, Dismiss, Ignore Permanently
  - Dismissed: Reconstruct, Ignore Permanently
  - Reconstructed/Ignored: read-only

**Global state:** Add to App component:
```javascript
const [globalOrphanCommits, setGlobalOrphanCommits] = React.useState([]);
```

Add listener in auth useEffect:
```javascript
unsubscribeOrphans = OrphanDetectionService.listen(u.uid, setGlobalOrphanCommits);
```

Add cleanup and sign-out clear.

**Pass as props** to JobHistoryView.

**Updated nudge banners:**
- Unclassified nudge: "You have {N} unclassified jobs. Classify batch?" (now functional)
- Orphan nudge: "You have {N} orphaned commits with no completion files. Review them?"

**Import ODRC Updates button:**
Add to the job card actions for "reviewed" and "checked" states. Opens the ODRC Update Modal (Section 3).

### 6. Orphan Auto-Matching on Completion File Ingestion

**Extend the existing `pollCompletionFiles` function** (from Phase 1):

After a new completion file is ingested and its job record created, check if any of its commit SHAs match existing orphan records:

```javascript
// After creating the job record in pollCompletionFiles:
const jobCommitShas = newJob.commits.map(c => c.sha);
const matchingOrphans = existingOrphans.filter(o => 
    o.repoFullName === repoFullName && 
    jobCommitShas.includes(o.commitSha) &&
    o.state !== 'ignored'
);
for (const orphan of matchingOrphans) {
    await OrphanDetectionService.updateState(uid, orphan.id, 'reconstructed');
}
```

This handles the case where Code produces completion files as a reconstruction task — the orphans automatically clear.

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

This is a single-file React app. All code goes in `index.html`. Place new sections:

1. **OrphanDetectionService** — after ValidationBundleAssembler, before MAIN APP
2. **ODRCUpdateIngestionService** — after OrphanDetectionService
3. **GitHubAPI additions** (`listRecentCommits`, `getCommitDetail`) — extend existing GitHubAPI class
4. **Orphan detection polling** — extend existing `pollCompletionFiles` or add parallel `pollOrphanCommits`
5. **ODRC Update Modal** — near other modals
6. **Bundle Assembly Modal updates** — add batch classification mode
7. **Job History updates** — orphan section, functional nudge buttons, Import ODRC Updates action
8. **App component** — new globalOrphanCommits state, listener, orphan detection in polling flow

---

## Existing Patterns to Follow

- **Service singleton:** See `CompletionFileService` (Phase 1) for the most recent example
- **Firebase listener:** Same pattern — `ref.on('value', handler)` returning cleanup
- **Polling flow:** See Phase 1's `pollCompletionFiles` — extend or run alongside
- **ClaudeAPIService:** Built in Phase 2 — use for batch classification prompt generation
- **ValidationBundleAssembler:** Built in Phase 2 — reference for zip assembly pattern
- **JSZip:** Same pattern as Phase 2 bundle assembly
- **Modal patterns:** See Bundle Assembly Modal (Phase 2) for progress-based flow
- **ConceptManager.resolve():** Line ~4994 — marks an OPEN as resolved
- **ConceptManager.create():** Line ~4834 — creates a new concept
- **Clipboard + download:** See IdeasView CLAUDE.md export (~line 16409) for clipboard copy pattern

---

## What This Completes

After Phase 3, the full ingestion pipeline is operational:

```
Code produces completion file
  → CC detects via GitHub API polling
    → CC caches to Firebase, shows detection dialog
      → Developer reviews in Job History
        → Developer packages for Chat Check (Phase 2 bundle)
          → Chat validates, produces structured ODRC recommendations
            → Developer imports ODRC updates back to CC (Phase 3)
              → CC presents confirmation checklist
                → Developer confirms, CC writes to Firebase
                  → ODRC updated, loop closed

Code fails to produce completion file
  → CC detects orphaned commits (Phase 3)
    → Developer triggers reconstruction via Code
      → Code produces completion files
        → CC detects, auto-matches orphans
          → Normal flow resumes
```

---

## What NOT to Build

- **Job queue / multi-phase sequencing** — Future feature (spec packaging, manifest-driven job queues)
- **Bundle split into multiple zips** — Deferred, exclusion-only for now
- **Automatic ODRC parsing without developer confirmation** — Always goes through the checklist
- **Real-time Chat integration** — All Chat interaction is manual (upload zip, paste results back)

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_ingest_p3.md`
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
