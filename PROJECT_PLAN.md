# Command Center — Project Plan

## Mission

Single-file web application for managing deployment, monitoring, and configuration of the Game Shelf ecosystem and related projects.

---

## Completed Features

### Core Deployment (v8.0–8.3)
- [x] Drag-and-drop file deploy to GitHub Pages via API
- [x] Version detection from `<meta name="version">` tags
- [x] Auto-detect which app a file belongs to (regex patterns)
- [x] Deploy history with timestamps, versions, rollback support
- [x] Batch deploy from gs-active zip archives (Smart Deploy)
- [x] Multi-environment support (test, prod)
- [x] Test → Prod promotion workflow
- [x] GitHub Pages enable/force rebuild
- [x] Git tags on deploy
- [x] Quick rollback snapshots

### App Management (v8.3–8.7)
- [x] App categories (public/internal/other)
- [x] Repo auto-mapping from GitHub API
- [x] App edit modal with detection patterns, repo patterns
- [x] SubPath support for apps in subdirectories
- [x] ConfigManager v3 with migration and backward compatibility

### Monitoring (v8.4–8.7)
- [x] Firebase RTDB connection status
- [x] User stats from Firebase (player counts, activity)
- [x] Beta program management (testers, invites, referrals)
- [x] Integration status checks
- [x] Issue tracker linked to app versions

### Infrastructure (v8.5–8.7)
- [x] Session logging with activity tracking
- [x] Repo file browser
- [x] Orphan file cleanup detection
- [x] gs-active archive management
- [x] GitHub API wrapper (repos, files, pages, tags, contents)

### Project System (v8.7.7–8.8.0)
- [x] Setup New App wizard (4-step: define → check → create → prompt)
- [x] Project-based grouping (replaces category-based)
- [x] 5 default projects with colors and ordering
- [x] Dashboard collapsible project cards with auto-expand on deploy
- [x] Standalone Projects & Apps view
- [x] Project state (active/hidden) with Dashboard filtering
- [x] Timestamp tracking (createdAt/updatedAt) on all apps
- [x] Claude project prompt generation

### Claude Prep — Push Docs & Extras (v8.13.1.x)
- [x] Push Docs to Repo — drop .md/.txt or .zip, push to GitHub via API
- [x] Zip extraction — extracts all .md/.txt from zip packages, deduplicates
- [x] Existing file detection — checks repo SHA for update vs create
- [x] Progress UI — staging → animated pushing → completion/error banners
- [x] Extra docs scanning — Claude Prep scans repo for additional .md files beyond standard set
- [x] Dynamic app detection — configurable patterns from app config scored by specificity
- [x] `window.__CC_APPS` exposure for detection function access

### Unified Package Validation (v8.36.0)
- [x] `getValidationIntent()` — intent detection from selected files (quick-deploy, targeted-update, deploy-package, full-package, docs-only)
- [x] `validatePackage()` — single unified validator replacing 4 separate mechanisms
- [x] Inline validation panel — three-tier severity (grey/amber/red) in deploy controls
- [x] Version bump in CC — code-only deploys get patch bump button + custom version input
- [x] `generateClaudeFixPrompt()` — contextual Claude fix prompt for full packages
- [x] Deploy button state machine — disabled on errors, amber on warnings, override checkbox for force deploy
- [x] Removed: `validateDocPackage()`, extraction-time showAlerts, deploy-time confirms, VersionWarningModal trigger, per-file doc indicators

### App Configuration Improvements (v8.13.0.4–0.8)
- [x] Sub Path field in AppEditModal for subdirectory apps
- [x] Repository Assignment dropdowns — select from real GitHub repos
- [x] Shared vs Available repo grouping with app usage labels
- [x] Preview path display (repo + subPath → target file)
- [x] Manual entry toggle for advanced pattern editing
- [x] Projects promoted to main navigation (5 tabs)
- [x] Emoji picker on App and Project edit modals
- [x] Auto-generated detection patterns from app name (title, kebab, camel, upper)
- [x] Race condition fix for auto-generate (single handleNameChange function)

