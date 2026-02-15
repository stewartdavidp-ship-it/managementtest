# ODRC Updates — CC Navigation & Data Model Redesign
# Date: 2026-02-15
# Session: S-2026-02-15-011 (tangent capture from session-tab session)
# Idea: cc-navigation-redesign
# IdeaId: (new — to be created)
# App: command-center
# Context: During session-tab work, traced a phase computation bug to a broader UI/navigation gap. Discovered missing idea attribute editing, rethought the tab structure and data model hierarchy, and renamed Concepts to Positions.

## ODRC Updates

- NEW DECISION: "Rename 'Concepts' to 'Positions' as the container term for ODRC items. OPENs are open positions, Decisions are defined positions, Rules are governing positions, Constraints are fixed positions. The underlying data model key migrates alongside the UI in the same spec."
- NEW DECISION: "The tab structure is Home | Projects | Ideas | Sessions (Jobs TBD). Projects is the data hierarchy browser (Project → Apps → Ideas). Ideas is the idea-centric detail view with Positions and Sessions as inner dimensions plus editable idea attributes. Sessions is the cross-cutting activity journal filterable by project, app, idea."
- NEW DECISION: "An Idea always belongs to a Project, optionally belongs to an App. Genesis ideas (no app) live directly under the Project. Enhancement ideas live under an App within the Project. Project is the required root entity."
- NEW DECISION: "The Projects tab adds an ideas layer — genesis ideas visible directly under the project, app cards surface idea counts with drill-down. Visual treatment must be compact and not overwhelm the app configuration surface."
- NEW DECISION: "The Ideas tab shows two dimensions per idea: Positions (ODRC items filterable by type and status) and Sessions (activity history showing which positions each session produced). Idea attributes (phase, name, description) are editable from this view."
- NEW DECISION: "The Sessions tab is a cross-cutting activity journal — all sessions across all ideas, filterable by project, app, and idea. An alternative visualization oriented around 'what have I been doing' rather than 'where is this idea at.'"
- NEW OPEN: "What's the right visual treatment for ideas in the Projects tab? Cards, expandable rows, a side panel? It needs to coexist with the app configuration UI without making that view cluttered."
- NEW OPEN: "In the Ideas tab, how do you navigate between ideas? A left-side list with right-side detail? A card grid you click into? The current three-mode drill-down (all → app → idea) is the pattern being replaced — what's the new entry point?"
- NEW OPEN: "Should the Sessions tab show session detail inline (expandable cards with concept lists) or link back to the Ideas tab for full detail?"
- NEW OPEN: "Where does Jobs fit in the tab model? Jobs are build/deploy artifacts tied to apps — they sit outside the ideation hierarchy. Do they stay as a separate tab, fold under Apps, or move to a different surface?"
- NEW OPEN: "What happens to existing ideas that have an app but no project? The current data model has ideas linked to apps directly with no project layer. Migration needs to either auto-create projects from existing apps or prompt the developer to organize."
- NEW OPEN: "Can a genesis idea graduate to an app in a different project than where it originated, or is graduation always within the same project?"

## Session Notes

### What Was Accomplished
Captured during a session-tab session (S-2026-02-15-011) as tangent work. While tracing a phase computation bug, discovered that the Ideas tab has no way to edit idea attributes (phase, name, description), which led to a broader rethink of CC's navigation model and data hierarchy. Established the Project → App → Idea containment model, redefined the tab structure, and renamed Concepts to Positions after evaluating alternatives (Claims, Deliberations, Stances).

### Key Design Principles Established
- The tab bar reflects the data model hierarchy directly — each tab is a first-class entity view
- Ideas and Sessions are two views of the same underlying activity, oriented around different questions: "where is this idea at" vs "what have I been doing"
- Project is the required root entity — every Idea must belong to a Project before it can exist
- Genesis ideas (pre-app) and enhancement ideas (app-linked) follow the same Idea model but differ in containment

### Artifacts Produced
| # | Filename | Type | Status | Purpose |
|---|----------|------|--------|---------|
| 1 | ODRC-Updates-cc-navigation-redesign-S011.md | odrc | complete | This document — tangent idea ODRC capture |

### Session Status
- Concepts: 6 DECISIONs (new), 6 OPENs (new), 0 resolved, 0 RULEs, 0 CONSTRAINTs
- Phase: inception (new idea)
- Next session: Exploration session to resolve the visual treatment OPENs and define the Ideas tab navigation model. Should reference prior navigation analysis sessions for context.
