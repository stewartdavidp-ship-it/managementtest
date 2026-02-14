# CLAUDE.md — Session JSON Schema & Package Processor
# cc-spec-id: feat_session_json_schema
# App: Command Center (index.html)
# Base version: 8.65.3
# Target version: 8.66.0
# Depends on: none

---

## Before You Begin

Review the scope of this task. It adds a new ingestion path (session.json) alongside the existing markdown ODRC path. The existing path is **not** being removed — both run in parallel during the transition period.

Ask yourself: does this need to be split into phases? Likely yes:
- **Phase A:** `SessionPackageProcessor` service + session.json detection in zip/file ingestion
- **Phase B:** ODRC item processing from session.json → `ConceptManager` calls
- **Phase C:** Ideation session record creation in Firebase + `debrief_summary` storage
- **Phase D:** Wire into `IdeaManager.addSessionLogEntry()` with enriched data from session.json

If any single phase is too large, split further. Commit after each phase.

---

## Task Summary

Add a `SessionPackageProcessor` service that detects and processes `session.json` files from session output zip packages. This is a new JSON-based ingestion path that runs alongside the existing markdown ODRC parser. It reads structured ODRC items directly from JSON (no regex), creates/resolves concepts via `ConceptManager`, stores an ideation session record in Firebase, and enriches `IdeaManager` session log entries with chain metadata, debrief summaries, and pacing data.

---

## What to Build

### A1: Schema Version Constant

Add near the top of the data services section (~line 2700, after `ODRCUpdateIngestionService`):

```javascript
const SESSION_JSON_SCHEMA_VERSION = '1.0.0';
```

### A2: SessionPackageProcessor Service

Add after `ODRCUpdateIngestionService` (~line 2810):

