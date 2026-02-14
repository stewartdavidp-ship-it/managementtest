# Spec: session.json Schema & Package Format
## Unit 1 of 5 — Session Tab Specification
**Idea:** session-tab | **IdeaId:** -OlO6yEDlG9FFkjXgAxl | **App:** command-center
**Session:** S-2026-02-14-007 | **Spec Phase:** 1 of 5
**Status:** DRAFT

---

## 1. Purpose

This spec defines the **session.json schema** and the **session output package format** — the foundational contract that all other spec units build against. It covers:

- The JSON schema for session.json (field names, types, semantics)
- The zip package structure (what files, how named, how referenced)
- How the schema handles single-link sessions vs. multi-link chains
- The ODRC item format within JSON
- The artifacts manifest within session.json

---

## 2. Package Format

### 2.1 Package Structure

The session output package is a **zip file** containing:

```
{idea-slug}-{session-id}-{date}.zip
├── session.json          # Structured data — single source for the inbound processor
├── debrief.md            # Narrative session debrief — highest-value artifact
└── [additional artifacts] # Any other files produced during the session/chain
```

### 2.2 Naming Conventions

**Zip filename:** `{idea-slug}-{session-id}-{date}.zip`
- `idea-slug`: kebab-case identifier (e.g., `session-tab`)
- `session-id`: format `S-YYYY-MM-DD-NNN` (e.g., `S-2026-02-14-007`)
- `date`: `YYYY-MM-DD` (e.g., `2026-02-14`)
- Full example: `session-tab-S-2026-02-14-007-2026-02-14.zip`

**Internal filenames:** Generic — no slug or session ID embedded.
- `session.json` (always)
- `debrief.md` (always)
- Additional artifacts use descriptive names (e.g., `pacing-model-sketch.md`)

**Rationale:** The zip filename carries the full identity; internal files don't need it because they only exist within the zip context. Revisit if files ever need to live outside zip context.

### 2.3 Who Produces the Package

Only the **summation link** (in multi-link chains) or the **single working link** (in single-link sessions) produces the CC-recognizable package. Link packages produced during a chain are intermediate artifacts with **no naming contract to CC**.

### 2.4 Manifest Rule

Every file in the zip **must** be referenced in the `session.json` artifacts array. The JSON is the manifest — if a file isn't listed, it doesn't get processed.

---

## 3. session.json Schema

### 3.1 Top-Level Structure

```json
{
  "schema_version": "1.0.0",
  "session_id": "S-2026-02-14-007",
  "date": "2026-02-14",
  "idea": {
    "slug": "session-tab",
    "id": "-OlO6yEDlG9FFkjXgAxl",
    "name": "Session Tab",
    "phase": "spec-ready"
  },
  "app": "command-center",
  "context_summary": "Spec Unit 1 — defined session.json schema and package format.",
  "session_config": {
    "mode": "spec",
    "lens": null
  },
  "chain": {
    "link_count": 3,
    "summation": true,
    "links": [ /* LinkSummary[] */ ]
  },
  "odrc": {
    "counts": {
      "decisions_new": 4,
      "rules_new": 1,
      "constraints_new": 0,
      "opens_new": 2,
      "opens_resolved": 5
    },
    "items": [ /* ODRCItem[] */ ]
  },
  "debrief_summary": "Narrative summary of the chain for Firebase storage...",
  "next_session": {
    "recommendation": "Proceed to Unit 2 — session lifecycle & idea phase model.",
    "suggested_focus": ["session state machine", "idea phase transitions"],
    "suggested_mode": "spec",
    "suggested_lens": null
  },
  "artifacts": [ /* Artifact[] */ ]
}
```

### 3.2 Field Definitions

#### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | yes | Semver version of this schema. Current: `"1.0.0"` |
| `session_id` | string | yes | Session identifier, format `S-YYYY-MM-DD-NNN` |
| `date` | string | yes | ISO date `YYYY-MM-DD` |
| `idea` | IdeaRef | yes | Reference to the parent idea |
| `app` | string | yes | App identifier (e.g., `"command-center"`) |
| `context_summary` | string | yes | One-line summary of what this session accomplished |
| `session_config` | SessionConfig | yes | Mode and lens used for this session |
| `chain` | ChainSummary | yes | Chain structure metadata |
| `odrc` | ODRCBlock | yes | All ODRC items produced/resolved this session |
| `debrief_summary` | string | yes | Narrative debrief extract for Firebase storage (first 2-3 paragraphs of the debrief) |
| `next_session` | NextSession | yes | Recommendation for the following session |
| `artifacts` | Artifact[] | yes | Manifest of all files in the zip |

