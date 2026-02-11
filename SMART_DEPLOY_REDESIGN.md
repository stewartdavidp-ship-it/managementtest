# Smart Deploy Redesign — Dynamic Zip Resolution

## Problem

Smart Deploy currently only works with `gs-active` archives using a hardcoded folder→app map. It can't handle:
- CC deploy packages (core + satellites + shared)
- Arbitrary zip files with mixed app content
- Non-app files like shared CSS/JS

## Design Goal

**Any zip dropped into CC should automatically resolve every file to its correct app and deploy target** using the existing app configuration — no hardcoded maps.

## App Config Structure (What We Know)

Every app in `config.apps` has these fields relevant to deploy:

```javascript
{
  id: 'gameshelf',           // Unique app ID
  name: 'Game Shelf',        // Display name
  project: 'gameshelf',      // Project grouping
  appType: 'public',         // 'public' (test→prod) or 'internal' (prod only)
  
  // Deploy targets
  targetPath: 'index.html',  // Primary file in repo
  subPath: 'app',            // Subdirectory within repo ('' = root)
  hasServiceWorker: true,    // Whether to expect sw.js
  swPath: 'sw.js',           // Service worker filename
  
  // Repos (filled at runtime via auto-mapping or manual config)
  testRepo: 'owner/repo-test',
  prodRepo: 'owner/repo-prod',
  
  // Detection
  detectionPatterns: ['gameshelfdata', 'game.shelf.pwa'],  // Regex patterns to match content
  
  // Repo auto-mapping patterns
  repoPatterns: {
    test: ['gameshelftest'],
    prod: ['gameshelf']
  }
}
```

**Key relationships:**
- `subPath` = where this app lives within its repo (e.g., `infrastructure` → repo/infrastructure/)
- `project` = groups apps that may share the same repo
- Apps in the same project with different `subPath` values share one repo
- `appType: 'internal'` = prod-only deploy, `'public'` = test→prod workflow

## Zip Resolution Algorithm

### Phase 1: Inventory

Extract the zip and build a file inventory:

```
Files found:
  command-center/index.html
  command-center/shared/cc-shared.css
  command-center/shared/cc-shared.js
  command-center/infrastructure/index.html
  command-center/quality/index.html
  command-center/analytics/index.html
  command-center/CHANGELOG.md
```

Strip any single root folder wrapper (common in zip downloads):
```
  index.html
  shared/cc-shared.css
  shared/cc-shared.js
  infrastructure/index.html
  quality/index.html
  analytics/index.html
  CHANGELOG.md
```

### Phase 2: Build Resolution Index from App Config

Build a reverse lookup from **repo paths → app ID** using all configured apps:

```javascript
// For each app, compute its "repo footprint" — the path(s) it owns in its repo
const repoIndex = {};
for (const app of Object.values(apps)) {
  const repo = app.prodRepo || app.testRepo;
  if (!repo) continue;
  
  // Primary file path
  const primaryPath = app.subPath 
    ? `${app.subPath}/${app.targetPath}` 
    : app.targetPath;
  
  // Register: this path in this repo belongs to this app
  if (!repoIndex[repo]) repoIndex[repo] = [];
  repoIndex[repo].push({
    appId: app.id,
    subPath: app.subPath || '',
    targetPath: app.targetPath,
    primaryPath,
    hasServiceWorker: app.hasServiceWorker,
    swPath: app.swPath
  });
}
```

This gives us:
```
repoIndex['owner/command-center'] = [
  { appId: 'command-center',      subPath: '',               primaryPath: 'index.html' },
  { appId: 'cc-infrastructure',   subPath: 'infrastructure', primaryPath: 'infrastructure/index.html' },
  { appId: 'cc-quality',          subPath: 'quality',        primaryPath: 'quality/index.html' },
  { appId: 'cc-analytics',        subPath: 'analytics',      primaryPath: 'analytics/index.html' }
]

repoIndex['owner/gameshelf'] = [
  { appId: 'gameshelf',  subPath: 'app',     primaryPath: 'app/index.html' },
  { appId: 'beta',       subPath: 'beta',    primaryPath: 'beta/index.html' },
  { appId: 'landing',    subPath: '',         primaryPath: 'index.html' },
  { appId: 'terms',      subPath: 'terms',   primaryPath: 'terms/index.html' },
  { appId: 'privacy',    subPath: 'privacy', primaryPath: 'privacy/index.html' }
]
```

### Phase 3: Match Files to Apps

For each file in the zip, try to match it to an app:

