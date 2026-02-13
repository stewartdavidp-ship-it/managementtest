---
task: "Navigation restructure — flatten nav, rename Deploy to Home, remove dead entries, Environments to satellite, History to panel"
status: complete
cc-spec-id: sp_nav_restructure
files:
  - path: "index.html"
    action: modified
  - path: "cc/tests/app-load.spec.js"
    action: modified
  - path: "cc/tests/bundle-assembly.spec.js"
    action: modified
  - path: "cc/tests/detection-dialog.spec.js"
    action: modified
  - path: "cc/tests/job-history.spec.js"
    action: modified
  - path: "cc/tests/settings.spec.js"
    action: modified
commits:
  - sha: "af8fb30"
    message: "Nav restructure Session A: flat tabs, rename Deploy → Home (v8.63.1)"
  - sha: "675f292"
    message: "Nav restructure Session B: Environments to satellite, History to panel (v8.63.2)"
odrc:
  new_decisions:
    - "Deploy History remains accessible via Quick Actions button on Home, rendered as slide-out panel (not standalone view)"
    - "Backlog and Setup New App components retained in code but removed from nav — can be re-added to satellites later"
    - "Quick Actions '💡 Add Idea' changed to '💡 Ideas' routing to Ideas view instead of Backlog"
    - "Home tab highlights for both dashboard and history views"
    - "Environments nav entry removed — ConfigView retained as dead code for future satellite migration"
    - "Settings flattened from dropdown to single flat tab after Environments removal"
    - "Deploy History converted to slide-out panel with backdrop click-to-close and slideIn animation"
  new_opens: []
  resolved_opens:
    - "N5: Move Environments view to Infrastructure satellite — resolved by removing nav entry, ConfigView retained as dead code"
    - "N6: Convert Deploy History to modal triggered from Home — resolved as slide-out panel (right-side overlay)"
unexpected_findings:
  - "Deploy History view had no setView() links anywhere — was ONLY accessible via Deploy dropdown. Added Quick Actions button to prevent it becoming orphaned."
  - "Infrastructure satellite exists in production repo (stewartdavidp-ship-it/command-center/infrastructure/index.html, ~367KB) but not in test repo"
  - "'Add Idea' Quick Action linked to Backlog view — changed to link to Ideas view instead"
  - "HistoryView is 549 lines (not 2,200 as spec estimated) — slide-out panel wraps existing component without rewrite"
unresolved: []
---

## Approach

Split the spec into two sessions as agreed with user:
- **Session A:** N1 + N2 + N3 + N4 + test updates — surface-level nav wiring
- **Session B:** N5 (Environments → satellite) + N6 (Deploy History → slide-out panel)

## Implementation Notes

**Final nav structure (v8.63.2):**
```
🏠 Home | 📁 Projects | 💡 Ideas | 📦 Jobs (badge) | 📝 Sessions | ⚙️ Settings
```

- All tabs are flat (single click) — no dropdowns remain
- Completion job badge on Jobs tab
- Satellite launcher dropdown unchanged

**Session A (v8.63.1):**
- Renamed Deploy → Home as flat tab
- Flattened Plan dropdown → Projects, Ideas, Jobs as top-level tabs
- Removed Backlog and Setup New App from nav (components retained)
- Moved completion job badge from Plan to Jobs tab
- Added Deploy History button in Quick Actions
- Home tab highlights for both dashboard and history views

**Session B (v8.63.2):**
- Removed Environments from Settings dropdown → Settings became flat tab
- ConfigView route removed (dead code retained for satellite migration)
- Deploy History converted from standalone view route to slide-out panel
- Added `showHistoryPanel` state + `@keyframes slideIn` CSS animation
- Quick Actions button updated from `setView('history')` to `setShowHistoryPanel(true)`
- Panel has sticky header, close button, backdrop click-to-close

**View routing (final):**
- `dashboard` → Home tab
- `history` → removed as standalone route, now slide-out panel via `showHistoryPanel`
- `projects` → Projects tab
- `ideas` → Ideas tab
- `jobHistory` → Jobs tab
- `session` → Sessions tab
- `config` → removed from nav (ConfigView dead code)
- `settings` → Settings tab (flat)
- `backlog` → still works if navigated to programmatically (component in code)
- `setup` → still works if navigated to programmatically (component in code)

**Test changes:**
- app-load.spec.js: Updated nav assertions (Home, Projects, Ideas, Jobs, Sessions, Settings)
- job-history.spec.js: All Plan→Job History navigation replaced with Jobs tab click
- bundle-assembly.spec.js: Same Plan→Job History pattern replaced
- detection-dialog.spec.js: Badge test updated to reference Jobs tab, dropdown test replaced with tab click
- settings.spec.js: Settings navigation updated from dropdown to flat tab click
