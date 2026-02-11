# CC Development Quality Process

## Two-Part Testing: Code Review + Interactive Testing

Development quality has two distinct phases that happen at different points in the lifecycle. They are complementary — code review catches logic bugs before the UI exists, interactive testing catches integration and UX issues after.

---

## Part 1: Code Review (Claude performs, no user action needed)

Code review is performed BY Claude ON the code, using specific techniques matched to what just changed. No UI, no browser, no deployment. Just reading code and tracing paths.

### When It Happens

| Lifecycle Point | Techniques to Run | Trigger |
|----------------|-------------------|---------|
| **After feature implementation** | Scenario Walkthrough + Data Flow Trace | New function, new flow, new state |
| **After refactor** | Dead Reference Scan + Integration Point Review | Deleted/moved code, renamed functions |
| **Before packaging** | Boundary/Edge Case Audit + State Machine Audit | About to create deploy zip |
| **After bug fix** | Scenario Walkthrough (fixed flow + adjacent flows) | Bug fix committed |

### Technique Reference

**1. Scenario Walkthrough** (highest hit rate)
- Pick a user action, trace every code path line by line
- Template: Scenario → Setup → Expected → Code Walkthrough → Issue Found
- Success example: Rush Schedule — 16 scenarios found 3 real bugs

**2. Data Flow Trace** (second highest)
- Pick a piece of data, follow it from creation through every transformation to final use
- Best for: data crossing function boundaries, storage boundaries, or 3+ transformations
- Success example: file path through zip → root strip → subPath match → repo assignment

**3. Dead Reference Scan** (100% hit rate after refactors)
- `grep` for every removed identifier: function names, variable names, CSS classes
- Non-negotiable after any deletion or rename
- Success example: Every refactor session found orphaned references

**4. Integration Point Review**
- Examine each boundary where two systems connect
- Check assumptions on both sides: does the producer match what the consumer expects?
- Success example: `prodRepo || testRepo` filter vs empty-string repos

**5. Boundary/Edge Case Audit**
- Empty inputs, null/undefined, first-time user, max values, midnight wraparound
- Success example: midnight schedule wraparound, empty zip, single file vs multi-app

**6. State Machine Audit**
- List all states, verify every transition has a handler, every state has an exit
- Success example: deploy lifecycle missing error-state cleanup

### How to Invoke

Claude should self-trigger these based on what just happened. But you can also request:
- "Walk the deploy flow" → Scenario Walkthrough
- "Trace how the version gets from zip to commit" → Data Flow Trace
- "Check for dead references after the refactor" → Dead Reference Scan
- "What happens at the edges?" → Boundary Audit

### Output Format

Code review results are documented inline during the session. Key findings get:
- **Issue number and description**
- **Line reference**
- **Severity** (blocks deploy, causes data loss, cosmetic)
- **Fix** (implemented immediately or noted for later)

---

## Part 2: Interactive Testing (Claude + User collaboration)

Interactive testing uses the ACTUAL product with REAL data. Claude prompts test scenarios, user executes, user brings back evidence, Claude evaluates.

### The Flow-Based Approach

Rather than testing one scenario at a time (too slow), the user runs through the product naturally. The key enabler: **console instrumentation**.

**Rule: Every test scenario MUST have a matching console log.** No log = no test. This is verified at test plan creation time.

### Console Instrumentation Pattern

All test-relevant events log with a consistent prefix:
```
[SmartDeploy] isMultiApp: true
[SmartDeploy] App: command-center → test | 1 deploy, 5 docs | v8.55.1
[SmartDeploy] Validation: warning — 4 ready, 1 warning
[ConfigMigration] Added new app: cc-infrastructure (project: cc)
```

**When building a feature, instrument decision points at build time — not as an afterthought.**

### Test Plan Structure

```markdown
## Suggested Test Flows
Flow A: [Natural user path that covers multiple scenarios]
  - Covers: T1.1, T2.1, T2.2, T4.1

## Test Scenarios (with console evidence mapping)
| ID | Scenario | Console Evidence |
|----|----------|-----------------|
| T1.1 | Multi-app package | [SmartDeploy] isMultiApp: true + App: lines |
```

### The Process

1. **Claude creates test plan** with flows + scenario mapping + console evidence keys
2. **User executes a flow** (natural product usage)
3. **User copies console output** (one dump covers many scenarios)
4. **Claude maps logs to scenarios** — marks pass/fail from evidence
5. **Remaining gaps identified** — Claude prompts targeted tests for uncovered scenarios
6. **Results compiled** into test report artifact for CC

### When It Happens

After code review is clean and a deploy package exists. Interactive testing validates the built artifact, not the source code.

---

## Integration with CC Workflow

### Development Cycle