**Strategy 1: Path-based matching (fastest, most reliable)**

If a zip file's relative path matches an app's `subPath` prefix, it belongs to that app:

```
infrastructure/index.html → matches subPath 'infrastructure' → cc-infrastructure
quality/index.html        → matches subPath 'quality'        → cc-quality
analytics/index.html      → matches subPath 'analytics'      → cc-analytics
index.html                → matches subPath '' (root)         → command-center
shared/cc-shared.css      → matches subPath 'shared'         → (no app match - see below)
```

Algorithm:
```javascript
function matchFileToApp(filePath, apps) {
  // Split file path into directory and filename
  const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
  
  // Find the app whose subPath matches this file's directory
  // Sort by subPath length descending so deeper matches win
  const candidates = Object.values(apps)
    .filter(app => app.prodRepo || app.testRepo)
    .filter(app => {
      const sub = app.subPath || '';
      if (sub === '') return dir === '';  // Root app matches files with no directory
      return dir === sub || dir.startsWith(sub + '/');
    })
    .sort((a, b) => (b.subPath || '').length - (a.subPath || '').length);
  
  return candidates[0] || null;
}
```

**Strategy 2: Content-based detection (fallback)**

If path matching fails (e.g., the zip doesn't have the expected folder structure), fall back to `detectAppFromContent()` on HTML files. This uses the `detectionPatterns` from app config.

**Strategy 3: Project-scoped grouping**

If a file doesn't match any app by path or content, but it's in a directory that belongs to an app's project (i.e., it's a shared file like `shared/cc-shared.css`), it should be deployed to the same repo at its relative path. We find the "parent" by looking at which apps share that repo.

### Phase 4: Group by Repo + Target

After matching, group all files by their target repo:

```
owner/command-center (PROD):
  ├── index.html                    ← command-center app
  ├── infrastructure/index.html     ← cc-infrastructure app  
  ├── quality/index.html            ← cc-quality app
  ├── analytics/index.html          ← cc-analytics app
  ├── shared/cc-shared.css          ← shared (grouped with repo)
  ├── shared/cc-shared.js           ← shared (grouped with repo)
  └── CHANGELOG.md                  ← doc (grouped with repo)
```

Since all these go to the same repo, they can be deployed in a **single batchCommit** — one commit, all files.

### Phase 5: Version Comparison

For each app found in the zip, fetch the currently deployed version:
- Use `getFileContent(repo, primaryPath)` → `extractVersionFromHTML()`
- Compare archive version vs deployed version
- Auto-select apps that need updates
- Show version comparison table

### Phase 6: Deploy

Group by repo. For each repo, collect all files from all matched apps, then:
- Single-repo deploy: one `batchCommit` call (fast, atomic)
- Multi-repo deploy: one `batchCommit` per repo (sequential)

The `batchCommit` function uses the Git Data API which auto-creates directories.

## Resolution for Unmatched Files

Files that don't match any app need handling:

| File type | Resolution |
|-----------|-----------|
| `.html` in a known subPath dir | Match to app by subPath |
| `.html` with no dir match | Run `detectAppFromContent()` |
| `.js`, `.css` in a subPath dir | Group with the subPath app |
| Files in `shared/` or similar | Find which repo they belong to by checking sibling apps |
| `.md`, `.txt` (docs) | Group with detected/parent app, deploy as docs |
| Unresolvable files | Show in "Unmatched" section, let user assign manually |

## UI Flow

1. **Drop any zip** onto Dashboard (or click upload)
2. **Automatic analysis** — CC scans zip, matches files to apps using path+content detection
3. **Resolution table** appears (replaces current SmartDeploy view):

```
┌─────────────────────────────────────────────────────────┐
│ 📦 Package Analysis: cc_deploy_v8.54.0.zip              │
│                                                          │
│ Repo: owner/command-center (4 apps, 7 files)            │
│ ┌──────────────────┬─────────┬──────────┬────────┐      │
│ │ App              │ Archive │ Deployed │ Status │      │
│ ├──────────────────┼─────────┼──────────┼────────┤      │
│ │ ☑ Command Center │ 8.54.0  │ 8.48.1   │ UPDATE │      │
│ │ ☑ Infrastructure │ 1.0.0   │ —        │ NEW    │      │
│ │ ☑ Quality        │ 1.0.0   │ —        │ NEW    │      │
│ │ ☑ Analytics      │ 1.0.0   │ —        │ NEW    │      │
│ └──────────────────┴─────────┴──────────┴────────┘      │
│                                                          │
│ + 3 shared files (shared/cc-shared.css, ...)            │
│                                                          │
│ [Deploy 4 apps → PROD]                                  │
└─────────────────────────────────────────────────────────┘
```

