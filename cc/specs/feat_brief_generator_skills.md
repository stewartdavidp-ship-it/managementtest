# CLAUDE.md — Brief Generator Skills-Based Update
# cc-spec-id: feat_brief_generator_skills
# App: Command Center (index.html)
# Base version: 8.64.1
# Target version: +0.0.1
# Depends on: none

---

## Task Summary

Update `IdeationBriefGenerator` and `ExploreInChatModal` to produce lean briefs that reference claude.ai skills instead of embedding behavioral instructions inline. Six custom skills (cc-odrc-framework, cc-session-structure, cc-artifact-manifest, cc-post-session-package, cc-lens-technical, cc-mode-exploration) are now loaded in the developer's claude.ai Settings. The brief no longer needs to carry ODRC definitions, output format templates, or session protocol — skills handle that. The brief becomes pure context: idea state, ODRC concepts, session metadata, and a Skills Directive telling Chat which skills to read.

---

## What's Changing

**Location:** `IdeationBriefGenerator` (~line 2999) and `ExploreInChatModal` (~line 15583)

The current brief embeds ~25 lines of ODRC output format specification and behavioral instructions in every generated brief. With skills loaded in claude.ai, this is redundant — it wastes context window tokens and creates maintenance drift between brief instructions and skill definitions.

Additionally, the current flow has no way to select a lens (what domain to examine) or mode (how to examine it). These are now skill-driven concepts that need UI exposure.

---

## What to Build

### B1: Lens/Mode Constants

Add near `IdeationBriefGenerator` (after line ~2997):

```javascript
const LENS_OPTIONS = {
    technical: 'Technical — feasibility, architecture, dependencies, implementation risk',
    economics: 'Economics — cost structure, pricing, ROI, resource requirements',
    competitive: 'Competitive — differentiation, market positioning, alternatives',
    customer: 'Voice of Customer — problem-solution fit, friction, adoption',
    operational: 'Operational — maintenance, scaling, support'
};

const MODE_OPTIONS = {
    exploration: 'Exploration — open discovery, surface OPENs, make early Decisions',
    'stress-test': 'Stress Test — challenge mode, find gaps, validate Decisions',
    spec: 'Spec — convergence, resolve OPENs, establish Rules and Constraints',
    review: 'Review — evaluate completeness and readiness'
};

const LENS_DESCRIPTIONS = {
    technical: 'Probes feasibility, architecture, and implementation risk',
    economics: 'Probes cost structure, pricing, and economic viability',
    competitive: 'Probes differentiation, market position, and alternatives',
    customer: 'Probes user needs, problem-solution fit, and adoption friction',
    operational: 'Probes maintenance, scaling, and operational support'
};

const MODE_DESCRIPTIONS = {
    exploration: 'Open discovery focused on surfacing OPENs and early Decisions',
    'stress-test': 'Challenge mode focused on finding gaps and validating Decisions',
    spec: 'Convergence focused on resolving OPENs and locking down Rules/Constraints',
    review: 'Evaluative mode confirming completeness and build-readiness'
};
```

### B2: New getSessionConfig() Method

Add to `IdeationBriefGenerator` object:

```javascript
getSessionConfig(idea, concepts, selectedLens, selectedMode) {
    const sessionType = this.getSessionType(idea, concepts);
    return {
        sessionType,
        lens: selectedLens || null,
        mode: selectedMode || this.getDefaultMode(sessionType)
    };
},

getDefaultMode(sessionType) {
    switch (sessionType) {
        case 'spec': return 'spec';
        case 'claude-md': return null;
        default: return 'exploration';
    }
},
```

### B3: Update getSystemPrompt() — Strip Embedded Instructions

**Location:** ~line 3010

Replace all three system prompt cases. The key change: remove all ODRC format definitions and output template specifications. Skills handle that now.

**Exploration case (replace the `default:` block starting ~line 3108):**

```javascript
default: // exploration
    return `You are generating a lean session brief for a Claude Chat ideation session.
The developer has skills loaded in claude.ai that handle ODRC framework, session structure, output format, and session protocol. The brief should NOT repeat ODRC definitions, output templates, or behavioral instructions — skills handle all of that.

Generate a markdown document with ONLY these sections:
- Session header (idea name, app, session number, phase)
- Skills Directive — list the specific skills to read (provided in the user message)
- Session Goal — "What are you looking to get out of today's session?"
- Idea Summary — what this idea is about
- Prior Session Summary — if sessions exist, summarize the most recent
- Current ODRC State — all active concepts grouped by type (OPEN, DECISION, RULE, CONSTRAINT)
- Session Metadata — idea slug, IdeaId, app ID, session number (needed for ODRC output routing)

Keep the brief focused on CONTEXT, not INSTRUCTIONS. The skills provide all instructions.`;
```

