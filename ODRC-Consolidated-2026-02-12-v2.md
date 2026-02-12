# ODRC — CC Workflow Model, Activity Discovery & Validation Pipeline
# Consolidated from: Full working sessions (2026-02-12)
# Updated: 2026-02-12 — Ingestion pipeline spec session
# Origin: CC satellite deploy bug → workflow gaps → completion files → maker/checker → validation pipeline → ingestion spec

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

6. **Completion file format:** Markdown with YAML frontmatter. Lands in `cc/completions/` repo directory. One file per task. Named `YYYY-MM-DDTHH-MM-SS_task-slug.md`. Committed separately after code commits. Triggered by CLAUDE.md RULE.

7. **ODRC mapping on completion files is optional.** Unplanned work that doesn't map to an existing OPEN is logged as unclassified activity and routed to Chat for classification during validation.

### Maker/Checker Model

8. **Chat is the validation layer.** Code makes, Chat checks. Completion files are review requests, not just records. CC routes Code's output to Chat for validation and records the outcome.

9. **Feedback loop:** Chat → CC → Code (ideation, direction, CLAUDE.md). Code → CC → Chat (completion files, review requests). Chat validates → CC records outcome (confirmed, challenged, escalated).

### Validation Bundle

10. **CC assembles a validation bundle as a zip** containing: completion file, the CLAUDE.md Code was working from, ODRC state summary, a dynamically generated review prompt, and the changed code files. Developer opens a new Chat session, uploads the zip, and Chat performs validation.

11. **CLAUDE.md gets a unique spec tag** (`cc-spec-id: sp_xxxxxxxx`). Completion files reference this tag. CC uses it to match completion files back to their originating spec.

12. **OPENs are tagged with spec-ids at CLAUDE.md generation time.** When CC generates a CLAUDE.md, it tags every active OPEN included in the spec with that spec-id. OPENs accumulate tags across multiple specs — their tag history IS their lifecycle across build cycles. Stored on the concept object as `specTags[]` (parallel to `scopeTags[]`).

13. **Review prompt is dynamically generated via Claude API (Haiku).** Input is completion file metadata + ODRC snapshot. Output is a tailored review prompt. Uses existing API infrastructure from Game Shelf. Two prompt modes: review (planned work, correctness/alignment) and classification (unplanned work, ODRC mapping).

14. **CC surfaces a dialog on new completion file detection** — three options: Dismiss (acknowledge), Review Output (inspect in CC), Package for Chat Check (assemble validation bundle). Acknowledge suppresses future dialogs for that file.

### Ingestion Pipeline

15. **CC polls `cc/completions/` via GitHub API on user-active moments.** No timer, no webhook. Triggers: app open, Dashboard navigation, Job History navigation. One extra API call to list directory contents per configured repo.

16. **Completion file lifecycle states: New → Acknowledged → Reviewed → Checked.** Non-linear transitions allowed (New can go straight to Checked). State stored in Firebase at `command-center/{uid}/completionJobs`. Completion file content lives in repo, lifecycle tracking lives in Firebase.

17. **Parsed completion file frontmatter is cached in Firebase on detection.** CC reads the file once from repo, parses YAML, stores structured data alongside lifecycle state. Job History reads from Firebase — no GitHub API calls per view. Repo remains source of truth.

18. **Lightweight schema validation on ingestion.** CC checks required fields exist (task, status, files, commits) and are correct types. Failures flag a warning state in Job History, never reject the file. Developer and Chat can still proceed with flagged files.

19. **Job History is a dedicated view under the Plan nav dropdown.** Shows all completion files with current lifecycle state, context-appropriate actions, filter controls (by state, by repo), and summary stats. Cards show task description, repo, state badge, validation status, classification status, file/commit counts, and detection date.

### Unplanned Work Classification

20. **Unplanned jobs are never forced into classification at detection time.** CC tracks unclassified count and nudges at a configurable threshold (default: 5). Nudge uses the same dialog pattern as other CC notifications. Nudge offers to batch-package unclassified jobs for a single Chat classification session.

21. **Chat classifies unplanned work through two paths:** (a) match to existing ODRC items ("this resolves OPEN 4"), or (b) create new categories if nothing fits (UX fix, performance, integration, bug fix, tech debt, etc.).

### ODRC Updates from Validation

22. **CC passes raw ODRC text from completion files through to the bundle.** Chat proposes matches to existing OPENs during review. No matching logic built into CC. Chat does the reasoning, developer confirms.

23. **Chat outputs structured ODRC recommendations in a defined format.** CC parses the output and presents a confirmation checklist. Developer confirms once, CC executes all Firebase writes (resolve OPENs, create new OPENs, link concepts). Manual creation remains as fallback. Maintains maker/checker — Chat recommends, developer approves, CC executes.