#### IdeaRef

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | yes | Kebab-case idea identifier |
| `id` | string | yes | Firebase ID of the idea record |
| `name` | string | yes | Human-readable idea name |
| `phase` | string | yes | Idea phase at session time: `inception`, `exploring`, `converging`, `spec-ready`, `complete` |

#### SessionConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string \| null | yes | Session mode (e.g., `"exploration"`, `"spec"`) or null |
| `lens` | string \| null | yes | Session lens (e.g., `"technical"`, `"economics"`) or null |

#### ChainSummary

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `link_count` | integer | yes | Number of working links (excludes summation) |
| `summation` | boolean | yes | Whether a summation link was run |
| `links` | LinkSummary[] | yes | Per-link metadata |

#### LinkSummary

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `link_number` | integer | yes | 1-indexed link number |
| `purpose_declared` | string | yes | What this link set out to resolve |
| `purpose_achieved` | string | yes | `"yes"`, `"partial"`, or `"no"` — with brief rationale |
| `concept_blocks` | integer | yes | Count of concept blocks in this link |
| `elapsed_minutes` | integer \| null | yes | Approximate minutes, null if not tracked |
| `odrc_counts` | ODRCCounts | yes | ODRC production counts for this link |

#### ODRCBlock

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `counts` | ODRCCounts | yes | Aggregate counts across the session/chain |
| `items` | ODRCItem[] | yes | All ODRC items — new and resolved |

#### ODRCCounts

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decisions_new` | integer | yes | New Decisions made |
| `rules_new` | integer | yes | New Rules identified |
| `constraints_new` | integer | yes | New Constraints documented |
| `opens_new` | integer | yes | New OPENs surfaced |
| `opens_resolved` | integer | yes | Prior OPENs resolved |

#### ODRCItem

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | One of: `"decision"`, `"rule"`, `"constraint"`, `"open_new"`, `"open_resolved"` |
| `text` | string | yes | Self-contained description — readable without session context. For decisions: what AND why. For resolved OPENs: original question + resolution. |
| `source_link` | integer \| null | yes | Link number that produced this item, null for single-link sessions |
| `affinity` | string \| null | no | For tangent OPENs: idea slug or `"orphan"`. Null for primary items. |
| `is_tangent` | boolean | no | `true` if captured as a tangent during the session. Default: `false`. |
| `original_open` | string \| null | no | For `open_resolved` type only: the original OPEN text being resolved |

#### NextSession

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recommendation` | string | yes | What the next session should focus on |
| `suggested_focus` | string[] | no | Specific OPENs or topics to prioritize |
| `suggested_mode` | string \| null | no | Recommended mode |
| `suggested_lens` | string \| null | no | Recommended lens |

#### Artifact

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | yes | Exact filename as it appears in the zip |
| `type` | string | yes | Artifact type: `"debrief"`, `"spec"`, `"code"`, `"skill"`, `"doc"`, `"config"`, `"test"`, or any string |
| `description` | string | yes | Brief description of what this file is |
| `source_link` | integer \| null | no | Which link produced it, null if session-level |

---

## 4. Single-Link vs. Multi-Link Sessions

The chain model is advisory infrastructure, not mandatory. The schema handles both cases:

### 4.1 Single-Link Session (No Summation)

When a session completes its purpose within a single link:

```json
{
  "chain": {
    "link_count": 1,
    "summation": false,
    "links": [
      {
        "link_number": 1,
        "purpose_declared": "Define session.json schema",
        "purpose_achieved": "yes — schema defined with all field types",
        "concept_blocks": 6,
        "elapsed_minutes": 45,
        "odrc_counts": { "decisions_new": 4, "rules_new": 1, "constraints_new": 0, "opens_new": 2, "opens_resolved": 3 }
      }
    ]
  }
}
```

