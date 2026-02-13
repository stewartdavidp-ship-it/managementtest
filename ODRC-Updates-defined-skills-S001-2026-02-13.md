# ODRC Updates — Defined Skills for Cloud Chat
# Date: 2026-02-13
# Session: S-2026-02-13-001 (Concept exploration and first skill build)
# Idea: defined-skills-for-cloud-chat
# IdeaId: -OlNkLYzkzDW4I8q7jJI
# App: command-center
# Context: Established the skill architecture for CC ideation sessions — three-layer model (core + lens + mode), clean separation between skills (stable behavior) and briefs (dynamic context), built and packaged first 6 skills for testing.

---

## ODRC Updates

- NEW DECISION: "Skills are stable behavioral frameworks; briefs are dynamic session context. Skills define how Claude should behave (ODRC framing, session protocol, probing methodology). Briefs carry what's unique to this session (idea context, ODRC state, session goal). This separation keeps skills reusable and briefs lean."

- NEW DECISION: "CC is the skill authoring and management tool. Delivery to claude.ai is manual upload to Settings → Capabilities. One-time upload per skill, update only when skill is versioned. No API delivery — skills persist in claude.ai once uploaded."

- NEW DECISION: "Three-layer skill architecture: Core skills (every session) + Lens skills (what domain to examine) + Mode skills (what methodology to use). A session runs core + one lens + one mode. The brief specifies which lens and mode to read."

- NEW DECISION: "Core skills are: cc-odrc-framework (thinking model and output format), cc-session-structure (open/pace/close protocol and compaction recovery), cc-artifact-manifest (file tracking throughout session), cc-post-session-package (required output deliverables and quality checklist)."

- NEW DECISION: "Lens skills define WHAT domain to examine. Five lenses: Technical (feasibility, architecture, dependencies, implementation risk), Economics (cost structure, pricing, ROI, resource requirements), Competitive (differentiation, market positioning, alternatives), Voice of Customer (who needs this, problem-solution fit, friction, adoption), Operational (maintenance, scaling, support). Each lens teaches Claude how to probe that domain and what ODRC categories typically surface."

- NEW DECISION: "Mode skills define HOW to examine. Four modes: Exploration (open discovery, bias toward surfacing OPENs and early Decisions), Stress Test (challenge mode, persona-driven, bias toward finding gaps and validating Decisions), Spec (convergence, bias toward resolving OPENs and establishing Rules/Constraints), Review (evaluative, confirming completeness and readiness)."

- NEW DECISION: "Lenses and modes are two independent dimensions that combine. Economics + Exploration is different from Economics + Stress Test. The lens determines what questions get asked. The mode determines how aggressively they get asked and the expected output emphasis."

- NEW DECISION: "Idea maturity is NOT a skill dimension — it's carried by ODRC state in the brief. The accumulated OPENs, Decisions, Rules, and Constraints tell Claude where the idea stands. No need for an explicit maturity parameter. If remaining OPENs cluster around economics, that signals where to push next."

- NEW DECISION: "CC tracks lens/mode coverage per idea and can surface gap-based recommendations. If an idea has three technical sessions but no economics examination, CC suggests an economics session. Coverage is driven by ODRC gap analysis, not a mandatory checklist."

- NEW DECISION: "Remove existing Game Shelf skills (gs-active, firebase-patterns, ui-components, game-rules, gs-logos) as code and documentation work moves to Claude Code. Start fresh with only CC ideation skills."

- NEW DECISION: "First test round is 6 skills: 4 core (cc-odrc-framework, cc-session-structure, cc-artifact-manifest, cc-post-session-package) + 1 lens (cc-lens-technical) + 1 mode (cc-mode-exploration). Validate the three-layer pattern works before building remaining lenses and modes."

- NEW RULE: "Anything consistent across a majority of sessions becomes a skill. Anything dynamic and based on historical context stays in the brief. This is the governing principle for what goes where."

- NEW RULE: "Each session should target a specific goal through a focused lens — broad unfocused sessions miss gaps. Focusing on specific areas (technical, economics, competitive, voice of customer) allows deeper examination and surfaces real Constraints and Rules that broad sessions miss."

- NEW CONSTRAINT: "Claude.ai custom skill limit is approximately 20 skills. Current plan is 13 skills (4 core + 5 lenses + 4 modes). Leaves headroom for future additions but requires awareness when adding new skills."

- NEW CONSTRAINT: "SKILL.md limited to 500 lines per skill in claude.ai. Description limited to 200 characters. Skill name limited to 64 characters, lowercase letters/numbers/hyphens only. Reference files can be used for overflow content."

- NEW CONSTRAINT: "Skills uploaded to claude.ai Settings are individual user only — no programmatic deployment from CC to claude.ai. CC can author and package skills but the developer must manually upload to Settings → Capabilities."

- NEW OPEN: "What does a minimal session brief look like now that behavioral load has moved to skills? Need to design the brief template that just says 'read these skills, here's the context, here's the goal.'"

- NEW OPEN: "How does CC author and version skill zip files in its UI? Need a skill management view where skills can be created, edited, versioned, and exported as zip files for upload."

- NEW OPEN: "How do we test that the skills actually influence Claude's behavior in Chat? Need a test protocol — upload skills, start a session with a brief that references them, evaluate whether Claude follows the skill instructions."

- NEW OPEN: "Should session-continuity skill be absorbed into cc-session-structure or remain separate? Currently compaction recovery is included in session-structure."

- NEW OPEN: "What are the exact lens definitions for Economics, Competitive, Voice of Customer, and Operational? Technical lens is built — remaining four need the same level of probing framework and question patterns."

- NEW OPEN: "What are the exact mode definitions for Stress Test, Spec, and Review? Exploration mode is built — remaining three need the same level of posture and flow definition."

---

## Session Notes

### What Was Accomplished
Session 1 explored the defined skills concept starting from a misunderstanding about API-based skill loading that was resolved through research. Established that skills are uploaded manually to claude.ai Settings and persist across all Chat sessions — CC's role is authoring and versioning, not deploying. Designed a three-layer skill architecture (core + lens + mode) where lenses define what domain to examine and modes define the examination methodology. Identified the ~20 skill cap as a real constraint and cleared headroom by deciding to remove existing GS-specific skills. Built and packaged the first 6 skills for immediate testing: 4 core skills plus one lens (technical) and one mode (exploration).

### Key Design Principles Established
- Skills are stable behavioral frameworks; briefs are dynamic session context
- Lenses and modes are independent dimensions that combine — lens defines what to examine, mode defines how
- Focused sessions with specific lenses surface deeper gaps than broad unfocused exploration
- ODRC state IS the maturity signal — no need for an explicit maturity dimension
- Start fresh, test, iterate — don't over-engineer before validating the pattern works

### Session Status
- Concepts: 5 OPENs, 11 DECISIONs, 2 RULEs, 3 CONSTRAINTs
- Phase: converging — core architecture decided, first implementation built, testing next
- Next session: Upload skills to claude.ai, run a test session using a real idea with the technical lens + exploration mode, evaluate whether Claude follows skill instructions and produces proper ODRC output
