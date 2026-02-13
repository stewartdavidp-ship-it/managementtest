# CLAUDE.md — Ideation Pipeline: UX Fixes + Pipeline Completeness
# cc-spec-id: sp_ideation_ux_pipeline
# App: Command Center (index.html)
# Base version: 8.61.1
# Target version: 8.62.0
# Depends on: sp_ideation_pipeline, sp_ideation_bugfix_1

---

## Before You Begin

This spec covers two categories: UX friction fixes (straightforward) and pipeline completeness (new behavior). Review the full scope, then tell me:

1. Can you complete this in one session, or should we split?
2. If splitting, where would you draw the line?

Provide your assessment before writing any code.

---

## Task Summary

Fix UX friction found during live walkthrough of the Idea-to-Chat pipeline, and close the "untracked zone" — the gap between an idea reaching spec-ready and Code receiving a CLAUDE.md. The untracked zone is where spec generation, phase splitting, and CLAUDE.md creation happen in Chat without structure, causing inconsistent outputs. This spec adds structure to those steps while keeping Chat as the execution environment.

---

## What to Build

### Category A: UX Friction Fixes

#### A1: Surface Explore in Chat on App Aggregate View (Mode 2)

**Location:** Ideas view Mode 2 (App Aggregate) — Idea History chain, ~line 18260

**Problem:** Developer lands on Mode 2 after clicking an app card. The Idea chip in Idea History doesn't look clickable. The most prominent action is "Generate CLAUDE.md" (green button) which is wrong for exploring ideas. "Explore in Chat" is hidden on Mode 3, requiring a non-obvious click.

**Fix:** Add an "Explore in Chat" icon button directly on each active Idea chip in the Idea History chain on Mode 2:

```jsx
{appIdeas.map((idea, idx) => {
  const phase = idea.phase || computeIdeaPhase(ideaCpts);
  return (
    <div key={idea.id} className="flex items-center gap-1">
      <button onClick={() => navigateToIdea(idea.id)}
        className="px-3 py-1.5 rounded-lg text-sm border ..."
        title="Click to view idea details">
        {idx + 1}. {idea.name.substring(0, 40)}{idea.name.length > 40 ? '...' : ''}
        <span className="text-xs ml-1">({idea.status})</span>
        <span className="phase-badge">{phase}</span>
      </button>
      {idea.status === 'active' && (
        <button onClick={() => setShowExploreModal({ ideaId: idea.id })}
          className="px-2 py-1.5 rounded text-sm bg-purple-700 hover:bg-purple-600"
          title="Explore in Chat">
          🗣️
        </button>
      )}
    </div>
  );
})}
```

Also add a subtle hover state and cursor:pointer to the Idea chip itself so it looks clickable.

---

#### A2: Separate Idea Name and Description

**Location:** `IdeaManager.create()` ~line 5762, Idea creation UI

**Problem:** Ideas are created with the entire description as the name. This causes bloated titles, prompts, slugs, and 4+ repetitions of the same text on Idea Detail. The slug gets truncated at 60 chars.

**Fix:**

1. **Extend Idea schema** — the `name` field already exists. Ensure it's treated as a short title (enforce or encourage max ~80 chars). The `description` field already exists and should hold the long text.

2. **Update Idea creation flow** — when "Add Idea" or "+ New Idea" is clicked:
   - Show a two-field form: Name (short, required, max 80 chars) and Description (long, optional)
   - If the developer pastes a long block of text into Name, show a hint: "Consider moving details to Description"
   - Auto-generate slug from Name only (already the case in `generateSlug`)

3. **Update all displays** to use `idea.name` for short display and `idea.description` for expanded view:
   - Mode 2 Idea History chips: show name only (truncated at 40 chars)
   - Mode 3 Idea Detail heading: show name as h1, description as subtitle
   - ExploreInChatModal title: "Explore in Chat — {name} (Session {N})"
   - Handshake prompt: use name only, not description
   - Brief header: use name, with description in the Idea Summary section

4. **Add character counter** to the Name field in the create/edit modal. Show remaining chars (80 - current.length). Turn amber at 60, red at 80.

---

#### A3: Fix Brief Template Content Issues

**Location:** `IdeationBriefGenerator.buildTemplateBrief()` ~line 3501 and `getHandshakePrompt()` ~line 3551

