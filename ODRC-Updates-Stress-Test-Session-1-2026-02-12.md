# ODRC Updates — Stress Test: Idea Validation Challenge
# Date: 2026-02-12
# Session: 1 (Concept exploration, live test, and design refinement)
# Idea: pitch-challenge-you-have-a-set-amount-of-team-5101520-minute
# App: command-center
# Context: Renamed concept from "Pitch Challenge" to "Stress Test," ran live test to surface design issues, defined persona model, feedback structure, and ODRC integration

---

## ODRC Updates

- RESOLVE OPEN: "This is a Claude Chat session in which Claude Chat will be given an industry and persona and a basic understanding of your idea..." → Concept fully reframed: not a pitch/sales exercise but an idea validation stress test. User provides 2-3 sentence idea summary plus target industry, selects a persona lens, and engages in a 5-minute conversational challenge. Output feeds back into ODRC as structured updates.

- NEW DECISION: "Concept renamed from 'Pitch Challenge' to 'Stress Test' — the word 'pitch' pulls both the user and the AI into sales presentation dynamics, which undermines the real goal of testing whether the idea holds up under scrutiny"

- NEW DECISION: "Fixed 5-minute session length for all stress tests — provides consistency for evaluation and keeps sessions focused. Eliminates the 2/5/10/15/20 minute selection that added complexity without value"

- NEW DECISION: "Conversational format, not presentational — the persona opens with a reaction and question after receiving the idea summary. The user isn't delivering a monologue, they're defending their thinking in a dynamic back-and-forth"

- NEW DECISION: "Two-phase feedback at session end: Phase 1 is an in-character closing reaction that conveys the persona's assessment without a visible score (e.g., 'I'd take a follow-up meeting' vs 'I think you have more homework to do'). Phase 2 is an out-of-character ODRC extraction that converts the session into structured updates"

- NEW DECISION: "No visible rubric or scoring — the evaluation is embedded in the persona's in-character response and the ODRC extraction. Users should feel challenged, not tested"

- NEW DECISION: "Five persona lenses defined by challenge focus, not job title: The Strategist (prioritization/opportunity cost), The Builder (feasibility/efficiency), The User (practical value/friction), The Skeptic (risk/failure modes), The Investor (differentiation/scale at volume)"

- NEW DECISION: "Persona titles are lens-based not role-based — 'The Builder' not 'Senior Developer' — avoids defaulting into sales pitch dynamics and keeps focus on what dimension of the idea is being challenged"

- NEW DECISION: "Persona tone is challenging but constructive — open-minded, not adversarial. The persona wants to believe the idea has merit but needs the user to demonstrate they've done the work. Not trying to break spirits, trying to make ideas better or help someone see gaps"

- NEW DECISION: "ODRC state from prior sessions is passed into stress test sessions so the persona can track progress on previously identified OPENs — enables 'last time this was unresolved, what's changed?' continuity between early and late stress tests"

- NEW DECISION: "Session intake requires three inputs: 2-3 sentence idea summary, target industry, and persona selection. Minimal context by design — the gap between what the AI knows and what the user knows is the playing field"

- NEW DECISION: "Stress test sessions use standard session ID and idea tags to write back ODRC updates like any other session type — no special handling needed in CC's inbound flow"

- NEW DECISION: "Phase 2 ODRC extraction distinguishes four output types: new OPENs from questions the user couldn't answer, validated DECISIONs from points defended with confidence, CONSTRAINTs from hard boundaries the user stated, and RULEs from patterns and guidelines the user articulated"

- NEW RULE: "Stress test recommended at two lifecycle points: early (session 2-3) to test 'is this worth pursuing' and pre-spec to test 'is this ready to build' — but never required, surfaced as suggestions by CC"

- NEW RULE: "Each persona lens should produce a meaningfully different set of ODRC outputs from the same idea — if two personas surface the same issues, the lenses aren't differentiated enough"

- NEW CONSTRAINT: "No role-playing as named real people — personas are archetypes only. Prevents gaming caricatures and keeps the exercise focused on transferable skills"

- NEW CONSTRAINT: "Maximum five personas to start — depth and true differentiation over breadth"

- NEW OPEN: "How does industry context get incorporated into the persona prompt — free text field or structured selection? Industry shapes what credible answers sound like"

- NEW OPEN: "What does the system prompt structure look like to keep Claude in challenge mode without drifting to helpful coaching? Live test showed this is a real risk — Claude's instinct is to help, not to probe"

- NEW OPEN: "How does CC surface stress test suggestions at the right lifecycle moments without mandating them? Needs UX design for the nudge"

- NEW OPEN: "How does persistent OPEN tracking work in Phase 2 — distinguishing new OPENs vs unresolved OPENs carried forward vs OPENs promoted to DECISIONs since last stress test?"

- NEW OPEN: "Can persona questions be designed to intentionally surface all four ODRC categories, not just OPENs? Live test showed the persona mostly probed for weaknesses and missed opportunities to draw out constraints and rules"

- NEW OPEN: "Brief output format needs enrichment — current expected output template is too minimal to produce the quality of session documents needed for CC ingestion (see CC-Brief-Output-Format-Update.md)"

---

## Session Notes

### What Was Accomplished
Session 1 explored the stress test concept through discussion and a live 5-minute test run. The live test (pitching AI Command Center to "Jordan Reeves, VP of Product") revealed the critical insight that the word "pitch" pulls both participants into sales dynamics, which led to renaming the concept to "Stress Test" and reframing the entire design around idea validation rather than presentation skills. Defined the five persona lenses, the two-phase feedback model, ODRC integration approach, and lifecycle positioning. Also identified that the session brief's expected output format is too minimal and produced a separate update spec for that.

### Key Design Principles Established
- **Challenge, not evaluate** — the persona probes the idea's merit, not the user's presentation skills
- **Lens, not role** — personas are defined by what they challenge (economics, feasibility, risk), not by job title
- **ODRC as output** — every stress test produces structured ODRC updates, not just a score or feedback
- **Continuity across sessions** — ODRC state passes into stress tests so progress is tracked and acknowledged
- **Constructive pressure** — tough enough to surface gaps, not so tough it breaks motivation

### Session Status
12 DECISIONs, 2 RULEs, 2 CONSTRAINTs, 6 OPENs. Idea is in exploring phase — core concept is shaped but implementation details (prompt engineering, UI integration, lifecycle triggers) remain open. Next session should focus on either prompt engineering for the persona system prompts or the UX for stress test integration into CC's idea workflow.
