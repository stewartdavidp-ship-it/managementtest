# CC Streams Evolution — From Tracking to Automation

## The Problem with Tracking

Streams today are a project management construct. You create them, assign work items, track progress. That's useful for visibility but it's manual overhead — if it doesn't automate something, nobody uses it.

## The Value Proposition

A stream becomes valuable when it does work FOR you:

1. **Design validation** — You describe what you want to build. Stream captures the spec as key concepts. When Claude starts coding, concepts constrain the work. "Did you consider X?" happens automatically.

2. **Code validation** — Code is reviewed against stream concepts. "This function doesn't handle the edge case defined in CONSTRAINT C-003." Claude runs the right review technique based on what changed.

3. **Test generation** — Stream concepts generate test scenarios automatically. "RULE: Path in zip = path in repo" becomes test T1.1 with matching console instrumentation.

4. **Test execution** — User runs through the product naturally. Console logs map back to generated test scenarios. Stream tracks which pass, which fail, which are untested.

5. **Deploy gate** — Stream knows if code review is clean, tests pass, docs exist. Deploy is gated on stream health, not human memory.

That's the automation chain: **Spec → Constraints → Code Review → Tests → Results → Deploy**

Without the stream, each step is manual and disconnected. With the stream, each step feeds the next.

---

## What Exists Today

### Current Stream Model (Firebase: `command-center/{uid}/streams`)

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

### Current Capabilities
- ✅ Work items linked via `streamId`
- ✅ Stream context included in session briefs
- ✅ Product Brief includes stream overview with progress
- ✅ Interface contracts between streams
- ✅ Dependency alerts: stream A changes interface → auto-work-item in stream B
- ✅ Stream filtering/grouping in work item views
- ✅ Full management UI in Analytics satellite