**Fix these three issues:**

1. **RESOLVE format in Expected Output section** — change:
   ```
   - RESOLVE OPEN: "description" → matched to concept_id {id}
   ```
   To:
   ```
   - RESOLVE OPEN: "description" → resolution explanation
   ```

2. **"Check the zip" when no zip** — make the Supporting Documents section conditional:
   ```javascript
   // Only include if zip will be the output method
   if (ideaContext.sessionCount > 0 || briefText.length >= 8000) {
     brief += `## Supporting Documents\n`;
     brief += `Check the zip package for additional files included with this brief.\n`;
   }
   ```

3. **ODRC state header** — strip "Scope: full active landscape" or replace with contextual label. In `buildTemplateBrief()`, replace the raw ODRCSummaryGenerator output header:
   ```javascript
   const odrcStateClean = odrcState.replace(/^# ODRC State Summary\nScope:.*\n/m, '');
   brief += `## Current ODRC State\n\n`;
   brief += odrcStateClean + '\n\n';
   ```

---

#### A4: Filter Empty Apps from Grid

**Location:** Ideas view Mode 1 (All Concepts) — app cards grid, ~line 18150

**Problem:** All configured apps show as cards including those with "No concepts · No ideas." Developer has to scan the grid to find the one app they care about.

**Fix:** Two changes:
1. Sort apps: active ideas/concepts first, empty last
2. Collapse empty apps into a single row: "12 apps with no active concepts" (expandable)

```jsx
const appsWithContent = configuredApps.filter(app => {
  const concepts = globalConcepts.filter(c => c.appId === app.id && c.status === 'active');
  const ideas = globalIdeas.filter(i => i.appId === app.id);
  return concepts.length > 0 || ideas.length > 0;
});
const emptyApps = configuredApps.filter(app => !appsWithContent.includes(app));

// Render appsWithContent as cards
// Render: "{emptyApps.length} apps with no active concepts" as collapsible row
```

---

#### A5: Truncate Modal Title

**Location:** `ExploreInChatModal` ~line 18031

**Problem:** Modal title shows full idea name which can be very long.

**Fix:** Truncate to 50 chars in the title:
```jsx
<h2>🗣️ Explore in Chat — {idea.name.substring(0, 50)}{idea.name.length > 50 ? '...' : ''} (Session {sessionNum})</h2>
```

This becomes less of an issue once A2 (separate name/description) is implemented, since names will be short. But add truncation as a safety net regardless.

---

#### A6: Convert Background Pollers to Non-Blocking Banners

**Location:** Completion file detection dialog and orphan commit detection dialog in App component

**Problem:** These fire as modal dialogs that steal focus, interrupting the developer when they're working in Ideas view. During walkthrough, had to dismiss 2 modals before reaching Explore in Chat.

**Fix:** Replace `showConfirm()` calls for background detection with a notification banner system:

1. Create a `notifications` state array in App component:
   ```javascript
   const [notifications, setNotifications] = React.useState([]);
   
   const addNotification = (notification) => {
     setNotifications(prev => [...prev, { id: Date.now(), ...notification }]);
   };
   
   const dismissNotification = (id) => {
     setNotifications(prev => prev.filter(n => n.id !== id));
   };
   ```

2. Render notifications as a stack in the top-right corner (below the header bar):
   ```jsx
   {notifications.map(n => (
     <div key={n.id} className="fixed top-16 right-4 z-40 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg max-w-sm">
       <div className="flex items-center justify-between">
         <span className="text-sm font-medium">{n.icon} {n.title}</span>
         <button onClick={() => dismissNotification(n.id)}>✕</button>
       </div>
       <p className="text-xs text-slate-400 mt-1">{n.message}</p>
       {n.action && (
         <button onClick={n.action.handler} className="mt-2 px-3 py-1 text-xs bg-indigo-600 rounded">
           {n.action.label}
         </button>
       )}
     </div>
   ))}
   ```

3. Change completion file detection and orphan detection to use `addNotification()` instead of `showConfirm()`:
   ```javascript
   // Before:
   const confirmed = await showConfirm(`Found ${count} new completion files...`);
   
   // After:
   addNotification({
     icon: '📦',
     title: `${count} new completion files`,
     message: `Found in ${repo}`,
     action: { label: 'Review', handler: () => { /* navigate to job history */ } }
   });
   ```

4. Auto-dismiss notifications after 30 seconds if not acted upon.

---

#### A7: Auto-Create Idea from Import

**Location:** `ODRCImportChecklistModal` ~line 12152, Linked Idea dropdown

**Problem:** When ODRC import metadata references an idea slug that doesn't exist, the dropdown shows no match. Developer can't link concepts to an idea that doesn't exist yet.

**Fix:** Add "Create New Idea" option at the bottom of the Linked Idea dropdown:

```jsx
<select value={linkedIdeaId} onChange={handleIdeaChange}>
  <option value="">— Select Idea —</option>
  {/* Existing ideas grouped by app */}
  {activeIdeas.map(idea => (
    <option key={idea.id} value={idea.id}>{idea.name} ({appName})</option>
  ))}
  <option value="__create__">+ Create New Idea...</option>
</select>
```

When "Create New Idea" is selected:
1. Show inline fields: Name (pre-filled from metadata slug, converted from kebab-case), Description (empty), App (pre-filled from metadata appId)
2. Developer edits as needed
3. On Apply, create the idea first via `IdeaManager.create()`, then proceed with import using the new idea's ID

Slug-to-name conversion: `"ideation-workflow-pipeline"` → `"Ideation Workflow Pipeline"`

---

### Category B: Pipeline Completeness — Closing the Untracked Zone

#### B1: Phase-Aware Session Types

**Location:** `IdeationBriefGenerator` ~line 3386

**Problem:** The brief generator currently has two modes: exploring/converging (exploration framing) and spec-ready (spec framing, from bugfix sp_ideation_bugfix_1). But there's no distinction between a spec-generation session and a CLAUDE.md generation session. And there's no tracking of whether a spec has been produced.

**Fix:** Add session type awareness to the brief generator based on idea state:

```javascript
// Determine session type from idea state
getSessionType(idea, concepts) {
  const phase = idea.phase || computeIdeaPhase(concepts);
  
  // Has a spec been produced? Check session log for spec session
  const hasSpec = (idea.sessionLog || []).some(s => s.type === 'spec');
  
  if (phase === 'spec-ready' && hasSpec) return 'claude-md';
  if (phase === 'spec-ready') return 'spec';
  return 'exploration';
}
```

**Three session types with distinct framing:**

| Type | When | Brief Framing | Expected Output |
|------|------|---------------|-----------------|
| `exploration` | Phase is exploring or converging | "Explore this idea, resolve OPENs, establish DECISIONs" | ODRC Updates section |
| `spec` | Phase is spec-ready, no spec exists yet | "Produce a formal specification from accumulated ODRC state" | Spec document + ODRC Updates |
| `claude-md` | Phase is spec-ready, spec already produced | "Produce a CLAUDE.md from this specification" | CLAUDE.md file following locked template |

**Update `getSystemPrompt()`** to handle all three:

```javascript
getSystemPrompt(sessionType) {
  switch (sessionType) {
    case 'spec':
      return `You are generating a session brief for a SPECIFICATION session.
The idea has reached spec-ready status. Generate a brief that instructs Chat to:
1. Review all DECISIONs, RULEs, and CONSTRAINTs
2. Resolve any remaining OPENs
3. Produce a formal specification document with:
   - Task summary
   - Detailed implementation sections
   - Architecture constraints
   - File structure
   - Any phase splitting recommendations
4. Include ODRC Updates section at the end

The spec should be comprehensive enough that a CLAUDE.md can be generated from it.`;

    case 'claude-md':
      return `You are generating a session brief for a CLAUDE.md GENERATION session.
A specification already exists for this idea. Generate a brief that instructs Chat to:
1. Review the specification
2. Produce a CLAUDE.md file following the LOCKED TEMPLATE below
3. Include all implementation details from the spec
4. Validate line references against the codebase (if included)
5. Include ODRC Updates section at the end

LOCKED CLAUDE.md TEMPLATE — Chat MUST follow this structure:
\`\`\`
# CLAUDE.md — {Task Name}
# cc-spec-id: {spec_id}
# App: {app_name} (index.html)
# Base version: {current_version}
# Target version: {next_version}
# Depends on: {dependencies}

---

## Before You Begin
{Scope assessment prompt — ask Code if this should split into phases}

---

## Task Summary
{What to build, in 2-3 sentences}

---

## What to Build
{Detailed implementation sections with code examples, organized by phase if applicable}

---

## Existing Infrastructure Reference
{Table of components, locations, and what they do}

---

## Architecture Rules
### State Management Rules
### Data Flow Rules

---

## Conventions
{Project-specific conventions — slug formats, naming, patterns}

---

## File Structure
{What files are created/modified}

---

## Post-Task Obligations
RULE: Before reporting this task as complete:
1. Commit all code changes
2. Archive this CLAUDE.md to cc/specs/{spec_id}.md
3. Generate completion file to .cc/completions/
4. Commit spec archive and completion file separately

Completion file format:
{Inline YAML template with all required fields}
\`\`\``;

    default: // exploration
      return `You are generating a session brief for a structured ideation conversation.
The brief will be uploaded to Claude Chat along with a standardized prompt.
Generate a markdown document with these sections:
- Session header (idea name, app, session number)
- "What are you looking to get out of today's session?"
- Idea Summary
- Prior Session Summary (if exists)
- Current ODRC State
- Expected Output Format (ODRC Updates with header metadata)
Frame everything in ODRC terms.`;
  }
}
```

**Update the handshake prompt** to reflect session type:

```javascript
getHandshakePrompt(ideaName, sessionNumber, appName, sessionType) {
  const typeLabel = sessionType === 'spec' ? 'Specification'
    : sessionType === 'claude-md' ? 'CLAUDE.md Generation'
    : 'Exploration';
  
  return `Please review the attached session brief and supporting documents for ${ideaName} (Session ${sessionNumber}, App: ${appName}).

This is a ${typeLabel} session.

Confirm you've reviewed the materials, then ask me what I want to accomplish in this session.

Frame all work using the ODRC model (OPENs, Decisions, Rules, Constraints). At the end of the session, produce a structured ODRC Updates section using the format defined in the brief.`;
}
```

---

#### B2: Session Type Tracking in Session Log

**Location:** `IdeaManager.addSessionLogEntry()` ~line 5734

**Problem:** Session log entries don't record what type of session it was. Can't determine if a spec session has been completed.

**Fix:** Add `type` field to session log entries:

```javascript
async addSessionLogEntry(uid, ideaId, { sessionId, date, docPath, summary, conceptsCreated, conceptsResolved, type }) {
  // type: 'exploration' | 'spec' | 'claude-md'
  const entry = { sessionId, date, docPath, summary, conceptsCreated, conceptsResolved, type: type || 'exploration' };
  // ... existing push logic
}
```

**Update `executeODRCImport()`** to pass session type. Detect from the inbound file content:
- If the file contains a spec-like structure (## Task Summary, ## What to Build, ## Architecture), mark as `type: 'spec'`
- If the file contains CLAUDE.md structure (# CLAUDE.md header, ## Post-Task Obligations), mark as `type: 'claude-md'`
- Otherwise: `type: 'exploration'`

```javascript
function detectSessionType(fileContent) {
  if (/^# CLAUDE\.md/m.test(fileContent)) return 'claude-md';
  if (/^## Task Summary/m.test(fileContent) && /^## What to Build/m.test(fileContent)) return 'spec';
  return 'exploration';
}
```

---

#### B3: Explore in Chat Button Label Reflects Session Type

**Location:** Idea Detail Mode 3, ~line 18350

**Problem:** The button always says "Explore in Chat" regardless of phase and session history.

**Fix:** Make the button label dynamic:

```javascript
const sessionType = IdeationBriefGenerator.getSessionType(selectedIdea, ideaConcepts);
const buttonLabel = sessionType === 'spec' ? '📋 Generate Spec'
  : sessionType === 'claude-md' ? '📄 Generate CLAUDE.md'
  : '🗣️ Explore in Chat';
```

The modal title should also reflect this:
```javascript
const modalTitle = sessionType === 'spec' ? `Generate Spec — ${idea.name}`
  : sessionType === 'claude-md' ? `Generate CLAUDE.md — ${idea.name}`
  : `Explore in Chat — ${idea.name} (Session ${sessionNum})`;
```

---

#### B4: Spec and CLAUDE.md Detection in Inbound Flow

**Location:** Deploy tab ODRC detection and `ODRCImportChecklistModal`

**Problem:** Currently the deploy tab only detects ODRC update content. It doesn't recognize when a spec document or CLAUDE.md comes back from Chat.

**Fix:** Extend the inbound detection to handle three artifact types:

```javascript
function detectInboundArtifactType(fileContent) {
  // Check for ODRC updates (existing)
  if (detectODRCContent(fileContent)) return 'odrc';
  
  // Check for CLAUDE.md
  if (/^# CLAUDE\.md/m.test(fileContent) && /^# cc-spec-id:/m.test(fileContent)) return 'claude-md';
  
  // Check for spec document
  if (/^## Task Summary/m.test(fileContent) && /^## What to Build/m.test(fileContent)) return 'spec';
  
  return null; // Not a pipeline artifact
}
```

**For spec artifacts:**
- Push to repo at `docs/sessions/{slug}/specs/{session-id}-spec.md`
- Add session log entry with `type: 'spec'`
- Show confirmation: "Spec document stored. Next session will generate CLAUDE.md."

**For CLAUDE.md artifacts:**
- Push to repo at root level as `CLAUDE.md` (or let developer choose path)
- Add session log entry with `type: 'claude-md'`
- Show confirmation: "CLAUDE.md ready for Code session."
- Offer "Copy to clipboard" for immediate use

**For ODRC artifacts:**
- Existing flow (checklist modal, concept import)

**Note:** A single file may contain BOTH a spec/CLAUDE.md AND ODRC updates. In that case, handle both: push the full doc, AND extract and process the ODRC section.

---

## Existing Infrastructure Reference

| Component | Location | What to Change |
|-----------|----------|---------------|
| `IdeationBriefGenerator` | ~line 3386 | Add session type detection, three system prompts, locked template |
| `IdeationBriefGenerator.getHandshakePrompt()` | ~line 3551 | Add session type to prompt |
| `IdeationBriefGenerator.buildTemplateBrief()` | ~line 3501 | Fix RESOLVE format, conditional zip text, clean ODRC header |
| `IdeaManager.addSessionLogEntry()` | ~line 5734 | Add type field |
| `IdeaManager.create()` | ~line 5762 | Ensure name/description separation |
| `ODRCImportChecklistModal` | ~line 12152 | Add auto-create idea option |
| `ExploreInChatModal` | ~line 17921 | Dynamic button label, truncated title |
| `Ideas View Mode 1` | ~line 18150 | Filter empty apps |
| `Ideas View Mode 2` | ~line 18260 | Add Explore in Chat to Idea chips |
| `Ideas View Mode 3` | ~line 18302 | Dynamic button label |
| `detectODRCContent()` | ~line 2760 | Extended to detectInboundArtifactType() |
| `executeODRCImport()` | ~line 2818 | Pass session type |
| Completion file poller | (App component) | Convert to notification banners |
| Orphan detection | (App component) | Convert to notification banners |

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
- All listener useEffect blocks must return a cleanup function

---

## Conventions

- **Slug format:** kebab-case, max 60 chars, generated from idea NAME (not description)
- **Session ID format:** `S-YYYY-MM-DD-NNN`
- **Session doc path:** `docs/sessions/{slug}/S-YYYY-MM-DD-NNN.md`
- **Spec doc path:** `docs/sessions/{slug}/specs/S-YYYY-MM-DD-NNN-spec.md`
- **Notification auto-dismiss:** 30 seconds
- **Idea name max length:** 80 chars (soft limit with counter)

---

## File Structure

```
cc/
  index.html                       ← All changes here
  specs/
    sp_ideation_ux_pipeline.md     ← This CLAUDE.md archived after completion
```

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_ideation_ux_pipeline.md`
3. Generate a completion file to `.cc/completions/` per the format below
4. Commit the spec archive and completion file together in a separate commit

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_ideation-ux-pipeline.md`

**Completion file format:**

```yaml
---
task: "Ideation Pipeline UX fixes and pipeline completeness — session types, locked CLAUDE.md template, notification banners, Idea name separation"
status: complete | partial
cc-spec-id: sp_ideation_ux_pipeline
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{implementation decisions}"
  resolved_opens:
    - "{resolved}"
  new_opens:
    - "{new questions}"
unexpected_findings:
  - "{unexpected}"
unresolved:
  - "{not completed}"
---

## Approach

{Brief narrative of build approach}

## Implementation Notes

{Key technical details}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
