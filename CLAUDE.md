# CLAUDE.md — CC Completion File Ingestion Pipeline (Phase 2 of 3)
# cc-spec-id: sp_ingest_p2
# App: Command Center (index.html)
# Base version: 8.58.0
# Target version: 8.59.0
# Depends on: Phase 1 (sp_ingest_p1) — CompletionFileService, Job History, polling, detection dialog

---

## Task Summary

Build the validation bundle assembly pipeline — the mechanism that packages a completion file with its context into a downloadable zip for Chat validation. This includes: zip assembly with code files, ODRC state summary generation, Claude API integration for review prompt generation, spec archive retrieval, bundle size management, and enabling the previously disabled "Package for Check" buttons in Job History.

---

## What to Build

### 1. Claude API Service (New Infrastructure)

CC stores an Anthropic API key in localStorage as `cc_api_key` (also mirrored to `gs_api_key`). This is set in the Settings view. The engine registry (EngineRegistryService) has model definitions including `claude-haiku-4.5`. No existing code calls the Anthropic API directly — this is new infrastructure.

**Create `ClaudeAPIService` as a singleton object** following the service pattern. Place it after EngineRegistryService (around line ~2260), before the data service layer.

```javascript
const ClaudeAPIService = {
    // Get the API key from localStorage
    getApiKey() {
        try { return localStorage.getItem('cc_api_key') || ''; } catch { return ''; }
    },

    // Check if API is configured
    isConfigured() {
        return !!this.getApiKey();
    },

    // Call Claude API with a system prompt and user message
    // Returns the text content from the response
    async call({ model = 'claude-haiku-4-5-20251001', system, userMessage, maxTokens = 4096 }) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error('Claude API key not configured. Set it in Settings.');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                system,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Claude API error: ${response.status}`);
        }

        const data = await response.json();
        // Extract text from content blocks
        return data.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
    }
};
```

**Important:** The `anthropic-dangerous-direct-browser-access` header is required for browser-based API calls. This is a known pattern for client-side Anthropic API access.

### 2. ODRC Summary Generator

**Create `ODRCSummaryGenerator` object** — placed after ClaudeAPIService. Generates markdown summaries of ODRC state from globalConcepts and globalIdeas.

```javascript
const ODRCSummaryGenerator = {
    // Generate scoped summary for planned work (spec-id matched)
    generateScoped(concepts, ideas, specId) {
        // Filter concepts that have this specId in their specTags[]
        // If no concepts have specTags matching, fall back to full summary
        // Group by type: OPENs, DECISIONs, RULEs, CONSTRAINTs
        // Render as markdown with type headers
    },

    // Generate full summary for unplanned/classification work
    generateFull(concepts, ideas) {
        // All active concepts grouped by type
        // Include idea names for context
        // Render as markdown
    },

    // Internal: render a group of concepts as markdown
    _renderGroup(type, concepts, ideas) {
        // Follow the same rendering pattern as the CLAUDE.md generator
        // in IdeasView (line ~16370):
        //   ## {TYPE}s
        //   - {content} *(from: {ideaName})*
    }
};
```

**Output format** (matches existing CLAUDE.md rendering pattern):
```markdown
# ODRC State Summary
Generated for validation of: {task description}
Scope: {scoped to spec sp_xxx | full active landscape}

## RULEs
- Rule content *(from: Idea Name)*
- ...

## CONSTRAINTs
- Constraint content *(from: Idea Name)*
- ...

## DECISIONs
- Decision content *(from: Idea Name)*
- ...