```javascript
// =========================================================================
// SESSION PACKAGE PROCESSOR (v8.66.0 — Session JSON Ingestion)
// =========================================================================

const SessionPackageProcessor = {
    // Validate session.json against expected schema
    validate(sessionData) {
        const errors = [];
        const warnings = [];

        // Required root fields
        const requiredRoot = ['schema_version', 'session_id', 'date', 'idea', 'app', 'context_summary', 'session_config', 'chain', 'odrc', 'debrief_summary', 'next_session', 'artifacts'];
        for (const field of requiredRoot) {
            if (sessionData[field] === undefined || sessionData[field] === null) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Schema version check
        if (sessionData.schema_version && sessionData.schema_version !== SESSION_JSON_SCHEMA_VERSION) {
            warnings.push(`Schema version mismatch: expected ${SESSION_JSON_SCHEMA_VERSION}, got ${sessionData.schema_version}`);
        }

        // Idea ref validation
        if (sessionData.idea) {
            if (!sessionData.idea.slug) errors.push('Missing idea.slug');
            if (!sessionData.idea.id) errors.push('Missing idea.id');
            const validPhases = ['inception', 'exploring', 'converging', 'spec-ready', 'complete'];
            if (sessionData.idea.phase && !validPhases.includes(sessionData.idea.phase)) {
                warnings.push(`Unknown idea phase: ${sessionData.idea.phase}`);
            }
        }

        // Chain validation
        if (sessionData.chain) {
            if (typeof sessionData.chain.link_count !== 'number') errors.push('chain.link_count must be a number');
            if (!Array.isArray(sessionData.chain.links)) errors.push('chain.links must be an array');
        }

        // ODRC validation
        if (sessionData.odrc) {
            if (!Array.isArray(sessionData.odrc.items)) errors.push('odrc.items must be an array');
            const validTypes = ['decision', 'rule', 'constraint', 'open_new', 'open_resolved'];
            (sessionData.odrc.items || []).forEach((item, i) => {
                if (!validTypes.includes(item.type)) errors.push(`odrc.items[${i}]: invalid type "${item.type}"`);
                if (!item.text) errors.push(`odrc.items[${i}]: missing text`);
            });
        }

        // Artifacts — every file must be listed
        if (sessionData.artifacts && !Array.isArray(sessionData.artifacts)) {
            errors.push('artifacts must be an array');
        }

        return { valid: errors.length === 0, errors, warnings };
    },

    // Map ODRC item type from session.json to ConceptManager type
    mapODRCType(jsonType) {
        switch (jsonType) {
            case 'decision': return 'DECISION';
            case 'rule': return 'RULE';
            case 'constraint': return 'CONSTRAINT';
            case 'open_new': return 'OPEN';
            case 'open_resolved': return 'OPEN'; // Resolved — handled separately
            default: return null;
        }
    },

    // Convert session.json ODRC items to ODRCUpdateIngestionService-compatible format
    // This lets us reuse the existing import UI (checklist, idea linking, etc.)
    toIngestionUpdates(sessionData) {
        const updates = [];
        for (const item of (sessionData.odrc?.items || [])) {
            if (item.type === 'open_resolved') {
                updates.push({
                    action: 'resolve',
                    type: 'OPEN',
                    description: item.original_open || item.text,
                    conceptId: null,
                    resolution: item.text
                });
            } else {
                const mappedType = this.mapODRCType(item.type);
                if (mappedType) {
                    updates.push({
                        action: 'create',
                        type: mappedType,
                        description: item.text,
                        targetIdea: null, // Will be set to idea.id from session.json
                        sourceLink: item.source_link,
                        isTangent: item.is_tangent || false,
                        affinity: item.affinity || null
                    });
                }
            }
        }
        return updates;
    },

    // Build enriched session log entry from session.json
    buildSessionLogEntry(sessionData) {
        const odrc = sessionData.odrc?.counts || {};
        return {
            sessionId: sessionData.session_id,
            date: sessionData.date,
            summary: sessionData.context_summary,
            conceptsCreated: (odrc.decisions_new || 0) + (odrc.rules_new || 0) + (odrc.constraints_new || 0) + (odrc.opens_new || 0),
            conceptsResolved: odrc.opens_resolved || 0,
            type: sessionData.session_config?.mode || 'exploration',
            // Enriched fields from session.json
            chain: sessionData.chain ? {
                linkCount: sessionData.chain.link_count,
                summation: sessionData.chain.summation,
                totalConceptBlocks: (sessionData.chain.links || []).reduce((sum, l) => sum + (l.concept_blocks || 0), 0),
                totalElapsedMinutes: (sessionData.chain.links || []).reduce((sum, l) => sum + (l.elapsed_minutes || 0), 0)
            } : null,
            debriefSummary: sessionData.debrief_summary || null,
            nextSession: sessionData.next_session || null,
            schemaVersion: sessionData.schema_version
        };
    },

    // Extract metadata for the pending import UI (matches extractODRCMetadata format)
    extractMetadata(sessionData) {
        return {
            ideaSlug: sessionData.idea?.slug || null,
            ideaId: sessionData.idea?.id || null,
            sessionNumber: sessionData.session_id || null,
            appId: sessionData.app || null
        };
    }
};
```

### A3: Update `detectInboundArtifactType()` — Add session-json Detection

**Location:** ~line 2888

Add session.json detection as the **highest priority** check (before ODRC check), since session.json files also contain ODRC data and would otherwise match the ODRC pattern:

```javascript
function detectInboundArtifactType(fileContent) {
    if (!fileContent || typeof fileContent !== 'string') return null;

    // Check for session.json (highest priority — contains ODRC data inside JSON)
    try {
        const parsed = JSON.parse(fileContent);
        if (parsed.schema_version && parsed.session_id && parsed.odrc) return 'session-json';
    } catch {} // Not JSON, continue to other checks

    // Check for ODRC updates (existing detection)
    if (detectODRCContent(fileContent)) return 'odrc';
    // Check for CLAUDE.md (has both header and spec-id)
    if (/^# CLAUDE\.md/m.test(fileContent) && /^# cc-spec-id:/m.test(fileContent)) return 'claude-md';
    // Check for spec document
    if (/^## Task Summary/m.test(fileContent) && /^## What to Build/m.test(fileContent)) return 'spec';
    return null;
}
```

### A4: Update Zip Ingestion — Session JSON Path

**Location:** ~line 7319 (inside the zip entry processing loop)

After the existing `detectInboundArtifactType` call, add session-json handling. Find this block:

```javascript
if (isText) {
    const artifactType = detectInboundArtifactType(content);
    const hasOdrcSection = extractODRCSection(content);

    if (artifactType === 'odrc') {
```

