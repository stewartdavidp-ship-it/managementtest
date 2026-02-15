# ODRC Updates — Spec Quality Feedback Loop
# Date: 2026-02-15
# Session: S-2026-02-15-012 (Initial exploration — spec pre-read review process)
# Idea: spec-quality-feedback-loop
# IdeaId: (new — needs creation)
# App: command-center
# Context: Captured during Session 11 (session-tab Unit 5 spec production) when reviewing Claude Code's pre-build assessment of the Unit 4 CLAUDE.md. Code naturally catches real issues (signature mismatches, stale references, dead UI for unbuilt features) that Chat can't see. Need a formalized process to capture, classify, and act on this feedback.

- NEW OPEN: "What is the full taxonomy of spec review findings? Initial candidates: stale_reference (line numbers moved), signature_mismatch (function/prop API doesn't match spec), dead_code (UI for unbuilt backend), convention_drift (spec uses different patterns than repo), missing_context (spec assumes something not in codebase), scope_overreach (spec asks for more than one session can build). What severity model maps to these — warning, review, intervention?"
- NEW OPEN: "What instructions should the CLAUDE.md template give Code about the pre-read review? Code already does a 'Before You Begin' assessment naturally. Should the template explicitly instruct Code to write the review file before building, or should it be a standing instruction in Code's own configuration?"
- NEW OPEN: "Where does the review file live and what triggers action? Proposed: cc/specpreread/{spec-id}-review.md. But who reads it — does CC surface it on the next session card? Does the brief generator pull findings into the next spec session? Does the developer get a notification?"
- NEW OPEN: "Should the severity classification drive automated workflow changes? E.g., 'intervention' findings could block the build and route back to Chat for revision, 'review' findings get surfaced to the developer for a go/no-go decision, 'warning' findings are informational and Code proceeds."
- NEW OPEN: "How does this interact with the completion file? The completion file already has unexpected_findings and new_opens fields. Should spec_quality be a new section in the completion file (post-build), or is the specpreread file (pre-build) sufficient, or do we need both — pre-build review + post-build actuals?"
- NEW OPEN: "What does the feedback loop look like end-to-end? Chat produces spec → Code reviews → findings classified → developer decides → Code builds (or spec returns to Chat). How many round-trips is acceptable? Is one review pass sufficient or does this become iterative?"
- NEW DECISION: "Claude Code's pre-build spec assessment is a first-class artifact, not throwaway console output. It should be persisted in a known location (cc/specpreread/) so CC can surface findings to the developer and feed them into future spec sessions. Rationale: Code catches real issues Chat can't see (runtime API mismatches, stale references, scope vs capacity). Losing this signal wastes the insight."
- NEW DECISION: "Spec review findings should be severity-classified so the developer knows what action to take. Not all findings are equal — a stale line number is a warning, a fundamental API mismatch needs intervention before building. The severity model drives workflow: warnings are informational, reviews need developer acknowledgment, interventions need spec revision before Code proceeds."

## Session Notes

### What Was Accomplished
During Session 11 Link 2 (session-tab spec production), the developer shared Claude Code's pre-build review of the Unit 4 CLAUDE.md. The review surfaced 5 concrete issues: a phase that was mostly a stub, an event API mismatch in onFileDrop, a missing prop in the component signature, approximate line references, and a completion file convention mismatch. This demonstrated that Code naturally performs valuable quality assurance on specs that Chat cannot do — Code sees the actual runtime APIs, current line numbers, and repo conventions.

The discussion identified this as a broader concern beyond the session-tab idea. The feedback loop between Chat (spec producer) and Code (spec consumer) needs formalization: structured capture of findings, severity classification to drive developer action, and a path for findings to improve future spec generation.

### Key Design Principles Established
- Code's natural "Before You Begin" assessment is already the review — don't create a separate review session, just capture the output that's already happening
- Severity classification matters — not all findings are equal, and the developer needs to know whether to proceed, acknowledge, or intervene
- The feedback should be cumulative — recurring patterns (e.g., "line references are always stale") should inform spec generation practices over time
- Pre-build and post-build are different moments with different value — the specpreread captures what Code sees before touching code, the completion file captures what actually happened

### Session Status
- Concepts: 6 OPENs, 2 DECISIONs, 0 RULEs, 0 CONSTRAINTs
- Phase: inception
- Next session: Explore the severity taxonomy and map it to concrete workflow actions. Define the specpreread file format. Determine how CC surfaces findings to the developer.
