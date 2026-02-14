# CLAUDE.md — Session Lifecycle & Idea Phase Model
# cc-spec-id: sp_session_lifecycle
# App: Command Center (index.html)
# Base version: 8.66.0
# Target version: 8.67.0
# Depends on: sp_session_json_schema (Unit 1, implemented in 8.66.0)

---

## Before You Begin

This task adds ideation session lifecycle tracking and the idea phase model to Command Center. It touches the idea data model (IdeaManager), brief generation (IdeationBriefGenerator), the ODRC import flow (executeODRCImport), and phase display (PHASE_COLORS, IdeaWorkCard). Review the full scope below, then tell me:

1. Can you complete this in one session, or should we split into phases?
2. If splitting, where would you draw the line?

Provide your assessment before writing any code. I'll confirm the approach.

---

## Task Summary

Implement two independent state models on idea records: **session state** (pending → active → complete) tracking the current work cycle, and **idea phase** (inception → exploring → converging → spec-ready → complete) tracking cumulative idea maturity. Add an `activeSession` field to ideas for live session tracking, extend PHASE_COLORS and IdeaWorkCard for the full phase set, add inception awareness to IdeationBriefGenerator, and wire session lifecycle into the ODRC import completion flow.

---

## What to Build

### Phase A: Idea Record — activeSession Field & Phase Defaults

**1. Add `activeSession` to idea backfill** (IdeaManager.backfillMissingFields, ~line 5931)

After the existing `phase` backfill (line 5933), add:

```javascript
if (idea.activeSession === undefined) { patch.activeSession = null; needsUpdate = true; }
if (idea.phaseUpdatedAt === undefined) { patch.phaseUpdatedAt = null; needsUpdate = true; }
```

IMPORTANT: Do NOT change the existing `phase` backfill. Existing ideas with `phase: null` should continue computing phase from ODRC ratios. Only *new* ideas will default to `inception`.

**2. Default new ideas to inception phase**

In the idea creation flow (wherever IdeaManager creates a new idea record), set:

```javascript
phase: 'inception',
phaseUpdatedAt: new Date().toISOString(),
activeSession: null
```

Find the creation path — look for where IdeaManager writes a new idea to Firebase (likely in a `create` or `add` method). New ideas get `phase: 'inception'`. Existing ideas are untouched.

**3. Add phase advancement method to IdeaManager**

Add a new method:

```javascript
async advancePhase(uid, ideaId, newPhase) {
    const validPhases = ['inception', 'exploring', 'converging', 'spec-ready', 'complete'];
    if (!validPhases.includes(newPhase)) throw new Error(`Invalid phase: ${newPhase}`);
    await this._ref(uid).child(ideaId).update({
        phase: newPhase,
        phaseUpdatedAt: new Date().toISOString()
    });
    console.log(`[CC] Idea ${ideaId} phase → ${newPhase}`);
}
```

**4. Add activeSession management methods to IdeaManager**

```javascript
async activateSession(uid, ideaId, sessionData) {
    const ideaRef = this._ref(uid).child(ideaId);
    const snap = await ideaRef.child('activeSession').once('value');
    if (snap.val()) throw new Error('Idea already has an active session');
    await ideaRef.child('activeSession').set({
        sessionId: sessionData.sessionId,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        briefDownloaded: false,
        artifactsReceived: 0,
        ideaPhaseAtStart: sessionData.ideaPhaseAtStart
    });
    console.log(`[CC] Session ${sessionData.sessionId} activated on idea ${ideaId}`);
}

async completeSession(uid, ideaId) {
    await this._ref(uid).child(ideaId).child('activeSession').set(null);
}

async abandonSession(uid, ideaId, sessionId) {
    const abandonedEntry = {
        sessionId,
        date: Date.now(),
        summary: 'Session abandoned',
        conceptsCreated: 0,
        conceptsResolved: 0,
        type: 'abandoned',
        status: 'abandoned',
        completedAt: new Date().toISOString()
    };
    await this.addSessionLogEntry(uid, ideaId, abandonedEntry);
    await this._ref(uid).child(ideaId).child('activeSession').set(null);
    console.log(`[CC] Session ${sessionId} abandoned on idea ${ideaId}`);
}

async updateSessionActivity(uid, ideaId, updates) {
    await this._ref(uid).child(ideaId).child('activeSession').update({
        ...updates,
        lastActivityAt: new Date().toISOString()
    });
}
```

