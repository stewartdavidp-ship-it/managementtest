# CLAUDE.md — Ingestion Pipeline
# cc-spec-id: sp_session_tab_unit5
# App: Command Center (index.html)
# Base version: 8.68.0
# Target version: 8.69.0
# Depends on: sp_session_tab_unit1 (schema), sp_session_tab_unit2 (lifecycle, implemented in 8.67.0), sp_session_tab_unit4 (landing page UX)

---

## Before You Begin

This task builds the inbound ingestion pipeline for session packages and adds the outbound context package button. Most of the infrastructure already exists — `SessionPackageProcessor`, `detectInboundArtifactType()`, `executeODRCImport()`, `ODRCImportChecklistModal` — so this is primarily wiring, enhancement, and new UI surfaces rather than greenfield construction. Review the full scope below, then tell me:

1. Can you complete this in one session, or should we split into phases?
2. If splitting, where would you draw the line?

Suggested split point: Phase A (package detection + processing) and Phase B (checklist enhancements + context package button) can be done independently. Phase C (post-import lifecycle: phase ratchet, debrief, tangent routing) depends on Phase A.

Provide your assessment before writing any code. I'll confirm the approach.

---

## Task Summary

Build the session package ingestion pipeline: detect session package zips at the package level (before deploy routing), extract and validate session.json + debrief.md, route ODRC items through the existing import checklist with tangent awareness, store debriefs, surface phase ratchet prompts post-import, and add a "Download Context Package" button to ExploreInChatModal for mid-session codebase delivery. Estimated ~300-400 new/modified lines.

---

## What to Build

### Phase A: Package Detection & Processing

**1. Session Package Signature Detection**

Add `isSessionPackageZip()` after `SessionPackageProcessor` (~line 2919):

```javascript
// Detect whether a zip is a session package (contains session.json at root)
function isSessionPackageZip(zip) {
    const paths = [];
    zip.forEach((path) => paths.push(path));
    const hasSessionJson = paths.some(p =>
        p === 'session.json' || p.endsWith('/session.json')
    );
    const hasDebrief = paths.some(p =>
        p === 'debrief.md' || p.endsWith('/debrief.md')
    );
    return { isSessionPackage: hasSessionJson, hasDebrief };
}
```

**2. Route Session Packages Before Deploy Routing**

In `handleFileDrop` zip processing (~line 7566), insert session package check BEFORE `isMultiAppZip`:

```javascript
const zip = await JSZip.loadAsync(file);

// Session package detection — highest priority
const { isSessionPackage, hasDebrief } = isSessionPackageZip(zip);
if (isSessionPackage) {
    await processSessionPackage(zip, file.name, hasDebrief);
    return;
}

// Existing: multi-app / single-app deploy routing
const isMultiApp = isMultiAppZip(zip, apps);
// ... existing code continues unchanged
```

**3. processSessionPackage Function**

Add after `isSessionPackageZip()`:

```javascript
async function processSessionPackage(zip, zipFilename, hasDebrief) {
    console.log('[CC] Processing session package:', zipFilename);

    // 1. Extract session.json
    const sessionJsonEntry = zip.file('session.json')
        || zip.file(/session\.json$/)[0];
    if (!sessionJsonEntry) {
        console.error('[CC] Session package missing session.json');
        await showAlert('Session package missing session.json', '❌ Error');
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

    // 2. Validate
    const validation = SessionPackageProcessor.validate(sessionData);
    if (!validation.valid) {
        console.error('[CC] session.json validation errors:', validation.errors);
        await showAlert(
            `Validation failed:\n${validation.errors.join('\n')}`,
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

    // 4. Collect artifact filenames
    const artifactFiles = [];
    zip.forEach((path, entry) => {
        if (path !== 'session.json' && path !== 'debrief.md' && !entry.dir) {
            artifactFiles.push(path);
        }
    });

    // 5. Map ODRC items
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
        debriefContent,
        artifactFiles,
        validationWarnings: validation.warnings
    });
}
```