## OPENs
- Open content *(from: Idea Name)*
- ...
```

### 3. Review Prompt Generator

**Create `ReviewPromptGenerator` object** — uses ClaudeAPIService to generate tailored review prompts.

Two modes based on whether the completion file has a spec-id:

**Review mode (planned work — spec-id present):**
```javascript
async generateReviewPrompt(completionJob, odrcSummary) {
    const system = `You are a code reviewer for a software project. You will generate a review prompt 
that another AI assistant will use to validate completed work. The review prompt should instruct 
the reviewer to check: correctness of implementation, alignment with rules and decisions, 
side effects or regressions, whether claimed ODRC resolutions are accurate, and completeness 
of the task. Be specific to the actual work described. Output only the review prompt in markdown.`;

    const userMessage = `Generate a review prompt for this completed work:

## Task
${completionJob.task}

## Status
${completionJob.status}

## Files Changed
${(completionJob.files || []).map(f => `- ${f.path} (${f.action})`).join('\n')}

## ODRC References
${completionJob.odrc ? JSON.stringify(completionJob.odrc, null, 2) : 'None'}

## Unexpected Findings
${(completionJob.unexpectedFindings || []).map(f => `- ${f}`).join('\n') || 'None'}

## Unresolved Items
${(completionJob.unresolved || []).map(u => `- ${u.item}: ${u.reason}`).join('\n') || 'None'}

## Active ODRC State
${odrcSummary}`;

    return await ClaudeAPIService.call({ system, userMessage });
}
```

**Classification mode (unplanned work — no spec-id):**
```javascript
async generateClassificationPrompt(completionJob, odrcSummary) {
    const system = `You are helping classify unplanned development work into a project's ODRC 
(Opens, Decisions, Rules, Constraints) framework. You will generate a classification prompt that 
another AI assistant will use to: (1) determine if this work resolves any existing OPENs, 
(2) identify if it aligns with existing DECISIONs or RULEs, (3) suggest new OPENs if gaps were 
discovered, and (4) categorize the work type (UX fix, performance, integration, bug fix, tech debt, 
feature, refactor). Output only the classification prompt in markdown.

IMPORTANT: At the end of the prompt, instruct the reviewer to output structured ODRC recommendations 
in this exact format:

## ODRC Updates
- RESOLVE OPEN: "description" → matched to concept_id {id}
- NEW OPEN: "description" → tag to Idea {name}
- NEW OPEN: "description" → untagged
- NEW DECISION: "description"`;

    const userMessage = `Generate a classification prompt for this unplanned work:

## Task
${completionJob.task}

## Status
${completionJob.status}

## Files Changed
${(completionJob.files || []).map(f => `- ${f.path} (${f.action})`).join('\n')}

## Full ODRC Landscape
${odrcSummary}`;

    return await ClaudeAPIService.call({ system, userMessage });
}
```

### 4. Validation Bundle Assembler

**Create `ValidationBundleAssembler` object** — orchestrates the full bundle assembly and produces a downloadable zip.

```javascript
const ValidationBundleAssembler = {
    // Main entry point — assemble and download a validation bundle
    async assemble({ completionJob, github, repoFullName, globalConcepts, globalIdeas, firebaseUid, onProgress }) {
        // onProgress is a callback: (step, detail) => void
        // Steps: 'fetching-completion', 'fetching-spec', 'fetching-files', 
        //        'generating-summary', 'generating-prompt', 'building-zip', 'done'

        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const bundleName = `validation-bundle-${timestamp}`;
        const errors = [];
        const excluded = [];

        // Step 1: Fetch completion file from repo
        onProgress('fetching-completion', 'Reading completion file from repo...');
        const completionContent = await github.getFileContent(
            repoFullName, `cc/completions/${completionJob.fileName}`
        );
        if (completionContent?.textContent) {
            zip.file('completion-file.md', completionContent.textContent);
        } else {
            errors.push('Could not fetch completion file from repo — using cached data');
            // Fallback: reconstruct from cached frontmatter
            zip.file('completion-file.md', this._reconstructFromCache(completionJob));
        }

        // Step 2: Fetch spec (CLAUDE.md)
        onProgress('fetching-spec', 'Reading spec archive...');
        if (completionJob.specId) {
            // Planned work — look for archived spec
            const specContent = await github.getFileContent(
                repoFullName, `cc/specs/${completionJob.specId}.md`
            );
            if (specContent?.textContent) {
                zip.file('spec.md', specContent.textContent);
            } else {
                // Fallback: try current CLAUDE.md
                const currentSpec = await github.getFileContent(repoFullName, 'CLAUDE.md');
                if (currentSpec?.textContent) {
                    zip.file('spec.md', currentSpec.textContent);
                    errors.push('Archived spec not found — included current CLAUDE.md instead');
                }
            }
        } else {
            // Unplanned work — use current CLAUDE.md
            const currentSpec = await github.getFileContent(repoFullName, 'CLAUDE.md');
            if (currentSpec?.textContent) {
                zip.file('spec.md', currentSpec.textContent);
            }
        }

        // Step 3: Fetch changed code files
        onProgress('fetching-files', `Fetching ${completionJob.files?.length || 0} changed files...`);
        let totalFileSize = 0;
        const bundleSizeLimit = /* read from settings */ 5 * 1024 * 1024; // 5MB default

        for (const file of (completionJob.files || [])) {
            try {
                const fileContent = await github.getFileContent(repoFullName, file.path);
                if (fileContent?.textContent) {
                    const fileSize = new Blob([fileContent.textContent]).size;
                    if (totalFileSize + fileSize > bundleSizeLimit) {
                        excluded.push({ path: file.path, size: fileSize, reason: 'Bundle size limit exceeded' });
                        continue;
                    }
                    zip.file(`files/${file.path}`, fileContent.textContent);
                    totalFileSize += fileSize;
                }
            } catch (e) {
                errors.push(`Could not fetch ${file.path}: ${e.message}`);
            }
        }

        // Step 4: Generate ODRC summary
        onProgress('generating-summary', 'Building ODRC state summary...');
        const isPlanned = !!completionJob.specId;
        const odrcSummary = isPlanned
            ? ODRCSummaryGenerator.generateScoped(globalConcepts, globalIdeas, completionJob.specId)
            : ODRCSummaryGenerator.generateFull(globalConcepts, globalIdeas);
        zip.file('odrc-summary.md', odrcSummary);

        // Step 5: Generate review prompt via Claude API
        onProgress('generating-prompt', 'Generating review prompt via Claude API...');
        try {
            const prompt = isPlanned
                ? await ReviewPromptGenerator.generateReviewPrompt(completionJob, odrcSummary)
                : await ReviewPromptGenerator.generateClassificationPrompt(completionJob, odrcSummary);
            zip.file('review-prompt.md', prompt);
        } catch (e) {
            errors.push(`Review prompt generation failed: ${e.message}`);
            // Fallback: include a static template
            zip.file('review-prompt.md', this._staticPromptFallback(completionJob, isPlanned));
        }

        // Step 6: Add manifest with metadata
        const manifest = {
            bundleName,
            createdAt: new Date().toISOString(),
            completionFile: completionJob.fileName,
            repo: repoFullName,
            specId: completionJob.specId || null,
            mode: isPlanned ? 'review' : 'classification',
            filesIncluded: (completionJob.files || [])
                .filter(f => !excluded.find(e => e.path === f.path))
                .map(f => f.path),
            filesExcluded: excluded.map(e => ({ path: e.path, reason: e.reason })),
            errors
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // Step 7: Generate zip and trigger download
        onProgress('building-zip', 'Compressing bundle...');
        const blob = await zip.generateAsync({ type: 'blob' });

        onProgress('done', `Bundle ready: ${(blob.size / 1024).toFixed(1)} KB`);

        return { blob, bundleName, manifest };
    },

    // Trigger browser download of the zip
    download(blob, bundleName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bundleName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Fallback: reconstruct completion file from cached frontmatter
    _reconstructFromCache(job) {
        return [
            '---',
            `task: "${job.task}"`,
            `status: ${job.status}`,
            'files:',
            ...(job.files || []).map(f => `  - path: "${f.path}"\n    action: ${f.action}`),
            'commits:',
            ...(job.commits || []).map(c => `  - sha: "${c.sha}"\n    message: "${c.message}"`),
            '---',
            '',
            '*Note: This is a reconstruction from cached data. Original file could not be fetched from repo.*'
        ].join('\n');
    },

    // Fallback: static review prompt when API call fails
    _staticPromptFallback(job, isPlanned) {
        if (isPlanned) {
            return [
                '# Review Prompt',
                '',
                '*Note: This is a static fallback prompt. The Claude API call failed during bundle assembly.*',
                '',
                '## Instructions',
                '',
                'Please review the attached completion file and code changes. Check:',
                '',
                '1. **Correctness** — Does the implementation match the task description?',
                '2. **Rule compliance** — Review the spec (spec.md) and ODRC summary. Were all RULEs followed?',
                '3. **Side effects** — Could these changes break anything else?',
                '4. **ODRC alignment** — Are the claimed resolved OPENs actually resolved? Are new OPENs valid?',
                '5. **Completeness** — Is the task fully done, or are there gaps?',
                '',
                '## ODRC Update Format',
                '',
                'At the end of your review, output structured ODRC recommendations:',
                '',
                '```',
                '## ODRC Updates',
                '- RESOLVE OPEN: "description" → matched to concept_id {id}',
                '- NEW OPEN: "description" → tag to Idea {name}',
                '- NEW DECISION: "description"',
                '```'
            ].join('\n');
        } else {
            return [
                '# Classification Prompt',
                '',
                '*Note: This is a static fallback prompt. The Claude API call failed during bundle assembly.*',
                '',
                '## Instructions',
                '',
                'This is unplanned work that needs classification. Please:',
                '',
                '1. **Match to existing OPENs** — Does this work resolve any OPENs in the ODRC summary?',
                '2. **Categorize** — What type of work is this? (UX fix, performance, integration, bug fix, tech debt, feature, refactor)',
                '3. **New OPENs** — Did this work reveal new questions or gaps?',
                '',
                '## ODRC Update Format',
                '',
                'Output structured recommendations:',
                '',
                '```',
                '## ODRC Updates',
                '- RESOLVE OPEN: "description" → matched to concept_id {id}',
                '- NEW OPEN: "description" → tag to Idea {name}',
                '- NEW DECISION: "description"',
                '```'
            ].join('\n');
        }
    }
};
```

### 5. Enable "Package for Check" in Job History

Phase 1 placed disabled buttons with "Coming in Phase 2" tooltips. Now enable them:

**Job card actions — replace disabled buttons with functional ones:**

For Acknowledged and Reviewed states, the "Package for Check" button should:
1. Check that ClaudeAPIService is configured (API key present). If not, show alert directing to Settings.
2. Open a **Bundle Assembly Modal** showing progress steps.
3. Call `ValidationBundleAssembler.assemble()` with progress callback updating the modal.
4. On success, trigger download and update job state to "checked" (or keep as "reviewed" until the developer confirms they completed the Chat review — developer judgment on this).
5. On error, show what failed and offer to retry or download partial bundle.

**Bundle Assembly Modal:**

A modal (not a full view) that shows assembly progress. Reuse the existing modal/dialog patterns in CC. Display:

- Step list with status indicators (spinner → checkmark → error)
  - Fetching completion file...
  - Fetching spec archive...
  - Fetching changed files (N)...
  - Generating ODRC summary...
  - Generating review prompt...
  - Building zip...
- Error/warning list if any steps had issues
- Excluded files list if bundle size was managed
- Download button when complete
- Cancel button to abort

**State transition after packaging:**
The job state should move to "checked" only after the developer confirms they've completed the Chat review. For now, packaging alone moves state to "reviewed" if it was "acknowledged" or "new". Add a "Mark as Checked" button that appears after packaging, which prompts for an outcome (confirmed, challenged, escalated) and optional notes.

### 6. Mark as Checked Flow

In Job History, for jobs in "reviewed" state that have been packaged, add a "Mark as Checked" action:

1. Show a small form/dialog:
   - **Outcome** dropdown: Confirmed, Challenged, Escalated
   - **Notes** text area (optional): Brief summary of what Chat found
2. On confirm, call `CompletionFileService.updateState(uid, jobId, 'checked')` and `CompletionFileService.updateCheckOutcome(uid, jobId, outcome, notes)`
3. Card updates to show checked state with outcome badge

### 7. Bundle Size Management UI

When `ValidationBundleAssembler` detects files would exceed the bundle size limit:

1. Assembly pauses before adding the oversized file
2. Modal shows which files are included (with sizes) and which would be excluded
3. Developer can:
   - **Accept exclusions** — continue with partial bundle, excluded files noted in manifest
   - **Adjust** — deselect specific files to include/exclude
   - **Skip files entirely** — bundle with just completion file, spec, summary, and prompt

The bundle's `manifest.json` and `review-prompt.md` both note which files were excluded so Chat knows what it's missing.

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

1. **ClaudeAPIService** — after EngineRegistryService (around line ~2260)
2. **ODRCSummaryGenerator** — after ClaudeAPIService
3. **ReviewPromptGenerator** — after ODRCSummaryGenerator
4. **ValidationBundleAssembler** — after ReviewPromptGenerator
5. **Bundle Assembly Modal** — near the other modals (after Version Warning Modal area, ~line 8417)
6. **Job History updates** — modify existing JobHistoryView to enable buttons and add Mark as Checked flow

---

## Existing Patterns to Follow

- **Service singleton:** See `ConceptManager`, `IdeaManager`, `CompletionFileService` for the pattern
- **JSZip usage:** See line ~6162 for `JSZip.loadAsync()` — CC already imports JSZip from CDN and uses it for deployment zips. Use `new JSZip()` for creation, `.file()` to add files, `.generateAsync({ type: 'blob' })` to produce the download
- **File download:** See the gs-active.zip download pattern around line ~11754 for creating download links with `URL.createObjectURL()`
- **ODRC concept rendering:** See IdeasView CLAUDE.md generator (~line 16370) for how concepts are grouped by type and rendered to markdown
- **Modal patterns:** See Deploy All Modal (~line 8463) or Session Launch Modal (~line 19163) for progress-based modals with step indicators
- **GitHub API file fetching:** `github.getFileContent(repo, path)` returns `{ textContent }` — see line ~4448
- **Dialog patterns:** `showAlert`, `showConfirm` for simple user interactions
- **EngineRegistryService:** Line ~2127 for model definitions. Use model string `claude-haiku-4-5-20251001` for the API call
- **API key access:** `localStorage.getItem('cc_api_key')` — see Settings view line ~11622

---

## What NOT to Build

- **ODRC update ingestion from Chat structured output** — Phase 3. The review prompt instructs Chat to produce structured output, but CC doesn't parse it yet.
- **Orphan commit detection** — Phase 3
- **Batch classification packaging** — Phase 3 (multiple unclassified jobs into one bundle)
- **Job queue / multi-phase sequencing** — Future feature
- **Bundle size split into multiple zips** — defer to simple exclusion for now. The "split" option can be a future enhancement.

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_ingest_p2.md`
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