**Spec case (replace ~line 3012-3032):**

```javascript
case 'spec':
    return `You are generating a lean session brief for a SPECIFICATION session.
The idea has reached spec-ready status. The developer has skills loaded that handle ODRC framework and session protocol.

Generate a markdown document with these sections:
- Session header (idea name, app, session number, phase: spec-ready)
- Skills Directive — list the specific skills to read (provided in the user message)
- Spec Goal — what the specification should cover
- Idea Summary
- Current ODRC State — all active concepts grouped by type, highlighting any remaining OPENs that must be resolved
- Session Metadata — idea slug, IdeaId, app ID, session number

Do NOT embed ODRC output format definitions — skills handle that.`;
```

**CLAUDE.md case (replace ~line 3034-3106):** Keep the locked CLAUDE.md template in this prompt — that template is specific to CLAUDE.md generation sessions and does not belong in a skill. Only remove the ODRC output format instructions that are now in skills.

```javascript
case 'claude-md':
    return `You are generating a session brief for a CLAUDE.md GENERATION session.
A specification already exists for this idea. Generate a brief that instructs Chat to:
1. Review the specification
2. Produce a CLAUDE.md file following the LOCKED TEMPLATE below
3. Include all implementation details from the spec
4. Validate line references against the codebase (if included)
5. Include ODRC Updates section at the end (format defined in cc-odrc-framework skill)

