---
task: "Navigation restructure Session A — flatten Plan dropdown, rename Deploy to Home, remove dead nav entries"
status: partial
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
commits:
  - sha: "af8fb30"
    message: "Nav restructure Session A: flat tabs, rename Deploy → Home (v8.63.1)"
odrc:
  new_decisions:
    - "Deploy History remains accessible via Quick Actions button on Home — not converted to modal yet (N6 deferred)"
    - "Backlog and Setup New App components retained in code but removed from nav — can be re-added to satellites later"
    - "Quick Actions '💡 Add Idea' changed to '💡 Ideas' routing to Ideas view instead of Backlog"
    - "Home tab highlights for both dashboard and history views"
  new_opens:
    - "N5: Move Environments view to Infrastructure satellite — satellite exists in production repo at /infrastructure/index.html"
    - "N6: Convert Deploy History to modal triggered from Home — currently a 2,200-line standalone view"
  resolved_opens: []
unexpected_findings:
  - "Deploy History view had no setView() links anywhere — was ONLY accessible via Deploy dropdown. Added Quick Actions button to prevent it becoming orphaned."
  - "Infrastructure satellite exists in production repo (stewartdavidp-ship-it/command-center/infrastructure/index.html, ~367KB) but not in test repo"
  - "'Add Idea' Quick Action linked to Backlog view — changed to link to Ideas view instead"
unresolved:
  - "N5: Move Environments view to Infrastructure satellite (deferred to Session B)"
  - "N6: Convert Deploy History to modal off Home (deferred to Session B)"
---

## Approach

Split the spec into two sessions as agreed with user:
- **Session A (this):** N1 + N2 + N3 + N4 + test updates — surface-level nav wiring
- **Session B (deferred):** N5 (Environments → satellite) + N6 (Deploy History → modal)

## Implementation Notes

**New nav structure:**
```
🏠 Home | 📁 Projects | 💡 Ideas | 📦 Jobs (badge) | 📝 Sessions | ⚙️ Settings ▾
```

- Home, Projects, Ideas, Jobs, Sessions are flat tabs (single click)
- Settings remains a dropdown (Environments + Settings sub-items)
- Completion job badge moved from Plan to Jobs tab
- Satellite launcher dropdown unchanged

**View routing preserved:**
- `dashboard` → Home tab
- `history` → Home tab (via Quick Actions button)
- `projects` → Projects tab
- `ideas` → Ideas tab
- `jobHistory` → Jobs tab
- `session` → Sessions tab
- `config` → Settings → Environments
- `settings` → Settings → Settings
- `backlog` → still works if navigated to programmatically (component in code)
- `setup` → still works if navigated to programmatically (component in code)

**Test changes:**
- app-load.spec.js: Updated nav assertions (Home, Projects, Ideas, Jobs, Sessions, Settings)
- job-history.spec.js: All Plan→Job History navigation replaced with Jobs tab click
- bundle-assembly.spec.js: Same Plan→Job History pattern replaced
- detection-dialog.spec.js: Badge test updated to reference Jobs tab, dropdown test replaced with tab click
