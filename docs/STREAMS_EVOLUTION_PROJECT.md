# CC Streams Evolution — Project Plan

## Overview

Extend CC's existing stream system from a tracking tool into a quality automation pipeline. Streams become the thread connecting spec → constraints → code review → tests → deploy.

**Core principle:** If it can't be automated, no one will use it.

## Current State

### Existing Infrastructure
- **CC Core** (20,836 lines): Stream stubs, session brief generator, product brief generator, CONTEXT.md generator, doc push/classification
- **Analytics Satellite** (4,034 lines): WorkStreamsView (~800 lines) with create/edit/filter, full CRUD services
- **Firebase Schema**: `command-center/{uid}/streams`, `/interfaces`, `/dependencies`, `/dependencyAlerts`
- **Services**: WorkStreamService, StreamInterfaceService, DependencyService, DependencyAlertService

### Current Stream Model
```javascript
{
  id: "S-001",
  name: "Rush Feature",
  status: "active",        // active | blocked | complete
  appId: "gameshelf",      // single app
  owner: "Dave",
  goal: "Add time rush mode",
  targetRelease: "v1.9.0",
  order: 1
}
```

### What Works Today
- Work items linked via streamId
- Stream context in session briefs
- Product Brief includes stream overview
- Interface contracts + dependency alerts between streams
- Stream filtering/grouping in work item views
- Full management UI in Analytics satellite

---

## Target State

### Extended Stream Model
```javascript
{
  // Existing (unchanged)
  id, name, status, owner, goal, targetRelease, order,
  appId,  // keep for backward compat

  // New fields
  appIds: [],              // multi-app scope
  project: "",             // project scope
  
  concepts: [{             // the automation core
    id, type, text, source, date, status
  }],
  
  artifacts: [{            // docs, packages, test plans
    name, type, date, repo, path
  }],
  
  sessions: [{             // session history
    date, summary, conceptsAdded, testsRun
  }],
  
  tests: {                 // test tracking
    plan: "",
    scenarios: [{ id, name, status, evidence }],
    coverage: { pass, fail, untested, total }
  },
  
  codeReview: {            // review status
    lastReview, techniques, issuesFound, issuesFixed, status
  },
  
  openItems: [],           // unresolved questions
  next: ""                 // drives session prep
}
```

### Status Values Extended
`planning` → `active` → `testing` → `complete` → `archived`

---

## Build Plan

### Session 1: Data Model + Concept Parser

**Goal:** Concepts can be extracted from documents and stored on streams.

**Chunk 1: Data Model Extension (Analytics Satellite)**
- [ ] Update `WorkStreamService.create()` — add new fields with defaults
- [ ] Update `WorkStreamService.update()` — handle new fields
- [ ] Add migration: existing streams get empty arrays for new fields
- [ ] Add `appIds[]` support alongside single `appId`
- [ ] Add `status` values: planning, testing, archived (existing: active, blocked, complete)
- [ ] Test: create stream with new fields, verify Firebase storage

**Chunk 2: Concept Parser (CC Core)**
- [ ] New function: `parseConcepts(docContent)` — regex on `<!-- cc-concepts -->` markers
- [ ] Returns: `[{ type, text, scope[] }]`
- [ ] Hook into doc push flow: after push-doc files committed, check for markers
- [ ] Prompt user: "Found N concepts. Add to stream [dropdown]?"
- [ ] Store concepts on selected stream via WorkStreamService
- [ ] Console log: `[Concepts] Extracted N concepts from {filename}`
- [ ] Test: push a doc with cc-concepts markers, verify extraction and storage

**Files modified:**
- `analytics/index.html` — WorkStreamService CRUD, stream editor form
- `command-center/index.html` — parseConcepts function, doc push hook

**Estimated effort:** 4-6 hours

---

### Session 2: Workstream Brief Generator

**Goal:** Generate a 30-line context brief from stream data, copy-pasteable into Claude sessions.

**Chunk 3: Brief Generator (CC Core)**
- [ ] New function: `generateWorkstreamBrief(stream, apps, versions)` → markdown string
- [ ] Include: identity, active concepts, open items, test status, code review status, last session, next
- [ ] Follow pattern of existing SessionBriefGenerator / ProductBriefGenerator
- [ ] Add "Copy Brief" button to stream detail in Analytics satellite
- [ ] Add brief preview panel (show what will be copied)
- [ ] Test: generate brief for a stream with concepts, verify output

**Brief template:**
```markdown
# Stream: {name}
Status: {status} | Project: {project} | Apps: {appIds}

## Active Concepts
- RULE: ...
- DECISION: ...
- CONSTRAINT: ...

## Open Items
- ...

## Test Status: N/M pass, N FAIL, N untested

## Code Review: {status}

## Last Session ({date})
{summary}

## Next
{next}
```