4. **One-click deploy** — batchCommit all files to the repo in a single commit
5. **Post-deploy** — version refresh, GitHub Pages check, summary

## Implementation Plan

### Step 1: New function `resolveZipContents(zip, apps)`
Returns: `{ repos: { [repoName]: { apps: [...], sharedFiles: [...] } }, unmatched: [...] }`

### Step 2: Replace `GS_ACTIVE_FOLDER_MAP` in SmartDeployView
Use `resolveZipContents()` instead of hardcoded map.

### Step 3: Update deploy execution
Group by repo, use `batchCommit` per repo.

### Step 4: Integrate with Dashboard drop zone
When a zip is dropped, auto-detect whether it's a multi-app package and route to Smart Deploy.

## What Stays the Same
- `detectAppFromContent()` — content detection engine
- `handleBatchDeploy()` / `batchCommit()` — deploy mechanics  
- `getRepoFilePath()` — subPath resolution
- Version extraction and comparison
- App config structure (no changes needed)

---

## Validation Rules Analysis

### Current Validation Model

The current `validatePackage()` is designed for **single-app deploys**. It receives:
- `selectedFiles` — files the user checked
- `stagedFiles` — all staged files (for PWA completeness checks)
- `appConfig` — the ONE app being deployed to
- `deployedVersion` — the currently live version of that ONE app

It validates:

| Rule ID | Severity | What it checks |
|---------|----------|----------------|
| `version-not-incremented` | error/warning | Deploy version ≤ deployed version (downgrade = error, same = warning) |
| `version-mismatch` | error | index.html version ≠ sw.js CACHE_VERSION |
| `pwa-missing-*` | error/warning | PWA app missing sw.js, manifest.json, or icons/ |
| `docs-missing-*` | warning | Full package missing CONTEXT.md, CHANGELOG.md, etc. |
| `docs-context-version` | warning | CONTEXT.md version doesn't match deploy version |
| `docs-changelog-version` | warning | CHANGELOG.md latest entry doesn't match deploy version |
| `docs-releasenotes-version` | warning | RELEASE_NOTES.txt doesn't match deploy version |
| `docs-not-included` | info | Deploy-only package, docs will be out of sync |

Supporting functions:
- `classifyFileAction(fileName)` — categorizes files as `'deploy'`, `'push-doc'`, or `'skip'`
- `getValidationIntent(selectedFiles)` — determines package type: `'none'`, `'docs-only'`, `'quick-deploy'`, `'targeted-update'`, `'deploy-package'`, `'full-package'`

### What Changes in Multi-App Model

In the new model, a single zip may contain **multiple apps going to multiple repos**. Validation must run **per-app**, not per-zip.

#### New Validation Architecture

```
ZIP dropped
  └── resolveZipContents(zip, apps)
        └── For each resolved app:
              ├── Collect its files (deploy + docs)
              ├── Fetch deployed version from repo
              └── Run validatePackage(appFiles, allAppFiles, appConfig, deployedVersion)
                    └── Returns per-app validation result
```

The key insight: **`validatePackage()` doesn't need to change**. It already works on a set of files for a single app. We just need to call it once per resolved app instead of once for the whole zip.

#### Per-App Validation (runs for each app found in zip)

```javascript
// For each app resolved from the zip:
const appValidation = validatePackage(
  appFiles,           // files belonging to this app
  allFilesInZip,      // for PWA completeness checks
  apps[appId],        // this app's config
  deployedVersion     // fetched from repo
);
```

**Rules that work as-is per app:**

| Rule | Multi-app behavior |
|------|-------------------|
| `version-not-incremented` | ✅ Correct — checks each app's version against its own deployed version |
| `version-mismatch` | ✅ Correct — checks index.html vs sw.js within each app's file set |
| `pwa-missing-*` | ✅ Correct — only fires for apps with `hasServiceWorker: true` |
| `docs-*-version` | ✅ Correct — checks doc versions against each app's deploy version |

**Rules that need adjustment:**

