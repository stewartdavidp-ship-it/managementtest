---
task: "Session Lifecycle & Idea Phase Model"
status: complete
cc-spec-id: sp_session_lifecycle
files:
  - path: "index.html"
    action: modified
commits: []
odrc:
  new_decisions:
    - "activeSession is a top-level field on idea records for fast landing page rendering, cleared to null on session complete/abandon"
    - "New ideas default to phase: inception with phaseUpdatedAt timestamp; existing ideas with phase: null continue using computed phase"
    - "PHASE_COLORS uses 5-phase model: inception (slate), exploring (blue), converging (amber), spec-ready (pink), complete (green)"
    - "Session lifecycle: brief download activates session, ODRC import completes session, abandon writes entry and clears"
    - "Inception phase adds validation directive to briefs — both AI-generated and template fallback paths"
  resolved_opens: []
  new_opens:
    - "Should the IdeaWorkCard visually indicate when an idea has an active session (e.g., pulsing indicator)?"
    - "How should phase advancement be surfaced in the UI? Manual button on idea detail, or suggestion after ODRC import?"
unexpected_findings: []
unresolved: []
---

## Approach

Implemented the spec's four phases (A-D): data model changes, display updates, brief generator inception awareness, and session lifecycle integration. Used `ConceptManager.getByIdea` instead of the non-existent `IdeaManager.getConcepts` for computing `ideaPhaseAtEnd`. Set lifecycle fields on sessionLogEntry before `addSessionLogEntry` call (not after, as spec initially suggested).

## Implementation

- **Phase A:** Added `activeSession` and `phaseUpdatedAt` to backfill. New ideas default to `phase: 'inception'`. Added 5 new IdeaManager methods: `advancePhase`, `activateSession`, `completeSession`, `abandonSession`, `updateSessionActivity`.
- **Phase B:** Replaced PHASE_COLORS — removed `building`, added `inception` (slate) and `complete` (green).
- **Phase C:** Updated `getSessionType` with inception/complete handling. Updated `getSystemPrompt` to accept `phase` param with inception validation directive. Added inception section to `buildTemplateBrief` fallback. Enhanced `buildUserMessage` with `debriefSummary` from prior session.
- **Phase D:** Added `firebaseUid` prop to `ExploreInChatModal` (both call sites). Added active-session guard before brief download. Added session activation after brief zip download. Added session completion in `executeODRCImport` after successful import. Updated `addSessionLogEntry` to persist lifecycle fields (status, completedAt, ideaPhaseAtStart, ideaPhaseAtEnd).

## Verification

- Version bumped to 8.67.0
- 146 lines added across 4 phases
- All changes in single index.html file
- Existing computed phase logic untouched — inception/complete are developer-set only
