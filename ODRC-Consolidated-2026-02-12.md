# ODRC — CC Workflow Model, Activity Discovery & Validation Pipeline
# Consolidated from: Full working session (2026-02-12)
# Origin: CC satellite deploy bug → workflow gaps → completion files → maker/checker → validation pipeline

---

## DECISIONS (Ratified)

### Workflow Model

1. **Code owns mutations, Chat owns reasoning.** CC bridges them by making Chat's reasoning available to Code (via CLAUDE.md) and Code's outcomes available to Chat (via completion files + validation bundle). The developer can go directly to Code for tactical fixes — CC captures what happened after the fact.

2. **Two workflow speeds.** Full lifecycle (shape → challenge → capture → refine → CLAUDE.md → Code) for planned features. Fast path (developer goes directly to Code, CC discovers after the fact) for bugs and tactical fixes. The line: if it changes product direction (new RULE, new DECISION, resolved OPEN), full lifecycle. If it fixes within current direction, fast path.

3. **CC is the journal of record, not the gatekeeper.** Any workflow that requires CC in the critical path for every change will be abandoned under time pressure. CC must reconstruct context after the fact, not just capture it in real time.

### Repo-Aware Artifact Placement

4. **CC validates repo state before placing Chat artifacts.** CC checks target file(s) against current repo state and blocks placement if Code has modified those files since the artifact was generated. Hard gate — the artifact lands cleanly or CC rejects it and says why.

### Code Completion Files

5. **Code outputs a structured completion file after every task.** This is Code's obligation to CC — the contract that keeps CC current without being in Code's critical path. Completion files replace git-based discovery as the primary sync mechanism. Git discovery is fallback.

6. **Completion file format:** Markdown with YAML frontmatter. Lands in `.cc/completions/` repo directory. One file per task. Named `YYYY-MM-DDTHH-MM-SS_task-slug.md`. Committed separately after code commits. Triggered by CLAUDE.md RULE.

7. **ODRC mapping on completion files is optional.** Unplanned work that doesn't map to an existing OPEN is logged as unclassified activity and routed to Chat for classification during validation.

### Maker/Checker Model

8. **Chat is the validation layer.** Code makes, Chat checks. Completion files are review requests, not just records. CC routes Code's output to Chat for validation and records the outcome.

9. **Feedback loop:** Chat → CC → Code (ideation, direction, CLAUDE.md). Code → CC → Chat (completion files, review requests). Chat validates → CC records outcome (confirmed, challenged, escalated).

### Validation Bundle

10. **CC assembles a validation bundle as a zip** containing: completion file, the CLAUDE.md Code was working from, ODRC state summary (OPENs tagged to that spec), and a dynamically generated review prompt. Developer opens a new Chat session, uploads the zip + the code file, and Chat performs validation.

11. **CLAUDE.md gets a unique spec tag** (`cc-spec-id: sp_xxxxxxxx`). Completion files reference this tag. CC uses it to match completion files back to their originating spec.

12. **OPENs are tagged with spec-ids at CLAUDE.md generation time.** When CC generates a CLAUDE.md, it tags every active OPEN included in the spec with that spec-id. OPENs accumulate tags across multiple specs — their tag history IS their lifecycle across build cycles. Stored on the concept object as `specTags[]` (parallel to `scopeTags[]`).

13. **Review prompt is dynamically generated via Claude API.** Small, low-cost call — input is completion file metadata + ODRC snapshot, output is a tailored review prompt packaged into the validation zip.

14. **CC surfaces a dialog on new completion file detection** — "New work completed, do you want to review now?" If declined, completion files are accessible from a job completion page where the developer can trigger review later.

### Ideation Platform (Steps 1-4)

15. **ConceptManager and IdeaManager are standalone JS objects** (not React components) placed between GitHub API class and Main App function. They are the data/service layer.

16. **`appIdeas/{appId}` is a denormalized Firebase index.** Maps apps to idea IDs for fast lookup. Source of truth is `ideas/{ideaId}`.

