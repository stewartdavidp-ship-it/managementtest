---
task: "Require app selection when creating ideas, add unlinked ideas section"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "19a34b2"
    message: "Require app selection when creating ideas, add unlinked ideas section (v8.69.2)"
odrc:
  new_decisions:
    - "CreateIdeaModal now requires app selection when not in app-aggregate mode — Create button disabled until app is picked"
    - "Unlinked ideas shown in amber warning section in IdeasView all-mode with inline app-linking dropdown"
    - "appId added to IdeaManager.update() allowed fields; _addIdeaToApp index updated on appId change"
  resolved_opens: []
  new_opens:
    - "Should creating a new app be possible inline from the CreateIdeaModal app picker?"
unexpected_findings:
  - "IdeaManager.update() had a whitelist of allowed fields that did not include appId, so any attempt to link an idea to an app via update() was silently ignored"
  - "CreateIdeaModal used appIdeas variable from parent scope which is only populated in app-aggregate mode — changed to inline filter from globalIdeas"
unresolved: []
---

## Root Cause

The CreateIdeaModal only set appId when in app-aggregate mode (viewing a specific app). Ideas created from the top-level Ideas view got `appId: null`. These "orphan" ideas:
1. Don't appear in the app-grouped Ideas view (only shows configuredApps grid)
2. Don't appear in the app-aggregate Idea History section
3. Can show on the Dashboard work cards as "unassigned" but clicking through to Ideas loses them

## Implementation

1. **App picker in CreateIdeaModal**: When not in app-aggregate mode, shows a dropdown of all configured apps. Create button is disabled until an app is selected. Shows warning text explaining the requirement.

2. **Unlinked Ideas section**: In IdeasView `mode === 'all'`, renders an amber warning panel listing all ideas with `appId: null`. Each has an inline dropdown to link to an app. Uses `IdeaManager.update()` + `_addIdeaToApp()` to set the link.

3. **IdeaManager.update() fix**: Added `appId` to the allowed fields whitelist. Also added automatic `_addIdeaToApp()` index update when appId is changed.
