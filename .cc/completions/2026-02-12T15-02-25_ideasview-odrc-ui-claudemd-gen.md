---
task: "Build IdeasView ODRC management UI and CLAUDE.md generation — Steps 3-4 of CC Ideation Platform"
status: complete
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "94a497a"
    message: "Fix doc push routing to respect test/prod target selection (v8.56.5)"
  - sha: "73ab1d8"
    message: "Add IdeasView: ODRC concept management UI + CLAUDE.md generation (v8.57.0)"
odrc:
  resolved_opens:
    - "Should the Idea History timeline be a vertical list or a horizontal visual timeline? — Implemented as horizontal button chain (compact, clickable, shows status)"
    - "When generating CLAUDE.md, should the build scope section be manually written per Idea or auto-assembled from ODRC objects? — Auto-assembled from active ODRC concepts, with latest active Idea providing the build objective header"
  applied_decisions:
    - "ODRC entries are first-class objects with full state machine. Not text attributes."
    - "Build the ODRC data model, Idea objects, management UI, and CLAUDE.md generation as Phase 1. Skip concept extraction automation, artifact routing enhancements, and prompt templates for now."
    - "Use the existing CC navigation structure. Add an Ideas tab within the App detail view rather than creating a new top-level section. — Implemented as 'Ideas' under Plan dropdown per the updated DECISION to make it a top-level nav entry."
    - "For CLAUDE.md generation, start with copy-to-clipboard. GitHub API push is secondary. — Both implemented."
  new_opens:
    - "Completion file ingestion pipeline: how should CC parse YAML frontmatter from completion files and route ODRC updates back into the concept system?"
    - "How should resolved_opens in completion files match against existing OPEN concepts — text similarity, manual picker, or both?"
    - "Should completion files be ingested on file drop into CC, or pulled from the repo's .cc/completions/ directory via GitHub API?"
    - "How should new_opens from completion files be routed to an Idea — always the latest active Idea, or prompt the user to choose?"
    - "The IdeasView added ~692 lines, pushing codebase toward the ~20k line constraint. Should the view be considered for satellite extraction in a future phase?"
    - "Prop drilling is at its practical limit — DashboardView now has 30+ props. Should React Context be introduced for shared state in a future phase?"
unexpected_findings:
  - "Doc push routing was broken — all doc pushes went to prod repo regardless of UI target selection. Fixed in v8.56.5 before starting the IdeasView build."
  - "The CLAUDE.md spec said to add Ideas as a tab within App detail view, but the updated DECISIONs section said to make it a top-level nav entry under Plan. Followed the DECISIONs section."
  - "ConceptManager.transition() returns flagged concepts when a CONSTRAINT transitions, but the return shape isn't documented in the service — discovered by reading the code."
unresolved:
  - item: "Bulk import of ODRC concepts from existing documents"
    reason: "Explicitly deferred per OPEN in CLAUDE.md — needed for seeding but not part of Phase 1 scope"
  - item: "Concept conflict detection in aggregate view"
    reason: "Listed as OPEN in CLAUDE.md — how to handle a RULE from Idea 1 contradicting a DECISION from Idea 3. No spec provided."
  - item: "Completion file ingestion and ODRC feedback loop"
    reason: "Separate project requiring its own spec and CLAUDE.md"
---

## Approach

Built Steps 3-4 incrementally in the order specified by the CLAUDE.md:

1. **Global state** (Step 3A): Added `globalConcepts` and `globalIdeas` useState + Firebase listeners in the App component, following the exact pattern of existing globals (globalStreams, globalWorkItems, etc.).

2. **Navigation** (Step 3B): Added 'ideas' to the Plan section's views array and a label mapping in the dropdown.

3. **View routing** (Step 3C): Added conditional rendering block for IdeasView after BacklogView.

4. **IdeasView component** (Step 3C): Built a single component with three modes driven by state:
   - Mode 1 (All Concepts): Filter bar + concepts grouped by ODRC type + app grid for drill-down
   - Mode 2 (App Aggregate): Current truth view with idea chain, active concepts, and Generate CLAUDE.md button
   - Mode 3 (Idea Detail): Single idea with all its concepts and lifecycle actions

5. **Sub-components**: ConceptCard (shared across all modes), ConceptEditModal, TransitionConfirmationModal, GenerateCLAUDEModal — all defined inside IdeasView to avoid polluting global scope.

6. **CLAUDE.md generation** (Step 4): Modal assembles markdown from active ODRC state with the template from the spec. DECISIONs scoped to latest active Idea only. Output options: copy to clipboard and push to repo (test-first repo selection per v8.56.5 convention).

7. **Relationship links** (Step 3D): Concept count badge on DashboardView app cards, "Ideas" link in BacklogView group headers.

Also fixed a pre-existing bug: doc push routing always went to prod repo regardless of UI target selection (v8.56.5).

## Assumptions

- The `ODRC_TYPES` and `CONCEPT_STATUSES` constants referenced in IdeasView are the ones already defined in the ConceptManager service block (~line 4827). They are global and accessible.
- `ODRC_TRANSITIONS` is also globally defined in the ConceptManager block and used for the transition dropdown and confirmation modal.
- The `github` object passed as a prop has `getFile()` and `createOrUpdateFile()` methods matching the existing pattern used elsewhere in CC.
- Completion file section in generated CLAUDE.md is a simplified version — the full format with YAML frontmatter example was kept brief to avoid bloating generated files.

## Notes

- The IdeasView is functional but has no data yet — first use requires creating an Idea and then adding concepts to it.
- The completion file ingestion pipeline is the natural next project. This completion file itself is the first test artifact for that pipeline.
- Version is now 8.57.0. All changes are in command-center-test only. Prod (command-center) is untouched at the previous version.
