# CC v8.55.1 Smart Deploy — Session Transcript
## Date: 2026-02-11

### What Was Built
**Unified Dashboard Deploy** — Multi-app packages resolve and deploy from the Dashboard. No separate Smart Deploy view.

### Architecture Changes
1. **Removed SmartDeployView** (~809 lines) — all deploy flows go through Dashboard
2. **Simplified resolveZipContents** (~300→120 lines) — pure path matching, no content detection
3. **Simplified isMultiAppZip** — synchronous, path-only check
4. **Package format rule**: path in zip = path in repo. One root wrapper allowed.
5. **Config migration**: new seed apps auto-inject into existing stored config
6. **Default target**: test first (was defaulting to prod)

### Config Changes
- `firebase-functions` → moved to own `firebase` project (was `gameshelf`)
- `testplan` → kept `subPath: ''` (has own repo `gameshelf-testplan`)
- `cc-infrastructure`, `cc-quality`, `cc-analytics` → confirmed in seed config with correct subPaths
- New project definition: `firebase` (id: firebase, icon: ⚡)

### Validation Engine Additions (in validateMultiAppPackage)
- **zip-structure-mismatch**: folder matches app ID but wrong subPath (error)
- **zip-structure-unknown**: unrecognized folder (info)
- Copy Fix Prompt button shows for warnings too (was error-only)

### UI Changes
- Multi-app panel: app-level rows with version comparison, status badges, file counts
- Doc files shown in cyan per app (📄 RELEASE_NOTES.txt, CHANGELOG.md, ...)
- Header: "Package 4 apps + 5 docs"
- Deploy button: "Deploy All (4 apps + 5 docs)"
- All-or-nothing deploy (no partial selection)
- Fix prompt → Claude fixes → new package → drop again

### Key Bugs Found & Fixed
1. **Satellite apps missing from runtime config** — stored config never picks up new seed apps. Fixed with migration step.
2. **`command-center/` wrapper in zip** — violated path=repo rule. Fixed by restructuring package format.
3. **`prodRepo || testRepo` filter** — excluded apps without assigned repos. Fixed to include all apps with subPath.
4. **Default target was prod** — changed to test-first.

### Package Format Spec
```
DEPLOY PACKAGE (path = repo path):
  index.html                    ← root app (subPath: '')
  infrastructure/index.html     ← subPath: 'infrastructure'
  quality/index.html            ← subPath: 'quality'
  analytics/index.html          ← subPath: 'analytics'
  shared/cc-shared.css          ← shared files
  CHANGELOG.md                  ← push-doc
  
PROJECT ARCHIVE (gs-active):
  app/index.html                ← Game Shelf (subPath: 'app', NOT 'gameshelf/')
  quotle/index.html             ← subPath: 'quotle'
  slate/index.html              ← subPath: 'slate'
  index.html                    ← Landing Page (root)
```

### What Needs Testing Still
- Actual deploy execution (Deploy All button)
- gs-active package with new folder names
- Promote flow (test → prod)
- Single-file drop still works (non-multi-app)
- Session return handling in multi-app context

### Files
- CC v8.55.1: 20,780 lines (down from 21,267 in v8.55.0)
- Updated gs-active SKILL.md

---

## Key Concepts
<!-- cc-concepts scope="deploy,packaging,smart-deploy,config" -->
- RULE: Path in zip = path in repo. One root wrapper allowed (zip name itself).
- RULE: Pure path matching — no content detection, no folder inheritance. Directory structure matches configured subPaths.
- RULE: Apps without repos inherit repo from project siblings.
- RULE: Root files (no /) match apps with subPath: '' only for the primary project.
- RULE: Unmatched files in primary project become shared files.
- DECISION: Removed SmartDeployView — all deploy flows go through Dashboard.
- DECISION: resolveZipContents is pure path matching (~120 lines, down from ~300).
- DECISION: isMultiAppZip is synchronous — no async content detection.
- DECISION: firebase-functions moved to own 'firebase' project (was 'gameshelf').
- DECISION: New seed apps auto-inject into existing stored config via migration step.
- DECISION: Default deploy target is TEST first (was defaulting to PROD).
- DECISION: Satellites (cc-infrastructure, cc-quality, cc-analytics) share command-center repo.
- CONSTRAINT: Filter apps by subPath !== undefined (not by prodRepo || testRepo).
- CONSTRAINT: Config migration must sync project field from seed when it changes.
- FIX: classifyFileAction uses basename for CLAUDE_PREP_DOCS check (supports docs/ subfolder).
- FIX: Missing docs validation compares basenames (docs/CONTEXT.md satisfies CONTEXT.md requirement).
<!-- /cc-concepts -->
