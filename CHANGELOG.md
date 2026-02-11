# Command Center — Changelog

## [8.55.0] — 2026-02-11 — Smart Deploy Validation Complete

### Added
- **Auto-Bump buttons** on `version-not-incremented` issues in Smart Deploy multi-app view
  - Per-app "Auto-Bump to vX.X.X" button patches index.html + sw.js in-memory
  - "Fix All" banner button for bulk version bumps across all flagged apps
- **Shared files validation** — warns when files like `shared/cc-shared.css` are new to the repo
  - Uses `GitHubAPI.fileExists()` to check if shared files exist in target repo
  - Shows warning with path verification prompt, doesn't block deploy
- **Repo access check** — verifies push access to all target repos before deploy
  - Uses `GitHubAPI.checkPushAccess()` via GitHub repo permissions API
  - Shows error-level cross-app issue if push access is missing
- **Cross-app version consistency** — warns when apps in the same project have divergent major versions
  - Groups apps by project, compares major version numbers
  - Informational warning (doesn't block deploy) for version scheme mismatches
- `GitHubAPI.checkPushAccess(repo)` — checks user push permissions via repo endpoint
- `GitHubAPI.fileExists(repo, path)` — checks if a file exists in a repo
- `validateMultiAppPackage()` now accepts optional `github` parameter for repo-level checks
- Cross-app validation issues now show fix hints in the banner

### Changed
- Validation banner now shows "Fix All" button when 2+ apps need version bumps
- Cross-app issues in banner now display with severity-appropriate colors (error/warning/info)

## [8.54.0] — 2026-02-11 — Session 7: Polish + Documentation

### Added
- **SATELLITE_ARCHITECTURE.md** — Comprehensive guide for the satellite app system
  - Architecture overview, credential sharing, Firebase init, navigation patterns
  - Step-by-step guide for building new satellites with HTML skeleton
  - Conventions: file size targets, naming, styling, what stays in core vs satellites
  - Current satellite inventory and project history
- Enhanced documentation in `cc-shared.css` (section index, usage notes)
- Enhanced documentation in `cc-shared.js` (API reference, design decisions)

### Changed
- Core trimmed from 20,354 → 20,307 lines via dead code cleanup
  - Removed empty view stubs (Repo Files, Environment Optimization, Users, Beta Analytics)
  - Removed empty service stubs (PorkbunService, GoDaddyService, DomainProviderRegistry)
  - Removed empty ProductBriefModal comment block
  - Compressed consecutive blank lines

### Line Count Audit (Final)
| Component | Lines | Target | Status |
|-----------|-------|--------|--------|
| Core | 20,307 | ≤ 20,000 | ~300 over (SessionLaunchModal) |
| Infrastructure | 7,014 | ≤ 7,000 | ≈ target |
| Quality | 3,729 | ≤ 5,000 | ✅ |
| Analytics | 4,034 | ≤ 5,000 | ✅ |
| Shared CSS | 404 | ≤ 500 | ✅ |
| Shared JS | 341 | ≤ 500 | ✅ |

## [8.53.0] — 2026-02-11 — Session 6: Dashboard Workflow — Launch & Land

### Added
- **Session Launch Modal** — 🤖 icon on app cards opens lightweight session launcher
  - Fast path: top 3 ready work items pre-checked, auto-suggested session type, one-click Generate Prompt
  - Expandable section: full work item picker, session type selector, recent session history
  - Creates session record, transitions items to in-progress, downloads prep package, copies prompt to clipboard
  - Activity logging via ActivityLogService
- **Post-Deploy Summary Panel** — Inline results panel after successful deploys
  - Shows session match, SESSION_RETURN.json results (auto-applied), version info
  - Action buttons: View Site, Promote to Prod, Review Session
  - Replaces need to navigate to Session Log for common post-deploy actions
- **Pipeline Summary Bar** — Collapsible one-line summary below app cards
  - Shows: ready count, in-progress count, shipped this month, stale items
  - Expands to show pipeline progress bar and detailed breakdown

### Changed
- **Dashboard layout completely restructured** — App cards are now the hero
  - Removed 3-column grid → single column layout
  - Slim drop zone (one line, expands on drag-over) replaces bulky upload section
  - App cards displayed as responsive grid with version badges, ready item counts, session indicators
  - 🤖 Session and ⬆ Promote buttons directly on app cards
- **Navigation consolidated from 5 sections to 4:**
  - 🚀 Deploy → Dashboard, History
  - 📋 Plan → Backlog, Projects
  - 📝 Sessions → Session Log
  - ⚙️ Settings → Environments, Setup New App, Settings
- **Quick Actions Bar simplified:** removed Smart Deploy, Sync TEST→PROD, Portfolio buttons
- Smart Deploy view kept but removed from nav (still accessible, handles gs-active archives)

### Removed
- Product Health summary card (4 stat cards) from Dashboard right column
- Quick Actions sidebar (Start Session, Add Idea, Review Session, Smart Deploy)
- Pipeline Health card from Dashboard right column
- Recent Activity sidebar from Dashboard right column
- App Pipeline collapsed details section from Dashboard right column
- Issues/Recently Shipped demoted sections from Dashboard right column
- Smart Deploy from Deploy nav dropdown
- Portfolio button from quick actions bar
- Sync TEST→PROD from quick actions bar

## [8.52.0] — 2026-02-11 — Satellite Architecture Session 5: Analytics Satellite

### Added
- **Analytics Satellite** (`analytics/index.html` v1.0.0) — Standalone 4,034-line app with all analytics and monitoring features
  - Tab 1: Portfolio — Cross-app health dashboard with deployment status, session activity, work item metrics
  - Tab 2: Setup Guide (Environment Optimization) — Best practices and configuration recommendations
  - Tab 3: Users — User management and activity tracking
  - Tab 4: Beta Program — Beta analytics and feedback tracking
  - Tab 5: Streams — Work stream management with stream edit modal, interface tracking, dependency management
  - Tab 6: Product Briefs — Per-app product brief generation and viewing
  - Tab 7: Activity Feed — Filterable activity log with per-actor stats, day grouping, team activity panel
  - Full service copies: WorkStreamService, StreamInterfaceService, DependencyService, DependencyAlertService, TeamService, ActivityLogService
  - Subset services: DeployService (localStorage reader), WorkItemService (CRUD subset), SessionService (listen only)
  - Promise-based dialog system (showAlert/showConfirm/showPrompt)
  - Cross-app navigation stub opens CC Core in new tab
  - Uses cc-shared.css and cc-shared.js from shared/ directory
- **cc-analytics app registration** in CC Core DEFAULT_APP_DEFINITIONS
- **Satellite launcher** — Analytics entry activated (ready: true)

### Changed
- Portfolio quick action on Dashboard now opens Analytics satellite
- Product Brief button in Projects tab now opens Analytics satellite
- Core services trimmed to minimal stubs:
  - WorkStreamService: `.listen()` + `.filterByApp()` only
  - StreamInterfaceService: `.listen()` + `.update()` + `.getByStream()` only
  - DependencyService: `.listen()` + `.update()` only

### Removed
- **Analytics views** — PortfolioView, EnvironmentOptimizationView, UsersView, BetaAnalyticsView, WorkStreamsView, StreamEditModal, ProductBriefModal (2,399 lines)
- **Activity Feed tab** from SessionLogView (188 lines)
- **Nav entries** — Monitor section (portfolio, optimize, users, beta) and streams dropdown removed
- **View routing** — Removed routing blocks for portfolio, optimize, users, beta, streams views
- **viewBriefApp state** — Removed from ProjectsTab (replaced with Analytics satellite link)

### Metrics
- Core: 23,143 → 20,285 lines (-12.3%)
- Cumulative reduction from 31,774: -36.2%
- Analytics satellite: 4,034 lines

## [8.51.0] — 2026-02-11 — Satellite Architecture Session 4: Quality Satellite

### Added
- **Quality Satellite** (`quality/index.html` v1.0.0) — Standalone 3,700-line app with all quality management features
  - Tab 1: Issues — Full issue tracker with create, edit, status management, user reports inbox
  - Tab 2: Releases — Release coordination with completion %, milestones, test checklists, go/no-go summary
  - Tab 3: Archive — gs-active upload/download, session briefing generation, archive management
  - Promise-based dialog system (showAlert/showConfirm/showPrompt) matching CC Core pattern
  - GitHubAPI subset with repoExists + createRepo methods restored
  - Firebase listeners for issues, work items, sessions data
  - setView stub opens CC Core in new tab for cross-app navigation
  - Uses cc-shared.css and cc-shared.js from shared/ directory
- **cc-quality app registration** in CC Core DEFAULT_APP_DEFINITIONS
- **Satellite launcher** — Quality entry activated (ready: true)

### Removed
- **Quality views** — IssuesView, NewIssueModal, EditIssueModal, ReleaseCoordinationView, ArchiveView
- **Quality services** — ReleaseService, UserReportService (full implementations)
- **IssueService trimmed** — Reduced to minimal listen + update + linkToVersion (needed for globalIssues display + deploy flow)
- **Nav entries** — issues, releases, archive removed from Monitor/Backlog/Maintain dropdown menus
- **Nav dropdown labels** — Corresponding 🐛 Issues, 🚢 Releases, 📦 Archive entries removed

### Changed
- **Net reduction:** 25,752 → 23,143 lines (−2,609 lines, −10%)
- **Cumulative reduction from 31,774:** −8,631 lines (−27%)
- Version bumped from 8.50.0 → 8.51.0

---

## [8.50.0] — 2026-02-11 — Satellite Architecture Session 3: Core Trim

### Removed
- **Infrastructure views** — FirebaseView, FirebaseDataBrowser, FirebaseRulesManager, FirebaseFunctionsDashboard, FirebaseLogViewer, RepoFilesView, CleanupView, RepoResetPanel, ConfirmDeleteModal, IntegrationsView, DomainsView, AuthorizedDomainsManager, GitHubPagesDomainManager
- **Infrastructure services** — PorkbunService, GoDaddyService, DomainProviderRegistry, DomainRegistrarSettings
- **FirebaseAdmin API methods** — getRules, putRules, listFunctions, getLogs, getAuthConfig, getAuthorizedDomains, updateAuthorizedDomains, addAuthorizedDomain, removeAuthorizedDomain
- **GitHubAPI methods** — getRepoFiles, deleteRepo, updatePagesConfig, checkPagesHealth, getPagesDeploymentStatus, triggerPagesBuild, waitForPagesDeployment
- **Nav entries** — firebase, integrations, domains, cleanup, files removed from Monitor/Maintain sections
- **State variables** — cleanupInitialTab, repoFiles, selectedRepoForBrowse, selectedAppKeyForBrowse, markedForDeletion, loadRepoFiles, handleDeleteMarkedFiles

### Changed
- **FirebaseAdmin.testConnection()** simplified to token-only check (full tests in satellite)
- **Settings domain sections** replaced with link to Infrastructure satellite
- **Repo health alert** links to Infrastructure satellite instead of removed cleanup view
- **Net reduction:** 31,774 → 25,752 lines (−6,022 lines, −19%)

---

## [8.49.1] — 2026-02-11 — Satellite Architecture Session 2

### Added
- **Infrastructure Satellite** (`infrastructure/index.html` v1.0.0) — Standalone 7,000-line app with all infrastructure management features
  - Tab 1: Firebase — Data Browser, Rules Manager, Functions Dashboard, Log Viewer
  - Tab 2: GitHub — Repo File Browser, Cleanup/Orphan Detection, Repo Reset Panel
  - Tab 3: Domains — Porkbun, GoDaddy, GitHub Pages, Firebase Auth Domains
  - Tab 4: Integrations — Health checks for Firebase, Claude API, Stripe, Goody
  - Missing-credentials fallback using shared MissingCredentials component
  - Uses cc-shared.css and cc-shared.js from shared/ directory
- **cc-infrastructure app registration** in CC Core DEFAULT_APP_DEFINITIONS
- **Satellite launcher** — Infrastructure entry activated (ready: true)

### Changed
- Version bumped from 8.49.0 → 8.49.1

---

## [8.49.0] — 2026-02-11 — Satellite Architecture Session 1

### Added
- **Shared CSS theme** (`shared/cc-shared.css`) — Design tokens, component styles, and utility classes extracted from CC Core
- **Shared JS utilities** (`shared/cc-shared.js`) — CC secrets reader, Firebase init helper, SatelliteHeader and MissingCredentials React components
- **Satellite secrets migration** — Dual-write to both `cc_*` and `gs_*` localStorage keys for cross-app credential sharing
- **Bootstrap migration** — Existing `cc_*` values auto-populate `gs_*` keys on first CC Core load
- **Satellite launcher** — 🛰️ dropdown in nav header linking to Infrastructure, Quality, and Analytics satellites (Coming Soon)
- **StorageManager** — `gs_*` keys added to PROTECTED_KEYS list

### Changed
- Version bumped from 8.48.1 → 8.49.0

---

## [8.48.1] — SESSION_RETURN.json: Structured Session Handoff

(Previous changelog entries omitted — see prior versions)