Add the session-json case **before** the `odrc` case:

```javascript
if (isText) {
    const artifactType = detectInboundArtifactType(content);
    const hasOdrcSection = extractODRCSection(content);

    if (artifactType === 'session-json') {
        console.log('[CC] session.json detected in zip entry:', file.relativePath);
        try {
            const sessionData = JSON.parse(content);
            const validation = SessionPackageProcessor.validate(sessionData);
            if (validation.valid || validation.errors.length === 0) {
                const metadata = SessionPackageProcessor.extractMetadata(sessionData);
                const parsed = SessionPackageProcessor.toIngestionUpdates(sessionData);
                if (parsed.length > 0) {
                    setPendingOdrcImport({
                        fileName: file.relativePath,
                        fullContent: content,
                        odrcSection: null,
                        metadata,
                        parsedUpdates: parsed,
                        sourceApp: appId,
                        artifactType: 'session-json',
                        sessionData // Carry full session.json for enriched processing
                    });
                }
                if (validation.warnings.length > 0) {
                    console.warn('[CC] session.json warnings:', validation.warnings);
                }
            } else {
                console.error('[CC] session.json validation failed:', validation.errors);
            }
        } catch (e) {
            console.error('[CC] session.json parse error:', e.message);
        }
    } else if (artifactType === 'odrc') {
```

### A5: Update Single-File Drop — Session JSON Path

**Location:** ~line 7738 (inside the non-zip file drop handler)

Apply the same pattern. Find:

```javascript
if (isText) {
    const artifactType = detectInboundArtifactType(content);
    const hasOdrcSection = extractODRCSection(content);

    if (artifactType === 'odrc') {
```

Add session-json before odrc, same as A4 pattern but adapted for single file context:

```javascript
    if (artifactType === 'session-json') {
        console.log('[CC] session.json detected in single file:', file.name);
        try {
            const sessionData = JSON.parse(content);
            const validation = SessionPackageProcessor.validate(sessionData);
            if (validation.valid) {
                const metadata = SessionPackageProcessor.extractMetadata(sessionData);
                const parsed = SessionPackageProcessor.toIngestionUpdates(sessionData);
                if (parsed.length > 0) {
                    setPendingOdrcImport({
                        fileName: cleanedName,
                        fullContent: content,
                        odrcSection: null,
                        metadata,
                        parsedUpdates: parsed,
                        sourceApp: suggestedApp,
                        artifactType: 'session-json',
                        sessionData
                    });
                }
            } else {
                console.error('[CC] session.json validation failed:', validation.errors);
            }
        } catch (e) {
            console.error('[CC] session.json parse error:', e.message);
        }
    } else if (artifactType === 'odrc') {
```

### A6: Update `executeODRCImport()` — Enriched Session Log Entry

**Location:** ~line 2925

The existing `executeODRCImport` function builds a basic session log entry. When the source is session.json, use the enriched data. Find the `IdeaManager.addSessionLogEntry` call (near the end of the function) and update it:

```javascript
// After the existing summary generation, before addSessionLogEntry:

// Build session log entry — enriched from session.json if available
let sessionLogEntry;
if (pendingImport?.sessionData) {
    sessionLogEntry = SessionPackageProcessor.buildSessionLogEntry(pendingImport.sessionData);
    // Override summary with AI-generated one if available
    if (summary && summary !== `${created} concept(s) created, ${resolved} OPEN(s) resolved`) {
        sessionLogEntry.summary = summary;
    }
} else {
    sessionLogEntry = {
        sessionId: `S-${new Date().toISOString().slice(0, 10)}-${String((linkedIdea.sessionLog?.length || 0) + 1).padStart(3, '0')}`,
        date: new Date().toISOString().slice(0, 10),
        summary,
        conceptsCreated: created,
        conceptsResolved: resolved,
        type: sessionType || 'exploration'
    };
}

await IdeaManager.addSessionLogEntry(uid, linkedIdea.id, sessionLogEntry);
```

Note: `executeODRCImport` needs the `pendingImport` object passed through — this may require updating the function signature. The caller has access to `pendingOdrcImport` state which contains `sessionData`.

### A7: Update `IdeaManager.addSessionLogEntry()` — Accept Enriched Fields

