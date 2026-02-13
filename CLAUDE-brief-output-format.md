# CLAUDE.md — Session Brief Output Format Enrichment
# cc-spec-id: sp_brief_output_format
# App: Command Center (index.html)
# Base version: (current)
# Target version: +0.0.1
# Depends on: Ideation pipeline must be implemented (IdeationBriefGenerator exists in index.html)

---

## Task Summary

Update the IdeationBriefGenerator's SYSTEM_PROMPT and the Expected Output Format section it produces in session briefs. The current format instructs Claude Chat to produce a minimal ODRC update block. The new format teaches Chat to produce rich, structured session documents that CC can fully ingest — including a 6-line header block, substantive ODRC update lines with rationale, and a Session Notes section with narrative, design principles, and status.

**This is a prompt/template update — no new features, no new services, no UI changes.**

---

## The Problem

The current Expected Output Format in generated briefs produces this:

```
## ODRC Updates
# Idea: {idea-slug}
# Session: {session-number}
# App: {app-id}

- NEW DECISION: "description"
- NEW OPEN: "description"
- RESOLVE OPEN: "description" → matched to concept_id {id}
```

Chat follows these instructions literally and produces terse output missing:
- The full 6-line header block (no date, no context summary, no session description)
- Substantive descriptions with rationale (gets one-line labels instead)
- NEW RULE and NEW CONSTRAINT line types (not shown in the template)
- The entire Session Notes section (What Was Accomplished, Key Design Principles, Session Status)

---

## What Good Output Looks Like

Reference file: `ODRC-Updates-Ideation-Session-2-2026-02-12-2.md`

**Header block:**
```
# ODRC Updates — {Idea Display Name}
# Date: {YYYY-MM-DD}
# Session: {N} ({short session description})
# Idea: {idea-slug}
# App: {app-id}
# Context: {one-line summary of what this session accomplished}
```

**ODRC update lines** — each is 1-2 sentences with rationale:
```
- NEW DECISION: "Session handshake prompt is a standardized constant with three variable slots (idea name, session number, app name) — prevents behavioral drift from ad-lib framing that changes session behavior"
```

**Session Notes section:**
```
## Session Notes

### What Was Accomplished
{narrative paragraph}

### Key Design Principles Established
{bulleted themes}

### Session Status
{concept counts, phase assessment, next session recommendation}
```

---

## What to Change

### B1: Update SYSTEM_PROMPT in IdeationBriefGenerator

Find the `SYSTEM_PROMPT` property in `IdeationBriefGenerator`. It contains a multi-line string that instructs the AI how to generate the session brief markdown.

Find the Expected Output Format instruction. It currently reads approximately:

```
- Expected Output Format — the ODRC Updates format with header metadata block:
  ## ODRC Updates
  # Idea: {idea-slug}
  # Session: {session-number}
  # App: {app-id}
  Followed by lines using: NEW DECISION/OPEN/RULE/CONSTRAINT and RESOLVE OPEN formats
```

Replace with:

```
- Expected Output Format — provide the COMPLETE output specification including:
  (a) Header block with all six metadata lines: title with idea display name, date (YYYY-MM-DD), session number with short description, idea slug, app ID, and a one-line context summary of what the session should accomplish
  (b) ODRC Updates section showing all five line types with examples that demonstrate substantive descriptions with rationale:
      - RESOLVE OPEN: "original open text" → resolution with rationale
      - NEW DECISION: "what was decided AND why — enough context to understand the decision standalone"
      - NEW OPEN: "specific actionable question — not vague"
      - NEW RULE: "behavioral principle governing future work"
      - NEW CONSTRAINT: "hard boundary — technology, scope, policy"
  (c) Session Notes section with three subsections: What Was Accomplished (narrative paragraph), Key Design Principles Established (bulleted themes that emerged), Session Status (concept counts by type, phase assessment, what the next session should focus on)
  Show the complete format as a copyable template the developer can reference during the session.
```