LOCKED CLAUDE.md TEMPLATE — Chat MUST follow this structure:
\`\`\`
# CLAUDE.md — {Task Name}
# cc-spec-id: {spec_id}
# App: {app_name} (index.html)
# Base version: {current_version}
# Target version: {next_version}
# Depends on: {dependencies}

---

## Before You Begin
{Scope assessment prompt — ask Code if this should split into phases}

---

## Task Summary
{What to build, in 2-3 sentences}

---

## What to Build
{Detailed implementation sections with code examples, organized by phase if applicable}

---

## Existing Infrastructure Reference
{Table of components, locations, and what they do}

---

## Architecture Rules
### State Management Rules
### Data Flow Rules

---

## Conventions
{Project-specific conventions — slug formats, naming, patterns}

---

## File Structure
{What files are created/modified}

---

## Post-Task Obligations
RULE: Before reporting this task as complete:
1. Commit all code changes
2. Archive this CLAUDE.md to cc/specs/{spec_id}.md
3. Generate completion file to .cc/completions/
4. Commit spec archive and completion file separately

Completion file format:
{Inline YAML template with all required fields}
\`\`\`

Generate a markdown document with these sections:
- Session header (idea name, app, session number)
- Skills Directive — list skills to read
- CLAUDE.md Generation Goal
- Idea Summary
- Current ODRC State
- Session Metadata`;
```

### B4: Update generate() — Accept lens/mode

**Location:** ~line 3134

```javascript
async generate(idea, app, concepts, globalConcepts, lens = null, mode = null) {
    const ideaContext = this.buildIdeaContext(idea, concepts);
    const appContext = this.buildAppContext(app, globalConcepts);
    const odrcState = ODRCSummaryGenerator.generateScoped(concepts, [idea], null);
    const sessionType = this.getSessionType(idea, concepts);
    const effectiveMode = mode || this.getDefaultMode(sessionType);

    try {
        const brief = await ClaudeAPIService.call({
            model: 'claude-sonnet-4-20250514',
            system: this.getSystemPrompt(sessionType),
            userMessage: this.buildUserMessage(ideaContext, appContext, odrcState, lens, effectiveMode),
            maxTokens: 4096
        });
        return brief;
    } catch (e) {
        console.warn('[CC] IdeationBriefGenerator: AI generation failed, using template fallback:', e.message);
        return this.buildTemplateBrief(idea, app, concepts, ideaContext, appContext, odrcState, sessionType, lens, effectiveMode);
    }
},
```

### B5: Update buildUserMessage() — Include lens/mode and skills list

**Location:** ~line 3191

Add lens, mode, and skills directive to the user message sent to the AI:

```javascript
buildUserMessage(ideaContext, appContext, odrcState, lens = null, mode = null) {
    const sessionNum = ideaContext.sessionCount + 1;
    let msg = `Generate a session brief for:\n\n`;
    msg += `**Idea:** ${ideaContext.name}\n`;
    msg += `**App:** ${appContext.name}\n`;
    msg += `**Session Number:** ${sessionNum}\n`;
    msg += `**Idea Slug:** ${ideaContext.slug}\n`;
    msg += `**Phase:** ${ideaContext.phase}\n\n`;

    // Skills directive for the AI to embed in the brief
    msg += `**Skills Directive to embed in the brief:**\n`;
    msg += `- cc-odrc-framework\n- cc-session-structure\n- cc-artifact-manifest\n- cc-post-session-package\n`;
    if (lens && LENS_DESCRIPTIONS[lens]) {
        msg += `- cc-lens-${lens} — ${LENS_DESCRIPTIONS[lens]}\n`;
    }
    if (mode && MODE_DESCRIPTIONS[mode]) {
        msg += `- cc-mode-${mode} — ${MODE_DESCRIPTIONS[mode]}\n`;
    }
    msg += `\n`;

    msg += `**Idea Description:**\n${ideaContext.description}\n\n`;

    if (ideaContext.latestSession) {
        msg += `**Most Recent Session:**\n`;
        msg += `- ID: ${ideaContext.latestSession.sessionId}\n`;
        msg += `- Date: ${new Date(ideaContext.latestSession.date).toLocaleDateString()}\n`;
        msg += `- Summary: ${ideaContext.latestSession.summary}\n`;
        msg += `- Created: ${ideaContext.latestSession.conceptsCreated} concepts, Resolved: ${ideaContext.latestSession.conceptsResolved}\n\n`;
    }

    if (ideaContext.sessionLog.length > 1) {
        msg += `**Full Session Log:**\n`;
        ideaContext.sessionLog.forEach(s => {
            msg += `- ${s.sessionId} (${new Date(s.date).toLocaleDateString()}): ${s.summary}\n`;
        });
        msg += `\n`;
        msg += `Note: Flag any OPENs persisting across 2+ sessions as "long-standing".\n\n`;
    }

    msg += `**App Context:**\n`;
    msg += `- Name: ${appContext.name}\n`;
    msg += `- Description: ${appContext.description}\n`;
    msg += `- Version: ${appContext.version}\n\n`;
    msg += `**Current ODRC State:**\n${odrcState}\n\n`;
    msg += `**Concept Counts:** ${ideaContext.conceptCounts.total} active (${ideaContext.conceptCounts.opens} OPENs, ${ideaContext.conceptCounts.decisions} DECISIONs, ${ideaContext.conceptCounts.rules} RULEs, ${ideaContext.conceptCounts.constraints} CONSTRAINTs)`;

    return msg;
},
```

### B6: Update buildTemplateBrief() — Skills Directive replaces Expected Output Format

**Location:** ~line 3232

Add `lens` and `mode` parameters:

```javascript
buildTemplateBrief(idea, app, concepts, ideaContext, appContext, odrcState, sessionType, lens = null, mode = null) {
```

Replace the Expected Output Format block (~lines 3275-3300). Find this section:

```javascript
// FIND AND REPLACE — from:
brief += `## Expected Output Format\n\n`;
brief += `At the end of this session, produce structured ODRC updates using the format below.\n`;
// ... through to the closing backticks line (~line 3300)
brief += `\`\`\`\n\n`;
```

Replace with:

```javascript
brief += `## Skills Directive\n\n`;
brief += `Read these skills before starting the session:\n`;
brief += `- **cc-odrc-framework** — ODRC thinking model and output format\n`;
brief += `- **cc-session-structure** — Session opening, pacing, and closing protocol\n`;
brief += `- **cc-artifact-manifest** — Track all files created during the session\n`;
brief += `- **cc-post-session-package** — Required output deliverables\n`;
if (lens && LENS_DESCRIPTIONS[lens]) {
    brief += `- **cc-lens-${lens}** — ${LENS_DESCRIPTIONS[lens]}\n`;
}
if (mode && MODE_DESCRIPTIONS[mode]) {
    brief += `- **cc-mode-${mode}** — ${MODE_DESCRIPTIONS[mode]}\n`;
}
brief += `\n`;

brief += `## Session Metadata\n\n`;
brief += `Use this metadata in the ODRC Updates header (format defined in cc-odrc-framework skill):\n`;
brief += `- Idea: ${slug}\n`;
brief += `- IdeaId: ${idea.id}\n`;
brief += `- App: ${appId}\n`;
brief += `- Session: S-${new Date().toISOString().slice(0, 10)}-${String(sessionNum).padStart(3, '0')}\n\n`;
```

### B7: Update getHandshakePrompt() — Reference skills

**Location:** ~line 3311

Replace the entire method:

```javascript
getHandshakePrompt(ideaName, sessionNumber, appName, sessionType, lens, mode) {
    let prompt = `Please review the attached session brief for ${ideaName} (Session ${sessionNumber}, App: ${appName}).\n\n`;
    prompt += `Read the skills listed in the Skills Directive section of the brief before proceeding.\n\n`;
    prompt += `Confirm you've reviewed the brief and skills, then ask me what I want to accomplish in this session.`;
    return prompt;
}
```

### B8: ExploreInChatModal — Add lens/mode dropdowns

**Location:** ~line 15583

Add state after existing state declarations (~line 15594):

```javascript
const [selectedLens, setSelectedLens] = React.useState(null);
const [selectedMode, setSelectedMode] = React.useState(
    IdeationBriefGenerator.getDefaultMode(sessionType)
);
```

Update the useEffect dependency array and generate call (~line 15601):

```javascript
React.useEffect(() => {
    let cancelled = false;
    (async () => {
        setGenerating(true);
        setError(null);
        try {
            const result = await IdeationBriefGenerator.generate(
                idea, app, concepts, globalConcepts, selectedLens, selectedMode
            );
            if (!cancelled) setBriefText(result);
        } catch (e) {
            if (!cancelled) setError(e.message);
        }
        if (!cancelled) setGenerating(false);
    })();
    return () => { cancelled = true; };
}, [idea.id, selectedLens, selectedMode]);
```

Update handshake prompt (~line 15618):

```javascript
const handshakePrompt = IdeationBriefGenerator.getHandshakePrompt(
    idea.name, sessionNum, app?.name || 'Unknown', sessionType, selectedLens, selectedMode
);
```

Add lens/mode selection UI inside the modal, after the header div (~line 15700) and before the brief preview area. Insert a new config panel:

```jsx
<div className="p-4 border-b border-slate-700 space-y-3">
    <div className="flex gap-4">
        <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Lens (what to examine)</label>
            <select value={selectedLens || ''} onChange={e => setSelectedLens(e.target.value || null)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white">
                <option value="">General (no specific lens)</option>
                {Object.entries(LENS_OPTIONS).map(([key, desc]) =>
                    <option key={key} value={key}>{desc}</option>
                )}
            </select>
        </div>
        <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Mode (how to examine)</label>
            <select value={selectedMode || ''} onChange={e => setSelectedMode(e.target.value || null)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white">
                <option value="">Default</option>
                {Object.entries(MODE_OPTIONS).map(([key, desc]) =>
                    <option key={key} value={key}>{desc}</option>
                )}
            </select>
        </div>
    </div>
    {(selectedLens || selectedMode) && (
        <div className="text-xs text-slate-500">
            Brief will include Skills Directive for: {[
                selectedLens && `cc-lens-${selectedLens}`,
                selectedMode && `cc-mode-${selectedMode}`
            ].filter(Boolean).join(', ')}
        </div>
    )}
</div>
```

---

## Existing Infrastructure Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `IdeationBriefGenerator` | ~line 2999 | Generates session briefs (AI + template fallback) |
| `ExploreInChatModal` | ~line 15583 | Modal UI for brief generation, copy, download, push |
| `ClaudeAPIService` | ~line 2889 | Makes Claude API calls for brief generation |
| `ODRCSummaryGenerator` | ~line 2936 | Generates ODRC state summaries from concepts |
| `computeIdeaPhase()` | ~line 2982 | Computes exploring/converging/spec-ready from ODRC ratios |
| `IdeaManager` | ~line 2860 | Manages idea CRUD and slug generation |
| `TYPE_STYLES` | ~line 2775 | ODRC type icons and colors |
| `ODRC_TYPES` | ~line 2773 | Array: ['OPEN','DECISION','RULE','CONSTRAINT'] |

---

## What NOT to Do

- Do NOT change `getSessionType()` — the three-type system (exploration/spec/claude-md) stays
- Do NOT change `buildIdeaContext()` or `buildAppContext()` — they work fine
- Do NOT change zip packaging, push to repo, or copy mechanics
- Do NOT remove the template fallback — it's the safety net when AI generation fails
- Do NOT put the CLAUDE.md locked template into a skill — it's session-type-specific content
- Do NOT change `ODRCSummaryGenerator` — ODRC state rendering is unchanged

---

## Testing

1. Open CC → navigate to an idea with existing ODRC state
2. Click "Explore in Chat" — verify lens/mode dropdowns appear above the brief preview
3. Verify default mode matches session type (exploration → exploration, spec-ready → spec)
4. Select Technical lens — verify brief regenerates with Skills Directive including `cc-lens-technical`
5. Select Exploration mode — verify Skills Directive includes `cc-mode-exploration`
6. Verify brief does NOT contain "Expected Output Format" section or ODRC format template
7. Verify brief DOES contain "Skills Directive" and "Session Metadata" sections
8. Copy handshake prompt — verify it says "Read the skills listed in the Skills Directive"
9. Download zip — verify zip still includes previous session ODRC output
10. Start new Chat session with the brief — verify Claude reads the skills and follows their protocol
11. Test template fallback: temporarily break ClaudeAPIService, verify fallback brief also uses Skills Directive format
12. Test with no lens/mode selected — verify core skills still listed, no lens/mode lines

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit code
2. Archive this CLAUDE.md to `cc/specs/feat_brief_generator_skills.md`
3. Generate completion file to `cc/completions/`
4. Commit spec archive and completion file separately
