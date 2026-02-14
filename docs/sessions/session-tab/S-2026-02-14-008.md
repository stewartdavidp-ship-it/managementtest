# ODRC Updates — Session Tab
# Date: 2026-02-14
# Session: S-2026-02-14-008 (Spec Unit 2 — session lifecycle & idea phase model)
# Idea: session-tab
# IdeaId: -OlO6yEDlG9FFkjXgAxl
# App: command-center
# Context: Produced spec Unit 2 (session lifecycle & idea phase model) and converted it to a CLAUDE.md implementation document targeting v8.67.0. Grounded both documents against the v8.66.0 codebase with specific line references.

## ODRC Updates

- NEW DECISION: "Session lifecycle uses three states: pending (no active session — the absence of an activeSession field on the idea), active (brief generated, session object created), and complete (summation ingested, record moves to sessionLog). 'Dispatched' from prior sessions is absorbed into 'active' — brief generation IS activation. Staleness is a derived signal from active sessions with no artifacts and age thresholds, not a fourth state."
- NEW DECISION: "Ideation session lifecycle lives on the idea record (activeSession field + sessionLog array), not on the legacy SessionService. SessionService (line ~1375) tracks build sessions with sess-{timestamp} IDs — a different concept that coexists until future unification. Keeping sessions on the idea record means the idea is the single unit of navigation with full history inline."
- NEW DECISION: "activeSession is a top-level field on the idea record for fast landing page rendering. When a session is active it contains sessionId, status, createdAt, lastActivityAt, briefDownloaded, artifactsReceived, and ideaPhaseAtStart. On completion it's set to null and the enriched entry appends to sessionLog. This avoids scanning the sessionLog array to determine current state."
- NEW DECISION: "One active session per idea is enforced at brief generation time. If idea.activeSession is non-null, CC blocks brief generation and surfaces the active session ID. Multiple ideas can have simultaneous active sessions — the constraint is per-idea, not global."
- NEW DECISION: "Abandon action on stale sessions writes an abandoned entry to sessionLog (type: 'abandoned') and clears activeSession. No new state value needed — the abandoned entry is a historical record in the log, and the idea returns to pending (activeSession === null)."
- NEW DECISION: "Existing ideas with phase: null continue using computeIdeaPhase() for computed phase. Only new ideas default to inception. The backfill logic must NOT retroactively set inception on existing ideas — that would incorrectly mark mature ideas as provisional. Migration is additive only."
- NEW DECISION: "PHASE_COLORS removes the unused 'building' entry and adds inception (slate/gray — provisional) and complete (green — done). The five-phase color set matches the spec's phase model exactly: inception, exploring, converging, spec-ready, complete."
- NEW DECISION: "IdeationBriefGenerator.getSystemPrompt() gains a phase parameter. When phase is inception, the exploration system prompt appends the inception validation directive block. The template fallback (buildTemplateBrief) gets the same conditional. This keeps inception awareness in the brief generator without requiring skill changes."
- NEW DECISION: "buildUserMessage() is enhanced to surface latestSession.debriefSummary (the narrative first paragraphs of the debrief) when available, in addition to the existing one-line summary. This gives the AI brief generator richer context for producing better session briefs."
- NEW DECISION: "CLAUDE.md targets v8.67.0 with four implementation phases: (A) idea record activeSession field and phase defaults, (B) PHASE_COLORS and display updates, (C) IdeationBriefGenerator inception awareness, (D) session lifecycle wiring into brief generation and ODRC import flows."

## Session Notes

### What Was Accomplished
This session produced spec Unit 2 (session lifecycle & idea phase model) — the state machines that govern how sessions and ideas progress through Command Center. The spec was first written as a pure design document, then grounded against the v8.66.0 codebase when the developer uploaded the latest code with Unit 1 implementation complete.

The codebase review surfaced several important findings: the legacy SessionService tracks build sessions (a different concept from ideation sessions), the idea record already has a sessionLog array and phase field that can be extended rather than replaced, and PHASE_COLORS has an orphaned 'building' entry with no corresponding spec phase. These findings shaped the key architectural decision to keep ideation sessions on the idea record rather than in the separate SessionService path.

The spec was then converted into a CLAUDE.md implementation document targeting v8.67.0 with four phases covering data model, display, brief generation, and lifecycle wiring. All line references were validated against the uploaded codebase.

### Key Design Principles Established
- Session lifecycle belongs on the idea record, not in a separate service — the idea is the unit of navigation
- activeSession as a top-level field optimizes for the landing page's primary query pattern
- Three states (pending/active/complete) with staleness as a derived signal keeps the state machine simple
- Inception and complete phases are always developer-set, never computed — computeIdeaPhase() remains unchanged
- Migration must be additive — never retroactively change existing data semantics

### Artifacts Produced
| # | Filename | Type | Status | Purpose |
|---|----------|------|--------|---------|
| 1 | spec-unit2-session-lifecycle-idea-phase.md | spec | complete | Spec Unit 2 — session lifecycle & idea phase model |
| 2 | CLAUDE-session-lifecycle.md | claude-md | complete | CLAUDE.md for implementing session lifecycle (v8.67.0) |
| 3 | ODRC-Updates-session-tab-S008.md | odrc | complete | This document — session ODRC output |

### Session Status
- Concepts: 10 DECISIONs (new), 0 OPENs (new), 0 resolved, 0 RULEs, 0 CONSTRAINTs
- Phase: spec-ready (unchanged)
- Next session: Begin spec Unit 3 — skill updates (cc-link-output, cc-summation-link, cc-odrc-framework, cc-session-structure). These encode the chain model, pacing, link output format, summation workflow, and ODRC JSON format into the skill files. They reference each other so speccing them together ensures consistency.