17. **`supersede()`, `resolve()`, and `transition()` are distinct operations** on concepts. Supersede replaces content (same type). Resolve marks an OPEN as done. Transition changes type following the state machine.

18. **IdeasView is its own top-level nav entry** under the Plan dropdown, with three modes (All Concepts, App Aggregate, Idea Detail) and relationship links from Dashboard and Backlog.

19. **Top-level listeners for `globalConcepts` and `globalIdeas`** in App component, following existing pattern for all shared data.

---

## RULES (Ratified)

### Workflow Rules

1. **CC is the journal of record, not the gatekeeper.** (See Decision 3.)

2. **Code must output a completion file after every task.** This is enforced via CLAUDE.md RULE, not by infrastructure. (See Decision 5.)

### State Management Rules (Base — applies to all single-file React/Firebase apps)

3. **All shared Firebase-backed data lives as top-level state** in the App component with `global` prefix. No view component owns shared data.

4. **Firebase listeners are set up once** in the App component's auth useEffect. Views never create their own listeners for shared data.

5. **Views own local UI state only** — filters, modal open/close, form inputs, selected items. Never data another view needs.

6. **Write to Firebase via service methods, let listener update state.** No optimistic UI updates. This prevents local state and Firebase from diverging.

### Data Flow Rules

7. **Data flows down via props, events flow up via callbacks.** No component reaches up or sideways.

8. **Service objects are global singletons** callable from any component. They are the write path to Firebase.

9. **One listener per collection per user.** Never two listeners on the same Firebase path.

10. **Listener callbacks only call the state setter.** No side effects, no cascading writes.

11. **All listener useEffect blocks must return a cleanup function.** No orphaned listeners.

### Concurrency Rules

12. **Serialize by design, not by code.** If two operations could modify the same Firebase path, the UI must prevent concurrent access (e.g., modal open blocks list actions on the same item).

13. **Use Firebase multi-path updates** when multiple writes must be atomic.

---

## OPENs (Active)

### Workflow Model

1. How does CC handle the complexity line between full lifecycle and fast path? Where exactly does "changes product direction" start? Is there a heuristic CC can apply, or is it always a developer judgment call?

2. Should Chat ever produce code changes, or is that a hard boundary? Middle ground: Chat produces code suggestions that only become real when committed through Code?

3. If Code fails to produce a completion file (session crash, developer abort, instruction drift), CC falls back to git-based discovery. Should CC actively alert the developer when it detects unmatched commits, or silently log them?

### Repo-Aware Artifact Placement

4. When CC blocks a Chat artifact placement, what's the recovery path? CC shows the diff and developer reconciles? CC regenerates the request with current state? CC routes to Code for integration? Should CC recommend based on conflict type?

5. What metadata does CC track for placement validation? Commit SHA at artifact generation time? File-level hashes? Something simpler?

### Completion File Pipeline

6. Schema validation — should CC validate completion file YAML against a schema, or accept whatever Code produces and surface issues during Chat validation?

7. Naming convention concern: does CC care about the filename, or just the contents? If just contents, the naming convention is for human benefit only.

### Maker/Checker Model

8. What does Chat's validation process look like in practice? Which checks run every time vs. triaged by complexity? (Correctness, alignment, side effects, ODRC impact, completeness.)

9. When Chat challenges Code's work, what's the resolution path? CC creates a rework task for Code? CC creates a new OPEN? CC flags for developer decision? (Instinct: Option 3 — Chat challenges, developer decides, Code executes.)

10. Does Chat need actual diffs attached to the validation bundle, or is the completion file + code sufficient? Diffs would let Chat verify Code's self-report against reality.

### Validation Bundle

11. What format is the ODRC state summary in the zip? Full concept export? Just active items tagged to this spec? Markdown or JSON?

12. How does CC know which CLAUDE.md to include? CC caches it at generation time? Pulls from repo by spec-id tag? Needs a local store of generated specs.

