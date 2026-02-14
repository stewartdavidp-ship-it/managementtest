# CLAUDE.md — Landing Page & Session Card UX
# cc-spec-id: sp_session_tab_unit4
# App: Command Center (index.html)
# Base version: 8.67.0
# Target version: 8.68.0
# Depends on: sp_session_lifecycle (Unit 2, implemented in 8.67.0)

---

## Before You Begin

This task transforms the home page work card section into a session-driven operational surface. The card evolves from a simple idea display into a dual-state session card showing both session lifecycle and idea phase. It touches `IdeaWorkCard` (card rendering), `getRecentIdeas()` (data enrichment), `DashboardView` (upload results flow), and adds session package detection signatures. Review the full scope below, then tell me:

1. Can you complete this in one session, or should we split into phases?
2. If splitting, where would you draw the line?

Provide your assessment before writing any code. I'll confirm the approach.

---

## Task Summary

Evolve `IdeaWorkCard` into a dual-state session card that visually distinguishes active sessions (green glow, session ID, dispatch time) from pending cards (phase-colored, Continue action). Add active-first sorting so in-flight work pins to the top. Change the Continue button to "Upload Results" when a session is active. Add a file picker flow for uploading session packages from active cards. Implement progressive staleness indicators. Add session package filename detection signatures for Chrome directory watching. Enrich the session history display in IdeasView with chain metadata, debrief summaries, and phase transitions.

---

## What to Build

### Phase A: Card Data Model & Sorting

**1. Extend `getRecentIdeas()` with session state enrichment** (~line 6107)

In the `return sorted.map(idea => { ... })` block (~line 6119), add session lifecycle fields to the returned object:

```javascript
return {
    ...idea,
    // Existing fields
    openCount, totalConcepts, appName, lastSession, sessionCount, phase,
    // New session lifecycle fields
    sessionState: idea.activeSession ? 'active' : 'pending',
    activeSessionId: idea.activeSession?.sessionId || null,
    activeSessionCreatedAt: idea.activeSession?.createdAt || null,
    briefDownloaded: idea.activeSession?.briefDownloaded || false,
    staleDays: idea.activeSession
        ? Math.floor((Date.now() - new Date(idea.activeSession.lastActivityAt || idea.activeSession.createdAt).getTime()) / 86400000)
        : null
};
```

**2. Update sorting to pin active sessions first** (~line 6109)

Replace the existing sort-and-slice logic with a two-tier sort:

```javascript
function getRecentIdeas(globalIdeas, globalConcepts, apps, maxCount = 8) {
    const active = [...(globalIdeas || [])]
        .filter(idea => idea.status === 'active');

    // Partition: active sessions first, then pending by recency
    const withSession = active.filter(i => i.activeSession);
    const withoutSession = active.filter(i => !i.activeSession);

    const sortByRecency = (a, b) => {
        const dateA = a.lastSessionDate || new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = b.lastSessionDate || new Date(b.updatedAt || b.createdAt || 0).getTime();
        return (typeof dateB === 'number' ? dateB : 0) - (typeof dateA === 'number' ? dateA : 0);
    };

    withSession.sort(sortByRecency);
    withoutSession.sort(sortByRecency);

    const sorted = [...withSession, ...withoutSession].slice(0, maxCount);

    return sorted.map(idea => {
        // ... existing enrichment (unchanged)
    });
}
```

Note: `maxCount` increases from 5 to 8 to accommodate active sessions pinned at top without pushing pending cards off the list.

**3. Add `formatTimeAgo()` utility** (near `generateSessionId()`, ~line 6094)

```javascript
function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const ms = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
```

---

### Phase B: Session Card Visual States

**1. Add staleness threshold constants** (above `PHASE_COLORS`, ~line 15865)

```javascript
const STALE_WARNING_DAYS = 7;
const STALE_ESCALATED_DAYS = 14;
```

**2. Rewrite `IdeaWorkCard` to support dual state** (~line 15875)

Replace the existing `IdeaWorkCard` function. The card renders differently based on `idea.sessionState`:

