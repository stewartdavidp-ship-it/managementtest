# CLAUDE.md — Ideation Workflow: Idea-to-Chat Pipeline
# cc-spec-id: sp_ideation_pipeline
# App: Command Center (index.html)
# Base version: 8.60.1 (or current)
# Target version: 8.61.0
# Depends on: none (new feature, extends existing infrastructure)

---

## Before You Begin

This is a large feature spanning data model changes, outbound brief generation, inbound ODRC import routing, and UI work across multiple views. Review the full scope below, then tell me:

1. Can you complete this in one session, or should we split into two phases?
2. If splitting, where would you draw the line?

Provide your assessment before writing any code. I'll confirm the approach.

---

## Task Summary

Build the complete Idea-to-Chat pipeline in Command Center. This enables a developer to take an Idea from CC into a Claude Chat session for structured ODRC exploration, then bring the session output back into CC where concepts are updated and the Idea accumulates state across sessions. The full cycle: Idea → CC generates brief → Chat explores in ODRC terms → output returns via deploy tab → concepts updated → next session builds on accumulated state.

---

## What to Build

### Phase 1: Data Model Extensions

**IdeaManager** (currently at ~line 5396)

The current `IdeaManager.update()` only allows `name`, `description`, `status`. Extend with:

**New fields on Idea schema:**
```
slug            — string, kebab-case, auto-generated from name
sessionLog      — array of { sessionId, date, docPath, summary, conceptsCreated, conceptsResolved }
lastSessionDate — timestamp
phase           — string: "exploring" | "converging" | "spec-ready" (or null for computed)
```

**New methods:**

```javascript
// Slug generation — call on Idea creation
IdeaManager.generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

// Add session log entry — call after ODRC import
IdeaManager.addSessionLogEntry(uid, ideaId, {
  sessionId,         // "S-2026-02-12-001" format
  date,              // timestamp
  docPath,           // "docs/sessions/{slug}/S-2026-02-12-001.md"
  summary,           // AI-generated string
  conceptsCreated,   // number
  conceptsResolved   // number
})
// This writes to the sessionLog array AND updates lastSessionDate
```

**Extend `IdeaManager.update()`** to also allow: `slug`, `phase`

**Auto-generate slug on Idea creation:** When an Idea is created, generate slug from name. Check uniqueness within the Idea's app scope. If duplicate, append `-2`, `-3`, etc.

**Phase computation function** (standalone utility, not on IdeaManager):

```javascript
function computeIdeaPhase(concepts) {
  // concepts = array of concept objects scoped to this idea (ideaOrigin match)
  const active = concepts.filter(c => c.status === 'active');
  const opens = active.filter(c => c.type === 'OPEN').length;
  const decisions = active.filter(c => c.type === 'DECISION').length;
  const rules = active.filter(c => c.type === 'RULE').length;
  const constraints = active.filter(c => c.type === 'CONSTRAINT').length;
  const total = active.length;

  // Check spec-ready first (highest priority)
  if (opens === 0 || (opens <= 2 && decisions >= 10)) return 'spec-ready';
  // Then converging
  if (decisions >= opens && (rules > 0 || constraints > 0)) return 'converging';
  // Default
  return 'exploring';
}
```

If the Idea has a manually set `phase` value (non-null), use it instead of computed. Display a mismatch indicator if computed !== manual.

---

### Phase 2: Outbound — Brief Generation

**New service: IdeationBriefGenerator**

Create as a standalone JS object (same pattern as SessionBriefGenerator, ConceptManager, IdeaManager — per Decision 42: all managers are standalone JS objects).

```javascript
const IdeationBriefGenerator = {
  // Main entry point
  async generate(idea, app, concepts, globalConcepts) {
    // 1. Gather idea context
    const ideaContext = this.buildIdeaContext(idea, concepts);
    // 2. Gather app context
    const appContext = this.buildAppContext(app, globalConcepts);
    // 3. Build ODRC state summary using ODRCSummaryGenerator
    const odrcState = ODRCSummaryGenerator.generateScoped(concepts, [idea], null);
    // 4. Call ClaudeAPIService to generate the brief
    const brief = await ClaudeAPIService.call({
      model: 'claude-sonnet-4-20250514',
      system: this.SYSTEM_PROMPT,
      userMessage: this.buildUserMessage(ideaContext, appContext, odrcState),
      maxTokens: 4096
    });
    return brief;
  },

  SYSTEM_PROMPT: `You are generating a session brief for a structured ideation conversation.
