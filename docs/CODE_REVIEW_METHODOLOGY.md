# Code Review Methodology — What Works

## Analysis of Past Sessions

Reviewed 15+ sessions where code walkthroughs found real bugs. The most effective techniques, ranked by bug-finding success:

---

## Tier 1: Highest Bug-Finding Rate

### 1. Scenario Walkthrough (User Story Trace)
**What it is:** Pick a specific user action and trace every code path it touches, line by line.
**Why it works:** Forces you to follow the ACTUAL execution path, not what you assume happens. Catches state that's never set, functions that are never called, and conditions that don't cover edge cases.

**Best examples:**
- **Rush Schedule** (Session Jan 31): Walked 16 scenarios. Found 3 real bugs: cloud sync missing after dismiss, lastStartedDate not updated from quick start, dead function never called.
- **Group Rush** (Session Feb 1): Walked invite code → countdown → start. Found: no uniqueness check, race condition between creator/joiner, join blocked during grace period.

**When to use:** After implementing any feature with user-facing flows. Especially anything with state machines, multi-step processes, or real-time interactions.

**Template:**
```
Scenario: [User action description]
Setup: [Starting state]
Expected: [What should happen]

Code Walkthrough:
- Step 1: [function] at line [N] → [what it does] ✅/❌
- Step 2: [next function] → [what it does] ✅/❌

ISSUE FOUND: [or None]
```

### 2. Data Flow Trace
**What it is:** Pick a piece of data (version, config, file path) and trace it from creation through every transformation to final use.
**Why it works:** Catches mismatches between where data is set and where it's consumed. Especially effective for data that crosses function boundaries or gets stored/retrieved.

**Best examples:**
- **Validation redesign** (Session Feb 10): Traced `primaryApp`, `deployTarget`, `appConfig` through extraction → staging → validation → deploy. Found: validation ran in wrong lifecycle hook, data not available when needed.
- **resolveZipContents** (This session): Traced file paths through root strip → subPath matching → repo assignment. Found: `command-center/` wrapper breaking all path matching.
- **Config migration** (This session): Traced how `apps` object is built from seed + localStorage. Found: new seed apps never injected into existing installs.

**When to use:** Anytime data passes through 3+ functions or crosses a storage boundary (localStorage, Firebase, URL params).

### 3. State Machine Audit
**What it is:** List all possible states, then verify every transition has a handler and every state has an exit.
**Why it works:** Missing transitions = silent failures. Unreachable states = dead code or stuck UI.

**Best examples:**
- **Rush lifecycle** (active → paused → completed → abandoned): Found pause button not hidden in group mode.
- **Deploy flow** (staged → validating → deploying → complete): Found deploying state never cleared on error.

**When to use:** Features with distinct states (modals, wizards, async processes, lifecycle management).

---

## Tier 2: Medium Bug-Finding Rate

### 4. Boundary/Edge Case Audit
**What it is:** Test the extremes: empty inputs, max values, midnight wraparound, first-time vs returning user, offline/online transitions.
**Why it works:** Happy path is usually fine. Bugs hide at boundaries.

**Best examples:**
- Midnight wraparound in schedule checking (worked correctly, but worth verifying).
- Empty zip, docs-only zip, single file vs multi-app zip.
- First load with empty localStorage vs existing config (found migration gap).

**When to use:** Any function with numeric ranges, date/time logic, or optional parameters.

### 5. Integration Point Review
**What it is:** Look at every place two systems connect (localStorage ↔ runtime, Firebase ↔ local state, zip extraction ↔ staging, config ↔ UI).
**Why it works:** Each system makes assumptions about the other. Mismatched assumptions = bugs.

**Best examples:**
- `prodRepo || testRepo` filter excluding apps with empty string repos (this session).
- `contentDetectedFolders` key collision when multiple files share a directory prefix.
- Firebase `currentUser.odometerId` undefined (should be `.uid`).

**When to use:** After any refactor that changes how components communicate.

### 6. Dead Reference Scan
**What it is:** After refactoring, grep for every reference to removed code. Check for orphaned state, unused imports, broken function calls.
**Why it works:** Refactors leave ghosts. A deleted function that's still called = runtime crash.