### Claude Prep — Session Prep per App (v8.13.0)
- [x] `ClaudePrepModal` — fetch source + docs from repo, generate session brief, bundle zip
- [x] 🤖 button on each app row in ProjectsTab
- [x] Doc detection: standalone repos (root) vs consolidated repos ({subPath}/docs/)
- [x] Bootstrap missing docs: generate skeleton CONTEXT.md, PROJECT_PLAN.md, CHANGELOG.md, RELEASE_NOTES.txt
- [x] Auto-generated SESSION_BRIEF.md with versions, recent deploys, open issues, app config
- [x] JSZip integration for in-browser zip creation and download
- [x] Progress modal with log, file manifest, and download button

### Projects as Stored Data (v8.12.0)
- [x] `config.projects` in ConfigManager — projects stored alongside apps in `cc_config_v3`
- [x] Migration from `DEFAULT_PROJECTS` → `SEED_PROJECTS`, `_standalone` → `other`
- [x] ProjectEditModal — create/edit/delete with name, icon, color picker, description, order
- [x] `getProjectsWithApps()` reads from `config.projects`
- [x] `AppEditModal` and `SetupNewAppView` dropdowns read from stored projects
- [x] ConfigManager CRUD: `addProject()`, `updateProject()`, `removeProject()`, `getProjectAppCount()`
- [x] Project state persisted in config (replaces `cc_projectStates` localStorage)

### Firebase Admin (v8.9.0)
- [x] Service account JSON key storage in localStorage
- [x] JWT signing using Web Crypto API (RS256)
- [x] Google OAuth2 token exchange with 55-minute caching
- [x] Admin API methods: getRules, putRules, listFunctions, getLogs
- [x] FirebaseAdminSettings UI in Settings view
- [x] 3-point connection test (token, rules, functions)

### Firebase Rules Manager — Phase 2 (v8.10.0)
- [x] FirebaseView refactored to tabbed layout (Data Browser + Rules)
- [x] FirebaseDataBrowser extracted from original FirebaseView
- [x] Fetch & display rules — calls `firebaseAdmin.getRules()`, renders as formatted JSON
- [x] Inline editor with Tab support, real-time JSON validation, Format button
- [x] Validate before deploy — checks JSON syntax and requires top-level `rules` key
- [x] Deploy rules — calls `firebaseAdmin.putRules()` with confirmation dialog
- [x] Rules history — auto-snapshot before each deploy to localStorage (`cc_rulesHistory`, 20 max)
- [x] Manual snapshot button for saving current state
- [x] Snapshot viewer with raw JSON and line-by-line diff against current rules
- [x] Rollback — restore any snapshot to editor, then deploy

### Orchestrator Phase 0: Foundation (v8.20.0–8.21.1)
- [x] WorkItemService — Firebase CRUD for backlog work items
- [x] SessionService — Claude session tracking
- [x] TokenRegistryService — Heuristic token estimation
- [x] EngineRegistryService — AI engine profiles, session type recommendations
- [x] App lifecycle metadata on schema
- [x] AI Engines settings UI (comparison table, default selector)
- [x] Token estimation + context budget bar in Claude Prep

### Orchestrator Phase 1.1: Backlog View (v8.22.0)
- [x] BacklogView — top-level nav, work item list with grouping/filtering/search/sort
- [x] WorkItemEditModal — full CRUD with all fields, acceptance criteria, tags, context
- [x] Status transitions — idea → ready → in-progress → done → deferred with quick buttons
- [x] Bulk operations — multi-select + bulk status update
- [x] Dashboard integration — work item badges on app cards, backlog summary widget
- [x] WorkItemService.createBatch() — bulk create for scoping flow
- [x] WorkItemService.delete() — individual item deletion
- [x] Copy for Claude — formatted context generation per work item
- [x] source field — manual | scoped | imported | promoted

### Orchestrator Phase 2.2: Claude Session Wizard (v8.26.0)
- [x] 4-step wizard flow: Work Items → Session Type → Context Budget → Generate+Download
- [x] Visual step indicator with clickable completed steps
- [x] Context budget preview — pre-build file inclusion strategy by session type
- [x] Work item auto-transition to in-progress on package generation
- [x] Session record creation via SessionService
- [x] Session-type-aware file filtering (skip/include per context strategy)
- [x] Quick skip path for fast builds