**Files modified:**
- `command-center/index.html` — generateWorkstreamBrief function (~100 lines)
- `analytics/index.html` — Copy Brief button + preview (~50 lines)

**Estimated effort:** 2-3 hours

---

### Session 3: Stream UI Enhancements

**Goal:** Manage concepts, artifacts, test coverage, and open items through the Analytics UI.

**Chunk 4: Stream UI Updates (Analytics Satellite)**
- [ ] Extend stream editor: appIds multi-select, project dropdown, open items list, next field
- [ ] Add Concepts tab to stream detail view
  - [ ] List concepts with type badges and status toggle
  - [ ] Add concept manually (type, text, scope)
  - [ ] Mark concept as superseded/resolved
  - [ ] Import from document (paste cc-concepts block)
- [ ] Add Artifacts section to stream detail
  - [ ] List artifacts with type, date, link
  - [ ] Auto-populated from doc pushes
- [ ] Add Test Coverage summary
  - [ ] Badge: N/M pass, N fail, N untested
  - [ ] Expandable scenario list with status
  - [ ] Manual status toggle per scenario
- [ ] Add Code Review status badge
  - [ ] Last review date, technique used, issues found/fixed
- [ ] Add Sessions history list
  - [ ] Date, summary, concepts added

**Files modified:**
- `analytics/index.html` — WorkStreamsView expansion (~300-400 new lines)

**Estimated effort:** 3-4 hours

---

### Session 4: Interactive Surfacing

**Goal:** "Did you consider?" prompts during session prep, concept-aware workflow.

**Chunk 5: Interactive Surfacing (CC Core)**
- [ ] Modify session brief generation: if work items have streamId, pull stream concepts
- [ ] Add concept section to session brief output
- [ ] Add "Did you consider?" step in session prep flow:
  - [ ] Show active concepts as checklist
  - [ ] Show unresolved OPEN items as blockers
  - [ ] User confirms or adds new concepts
- [ ] Add concept conflict detection:
  - [ ] When adding concept, check against all active concepts across streams
  - [ ] Flag if new concept contradicts existing RULE or CONSTRAINT
- [ ] Add deploy gate check:
  - [ ] Before deploy: check stream health (review clean? tests pass? OPEN items resolved?)
  - [ ] Warning if deploying with open items or failing tests

**Files modified:**
- `command-center/index.html` — SessionBriefGenerator modifications, deploy gate (~150-200 lines)
- `analytics/index.html` — concept conflict UI (~50 lines)

**Estimated effort:** 3-4 hours

---

## Future: Claude API Integration (Phase 2)

Not in scope for these 4 sessions. Build after manual workflow is proven.

- Embed Anthropic API call in CC
- Evaluate user intent against stream concepts
- Auto-generate constraint-aware prompts
- Session prep becomes a conversation with CC before starting with Claude
- Estimated: 4-6 additional hours

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Firebase schema changes break existing data | All new fields optional, migration adds defaults |
| Analytics satellite grows too large | WorkStreamsView already 800 lines — may need to split into sub-components |
| Concept extraction parser is fragile | Simple regex on known markers, fallback to manual entry |
| Too many concepts become noise | Scope filtering + status management (supersede/resolve) |
| Brief generator output doesn't fit session needs | Template is adjustable, start simple and iterate |

## Testing Strategy

Each session uses the quality process we defined:
1. **Code review** — Claude runs appropriate techniques after each chunk
2. **Console instrumentation** — Add `[Concepts]` and `[StreamBrief]` prefixed logs
3. **Interactive testing** — Dave tests flow, dumps console, Claude evaluates
4. **Test plan per session** — Scenarios with console evidence mapping

---

## Key Concepts
<!-- cc-concepts scope="streams-evolution,cc-architecture,project-plan" -->
- RULE: If it can't be automated, no one will use it. Every feature must do work FOR the user.
- RULE: Streams are quality automation pipelines: Spec → Constraints → Review → Tests → Deploy.
- RULE: All new stream fields are optional — existing streams work unchanged.
- DECISION: Extend existing stream model, don't build parallel system.
- DECISION: Build in 4 sessions: data model → brief generator → UI → interactive surfacing.
- DECISION: Claude API integration is Phase 2, after manual workflow is proven.
- DECISION: Concepts are the automation core — they constrain code, generate tests, gate deploys.
- CONSTRAINT: Backward compatible — existing streams, work items, interfaces all keep working.
- PROCESS: Each session follows quality process: code review + console instrumentation + interactive test.
- OPEN: How to auto-detect which stream a session is working on.
- OPEN: When to introduce Claude API for prompt generation.
<!-- /cc-concepts -->