### Validation Bundle Assembly

24. **ODRC state summary format:** Scoped for planned work (tagged OPENs, RULEs, DECISIONs for that spec-id). Full active ODRC landscape for unplanned/classification work. Markdown format, generated dynamically from Firebase concepts at bundle time.

25. **Spec archival in repo.** Code archives the CLAUDE.md it was working from to `cc/specs/{spec-id}.md` as part of the post-task commit. Only applies to planned work with a CC-generated spec-id. Unplanned work has no spec archive — bundle uses current repo root CLAUDE.md for context.

26. **Bundle includes changed code files.** CC pulls all files listed in the completion file's `files` frontmatter from repo via GitHub API. Files placed in a `files/` subdirectory preserving repo paths. Keeps bundle self-contained — Chat has everything, no assumptions.

27. **Configurable bundle size limit (default 5MB).** Under limit: single zip, all files. Over limit: CC flags to developer with options — exclude largest files or split into multiple zips. Excluded files listed in the bundle so Chat knows what's missing. Developer makes final call.

### Code Post-Task Obligations

28. **Pre-completion checklist framing, not post-completion afterthought.** CLAUDE.md RULE instructs Code: before reporting task complete, execute checklist — (1) commit code, (2) archive CLAUDE.md to `cc/specs/{spec-id}.md` if spec-id present, (3) generate completion file to `cc/completions/`, (4) commit archive + completion file together.

### Orphan Commit Detection

29. **CC checks recent commits against completion file SHAs during existing polls.** One extra API call. Filters: ignore commits only touching `cc/` directory, ignore merge commits, configurable lookback window (default 14 days). Same dialog pattern: Dismiss, Reconstruct via Code, Ignore Permanently.

30. **Reconstruction via Code.** CC packages orphaned commit SHAs and details as a task for Code. Code uses `git show`, file inspection, and CLAUDE.md context to produce proper completion files. Files land in `cc/completions/` and flow through normal ingestion. Reconstructed files are inherently lossy — narrative sections may be incomplete.

### Multi-Phase Spec Packaging

31. **Chat creates spec packages when work exceeds one Code session.** Package contains a manifest (JSON) + ordered CLAUDE.md files. Manifest defines job sequence and dependencies. CC ingests package, creates job queue.

32. **One active Code job per repo at a time.** Prevents merge conflicts from concurrent Code sessions. Job queue is sequential per repo — next job doesn't start until current completes. Validation before starting next job is recommended but not required. Separate repos have independent queues. CC informs developer of dependency status, never blocks.

### Ideation Platform (Steps 1-4)

33. **ConceptManager and IdeaManager are standalone JS objects** (not React components) placed between GitHub API class and Main App function. They are the data/service layer.

34. **`appIdeas/{appId}` is a denormalized Firebase index.** Maps apps to idea IDs for fast lookup. Source of truth is `ideas/{ideaId}`.

35. **`supersede()`, `resolve()`, and `transition()` are distinct operations** on concepts. Supersede replaces content (same type). Resolve marks an OPEN as done. Transition changes type following the state machine.

36. **IdeasView is its own top-level nav entry** under the Plan dropdown, with three modes (All Concepts, App Aggregate, Idea Detail) and relationship links from Dashboard and Backlog.

37. **Top-level listeners for `globalConcepts` and `globalIdeas`** in App component, following existing pattern for all shared data.

---

## RULES (Ratified)

### Workflow Rules

1. **CC is the journal of record, not the gatekeeper.** (See Decision 3.)

2. **Code must output a completion file after every task.** This is enforced via CLAUDE.md RULE with pre-completion checklist framing. (See Decisions 5, 28.)

3. **One active Code job per repo at a time.** CC enforces sequential execution to prevent merge conflicts. (See Decision 32.)

### State Management Rules (Base — applies to all single-file React/Firebase apps)

4. **All shared Firebase-backed data lives as top-level state** in the App component with `global` prefix. No view component owns shared data.

5. **Firebase listeners are set up once** in the App component's auth useEffect. Views never create their own listeners for shared data.

6. **Views own local UI state only** — filters, modal open/close, form inputs, selected items. Never data another view needs.

7. **Write to Firebase via service methods, let listener update state.** No optimistic UI updates. This prevents local state and Firebase from diverging.

### Data Flow Rules

8. **Data flows down via props, events flow up via callbacks.** No component reaches up or sideways.

9. **Service objects are global singletons** callable from any component. They are the write path to Firebase.

10. **One listener per collection per user.** Never two listeners on the same Firebase path.

11. **Listener callbacks only call the state setter.** No side effects, no cascading writes.

12. **All listener useEffect blocks must return a cleanup function.** No orphaned listeners.

### Concurrency Rules