```javascript
function IdeaWorkCard({ idea, onNavigateIdea, onNavigateApp, onContinue, onUploadResults }) {
    const isActive = idea.sessionState === 'active';
    const isStale = idea.staleDays >= STALE_WARNING_DAYS;
    const isEscalated = idea.staleDays >= STALE_ESCALATED_DAYS;
    const phase = PHASE_COLORS[idea.phase] || PHASE_COLORS.exploring;

    // Card border: green glow for active, amber for escalated stale, default for pending
    const cardBorder = isEscalated
        ? 'border-amber-600/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
        : isActive
            ? 'border-green-600/60 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
            : 'border-slate-700/50';

    // Left stripe: green for active, phase color for pending
    const stripeColor = isActive ? '#22c55e' : phase.stripe;

    const sessionLabel = idea.lastSession ? `Session ${idea.sessionCount}` : 'No sessions';
    const dateLabel = idea.lastSession
        ? new Date(idea.lastSession.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : idea.updatedAt
            ? new Date(idea.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
            : '';

    return (
        <div
            onClick={() => onNavigateIdea(idea.id)}
            className={`flex items-center gap-4 p-4 rounded-xl border bg-slate-800/50 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${cardBorder}`}
            title="Go to Idea"
        >
            <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: stripeColor }} />
            <div className="flex-1 min-w-0">
                {/* Row 1: Name + App badge */}
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-100 truncate">{idea.name}</span>
                    <span
                        onClick={e => { e.stopPropagation(); onNavigateApp(idea.appId); }}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 cursor-pointer hover:bg-indigo-500/25 flex-shrink-0"
                        title="Go to App"
                    >{idea.appName}</span>
                </div>

                {/* Row 2: Phase + Session state + metadata */}
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {/* Phase badge (idea maturity — always shown) */}
                    <span className="px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                          style={{ background: phase.bg, color: phase.text, fontSize: '10px' }}>{idea.phase}</span>

                    {isActive ? (
                        <React.Fragment>
                            {/* Session state badge */}
                            <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-400 font-semibold uppercase tracking-wider" style={{ fontSize: '10px' }}>
                                active
                            </span>
                            <span className="opacity-40">·</span>
                            <span>{idea.activeSessionId}</span>
                            <span className="opacity-40">·</span>
                            <span>dispatched {formatTimeAgo(idea.activeSessionCreatedAt)}</span>
                            {isStale && (
                                <span className={`font-medium ${isEscalated ? 'text-red-400' : 'text-amber-400'}`}>
                                    ⚠️ {idea.staleDays}d
                                </span>
                            )}
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            <span>{sessionLabel}</span>
                            {dateLabel && (<React.Fragment><span className="opacity-40">·</span><span>{dateLabel}</span></React.Fragment>)}
                            <span className="opacity-40">·</span>
                            <span className={`font-mono font-semibold ${idea.openCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{idea.openCount} OPENs</span>
                        </React.Fragment>
                    )}
                </div>
            </div>

            {/* Action button: Continue for pending, Upload Results for active */}
            <button
                onClick={e => { e.stopPropagation(); isActive ? onUploadResults(idea) : onContinue(idea); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: isActive
                    ? (isEscalated ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #22c55e, #16a34a)')
                    : 'linear-gradient(135deg, #667eea, #764ba2)' }}
                title={isActive ? 'Upload session results' : 'Generate session brief'}
            >
                {isActive ? 'Upload Results' : 'Continue'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isActive
                        ? <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                        : <path d="M5 12h14M12 5l7 7-7 7"/>}
                </svg>
            </button>
        </div>
    );
}
```

---

### Phase C: DashboardView Integration

**1. Add `workCardUploadResults` handler** (~line 10508, after existing `workCardContinue`)

```javascript
const workCardUploadResults = async (idea) => {
    // Open file picker for session package
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.json,.md';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        // Route through existing file drop pipeline with idea hint
        for (const file of files) {
            // Stage the file like a normal drop, pre-selecting the linked idea
            await onFileDrop([file]);
        }
        // If the idea has an active session, the ODRC import flow will auto-match
        // via the session.json metadata (idea.slug, idea.id)
    };
    input.click();
};
```

**2. Update section header** (~line 12467)

Change "Recent Work" to "Active Work":

```javascript
<div className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Active Work</div>
```

**3. Pass new prop to `IdeaWorkCard`** (~line 12482)

Add `onUploadResults` prop:

```jsx
{workCardRecentIdeas.map(idea => (
    <IdeaWorkCard key={idea.id} idea={idea}
        onNavigateIdea={workCardNavigateIdea}
        onNavigateApp={workCardNavigateApp}
        onContinue={workCardContinue}
        onUploadResults={workCardUploadResults} />
))}
```

**4. Add abandon session action for stale cards**

Add a small context action on active cards. The simplest approach: an "✕" button visible on active cards that triggers abandon:

In the `IdeaWorkCard` component, add before the main action button when `isActive && isStale`:

```jsx
{isActive && isStale && (
    <button
        onClick={async (e) => {
            e.stopPropagation();
            if (window.confirm(`Abandon session ${idea.activeSessionId}? This cannot be undone.`)) {
                // onAbandon is a new prop — see below
                onAbandon(idea);
            }
        }}
        className="text-xs text-slate-500 hover:text-red-400 px-2 py-1 rounded transition-colors"
        title="Abandon this session"
    >
        ✕ Abandon
    </button>
)}
```

Add the handler in DashboardView:

```javascript
const workCardAbandon = async (idea) => {
    if (!firebaseUid || !idea.activeSession) return;
    try {
        await IdeaManager.abandonSession(firebaseUid, idea.id, idea.activeSessionId);
        await showAlert(`Session ${idea.activeSessionId} abandoned.`, '🗑️ Abandoned');
    } catch (e) {
        await showAlert(`Error: ${e.message}`, '❌ Error');
    }
};
```

Pass `onAbandon={workCardAbandon}` to `IdeaWorkCard`.

---

### Phase D: Session Package Detection (Chrome)

**1. Add session package detection signature builder** (near `buildDetectionSignatures`, ~line 4516)

```javascript
function buildSessionPackageSignatures(globalIdeas) {
    return (globalIdeas || [])
        .filter(i => i.status === 'active' && i.activeSession)
        .map(idea => {
            const slug = (idea.slug || '').replace(/[^a-z0-9-]/g, '');
            return {
                ideaId: idea.id,
                ideaName: idea.name,
                sessionId: idea.activeSession.sessionId,
                // Match the zip filename generated by ExploreInChatModal (~line 16044)
                pattern: new RegExp(
                    `session-brief-${slug}-S\\d{3}\\.zip$`, 'i'
                )
            };
        });
}
```

**2. Integrate with existing file polling**

Wherever the existing completion file polling runs (on tab focus / visibility change), add a parallel check against session package signatures:

```javascript
// After existing completion file detection logic:
const sessionSigs = buildSessionPackageSignatures(globalIdeas);
for (const file of directoryFiles) {
    for (const sig of sessionSigs) {
        if (sig.pattern.test(file.name)) {
            // Surface ingestion prompt
            addNotification({
                type: 'session-package-detected',
                ideaId: sig.ideaId,
                ideaName: sig.ideaName,
                sessionId: sig.sessionId,
                fileName: file.name,
                file: file
            });
        }
    }
}
```

IMPORTANT: The exact integration point depends on how the existing completion file polling is structured. If directory watching is not yet implemented (only completion file detection via repo polling exists), then this becomes a stub that's wired in when directory watching is built. Check whether `showDirectoryPicker` / File System Access API is currently used anywhere in the codebase. If not, add a TODO comment with the signature builder and skip the polling integration.

**3. Session package notification banner**

If the notification system (`addNotification`) supports it, render a banner in DashboardView:

```jsx
{notifications.filter(n => n.type === 'session-package-detected').map(n => (
    <div key={n.fileName} className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <span>📦</span>
            <span className="text-sm text-indigo-200">
                Session package detected for <strong>{n.ideaName}</strong>
            </span>
        </div>
        <div className="flex gap-2">
            <button onClick={() => handleSessionPackageIngest(n)}
                className="px-3 py-1 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                Review & Ingest
            </button>
            <button onClick={() => dismissNotification(n.fileName)}
                className="px-2 py-1 text-sm rounded text-slate-400 hover:text-slate-200">
                Dismiss
            </button>
        </div>
    </div>
))}
```

If the notification infrastructure doesn't exist yet, implement this as a simple state array in DashboardView: `const [sessionPackageAlerts, setSessionPackageAlerts] = React.useState([]);`

---

### Phase E: Session History Enrichment (IdeasView)

**1. Locate session history rendering** in IdeasView idea-detail mode

Find where `idea.sessionLog` is rendered in the idea-detail view. It's likely in the `mode === 'idea-detail'` branch of IdeasView (~line 16191+). Look for where session log entries are mapped and displayed.

**2. Enrich session log entry display**

For each session log entry, render the new fields when present:

```jsx
{/* Inside the session log rendering loop */}
{session.chain && (
    <div className="text-xs text-slate-500 mt-1">
        {session.chain.linkCount} link{session.chain.linkCount !== 1 ? 's' : ''} · {session.chain.totalConceptBlocks || 0} concept blocks · {session.chain.totalElapsedMinutes || 0}min
    </div>
)}