### What's Missing
- ❌ Multi-app scope (a stream can only touch one app)
- ❌ Key concepts (rules, decisions, constraints)
- ❌ Artifact tracking (docs, packages, test plans, test results)
- ❌ Session linking (sessions don't record which stream they served)
- ❌ Workstream Brief generation (compact, concept-aware)
- ❌ Concept extraction from documents
- ❌ Interactive concept surfacing ("did you consider?")
- ❌ Automated test scenario generation from concepts
- ❌ Test result tracking per stream

---

## Extended Stream Model

### Data Model Changes

```javascript
{
  // === Existing fields (unchanged) ===
  id: "S-001",
  name: "Smart Deploy v8.55",
  status: "planning",      // planning | active | testing | complete | archived
  owner: "Dave",
  goal: "Unified multi-app deploy from Dashboard with validation",
  targetRelease: "v8.55.1",
  order: 1,

  // === Extended fields ===
  
  // Multi-app scope (replaces single appId)
  appId: "command-center",        // primary app (keep for backward compat)
  appIds: ["command-center", "cc-infrastructure", "cc-quality", "cc-analytics"],
  project: "cc",                  // project scope
  
  // Key concepts — the automation core
  concepts: [
    {
      id: "C-001",
      type: "rule",               // rule | decision | constraint | process | lesson | open | fix
      text: "Path in zip = path in repo. One root wrapper allowed.",
      source: "CC_v8_55_1_SESSION_TRANSCRIPT.md",
      date: "2026-02-11",
      status: "active"            // active | superseded | resolved
    }
  ],
  
  // Artifacts produced by this stream
  artifacts: [
    {
      name: "CC_v8_55_1_TEST_PLAN.md",
      type: "test-plan",          // analysis | spec | test-plan | test-results | deploy-package | doc
      date: "2026-02-11",
      repo: "command-center",
      path: "docs/CC_v8_55_1_TEST_PLAN.md"
    }
  ],
  
  // Session history
  sessions: [
    {
      date: "2026-02-11",
      summary: "Path matching rewrite, console instrumentation, quality process",
      conceptsAdded: 5,
      testsRun: 4
    }
  ],
  
  // Test tracking
  tests: {
    plan: "CC_v8_55_1_TEST_PLAN.md",
    scenarios: [
      { id: "T1.1", name: "CC Deploy Package", status: "pass", evidence: "isMultiApp: true, 4 apps" },
      { id: "T1.2", name: "gs-active correct", status: "untested" },
      { id: "T3.1", name: "Deploy All", status: "untested" }
    ],
    coverage: { pass: 4, fail: 0, untested: 11, total: 15 }
  },
  
  // Code review status
  codeReview: {
    lastReview: "2026-02-11",
    techniques: ["scenario-walkthrough", "data-flow-trace", "dead-reference-scan"],
    issuesFound: 8,
    issuesFixed: 8,
    status: "clean"               // clean | issues-open | not-reviewed
  },
  
  // Open items (surfaced in briefs and "did you consider?" prompts)
  openItems: [
    "How should CC handle cross-project archives?",
    "Test scenarios T1.2-T5.3 still need execution"
  ],
  
  // What's next (drives session prep)
  next: "Execute interactive test plan, deploy to test environment"
}
```

### Backward Compatibility

- `appId` stays (existing work items reference it)
- `appIds` is new — if present, stream spans multiple apps
- All existing stream features (work items, interfaces, dependencies) continue working
- New fields are optional — streams without concepts just work like before

---

## The Automation Pipeline

### Stage 1: Stream Creation (Planning)

**Trigger:** User says "I want to build X"

**What happens:**
1. Stream created with name, goal, target apps
2. Initial analysis produces concepts (RULE, DECISION, CONSTRAINT, OPEN)
3. Concepts stored on stream
4. OPEN items flagged for resolution before moving to Active

**Automation:** CC generates session prep brief that includes all concepts as constraints. Claude works within these constraints from the start.

### Stage 2: Design Validation (Planning → Active)

**Trigger:** Analysis docs are produced and pushed to CC

**What happens:**
1. CC parses `<!-- cc-concepts -->` markers from pushed docs
2. New concepts auto-added to stream
3. CC checks for conflicts between new concepts and existing ones
4. If OPEN items exist: "These questions are unresolved. Resolve before starting code."

**Automation:** Concept extraction is automatic on doc push. Conflict detection compares new concepts against all active concepts (not just this stream).

### Stage 3: Code Review (Active)

**Trigger:** Code changes are made in a session

**What happens:**
1. Session brief includes stream concepts as constraints
2. Claude runs appropriate code review techniques based on what changed:
   - New feature → Scenario Walkthrough + Data Flow Trace
   - Refactor → Dead Reference Scan + Integration Point Review
   - Bug fix → Scenario Walkthrough on fixed + adjacent flows
3. Review findings logged to stream (issuesFound, issuesFixed)
4. Stream `codeReview.status` updated

**Automation:** Claude self-triggers code review based on stream concepts. "CONSTRAINT: Filter apps by subPath !== undefined" → Claude verifies every filter uses subPath, not prodRepo.

### Stage 4: Test Generation (Active → Testing)

**Trigger:** Code review is clean, package is ready

**What happens:**
1. CC generates test scenarios FROM stream concepts:
   - Each RULE becomes one or more test scenarios
   - Each CONSTRAINT becomes a boundary test
   - Each DECISION becomes a verification scenario
2. Console instrumentation requirements identified per scenario
3. Test plan stored as stream artifact

**Automation:** Test plan skeleton is auto-generated. Claude fills in details (specific console evidence, pass criteria). Each scenario links back to the concept it validates.

### Stage 5: Test Execution (Testing)

**Trigger:** Deploy package exists, test plan is ready

**What happens:**
1. User drops package in CC
2. User runs through product naturally
3. User dumps console output
4. CC (or Claude) maps console logs to test scenarios
5. Stream test coverage updated: pass/fail/untested
6. Remaining untested scenarios flagged for targeted testing

**Automation:** Console-to-scenario mapping. The `[SmartDeploy]` prefix + scenario evidence keys make this parseable.

### Stage 6: Deploy Gate (Testing → Complete)

**Trigger:** User wants to deploy

**What happens:**
1. CC checks stream health:
   - All OPEN items resolved?
   - Code review status: clean?
   - Test coverage: all pass?
   - Required docs exist?
2. If not: "Stream has N blockers. Resolve before deploying."
3. If yes: Deploy proceeds, stream status → complete
4. Concepts remain active (rules don't expire with the stream)

**Automation:** Deploy gate is automated. No human has to remember "did we test that edge case?" — the stream knows.

---

## The Workstream Brief

The brief is the compact, regenerable context that survives compaction and drives sessions.

### Generation Logic

```javascript
function generateWorkstreamBrief(stream) {
  let brief = '';
  
  // Identity
  brief += `# Stream: ${stream.name}\n`;
  brief += `Status: ${stream.status} | Project: ${stream.project}`;
  brief += ` | Apps: ${stream.appIds.join(', ')}\n\n`;
  
  // Active concepts (the constraints Claude must work within)
  const activeConcepts = stream.concepts.filter(c => c.status === 'active');
  if (activeConcepts.length > 0) {
    brief += `## Active Concepts\n`;
    activeConcepts.forEach(c => {
      brief += `- ${c.type.toUpperCase()}: ${c.text}\n`;
    });
    brief += '\n';
  }
  
  // Open items (must be resolved)
  if (stream.openItems.length > 0) {
    brief += `## Open Items\n`;
    stream.openItems.forEach(item => {
      brief += `- ${item}\n`;
    });
    brief += '\n';
  }
  
  // Test status
  if (stream.tests) {
    const t = stream.tests.coverage;
    brief += `## Test Status: ${t.pass}/${t.total} pass`;
    if (t.fail > 0) brief += `, ${t.fail} FAIL`;
    if (t.untested > 0) brief += `, ${t.untested} untested`;
    brief += '\n\n';
  }
  
  // Code review status
  if (stream.codeReview) {
    brief += `## Code Review: ${stream.codeReview.status}`;
    if (stream.codeReview.issuesFound > 0) {
      brief += ` (${stream.codeReview.issuesFixed}/${stream.codeReview.issuesFound} fixed)`;
    }
    brief += '\n\n';
  }
  
  // Last session
  const lastSession = stream.sessions[stream.sessions.length - 1];
  if (lastSession) {
    brief += `## Last Session (${lastSession.date})\n`;
    brief += `${lastSession.summary}\n\n`;
  }
  
  // Next
  if (stream.next) {
    brief += `## Next\n${stream.next}\n`;
  }
  
  return brief;
}
```

### Example Output (~30 lines)

```markdown
# Stream: Smart Deploy v8.55
Status: testing | Project: cc | Apps: command-center, cc-infrastructure, cc-quality, cc-analytics

## Active Concepts
- RULE: Path in zip = path in repo. One root wrapper allowed.
- RULE: Every test scenario must have a matching console log.
- DECISION: gs-active is dev archive, never deploy package.
- DECISION: Each app's docs in {subPath}/docs/.
- CONSTRAINT: Multi-app packages are project-scoped.
- CONSTRAINT: Filter apps by subPath !== undefined.

## Open Items
- How should CC handle cross-project archives?
- Test scenarios T1.2-T5.3 still need execution.

## Test Status: 4/15 pass, 0 FAIL, 11 untested

## Code Review: clean (8/8 fixed)

## Last Session (2026-02-11)
Path matching rewrite, console instrumentation, quality process docs, docs/ convention.

## Next
Execute interactive test plan, deploy to test environment.
```

---

## Implementation Phases

### Phase 1: Extend Data Model (Next CC version)
- Add `appIds`, `concepts`, `artifacts`, `sessions`, `tests`, `codeReview`, `openItems`, `next` to stream model
- Add `status` values: planning, active, testing, complete, archived
- Backward compatible — existing streams keep working
- Update WorkStreamService for new fields
- Update Analytics satellite UI for new fields

### Phase 2: Concept Extraction (Same version)
- Parse `<!-- cc-concepts -->` markers on doc push
- Auto-add extracted concepts to the stream that pushed the doc
- Concept management UI (view, supersede, resolve)
- Conflict detection across streams

### Phase 3: Brief Generation
- `generateWorkstreamBrief()` function in CC core
- "Copy Brief" button on stream view
- Include in session prep workflow
- Brief regeneration on demand (survives compaction)

### Phase 4: Test Tracking
- Test scenarios stored on stream
- Console log → scenario mapping (manual first, assisted later)
- Coverage dashboard per stream
- Deploy gate checks test coverage

### Phase 5: Interactive Surfacing
- "Did you consider?" dialog when starting work on a stream
- Concept conflict warnings when adding new concepts
- OPEN item prompts before status transitions

### Phase 6: Claude API Integration (Future)
- Evaluate user intent against stream concepts
- Auto-generate session prep prompts
- Constraint-aware code review prompts
- Auto-generate test scenario skeletons from concepts

---

## What This Replaces

| Today | Tomorrow |
|-------|----------|
| Manual session prep (re-explain everything) | Workstream Brief (30 lines, all decisions) |
| Concepts lost in long documents | Concepts extracted, stored, surfaced automatically |
| Code review when remembered | Code review triggered by stream stage + what changed |
| Test plan written manually | Test scenarios generated from concepts |
| Test results tracked in markdown | Test coverage on stream, deploy-gated |
| "Did we decide X?" | Concept lookup, conflict detection |
| Deploy when it feels ready | Deploy when stream health checks pass |

---

## Key Concepts
<!-- cc-concepts scope="streams,cc-architecture,automation" -->
- RULE: If it can't be automated, no one will use it. Streams must do work FOR the user.
- RULE: The stream is a quality automation pipeline: Spec → Constraints → Review → Tests → Results → Deploy.
- RULE: Concepts are the automation core — they constrain code, generate tests, gate deploys.
- DECISION: Extend existing stream model, don't build a parallel system.
- DECISION: Streams are multi-app via appIds[] (backward compat with single appId).
- DECISION: Workstream Brief replaces manual session prep (~30 lines, regenerable).
- DECISION: Deploy is gated on stream health (review clean, tests pass, docs exist, OPEN items resolved).
- CONSTRAINT: All new stream fields are optional — existing streams work unchanged.
- PROCESS: Doc push triggers concept extraction → concepts auto-added to stream.
- PROCESS: Code review technique is selected based on what changed + stream stage.
- PROCESS: Test scenarios are generated from concepts (each RULE/CONSTRAINT becomes a test).
- LESSON: Streams as tracking tools = 0 value. Streams as automation pipelines = high value.
- OPEN: How to auto-detect which stream a session is working on.
- OPEN: When to introduce Claude API for prompt generation vs manual brief copy.
<!-- /cc-concepts -->