The working link produces the package directly. `source_link` on ODRC items can be `1` or `null` (both valid — there's no ambiguity).

### 4.2 Multi-Link Chain (With Summation)

When a chain has multiple working links followed by summation:

```json
{
  "chain": {
    "link_count": 3,
    "summation": true,
    "links": [
      {
        "link_number": 1,
        "purpose_declared": "Explore schema design space",
        "purpose_achieved": "yes",
        "concept_blocks": 5,
        "elapsed_minutes": 30,
        "odrc_counts": { "decisions_new": 2, "rules_new": 0, "constraints_new": 0, "opens_new": 3, "opens_resolved": 1 }
      },
      {
        "link_number": 2,
        "purpose_declared": "Resolve ODRC format questions",
        "purpose_achieved": "partial — deferred artifact typing",
        "concept_blocks": 7,
        "elapsed_minutes": 40,
        "odrc_counts": { "decisions_new": 3, "rules_new": 1, "constraints_new": 0, "opens_new": 1, "opens_resolved": 2 }
      },
      {
        "link_number": 3,
        "purpose_declared": "Lock naming conventions",
        "purpose_achieved": "yes",
        "concept_blocks": 3,
        "elapsed_minutes": 20,
        "odrc_counts": { "decisions_new": 1, "rules_new": 0, "constraints_new": 1, "opens_new": 0, "opens_resolved": 2 }
      }
    ]
  }
}
```

The summation link consolidates ODRC items from all working links. `source_link` on each ODRC item traces back to the originating link.

---

## 5. Artifact Type Handling

Artifact types are **open-ended**. The processor handles known types with specific routing:

| Type | Processor Behavior |
|------|-------------------|
| `"debrief"` | Store as first-class field on session record. Extract for brief generation. |
| `"spec"` | Store and associate with idea. |
| `"skill"` | Flag for skill update workflow. |
| *(any other)* | Store as generic attachment on the session record. |

New types can be introduced without schema changes. The processor evolves to handle them as routing needs emerge.

---

## 6. Debrief Handling

The debrief serves two purposes and lives in two places:

1. **debrief.md** — The full narrative file in the zip. This is the highest-value artifact, carrying the arc of the session, breakthroughs, tensions, and contextual understanding.

2. **debrief_summary** field in session.json — An extract (first 2-3 paragraphs, or an explicit summary section) stored as a first-class field on the session record in Firebase. CC queries this directly when building future session briefs.

The `artifacts` array references `debrief.md` with type `"debrief"`, which signals the processor to extract and store it. The `debrief_summary` field provides quick access without reading the file.

---

## 7. Transition Compatibility

### 7.1 Current State Constraint

The existing ODRC parser expects markdown format. Until the new JSON import path is built, the session output must include the markdown ODRC Updates document **in addition to** session.json.

**Transition strategy:**
- Phase 1 (now): session.json + debrief.md + ODRC-Updates markdown in the zip. Processor uses markdown path.
- Phase 2 (processor rewrite): Processor reads session.json directly. ODRC markdown becomes optional/deprecated.
- Phase 3 (cleanup): ODRC markdown dropped from package.

The schema is designed for Phase 2+. The transition period adds temporary bulk but doesn't affect the schema contract.

### 7.2 Schema Versioning

The `schema_version` field enables the processor to handle schema evolution. Version `"1.0.0"` is the initial contract. Breaking changes increment the major version; additive changes increment the minor version.

---

## 8. Decision Validation Checkpoint

This section maps every Decision covered by this spec unit to its implementation in the schema.

| # | Decision | Spec Implementation | Status |
|---|----------|-------------------|--------|
| 1 | Package is a zip with session.json, debrief, and artifacts | §2.1 Package Structure | ✅ Covered |
| 2 | ODRC items as structured JSON, not parsed from markdown | §3.2 ODRCItem type definition | ✅ Covered |
| 3 | Debrief is separate .md, referenced via artifacts with type 'debrief' | §2.1, §5, §6 | ✅ Covered |
| 4 | Debrief/handoff summary is first-class field on session record | §3.2 `debrief_summary` field, §6 | ✅ Covered |
| 5 | Drop ODRC Updates markdown (session.json + debrief are sufficient) | §7.1 Transition — markdown retained temporarily, schema designed for post-transition | ✅ Covered |
| 6 | Artifact types open-ended, known types get specific routing | §5 Artifact Type Handling | ✅ Covered |
| 7 | Zip naming fully qualified, internal filenames generic | §2.2 Naming Conventions | ✅ Covered |
| 8 | Initial schema fields (session ID, date, slug, etc.) | §3.1–3.2 Full field definitions | ✅ Covered |
| 9 | Link artifact metadata header (session ID, slug, link number, etc.) | §3.2 LinkSummary type | ✅ Covered |
| 10 | Concept block count as first-class field | §3.2 LinkSummary.concept_blocks | ✅ Covered |
| 11 | Concept block count + elapsed minutes per link | §3.2 LinkSummary fields | ✅ Covered |
| 12 | Only summation package carries CC filename signature | §2.3 Who Produces the Package | ✅ Covered |
| 13 | Chain model advisory — single-link sessions skip summation | §4 Single-Link vs. Multi-Link | ✅ Covered |

**Rules validated:**
| Rule | Spec Implementation |
|------|-------------------|
| Machine-parseable data in JSON, not markdown | Core schema design principle |
| Every zip file referenced in artifacts array | §2.4 Manifest Rule |
| Start minimal, iterate based on usage | Schema is minimal viable; `schema_version` enables iteration |

**Constraints acknowledged:**
| Constraint | Handling |
|-----------|---------|
| Processor rewrite in progress | §7.1 Transition strategy — schema compatible, not dependent |
| Current parser expects markdown | §7.1 Phase 1 includes markdown alongside JSON |

**Gaps or conflicts found:** None for schema/package contract. Added §9 (Existing Infrastructure Reference) and §10 (Implementation Guidance) to bridge the gap between spec and CLAUDE.md conversion — these sections ensure the spec is self-sufficient for a CLAUDE.md generation session.

---

## 9. Existing Infrastructure Reference

These are the current CC components that session.json will interact with during implementation.

| Component | Location (approx line) | Firebase Path | Purpose |
|-----------|----------------------|---------------|---------|
| `ODRCUpdateIngestionService` | ~2708 | — | Parses markdown ODRC lines into actionable items. **Currently regex-based against markdown format.** session.json replaces this parsing with direct JSON read. |
| `ConceptManager` | ~5327 | `command-center/{uid}/concepts` | CRUD for ODRC concepts in Firebase. Creates concepts with `{ type, content, ideaOrigin, status, scopeTags }`. session.json items will map to `ConceptManager.create()` and `.resolve()` calls. |
| `IdeaManager` | ~5530 | `command-center/{uid}/ideas` | Idea CRUD, slug generation, session log entries. `addSessionLogEntry()` records `{ sessionId, date, summary, conceptsCreated, conceptsResolved, type }`. session.json provides all these fields directly. |
| `SessionService` | ~1360 | `command-center/{uid}/sessions` | Tracks AI interaction cycles (prep → build → deploy). **This is the build/deploy session tracker, NOT the ideation session tracker.** The ideation session record is a new concept that session.json defines. |
| `IdeationBriefGenerator` | ~3030 | — | Generates session briefs. Reads from `idea.sessionLog[]` and cumulative ODRC state. session.json's `debrief_summary` and `next_session` fields feed future brief generation. |
| `detectInboundArtifactType()` | ~2887 | — | Three-path routing: odrc, spec, claude-md. **Needs a fourth path: `session-json` for session.json detection.** |
| `extractODRCSection()` | ~2810+ | — | Extracts ODRC markdown section from file content. **Bypassed when session.json provides structured ODRC directly.** |
| Zip ingestion flow | ~7300 | — | Iterates zip entries, detects artifact types, routes to ODRC parser. **Needs to detect session.json and route to a new JSON-based ingestion path.** |
| `FirebaseConfigSync` | ~335 | `command-center/{uid}/*` | Syncs local state to Firebase. Session records will sync through this layer. |

### Key Firebase Data Paths

```
command-center/{uid}/
├── ideas/{ideaId}/
│   ├── name, slug, description, phase, status
│   ├── sessionLog[]              ← session.json feeds new entries here
│   └── lastSessionDate
├── concepts/{conceptId}/
│   ├── type, content, ideaOrigin, status
│   └── resolvedBy, scopeTags
├── sessions/{sessionId}/         ← BUILD sessions (SessionService) — NOT ideation
└── [future] ideation-sessions/   ← New path for session.json records
```

---

## 10. Implementation Guidance

This section provides directional notes for the CLAUDE.md session that translates this spec into implementation instructions. It is not prescriptive — the CLAUDE.md session should validate these against the codebase at build time.

### 10.1 New Components Needed

**`SessionPackageProcessor`** — New service that handles session.json ingestion:
- Detects `session.json` in zip entries
- Parses and validates against `schema_version`
- Routes ODRC items to `ConceptManager.create()` / `.resolve()`
- Creates/updates the ideation session record in Firebase
- Stores `debrief_summary` as first-class field on the session record
- Processes artifacts array for known-type routing (debrief, spec, skill)

**Ideation session record in Firebase** — New data structure (path TBD, likely `command-center/{uid}/ideation-sessions/{sessionId}` or stored on the idea record). Contains the full session.json data for historical queries and brief generation.

### 10.2 Migration Path for `ODRCUpdateIngestionService`

The current parser uses regex against markdown lines. The new JSON path runs in parallel:

1. Zip entry detected as `session.json` → route to `SessionPackageProcessor`
2. `SessionPackageProcessor` reads `odrc.items[]` directly — no regex
3. Maps each item to existing `ConceptManager` calls:
   - `open_new`, `decision`, `rule`, `constraint` → `ConceptManager.create()`
   - `open_resolved` → `ConceptManager.resolve()` (match via `original_open` text or concept ID)
4. Markdown ODRC path remains for backward compatibility during transition

### 10.3 Data Flow: Session Package → Firebase

```
Chat produces zip
  → Developer uploads to CC
    → Zip ingestion detects session.json
      → SessionPackageProcessor validates schema
        → ODRC items → ConceptManager (create/resolve)
        → Session metadata → ideation session record
        → debrief_summary → session record field
        → IdeaManager.addSessionLogEntry() with enriched data
        → Artifacts → type-based routing (debrief stored, spec archived, etc.)
```

### 10.4 Fields That Map to Existing Structures

| session.json field | Maps to | Notes |
|---|---|---|
| `session_id` | `idea.sessionLog[].sessionId` | Direct mapping |
| `date` | `idea.sessionLog[].date` | Direct mapping |
| `context_summary` | `idea.sessionLog[].summary` | Direct mapping |
| `odrc.counts.decisions_new + rules_new + constraints_new + opens_new` | `idea.sessionLog[].conceptsCreated` | Sum of new items |
| `odrc.counts.opens_resolved` | `idea.sessionLog[].conceptsResolved` | Direct mapping |
| `session_config.mode` | `idea.sessionLog[].type` | Maps mode to session type |
| `debrief_summary` | New field on session record | First-class for brief generation |
| `idea.phase` | `idea.phase` | Update idea phase if changed |
| `odrc.items[]` | `ConceptManager.create()` / `.resolve()` | Per-item processing |

---

## 11. Open Questions for Future Units

These are not OPENs to resolve now — they're scope boundaries where this spec hands off to other units:

- **Unit 2:** How does the session record in Firebase map to these fields? What's the session state machine?
- **Unit 3:** How do the updated skills reference this schema? What instructions do they give Chat for producing session.json?
- **Unit 4:** How does the landing page display chain progress from session.json data?
- **Unit 5:** How does the processor validate, parse, and ingest session.json? What error handling applies?

---

## 12. New ODRC Items from This Session

### New Decisions
- **DECISION:** When an idea enters spec-ready phase, the brief generator includes spec format requirements (mandatory sections: Infrastructure Reference, Implementation Guidance, Decision Validation Checkpoint) and a reference to the CLAUDE.md locked template — ensuring Chat knows the target format at session start. The cc-mode-spec skill carries a closing checklist that validates the spec is CLAUDE.md-ready before the session wraps. Both enforcement points — brief and skill — ensure any user, any session, any Claude instance produces specs that can feed directly into CLAUDE.md generation. *(Affinity: session-tab)*
- **DECISION:** Spec-type and claude-md-type session briefs must include a directive requesting the current codebase (index.html or relevant source files) as an attachment. CLAUDE.md documents reference specific line numbers, component locations, and existing infrastructure — they cannot be produced accurately without the live codebase. The brief generator embeds this as a "Required Attachments" section in spec and claude-md briefs, and the handshake prompt reminds the developer to attach the codebase. *(Affinity: session-tab)*

### New OPENs
- **OPEN:** What is the exact spec format template and closing checklist content to embed in (a) the `IdeationBriefGenerator` spec-type system prompt and (b) the cc-mode-spec skill? This needs to be defined in Unit 3 (skill updates) and validated against the CLAUDE.md locked template to ensure field-level alignment. *(Affinity: session-tab)*
- **OPEN:** What is the exact wording for the Required Attachments section and handshake prompt update in the brief generator for spec and claude-md sessions? Should it name specific files (e.g., "attach index.html") or be generic ("attach the current codebase")? Implementation belongs in the IdeationBriefGenerator updates. *(Affinity: session-tab)*