| Rule | Issue | Fix |
|------|-------|-----|
| `pwa-missing-*` (completeness) | Currently checks against `stagedFiles` globally — in multi-app, should only check files belonging to THIS app | Pass app-scoped file list as `stagedFiles` param |
| `docs-missing-*` | Currently checks for REQUIRED_DOCS in global staged files — should scope to this app's docs | Same: scope to app's files |
| `docs-not-included` | Fires when intent is `deploy-package` — but in multi-app, docs may be in the zip just not associated with this app | Need to check if docs exist in the zip for this app specifically |
| `getValidationIntent` | Classifies intent based on the global file mix — but each app may have a different intent (one app might be full-package, another quick-deploy) | Run intent classification per app's file set |

#### Shared Files Validation (NEW)

Files that don't belong to any app (e.g., `shared/cc-shared.css`) need a different validation:
- No version check (they're not versioned apps)
- No PWA check
- Just verify they're going to a valid repo path
- Optionally warn if the shared file is new (doesn't exist in repo yet)

#### Cross-App Validation (NEW)

New rules that only apply to multi-app packages:

| Rule | Severity | What it checks |
|------|----------|----------------|
| `cross-app-version-consistency` | warning | Apps in the same project have inconsistent version schemes (e.g., CC core is 8.54.0 but satellites are 1.0.0 — acceptable but worth noting) |
| `multi-app-detection-conflict` | error | Two apps in the zip claim the same subPath or content detection matches the same file to multiple apps |
| `repo-access-check` | error | User doesn't have push access to one of the target repos |
| `unmatched-files` | warning | Files in the zip couldn't be matched to any app |

#### Validation Display in Multi-App UI

```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Package Analysis: cc_deploy_v8.54.0.zip                  │
│                                                              │
│ ┌─ owner/command-center ─────────────────────────────────┐  │
│ │                                                         │  │
│ │  ☑ 🏗️ Command Center    8.48.1 → 8.54.0   ✅ Ready    │  │
│ │  ☑ 🔧 Infrastructure    — → 1.0.0          🆕 New     │  │
│ │  ☑ ✅ Quality            — → 1.0.0          🆕 New     │  │
│ │  ☑ 📊 Analytics          — → 1.0.0          🆕 New     │  │
│ │                                                         │  │
│ │  📎 shared/cc-shared.css, shared/cc-shared.js          │  │
│ │  📝 CHANGELOG.md, RELEASE_NOTES.txt, ...               │  │
│ │                                                         │  │
│ │  ✅ All validations passed                              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Deploy All → PROD]  (single commit, 10 files)             │
└─────────────────────────────────────────────────────────────┘
```

If validation issues exist for an app, they show inline:

```
│  ☑ 🏗️ Command Center    8.48.1 → 8.48.1   ⚠️ Same version │
│     └─ ⚠️ v8.48.1 is already deployed. Bump to v8.48.2?    │
│        [Auto-Bump] [Copy Fix Prompt]                         │
```

#### Validation Timing

| Phase | When | What |
|-------|------|------|
| **Immediate** (on zip drop) | File resolution | Path matching, content detection, file classification |
| **Async** (after resolution) | Version comparison | Fetch deployed versions from GitHub, compare |
| **Pre-deploy** (on button click) | Final validation | Run `validatePackage()` per app, check for blockers |
| **Deploy-time** | Confirmation | Show summary of all apps + issues, require confirmation |

### Integration with Existing Validation Banner

The top-of-page validation banner (v8.54.0) needs to adapt to multi-app:

**Current:** Shows validation for the single selected app + deploy target
**New:** Shows aggregate validation across all resolved apps

```javascript
// Aggregate: worst severity wins
const overallSeverity = appValidations.some(v => v?.severity === 'error') ? 'error'
  : appValidations.some(v => v?.severity === 'warning') ? 'warning'
  : 'info';

// Summary: "4 apps ready" or "2 apps ready, 1 warning, 1 error"
```

### Auto-Fix Actions in Multi-App Context

The existing auto-fix actions (version bump, copy fix prompt) work per-app. In multi-app:

- **Auto-bump**: Bumps version in that specific app's index.html + sw.js within the staged file set
- **Copy Fix Prompt**: Generates prompt scoped to that app's issues
- **NEW: "Fix All"** button: Runs auto-bump on all apps that have the `version-not-incremented` warning

### Summary of Changes to `validatePackage()`

1. **No structural changes** — the function signature and logic stay the same
2. **Call it per-app** — pass only that app's files, not the global set
3. **Add thin wrapper**: `validateMultiAppPackage(resolvedApps, apps)` that:
   - Runs `validatePackage()` per app
   - Adds cross-app validation rules
   - Returns `{ appValidations: { [appId]: result }, crossAppIssues: [], overallSeverity }`
4. **Shared files** get a simplified validation (no version/PWA checks)
