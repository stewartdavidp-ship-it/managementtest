# ODRC Updates — Session Tab
# Date: 2026-02-14
# Session: S-2026-02-14-007 (Spec Unit 1 — session.json schema & package format)
# Idea: session-tab
# IdeaId: -OlO6yEDlG9FFkjXgAxl
# App: command-center
# Context: Produced spec Unit 1 (session.json schema & package format) and converted it to a CLAUDE.md implementation document. Identified and resolved gaps around CLAUDE.md readiness and codebase attachment requirements.

## ODRC Updates

- NEW DECISION: "The session.json schema v1.0.0 defines the foundational contract for session output packages. Top-level fields: schema_version, session_id, date, idea (slug/id/name/phase), app, context_summary, session_config (mode/lens), chain (link_count/summation/links[]), odrc (counts/items[]), debrief_summary, next_session, artifacts[]. ODRC items are structured JSON objects with type, text, source_link, affinity, is_tangent, and original_open fields — eliminating regex parsing."
- NEW DECISION: "The session output package is a zip file named {idea-slug}-{session-id}-{date}.zip containing generic internal filenames: session.json (always), debrief.md (always), and additional artifacts. Every file in the zip must be referenced in session.json's artifacts array — the JSON is the manifest."
- NEW DECISION: "Single-link sessions that complete within one link produce the package directly with chain.summation=false and chain.link_count=1. Multi-link chains produce the package via summation link with chain.summation=true. The schema handles both identically — only the chain metadata differs."
- NEW DECISION: "Artifact types in session.json are open-ended strings. The processor routes known types (debrief, spec, skill) to specific handling and stores unrecognized types as generic attachments. New types can be introduced without schema changes."
- NEW DECISION: "debrief_summary is a first-class string field in session.json containing the first 2-3 paragraphs of the debrief narrative. This gets stored directly on the Firebase session record so CC can query it for brief generation without reading the debrief.md file."
- NEW DECISION: "Transition strategy: Phase 1 keeps markdown ODRC document in the zip alongside session.json for backward compatibility with the current parser. Phase 2 (processor rewrite) reads session.json directly. Phase 3 drops markdown from the package. Schema is designed for Phase 2+."
- NEW DECISION: "SessionPackageProcessor is a new service that validates session.json against the schema, maps ODRC items to ConceptManager-compatible format (reusing the existing import checklist UI), builds enriched session log entries with chain metadata and debrief summaries, and extracts metadata for idea routing."
- NEW DECISION: "detectInboundArtifactType() becomes four-path routing: session-json (highest priority), odrc, spec, claude-md. session.json detection is highest priority because session.json files contain ODRC data that would otherwise match the markdown ODRC detector."
- NEW DECISION: "When an idea enters spec-ready phase, the brief generator includes spec format requirements (mandatory sections: Infrastructure Reference, Implementation Guidance, Decision Validation Checkpoint) and a reference to the CLAUDE.md locked template — ensuring Chat knows the target format at session start. The cc-mode-spec skill carries a closing checklist that validates the spec is CLAUDE.md-ready before the session wraps. Both enforcement points — brief and skill — ensure any user, any session, any Claude instance produces specs that can feed directly into CLAUDE.md generation."
- NEW DECISION: "Spec-type and claude-md-type session briefs must include a directive requesting the current codebase (index.html or relevant source files) as an attachment. CLAUDE.md documents reference specific line numbers, component locations, and existing infrastructure — they cannot be produced accurately without the live codebase. The brief generator embeds this as a Required Attachments section in spec and claude-md briefs, and the handshake prompt reminds the developer to attach the codebase."
- NEW OPEN: "What is the exact spec format template and closing checklist content to embed in (a) the IdeationBriefGenerator spec-type system prompt and (b) the cc-mode-spec skill? This needs to be defined in Unit 3 (skill updates) and validated against the CLAUDE.md locked template to ensure field-level alignment." [Affinity: session-tab]
- NEW OPEN: "What is the exact wording for the Required Attachments section and handshake prompt update in the brief generator for spec and claude-md sessions? Should it name specific files (e.g., attach index.html) or be generic (attach the current codebase)? Implementation belongs in the IdeationBriefGenerator updates." [Affinity: session-tab]

## Session Notes

### What Was Accomplished
This session produced spec Unit 1 (session.json schema & package format) — the foundational contract for the session tab idea. The spec defines the complete JSON schema with field names, types, and semantics; the zip package structure and naming conventions; handling for both single-link and multi-link chain sessions; the ODRC item format within JSON; the artifacts manifest; and a transition strategy for coexisting with the current markdown parser.

The spec was then converted into a CLAUDE.md implementation document targeting v8.66.0, which defines a `SessionPackageProcessor` service, four-path artifact detection, enriched session log entries, and parallel operation with the existing markdown ODRC path. All line numbers and component references were validated against the v8.65.3 codebase.

During the CLAUDE.md conversion, two process gaps were identified and resolved as new Decisions: (1) spec sessions need Infrastructure Reference and Implementation Guidance sections to be CLAUDE.md-ready, enforced via both the brief generator and a cc-mode-spec skill closing checklist; (2) spec and claude-md session briefs must request the current codebase as an attachment since CLAUDE.md documents reference specific line numbers.

### Key Design Principles Established
- The spec is a contract document; the CLAUDE.md is the implementation translation — both are needed and serve different audiences
- Enforcement of spec quality must be programmatic (brief generator + skill), not memory-based, so it transfers across users and sessions
- The codebase is a required input for any spec or CLAUDE.md session — the brief must explicitly request it
- session.json ingestion reuses the existing import checklist UI by converting JSON items to the same format the markdown parser produces — no UI changes needed

### Artifacts Produced
| # | Filename | Type | Status | Purpose |
|---|----------|------|--------|---------|
| 1 | spec-unit1-session-json-schema.md | spec | complete | Spec Unit 1 — session.json schema & package format |
| 2 | CLAUDE-session-json-schema.md | claude-md | complete | CLAUDE.md for implementing the session.json processor |
| 3 | ODRC-Updates-session-tab-S007.md | odrc | complete | This document — session ODRC output |

### Session Status
- Concepts: 10 DECISIONs (new), 2 OPENs (new), 0 resolved, 0 RULEs, 0 CONSTRAINTs
- Phase: spec-ready (unchanged)
- Next session: Begin spec Unit 2 — session lifecycle & idea phase model. This defines the session state machine (dispatched → active → complete), the ideation session record in Firebase, and how idea phase transitions work.
