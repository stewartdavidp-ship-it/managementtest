# ODRC Updates — Ideation Workflow: Idea-to-Chat Pipeline
# Date: 2026-02-12
# Session: 2 (Idea-to-Chat Pipeline)
# Idea: ideation-workflow-pipeline
# App: command-center
# Context: Resolved all 5 Session 1 OPENs, designed full pipeline mechanics, wrote spec

---

## ODRC Updates

- RESOLVE OPEN: "Where do ideation session documents live in the repo structure?" → docs/sessions/{idea-slug}/S-YYYY-MM-DD-NNN.md, using kebab-case slug convention consistent with project/app naming from CC taxonomy

- RESOLVE OPEN: "How does CC present the generated session brief and supporting docs?" → Size-aware output: zip download is primary path (most sessions), clipboard copy for small briefs. Standardized handshake prompt always copied separately. Prompt is a constant with minimal variable substitution (idea name, session number, app name) to prevent behavioral drift.

- RESOLVE OPEN: "Should the ODRC Import modal be accessible from Idea Detail view?" → No. Single inbound path through deploy tab. File content detection routes ODRC metadata automatically. Idea ID embedded in session output header enables auto-linking to correct Idea.

- RESOLVE OPEN: "Add 'ideation' to SESSION_TYPES or build parallel path?" → Neither. Ideation brief generation uses same infrastructure (ClaudeAPIService, ODRCSummaryGenerator) as its own path. No SESSION_TYPE dispatch needed — the generator knows it's ideation because it's called from Idea Detail with Idea context.

- RESOLVE OPEN: "Token budget for session prompts — how much previous session history to include?" → Deprioritized as optimization, not architecture. Current ODRC state always included (compact). Prior sessions included by summary only. Developer attaches full prior session docs manually when deep context needed.

- NEW DECISION: "Session handshake prompt is a standardized constant with three variable slots (idea name, session number, app name) — prevents behavioral drift from ad-lib framing that changes session behavior"

- NEW DECISION: "Deploy tab handles all inbound session artifacts with content-based routing — code to repo, documents to docs/sessions/, ODRC metadata parsed and routed to Firebase via editable confirmation checklist"

- NEW DECISION: "ODRC update routing uses header metadata (Idea ID, session number, app ID) embedded in session output. Fallback to manual Idea picker when header is absent or unrecognized"

- NEW DECISION: "Inbound ODRC confirmation checklist is fully editable — type, action, description, and idea linkage can all be changed before execution. Items can be unchecked to skip."

- NEW DECISION: "Session output is a single file containing both the full session document and the ODRC updates section. Deploy tab parses ODRC section for Firebase, pushes full file to GitHub. One file, two destinations."

- NEW DECISION: "ODRC content detection is content-based using existing parser patterns (## ODRC Updates header, NEW/RESOLVE line patterns) — no explicit markers or file naming conventions required"

- NEW DECISION: "Idea data model extended with: slug (kebab-case, auto-generated), sessionLog (array with session ID, date, docPath, AI-generated summary, concept counts), lastSessionDate (for stale detection), phase (computed from ODRC ratios, overridable)"

- NEW DECISION: "Idea slug follows existing CC kebab-case convention used by projects and apps. Session docs use S-YYYY-MM-DD-NNN format from CC taxonomy."

- NEW DECISION: "Phase computation: exploring (OPENs > DECISIONs or total concepts < 5), converging (DECISIONs >= OPENs and at least 1 RULE/CONSTRAINT), spec-ready (OPENs = 0 or OPENs <= 2 with DECISIONs >= 10). Hardcoded thresholds, tunable later."

- NEW DECISION: "AI-generated session summary produced at import time via ClaudeAPIService — reads the ODRC updates being ingested and produces a one-liner for the session log"

- NEW DECISION: "Phase recomputation happens on every Idea Detail render from live concept data — no cached phase value needed for default, only for manual overrides"

- NEW RULE: "System behavior is data-driven by default — phase, summaries, session numbering, stale detection, and context packaging are derived from ODRC state and session history. Developer can override but the system pushes forward based on what it knows."

- NEW OPEN: "Standardized prompt exact wording — draft exists, needs testing against real Chat sessions to validate behavior"

- NEW OPEN: "Deploy tab file routing implementation — how does the existing deploy flow extend to handle document and ODRC content types alongside code?"

- NEW OPEN: "Stale idea detection thresholds — how many days with unresolved OPENs before surfacing a nudge?"

- NEW OPEN: "Duplicate detection during ODRC ingestion — how does the confirmation checklist identify and flag potential duplicates against existing concepts? Fuzzy matching strategy and UX for merge/skip/create decisions."

- NEW DECISION: "ODRC ingestion confirmation checklist includes duplicate detection — each inbound NEW item is compared against existing concepts on the linked Idea and flagged if similar. Developer chooses to create anyway, skip, or merge into existing. Already-resolved OPENs are auto-unchecked."

---

## Session Notes

### What Was Accomplished
Session 2 resolved all 5 OPENs from Session 1 and designed the complete pipeline mechanics — outbound (brief generation, zip packaging, standardized prompt), inbound (deploy tab routing, content detection, editable confirmation checklist, execution), and continuity (session logging, phase computation, data model extensions). Produced a full spec document ready for implementation.

### Key Design Principles Established
- **One door in, smart routing** — all inbound files go through deploy tab, content detection handles routing
- **Prompt standardization** — fixed handshake prompt prevents drift from ad-lib framing
- **Data-driven behavior** — phase, summaries, and suggestions derived from state, not user selection
- **Consistency with existing conventions** — kebab-case slugs, S-YYYY-MM-DD-NNN session IDs, same infrastructure patterns

### Spec Status
Spec generated with 20 DECISIONs, 4 RULEs, 0 CONSTRAINTs, 4 non-blocking OPENs. Implementation sequence defined in 4 phases: data model → outbound → inbound → continuity.