---

### Phase B: PHASE_COLORS & Display Updates

**1. Update PHASE_COLORS** (~line 15753)

Replace the existing PHASE_COLORS with:

```javascript
const PHASE_COLORS = {
    inception:    { stripe: '#94a3b8', bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
    exploring:    { stripe: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
    converging:   { stripe: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
    'spec-ready': { stripe: '#f093fb', bg: 'rgba(240,147,251,0.15)', text: '#f093fb' },
    complete:     { stripe: '#22c55e', bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' }
};
```

This removes the unused `building` entry and adds `inception` (slate/gray — provisional) and `complete` (green — done).

**2. Update SessionPackageProcessor.validate()** (~line 2827)

The valid phases list already includes all five values. Verify it matches:

```javascript
const validPhases = ['inception', 'exploring', 'converging', 'spec-ready', 'complete'];
```

This is already correct at line 2827. No change needed — just confirm.

**3. Update computeIdeaPhase()** (~line 5968)

No changes needed. This function returns only `exploring`, `converging`, or `spec-ready` based on ODRC ratios. `inception` and `complete` are always developer-set via manual phase override and are never computed. The existing pattern `idea.phase || computeIdeaPhase(concepts)` handles this correctly — if `idea.phase` is set to `inception` or `complete`, the computed value is never used.

---

### Phase C: IdeationBriefGenerator — Inception Awareness

**1. Update getSessionType()** (~line 3167)

Add inception handling at the top of the function:

```javascript
getSessionType(idea, concepts) {
    const phase = idea.phase || computeIdeaPhase(concepts);
    if (phase === 'inception') return 'exploration'; // inception uses exploration with validation directive
    if (phase === 'complete') return 'exploration';   // shouldn't happen, but safe fallback
    const hasSpec = (idea.sessionLog || []).some(s => s.type === 'spec');
    if (phase === 'spec-ready' && hasSpec) return 'claude-md';
    if (phase === 'spec-ready') return 'spec';
    return 'exploration';
}
```

**2. Update getSystemPrompt() — exploration case** (~line 3286)

In the `default` (exploration) case, add inception awareness. After the existing system prompt string, append a conditional block. The cleanest approach: make `getSystemPrompt` accept the phase and conditionally append.

Update the method signature and the exploration prompt:

```javascript
getSystemPrompt(sessionType, phase = null) {
    switch (sessionType) {
        case 'spec':
            return `...`; // unchanged

        case 'claude-md':
            return `...`; // unchanged

        default: { // exploration
            let prompt = `You are generating a lean session brief for a Claude Chat ideation session.
The developer has skills loaded in claude.ai that handle ODRC framework, session structure, output format, and session protocol. The brief should NOT repeat ODRC definitions, output templates, or behavioral instructions — skills handle all of that.

Generate a markdown document with ONLY these sections:
- Session header (idea name, app, session number, phase)
- Skills Directive — list the specific skills to read (provided in the user message)
- Session Goal — "What are you looking to get out of today's session?"
- Idea Summary — what this idea is about
- Prior Session Summary — if sessions exist, summarize the most recent
- Current ODRC State — all active concepts grouped by type (OPEN, DECISION, RULE, CONSTRAINT)
- Session Metadata — idea slug, IdeaId, app ID, session number (needed for ODRC output routing)

Keep the brief focused on CONTEXT, not INSTRUCTIONS. The skills provide all instructions.`;

            if (phase === 'inception') {
                prompt += `\n\nINCEPTION PHASE: This is a new, unvalidated idea. Add an "Inception Validation" section to the brief BEFORE the Session Goal, with this content:

## Inception Validation
This is a new idea that hasn't been validated yet. Before exploring:
1. Challenge the idea name — does it accurately describe the concept?
2. Pressure-test the topic sentence — is it specific enough to scope work?
3. Confirm the end goal — what does "done" look like for this idea?

Spend the first 3-5 minutes on validation. If answers are confident, move on.
If vague, suggest stepping back to refine the idea definition before deep exploration.`;
            }

            return prompt;
        }
    }
}
```

**3. Update callers of getSystemPrompt** (~line 3315)

In the `generate()` method, pass phase:

