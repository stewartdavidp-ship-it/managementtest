---
task: "Backfill missing Idea fields in Firebase, make slugs immutable, add IdeaId to ODRC header, fix import auto-link cascade"
status: complete
cc-spec-id: sp_idea_backfill_odrc_routing
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "717fc97"
    message: "Idea backfill + ODRC routing fix: slug immutability, IdeaId header, auto-link cascade (v8.64.0)"
odrc:
  new_decisions:
    - "Slugs are immutable after creation — renaming an Idea does not change its slug"
    - "IdeaId (Firebase key) is now a first-class ODRC header field for unambiguous routing"
    - "ODRC auto-link uses 3-priority cascade: IdeaId → slug → app name resolution"
    - "Backfill runs async on every auth init — idempotent, uses single multi-path Firebase update"
    - "SYSTEM_PROMPT header block updated from 6 to 7 metadata lines (added IdeaId)"
  resolved_opens:
    - "How should existing Ideas without slug/sessionLog/phase be handled? → One-time idempotent backfill migration"
    - "ODRC import can't auto-link to Ideas without slugs → Backfill generates slugs, IdeaId provides unambiguous fallback"
  new_opens: []
unexpected_findings:
    - "Slug display already existed on Idea detail (line 16190) but without a label — added 'slug:' prefix"
    - "The auto-link code is inside an IIFE-wrapped ODRCImportChecklistModalInner — same nested component pattern as the ExploreInChatModal flicker bug, but only runs on import so less critical"
unresolved: []
---

## Approach

Six changes spanning data migration, model hardening, template update, and import logic:

1. **A1 — Backfill**: Added `IdeaManager.backfillMissingFields(uid)` that reads all Ideas, patches missing fields (slug, sessionLog, lastSessionDate, phase, parentIdeaId), and writes via single multi-path update. Slug generation includes collision avoidance within the batch.

2. **A2 — Slug immutability**: Removed 'slug' from `IdeaManager.update()` allowed fields array. Slug is only set at creation or by backfill.

3. **A3 — IdeaId extraction**: Added `# IdeaId:` regex parsing to `extractODRCMetadata()` — returns `ideaId` field alongside existing `ideaSlug`, `sessionNumber`, `appId`.

4. **A4 — IdeaId in briefs**: Added `# IdeaId: ${idea.id}` line to `buildTemplateBrief()` Expected Output Format. Updated exploration SYSTEM_PROMPT header block specification from 6 to 7 metadata lines.

5. **A5 — Auto-link cascade**: Replaced simple slug+app matcher with 3-priority cascade: (1) IdeaId exact match, (2) slug match (stored or computed), (3) app-scoped fallback with name/key/project resolution. All paths log diagnostics.

6. **A6 — Display**: Added "slug:" prefix to existing slug display on Idea detail. Added IdeaId to ODRC import banner metadata line.

## Implementation Notes

**Backfill trigger location**: After `IdeaManager.listen(u.uid, setGlobalIdeas)` in auth init (~line 6479). Runs async with `.catch()` — does not block app load. The listener picks up backfilled data once writes complete.

**Slug collision avoidance**: During batch backfill, tracks slugs being generated in the current batch (`updates` object) to prevent collisions between Ideas with similar names.

**App name resolution (A5 Priority 3)**: When `# App: Command Center` doesn't match any `idea.appId` directly, checks against `apps[id]`, `apps[id].name`, and `apps[id].project` (case-insensitive). This handles the mismatch between display names and config keys.

**Backward compatibility**: Older ODRC files without `# IdeaId:` still route via Priority 2 (slug) and Priority 3 (app). `extractODRCMetadata` returns `null` for missing fields — all downstream consumers already handle nulls.