### Orchestrator Phase 2.3: Session Tracking + Deploy Close-the-Loop (v8.27.0)
- [x] Deploy triggers work item completion dialog for in-progress items
- [x] Session → deploy linking with status transition (prep → completed)
- [x] Deploy records enriched with sessionId, sessionType, workItemsCompleted
- [x] Session History panel with stats, filters, expandable cards
- [x] globalSessions state with SessionService.listen()

### Phase 3.1: Integrated Setup Flow (v8.28.0)
- [x] Setup wizard Step 5 renamed to "Review & Launch"
- [x] Scoping pre-populates lifecycle metadata on app config (maturity, complexity, scope)
- [x] Auto-create work items from scope via WorkItemService.createBatch()
- [x] Review & Launch step with summary grid, work items table, Claude instructions
- [x] Quick setup option preserved (skip scope)

### Orchestrator Phase 4.1: Portfolio View + Cost Tracking (v8.30.0)
- [x] PortfolioView — maturity distribution, backlog health, session velocity, deploy frequency
- [x] Cost estimation — per-session cost from package tokens × engine pricing (input + 30% output)
- [x] Cost breakdown table by app with sessions, tokens, cost columns
- [x] Time range filter (7d/30d/90d/All Time) on Portfolio view
- [x] Maturity badges on Dashboard app cards (colored by stage)

### Orchestrator Phase 4.2: Environment Optimization Guide (v8.31.0)
- [x] EnvironmentOptimizationView — per-app Claude Project setup guides
- [x] Doc classification — persistent (Project Knowledge) vs session (upload each time)
- [x] Token savings calculator — per-session and monthly savings estimates
- [x] Project Instructions generator — copy-paste-ready Custom Instructions from app metadata
- [x] Skills recommendations — category-driven with relevance badges
- [x] Platform feature recommendations with status badges
- [x] Session type quick reference table
- [x] 6-step setup checklist per app

### Unified Plan Phase 1: Clean (v8.37.0)
- [x] Removed scoping Step 4 (Standards checkboxes) — auto-assembled silently
- [x] Merged session wizard Step 3 into Step 2 as collapsible "What Claude will see"
- [x] Hidden implementation details (drives text, token bar, file manifest)
- [x] Quick Build bypass for 0 work items
- [x] "Your Name" field in Settings with `createdBy` on records

### Unified Plan Phase 2: Rewrite PM-First Language (v8.38.0)
- [x] All 5 category scoping questions rewritten as PM intent
- [x] Jargon relabeled (V1→Launch, Core→Must have, Environment Optimization→Setup Guide)
- [x] Outcome statements on wizard steps
- [x] Redundant questions removed/merged
- [x] Acceptance criteria coaching

### Unified Plan Phase 3: Close the Loop (v8.39.0–v8.40.0)
- [x] Post-Session Review Flow — 4-step guided inline review (v8.39.0)
- [x] Session-Deploy-WorkItem linking — enriched deploy records (v8.27.0)
- [x] Activity Logging — ActivityLogService audit trail (v8.39.0)
- [x] Work Item Lifecycle Automation — `review` status, Idea→Ready auto-suggest, In-Progress→Review on session review, stale detection badges (v8.40.0)

### Unified Plan Phase 4.1–4.3: Dashboard Polish (v8.41.0)
- [x] Product Health dashboard — Features Shipped, Pipeline count, Session-Ready apps, Cost per Feature metrics
- [x] Smart Quick Actions — Start Session (most-ready app), Add Idea, Review Session, Smart Deploy
- [x] Header Quick Actions realigned — Add Idea, Smart Deploy, Portfolio; Deploy Staged conditional
- [x] Pipeline Health panel — horizontal status bar with active work items list
- [x] Recent Activity feed — chronological events from ActivityLogService in sidebar
- [x] Progressive disclosure — App Pipeline/Issues/Shipped collapsed into `<details>` elements
- [x] Portfolio View — Features Shipped added to top stats row (5 columns)
- [x] Demoted below fold — maturity distribution, session mix, deploy counts per Unified Plan spec