**Best example:**
- After removing SmartDeployView: checked for `pendingGsActiveFile`, `SmartDeployView`, `contentDetectedFolders`, `secondPrefix` — all clean.
- Missing `/**` JSDoc opener after deleting old `resolveZipContents` — broke Babel parsing.

**When to use:** After EVERY refactor or deletion. Non-negotiable.

---

## Tier 3: Useful but Lower Hit Rate

### 7. Full File Review
**What it is:** Read the entire file looking for anything wrong.
**Why it works:** Catches structural issues, truncated files, missing closing tags, version mismatches across multiple locations.

**Best examples:**
- Beta Hub: found truncated file (cut off mid-string), broken JS line, missing `escapeHtml` function, version mismatches between meta tag and footer.
- LabelKeeper: found missing error handling in AI generation.

**When to use:** When reviewing code you didn't write, or haven't looked at in a while.

### 8. Blind sed/Replace Audit
**What it is:** After any find-and-replace operation, verify it didn't have unintended collateral damage.
**Why it works:** Global replaces in large files are dangerous. A version string might appear in comments, validation code, or display strings.

**Best example:**
- Session Feb 10: Global `8.36.4 → 8.36.5` replacement. Got lucky — only hit the meta tag. But could have corrupted validation function comments.

**When to use:** After every `sed` or `str_replace` on a file >1000 lines.

---

## Recommended Code Lifecycle Checkpoints

### Checkpoint 1: After Feature Implementation (Pre-Test)
Run: **Scenario Walkthrough** + **Data Flow Trace**
- Walk the primary user flows
- Trace key data from input to output
- Goal: catch logic bugs before the UI is even tested

### Checkpoint 2: After Refactor (Pre-Test)  
Run: **Dead Reference Scan** + **Integration Point Review**
- Grep for all removed identifiers
- Verify all connection points still work
- Goal: catch breakage from structural changes

### Checkpoint 3: Before Packaging (Pre-Deploy)
Run: **Boundary/Edge Case Audit** + **State Machine Audit**
- Test the extremes
- Verify all state transitions
- Goal: catch edge cases the happy path missed

### Checkpoint 4: After Bug Fix (Regression)
Run: **Scenario Walkthrough** on the fixed flow + **adjacent flows**
- Re-walk the bug scenario to confirm fix
- Walk 2-3 related scenarios to check for regressions
- Goal: confirm fix doesn't break neighbors

---

## Anti-Patterns (What Doesn't Work)

1. **Generating test documents instead of reading code** — Writing a test plan document is NOT the same as walking the code. The value is in the LINE-BY-LINE trace.

2. **Reviewing code you just wrote** — Fresh eyes catch more. Review after a break or context switch.

3. **Only checking the happy path** — The #1 source of bugs is "what happens when X is empty/null/undefined."

4. **Trusting assumptions about data** — "This field should always be set" → grep and verify.

5. **Skipping the dead reference scan after refactors** — This has caught bugs EVERY time.

---

## Key Concepts
<!-- cc-concepts scope="code-review,quality" -->
- RULE: Scenario Walkthrough traces actual execution paths line by line — not assumptions.
- RULE: Data Flow Trace follows data from creation through every transformation to final use.
- RULE: Dead Reference Scan after every refactor — grep for all removed identifiers. Non-negotiable.
- RULE: Never trust assumptions about data — grep and verify field existence.
- RULE: Integration Point Review checks both sides of every boundary for matching assumptions.
- PROCESS: After feature → Scenario Walkthrough + Data Flow Trace.
- PROCESS: After refactor → Dead Reference Scan + Integration Point Review.
- PROCESS: Before packaging → Boundary/Edge Case Audit + State Machine Audit.
- PROCESS: After bug fix → Scenario Walkthrough on fixed flow + 2-3 adjacent flows.
- LESSON: Generating test documents is NOT the same as walking code line by line.
- LESSON: The #1 source of bugs is "what happens when X is empty/null/undefined."
- LESSON: Global find-and-replace in large files needs post-replace audit for collateral damage.
<!-- /cc-concepts -->