```
1. DEVELOP
   Claude writes/modifies code
   
2. CODE REVIEW (Part 1)
   Claude runs appropriate techniques based on what changed
   Bugs found → fix → re-review
   
3. PACKAGE
   Create deploy zip with correct structure
   Instrumentation already in place from step 1
   
4. INTERACTIVE TEST (Part 2)
   User loads package in CC
   User runs through natural flows
   User brings back console dumps
   Claude evaluates against test plan
   
5. FIX & ITERATE
   Issues found → fix → re-package → re-test targeted scenarios
   
6. DEPLOY
   All tests pass → Deploy via CC
   
7. VERIFY
   Post-deploy monitoring confirms version is live
```

### What Lives in CC

- **Test Plan** (markdown) — pushed as a doc with the deploy package
- **Test Results** (markdown) — filled in during interactive testing, pushed after completion
- **Code Review Methodology** (reference doc) — permanent reference

## Key Concepts
<!-- cc-concepts scope="testing,quality,workflow" -->
- RULE: Every test scenario MUST have a matching console log — no log = no test.
- RULE: Console instrumentation is added at BUILD time, not as an afterthought.
- RULE: All test-relevant events use a consistent prefix (e.g., [SmartDeploy]).
- PROCESS: Code review happens BEFORE interactive testing — different techniques for different lifecycle points.
- PROCESS: Interactive testing is flow-based — user runs naturally, dumps console, Claude maps to scenarios.
- PROCESS: Scenario Walkthrough and Data Flow Trace have the highest bug-finding rates.
- PROCESS: Dead Reference Scan is mandatory after every refactor — 100% hit rate historically.
- DECISION: One app = one deploy package. No cross-project mega-archives.
- DECISION: gs-active is a development archive for session continuity, NOT a deploy package.
- DECISION: Each app has a docs/ subfolder at its subPath root ({subPath}/docs/CONTEXT.md).
- DECISION: Project-level docs live at repo root docs/ (style guides, architecture).
- CONSTRAINT: Multi-app deploy packages are project-scoped — all apps must share repo(s).
- CONSTRAINT: Path in zip = path in repo. One root wrapper allowed.
- CONSTRAINT: Deploy packages must include docs/CONTEXT.md and docs/CHANGELOG.md per app.
- OPEN: When to integrate Claude API into CC for prompt generation.
- OPEN: How to handle cross-project archives if ever needed.
<!-- /cc-concepts -->

---

## Package Architecture (Revised)

### Principle: One App = One Package

Each app is an independent deployable unit. No massive archives that span projects.

### Docs Convention

Every app has a `docs/` subfolder relative to its own root. Project-level docs live at repo root `docs/`.

```
gameshelf repo:
  app/                    ← Game Shelf (subPath: 'app')
    index.html
    sw.js
    docs/
      CONTEXT.md
      CHANGELOG.md
      RELEASE_NOTES.txt
  rungs/                  ← Rungs (subPath: 'rungs')
    index.html
    sw.js
    docs/
      CONTEXT.md
      CHANGELOG.md
  quotle/                 ← Quotle (subPath: 'quotle')
    index.html
    docs/
      CONTEXT.md
  docs/                   ← Project-level docs (repo root)
    STYLE_GUIDE.md
    ARCHITECTURE.md
```

### App Deploy Package (what CC consumes)

```
quotle-deploy-v1.2.10/
  index.html
  sw.js
  manifest.json
  icons/
  docs/
    CONTEXT.md
    CHANGELOG.md
    RELEASE_NOTES.txt
```

Files in `docs/` are classified as `push-doc` — committed to the repo but not "deployed" as live site content. CC validates that required docs (CONTEXT.md, CHANGELOG.md) exist by checking basenames, so `docs/CONTEXT.md` satisfies the `CONTEXT.md` requirement.

**Multi-App Deploy Package** (project-scoped):
```
cc_smart_deploy_v8_55_1/
  index.html                    ← command-center (subPath: '')
  infrastructure/index.html     ← cc-infrastructure
  quality/index.html            ← cc-quality
  analytics/index.html          ← cc-analytics
  shared/cc-shared.css          ← shared files
  docs/
    CHANGELOG.md                ← project-level docs
```

Path in zip = path in repo. One root wrapper allowed. All apps within ONE project's repos.

### What About gs-active?

gs-active becomes a **development archive** — a snapshot of all source code for session continuity. It is NOT a deploy package. Claude reads it for context, works on individual apps, then produces app-specific deploy packages.

```
gs-active/ (development archive — NOT for deploy)
  gameshelf/        ← source for Game Shelf app (includes docs/)
  quotle/           ← source for Quotle (includes docs/)
  slate/            ← source for Slate (includes docs/)
  ...
  CONTEXT.md        ← master versions file (archive-level)
```

### Project-Level Documentation

Cross-app docs (style guides, architecture decisions, system design) live at repo root `docs/`. They travel with the repo, not with individual app packages. Claude uses them for development context; CC doesn't need to deploy them.