### Unified Plan Phase 4.4–4.5: Release Coordination + Test Checklist (v8.42.0)
- [x] Release Coordination View — per-app readiness assessment with go/no-go summary
- [x] Pipeline visualization — completion %, status bars, blocker detection
- [x] Milestone breakdown — expandable per-milestone progress with stale warnings
- [x] Version tracking — test vs prod comparison with drift detection
- [x] Summary cards — Ready to Ship, Blocked, Overall Completion, Stale Items
- [x] Release Test Checklist — auto-generated from completed work items + acceptance criteria
- [x] Category-driven user journeys — game/tool/dashboard/content/admin standard test paths
- [x] Regression checks — recent session deliverables surfaced as verification items
- [x] Deploy verification section — PWA-aware with service worker checks
- [x] Interactive checklist — progress tracking with completion % and deploy prompt
- [x] Navigation — Releases view added under Backlog dropdown

### Unified Plan Phase 5.1–5.3: Work Streams, Decoupling, Unified Model (v8.43.0)
- [x] WorkStreamService — Firebase CRUD for work streams (name, owner, goal, status, target release, blockedBy)
- [x] StreamInterfaceService — Stream-provided interface contracts (behavior/output/data/naming/timing)
- [x] DependencyService — Cross-stream dependency declarations with status tracking
- [x] WorkStreamsView — Stream board view with cards, completion bars, item summaries, interfaces, dependencies
- [x] StreamEditModal — Create/edit streams with full metadata
- [x] Unified Work Item Model — streamId field on work items for stream assignment
- [x] WorkItemEditModal stream selector — assign items to streams per app
- [x] BacklogView stream grouping — group by stream, stream badges on items
- [x] ClaudePrepModal stream filter — filter Step 1 work items by stream
- [x] SessionBriefGenerator stream context — stream details in generated briefs
- [x] Phase 5.1 decoupling — skills/logos recommendations now project-aware, not hardcoded GS
- [x] Extensible categories — getAllCategories() merges built-in + config.customCategories
- [x] Global state — globalStreams, globalInterfaces, globalDependencies in App component

### Unified Plan Phase 5.4: Dependencies Auto-Remediation & Prompt Chaining (v8.44.0)
- [x] DependencyAlertService — Firebase CRUD for alerts with lifecycle (pending → updated/no_impact)
- [x] triggerAlerts() — Orchestrated flow: changed interface → find dependents → create work items → create alerts → mark deps changed → log activity
- [x] Post-Session Review interface detection — Checklist of provided interfaces with dependents, change description fields, trigger button, results panel
- [x] Prompt chaining in SessionBriefGenerator — dependency_update items inject "Dependency Changes — Context from Source Session" section
- [x] WorkStreamsView pending alerts — Amber badge on stream cards, summary stat, resolve handler
- [x] Dependency status tracking — changed on alert trigger, verified on resolution
- [x] globalDependencyAlerts state with Firebase listener
- [x] Props threading — SessionLogView → PostSessionReviewModal, App → WorkStreamsView

### Unified Plan Phase 5.5: Product Brief Auto-Generation (v8.45.0)
- [x] ProductBriefGenerator — Auto-generates PRODUCT_BRIEF.md from scope, work items, deploys, streams, lifecycle
- [x] Product Identity section — description, category, maturity, audience, goals, version
- [x] Key Product Decisions — scope category answers formatted as PM-language decisions
- [x] Feature Inventory — shipped/in-progress/planned/ideas from work items, fallback to scope features
- [x] Work Streams overview — per-stream progress with owner and status
- [x] PRODUCT_BRIEF.md in Claude Prep packages — auto-generated, included per context strategy
- [x] Context strategies updated — alwaysInclude for design/research, preferInclude for all others
- [x] ProductBriefModal — 📄 button on app rows, rendered markdown viewer with copy
- [x] Environment Optimization — PRODUCT_BRIEF.md in doc listing with token estimate

