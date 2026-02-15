# Spec Unit 5 — Ingestion Pipeline

**Idea:** Session Tab | **App:** Command Center | **Spec ID:** sp_session_tab_unit5
**Base version:** 8.68.0 | **Phase:** spec-ready
**Depends on:** Unit 1 (session.json schema), Unit 2 (session lifecycle & idea phase model), Unit 4 (landing page & session card UX)
**Date:** 2026-02-15

---

## Task Summary

Build the full ingestion pipeline for session packages — the inbound path that receives session output from Chat, validates it, maps ODRC items for review, creates session records, stores debriefs, surfaces phase ratchet prompts, and clears active session state. Also add the "Download Context Package" button to ExploreInChatModal for mid-session codebase delivery. This unit closes the loop: CC dispatches sessions (Unit 4) and now CC can receive and process them (Unit 5).

---

## What to Build

### 1. Package Detection & Routing

**Existing infrastructure:** `handleFileDrop` (line ~7537), `detectInboundArtifactType()` (line ~3004), `isMultiAppZip()`, `resolveZipContents()`.

The current zip handler processes every file inside a zip individually through `detectInboundArtifactType()`. This works but doesn't distinguish a session package zip (containing session.json + debrief.md + artifacts) from a deploy package that happens to contain a session.json. The detection needs a package-level check before file-level routing.

#### 1.1 Session Package Signature

Add a top-level session package detection function that runs before individual file routing:

```javascript
function isSessionPackageZip(zip) {
    const paths = [];
    zip.forEach((path) => paths.push(path));
    // A session package zip MUST contain session.json at root level
    const hasSessionJson = paths.some(p => 
        p === 'session.json' || p.endsWith('/session.json')
    );
    // Optional companions: debrief.md, artifacts/*
    const hasDebrief = paths.some(p => 
        p === 'debrief.md' || p.endsWith('/debrief.md')
    );
    return { isSessionPackage: hasSessionJson, hasDebrief };
}
```

#### 1.2 Routing Flow Update

In `handleFileDrop` zip processing (line ~7566), add session package detection before the `isMultiApp` check:

```javascript
const zip = await JSZip.loadAsync(file);

// NEW: Check for session package first (highest priority)
const { isSessionPackage, hasDebrief } = isSessionPackageZip(zip);
if (isSessionPackage) {
    await processSessionPackage(zip, file.name, hasDebrief);
    return; // Don't fall through to deploy routing
}

// Existing: multi-app / single-app deploy routing
const isMultiApp = isMultiAppZip(zip, apps);
// ... existing code continues
```

This prevents session packages from being misrouted through the deploy pipeline. A zip containing `session.json` is always treated as a session package — deploy packages should never contain a file named `session.json`.

#### 1.3 Standalone File Detection (Non-Zip)

The existing `detectInboundArtifactType()` four-path routing (line ~3004) already handles standalone session.json files dropped directly. No changes needed for non-zip inbound. The ODRC markdown path also remains unchanged — sessions using the transition format (ODRC markdown without session.json) continue routing through `detectODRCContent()`.

---

### 2. Session Package Processing

**Existing infrastructure:** `SessionPackageProcessor` (line ~2811), `ODRCUpdateIngestionService` (line ~2708).

#### 2.1 processSessionPackage Function

New function that extracts and validates the session package contents:

