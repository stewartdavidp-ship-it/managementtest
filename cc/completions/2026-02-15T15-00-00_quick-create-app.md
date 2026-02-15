---
task: "Quick Create App flow from unassigned idea badge on Dashboard"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "pending"
    message: "Add Quick Create App flow from unassigned idea badge (v8.69.7)"
odrc:
  new_decisions:
    - "QuickCreateAppModal triggered from amber 'unassigned' badge on IdeaWorkCard via modal/setModal pattern"
    - "Deploy structure radio offers prod-only (1 repo) or test-prod (2 repos) matching SetupNewAppView pattern"
    - "Repo creation flow: check exists → create repo(s) → enable Pages → create app config → link idea"
    - "GitHubAPI.repoExists and createRepo methods added as missing infrastructure"
  resolved_opens: []
  new_opens:
    - "Should QuickCreateAppModal also allow selecting an existing app instead of always creating new?"
unexpected_findings:
  - "GitHubAPI class was missing repoExists() and createRepo() methods that were already called by existing createRepoForApp() function — these were dead code paths"
  - "workCardNavigateApp silently did nothing for null appId — no error, no feedback"
unresolved: []
---

## Context

When an idea is created without an app assignment, critical workflows break silently: Push to Repo is a no-op (no error shown), CLAUDE.md generates with "App: Unknown", and Context Package produces partial results. Users need a way to create a new app + GitHub repo and link it to the unassigned idea directly from the Dashboard.

## Implementation

### Phase 1: GitHubAPI Methods (~25 lines)
Added two methods to `GitHubAPI` class that existing code already called but were never defined:
- `repoExists(owner, repoName)` — GET /repos/{owner}/{repoName}, returns true/false
- `createRepo(repoName, description, isPrivate)` — POST /user/repos with auto_init

### Phase 2: workCardNavigateApp Handler
Changed from `if (appId) setView('projects')` to also handle null appId case — opens QuickCreateAppModal via `setModal({ type: 'quick-create-app', data: { idea } })`.

### Phase 3: IdeaWorkCard Badge
Conditional rendering: assigned ideas show indigo app name badge, unassigned ideas show amber pulsing "⚠ unassigned" badge with tooltip "Click to create app and assign".

### Phase 4: QuickCreateAppModal (~150 lines)
Form with: app name (auto-slugifies), description, deploy structure radio (prod-only/test-prod), repo preview. On submit: checks repo existence, creates repo(s), enables Pages, creates app config via ConfigManager.addApp, links idea via IdeaManager.update.

### Phase 5: App-Level Modal Rendering
Added `modal?.type === 'quick-create-app'` case in App component modal rendering, passing github, githubOwner, config, updateConfig, firebaseUid, idea, showAlert.
