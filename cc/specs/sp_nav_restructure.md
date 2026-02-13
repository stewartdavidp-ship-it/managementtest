# CLAUDE.md — Navigation Restructure + View Migration
# cc-spec-id: sp_nav_restructure
# App: Command Center (index.html)
# Base version: (current after sp_legacy_session_removal)
# Target version: +0.1.0
# Depends on: sp_legacy_session_removal

---

## Task Summary

Restructure Command Center's top-level navigation from the current dropdown-heavy layout to a flat tab bar. Move the Environments view to the Infrastructure satellite. Remove dead nav entries left after legacy session removal.

**This is surface-level work — nav wiring, no new features.**

---

## Current Navigation

```
Deploy ▾ | Plan ▾ (Backlog, Projects, Ideas, Job History) | Sessions | Settings ▾ | Satellites ▾
```

## Target Navigation

```
Home | Projects | Ideas | Jobs | Sessions | Settings ▾ | Satellites ▾
```

---

## What to Change

### N1: Rename Deploy → Home
- The Deploy tab is the landing page — app list, drop zone, version status
- Rename the tab label from "Deploy" to "Home"
- Keep all existing Deploy tab functionality (file drop, staging, batch deploy, ODRC detection banner)
- Update any internal references to the view name

### N2: Flatten Plan Dropdown → Top-Level Tabs
- Remove the "Plan" dropdown entirely
- **Ideas** becomes a top-level tab (was Plan → Ideas)
- **Projects** becomes a top-level tab (was Plan → Projects)
- **Jobs** becomes a top-level tab, renamed from "Job History" (was Plan → Job History)
- Route directly: clicking "Ideas" goes to Ideas view, etc.

### N3: Remove Backlog from Navigation
- The Backlog view was Plan → Backlog
- Remove from nav — no longer accessible from top bar
- WorkItemService stays (used by deploy flow) but the Backlog UI is no longer reachable
- If the Backlog view component still exists in code after legacy removal, leave it but remove the nav entry. Can be re-added to Quality satellite later if needed.

### N4: Remove Setup New App
- This was accessible from Settings or Plan
- Remove from nav
- App configuration can be done through Settings if needed in the future

### N5: Move Environments View → Infrastructure Satellite
- The Environments view shows test/prod repo configuration per app
- **Cut** the Environments view component from index.html
- **Move** to the Infrastructure satellite (already exists at the satellite URL)
- The Infrastructure satellite already has: Firebase, GitHub, Domains sections
- Environments fits naturally alongside these
- Ensure the shared service layer (GitHubAPI, Firebase auth) is available in the satellite

### N6: Deploy History → Modal off Home
- The Deploy History view (was Plan → Job History → deploy history, or a separate view) shows past deployments
- If this is a standalone view, convert to a modal/slide-out triggered from the Home screen
- Add a "📋 Deploy History" button near the deploy area on Home
- If Deploy History is the same as Job History, skip this — Job History is already getting a top-level "Jobs" tab (N2)

---

## Navigation Implementation

The current nav uses a `view` state variable. Update the view routing:

```javascript
// Current views (before this change)
// 'dashboard' | 'plan' | 'sessions' | 'settings' | ...

// New views (after this change)  
// 'home' | 'projects' | 'ideas' | 'jobs' | 'sessions' | 'settings'
```

Update the nav bar rendering to show flat tabs:

```jsx
<nav>
  <button onClick={() => setView('home')}>🏠 Home</button>
  <button onClick={() => setView('projects')}>📁 Projects</button>
  <button onClick={() => setView('ideas')}>💡 Ideas</button>
  <button onClick={() => setView('jobs')}>📦 Jobs</button>
  <button onClick={() => setView('sessions')}>📝 Sessions</button>
  {/* Settings and Satellites remain as dropdowns */}
</nav>
```

Keep Settings and Satellites as dropdowns — they have sub-items.

---

## Existing Infrastructure Reference

| Component | What to Change |
|-----------|---------------|
| Top nav bar | Replace Plan dropdown with flat tabs, rename Deploy → Home |
| View routing (`setView`) | Add/rename view IDs, remove 'backlog' route |
| Environments view | Cut from index.html, move to Infrastructure satellite |
| Infrastructure satellite | Receive Environments view |
| Deploy History | Convert to modal or confirm it's the same as Jobs |

---

## Architecture Rules

### State Management Rules
- All shared Firebase-backed data lives as top-level state in App component with `global` prefix
- Views own local UI state only
- Satellites share auth and services via the existing satellite infrastructure pattern

---

## File Structure

```
cc/
  index.html                       ← Nav changes, Environments removal
  cc-infrastructure.html           ← Receives Environments view (or whatever the satellite filename is)
  specs/
    sp_nav_restructure.md          ← This CLAUDE.md archived after completion
```

---

## Post-Task Obligations

RULE: Before reporting this task as complete:

1. **Update Playwright tests** — several tests will break from nav changes. Known impacts:
   - `text=Deploy` selector → update to `text=Home`
   - `text=Sessions` selector → verify still matches (tab stays, content changed)
   - Job History View tests → update navigation path from Plan dropdown to top-level "Jobs" tab
   - Any test that opens the Plan dropdown → remove or rewrite
   - Run full suite and fix all failures before committing
2. Verify all nav tabs route correctly
3. Verify Environments works in the Infrastructure satellite
4. Verify no dead nav entries remain
4. Commit all code changes
5. Archive this CLAUDE.md to `cc/specs/sp_nav_restructure.md`
6. Generate completion file to `.cc/completions/`
7. Commit spec archive and completion file separately

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_nav-restructure.md`

**Completion file format:**

```yaml
---
task: "Navigation restructure — flatten Plan dropdown, rename Deploy to Home, move Environments to Infrastructure satellite, remove dead nav entries"
status: complete | partial
cc-spec-id: sp_nav_restructure
files:
  - path: "cc/index.html"
    action: modified
  - path: "cc/cc-infrastructure.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{any decisions}"
  new_opens:
    - "{any questions}"
unexpected_findings:
  - "{anything unexpected}"
unresolved:
  - "{anything not completed}"
---

## Approach

{Brief narrative}

## Implementation Notes

{Key details}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
