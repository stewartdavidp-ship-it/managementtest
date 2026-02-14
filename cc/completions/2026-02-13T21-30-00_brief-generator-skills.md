---
task: "Update IdeationBriefGenerator and ExploreInChatModal to produce lean briefs referencing claude.ai skills instead of embedding behavioral instructions inline"
status: complete
cc-spec-id: feat_brief_generator_skills
files:
  - path: "index.html"
    action: modified
commits: []
odrc:
  new_decisions:
    - "Skills-based briefs supersede the sp_brief_output_format spec — that spec is now obsolete since skills handle output format instead of the brief"
  resolved_opens: []
  new_opens:
    - "Should CLAUDE-brief-output-format.md be removed from the repo since it is superseded by skills-based briefs?"
    - "Should lens/mode selections persist across modal opens (e.g., stored per-idea in Firebase)?"
unexpected_findings:
  - "The sp_brief_output_format spec (CLAUDE-brief-output-format.md) was already present in the repo but had not been implemented — the skills spec supersedes it entirely"
  - "The exploration system prompt had already been enriched with the output format spec content (7-line header, all 5 ODRC line types, Session Notes) in a prior version — all of this was stripped in favor of the skills directive"
unresolved: []
---

## Approach

Updated the IdeationBriefGenerator to produce lean, context-only briefs that reference six pre-loaded claude.ai skills instead of embedding ODRC definitions, output format templates, and session protocol inline. Added Lens (domain focus) and Mode (examination style) selection to the ExploreInChatModal UI, allowing developers to configure each session's analytical perspective.

## Implementation

### B1: LENS/MODE Constants
Added four constant objects before IdeationBriefGenerator:
- `LENS_OPTIONS` — 5 domain lenses (technical, economics, competitive, customer, operational)
- `MODE_OPTIONS` — 4 examination modes (exploration, stress-test, spec, review)
- `LENS_DESCRIPTIONS` — Short descriptions for embedding in skills directives
- `MODE_DESCRIPTIONS` — Short descriptions for embedding in skills directives

### B2: getSessionConfig() and getDefaultMode()
New methods on IdeationBriefGenerator for computing session configuration from idea state and selected lens/mode. Default modes: exploration→exploration, spec→spec, claude-md→null.

### B3: getSystemPrompt() — Stripped Embedded Instructions
All three system prompt cases (exploration, spec, claude-md) rewritten:
- **Exploration:** Removed ~25 lines of ODRC output format specification. Now instructs AI to generate context-only brief with Skills Directive and Session Metadata sections.
- **Spec:** Removed embedded output format. Added Skills Directive reference.
- **CLAUDE.md:** Kept the locked CLAUDE.md template (session-type-specific). Removed output format instructions, replaced with skill reference.

### B4: generate() — Accepts lens/mode
Added `lens` and `mode` parameters, computes `effectiveMode` from mode or default, passes both through to `buildUserMessage()` and `buildTemplateBrief()`.

### B5: buildUserMessage() — Skills Directive
Added Skills Directive block to the user message sent to the AI, listing the 4 core skills plus any selected lens/mode skills.

### B6: buildTemplateBrief() — Skills Directive Replaces Expected Output Format
Removed the entire Expected Output Format section (~26 lines including the ODRC template code block). Replaced with:
- Skills Directive section listing 4 core skills + optional lens/mode skills
- Session Metadata section with idea slug, IdeaId, app ID, session number

### B7: getHandshakePrompt() — References Skills
Simplified from session-type-aware prompt to a universal skills-reference prompt. Now instructs Chat to read skills from the Skills Directive section.

### B8: ExploreInChatModal — Lens/Mode Dropdowns
Added:
- `selectedLens` state (default: null)
- `selectedMode` state (default: from getDefaultMode)
- useEffect dependency on `selectedLens` and `selectedMode` — brief regenerates on change
- Config panel between header and brief preview with two dropdowns
- Skills Directive summary text below dropdowns when lens/mode selected

## Verification

- 34/34 Playwright tests pass
- Version bumped to 8.65.2
- App loads successfully in headless browser with no Babel errors