13. **Serialize by design, not by code.** If two operations could modify the same Firebase path, the UI must prevent concurrent access (e.g., modal open blocks list actions on the same item).

14. **Use Firebase multi-path updates** when multiple writes must be atomic.

---

## OPENs (Active)

### Workflow Model

1. How does CC handle the complexity line between full lifecycle and fast path? Where exactly does "changes product direction" start? Is there a heuristic CC can apply, or is it always a developer judgment call?

2. Should Chat ever produce code changes, or is that a hard boundary? Middle ground: Chat produces code suggestions that only become real when committed through Code?

### Repo-Aware Artifact Placement

3. When CC blocks a Chat artifact placement, what's the recovery path? CC shows the diff and developer reconciles? CC regenerates the request with current state? CC routes to Code for integration? Should CC recommend based on conflict type?

4. What metadata does CC track for placement validation? Commit SHA at artifact generation time? File-level hashes? Something simpler?

### Maker/Checker Model

5. What does Chat's validation process look like in practice? Which checks run every time vs. triaged by complexity? (Correctness, alignment, side effects, ODRC impact, completeness.)

6. When Chat challenges Code's work, what's the resolution path? CC creates a rework task for Code? CC creates a new OPEN? CC flags for developer decision? (Instinct: Option 3 — Chat challenges, developer decides, Code executes.)

7. Does Chat need actual diffs attached to the validation bundle, or is the completion file + code sufficient? Diffs would let Chat verify Code's self-report against reality.

### Validation Bundle

8. What is the exact structured output format Chat should use for ODRC recommendations? Needs a formal schema for reliable CC parsing.

9. How does the developer get Chat's structured output back into CC? Copy-paste? File upload? Direct API integration?

### Ideation Platform

10. Prop drilling is at its practical limit — DashboardView now has 30+ props. At what point does CC need React Context or another pattern? What's the trigger for that architectural change?

11. `appIdeas` index consistency — could get out of sync if writes fail partway. Does it need a sync check?

12. Bulk import of ODRC concepts from existing documents — needed for seeding, deferred from Phase 1.

13. Concept conflict detection in aggregate view — how to handle a RULE from Idea 1 contradicting a DECISION from Idea 3.

14. The IdeasView added ~692 lines, pushing codebase toward ~22.5K lines. Should it be considered for satellite extraction?

### Rule Inheritance (Future Feature)

15. CC should auto-populate base RULEs and CONSTRAINTs when an app is created, based on stack tags (e.g., `single-file-html + react-cdn + firebase-rtdb`). Three tiers: Universal, Stack-specific, App-specific. Captured in CC-Rule-Inheritance-Model.md. When should this be built?

### Ingestion Pipeline

16. Should Job History support filtering and search (by repo, date range, state, classification status)? (Phase 1 CLAUDE.md includes basic filters — this OPEN is about whether more advanced search is needed.)

17. What happens to completion files in the repo over time? Archive strategy? Pruning?

18. How does CC handle completion files from multiple repos simultaneously?

### Multi-Phase Spec Packaging

19. When should the multi-phase spec packaging and job queue feature be built? Not needed for current manual phasing but becomes important as workflow matures.

20. Manifest format — JSON or markdown? Current lean: JSON (easier to parse).

21. How does CC ingest the spec package? Developer uploads zip to CC? CC detects it in a repo directory? Chat pushes via some mechanism?

---

## OPENs (Resolved)

*Resolved during ingestion pipeline spec session (2026-02-12):*

| Original # | Question | Resolution |
|------------|----------|------------|
| 3 (old) | Missing completion file fallback — alert on unmatched commits? | → Decision 29: Orphan detection with Dismiss/Reconstruct/Ignore dialog |
| 6 (old) | Schema validation — validate YAML or accept anything? | → Decision 18: Lightweight validation, warnings not rejections |
| 7 (old) | Naming convention — does CC care about filename? | CC cares about contents; naming is for human benefit and sort order |
| 11 (old) | ODRC summary format in zip? | → Decision 24: Scoped for planned, full for classification, markdown |
| 12 (old) | How does CC know which CLAUDE.md to include? | → Decision 25: Code archives to cc/specs/{spec-id}.md |
| 13 (old) | Model/token budget for review prompt? | → Decision 13 (updated): Haiku, uses existing Game Shelf API |
| 14 (old) | Where does job completion page live? | → Decision 19: Job History, own view under Plan dropdown |
| 15 (old) | Listen mechanism for new completion files? | → Decision 15: Poll on user-active moments via GitHub API |
| 20 (old) | How to match resolved_opens to ODRC? | → Decision 22: Chat proposes, CC passes raw text through |
| 21 (old) | How to route new_opens from completion files? | → Decision 23: Chat recommends structured output, CC presents checklist |