{session.debriefSummary && (
    <details className="mt-2">
        <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">
            View debrief summary
        </summary>
        <p className="text-xs text-slate-400 mt-1 pl-3 border-l-2 border-slate-700 whitespace-pre-wrap">
            {session.debriefSummary}
        </p>
    </details>
)}

{session.nextSession && (
    <div className="text-xs text-slate-500 mt-1 italic">
        Next: {session.nextSession}
    </div>
)}

{session.ideaPhaseAtStart && session.ideaPhaseAtEnd &&
 session.ideaPhaseAtStart !== session.ideaPhaseAtEnd && (
    <div className="text-xs mt-1">
        Phase: <span className="text-slate-400">{session.ideaPhaseAtStart}</span>
        {' → '}<span className="text-green-400">{session.ideaPhaseAtEnd}</span>
    </div>
)}

{session.status === 'abandoned' && (
    <span className="text-xs text-red-400 font-medium">abandoned</span>
)}
```

Find the exact insertion point by searching for where `sessionLog` entries are rendered (look for `.map(` on `sessionLog` or similar). The enrichment fields are additive — they only render when present, so existing sessions without these fields display unchanged.

---

## Existing Infrastructure Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `IdeaWorkCard` | ~line 15875 | Current home page card — evolves to dual-state |
| `PHASE_COLORS` | ~line 15867 | Phase-to-color mapping — unchanged |
| `getRecentIdeas()` | ~line 6107 | Enriches ideas for card display — extend with session state |
| `generateSessionId()` | ~line 6094 | Generates S-YYYY-MM-DD-NNN format IDs |
| `DashboardView` | ~line 10494 | Home page container — hosts work cards section |
| `workCardContinueIdea` state | ~line 10499 | Tracks which idea opened ExploreInChatModal |
| `workCardRecentIdeas` | ~line 10500 | Result of `getRecentIdeas()` call |
| `IdeaWorkCard` render | ~line 12482 | Where cards are mapped in DashboardView |
| Section header "Recent Work" | ~line 12467 | Header text to update |
| `ExploreInChatModal` | ~line 15926 | Session launch modal — already has active session guard (v8.67.0) |
| `IdeaManager.activateSession()` | ~line 5800 | Creates activeSession on idea — already implemented |
| `IdeaManager.completeSession()` | ~line 5815 | Clears activeSession — already implemented |
| `IdeaManager.abandonSession()` | ~line 5833 | Logs abandoned session + clears activeSession — already implemented |
| `SessionPackageProcessor` | ~line 2811 | Validates/processes session.json — unchanged |
| `executeODRCImport()` | ~line 3066 | Writes concepts, clears activeSession — already handles lifecycle |
| `buildDetectionSignatures()` | ~line 4516 | Completion file detection patterns — model for session package detection |
| `onFileDrop` | DashboardView prop | File drop handler for staged files — used for upload results flow |
| `addNotification` | DashboardView prop | Notification system — used for session package detection alerts |
| IdeasView session history | ~line 16191+ | Idea-detail mode — session log rendering to enrich |

---

## Architecture Rules

### State Management Rules
- Session state (`activeSession`) lives on the idea record in Firebase, not in local component state. Cards react to Firebase changes via `IdeaManager.listen()` → `setGlobalIdeas` pipeline.
- The card never directly mutates `activeSession`. All transitions go through `IdeaManager` methods.
- `getRecentIdeas()` is the single enrichment point for card data. All computed fields (sessionState, staleDays, etc.) are derived there, not in the card component.
- Session package detection signatures rebuild on each poll from current `globalIdeas` state — not cached.

### Data Flow Rules
- Home page → card click → IdeasView navigation uses existing `setView('ideas')` + `setViewPayload({ ideaId })` pattern.
- Continue → `ExploreInChatModal` → Download Zip → `activateSession()` → Firebase updates → cards re-render (no manual refresh).
- Upload Results → file picker → existing drop handler → ODRC import → `completeSession()` → Firebase updates → card returns to pending.
- Abandon → `abandonSession()` → Firebase updates → card returns to pending with abandoned log entry.

---

## Conventions

- Active session green: `#22c55e` (Tailwind green-500). Used for stripe, border glow, and active badge.
- Staleness warning amber: `#f59e0b` (Tailwind amber-500). Escalated: `#ef4444` (Tailwind red-500) for text.
- Threshold constants: `STALE_WARNING_DAYS = 7`, `STALE_ESCALATED_DAYS = 14` — starting values, refine from usage.
- Time display: `formatTimeAgo()` for relative times on active cards. Absolute dates remain for pending cards (existing pattern).
- Component may keep internal name `IdeaWorkCard` to minimize diff. All new code and comments use "session card" terminology.
- Session package zip filename pattern: `session-brief-{slug}-S{NNN}.zip` (generated by ExploreInChatModal ~line 16044).

---

## File Structure

All changes are in `index.html` (single-file app):

| Section | Changes |
|---------|---------|
| `formatTimeAgo()` (new, ~6094) | New utility function |
| `getRecentIdeas()` (~6107) | Add session state enrichment, active-first sorting, increase maxCount to 8 |
| `buildSessionPackageSignatures()` (new, ~4516) | Session package filename detection |
| `STALE_WARNING_DAYS`, `STALE_ESCALATED_DAYS` (new, ~15865) | Staleness threshold constants |
| `IdeaWorkCard` (~15875) | Rewrite to dual-state card with active/pending rendering, new props |
| `DashboardView` (~10494) | Add `workCardUploadResults`, `workCardAbandon` handlers |
| Section header (~12467) | "Recent Work" → "Active Work" |
| Card rendering (~12482) | Pass `onUploadResults`, `onAbandon` props |
| IdeasView idea-detail (~16191+) | Enrich session history with chain/debrief/phase fields |
| Notification banner (new, in DashboardView) | Session package detection alerts |

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit all code changes
2. Archive this CLAUDE.md to `cc/specs/sp_session_tab_unit4.md`
3. Generate completion file to `.cc/completions/`
4. Commit spec archive and completion file separately

Completion file format:
```yaml
# .cc/completions/sp_session_tab_unit4.yaml
spec_id: sp_session_tab_unit4
task: "Landing Page & Session Card UX"
status: complete  # complete | partial | blocked
version: "8.68.0"
date: YYYY-MM-DD
changes:
  - "Evolved IdeaWorkCard to dual-state session card (active/pending)"
  - "Active sessions pin to top of home page work cards"
  - "Continue button changes to Upload Results when session active"
  - "Progressive staleness indicators (7d warning, 14d escalated)"
  - "File picker upload results flow from active cards"
  - "Abandon session action for stale cards"
  - "Section header: Recent Work → Active Work"
  - "Session package detection signatures for Chrome directory watching"
  - "Session history enrichment with chain metadata and debrief summaries"
notes: ""
tests_passed: true
files_modified:
  - index.html
```
