# CC Key Concepts System — Design Spec

## Problem

Analysis documents generated during development sessions contain critical decisions, rules, and constraints. These get lost because:
- Documents are long (5-10 pages) and the signal is buried
- Next-session context includes skills, transcripts, archives — information overload
- Claude's default behavior is to execute, not evaluate against prior decisions
- Hard-won lessons get re-learned when they should be enforced

## Solution: Key Concepts Extraction + Interactive Surfacing

### Phase 1: Format & Extraction (Current)

Every analysis document ends with a structured Key Concepts section:

```markdown
## Key Concepts
<!-- cc-concepts scope="deploy,packaging" -->
- RULE: Path in zip = path in repo. One root wrapper allowed.
- DECISION: gs-active is a dev archive, never a deploy package.
- CONSTRAINT: Multi-app packages are project-scoped.
- PROCESS: Dead Reference Scan after every refactor.
- LESSON: Global find-replace needs post-replace audit.
- OPEN: How to handle cross-project archives.
- FIX: classifyFileAction uses basename for docs/ subfolder support.
<!-- /cc-concepts -->
```

**Types:**
| Type | Meaning | Persistence |
|------|---------|-------------|
| RULE | Must always be followed | Permanent until explicitly revoked |
| DECISION | Choice made, could be revisited | Active until superseded |
| CONSTRAINT | Boundary that limits options | Active until removed |
| PROCESS | How to do something | Active, evolves over time |
| LESSON | Learned from experience | Permanent reference |
| OPEN | Unresolved question | Active until answered |
| FIX | Bug fix that established a pattern | Permanent reference |

**Scopes:** Comma-separated tags for matching (deploy, packaging, testing, quality, code-review, config, workflow, smart-deploy, etc.)

### Phase 2: CC Storage

CC parses `<!-- cc-concepts -->` blocks from pushed documents and stores extracted concepts:

```javascript
// In CC config, alongside apps, repos, versions
concepts: [
  {
    id: "c001",
    type: "rule",
    scope: ["deploy", "packaging"],
    text: "Path in zip = path in repo. One root wrapper allowed.",
    source: "CC_v8_55_1_SESSION_TRANSCRIPT.md",
    date: "2026-02-11",
    status: "active"  // active | superseded | resolved
  }
]
```

**Extraction trigger:** When a document with `<!-- cc-concepts -->` markers is pushed to a repo via CC deploy, CC parses and imports the concepts. Duplicates are detected by text similarity and merged.

**UI in CC:** A "Concepts" section in settings or a dedicated tab showing all active concepts, filterable by scope and type. Ability to mark concepts as superseded or resolved.

### Phase 3: Interactive Surfacing

When CC prepares a session prompt (e.g., for gs-active CONTEXT.md or session prep):

1. **Scope matching:** Based on the work being done (deploy? testing? new feature?), pull relevant concepts
2. **Concept injection:** Include matched concepts in the prompt context
3. **Interactive check:** Before generating the final prompt, CC asks:
   - "This work touches [deploy]. Did you consider these active rules?"
   - Lists relevant RULE/CONSTRAINT/DECISION items
   - "Any OPEN questions that should be resolved first?"
   - Lists relevant OPEN items
4. **User confirms or adjusts**, then CC generates the prompt with concepts baked in

### Phase 4: Claude API Integration (Future)

Replace the manual prompt generation with a Claude API call inside CC:

```
User input: "I want to add a mega-archive deploy feature to CC"

CC collects:
- User intent (free text)
- Matched concepts (scope: deploy, packaging)
- Current app/project context

CC calls Claude API with:
- System: "You are a session prep assistant. Evaluate the user's intent against these established concepts. Flag conflicts, ask clarifying questions, then generate an optimized prompt."
- Concepts: [list of matched rules/decisions/constraints]
- User: [their intent]

Claude API returns:
- Conflicts found: "DECISION: gs-active is a dev archive, never a deploy package — your request may conflict with this."
- Clarifying questions: "Do you mean deploy from a project archive, or create a new multi-project deploy format?"
- Generated prompt: [refined, constraint-aware prompt ready for a full Claude session]
```

This makes CC the "thinking before doing" layer.

---

## Implementation Plan

### Step 1 (Now): Add Key Concepts to docs
- [x] Quality Process doc
- [x] Code Review Methodology doc  
- [x] Session Transcript
- [ ] gs-active SKILL.md (when updated)

### Step 2 (Next CC version): Parse & Store
- Add concept parser to CC (regex on cc-concepts markers)
- Add concepts to CC config storage
- Add Concepts view in CC UI (list, filter, status toggle)
- Auto-parse on document push

### Step 3 (Future): Interactive Surfacing
- Scope matching when preparing work
- "Did you consider?" dialog before session prep
- Concept injection into generated prompts

### Step 4 (Later): Claude API Prompt Generation
- Embed Anthropic API call in CC
- Evaluate intent vs concepts
- Generate constraint-aware prompts
- Flag conflicts before work begins

---

## Key Concepts
<!-- cc-concepts scope="concepts,cc-architecture,workflow" -->
- RULE: Every analysis document must end with a Key Concepts section using cc-concepts markers.
- RULE: Key concepts use typed prefixes: RULE, DECISION, CONSTRAINT, PROCESS, LESSON, OPEN, FIX.
- RULE: Concepts have scopes (comma-separated tags) for matching to relevant work.
- DECISION: Start with extraction and storage, add Claude API later.
- DECISION: Interactive pushback — CC asks "did you consider X?" before generating prompts.
- DECISION: Concepts live in CC config alongside apps, repos, versions.
- PROCESS: Doc push triggers concept extraction via cc-concepts marker parsing.
- PROCESS: Scope matching surfaces relevant concepts when preparing new work.
- OPEN: Duplicate detection strategy — text similarity vs manual dedup.
- OPEN: How to handle concept versioning when decisions are superseded.
<!-- /cc-concepts -->