```javascript
async function processSessionPackage(zip, zipFilename, hasDebrief) {
    // 1. Extract session.json
    const sessionJsonEntry = zip.file('session.json') 
        || zip.file(/session\.json$/)[0];
    if (!sessionJsonEntry) {
        console.error('[CC] Session package missing session.json');
        return;
    }
    
    const sessionJsonContent = await sessionJsonEntry.async('string');
    let sessionData;
    try {
        sessionData = JSON.parse(sessionJsonContent);
    } catch (e) {
        console.error('[CC] session.json parse error:', e.message);
        await showAlert('Invalid session.json: ' + e.message, '❌ Error');
        return;
    }
    
    // 2. Validate via SessionPackageProcessor
    const validation = SessionPackageProcessor.validate(sessionData);
    if (!validation.valid) {
        console.error('[CC] session.json validation errors:', validation.errors);
        await showAlert(
            `Session package validation failed:\n${validation.errors.join('\n')}`,
            '❌ Validation Error'
        );
        return;
    }
    if (validation.warnings.length > 0) {
        console.warn('[CC] session.json warnings:', validation.warnings);
    }
    
    // 3. Extract debrief.md if present
    let debriefContent = null;
    if (hasDebrief) {
        const debriefEntry = zip.file('debrief.md') 
            || zip.file(/debrief\.md$/)[0];
        if (debriefEntry) {
            debriefContent = await debriefEntry.async('string');
        }
    }
    
    // 4. Extract artifact filenames for display
    const artifactFiles = [];
    zip.forEach((path, entry) => {
        if (path !== 'session.json' && path !== 'debrief.md' && !entry.dir) {
            artifactFiles.push(path);
        }
    });
    
    // 5. Map ODRC items to ingestion format
    const parsedUpdates = SessionPackageProcessor.toIngestionUpdates(sessionData);
    const metadata = SessionPackageProcessor.extractMetadata(sessionData);
    
    // 6. Route to import checklist
    setPendingOdrcImport({
        fileName: zipFilename,
        fullContent: sessionJsonContent,
        odrcSection: null,
        metadata,
        parsedUpdates,
        sourceApp: metadata.appId,
        artifactType: 'session-json',
        sessionData,
        // NEW fields for session package
        debriefContent,
        artifactFiles,
        validationWarnings: validation.warnings
    });
}
```

#### 2.2 SessionPackageProcessor Enhancements

The existing `SessionPackageProcessor` (line ~2811) is nearly complete. Two additions:

**A. Tangent item routing:**

Currently `toIngestionUpdates()` (line ~2861) maps all items uniformly. Add tangent awareness:

```javascript
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
                    targetIdea: null,
                    sourceLink: item.source_link,
                    isTangent: item.is_tangent || false,
                    affinity: item.affinity || null,
                    // NEW: route tangent items to different idea
                    targetIdeaSlug: (item.is_tangent && item.affinity) 
                        ? item.affinity : null
                });
            }
        }
    }
    return updates;
},
```

**B. Debrief extraction:**

Add a method to extract debrief data for storage:

```javascript
extractDebrief(sessionData, debriefContent) {
    return {
        summary: sessionData.debrief_summary || null,
        fullContent: debriefContent || null,
        nextSession: sessionData.next_session || null
    };
}
```

---

### 3. Import Checklist Enhancements for Session Packages

**Existing infrastructure:** `ODRCImportChecklistModal` (line ~12593).

The import checklist already handles ODRC items from both markdown and session.json sources. Several enhancements are needed for full session package support.

#### 3.1 Session Package Header

When `pendingOdrcImport.artifactType === 'session-json'`, the checklist header should show enriched package information:

```
┌─────────────────────────────────────────────────────────────┐
│  📦 Session Package — {session_id}                          │
│  From: {zipFilename}  ·  Schema: {schema_version}          │
│  Chain: {link_count} link(s)  ·  Mode: {session_config.mode}│
│  Summary: {context_summary}                                 │
│  {validation.warnings.length} warning(s)                    │
├─────────────────────────────────────────────────────────────┤
│  ☑ DECISION: "..."                                          │
│  ☑ OPEN (new): "..."                                        │
│  ☑ RESOLVE OPEN: "..." → "..."                              │
│  ☑ OPEN (tangent → other-idea): "..." [→ routes to idea]    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Tangent Item Display

Items where `isTangent === true` should be visually distinguished in the checklist:

- Show the affinity tag: `(tangent → {affinity slug})`
- If affinity matches an existing idea, show a link icon and the idea name
- If affinity is `null` (orphan tangent), show `(tangent — orphan, will create as OPEN on linked idea)`
- Tangent items with affinity to a *different* idea get a routing indicator: `→ routes to: {idea name}`

**Tangent routing behavior:**
- Tangent items with a `targetIdeaSlug` that matches an existing idea are routed to that idea during `executeODRCImport()`
- Tangent items without a match (orphan or unresolvable slug) stay on the primary linked idea with a `[tangent]` tag in their concept content
- The developer can override routing by unchecking the item and manually creating it on the target idea

#### 3.3 Validation Warnings Display

If `pendingOdrcImport.validationWarnings` has entries, show a collapsible warnings section below the header:

```
⚠️ 2 validation warning(s)
  · Schema version mismatch: expected 1.0.0, got 1.1.0
  · Unknown idea phase: "drafting"