The brief will be uploaded to Claude Chat along with a standardized prompt.
Generate a markdown document with these sections:
- Session header (idea name, app, session number, current version)
- "What are you looking to get out of today's session?" — ask the developer to state their goal
- Idea Summary — what this idea is about
- Prior Session Summary — if sessions exist, summarize the most recent
- Current ODRC State — all active concepts grouped by type (OPEN, DECISION, RULE, CONSTRAINT)
- Expected Output Format — the ODRC Updates format with header metadata block:
  ## ODRC Updates
  # Idea: {idea-slug}
  # Session: {session-number}
  # App: {app-id}
  Followed by lines using: NEW DECISION/OPEN/RULE/CONSTRAINT and RESOLVE OPEN formats
- Supporting Documents — note what else is in the zip

Frame everything in ODRC terms. The brief should make it easy for Chat to pick up context and produce structured ODRC output at session end.`,

  buildIdeaContext(idea, concepts) { /* idea name, desc, slug, phase, sessionLog */ },
  buildAppContext(app, globalConcepts) { /* app name, version, constraining decisions */ },
  buildUserMessage(ideaContext, appContext, odrcState) { /* structured prompt */ },

  // Standardized handshake prompt — three variable slots only
  getHandshakePrompt(ideaName, sessionNumber, appName) {
    return `Please review the attached session brief and supporting documents for ${ideaName} (Session ${sessionNumber}, App: ${appName}).

Confirm you've reviewed the materials, then ask me what I want to accomplish in this session.

Frame all exploration using the ODRC model (OPENs, Decisions, Rules, Constraints). At the end of the session, produce a structured ODRC Updates section using the format defined in the brief.`;
  }
};
```

**Zip packaging:**

Use JSZip (install if needed: `npm install jszip`). Package:
```
session-brief-{slug}-S{NNN}.zip
├── CC-Session-Brief-{Idea-Name}-S{NNN}.md    // Generated brief
├── ODRC-Updates-{slug}-latest.md              // Previous session's ODRC output (if exists)
└── [optional] index.html                       // CC codebase (if phase is converging/spec-ready)
```

Supporting documents included based on context:
- Previous session ODRC output: always included if prior sessions exist
- Codebase: included when phase is `converging` or `spec-ready`, or when developer requests
- ODRC consolidated doc: included for architectural-level ideas

**Size-aware output:**
- If brief text < 8000 characters → offer Copy to Clipboard as primary
- If brief text ≥ 8000 characters → package as zip (primary path)
- Standardized handshake prompt is ALWAYS copyable regardless of size

**"Explore in Chat" button** on Idea Detail view (~line 17407):

Add alongside existing actions (Add Concept, Graduate, Archive). When clicked, opens the ExploreInChatModal.

**ExploreInChatModal:**

```
┌─────────────────────────────────────────────────────────────┐
│  Explore in Chat — {Idea Name} (Session {N})                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Brief preview — scrollable markdown render]               │
│                                                             │
│  Included in package:                                       │
│  ✓ Session brief (12.4 KB)                                  │
│  ✓ Previous ODRC updates (3.1 KB)                           │
│  ○ CC codebase (not included — phase: exploring)            │
│                                                             │
│  [Copy Prompt]          [Download Zip]     [Push to Repo]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Copy Prompt** — copies the standardized handshake prompt to clipboard
- **Download Zip** — downloads the zip package (or "Copy Brief" if below size threshold)
- **Push to Repo** — saves brief to `docs/sessions/{slug}/S-YYYY-MM-DD-NNN.md` via GitHub API

Session number = `(idea.sessionLog?.length || 0) + 1`

When prior sessions exist, enrich the brief generation:
- Include session log table (all prior sessions with summaries)
- Expanded summary of most recent session
- Flag any OPENs persisting across 2+ sessions as "long-standing"

---

### Phase 3: Inbound — Return Path

**Extend deploy tab file detection:**

When a file lands in the deploy tab, add ODRC content detection BEFORE existing code routing:

```javascript
// Detection logic — content-based
function detectODRCContent(fileContent) {
  const hasODRCHeader = /^##\s+ODRC Updates/m.test(fileContent);
  const odrcPatterns = [
    /^-\s+NEW\s+(DECISION|OPEN|RULE|CONSTRAINT):/m,
    /^-\s+RESOLVE\s+OPEN:/m
  ];
  const patternMatches = odrcPatterns.filter(p => p.test(fileContent)).length;

  return hasODRCHeader || patternMatches >= 2;
}