```javascript
const brief = await ClaudeAPIService.call({
    model: 'claude-sonnet-4-20250514',
    system: this.getSystemPrompt(sessionType, ideaContext.phase),
    userMessage: this.buildUserMessage(ideaContext, appContext, odrcState, lens, effectiveMode),
    maxTokens: 4096
});
```

Also update the `buildTemplateBrief()` fallback to include the inception section when `phase === 'inception'` — add after the `---` separator and before the Session Goal:

```javascript
if (ideaContext.phase === 'inception') {
    brief += `## Inception Validation\n`;
    brief += `This is a new idea that hasn't been validated yet. Before exploring:\n`;
    brief += `1. Challenge the idea name — does it accurately describe the concept?\n`;
    brief += `2. Pressure-test the topic sentence — is it specific enough to scope work?\n`;
    brief += `3. Confirm the end goal — what does "done" look like for this idea?\n\n`;
    brief += `Spend the first 3-5 minutes on validation. If answers are confident, move on.\n`;
    brief += `If vague, suggest stepping back to refine the idea definition before deep exploration.\n\n`;
    brief += `---\n\n`;
}
```

**4. Enhance buildUserMessage() with debriefSummary** (~line 3364)

After the existing `Most Recent Session` block (~line 3386-3392), add:

```javascript
if (ideaContext.latestSession?.debriefSummary) {
    msg += `**Prior Session Context (Debrief):**\n${ideaContext.latestSession.debriefSummary}\n\n`;
}
```

This surfaces the narrative debrief summary to the AI brief generator, giving it richer context than just the one-line summary.

---

### Phase D: Session Lifecycle Integration in Import Flow

**1. Wire activeSession into ExploreInChatModal** (~line 15811)

When the brief is generated and downloaded, activate the session on the idea:

In `ExploreInChatModal`, after the brief zip is created and download is triggered, add:

```javascript
// Activate session on idea
try {
    await IdeaManager.activateSession(firebaseUid, idea.id, {
        sessionId: generateSessionId(sessionNum),
        ideaPhaseAtStart: phase
    });
} catch (e) {
    console.warn('[CC] Session activation failed:', e.message);
    // Don't block brief download — this is bookkeeping
}
```

Look for where the brief zip download is triggered in this component. The session activation should happen at the same point. If the idea already has an `activeSession`, `activateSession()` will throw — catch it and show a warning to the user: "Session {existingId} is already active. Complete or abandon it first."

**2. Wire session completion into executeODRCImport** (~line 3046)

After the session log entry is added (line ~3101), clear the active session:

```javascript
await IdeaManager.addSessionLogEntry(uid, linkedIdea.id, sessionLogEntry);