```

Warnings don't block import — they're informational.

#### 3.4 Debrief Preview

If `pendingOdrcImport.debriefContent` exists, show a collapsible "Session Debrief" section below the checklist items:

```
📋 Session Debrief (click to expand)
  [debrief_summary text — always visible as one-liner]
  
  [expanded: full debrief.md rendered as scrollable markdown]
```

#### 3.5 Artifact Inventory

If `pendingOdrcImport.artifactFiles` has entries, show them below the debrief:

```
📎 Artifacts (3 files)
  · spec-unit-5-ingestion-pipeline.md
  · restart-doc-session-tab-S011-link2.md  
  · link-brief-S011-link1.md
```

Artifacts are informational only in this version — no automated handling. Future work may route specs and CLAUDE.md files to their appropriate storage.

---

### 4. Post-Import Lifecycle

**Existing infrastructure:** `executeODRCImport()` (line ~3046), `IdeaManager.completeSession()` (line ~5820), `IdeaManager.advancePhase()` (line ~5792).

#### 4.1 Enhanced executeODRCImport

The existing function already handles session.json enrichment (line ~3074-3116). Additions:

**A. Tangent routing:**

Before executing concept updates, separate tangent items with resolvable affinity:

```javascript
async function executeODRCImport(uid, linkedIdea, checkedItems, globalIdeas, 
                                  github, app, sessionType, pendingImport) {
    // NEW: Separate tangent items that route to different ideas
    const primaryItems = [];
    const tangentRoutes = {}; // { ideaId: [items] }
    
    for (const item of checkedItems) {
        if (item.targetIdeaSlug && item.targetIdeaSlug !== linkedIdea.slug) {
            // Find target idea by slug
            const targetIdea = globalIdeas.find(i => 
                i.slug === item.targetIdeaSlug || 
                IdeaManager.generateSlug(i.name) === item.targetIdeaSlug
            );
            if (targetIdea) {
                if (!tangentRoutes[targetIdea.id]) tangentRoutes[targetIdea.id] = [];
                tangentRoutes[targetIdea.id].push({
                    ...item,
                    overrideIdeaId: targetIdea.id
                });
                continue;
            }
            // Slug didn't resolve — fall through to primary idea
            console.warn('[CC] Tangent affinity unresolved:', item.targetIdeaSlug);
        }
        primaryItems.push(item);
    }
    
    // Execute primary items on linked idea (existing flow)
    const updatesForExecution = primaryItems.map(item => ({
        ...item,
        overrideIdeaId: item.action === 'create' ? linkedIdea.id : undefined
    }));
    const results = await ODRCUpdateIngestionService.execute(
        uid, updatesForExecution, globalIdeas
    );
    
    // Execute tangent items on their target ideas
    let tangentCreated = 0;
    for (const [ideaId, items] of Object.entries(tangentRoutes)) {
        const tangentResults = await ODRCUpdateIngestionService.execute(
            uid, items, globalIdeas
        );
        tangentCreated += tangentResults.filter(
            r => r.action === 'create' && r.status === 'success'
        ).length;
    }
    
    // ... rest of existing function continues with primary results
    // Add tangent count to return value
}
```

**B. Debrief storage:**

After session log entry creation, store the debrief if present:

```javascript
// After addSessionLogEntry (line ~3111)
if (pendingImport?.debriefContent) {
    await IdeaManager.storeDebrief(uid, linkedIdea.id, 
        sessionLogEntry.sessionId, {
            summary: pendingImport.sessionData?.debrief_summary || null,
            content: pendingImport.debriefContent,
            nextSession: pendingImport.sessionData?.next_session || null
        }
    );
}
```

**New IdeaManager method:**

```javascript
async storeDebrief(uid, ideaId, sessionId, debrief) {
    await this._ref(uid).child(ideaId)
        .child('debriefs').child(sessionId).set({
            summary: debrief.summary,
            content: debrief.content,
            nextSession: debrief.nextSession,
            storedAt: new Date().toISOString()
        });
    console.log(`[CC] Stored debrief for ${sessionId} on idea ${ideaId}`);
}
```

Storage location: `command-center/{uid}/ideas/{ideaId}/debriefs/{sessionId}`. This keeps debriefs collocated with the idea record for easy retrieval. The `content` field holds the full debrief.md text; `summary` is the one-liner from session.json for fast display on session cards.

#### 4.2 Phase Ratchet Prompt

After successful import, the results screen should surface a phase ratchet prompt when the computed phase differs from the stored phase:

```javascript
// In ODRCImportChecklistModal results view (line ~12780)
if (results) {
    const currentConcepts = (globalConcepts || []).filter(
        c => c.ideaOrigin === linkedIdea.id
    );
    const computedPhase = computeIdeaPhase(currentConcepts);
    const storedPhase = linkedIdea.phase || 'exploring';
    const phaseAdvanceCandidate = computedPhase !== storedPhase 
        && PHASE_ORDER.indexOf(computedPhase) > PHASE_ORDER.indexOf(storedPhase);
    
    // Show phase ratchet prompt only when computed > stored
    // (advisory — developer decides)
}
```

Where `PHASE_ORDER` is:
```javascript
const PHASE_ORDER = ['inception', 'exploring', 'converging', 'spec-ready', 'complete'];
```

**Results screen with phase ratchet:**

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Session S-2026-02-15-011 imported                       │
│                                                              │
│  6 concepts created, 2 OPENs resolved                       │
│  2 tangent items routed to other-idea                        │
│                                                              │
│  ┌─ Phase Check ─────────────────────────────────────────┐  │
│  │ Stored: exploring  ·  Computed: converging             │  │
│  │                                                        │  │
│  │ The ODRC distribution suggests this idea has matured.  │  │
│  │ Advance phase?                                         │  │
│  │                                                        │  │
│  │ [Keep exploring]     [Advance to converging]           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  📋 Debrief: "Resolved all pipeline routing questions..."    │
│  📎 Next session: "Draft spec for template storage..."       │
│                                                              │
│  [Done]                                                      │
└─────────────────────────────────────────────────────────────┘
```

