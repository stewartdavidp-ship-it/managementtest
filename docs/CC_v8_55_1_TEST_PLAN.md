# CC v8.55.1 Smart Deploy — Interactive Test Plan

## Test Protocol

**Flow-based testing:** Dave runs through the product naturally. All key actions are logged to the browser console with `[SmartDeploy]` prefix. After a flow, Dave copies the full console output and brings it back. Claude maps the log entries to test scenarios, marks them pass/fail, and identifies which scenarios still need targeted testing.

### Console Log Key
```
[SmartDeploy] isMultiApp: true/false          ← Package type detection
[SmartDeploy] App: {id} → {target} | N deploy, N docs | vX.X.X  ← Per app
[SmartDeploy] Shared: N files                 ← Shared files found
[SmartDeploy] Unmatched: [...]                ← Files that didn't match any app
[SmartDeploy] Zip dirs: [...]                 ← Top-level dirs for structure validation
[SmartDeploy] Validation: {severity} — {summary}  ← Validation result
[SmartDeploy]   {severity}: {title}           ← Individual issues
[SmartDeploy] Single-app zip path             ← Non-multi-app zip handling
[SmartDeploy] Single file drop: {name}        ← Non-zip file drop
[SmartDeploy] Cleared staged files            ← Clear action
=== DEPLOY ALL START ===                      ← Deploy execution
[SmartDeploy] Batch: {repoKey} → {repo} ({target}) | N files  ← Deploy batch
[ConfigMigration] Added new app: {id} (project: {p})  ← New app migration
[SmartDeploy] ZIP extraction failed: {error}  ← Error handling
```

## Suggested Test Flows

### Flow A: Multi-App Package (CC Deploy)
1. Hard refresh → drop CC zip → observe panel → Copy Fix Prompt → Clear
**Covers:** T1.1, T2.1, T2.2, T2.3, T4.1, T5.3

### Flow B: Single File Drop
1. Drop single .html → observe staged files
**Covers:** T1.4

### Flow C: gs-active Package
1. Drop gs-active zip → observe validation errors
**Covers:** T1.2 or T1.3

### Flow D: Deploy Execution
1. Drop CC zip → Deploy All → confirm → observe
**Covers:** T3.1

## Test Scenarios

| ID | Scenario | Pass Criteria | Console Evidence |
|----|----------|---------------|-----------------|
| T1.1 | CC Deploy (multi-app) | 4 apps, correct versions, TEST for CC | `isMultiApp: true` + 4 `App:` lines |
| T1.2 | gs-active (correct names) | Apps recognized, app/ path | `isMultiApp: true` + apps matched |
| T1.3 | gs-active (wrong names) | Structure error caught | `Validation: error` + mismatch |
| T1.4 | Single file drop | Old staging path | `Single file drop:` |
| T1.5 | Single app zip | Single-app path | `isMultiApp: false` |
| T2.1 | Version warnings | Warnings shown, not blocking | `Validation: warning` |
| T2.2 | New shared files | cc-shared flagged | `warning: New shared file` |
| T2.3 | Fix prompt | Actionable text | Paste fix prompt text |
| T3.1 | Deploy All | All committed, no errors | `DEPLOY ALL START` + batch logs |
| T3.2 | Deploy blocked | Button disabled | `Validation: error` |
| T4.1 | New app migration | Satellites added | `ConfigMigration` logs |
| T4.2 | Firebase project | firebase-functions → firebase | `ConfigMigration` project change |
| T5.1 | Empty zip | Graceful error | `ZIP extraction failed` |
| T5.2 | Docs-only zip | Handled gracefully | `isMultiApp: false` |
| T5.3 | Clear + re-drop | Clean state | `Cleared` + fresh `isMultiApp` |

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| T1.1 CC Deploy Package | ✅ Pass | 4 apps, TEST for CC, no unmatched |
| T1.2 gs-active (correct) | ⬜ | |
| T1.3 gs-active (wrong names) | ✅ Pass | 5 wrong folders caught, deploy blocked |
| T1.4 Single file drop | ⬜ | |
| T1.5 Single app zip | ⬜ | |
| T2.1 Version warnings | ✅ Pass | warning severity, 4 ready 1 warning |
| T2.2 New shared files | ✅ Pass | Both cc-shared files flagged |
| T2.3 Fix prompt content | ⬜ | |
| T3.1 Deploy All | ⬜ | |
| T3.2 Deploy blocked | ✅ Pass | Error severity, button disabled |
| T4.1 New app migration | ✅ Pass | 24 apps confirmed |
| T4.2 Firebase separation | ⬜ | |
| T5.1 Empty zip | ⬜ | |
| T5.2 Docs-only zip | ⬜ | |
| T5.3 Clear and re-drop | ⬜ | |

**Legend:** ⬜ Not tested | ✅ Pass | ❌ Fail | ⚠️ Pass with issues

## Key Concepts
<!-- cc-concepts scope="testing,smart-deploy" -->
- RULE: Every test scenario must have a matching console log — no log = no test.
- RULE: Console instrumentation added at build time, uses consistent [SmartDeploy] prefix.
- PROCESS: Flow-based testing — user runs naturally, dumps console, Claude maps to scenarios.
- PROCESS: Remaining gaps identified after flow, then targeted individual testing.
<!-- /cc-concepts -->