// Metadata extraction
function extractODRCMetadata(fileContent) {
  const ideaMatch = fileContent.match(/^#\s*Idea:\s*(.+)$/m);
  const sessionMatch = fileContent.match(/^#\s*Session:\s*(.+)$/m);
  const appMatch = fileContent.match(/^#\s*App:\s*(.+)$/m);

  return {
    ideaId: ideaMatch ? ideaMatch[1].trim() : null,
    sessionNumber: sessionMatch ? sessionMatch[1].trim() : null,
    appId: appMatch ? appMatch[1].trim() : null
  };
}

// ODRC section extraction (for dual-track processing)
function extractODRCSection(fileContent) {
  const odrcStart = fileContent.indexOf('## ODRC Updates');
  if (odrcStart === -1) return null;
  return fileContent.substring(odrcStart);
}
```

**Routing flow:**
1. File arrives in deploy tab
2. `detectODRCContent()` → if true, enter ODRC flow
3. `extractODRCMetadata()` → try to auto-link to Idea
4. If metadata found → look up Idea by slug/id, pre-populate checklist
5. If no metadata → show Idea picker dropdown (all active ideas, grouped by app)
6. Parse ODRC updates using existing `ODRCUpdateIngestionService.parse()`
7. Present confirmation checklist

**Dual-track file handling:**
If the inbound file contains both session content and ODRC updates:
- Extract ODRC section → route to checklist
- Full file → push to GitHub at `docs/sessions/{slug}/S-YYYY-MM-DD-NNN.md`
- Both happen in one flow after checklist confirmation

**Editable Confirmation Checklist Modal (ODRCImportChecklistModal):**

```
┌─────────────────────────────────────────────────────────────┐
│  ODRC Import — {Idea Name} (Session {N})                    │
│  Linked Idea: {slug}  [Change ▾]                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  For each parsed item, show:                                │
│  ☑ [checkbox]                                               │
│    Action: [NEW ▾ / RESOLVE ▾]                              │
│    Type:   [DECISION ▾ / OPEN ▾ / RULE ▾ / CONSTRAINT ▾]   │
│    Description: [editable textarea]                         │
│                                                             │
│  If duplicate detected:                                     │
│  ⚠ Similar to existing: "{concept content}"                 │
│    [Create Anyway] [Skip] [Merge → Update Existing]         │
│                                                             │
│  For RESOLVE items targeting already-resolved concepts:      │
│  ☐ (auto-unchecked) "Already resolved"                      │
│                                                             │
│  [Cancel]                        [Apply {N} Updates]        │
└─────────────────────────────────────────────────────────────┘
```

Every field is editable: checkbox, type dropdown, action dropdown, description text, idea linkage.

**Duplicate detection:**
Before presenting the checklist, compare each NEW item against existing concepts scoped to the linked Idea. Split descriptions into words, skip common words (the, is, a, and, for, to, in, of). If overlap > 50% of shorter description's words, flag as potential duplicate. Developer makes the final call: create anyway, skip, or merge into existing.

For RESOLVE items: if target concept is already resolved, auto-uncheck with "Already resolved" indicator.

**On confirm (Apply Updates):**

```javascript
async function executeODRCImport(uid, linkedIdea, checkedItems, globalIdeas) {
  // 1. Execute concept updates via ODRCUpdateIngestionService.execute()
  //    Set ideaOrigin on each new concept to linkedIdea.id
  const results = await ODRCUpdateIngestionService.execute(uid, checkedItems, globalIdeas);

  // 2. Generate summary via ClaudeAPIService
  const summary = await ClaudeAPIService.call({
    model: 'claude-haiku-4-5-20251001',
    system: 'Generate a one-sentence summary of these ODRC updates for a session log.',
    userMessage: checkedItems.map(i => `${i.action} ${i.type}: ${i.description}`).join('\n'),
    maxTokens: 200
  });

  // 3. Add session log entry
  await IdeaManager.addSessionLogEntry(uid, linkedIdea.id, {
    sessionId: generateSessionId(),  // S-YYYY-MM-DD-NNN format
    date: Date.now(),
    docPath: `docs/sessions/${linkedIdea.slug}/${generateSessionId()}.md`,
    summary: summary,
    conceptsCreated: results.created,
    conceptsResolved: results.resolved
  });

  // 4. Show results
  // Phase is computed on render, no write needed unless manual override
  return {
    created: results.created,
    resolved: results.resolved,
    summary: summary
  };
}
```

**Results display after import:**
```
Session S-2026-02-12-003 imported
4 concepts created, 2 OPENs resolved
Phase: exploring → converging
```

---

### Phase 4: Continuity & UI Enhancements

**Idea Detail view enhancements (~line 17407):**

Add to the existing Idea Detail view:
- **Phase badge** — colored indicator: exploring (blue), converging (amber), spec-ready (green). If manual override differs from computed, show mismatch indicator.
- **Session history section** — collapsible list of prior sessions with date, summary, concept counts
- **Last session date** — shown near phase badge, with "stale" indicator if > 14 days with active OPENs

**Idea list view:**
- Add phase badge next to each idea name
- Add lastSessionDate as sortable column or subtitle

---

## Existing Infrastructure Reference

These components exist and should be extended, not replaced:

| Component | Location | What It Does |
|-----------|----------|-------------|
| `ClaudeAPIService` | ~line 2395 | `call({ model, system, userMessage, maxTokens })` — API calls to Claude |
| `ODRCSummaryGenerator` | ~line 2430 | `generateScoped()` / `generateFull()` — renders ODRC state as markdown |
| `ODRCUpdateIngestionService` | ~line 2660 | `parse(text)` / `execute(uid, updates, globalIdeas)` — parses and writes ODRC updates |
| `SessionBriefGenerator` | ~line 2979 | Pattern reference for brief structure (don't call directly for ideation) |
| `ConceptManager` | ~line 5193 | Full CRUD for concepts with transition state machine |
| `IdeaManager` | ~line 5396 | CRUD for ideas — extend with new fields and methods |
| `Idea Detail View` | ~line 17407 | Shows idea with concepts — add Explore in Chat + session history |
| `Deploy Tab` | (existing) | File intake and routing — extend with ODRC detection |

---

## Architecture Rules

### State Management Rules
- All shared Firebase-backed data lives as top-level state in App component with `global` prefix
- Firebase listeners are set up once in the App component's auth useEffect
- Views own local UI state only
- Write to Firebase via service methods, let listener update state

### Data Flow Rules
- Data flows down via props, events flow up via callbacks
- Service objects are global singletons (ConceptManager, IdeaManager, etc.)
- One listener per collection per user
- All listener useEffect blocks must return a cleanup function

### ODRC Rules
- ODRC is the thinking framework — all ideation output structured as OPENs, DECISIONs, RULEs, CONSTRAINTs
- Every session is additive to the decision record — no throwaway sessions
- System behavior is data-driven — phase, summaries, session numbering derived from state, not user input
- Code owns mutations, Chat owns reasoning — this feature bridges Chat back to CC

---

## Conventions

- **Slug format:** kebab-case, same as project/app slugs (e.g., `ideation-workflow-pipeline`)
- **Session ID format:** `S-YYYY-MM-DD-NNN` (e.g., `S-2026-02-12-001`)
- **Session doc path:** `docs/sessions/{idea-slug}/S-YYYY-MM-DD-NNN.md`
- **All new objects** follow the standalone JS object pattern
- **Firebase writes** go through the existing manager layer, never direct
- **UI styling** follows existing CC patterns — use existing CSS classes and modal patterns

---

## File Structure

All changes are within the existing `cc/` directory structure:

```
cc/
  index.html                       ← Main app — all Phase 1-4 changes here
  specs/
    sp_ideation_pipeline.md        ← This CLAUDE.md archived after completion
  docs/
    sessions/                      ← NEW: session document storage
      {idea-slug}/
        S-YYYY-MM-DD-NNN.md       ← Session documents pushed via GitHub API
```

No new standalone files are created — all JavaScript lives in index.html per CC's single-file architecture.

---

## Post-Task Obligations

RULE: Before reporting this task as complete, execute this checklist:

1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_ideation_pipeline.md`
3. Generate a completion file to `.cc/completions/` per the format below
4. Commit the spec archive and completion file together in a separate commit

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_ideation-pipeline.md`

**Completion file format:**

```yaml
---
task: "Implement Ideation Workflow: Idea-to-Chat Pipeline — data model extensions, outbound brief generation, inbound ODRC import routing, and UI enhancements"
status: complete | partial
cc-spec-id: sp_ideation_pipeline
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{any implementation decisions made during build}"
  resolved_opens:
    - "{any OPENs resolved during build}"
  new_opens:
    - "{any new questions that surfaced}"
unexpected_findings:
  - "{anything unexpected discovered during implementation}"
unresolved:
  - "{anything that couldn't be completed}"
---

## Approach

{Brief narrative of how the build was approached — what order, any deviations from spec, why}

## Implementation Notes

{Key technical details that would help Chat validate or the developer understand}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