**Important:** `processSessionPackage` must be defined inside the component scope where `setPendingOdrcImport` and `showAlert` are accessible (same scope as `handleFileDrop`). It is NOT a standalone utility — it's a handler function inside `DashboardView` or wherever `handleFileDrop` lives.

**4. Enhance SessionPackageProcessor.toIngestionUpdates**

Update at ~line 2861 to include tangent routing metadata:

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
                    targetIdeaSlug: (item.is_tangent && item.affinity)
                        ? item.affinity : null
                });
            }
        }
    }
    return updates;
},
```

**5. Add extractDebrief Method to SessionPackageProcessor**

After `extractMetadata` (~line 2918):

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

### Phase B: Import Checklist Enhancements

All changes in `ODRCImportChecklistModal` (~line 12593).

**6. Session Package Header**

When `pendingOdrcImport.artifactType === 'session-json'`, render an enriched header above the checklist items:

```jsx
{pendingOdrcImport.artifactType === 'session-json' && pendingOdrcImport.sessionData && (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 mb-4">
        <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📦</span>
            <span className="font-medium text-slate-200">
                Session Package — {pendingOdrcImport.sessionData.session_id}
            </span>
        </div>
        <div className="text-xs text-slate-400 space-y-1">
            <div>Schema: {pendingOdrcImport.sessionData.schema_version} · 
                Mode: {pendingOdrcImport.sessionData.session_config?.mode || 'exploration'} ·
                Chain: {pendingOdrcImport.sessionData.chain?.link_count || 1} link(s)
            </div>
            <div className="text-slate-300">{pendingOdrcImport.sessionData.context_summary}</div>
            {pendingOdrcImport.validationWarnings?.length > 0 && (
                <div className="text-amber-400 mt-1">
                    ⚠️ {pendingOdrcImport.validationWarnings.length} warning(s):
                    {pendingOdrcImport.validationWarnings.map((w, i) => (
                        <div key={i} className="ml-4">· {w}</div>
                    ))}
                </div>
            )}
        </div>
    </div>
)}
```

**7. Tangent Item Display**

In the checklist item rendering, distinguish tangent items:

```jsx
{item.isTangent && (
    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-300 ml-2">
        tangent{item.affinity ? ` → ${item.affinity}` : ' — orphan'}
    </span>
)}
```

If the tangent has a `targetIdeaSlug` that resolves to an existing idea, show the idea name:

```javascript
// In checkedItems initialization or a useMemo
const resolvedAffinity = React.useMemo(() => {
    const map = {};
    checkedItems.forEach((item, i) => {
        if (item.targetIdeaSlug) {
            const target = (globalIdeas || []).find(idea =>
                idea.slug === item.targetIdeaSlug ||
                IdeaManager.generateSlug(idea.name) === item.targetIdeaSlug
            );
            if (target) map[i] = target;
        }
    });
    return map;
}, [checkedItems, globalIdeas]);
```

Display: `tangent → Navigation Redesign` (resolved) or `tangent → nav-redesign (unresolved)` (slug only).

**8. Debrief Preview Section**

After the checklist items, before the action buttons:

```jsx
{pendingOdrcImport.debriefContent && (
    <details className="mt-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <summary className="p-3 cursor-pointer text-sm text-slate-300 hover:text-white">
            📋 Session Debrief
            {pendingOdrcImport.sessionData?.debrief_summary && (
                <span className="text-xs text-slate-500 ml-2">
                    — {pendingOdrcImport.sessionData.debrief_summary.substring(0, 80)}
                    {pendingOdrcImport.sessionData.debrief_summary.length > 80 ? '…' : ''}
                </span>
            )}
        </summary>
        <div className="p-3 border-t border-slate-700 text-xs text-slate-400 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
            {pendingOdrcImport.debriefContent}
        </div>
    </details>
)}
```

**9. Artifact Inventory**

```jsx
{pendingOdrcImport.artifactFiles?.length > 0 && (
    <div className="mt-2 text-xs text-slate-500">
        📎 {pendingOdrcImport.artifactFiles.length} artifact(s):
        {pendingOdrcImport.artifactFiles.map((f, i) => (
            <span key={i} className="ml-2">{f.split('/').pop()}</span>
        ))}
    </div>
)}
```

---

### Phase C: Post-Import Lifecycle

**10. Tangent Routing in executeODRCImport**

Update `executeODRCImport` (~line 3046) to separate and route tangent items:

```javascript
async function executeODRCImport(uid, linkedIdea, checkedItems, globalIdeas, github, app, sessionType, pendingImport) {
    // Separate tangent items that route to different ideas
    const primaryItems = [];
    const tangentRoutes = {}; // { ideaId: [items] }

    for (const item of checkedItems) {
        if (item.targetIdeaSlug && item.targetIdeaSlug !== (linkedIdea.slug || IdeaManager.generateSlug(linkedIdea.name))) {
            const targetIdea = (globalIdeas || []).find(i =>
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
            console.warn('[CC] Tangent affinity unresolved:', item.targetIdeaSlug, '— falling back to primary idea');
        }
        primaryItems.push(item);
    }

    // Execute primary items on linked idea (existing flow)
    const updatesForExecution = primaryItems.map(item => ({
        ...item,
        overrideIdeaId: item.action === 'create' ? linkedIdea.id : undefined
    }));
    const results = await ODRCUpdateIngestionService.execute(uid, updatesForExecution, globalIdeas);

    const created = results.filter(r => r.action === 'create' && r.status === 'success').length;
    const resolved = results.filter(r => r.action === 'resolve' && r.status === 'success').length;

    // Execute tangent items on their target ideas
    let tangentCreated = 0;
    for (const [ideaId, items] of Object.entries(tangentRoutes)) {
        try {
            const tangentResults = await ODRCUpdateIngestionService.execute(uid, items, globalIdeas);
            tangentCreated += tangentResults.filter(r => r.action === 'create' && r.status === 'success').length;
        } catch (e) {
            console.warn('[CC] Tangent routing failed for idea', ideaId, ':', e.message);
        }
    }

    // 2. Generate summary (existing code, unchanged)
    let summary = `${created} concept(s) created, ${resolved} OPEN(s) resolved`;
    if (tangentCreated > 0) summary += `, ${tangentCreated} tangent(s) routed`;
    try {
        if (ClaudeAPIService.isConfigured()) {
            summary = await ClaudeAPIService.call({
                model: 'claude-haiku-4-5-20251001',
                system: 'Generate a one-sentence summary of these ODRC updates for a session log. Be concise.',
                userMessage: checkedItems.map(i => `${i.action} ${i.type}: ${i.description}`).join('\n'),
                maxTokens: 200
            });
        }
    } catch (e) {
        console.warn('[CC] Summary generation failed, using default:', e.message);
    }

    // 3. Build session log entry (existing code, unchanged)
    let sessionLogEntry;
    if (pendingImport?.sessionData) {
        sessionLogEntry = SessionPackageProcessor.buildSessionLogEntry(pendingImport.sessionData);
        const defaultSummary = `${created} concept(s) created, ${resolved} OPEN(s) resolved`;
        if (tangentCreated > 0 && summary === defaultSummary) {
            summary += `, ${tangentCreated} tangent(s) routed`;
        }
        if (summary !== defaultSummary) {
            sessionLogEntry.summary = summary;
        }
        sessionLogEntry.conceptsCreated = created;
        sessionLogEntry.conceptsResolved = resolved;
    } else {
        const sessionNum = (linkedIdea.sessionLog?.length || 0) + 1;
        const sessionId = generateSessionId(sessionNum);
        const slug = linkedIdea.slug || IdeaManager.generateSlug(linkedIdea.name);
        const docPath = `docs/sessions/${slug}/${sessionId}.md`;
        sessionLogEntry = {
            sessionId,
            date: Date.now(),
            docPath,
            summary,
            conceptsCreated: created,
            conceptsResolved: resolved,
            type: sessionType || 'exploration'
        };
    }

    // v8.67.0: Enrich with lifecycle fields if active session exists (unchanged)
    if (linkedIdea.activeSession) {
        sessionLogEntry.status = 'complete';
        sessionLogEntry.completedAt = new Date().toISOString();
        sessionLogEntry.ideaPhaseAtStart = linkedIdea.activeSession.ideaPhaseAtStart;
        sessionLogEntry.ideaPhaseAtEnd = linkedIdea.phase || computeIdeaPhase(
            (await ConceptManager.getByIdea(uid, linkedIdea.id)) || []
        );
    }

    await IdeaManager.addSessionLogEntry(uid, linkedIdea.id, sessionLogEntry);

    // NEW: Store debrief if present
    if (pendingImport?.debriefContent) {
        await IdeaManager.storeDebrief(uid, linkedIdea.id,
            sessionLogEntry.sessionId, {
                summary: pendingImport.sessionData?.debrief_summary || null,
                content: pendingImport.debriefContent,
                nextSession: pendingImport.sessionData?.next_session || null
            }
        );
    }

    // v8.67.0: Clear active session after successful import (unchanged)
    if (linkedIdea.activeSession) {
        await IdeaManager.completeSession(uid, linkedIdea.id);
    }

    return { created, resolved, tangentCreated, summary, sessionId: sessionLogEntry.sessionId };
}
```

**11. IdeaManager.storeDebrief**

Add to `IdeaManager` (~line 5845, after `updateSessionActivity`):

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
},
```

**12. Phase Ratchet Prompt on Results Screen**

Add `PHASE_ORDER` constant near other phase-related constants:

```javascript
const PHASE_ORDER = ['inception', 'exploring', 'converging', 'spec-ready', 'complete'];
```

Update the results view in `ODRCImportChecklistModal` (~line 12780):

```jsx
if (results) {
    const currentConcepts = (globalConcepts || []).filter(c => c.ideaOrigin === linkedIdea?.id);
    const computedPhase = computeIdeaPhase(currentConcepts);
    const storedPhase = linkedIdea?.phase || 'exploring';
    const phaseAdvanceCandidate = PHASE_ORDER.indexOf(computedPhase) > PHASE_ORDER.indexOf(storedPhase);
    const [advancing, setAdvancing] = React.useState(false);

    const handleAdvancePhase = async () => {
        if (!firebaseUid || !linkedIdea) return;
        setAdvancing(true);
        try {
            await IdeaManager.advancePhase(firebaseUid, linkedIdea.id, computedPhase);
            await showAlert(`Phase advanced to ${computedPhase}`, '✅ Phase Updated');
        } catch (e) {
            await showAlert('Phase advance failed: ' + e.message, '❌ Error');
        }
        setAdvancing(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={close}>
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <h2 className="text-lg font-bold mb-2">Session {results.sessionId} imported</h2>
                    <p className="text-slate-300 mb-1">
                        {results.created} concept{results.created !== 1 ? 's' : ''} created,{' '}
                        {results.resolved} OPEN{results.resolved !== 1 ? 's' : ''} resolved
                        {results.tangentCreated > 0 && (
                            <>, {results.tangentCreated} tangent{results.tangentCreated !== 1 ? 's' : ''} routed</>
                        )}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">{results.summary}</p>
                </div>

                {/* Phase Ratchet Prompt */}
                {phaseAdvanceCandidate && (
                    <div className="mt-4 bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                        <div className="text-sm text-amber-200 mb-2">
                            <span className="font-medium">Phase Check:</span>{' '}
                            Stored: <span className="font-mono">{storedPhase}</span> →{' '}
                            Computed: <span className="font-mono">{computedPhase}</span>
                        </div>
                        <p className="text-xs text-amber-300/70 mb-3">
                            The ODRC distribution suggests this idea has matured. Advance phase?
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button onClick={close}
                                className="px-3 py-1.5 rounded text-xs bg-slate-700 hover:bg-slate-600">
                                Keep {storedPhase}
                            </button>
                            <button onClick={handleAdvancePhase} disabled={advancing}
                                className="px-3 py-1.5 rounded text-xs bg-amber-700 hover:bg-amber-600 font-medium disabled:opacity-50">
                                {advancing ? '⏳...' : `Advance to ${computedPhase}`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Debrief & Next Session */}
                {pendingOdrcImport?.sessionData?.debrief_summary && (
                    <div className="mt-3 text-xs text-slate-400">
                        📋 {pendingOdrcImport.sessionData.debrief_summary}
                    </div>
                )}
                {pendingOdrcImport?.sessionData?.next_session && (
                    <div className="mt-1 text-xs text-slate-500">
                        📎 Next: {typeof pendingOdrcImport.sessionData.next_session === 'string'
                            ? pendingOdrcImport.sessionData.next_session
                            : pendingOdrcImport.sessionData.next_session.focus || 'See session data'}
                    </div>
                )}

                {pushingDoc && <p className="text-xs text-slate-400 mt-2 animate-pulse">Pushing session doc to repo...</p>}

                <div className="flex justify-center mt-4">
                    <button onClick={close}
                        className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 font-medium">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
```

**IMPORTANT:** The phase ratchet is one-directional. `phaseAdvanceCandidate` is `true` ONLY when computed > stored in `PHASE_ORDER`. If stored > computed (developer manually advanced, new OPENs arrived), no prompt appears — the ratchet holds. The developer can always advance manually via `IdeaManager.advancePhase()` regardless of what `computeIdeaPhase()` returns.

---

### Phase D: Context Package Button

**13. "Download Context Package" in ExploreInChatModal**

Add handler and button to `ExploreInChatModal` (~line 16041).

Add handler after `pushToRepo` (~line 16174):

```javascript
const downloadContextPackage = async () => {
    try {
        const ctxZip = new JSZip();

        // 1. Codebase from GitHub
        if (app && github) {
            const repo = app.repos?.test || app.testRepo || app.repos?.prod || app.prodRepo;
            if (repo) {
                for (const path of ['index.html', 'sw.js', 'manifest.json', 'CLAUDE.md']) {
                    try {
                        const f = await github.getFile(repo, path);
                        if (f?.content) ctxZip.file(`codebase/${path}`, atob(f.content));
                    } catch {} // Skip if not found
                }
            }
        }

        // 2. Existing spec docs from prior spec sessions
        const specSessions = (idea.sessionLog || []).filter(s => s.type === 'spec' && s.docPath);
        if (specSessions.length > 0 && github && app) {
            const repo = app.repos?.test || app.testRepo || app.repos?.prod || app.prodRepo;
            if (repo) {
                for (const specSession of specSessions) {
                    try {
                        const f = await github.getFile(repo, specSession.docPath);
                        if (f?.content) {
                            ctxZip.file(`specs/${specSession.docPath.split('/').pop()}`, atob(f.content));
                        }
                    } catch {} // Skip if not found
                }
            }
        }

        // 3. Current ODRC state snapshot
        const activeConcepts = globalConcepts.filter(c => c.ideaOrigin === idea.id && c.status === 'active');
        const odrcSnapshot = activeConcepts.map(c => ({
            type: c.type,
            content: c.content,
            status: c.status,
            createdAt: c.createdAt
        }));
        ctxZip.file('context/odrc-state.json', JSON.stringify(odrcSnapshot, null, 2));

        // 4. Session history summary
        const sessionSummary = (idea.sessionLog || []).map(s => ({
            sessionId: s.sessionId,
            date: s.date,
            type: s.type,
            summary: s.summary,
            conceptsCreated: s.conceptsCreated,
            conceptsResolved: s.conceptsResolved
        }));
        ctxZip.file('context/session-history.json', JSON.stringify(sessionSummary, null, 2));

        // Generate and download
        const blob = await ctxZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `context-package-${slug}-S${String(sessionNum).padStart(3, '0')}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        // Update active session activity if exists
        if (firebaseUid && idea.activeSession) {
            try {
                await IdeaManager.updateSessionActivity(firebaseUid, idea.id, {
                    contextPackageDownloaded: true
                });
            } catch {} // Best-effort
        }

        console.log('[CC] Downloaded context package for', idea.name);
        await showAlert('Context package downloaded', '📦 Downloaded');
    } catch (e) {
        await showAlert('Context package download failed: ' + e.message, '❌ Error');
    }
};
```

**14. Add Button to Modal Action Bar**

In the button row (~line 16282), add the context package button. It is ALWAYS visible — no conditional logic:

```jsx
<div className="flex gap-2 p-4 border-t border-slate-700 justify-end flex-wrap">
    <button onClick={copyPrompt}
        className="px-4 py-2 rounded text-sm bg-slate-700 hover:bg-slate-600 font-medium">
        📋 Copy Prompt
    </button>
    {isLargeBrief || idea.sessionLog?.length > 0 ? (
        <button onClick={downloadZip} disabled={!briefText}
            className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50">
            📦 Download Zip
        </button>
    ) : (
        <button onClick={copyBrief} disabled={!briefText}
            className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50">
            📋 Copy Brief
        </button>
    )}
    {/* NEW: Context Package — always visible */}
    <button onClick={downloadContextPackage}
        className="px-4 py-2 rounded text-sm bg-amber-700 hover:bg-amber-600 font-medium"
        title="Download codebase + specs + ODRC state for spec/CLAUDE.md sessions">
        📦 Context Package
    </button>
    <button onClick={pushToRepo} disabled={pushing || !briefText}
        className="px-4 py-2 rounded text-sm bg-green-700 hover:bg-green-600 font-medium disabled:opacity-50">
        {pushing ? '⏳ Pushing...' : '🚀 Push to Repo'}
    </button>