**Location:** ~line 5564

The current function destructures a fixed set of fields. Update to pass through enriched fields:

```javascript
async addSessionLogEntry(uid, ideaId, entry) {
    const snapshot = await this._ref(uid).child(ideaId).once('value');
    const idea = snapshot.val();
    if (!idea) throw new Error(`Idea not found: ${ideaId}`);
    const sessionLog = idea.sessionLog || [];
    sessionLog.push({
        sessionId: entry.sessionId,
        date: entry.date,
        docPath: entry.docPath || null,
        summary: entry.summary,
        conceptsCreated: entry.conceptsCreated,
        conceptsResolved: entry.conceptsResolved,
        type: entry.type || 'exploration',
        // Enriched fields from session.json (null if from markdown path)
        chain: entry.chain || null,
        debriefSummary: entry.debriefSummary || null,
        nextSession: entry.nextSession || null,
        schemaVersion: entry.schemaVersion || null
    });
    await this._ref(uid).child(ideaId).update({
        sessionLog,
        lastSessionDate: entry.date,
        updatedAt: new Date().toISOString()
    });
    console.log('[CC] Added session log entry:', entry.sessionId, 'to idea:', ideaId);
},
```

---

## Existing Infrastructure Reference

| Component | Location | Firebase Path | Purpose |
|-----------|----------|---------------|---------|
| `ODRCUpdateIngestionService` | ~line 2708 | — | Regex-based markdown ODRC parser. session.json path bypasses this for structured data. |
| `ConceptManager` | ~line 5327 | `command-center/{uid}/concepts` | CRUD for ODRC concepts. `.create()` and `.resolve()` are the targets. |
| `IdeaManager` | ~line 5530 | `command-center/{uid}/ideas` | Idea CRUD, `.addSessionLogEntry()` gets enriched data. |
| `SessionService` | ~line 1360 | `command-center/{uid}/sessions` | Build/deploy session tracker. **NOT** ideation sessions — do not modify. |
| `IdeationBriefGenerator` | ~line 3030 | — | Reads `idea.sessionLog[]` for brief context. Benefits from enriched entries. |
| `detectInboundArtifactType()` | ~line 2888 | — | Three-path routing → now four-path with `session-json`. |
| `detectODRCContent()` | ~line 2811 | — | Markdown ODRC detection. Unchanged — still used for markdown path. |
| `extractODRCMetadata()` | ~line 2843 | — | Header metadata extraction. `SessionPackageProcessor.extractMetadata()` replaces this for JSON path. |
| `extractODRCSection()` | ~line 2872 | — | ODRC section extraction from markdown. Bypassed for JSON path. |
| `executeODRCImport()` | ~line 2925 | — | Orchestrates import: concepts + summary + session log. Updated to accept enriched data. |
| Zip ingestion loop | ~line 7319 | — | Iterates zip entries, routes by artifact type. Gets new session-json path. |
| Single file drop handler | ~line 7738 | — | Same routing for drag-and-drop files. Gets new session-json path. |
| `pendingOdrcImport` state | ~line 6212 | — | React state holding parsed ODRC for the import checklist modal. Carries `sessionData` for JSON path. |

---

## Architecture Rules

### State Management Rules
- `pendingOdrcImport` state carries both markdown-parsed and session.json-parsed updates in the same format — the import checklist UI doesn't need to know the source
- `sessionData` is an optional field on `pendingOdrcImport` — present only when source is session.json
- All Firebase writes go through existing service methods (`ConceptManager`, `IdeaManager`) — no direct `ref.set()` calls

### Data Flow Rules
- session.json detection is highest priority in `detectInboundArtifactType()` because session.json files contain ODRC data that would otherwise match the markdown ODRC detector
- The JSON path and markdown path coexist — a zip can contain both session.json and an ODRC markdown file. session.json takes precedence; if both are detected, only the session.json path fires
- Enriched session log fields (`chain`, `debriefSummary`, `nextSession`) are nullable — existing code that reads `sessionLog[]` entries won't break on missing fields

---

## Conventions