The phase ratchet follows the sticky rule from Link 1: once advanced, phase doesn't regress. The prompt only appears when computed > stored. If stored > computed (e.g., developer manually advanced but new OPENs arrived), no prompt appears — the ratchet holds.

**Advance action:**
```javascript
const handleAdvancePhase = async () => {
    if (!firebaseUid || !linkedIdea) return;
    await IdeaManager.advancePhase(firebaseUid, linkedIdea.id, computedPhase);
    // Refresh local state — globalIdeas listener will pick up the change
};
```

#### 4.3 Active Session Clearing

The existing `executeODRCImport()` already clears `activeSession` on the idea after successful import (line ~3114-3116). No changes needed. The flow:

1. Import executes → session log entry created with `status: 'complete'`
2. `ideaPhaseAtEnd` captured from current phase
3. `IdeaManager.completeSession()` sets `activeSession` to `null`
4. Home page session card transitions from active (green) to pending (no indicator)

#### 4.4 Next Session Surfacing

The `next_session` field from session.json contains the chain's recommendation for what to tackle next. After import, surface this on:

- **Results screen:** Show as a one-liner below the debrief summary (see mockup above)
- **Session log entry:** Already stored via `buildSessionLogEntry()` (line ~2906) as `nextSession`
- **Next brief generation:** The `IdeationBriefGenerator` can reference the previous session's `nextSession` field to seed the next brief's focus. This is existing behavior — the brief generator already includes session history context.

---

### 5. Context Package Generation

**Existing infrastructure:** `ExploreInChatModal` (line ~16041), `downloadZip()` (line ~16103).

#### 5.1 "Download Context Package" Button