### Unified Plan Phase 5.6–5.7: Activity Feed Multi-Person View + Multi-Person Access (v8.46.0)
- [x] Activity Feed View — new sub-tab in Session Log with full-page timeline, day grouping, action colors
- [x] Activity filters — by actor, app, action type, stream, combinable with clear
- [x] Activity stats — total events, contributors, deploys, sessions counts
- [x] Team Activity panel — per-actor summary with avatar, deploy/session/item counts (shows with 2+ actors)
- [x] TeamService — Firebase CRUD for team members and membership pointers
- [x] Invite flow — email-based invite, pending status, accept on sign-in
- [x] Role management — owner/editor/viewer with role dropdown and remove
- [x] Team Management UI in Settings — owner view with member list + invite form, member view with role display
- [x] workspaceUid — computed value for shared data access (team members use owner's UID)
- [x] canEdit permission flag — ready for viewer-mode enforcement
- [x] Header indicators — team count badge for owners, role badge for members
- [x] Firebase security rules template — generated per-workspace with copy button
- [x] State management — teamMembers, teamMembership with Firebase listeners and cleanup

### Domain Management (v8.47.0)
- [x] FirebaseAdmin auth domain methods — getAuthConfig, getAuthorizedDomains, updateAuthorizedDomains, addAuthorizedDomain, removeAuthorizedDomain
- [x] AuthorizedDomainsManager component in Settings
- [x] GitHubPagesDomainManager with DNS health checks
- [x] testConnection 4th check for auth config

### SESSION_RETURN.json: Structured Session Handoff (v8.48.1)
- [x] Phase A: All 8 session types include SESSION_RETURN.json in delivery requirements
- [x] Phase A: SessionBriefGenerator embeds full JSON schema with pre-filled sessionType and sessionId
- [x] Phase A: classifyFileAction treats SESSION_RETURN.json as 'skip'
- [x] Phase B: SESSION_RETURN.json detection in ZIP extraction and single-file drop
- [x] Phase B: validateSessionReturn — schema validation with required fields, enum checks
- [x] Phase B: matchSessionReturn — 3-tier confidence matching (session ID → work item overlap → type + recency)
- [x] Phase B: AutoReviewModal — parsed manifest viewer with editable statuses, issue/idea creation toggles, apply handler
- [x] Phase C: Session ID embedding — session record created before brief for ID pre-fill
- [x] Phase C: Auto-Reviewed badge in session history
- [x] Phase C: Return manifest details section in expanded sessions
- [x] Phase C: Pending return banner in Sessions view with Open Auto-Review button
- [x] Phase C: pendingSessionReturn state threaded App → SessionLogView

---

## In Progress — Satellite Architecture Restructure

### Overview

CC is being restructured from a 31,700-line monolith into a focused ~20K-line core with 3 satellite apps. All apps share the same visual design, secrets, and Firebase data.

**Decision framework:** "Does this feature serve the session lifecycle?" → Core. Otherwise → Satellite.

**Repo structure:**
```
command-center/
├── index.html                    ← CC Core (~20K lines)
├── shared/
│   ├── cc-shared.css             ← Theme variables, common styles
│   └── cc-shared.js              ← Secrets reader, Firebase init, common header
├── infrastructure/
│   └── index.html                ← Firebase, GitHub repos, Domains, Integrations
├── quality/
│   └── index.html                ← Issues, Releases, Archive
└── analytics/
    └── index.html                ← Portfolio, Users/Beta, Streams, Product Briefs
```

**Data architecture:**
- localStorage `gs_*` keys: Secrets + config (CC Core writes, all apps read)
- Firebase RTDB: All operational data (any app reads/writes)
- localStorage `cc-{satellite}_*`: Per-satellite UI preferences (private)

---

### Session 1: Foundation — Shared Theme + Secrets Migration
**Status:** ✅ Complete (v8.49.0)

- [x] **`shared/cc-shared.css`** — Extract CC design tokens into standalone CSS
  - [x] Color variables (dark theme palette)
  - [x] Typography (font stack, sizes)
  - [x] Common component styles (cards, buttons, modals, tables, badges, toasts)
  - [x] Header bar component style
  - [x] Responsive breakpoints
- [x] **`shared/cc-shared.js`** — Shared utilities module
  - [x] `CC` secrets reader object (getGitHubToken, getFirebaseSA, getConfig, getFirebaseUid, getCoreUrl)
  - [x] Firebase initialization helper
  - [x] Common header React component (CC logo, satellite name, home link)
  - [x] Missing-credentials fallback component
- [x] **Secrets migration in CC Core**
  - [x] Settings writes to both old (`cc_*`) and new (`gs_*`) keys
  - [x] Bootstrap: existing cc_* values auto-populate gs_* on first load
  - [x] `gs_config` written alongside `commandCenterConfig`
  - [x] `gs_firebase_uid` written on auth
  - [x] gs_* keys added to StorageManager.PROTECTED_KEYS
- [x] **Satellite launcher in CC Core nav**
  - [x] 🛰️ dropdown in nav header with three satellite entries
  - [x] "Coming Soon" badges for undeployed satellites
  - [x] Opens in new tab when ready

---

### Session 2: Infrastructure Satellite — Build
**Status:** ✅ Complete (v1.0.0, CC Core v8.49.1)

- [x] **`infrastructure/index.html`** — Complete standalone app (~7,000 lines)
  - [x] Shared CSS + JS loaded from `../shared/`
  - [x] Common header with "Infrastructure" title and CC home link
  - [x] **Tab 1: Firebase** — Data Browser, Rules Manager, Functions Dashboard, Log Viewer
  - [x] **Tab 2: GitHub** — Repo File Browser, Cleanup/Orphan Detection, Repo Reset Panel
  - [x] **Tab 3: Domains** — Porkbun, GoDaddy, GitHub Pages, Firebase Auth Domains
  - [x] **Tab 4: Integrations** — Integration status checks
  - [x] Missing-credentials fallback if secrets not found
- [x] **Register as CC-managed app** — `cc-infrastructure` with `subPath: 'infrastructure'`
- [x] **Coexistence** — CC Core views NOT removed, both versions run in parallel
- [x] **Satellite launcher** — Infrastructure entry activated (ready: true)

---

### Session 3: CC Core Trim — Remove Infrastructure Code
**Status:** ✅ Complete (v8.50.0)

**Result: Core from 31,774 → 25,752 lines (−6,022 lines, −19%)**

- [x] **Remove Infrastructure views from CC Core**
  - [x] FirebaseView, FirebaseDataBrowser, FirebaseRulesManager
  - [x] FirebaseFunctionsDashboard, FirebaseLogViewer
  - [x] RepoFilesView, CleanupView, RepoResetPanel, ConfirmDeleteModal
  - [x] PorkbunService, GoDaddyService, DomainProviderRegistry, DomainRegistrarSettings
  - [x] DomainsView, AuthorizedDomainsManager, GitHubPagesDomainManager
  - [x] IntegrationsView
  - [x] All related nav entries, state variables, prop threading removed
  - [x] FirebaseAdmin class trimmed (kept: SA management, token, testConnection; removed: getRules, putRules, listFunctions, getLogs, auth domain methods)
  - [x] FirebaseAdminSettings kept in Settings (testConnection simplified to token-only check, links to satellite for full tests)
- [x] **Trim GitHubAPI class** — Removed infrastructure-only methods
  - [x] Removed: getRepoFiles, deleteRepo, updatePagesConfig, checkPagesHealth, getPagesDeploymentStatus, triggerPagesBuild, waitForPagesDeployment
  - [x] Kept: all deploy, file read/write, repo management, workflow methods
- [x] **Update navigation** — Removed firebase, integrations, domains, cleanup, files from nav sections
- [x] **Settings updated** — Domain sections replaced with Infrastructure satellite link
- [x] **Health check alert** — Repo health warning now links to satellite instead of removed cleanup view

---

### Session 4: Quality Satellite — Build + Extract
**Status:** ✅ Complete (v1.0.0, CC Core v8.51.0)

**Result: Core from 25,752 → 23,143 lines (−2,609 lines, −10%)**

- [x] **`quality/index.html`** — Complete standalone app (~3,700 lines)
  - [x] Shared CSS + JS loaded from `../shared/`
  - [x] Common header with "Quality" title and CC home link
  - [x] **Tab 1: Issues** — IssuesView, NewIssueModal, EditIssueModal, IssueService, ReleaseService, UserReportService
  - [x] **Tab 2: Releases** — ReleaseCoordinationView (with test checklists)
  - [x] **Tab 3: Archive** — ArchiveView (gs-active upload/download/briefing)
  - [x] GitHubAPI subset with repoExists + createRepo restored (missing from Core trim)
  - [x] WorkItemService subset (create, isStale) for issue→work-item promotion
  - [x] Promise-based dialog system matching CC Core pattern
  - [x] Firebase listeners for issues, work items, sessions
  - [x] setView stub links back to CC Core for cross-app navigation
  - [x] Missing-credentials fallback if secrets not found
- [x] **Remove from CC Core** — IssuesView, NewIssueModal, EditIssueModal, ReleaseCoordinationView, ArchiveView, ReleaseService, UserReportService removed
- [x] **Minimal IssueService retained in Core** — listen + update + linkToVersion (needed for globalIssues display and deploy flow)
- [x] **Navigation updated** — issues, releases, archive removed from nav dropdowns
- [x] **Register as CC-managed app** — `cc-quality` with `subPath: 'quality'`
- [x] **Satellite launcher** — Quality entry activated (ready: true)

---

### Session 5: Analytics Satellite — Build + Extract
**Status:** ✅ Complete (v8.52.0)

- [x] **`analytics/index.html`** — Standalone app (4,034 lines)
  - [x] **Tab 1: Portfolio** — PortfolioView
  - [x] **Tab 2: Setup Guide** — EnvironmentOptimizationView
  - [x] **Tab 3: Users** — UsersView
  - [x] **Tab 4: Beta Program** — BetaAnalyticsView
  - [x] **Tab 5: Streams** — WorkStreamsView, StreamEditModal, all Stream/Dependency services
  - [x] **Tab 6: Product Briefs** — ProductBriefGenerator, ProductBriefModal
  - [x] **Tab 7: Activity Feed** — Extracted from SessionLogView
  - [x] TeamService, ActivityLogService (full copies)
- [x] **Remove from CC Core** — 2,858 lines removed (23,143 → 20,285)
- [x] **Register as CC-managed app** — cc-analytics in DEFAULT_APP_DEFINITIONS
- [x] **Satellite launcher activated** — ready: true
- [x] **Core service stubs** — WorkStreamService, StreamInterfaceService, DependencyService trimmed

---

### Session 6: Dashboard Workflow — Launch & Land
**Status:** ✅ Complete (v8.53.0)

- [x] **Phase A: Dashboard Cleanup** — App cards are the hero
  - [x] Removed right column (Product Health, Quick Actions, Pipeline, Activity Feed)
  - [x] Slim drop zone (one line, expands on drag-over)
  - [x] App cards as responsive grid with version badges, session buttons
  - [x] Pipeline summary bar (collapsed) at bottom
  - [x] Quick actions bar simplified
- [x] **Phase B: Session Launch Modal** — 🤖 icon on app cards
  - [x] Fast path: top 3 ready items, auto-suggested type, one-click generate
  - [x] Expandable: full item picker, type selector, recent sessions
  - [x] Creates session record + transitions items + downloads package + copies prompt
- [x] **Phase C: Smart Deploy Return** — Post-deploy summary panel
  - [x] Inline panel after successful deploys with session match, SESSION_RETURN results
  - [x] Action buttons: View Site, Promote, Review Session
- [x] **Phase D: Nav Consolidation** — 5 → 4 sections
  - [x] Deploy (Dashboard, History), Plan (Backlog, Projects), Sessions, Settings

---

### Session 7: Polish + Documentation
**Status:** ✅ Complete (v8.54.0) — PROJECT COMPLETE

- [x] **Cross-app navigation polish** — Verified all 3 satellites use SatelliteHeader with back link
- [x] **Documentation updates** — CHANGELOG.md, PROJECT_PLAN.md, RELEASE_NOTES.txt updated
- [x] **New: SATELLITE_ARCHITECTURE.md** — Full guide: building satellites, conventions, credential sharing
- [x] **Shared module documentation** — Enhanced headers in cc-shared.css and cc-shared.js (v1.1.0)
- [x] **Final line count audit** — Core: 20,307 (~300 over 20K due to SessionLaunchModal), all satellites ≤7K, shared ≤500
- [x] **Dead code cleanup** — Removed empty view stubs, service stubs, compressed blank lines (-47 lines)

---

### Progress Tracker

| Session | Focus | Core Lines | Status |
|---------|-------|-----------|--------|
| 1 | Shared foundation + secrets | ~31,760 | ✅ Complete (v8.49.0) |
| 2 | Infrastructure satellite built | ~31,780 | ✅ Complete (v8.49.1) |
| 3 | Infrastructure removed from core | ~25,750 | ✅ Complete (v8.50.0) |
| 4 | Quality satellite built + extracted | ~23,150 | ✅ Complete (v8.51.0) |
| 5 | Analytics satellite built + extracted | ~20,285 | ✅ Complete (v8.52.0) |
| 6 | Dashboard Workflow — Launch & Land | ~20,350 | ✅ Complete (v8.53.0) |
| 7 | Polish + Documentation | ~20,307 | ✅ Complete (v8.54.0) |

**🎉 PROJECT COMPLETE** — Satellite Architecture Restructure finished.
| 6 | Session Launch Modal + nav cleanup | ~17,500 | ⬜ Not Started |
| 7 | Polish + documentation | ~17,500 | ⬜ Not Started |

---

## Deferred / Future Features

### Deferred from Previous Plan
- [ ] Push Docs: Preserve folder structure, consolidated repo push, batch commit
- [ ] Consolidate App Creation into Projects View
- [ ] Firebase-per-App metadata paths
- [ ] Firebase multi-project support
- [ ] Doc migration (LabelKeeper, Quotle.info)
- [ ] Config export/import
- [ ] Deployment diff
- [ ] Automated version bump
- [ ] Command Center self-update
- [ ] Webhook integration
- [ ] Performance dashboard

---

## Architecture Decisions

### Why Single HTML File?
Command Center deploys the same way as the apps it manages — a single index.html pushed to a GitHub Pages repo. This dogfoods the deployment pipeline and keeps things simple.

### Why React via CDN?
No build step means the file works from file:// for local development and from GitHub Pages for production. CDN React is cached after first load.

### Why LocalStorage for Config?
Config is per-machine by design. Different operators might have different GitHub tokens and preferences. The ConfigManager handles migration across versions.

### Why Projects Instead of Categories?
Categories (public/internal/other) were flat and didn't scale. Projects provide hierarchical organization that maps to real work.

### Why Service Account for Firebase Admin? (v8.9.0)
Firebase admin APIs (rules, functions, logging) require Google OAuth2 with service account scope — Firebase user auth alone can't access these management endpoints. The JWT→OAuth2 flow runs entirely in-browser using Web Crypto API, with no server-side dependency. The service account key is stored in localStorage alongside other credentials (GitHub PAT). This is acceptable for an internal tool with a small security surface.

---

## File Structure — Project Package

```
cc-project-vX.X.X.zip
└── command-center/
    ├── index.html              ← The application (~1.8MB single-file)
    ├── CONTEXT.md              ← READ FIRST — current version, schemas, nav, recent changes
    ├── CHANGELOG.md            ← Structured version history (Added/Changed/Removed)
    ├── PROJECT_PLAN.md         ← This file — roadmap, completed features, decisions
    ├── ARCHITECTURE.md         ← Component map, data flow, code locations
    └── RELEASE_NOTES.txt       ← Human-readable release notes per version
```

**All 5 docs must be updated when producing a project package.** See CONTEXT.md § Project Package Convention for the full session workflow.