13. What model/token budget for the review prompt generation API call? Haiku is likely sufficient. Does CC already have API access or is this new infrastructure?

14. Where does the job completion page live in CC nav? Own view? Tab in Ideas? Section on Dashboard? It's a queue of unreviewed completion files with status (pending, reviewed, accepted, challenged).

15. Listen mechanism for new completion files — CC polls `.cc/completions/` via GitHub API? Developer uploads? Webhook? Polling is zero-friction but costs API calls.

### Ideation Platform

16. Prop drilling is at its practical limit — DashboardView now has 30+ props. At what point does CC need React Context or another pattern? What's the trigger for that architectural change?

17. `appIdeas` index consistency — could get out of sync if writes fail partway. Does it need a sync check?

18. Bulk import of ODRC concepts from existing documents — needed for seeding, deferred from Phase 1.

19. Concept conflict detection in aggregate view — how to handle a RULE from Idea 1 contradicting a DECISION from Idea 3.

20. How should `resolved_opens` in completion files match against existing OPEN concepts — text similarity, manual picker, or both?

21. How should `new_opens` from completion files be routed to an Idea — always latest active, or prompt user?

22. The IdeasView added ~692 lines, pushing codebase toward ~22.5K lines. Should it be considered for satellite extraction?

### Rule Inheritance (Future Feature)

23. CC should auto-populate base RULEs and CONSTRAINTs when an app is created, based on stack tags (e.g., `single-file-html + react-cdn + firebase-rtdb`). Three tiers: Universal, Stack-specific, App-specific. Captured in CC-Rule-Inheritance-Model.md. When should this be built?

---

## DECISION Candidates (For Discussion)

1. **Git-based discovery as fallback sync.** CC reads recent commits from a repo, uses AI to summarize what changed, presents to developer for ODRC classification. Only needed when completion files are missing. Requires just GitHub API access CC already has.

2. **CLAUDE.md generation should snapshot ODRC state** — store the full list of tagged OPENs, active RULEs, DECISIONs, and CONSTRAINTs as a frozen record alongside the spec-id. This enables historical comparison: what did Code know vs. what's current.

---

## Completion File Spec (v0.1)

See separate document: **CC-Completion-File-Spec.md**

Summary: Markdown with YAML frontmatter. Required fields: task, status, files, commits. Contextual fields: odrc mapping, unexpected_findings, unresolved. Optional narrative body: approach, assumptions, notes. Triggered by CLAUDE.md RULE. One file per task.

---

## Key Artifacts from This Session

| Artifact | Purpose |
|----------|---------|
| CC-Completion-File-Spec.md | Full spec for completion file format |
| CC-Rule-Inheritance-Model.md | Future feature: auto-populated rules by app type |
| CLAUDE.md (Steps 3-4) | Spec sent to Code for IdeasView build |
| ODRC-Additions-Workflow-Discovery_1.md | Original workflow gap analysis |
| cc_v8_55_2_production_base.html | Code's working base |
| cc_v8_56_1_for_diff.html | Earlier version for Code to diff |

---

## Session Log

**Session origin:** Testing CC satellite deployment → discovered shared files never deployed → exposed workflow gaps.

**Key progression:** Workflow gaps → unplanned work model → completion files → Code's obligation to CC → Chat as validator (maker/checker) → validation bundle pipeline → spec tagging → OPEN lifecycle tracking → CLAUDE.md generated and pushed → Code built Steps 3-4 (v8.57.0) → first completion file produced → first validation performed.

**What was validated:** Code built IdeasView (672 lines), three modes, three modals, CLAUDE.md generation with completion file section, relationship links. All rules followed. Spec contradiction identified and resolved correctly by Code. Pre-existing bug (doc push routing) found and fixed.

**What's next:** New session to spec the completion file ingestion pipeline — how CC ingests completion files, matches them to specs, assembles validation bundles, and presents them for review.