### B2: Update the Expected Output Format section in generated brief markdown

The SYSTEM_PROMPT generates markdown that includes an Expected Output Format section. After the SYSTEM_PROMPT change (B1), the AI will generate richer output format instructions. Verify that a generated brief now includes:

1. The full 6-line header block template with all variable slots
2. All five ODRC line types with example descriptions showing rationale
3. Guidelines for writing substantive descriptions
4. The complete Session Notes section template with all three subsections

If the AI-generated output still doesn't consistently include all of these, add a static fallback template in the `generate()` method that appends the Expected Output Format section directly to the brief markdown, bypassing the AI for this specific section. This ensures format consistency even if the AI summarizes or shortens the instructions.

---

## Existing Infrastructure Reference

| Component | Location | What to Change |
|-----------|----------|---------------|
| IdeationBriefGenerator.SYSTEM_PROMPT | index.html (search for `IdeationBriefGenerator`) | Replace Expected Output Format instruction text |
| IdeationBriefGenerator.generate() | Same object | Potentially add static fallback for output format section |
| ODRCUpdateIngestionService | index.html | No changes — already parses all five line types and header metadata |
| Session brief markdown output | Generated at runtime | Verify output includes enriched format after SYSTEM_PROMPT change |

---

## Architecture Rules

### Prompt Engineering Rules
- The SYSTEM_PROMPT is the single source of truth for brief structure — do not duplicate format logic elsewhere
- If a static fallback is added for the output format section, it should be clearly marked as a fallback and should match the SYSTEM_PROMPT instructions exactly
- The handshake prompt (getHandshakePrompt) is NOT changed by this task — it remains a fixed 3-variable constant

### Compatibility Rules
- The enriched output format must remain parseable by ODRCUpdateIngestionService — same line prefixes (NEW DECISION:, RESOLVE OPEN:, etc.), same header metadata lines (# Idea:, # Session:, # App:)
- The Session Notes section is for human and archival use — CC does not parse it programmatically, so its structure is flexible
- The # Date: and # Context: header lines are new additions — they are informational and do not need to be parsed by the ingestion service at this time

---

## File Structure

```
cc/
  index.html                       ← SYSTEM_PROMPT update in IdeationBriefGenerator
  specs/
    sp_brief_output_format.md      ← This CLAUDE.md archived after completion
```

---

## Testing

1. Generate a session brief for any existing Idea using the "Explore in Chat" flow
2. Verify the Expected Output Format section in the generated brief includes:
   - Full 6-line header block template
   - All five ODRC line types with substantive example descriptions
   - Session Notes section with all three subsections
3. Copy the generated brief and handshake prompt into a new Claude Chat session
4. Run a short test conversation and request the ODRC output
5. Verify Chat produces output matching the enriched format — not the old minimal format

---

## Post-Task Obligations

RULE: Before reporting this task as complete:

1. Verify a generated brief contains the enriched Expected Output Format section
2. Verify ODRCUpdateIngestionService still parses enriched output correctly (same line patterns)
3. Commit all code changes
4. Archive this CLAUDE.md to `cc/specs/sp_brief_output_format.md`
5. Generate completion file to `.cc/completions/`
6. Commit spec archive and completion file separately

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_brief-output-format.md`

**Completion file format:**

```yaml
---
task: "Enrich IdeationBriefGenerator SYSTEM_PROMPT and Expected Output Format — add 6-line header block, all five ODRC line types with examples, and Session Notes section template"
status: complete | partial
cc-spec-id: sp_brief_output_format
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{any decisions}"
  new_opens:
    - "{any questions}"
unexpected_findings:
  - "{anything unexpected}"
unresolved:
  - "{anything not completed}"
---

## Approach

{Brief narrative}

## Implementation Notes

{Key details}
```

Do not wait for the developer to ask. Generate the completion file automatically after committing code.