Add a persistent "Download Context Package" button to ExploreInChatModal that packages the codebase and templates for mid-session delivery. This is separate from the brief download — the brief goes at session start (lightweight, thinking phase), the context package goes mid-session when Chat is ready to produce a spec or CLAUDE.md.

**Button placement:** In the action bar (line ~16282), always visible regardless of session type or phase:

```javascript
<button onClick={downloadContextPackage}
    className="px-4 py-2 rounded text-sm bg-amber-700 hover:bg-amber-600 font-medium"
    title="Download codebase + templates for spec/CLAUDE.md sessions">
    📦 Context Package
</button>
```

**No conditional logic.** The restart doc decision is clear: the button is always visible, the developer clicks when needed. No phase gating, no session type checks.

#### 5.2 Context Package Contents

```javascript
const downloadContextPackage = async () => {
    try {
        const zip = new JSZip();
        
        // 1. Codebase — fetch from GitHub
        if (app && github) {
            const repo = app.repos?.test || app.testRepo 
                || app.repos?.prod || app.prodRepo;
            if (repo) {
                try {
                    // Get the main application file(s)
                    const repoContents = await github.getContents(repo, '');
                    // Include index.html (or primary app file)
                    const indexFile = await github.getFile(repo, 'index.html');
                    if (indexFile?.content) {
                        zip.file('codebase/index.html', atob(indexFile.content));
                    }
                    // Include other key files if they exist
                    for (const path of ['sw.js', 'manifest.json', 'CLAUDE.md']) {
                        try {
                            const f = await github.getFile(repo, path);
                            if (f?.content) zip.file(`codebase/${path}`, atob(f.content));
                        } catch {} // Skip if not found
                    }
                } catch (e) {
                    console.warn('[CC] Codebase fetch failed:', e.message);
                }
            }
        }
        
        // 2. Existing spec docs from prior units (if any)
        // Check session log for spec-type sessions with docPaths
        const specSessions = (idea.sessionLog || []).filter(
            s => s.type === 'spec' && s.docPath
        );
        if (specSessions.length > 0 && github && app) {
            const repo = app.repos?.test || app.testRepo 
                || app.repos?.prod || app.prodRepo;
            if (repo) {
                for (const specSession of specSessions) {
                    try {
                        const f = await github.getFile(repo, specSession.docPath);
                        if (f?.content) {
                            zip.file(`specs/${specSession.docPath.split('/').pop()}`, 
                                atob(f.content));
                        }
                    } catch {} // Skip if not found
                }
            }
        }
        
        // 3. Current ODRC state snapshot
        const activeConcepts = globalConcepts.filter(
            c => c.ideaOrigin === idea.id && c.status === 'active'
        );
        const odrcSnapshot = activeConcepts.map(c => ({
            type: c.type,
            content: c.content,
            status: c.status,
            createdAt: c.createdAt
        }));
        zip.file('context/odrc-state.json', 
            JSON.stringify(odrcSnapshot, null, 2));
        
        // 4. Session history summary
        const sessionSummary = (idea.sessionLog || []).map(s => ({
            sessionId: s.sessionId,
            date: s.date,
            type: s.type,
            summary: s.summary,
            conceptsCreated: s.conceptsCreated,
            conceptsResolved: s.conceptsResolved
        }));
        zip.file('context/session-history.json', 
            JSON.stringify(sessionSummary, null, 2));
        
        // Generate and download
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `context-package-${slug}-S${String(sessionNum).padStart(3, '0')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Update active session activity
        if (firebaseUid && idea.activeSession) {
            await IdeaManager.updateSessionActivity(
                firebaseUid, idea.id, { 
                    contextPackageDownloaded: true 
                }
            );
        }
        
        console.log('[CC] Downloaded context package for', idea.name);
    } catch (e) {
        await showAlert('Context package download failed: ' + e.message, '❌ Error');
    }
};
```

#### 5.3 Context Package Resolves OPEN #8

OPEN #8 from the restart doc: "Should spec context package include existing spec docs from prior units?" **Yes.** The context package includes spec docs from prior sessions by checking the session log for `type: 'spec'` entries with `docPath` values and fetching them from the repo. This ensures Chat has the full spec history when producing the next unit.

#### 5.4 Context Package Resolves OPEN #9

OPEN #9 from the restart doc: "For claude-md sessions, how does CC know which spec to include — idea record tracks artifact path, or developer selects?" **Artifact path from session log.** The context package fetches spec documents using the `docPath` field in session log entries of `type: 'spec'`. No manual selection needed — all specs for the idea are included. If the developer wants to exclude one, they can remove it from the zip after download.

---

### 6. Transition Strategy

The transition from ODRC markdown to session.json follows the three-phase plan from Sessions 1-10:

**Phase 1 (Current):** Sessions produce ODRC markdown documents. CC ingests via `detectODRCContent()` → `ODRCUpdateIngestionService.parse()`. Session.json infrastructure exists but has no producers yet.

**Phase 2 (Post-Unit 5 build):** Sessions produce both ODRC markdown AND session.json in the same zip. CC detects session.json (highest priority via `detectInboundArtifactType()`) and routes through `SessionPackageProcessor`. The ODRC markdown is still pushed to the repo as the human-readable record. Skills are updated to instruct Chat to produce both formats.

**Phase 3 (Future):** Sessions produce only session.json + debrief.md. The ODRC markdown path is deprecated. `detectODRCContent()` remains for backward compatibility with historical imports but is no longer the primary ingestion path.

**Unit 5 enables Phase 2.** The skill updates (Unit 3) instruct Chat to produce session.json. The infrastructure from this unit processes it. The ODRC markdown continues as the human-readable companion until Phase 3.

---

## Architecture Constraints

1. **No new Firebase collections.** Debriefs store under `ideas/{ideaId}/debriefs/{sessionId}` — no separate top-level node.
2. **Backward compatible.** All existing ODRC markdown import flows continue working. Session.json is additive, not replacement.
3. **No blocking validations.** Validation warnings are informational. Only hard validation errors (missing required fields) block import.
4. **Phase ratchet is advisory.** The prompt surfaces the phase delta, the developer decides. `advancePhase()` is never called automatically.
5. **Single-file architecture.** All new code goes in `index.html`. No external modules or build steps.
6. **GitHub API rate awareness.** Context package fetches multiple files — batch where possible, fail gracefully on rate limits.

---

## File Structure

All changes in `index.html`:

| Section | Lines (approx) | Changes |
|---------|----------------|---------|
| SessionPackageProcessor | ~2811-2919 | Add `extractDebrief()`, enhance `toIngestionUpdates()` tangent routing |
| New: isSessionPackageZip | ~2920 (after processor) | New function for package-level detection |
| New: processSessionPackage | ~2920 (after processor) | New function for package extraction and validation |
| handleFileDrop | ~7537-7700 | Add session package check before isMultiApp routing |
| executeODRCImport | ~3046-3120 | Add tangent routing, debrief storage |
| IdeaManager | ~5730-5850 | Add `storeDebrief()` method |
| ODRCImportChecklistModal | ~12593-12800 | Session package header, tangent display, debrief preview, artifact inventory, phase ratchet prompt |
| ExploreInChatModal | ~16041-16300 | Add "Download Context Package" button and handler |
| Constants | Near PHASE constants | Add `PHASE_ORDER` array |

Estimated new/modified code: ~300-400 lines.

---

## Decision Validation Checkpoint

### Decisions Addressed by This Spec

| # | Decision (Source) | Spec Coverage | Status |
|---|---|---|---|
| 1 | Session output package is a zip containing session.json + debrief.md + artifacts (S1-10) | §1.1 package signature detection, §2.1 extraction, §3.4-3.5 debrief/artifact display | ✅ Covered |
| 2 | ODRC items carried as structured JSON in session.json odrc.items array (S1-10) | §2.2 toIngestionUpdates maps JSON items, §3.1-3.2 checklist displays them | ✅ Covered |
| 3 | Debrief is separate markdown file; debrief_summary is first-class field (S1-10) | §2.1 extracts debrief.md, §4.1B stores it, §3.4 displays preview, §4.2 shows summary on results | ✅ Covered |
| 4 | SessionPackageProcessor validates, maps, builds entries, extracts metadata (S1-10) | §2.1-2.2 uses existing processor, adds tangent routing and debrief extraction | ✅ Covered |
| 5 | detectInboundArtifactType has four-path routing with session-json highest (S1-10) | §1.3 confirms existing detection unchanged for standalone files | ✅ Covered |
| 6 | Session lifecycle: pending → active → complete; one active per idea (S1-10) | §4.3 activeSession clearing on import, existing guard in ExploreInChatModal | ✅ Covered |
| 7 | Phase is a ratchet — once advanced, doesn't regress; computeIdeaPhase is advisory (S11-L1) | §4.2 phase ratchet prompt only shows when computed > stored, developer decides | ✅ Covered |
| 8 | Session.json production blocked until Unit 5 ingestion pipeline built (S11-L1) | §6 transition strategy enables Phase 2 after this build | ✅ Covered |
| 9 | Session input package (codebase + templates) is separate mid-session action (S11-L1) | §5.1-5.4 "Download Context Package" button, always visible, separate from brief | ✅ Covered |
| 10 | ExploreInChatModal is single surface for all session actions (S11-L1) | §5.1 adds context package button to existing modal alongside brief/prompt/repo actions | ✅ Covered |
| 11 | "Download Context Package" always visible, no conditional logic (S11-L1) | §5.1 explicitly no phase gating, no session type checks | ✅ Covered |
| 12 | Transition strategy: Phase 1 both formats → Phase 2 processor reads JSON → Phase 3 drop markdown (S1-10) | §6 maps all three phases with clear enablement trigger | ✅ Covered |

### Concerns Flagged

| # | Concern | Impact | Recommendation |
|---|---------|--------|----------------|
| 1 | **Tangent routing across ideas requires slug resolution.** If the producing Chat uses a slightly different slug than what's stored in CC (e.g., "nav-redesign" vs "cc-navigation-redesign"), routing silently falls back to the primary idea. | Medium — tangent items could end up on wrong idea | Add fuzzy slug matching in tangent resolution (same approach as ODRCImportChecklistModal auto-link cascade, line ~12603). Also allow developer override in the checklist. |
| 2 | **Context package GitHub API calls could be expensive.** Fetching index.html + sw.js + manifest.json + CLAUDE.md + N spec docs = 4+N API calls per context package download. | Low-medium — rate limit risk for repos with many spec units | Add a loading indicator and fail gracefully per-file. Consider caching the codebase content if the developer downloads multiple context packages in the same session. |
| 3 | **Debrief storage under ideas/{ideaId}/debriefs/{sessionId} could grow large.** Full debrief.md content in Firebase for every session adds up. | Low — debriefs are typically <5KB each, and ideas rarely exceed 20 sessions | Monitor. If storage becomes a concern, store only debrief_summary in Firebase and push full content to GitHub repo only. |
| 4 | **OPEN #7 (where do spec/CLAUDE.md templates live?) remains unresolved.** The context package currently doesn't include templates — only codebase, specs, and ODRC state. | Low for Unit 5 — templates are a Unit 3 concern | Park for Unit 3 skill updates. The context package can add templates once their storage location is decided. |

### OPENs Resolved by This Spec

| # | OPEN | Resolution |
|---|------|------------|
| 8 | Should spec context package include existing spec docs from prior units? | **Yes.** §5.2 fetches spec docs from session log entries with `type: 'spec'` and `docPath`. |
| 9 | For claude-md sessions, how does CC know which spec to include? | **Artifact path from session log.** §5.4 — all specs for the idea are included via `docPath` lookup, no manual selection. |

### OPENs NOT Resolved (Carried Forward)

| # | OPEN | Reason |
|---|------|--------|
| 5 | Where in the UI should the developer edit idea attributes? | Blocked on cc-navigation-redesign idea (separate scope). |
| 6 | When should phase advancement be surfaced? | Partially resolved — §4.2 covers post-import. Other candidates (idea card nudge, brief recommendation) are Unit 4/navigation redesign scope. |
| 7 | Where do spec template and CLAUDE.md template live? | Unit 3 scope — skill updates define template location. |