// Clear active session if this import completes it
if (linkedIdea.activeSession) {
    // Enrich the session log entry with lifecycle fields
    sessionLogEntry.status = 'complete';
    sessionLogEntry.completedAt = new Date().toISOString();
    sessionLogEntry.ideaPhaseAtStart = linkedIdea.activeSession.ideaPhaseAtStart;
    sessionLogEntry.ideaPhaseAtEnd = linkedIdea.phase || computeIdeaPhase(
        (await IdeaManager.getConcepts?.(uid, linkedIdea.id)) || []
    );
    await IdeaManager.completeSession(uid, linkedIdea.id);
}
```

Note: The enrichment fields should be set BEFORE `addSessionLogEntry()` is called. Reorder if needed — set the lifecycle fields on `sessionLogEntry` first, then write it.

**3. Add one-active-session guard to ExploreInChatModal**

At the top of the modal's brief generation flow, check for active session:

```javascript
if (idea.activeSession) {
    showAlert(`Session ${idea.activeSession.sessionId} is already active for this idea. Complete or abandon it before starting a new session.`);
    return;
}
```

---

## Existing Infrastructure Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `IdeaManager` | ~line 5785 | Idea CRUD, backfill, session log management |
| `IdeaManager.backfillMissingFields()` | ~line 5906 | Adds missing fields to existing ideas |
| `IdeaManager.addSessionLogEntry()` | ~line 3101 (called) | Appends entry to idea.sessionLog |
| `computeIdeaPhase()` | ~line 5968 | Computes phase from ODRC ratios (exploring/converging/spec-ready) |
| `generateSessionId()` | ~line 5984 | Generates S-YYYY-MM-DD-NNN format IDs |
| `PHASE_COLORS` | ~line 15753 | Color definitions for phase badges |
| `IdeaWorkCard` | ~line 15760 | Landing page idea card component |
| `ExploreInChatModal` | ~line 15811 | Brief generation + download modal |
| `IdeationBriefGenerator` | ~line 3165 | Session brief generation (system prompts, user messages) |
| `IdeationBriefGenerator.getSessionType()` | ~line 3167 | Determines exploration/spec/claude-md from phase |
| `IdeationBriefGenerator.getSystemPrompt()` | ~line 3195 | System prompts for brief AI generation |
| `IdeationBriefGenerator.buildUserMessage()` | ~line 3364 | Constructs user message for brief AI generation |
| `IdeationBriefGenerator.buildTemplateBrief()` | ~line 3417 | Fallback template when AI unavailable |
| `executeODRCImport()` | ~line 3046 | ODRC import execution + session log entry creation |
| `SessionPackageProcessor` | ~line 2811 | Validates/processes session.json packages |
| `SessionPackageProcessor.validate()` | ~line 2812 | Schema validation with valid phases list |
| `SessionService` | ~line 1375 | LEGACY build session tracker — do NOT modify |
| `ODRCImportChecklistModal` | ~line 12411 | Import checklist UI for ODRC ingestion |

---

## Architecture Rules

### State Management Rules
- Ideation session lifecycle lives on the idea record (`activeSession` field + `sessionLog` array), NOT on the legacy `SessionService`
- `activeSession` is a top-level field on the idea for fast landing page rendering — not buried in sessionLog
- When session completes, `activeSession` → `null` and enriched entry appends to `sessionLog`
- Phase is either developer-set (manual override) or computed from ODRC ratios — `computeIdeaPhase()` only returns `exploring`, `converging`, `spec-ready`
- `inception` and `complete` are always developer-set, never computed

### Data Flow Rules
- Brief generation → activates session → sets `activeSession` on idea
- ODRC import → completes session → clears `activeSession`, appends to `sessionLog`
- Abandon → writes abandoned entry to `sessionLog`, clears `activeSession`
- Phase advancement → developer-triggered via `IdeaManager.advancePhase()`, never automatic
- Existing ideas with `phase: null` continue using computed phase — do NOT retroactively set to inception

---

## Conventions

- Phase values: `inception`, `exploring`, `converging`, `spec-ready`, `complete` (lowercase, hyphenated)
- Session ID format: `S-YYYY-MM-DD-NNN` (generated by `generateSessionId()`)
- Timestamps: ISO 8601 strings for Firebase fields, `Date.now()` epoch millis for sessionLog `date` field (matches existing pattern)
- Console logging: `[CC]` prefix for all ideation-related logs

---

## File Structure

All changes are in `index.html` (single-file app):

| Section | Changes |
|---------|---------|
| IdeaManager (~line 5785) | Add `activateSession()`, `completeSession()`, `abandonSession()`, `advancePhase()`, `updateSessionActivity()` methods. Update `backfillMissingFields()`. Update idea creation to default `phase: 'inception'`. |
| PHASE_COLORS (~line 15753) | Replace with 5-phase set (remove `building`, add `inception` + `complete`) |
| IdeationBriefGenerator (~line 3165) | Update `getSessionType()`, `getSystemPrompt()`, `generate()`, `buildTemplateBrief()`, `buildUserMessage()` |
| ExploreInChatModal (~line 15811) | Add session activation on brief download, add active-session guard |
| executeODRCImport (~line 3046) | Add session completion on successful import |

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit all code changes
2. Archive this CLAUDE.md to `cc/specs/sp_session_lifecycle.md`
3. Generate completion file to `.cc/completions/`
4. Commit spec archive and completion file separately

Completion file format:
```yaml
# .cc/completions/sp_session_lifecycle.yaml
spec_id: sp_session_lifecycle
task: "Session Lifecycle & Idea Phase Model"
status: complete  # complete | partial | blocked
version: "8.67.0"
date: YYYY-MM-DD
changes:
  - "Added activeSession field to idea records with activate/complete/abandon methods"
  - "Updated PHASE_COLORS to 5-phase model (inception, exploring, converging, spec-ready, complete)"
  - "Added inception validation directive to IdeationBriefGenerator"
  - "Wired session lifecycle into brief generation and ODRC import flows"
  - "Enhanced brief generation with debriefSummary context"
notes: ""
tests_passed: true
files_modified:
  - index.html
```
