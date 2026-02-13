# CLAUDE.md — Developer Landing Page (Replace Home with Work Board)
# cc-spec-id: feature_developer_landing_page
# App: Command Center (index.html)
# Base version: 8.64.1
# Target version: +0.1.0
# Depends on: none

---

## Task Summary

Replace the current DashboardView (Home tab) with a developer-centric landing page. The current Home screen is organized around deploy operations and project/app taxonomy. The new landing page is organized around the developer's active work — what am I working on, and how do I get back into a session fast.

The landing page has two zones:
- **Inbound (top):** The existing drop box for session artifact intake
- **Outbound (below):** Idea work cards — top 5 by recency — each launchable into a session brief

Design philosophy: **CC is invisible infrastructure.** The developer wants to be in Claude Chat or Claude Code, not in CC. This page minimizes time-in-CC by making the path from "open CC" to "in a session with full context" as few clicks as possible.

Design mockup: `cc-landing-page-mockup.html` (included in this package)

---

## What's Changing

**Location:** DashboardView function in index.html

The current DashboardView contains:
1. Slim drop zone (file upload/drag-drop) — **KEEPING, moved to top**
2. App cards organized by project with version badges, deploy controls, session launch icons — **REMOVING from Home**
3. Pipeline summary bar — **REMOVING from Home**
4. Staged files panel and deploy controls — **REMOVING from Home**
5. Quick actions bar in header — **NO CHANGE** (lives outside DashboardView)

The project/app cards, deploy controls, staged files, and pipeline summary all move to the Projects view (they already exist there in various forms). The DashboardView becomes the lean work board described below.

---

## What to Build

### T1: Idea Card Data Query

Add a helper function that queries the top 5 Ideas by recency. This should be placed near the existing IdeaManager usage.

```javascript
function getRecentIdeas(globalIdeas, globalConcepts, maxCount = 5) {
    // Sort ideas by lastSessionDate (descending), fall back to updatedAt
    const sorted = [...globalIdeas]
        .filter(idea => idea.status === 'active')
        .sort((a, b) => {
            const dateA = a.lastSessionDate || a.updatedAt || a.createdAt || 0;
            const dateB = b.lastSessionDate || b.updatedAt || b.createdAt || 0;
            return dateB - dateA;
        })
        .slice(0, maxCount);

    // Enrich each idea with concept counts and session info
    return sorted.map(idea => {
        const ideaConcepts = globalConcepts.filter(c => c.ideaOrigin === idea.id);
        const openCount = ideaConcepts.filter(c => c.type === 'OPEN' && c.status === 'active').length;
        const totalConcepts = ideaConcepts.length;

        // Get the app name from config if appId exists
        const app = idea.appId ? config?.apps?.[idea.appId] : null;
        const appName = app ? app.id : 'unassigned';

        // Get session info
        const sessionLog = idea.sessionLog || [];
        const lastSession = sessionLog.length > 0 ? sessionLog[sessionLog.length - 1] : null;

        return {
            ...idea,
            openCount,
            totalConcepts,
            appName,
            lastSession,
            sessionCount: sessionLog.length,
            phase: idea.phase || 'exploring'
        };
    });
}
```

### T2: Idea Card Component

Create an `IdeaWorkCard` component. This is the primary UI element on the landing page.

**Card interaction model — four click targets:**
- **Card body click** → navigates to Idea Detail (`setView('ideas')` then set idea detail mode)
- **App tag click** → navigates to App page (stopPropagation)
- **Session link click** → navigates to session detail (stopPropagation)
- **Continue button click** → opens the session brief/prompt builder modal (stopPropagation)