- **Schema version:** `'1.0.0'` — stored as `SESSION_JSON_SCHEMA_VERSION` constant
- **ODRC type mapping:** session.json uses lowercase (`decision`, `rule`, `constraint`, `open_new`, `open_resolved`); CC internal uses uppercase (`DECISION`, `RULE`, `CONSTRAINT`, `OPEN`). `SessionPackageProcessor.mapODRCType()` handles conversion.
- **Session ID format:** `S-YYYY-MM-DD-NNN` (e.g., `S-2026-02-14-007`)
- **Artifact type string:** `'session-json'` in the detection/routing layer
- **Console logging prefix:** `[CC]` for all session.json processing logs

---

## File Structure

| File | Action |
|------|--------|
| `index.html` | Modified — all changes in this single file |

Changes by section:
- Constants: Add `SESSION_JSON_SCHEMA_VERSION`
- Services: Add `SessionPackageProcessor` service (~120 lines)
- Detection: Update `detectInboundArtifactType()` (~8 lines added)
- Zip ingestion: Add session-json handler (~25 lines)
- Single file drop: Add session-json handler (~25 lines)
- `executeODRCImport()`: Add enriched session log entry path (~15 lines)
- `IdeaManager.addSessionLogEntry()`: Accept enriched fields (~10 lines)

Estimated total: ~220 lines added/modified.

---

## What NOT to Do

- Do NOT remove or modify `ODRCUpdateIngestionService` — the markdown path stays for backward compatibility
- Do NOT modify `SessionService` — that's the build/deploy session tracker, not ideation
- Do NOT modify the ODRC import checklist modal UI — the `toIngestionUpdates()` method outputs in the same format the modal already expects
- Do NOT create a new Firebase path for ideation session records yet — store enriched data on the existing `idea.sessionLog[]` entries. A dedicated ideation-sessions path is a future Unit 2 concern.
- Do NOT modify `detectODRCContent()`, `extractODRCMetadata()`, or `extractODRCSection()` — they serve the markdown path
- Do NOT try to handle `debrief.md` file processing in this task — that's processor/ingestion pipeline work (Unit 5)

---

## Testing

1. **session.json detection in zip:** Create a test zip with a valid `session.json` file. Upload to CC. Verify console shows `[CC] session.json detected in zip entry`. Verify the ODRC import checklist modal appears with items from the JSON.
2. **session.json detection as single file:** Drop a `session.json` file directly onto CC. Verify same detection and modal behavior.
3. **Validation — valid file:** Upload a well-formed session.json. Verify `validation.valid === true` and no error logs.
4. **Validation — missing fields:** Upload a session.json missing `session_id`. Verify error is logged and file is rejected.
5. **Validation — schema version mismatch:** Upload a session.json with `schema_version: "2.0.0"`. Verify warning is logged but file is still processed.
6. **ODRC item mapping:** Verify `decision` type maps to `DECISION`, `open_new` to `OPEN`, `open_resolved` to resolve action. Check all five types.
7. **Enriched session log:** After importing from session.json, inspect the idea's `sessionLog[]` in Firebase. Verify `chain`, `debriefSummary`, and `nextSession` fields are populated.
8. **Markdown fallback:** Upload a traditional ODRC markdown file (no session.json). Verify existing path still works identically.
9. **Priority test:** Create a zip containing both `session.json` and an ODRC markdown file. Verify session.json path fires and markdown path does not double-import.
10. **Existing functionality:** Run through a normal CC deploy workflow to verify no regressions in non-ideation paths.

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit all code changes
2. Archive this CLAUDE.md to `cc/specs/feat_session_json_schema.md`
3. Generate completion file to `.cc/completions/`
4. Commit spec archive and completion file separately

Completion file format:
```yaml
# .cc/completions/feat_session_json_schema.yaml
spec_id: feat_session_json_schema
app: command-center
status: complete
base_version: "8.65.3"
completed_version: "8.66.0"
completed_at: <ISO timestamp>
files_changed:
  - index.html
summary: >
  Added SessionPackageProcessor service for session.json ingestion.
  New four-path artifact detection (session-json, odrc, spec, claude-md).
  Enriched session log entries with chain metadata, debrief summaries, and pacing data.
  Parallel operation with existing markdown ODRC path.
notes: >
  Transition Phase 1 — both JSON and markdown paths active.
  Future: dedicated ideation-sessions Firebase path (Unit 2),
  debrief.md file processing (Unit 5).
```