---

## DECISION Candidates (For Discussion)

1. **Git-based discovery as fallback sync.** CC reads recent commits from a repo, uses AI to summarize what changed, presents to developer for ODRC classification. Only needed when completion files are missing. Requires just GitHub API access CC already has.

2. **CLAUDE.md generation should snapshot ODRC state** — store the full list of tagged OPENs, active RULEs, DECISIONs, and CONSTRAINTs as a frozen record alongside the spec-id. This enables historical comparison: what did Code know vs. what's current.

---

## Configurable Settings (Ingestion Pipeline)

| Setting | Default | Description |
|---------|---------|-------------|
| Unclassified nudge threshold | 5 | Number of unclassified jobs before CC nudges for batch classification |
| Bundle size limit | 5MB | Maximum zip size before CC recommends exclusions or splitting |
| Orphan detection window | 14 days | How far back CC looks for orphaned commits |
| Orphan nudge threshold | 5 | Number of orphaned commits before CC nudges for reconstruction |

---

## Completion File Spec (v0.1)

See separate document: **CC-Completion-File-Spec.md**

Summary: Markdown with YAML frontmatter. Required fields: task, status, files, commits. Contextual fields: odrc mapping, unexpected_findings, unresolved. Optional narrative body: approach, assumptions, notes. Triggered by CLAUDE.md RULE. One file per task. Directory changed from `.cc/completions/` to `cc/completions/` (visible).

---

## Ingestion Pipeline Spec (v0.1)

See separate document: **CC-Ingestion-Pipeline-Spec.md**

Summary: Detection via GitHub API polling on user-active moments. Lifecycle states (New → Acknowledged → Reviewed → Checked) in Firebase. Job History view under Plan nav. Validation bundle assembly with completion file, spec archive, ODRC summary, review prompt, and code files. Two prompt modes (review for planned, classification for unplanned). Structured ODRC update output from Chat with confirmation checklist. Orphan commit detection with Code-based reconstruction. Configurable settings for thresholds and limits.

---

## Key Artifacts

| Artifact | Purpose |
|----------|---------|
| CC-Completion-File-Spec.md | Full spec for completion file format |
| CC-Ingestion-Pipeline-Spec.md | Full spec for ingestion pipeline (detection → bundle → validation) |
| CC-Ingestion-Pipeline-Addendum.md | Multi-phase packaging and job queue decisions |
| CLAUDE-md-Phase1-Ingestion.md | Phase 1 CLAUDE.md spec for Code (detection, Job History, Firebase) |
| CC-Rule-Inheritance-Model.md | Future feature: auto-populated rules by app type |
| CLAUDE.md (Steps 3-4) | Spec sent to Code for IdeasView build |
| ODRC-Additions-Workflow-Discovery_1.md | Original workflow gap analysis |

---

## Session Log

### Session 1: Workflow Discovery & Ideation Platform

**Session origin:** Testing CC satellite deployment → discovered shared files never deployed → exposed workflow gaps.

**Key progression:** Workflow gaps → unplanned work model → completion files → Code's obligation to CC → Chat as validator (maker/checker) → validation bundle pipeline → spec tagging → OPEN lifecycle tracking → CLAUDE.md generated and pushed → Code built Steps 3-4 (v8.57.0) → first completion file produced → first validation performed.

**What was validated:** Code built IdeasView (672 lines), three modes, three modals, CLAUDE.md generation with completion file section, relationship links. All rules followed. Spec contradiction identified and resolved correctly by Code. Pre-existing bug (doc push routing) found and fixed.

### Session 2: Ingestion Pipeline Spec

**Session origin:** Picking up from Session 1's "what's next" — spec the completion file ingestion pipeline.

**Key progression:** Reviewed completion file spec and ODRC → identified 8 open items for ingestion build → walked through each one-by-one converting to decisions → detection mechanism (poll on user-active) → lifecycle states and Job History → spec archival in repo → unplanned work classification (never forced, batch nudge) → two prompt templates → ODRC summary format → review prompt via API (Haiku) → schema validation (lightweight, warnings) → ODRC matching (Chat proposes, CC passes through) → structured ODRC update output with confirmation checklist → bundle includes code files → bundle size management → Firebase caching of parsed data → orphan commit detection with Code reconstruction → Code post-task checklist → multi-phase spec packaging → one job per repo constraint → generated Phase 1 CLAUDE.md.

**Decisions ratified:** 15 new decisions (Decisions 15-32 in this document), resolving 10 previously open items.

**What's next:** Execute Phase 1 build (v8.58.0) — CompletionFileService, GitHub polling, detection dialog, Job History view, settings. Then Phase 2 (bundle assembly, review prompts, spec archival) and Phase 3 (orphan detection, ODRC update ingestion).
