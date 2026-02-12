# ODRC Additions — Workflow Model & Activity Discovery
# Emerged from: CC satellite deploy bug debugging session (2026-02-12)
# Trigger: Shared files never deployed → exposed gap in how unplanned work flows through the system

---

## New OPENs

### Workflow Model (New Section)

**Add under OPENs:**

- OPEN: The ideation lifecycle assumes planned, phased builds (shape → challenge → capture → refine → CLAUDE.md → Claude Code). How does CC handle unplanned work — bug fixes, hot patches, exploratory debugging — without imposing the full flywheel overhead? Does CC need a "fast path" that skips CLAUDE.md generation for tactical fixes, or does that erode the discipline the product is built on?

- OPEN: In the Chat iteration model, the developer pastes code, describes the problem, and gets a fix in one loop. In the CC + Claude Code model, the developer is a messenger between two AI systems (Chat for reasoning, Code for execution). For work below a certain complexity threshold, is that actually better? Where is the complexity line that justifies the full lifecycle vs. a direct Claude Code conversation?

- OPEN: Should Claude Chat ever produce code changes, or is that a hard boundary? If Chat produces code, it creates a parallel change path that bypasses version control and the journal of record. If Chat never produces code, it loses the fast iteration loop that made it productive. Is there a middle ground — e.g., Chat produces code suggestions that only become real when committed through Claude Code?

- OPEN: If a developer goes directly to Claude Code for a tactical fix (skipping CC), how does CC find out? Three discovery patterns to evaluate:
  1. **Git-based discovery** — CC polls or webhooks on the repo. It sees new commits, diffs them, and uses AI to extract what changed and why. Passive, no developer action required. But commit messages may be terse or absent.
  2. **CLAUDE.md round-trip** — Claude Code writes a session summary back to CLAUDE.md (or a separate SESSION_LOG.md) after each session. CC reads it on next sync. Requires Claude Code cooperation but no developer overhead.
  3. **Developer reports back** — Developer uploads session output or pastes a summary into CC. Most context-rich but most friction. This is the current model for Chat sessions.
  4. **Hybrid** — Git discovery for the "what" (commits, diffs), developer/Claude Code annotation for the "why" (which OPEN it addressed, what was learned). CC merges both.
  
  Which pattern(s) should CC support? Can they layer — e.g., git discovery as baseline, annotation as enrichment?

- OPEN: If Claude Code commits directly to the repo and CC discovers changes after the fact, how does CC map those changes back to the ODRC model? A commit that fixes the shared file deploy bug should resolve the corresponding OPEN and potentially create a new DECISION ("shared files deploy via X mechanism"). Can AI reliably do this mapping from diffs + commit messages, or does it need explicit tagging?

- OPEN: Claude Code sessions produce context that's currently lost — what was tried, what failed, what assumptions were made, what was learned. This is the same "session output" problem Chat has, but Code doesn't have a natural export path. How does CC capture Claude Code session context? Options: session transcript export, CLAUDE.md appendix, structured session summary file, or CC ignores Code session context and only tracks outcomes (commits).

### Activity Discovery (New Section)

- OPEN: CC needs to maintain a current record of all activity across Chat and Code without being in the critical path. What is CC's sync model?
  - **Push model** — Developer/AI pushes updates to CC (current: file upload). High fidelity, high friction.
  - **Pull model** — CC pulls from external sources (GitHub commits, CLAUDE.md changes). Low friction, potentially lower fidelity.
  - **Event model** — GitHub webhooks or polling triggers CC to process new activity. Zero friction but requires infrastructure (Firebase Functions to receive webhooks).
  
  The pull/event models require CC to have a "sync" capability that doesn't exist today. Is this a core feature or a Phase 2 concern?

- OPEN: If CC discovers a commit it can't map to any known OPEN or Idea, what does it do? Options: create an unlinked activity record, prompt the developer to classify it, or ignore it. The answer affects whether CC's record is comprehensive or selective.

---

## DECISION Candidates (For Discussion)

- DECISION (candidate): Claude Code owns all code mutations. Claude Chat owns all context and reasoning. CC bridges them by making Chat's reasoning available to Code (via CLAUDE.md) and making Code's outcomes available to Chat (via activity discovery). The developer can go directly to Claude Code for tactical fixes without routing through CC — CC captures what happened after the fact, not before.

- DECISION (candidate): CC supports two workflow speeds:
  - **Full lifecycle** — For planned features and new Ideas. Shape → challenge → capture → refine → CLAUDE.md → Claude Code. CC is in the critical path.
  - **Fast path** — For bugs, hot fixes, and tactical changes. Developer goes directly to Claude Code (or Chat). CC discovers the activity after the fact via git sync and/or session upload. CC is the journal of record, not the gatekeeper.
  
  The line between them: if it changes the product direction (new RULE, new DECISION, resolved OPEN), it should go through the lifecycle. If it fixes something within the current direction, fast path is fine.

- DECISION (candidate): CC's minimum viable sync is git-based discovery. CC can read recent commits from a repo, use AI to summarize what changed, and present it to the developer for ODRC classification. This doesn't require webhooks, Firebase Functions, or Claude Code cooperation — just GitHub API access CC already has. Annotation and round-trip CLAUDE.md are enrichment layers built on top.

---

## Potential RULE (if the above DECISIONs are ratified)

- RULE (candidate): CC is the journal of record, not the gatekeeper. Any workflow that requires CC to be in the critical path for every change will be abandoned by developers under time pressure. CC must be able to reconstruct context after the fact, not just capture it in real time.

---

## Context: What Triggered This

While testing CC satellite deployment, we discovered that `shared/cc-shared.css` and `shared/cc-shared.js` never landed in the repo despite being in every deploy package since v8.49.0. All three satellite apps fail on load because they depend on these files.

The natural instinct was to fix it in Claude Chat (the familiar iteration loop). But the new model says Claude Code should handle code changes. This exposed:
1. The lifecycle doesn't account for unplanned/tactical work
2. There's no defined fast path for bugs
3. If work happens outside CC (in Claude Code directly), CC has no way to discover it
4. The developer's comfort with Chat iteration creates friction with the Code-first model
5. Version control becomes the source of truth, but CC needs to read it to stay current

These aren't bugs in the thesis — they're gaps that need resolution before the model works in practice.