**Card layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ▌ Idea Name                                    [app-tag]       │
│ ▌ ● exploring    Session 13  ·  Feb 13, 2026 2:30 PM  · 5 OPENs │
│                                                    [Continue →] │
└─────────────────────────────────────────────────────────────────┘
```

- Left edge: 4px color stripe by phase (exploring=blue, building=green, refining=amber, spec=pink)
- Idea name: primary text, 15px, font-weight 600
- App tag: monospace pill badge, links to app
- Phase badge: colored pill matching phase
- Session number: clickable link to last session detail
- Date/time: full format (e.g. "Feb 13, 2026 2:30 PM") — use `lastSession.date` or `idea.updatedAt`
- OPEN count: monospace, amber if > 0, muted if 0
- Continue button: gradient primary button, triggers session brief generation

```jsx
function IdeaWorkCard({ idea, onNavigateIdea, onNavigateApp, onNavigateSession, onContinue }) {
    const PHASE_COLORS = {
        exploring: { stripe: '#3b82f6', bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
        building:  { stripe: '#22c55e', bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' },
        refining:  { stripe: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
        spec:      { stripe: '#f093fb', bg: 'rgba(240,147,251,0.15)', text: '#f093fb' }
    };

    const phase = PHASE_COLORS[idea.phase] || PHASE_COLORS.exploring;
    const sessionLabel = idea.lastSession
        ? `Session ${idea.sessionCount}`
        : 'No sessions';
    const dateLabel = idea.lastSession
        ? new Date(idea.lastSession.date).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
          })
        : idea.updatedAt
            ? new Date(idea.updatedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit'
              })
            : '';

    return (
        <div
            onClick={() => onNavigateIdea(idea.id)}
            className="flex items-center gap-4 p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 cursor-pointer transition-all hover:border-slate-600 hover:shadow-lg hover:-translate-y-0.5"
            title="Go to Idea"
        >
            {/* Phase stripe */}
            <div className="w-1 h-12 rounded-full flex-shrink-0"
                 style={{ background: phase.stripe }} />

            {/* Card body */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-100 truncate">
                        {idea.name}
                    </span>
                    <span
                        onClick={e => { e.stopPropagation(); onNavigateApp(idea.appId); }}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 cursor-pointer hover:bg-indigo-500/25 flex-shrink-0"
                        title="Go to App"
                    >
                        {idea.appName}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                          style={{ background: phase.bg, color: phase.text, fontSize: '10px' }}>
                        {idea.phase}
                    </span>
                    {idea.lastSession ? (
                        <span
                            onClick={e => { e.stopPropagation(); onNavigateSession(idea.id, idea.lastSession); }}
                            className="cursor-pointer hover:text-indigo-400 transition-colors"
                            title="Go to last session"
                        >
                            {sessionLabel}
                        </span>
                    ) : (
                        <span>{sessionLabel}</span>
                    )}
                    {dateLabel && (
                        <React.Fragment>
                            <span className="opacity-40">·</span>
                            <span>{dateLabel}</span>
                        </React.Fragment>
                    )}
                    <span className="opacity-40">·</span>
                    <span className={`font-mono font-semibold ${idea.openCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {idea.openCount} OPENs
                    </span>
                </div>
            </div>

            {/* Continue button */}
            <button
                onClick={e => { e.stopPropagation(); onContinue(idea); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                title="Generate session brief"
            >
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    );
}
```

### T3: Summary Stat Chips

Above the cards, show two clickable stat chips and a "New Idea" button.

```jsx
<div className="flex items-center gap-3 mb-4">
    <span
        onClick={() => setView('ideas')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400 cursor-pointer hover:text-slate-200 hover:border-slate-600 transition-colors"
    >
        <span className="font-bold font-mono text-indigo-400">{activeIdeaCount}</span> Active Ideas
    </span>
    <span
        onClick={() => setView('projects')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400 cursor-pointer hover:text-slate-200 hover:border-slate-600 transition-colors"
    >
        <span className="font-bold font-mono text-indigo-400">{activeAppCount}</span> Apps
    </span>
    <div className="flex-1" />
    <button
        onClick={() => { setView('ideas'); /* trigger new idea modal */ }}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
    >
        ＋ New Idea
    </button>
</div>
```

### T4: Empty State

When the developer has zero active Ideas, show a prompt to create their first one.

```jsx
{recentIdeas.length === 0 && (
    <div className="text-center py-16">
        <div className="text-4xl mb-4">💡</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No ideas yet</h3>
        <p className="text-sm text-slate-500 mb-6">Create your first idea to start tracking work</p>
        <button
            onClick={() => { setView('ideas'); /* trigger new idea modal */ }}
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
        >
            ＋ Create First Idea
        </button>
    </div>
)}
```

### T5: Rewrite DashboardView

Replace the current DashboardView body. Keep the function signature and any existing props/state that are still needed (particularly `onFileDrop` for the drop box). Remove project card rendering, staged files, pipeline summary, and deploy controls.

**New DashboardView structure:**

```jsx
function DashboardView({ config, onFileDrop, globalIdeas, globalConcepts, setView, ... }) {
    const recentIdeas = getRecentIdeas(globalIdeas, globalConcepts, 5);
    const activeIdeaCount = globalIdeas.filter(i => i.status === 'active').length;
    const activeAppCount = config?.apps ? Object.keys(config.apps).length : 0;

    // Navigation handlers
    const handleNavigateIdea = (ideaId) => {
        setView('ideas');
        // Set idea detail mode — depends on IdeasView state management
        // May need to pass ideaId via a shared state or URL param
    };

    const handleNavigateApp = (appId) => {
        if (appId) setView('projects');
        // Navigate to app within projects view
    };

    const handleNavigateSession = (ideaId, session) => {
        setView('sessions');
        // Navigate to specific session
    };

    const handleContinue = (idea) => {
        // Open the existing IdeaSessionBriefModal / ExploreInChatModal
        // This is the session brief generation flow that already exists
        // Trigger it with the idea pre-selected
    };

    return (
        <div className="space-y-6">

            {/* ═══ INBOUND: Drop Box ═══ */}
            <div
                onDrop={onFileDrop}
                onDragOver={e => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-900/20', 'py-8');
                    e.currentTarget.classList.remove('py-3', 'border-slate-600');
                }}
                onDragLeave={e => {
                    e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-900/20', 'py-8');
                    e.currentTarget.classList.add('py-3', 'border-slate-600');
                }}
                className="border-2 border-dashed border-slate-600 rounded-lg py-3 px-4 text-center transition-all duration-200 cursor-pointer"
            >
                <input type="file" multiple accept=".html,.js,.css,.json,.zip,.yml,.yaml,.md,.txt"
                       onChange={onFileDrop} className="hidden" id="upload" />
                <label htmlFor="upload"
                       className="cursor-pointer flex items-center justify-center gap-3 text-sm text-slate-400">
                    📥
                    <span>Drop session artifacts here</span>
                    <span className="text-xs text-slate-600">ODRC updates · session briefs · supporting docs</span>
                </label>
            </div>

            {/* ═══ SUMMARY STATS + NEW ═══ */}
            {/* T3 stat chips + New Idea button here */}

            {/* ═══ SECTION HEADER ═══ */}
            {recentIdeas.length > 0 && (
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
                    Recent Work
                </div>
            )}

            {/* ═══ OUTBOUND: Work Cards ═══ */}
            <div className="space-y-3">
                {recentIdeas.map(idea => (
                    <IdeaWorkCard
                        key={idea.id}
                        idea={idea}
                        onNavigateIdea={handleNavigateIdea}
                        onNavigateApp={handleNavigateApp}
                        onNavigateSession={handleNavigateSession}
                        onContinue={handleContinue}
                    />
                ))}
            </div>

            {/* ═══ EMPTY STATE ═══ */}
            {/* T4 empty state here */}

        </div>
    );
}
```

### T6: Navigation Wiring

The card navigation handlers need to communicate with other views. This depends on how CC currently manages cross-view navigation. Two approaches:

**Option A — Shared state (preferred if pattern exists):**
If CC already has a pattern for deep-linking into views (e.g., `setView('ideas', { ideaId: '...' })`), use it.

**Option B — Event-based:**
Set a `pendingNavigation` state on the App component that the target view reads on mount.

```javascript
// In App component state:
const [pendingNavigation, setPendingNavigation] = React.useState(null);

// Card click sets it:
setPendingNavigation({ view: 'ideas', ideaId: idea.id });
setView('ideas');

// IdeasView reads it on mount:
React.useEffect(() => {
    if (pendingNavigation?.view === 'ideas' && pendingNavigation.ideaId) {
        // Switch to idea detail mode for this idea
        setPendingNavigation(null);
    }
}, [pendingNavigation]);
```

Examine the existing `setView` usage patterns to determine which approach CC already supports. Use the existing pattern — do not invent a new one.

### T7: Continue Button — Session Brief Modal Integration

The Continue button must open the existing session brief generation modal with the idea pre-selected. This is the `ExploreInChatModal` or equivalent that already exists in the IdeasView.

**Do NOT build a new modal.** Reuse the existing one. The implementation depends on how the modal is currently triggered:

- If the modal is a standalone component that accepts an `idea` prop → render it at the DashboardView level and pass the selected idea
- If the modal is embedded in IdeasView → navigate to IdeasView and trigger it via shared state

Examine the existing `ExploreInChatModal` or `IdeaSessionBriefModal` to determine the integration path. The key requirement: clicking Continue on a card must end with the session brief/prompt builder modal open for that idea.

---

## What NOT to Do

- Do NOT delete the drop box — it stays as the inbound zone at the top of the page
- Do NOT build new deploy controls on this page — deploys happen on the Deploy view
- Do NOT add project/app card rendering — that lives on the Projects view
- Do NOT show more than 5 Idea cards — the Ideas view handles the full list
- Do NOT add aggregate OPEN counts to the summary stats — per-card OPENs are sufficient
- Do NOT build App or Project card types — MVP is Idea cards only
- Do NOT change the drop box behavior or file processing logic — only the visual wrapper changes
- Do NOT remove DashboardView's existing props/state that other parts of CC depend on — check dependencies before removing anything

---

## What Moves to Projects View

The following DashboardView content is removed from Home but should already exist on the Projects view. Verify these are accessible from Projects before removing from Home:

1. **App cards with version badges** — Projects view has app tables with version info
2. **Deploy controls (staged files, deploy button)** — Deploy view handles this
3. **Pipeline summary bar** — Analytics satellite has this
4. **SessionLaunchModal trigger (🤖 icon on app cards)** — This needs to remain accessible. If it's only triggered from DashboardView app cards, ensure there's an equivalent entry point on the Projects view or the Ideas view Continue button covers the use case.

**One addition to Projects view:** App version labels should be clickable/launchable — opening the deployed app in a new tab. Version badges already exist; they just need `target="_blank"` href to the GitHub Pages URL. This is a small separate task and is NOT part of this spec.

---

## Reference: Design Mockup

The design mockup (`cc-landing-page-mockup.html`) established:
- Dark background matching CC theme (#1a1a2e / #16213e)
- Drop box at top with dashed border, expand-on-drag behavior
- Two stat chips (Active Ideas count, Apps count) as navigation shortcuts
- "New Idea" gradient button inline with stats
- Cards as horizontal rows with: phase color stripe, idea name, app tag, phase badge, session link, date/time, OPEN count, Continue button
- Four click targets per card: card body → Idea, app tag → App, session → Session, Continue → Brief modal
- "Recent Work" section header above cards
- Empty state with create prompt when no Ideas exist

---

## Testing

1. **Fresh state:** Log in with a user that has no Ideas → verify empty state appears with "Create First Idea" button
2. **With Ideas:** Log in with a user that has 3 active Ideas → verify 3 cards appear sorted by most recently touched
3. **Max cards:** User with 8+ Ideas → verify only 5 cards shown, most recent first
4. **Card navigation — Idea:** Click card body → should navigate to Idea Detail in IdeasView
5. **Card navigation — App:** Click app tag → should navigate to Projects view (or app detail)
6. **Card navigation — Session:** Click session number → should navigate to session detail
7. **Card navigation — Continue:** Click Continue → should open session brief generation modal for that idea
8. **Drop box:** Drag a file over the drop box → verify it expands. Drop an ODRC update file → verify existing import flow processes it
9. **Stat chips:** Click "Active Ideas" chip → should navigate to IdeasView. Click "Apps" chip → should navigate to Projects view
10. **New Idea:** Click "New Idea" button → should navigate to IdeasView and open new idea creation
11. **Phase colors:** Verify cards show correct phase stripe and badge colors for exploring (blue), building (green), refining (amber), spec (pink)
12. **Date format:** Verify cards show full date/time (e.g. "Feb 13, 2026 2:30 PM"), not relative time
13. **OPEN count:** Verify cards show correct unresolved OPEN count — amber when > 0, muted when 0
14. **Responsiveness:** Verify cards stack properly on narrow viewports, Continue button wraps below card body on mobile

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit code
2. Archive this CLAUDE.md to `cc/specs/feature_developer_landing_page.md`
3. Generate completion file to `cc/completions/`
4. Commit spec archive and completion file separately