</div>
```

---

## Existing Infrastructure Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `SessionPackageProcessor` | ~line 2811 | Validates session.json, maps ODRC types, builds session log entries, extracts metadata |
| `SESSION_JSON_SCHEMA_VERSION` | ~line 2809 | Schema version constant ('1.0.0') for validation |
| `detectInboundArtifactType()` | ~line 3004 | Four-path routing: session-json → odrc → claude-md → spec |
| `detectODRCContent()` | ~line 2927 | Content-based ODRC markdown detection |
| `extractODRCMetadata()` | ~line 2959 | Pulls idea slug, ideaId, session number, appId from ODRC markdown headers |
| `ODRCUpdateIngestionService` | ~line 2708 | Parses ODRC markdown and executes concept create/resolve operations |
| `findDuplicateConcepts()` | ~line 3022 | Fuzzy token matching for duplicate detection |
| `executeODRCImport()` | ~line 3046 | Orchestrates import: concept updates, summary generation, session log entry, activeSession clearing |
| `ODRCImportChecklistModal` | ~line 12593 | Full import UI: auto-link cascade, checklist, inline idea creation, dual-track repo push, results screen |
| `ExploreInChatModal` | ~line 16041 | Session dispatch: brief generation, download zip, copy prompt, push to repo |
| `IdeaManager` | ~line 5730 | Firebase CRUD for ideas: create, advancePhase, activateSession, completeSession, abandonSession, addSessionLogEntry, updateSessionActivity |
| `computeIdeaPhase()` | ~line 6100 | Advisory phase calculation from ODRC concept ratios |
| `generateSessionId()` | ~line 6128 | Produces `S-YYYY-MM-DD-NNN` format session IDs |
| `IdeationBriefGenerator` | ~line 3148 | Generates session briefs with lens/mode configuration |
| `handleFileDrop` | ~line 7537 | File/zip drop handler — entry point for all inbound file processing |
| `isMultiAppZip()` | (in deploy code) | Existing deploy package detection |
| `DashboardView` | ~line 10536 | Main dashboard component where `pendingOdrcImport` state lives |

---

## Architecture Rules

### State Management Rules
- `pendingOdrcImport` state object is the single bridge between file detection and the import checklist. All new fields (`debriefContent`, `artifactFiles`, `validationWarnings`) are additive — do not break existing fields.
- `globalIdeas` and `globalConcepts` are top-level state with Firebase listeners. Import operations write to Firebase; the listeners propagate changes to the UI. Do not manually update local state after writes.
- Phase is stored on the idea record (`idea.phase`). `computeIdeaPhase()` is advisory only — never write its output to the idea record automatically. Only `IdeaManager.advancePhase()` writes phase, and it requires explicit developer action.

### Data Flow Rules
- Session package processing is synchronous through validation, then async for Firebase writes. Validation failures block the pipeline — show an error alert and return.
- Tangent routing is best-effort. If slug resolution fails, the item falls through to the primary idea. Never block import because a tangent target is missing.
- Debrief storage is fire-and-forget after the primary import succeeds. A debrief storage failure should not fail the import — log and continue.
- Context package GitHub API calls fail per-file, not as a batch. Missing files are silently skipped. The package should always download even if some files aren't fetchable.

---

## Conventions

- **Function naming:** Service methods are camelCase (`storeDebrief`, `extractDebrief`). Detection functions are camelCase (`isSessionPackageZip`). Constants are UPPER_SNAKE_CASE (`PHASE_ORDER`, `SESSION_JSON_SCHEMA_VERSION`).
- **Console logging:** Prefix all log messages with `[CC]`. Use `console.log` for normal flow, `console.warn` for degraded flow, `console.error` for failures.
- **Error handling:** Wrap Firebase writes in try/catch. Show `showAlert` for user-facing errors. Use `console.warn` for silent degradation. Never throw from import handlers — always catch and report.
- **Slugs:** Use `IdeaManager.generateSlug()` for all slug generation. Never hand-construct slugs.
- **Firebase paths:** Ideas at `command-center/{uid}/ideas/{ideaId}`. Debriefs at `command-center/{uid}/ideas/{ideaId}/debriefs/{sessionId}`. No new top-level collections.
- **Version bump:** Increment to 8.69.0 in `<meta name="version">` tag (line 7).

---

## File Structure

All changes in `index.html`:

| Location | What Changes |
|----------|-------------|
| Line ~7 | Version bump: 8.68.0 → 8.69.0 |
| After ~line 2919 | NEW: `isSessionPackageZip()`, `extractDebrief()` added to SessionPackageProcessor |
| ~line 2861 | MODIFIED: `toIngestionUpdates()` — add tangent routing fields |
| Near phase constants | NEW: `PHASE_ORDER` constant |
| ~line 3046 | MODIFIED: `executeODRCImport()` — tangent routing, debrief storage |
| ~line 5845 | NEW: `IdeaManager.storeDebrief()` method |
| ~line 7566 | MODIFIED: `handleFileDrop` — add session package check before deploy routing |
| Component scope | NEW: `processSessionPackage()` handler function |
| ~line 12593 | MODIFIED: `ODRCImportChecklistModal` — session package header, tangent display, debrief preview, artifact inventory, phase ratchet prompt |
| ~line 16041 | MODIFIED: `ExploreInChatModal` — add `downloadContextPackage` handler and button |

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit all code changes to the repo
2. Archive this CLAUDE.md to `cc/specs/sp_session_tab_unit5.md`
3. Generate a completion file to `.cc/completions/` per the format below
4. Commit the spec archive and completion file together in a separate commit

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_ingestion-pipeline.md`

**Completion file format:**

```yaml
---
task: "Ingestion Pipeline — session package detection, validation, ODRC import with tangent routing, debrief storage, phase ratchet prompt, context package button"
status: complete | partial
cc-spec-id: sp_session_tab_unit5
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{implementation decisions made during build}"
  resolved_opens:
    - "{resolved}"
  new_opens:
    - "{new questions surfaced during implementation}"
unexpected_findings:
  - "{anything unexpected encountered}"
unresolved:
  - "{anything not completed}"
---

## Approach

{Brief narrative of build approach — which phase was tackled first, any deviations from spec}

## Implementation Notes

{Key technical details, line number references, anything the next session should know}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
