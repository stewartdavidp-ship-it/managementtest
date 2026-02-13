# CLAUDE.md — Idea Data Model Backfill + ODRC Import Routing Fix
# cc-spec-id: sp_idea_backfill_odrc_routing
# App: Command Center (index.html)
# Base version: (current)
# Target version: +0.1.0
# Depends on: IdeaManager and ODRCUpdateIngestionService must exist in index.html

---

## Task Summary

Backfill missing fields on existing Idea records in Firebase, make slugs immutable after creation, add `# IdeaId:` to session brief output for unambiguous routing, and fix the ODRC import auto-link cascade so dropped ODRC files correctly map to their parent Idea.

**This task spans: data migration, data model hardening, brief template update, and import matching logic.**

---

## The Problem

The Idea data model was extended with new fields (`slug`, `sessionLog`, `lastSessionDate`, `phase`, `parentIdeaId`) in a code update, but Ideas created before that update still exist in Firebase without these fields. Evidence from Firebase Console shows an existing Idea record only has:

```
appId, createdAt, description, id, name, sequence, status, type, updatedAt
```

Missing from Firebase: `slug`, `sessionLog`, `lastSessionDate`, `phase`, `parentIdeaId`

`IdeaManager.create()` writes all fields correctly for NEW Ideas — this is not a code bug. It is a migration gap: existing Ideas were never backfilled.

This breaks ODRC import routing because:
1. Existing Ideas have no `slug` in Firebase — the import matcher can't auto-link ODRC files to Ideas
2. The `# App:` fallback compares a human-readable app name (e.g., `command-center`) against `idea.appId` — this works when appId IS the config key, but fails when the ODRC file uses a display name like `Command Center`
3. There is no Firebase Idea ID in the ODRC header format, so there's no unambiguous fallback
4. If an Idea is renamed after an ODRC file is generated, the computed slug changes and the match breaks

**Net effect:** CC parses ODRC content correctly but cannot auto-link it to an Idea. The user must manually select from a dropdown every time.

---

## What Good Looks Like

After this task:
- All existing Ideas in Firebase have `slug`, `sessionLog`, `lastSessionDate`, `phase`, and `parentIdeaId` fields
- Slugs are immutable — renaming an Idea does not change its slug
- Generated session briefs include `# IdeaId: {firebase-key}` in the Expected Output Format template
- ODRC import auto-links by: (1) IdeaId exact match, (2) slug match, (3) app-scoped fallback with name resolution
- Console logs diagnostic output when auto-link fails

---

## What to Change

### A1: Idea Backfill Migration

**Location:** Add new method `IdeaManager.backfillMissingFields(uid)` after `IdeaManager.listen()` (~line 5652, just before the closing `};` of the IdeaManager object at ~line 5663)

```javascript
// One-time backfill for Ideas created before data model extension
async backfillMissingFields(uid) {
    const snapshot = await this._ref(uid).once('value');
    const data = snapshot.val();
    if (!data) return;
    
    let backfillCount = 0;
    const updates = {};
    
    for (const [key, idea] of Object.entries(data)) {
        const patch = {};
        let needsUpdate = false;
        
        // Backfill slug — generate from name, ensure unique within app scope
        if (!idea.slug) {
            const base = this.generateSlug(idea.name || 'untitled');
            const siblings = Object.values(data).filter(i => 
                i.appId === idea.appId && i.slug && i.id !== idea.id
            );
            const existingSlugs = siblings.map(i => i.slug);
            // Also include slugs we're generating in this batch to avoid collisions
            for (const [otherKey, otherPatch] of Object.entries(updates)) {
                if (otherPatch.slug) existingSlugs.push(otherPatch.slug);
            }
            let slug = base;
            if (existingSlugs.includes(slug)) {
                let counter = 2;
                while (existingSlugs.includes(`${slug}-${counter}`)) counter++;
                slug = `${base}-${counter}`;
            }
            patch.slug = slug;
            needsUpdate = true;
        }
        
        if (!idea.sessionLog) { patch.sessionLog = []; needsUpdate = true; }
        if (idea.lastSessionDate === undefined) { patch.lastSessionDate = null; needsUpdate = true; }
        if (idea.phase === undefined) { patch.phase = null; needsUpdate = true; }
        if (idea.parentIdeaId === undefined) { patch.parentIdeaId = null; needsUpdate = true; }
        
        if (needsUpdate) {
            updates[key] = patch;
            backfillCount++;
        }
    }
    
    // Write all patches in a single multi-path update
    if (backfillCount > 0) {
        const multiUpdate = {};
        for (const [key, patch] of Object.entries(updates)) {
            for (const [field, value] of Object.entries(patch)) {
                multiUpdate[`${key}/${field}`] = value;
            }
        }
        await this._ref(uid).update(multiUpdate);
        console.log(`[CC] Idea backfill: updated ${backfillCount} idea(s) with missing fields`);
    } else {
        console.log('[CC] Idea backfill: all ideas up to date');
    }
}
```

**Trigger location:** Call once after auth, immediately after the Ideas listener is set up (~line 6415):

```javascript
// After this existing line:
unsubscribeIdeas = IdeaManager.listen(u.uid, setGlobalIdeas);

// Add:
IdeaManager.backfillMissingFields(u.uid).catch(e => 
    console.error('[CC] Idea backfill failed:', e)
);
```

The backfill runs asynchronously and does not block app load. The `listen()` handler picks up backfilled data once writes complete. On subsequent loads, the backfill detects all fields present and skips (idempotent).

---

### A2: Slug Immutability

**Location:** `IdeaManager.update()` (~line 5557)

**Change:** Remove `'slug'` from the `allowed` array so slug cannot be changed through the general update path.

```javascript
// BEFORE:
const allowed = ['name', 'description', 'status', 'slug', 'phase'];

// AFTER:
const allowed = ['name', 'description', 'status', 'phase'];
```

**Why:** The slug is the stable routing identifier for ODRC imports. If a user renames "Pitch Challenge" to "Stress Test," the slug stays `pitch-challenge-...` so ODRC files generated before the rename still route correctly.

Do NOT add a separate slug-editing method in this task. That can come later if needed.

---

### A3: Add IdeaId to ODRC Metadata Extraction

**Location:** `extractODRCMetadata()` (~line 2816)

**Change:** Add parsing for a `# IdeaId:` header line:

```javascript
// BEFORE:
function extractODRCMetadata(fileContent) {
    if (!fileContent || typeof fileContent !== 'string') return { ideaSlug: null, sessionNumber: null, appId: null };
    const ideaMatch = fileContent.match(/^#\s*Idea:\s*(.+)$/m);
    const sessionMatch = fileContent.match(/^#\s*Session:\s*(.+)$/m);
    const appMatch = fileContent.match(/^#\s*App:\s*(.+)$/m);
    return {
        ideaSlug: ideaMatch ? ideaMatch[1].trim() : null,
        sessionNumber: sessionMatch ? sessionMatch[1].trim() : null,
        appId: appMatch ? appMatch[1].trim() : null
    };
}

// AFTER:
function extractODRCMetadata(fileContent) {
    if (!fileContent || typeof fileContent !== 'string') return { ideaSlug: null, ideaId: null, sessionNumber: null, appId: null };
    const ideaMatch = fileContent.match(/^#\s*Idea:\s*(.+)$/m);
    const ideaIdMatch = fileContent.match(/^#\s*IdeaId:\s*(.+)$/m);
    const sessionMatch = fileContent.match(/^#\s*Session:\s*(.+)$/m);
    const appMatch = fileContent.match(/^#\s*App:\s*(.+)$/m);
    return {
        ideaSlug: ideaMatch ? ideaMatch[1].trim() : null,
        ideaId: ideaIdMatch ? ideaIdMatch[1].trim() : null,
        sessionNumber: sessionMatch ? sessionMatch[1].trim() : null,
        appId: appMatch ? appMatch[1].trim() : null
    };
}
```

---

### A4: Add IdeaId to Session Brief Expected Output Format

**Location:** `SessionBriefBuilder.buildTemplateBrief()` — the Expected Output Format section (~lines 3235-3241)

The `buildTemplateBrief` method already receives `idea` as its first parameter. Add `# IdeaId:` line using `idea.id`:

```javascript
// BEFORE (lines 3239-3240):
brief += `# Idea: ${slug}\n`;
brief += `# App: ${appId}\n`;

// AFTER:
brief += `# Idea: ${slug}\n`;
brief += `# IdeaId: ${idea.id}\n`;
brief += `# App: ${appId}\n`;
```

Also add `# IdeaId:` to the SYSTEM_PROMPT in `IdeationBriefGenerator` if it contains an Expected Output Format instruction. Search for the `SYSTEM_PROMPT` property and update the header block specification to include `IdeaId` as the fourth metadata line between Idea and App.

---

### A5: Fix ODRC Import Auto-Link Logic

**Location:** The ODRC Import Checklist Modal `linkedIdeaId` initialization (~line 11928)

**Replace the existing auto-link logic with a three-priority cascade:**

```javascript
// BEFORE (lines 11928-11941):
const [linkedIdeaId, setLinkedIdeaId] = React.useState(() => {
    // Try auto-link from metadata
    if (pendingOdrcImport.metadata?.ideaSlug) {
        const match = (globalIdeas || []).find(i =>
            i.slug === pendingOdrcImport.metadata.ideaSlug ||
            IdeaManager.generateSlug(i.name) === pendingOdrcImport.metadata.ideaSlug
        );
        if (match) return match.id;
    }
    if (pendingOdrcImport.metadata?.appId) {
        const appIdeas = (globalIdeas || []).filter(i => i.appId === pendingOdrcImport.metadata.appId && i.status === 'active');
        if (appIdeas.length > 0) return appIdeas[appIdeas.length - 1].id;
    }
    return null;
});

// AFTER:
const [linkedIdeaId, setLinkedIdeaId] = React.useState(() => {
    const meta = pendingOdrcImport.metadata;
    const ideas = globalIdeas || [];
    
    // Priority 1: Direct Firebase ID match (unambiguous)
    if (meta?.ideaId) {
        const match = ideas.find(i => i.id === meta.ideaId);
        if (match) {
            console.log('[CC] ODRC auto-link: matched by IdeaId:', meta.ideaId);
            return match.id;
        }
        console.log('[CC] ODRC auto-link: IdeaId not found:', meta.ideaId);
    }
    
    // Priority 2: Slug match (stored slug or computed from current name)
    if (meta?.ideaSlug) {
        const match = ideas.find(i =>
            i.slug === meta.ideaSlug ||
            IdeaManager.generateSlug(i.name) === meta.ideaSlug
        );
        if (match) {
            console.log('[CC] ODRC auto-link: matched by slug:', meta.ideaSlug, '→', match.name);
            return match.id;
        }
        console.log('[CC] ODRC auto-link: slug not found:', meta.ideaSlug);
    }
    
    // Priority 3: App-scoped fallback — try direct appId, then name/key resolution
    if (meta?.appId) {
        let appIdeas = ideas.filter(i => i.appId === meta.appId && i.status === 'active');
        
        // If direct appId match fails, try matching metadata against app keys/names
        if (appIdeas.length === 0 && typeof apps === 'object') {
            const metaAppLower = meta.appId.toLowerCase().trim();
            const matchedAppId = Object.keys(apps).find(id => {
                const app = apps[id];
                return id.toLowerCase() === metaAppLower ||
                    (app.name || '').toLowerCase() === metaAppLower ||
                    (app.project || '').toLowerCase() === metaAppLower;
            });
            if (matchedAppId) {
                appIdeas = ideas.filter(i => i.appId === matchedAppId && i.status === 'active');
                console.log('[CC] ODRC auto-link: app name resolved:', meta.appId, '→', matchedAppId);
            }
        }
        
        if (appIdeas.length > 0) {
            console.log('[CC] ODRC auto-link: app-scope fallback, picked:', appIdeas[appIdeas.length - 1].name);
            return appIdeas[appIdeas.length - 1].id;
        }
    }
    
    console.log('[CC] ODRC auto-link: no match found. metadata:', JSON.stringify(meta));
    return null;
});
```

**Scope check:** The `apps` variable must be accessible. This code runs inside `DashboardView` which receives `apps` as a prop. Verify `apps` is in scope where this component renders. If not, thread it through.

---

### A6: Display Slug on Idea Detail

**Location:** `IdeasView` component (~line 15415+). Find where idea `name` and `description` are displayed in the detail/expanded view.

**Add a read-only slug display after the name:**

```jsx
{idea.slug && (
    <div className="text-xs text-slate-500 font-mono mt-1">
        slug: {idea.slug}
    </div>
)}
```

This helps the user know what slug to use when manually authoring ODRC files outside the brief generation flow.

**Also update** the ODRC Import banner (~line 10549-10553) to show IdeaId when present:

```jsx
// Add before the existing ideaSlug display:
{pendingOdrcImport.metadata?.ideaId && ` · IdeaId: ${pendingOdrcImport.metadata.ideaId}`}
```

---

## Existing Infrastructure Reference

| Component | Location | What to Change |
|-----------|----------|---------------|
| `extractODRCMetadata()` | ~line 2816 | Add `ideaId` parsing (A3) |
| `SessionBriefBuilder.buildTemplateBrief()` | ~line 3189 | Add `# IdeaId:` line (A4) |
| Brief `# Idea:` / `# App:` lines | ~line 3239-3240 | Insert `# IdeaId:` between them (A4) |
| `IdeationBriefGenerator.SYSTEM_PROMPT` | Search for `IdeationBriefGenerator` | Add IdeaId to header block spec (A4) |
| `IDEA_STATUSES`, `IDEA_TYPES` | ~line 5440-5443 | No changes |
| `IdeaManager` object | ~line 5446-5663 | Add `backfillMissingFields()` (A1) |
| `IdeaManager.update()` allowed fields | ~line 5557 | Remove `'slug'` (A2) |
| Auth init / Ideas listener | ~line 6415 | Add backfill call (A1) |
| ODRC Import banner | ~line 10549-10553 | Add IdeaId display (A6) |
| ODRC Import Checklist auto-link | ~line 11928-11941 | Replace matching logic (A5) |
| `IdeasView` Idea detail | ~line 15415+ | Add slug display (A6) |
| `ODRCUpdateIngestionService` | index.html | No changes — already parses all line types correctly |
| `ConceptManager` | index.html | No changes |

---

## Architecture Rules

### Data Model Rules
- `IdeaManager.create()` is NOT modified — it already writes all fields correctly for new Ideas
- Slugs are immutable after creation — do not auto-update on rename
- Backfill is idempotent — safe to run on every app load, skips Ideas that already have all fields
- Multi-path update for backfill — one Firebase write for all Ideas, not N individual writes

### Compatibility Rules
- The enriched metadata (`ideaId`) must not break existing ODRC file parsing — `extractODRCMetadata` returns `null` for missing fields, all downstream consumers already handle nulls
- The `# IdeaId:` header line is a new addition — it is only present in briefs generated after this change. Older ODRC files without it still route via slug or app fallback
- The ODRC Import Checklist UI and concept writing logic are unchanged — only the auto-link initialization changes

### What NOT To Do
- Do NOT change `IdeaManager.create()` — it works correctly
- Do NOT add fuzzy/Levenshtein matching — get exact matching working first
- Do NOT modify ODRC file parsing (`detectODRCContent`, `extractODRCSection`, `parseODRCUpdates`)
- Do NOT touch `ConceptManager` — concept CRUD is unrelated to this task
- Do NOT add a slug-editing UI — that is a separate future task

---

## Testing

### Test 1: Backfill Migration
1. Open CC, sign in
2. Check browser console for: `[CC] Idea backfill: updated N idea(s) with missing fields`
3. Open Firebase Console → `command-center/{uid}/ideas/{ideaKey}`
4. Verify all Ideas now have: `slug`, `sessionLog`, `lastSessionDate`, `phase`, `parentIdeaId`
5. Reload CC — console should show: `[CC] Idea backfill: all ideas up to date` (idempotent)

### Test 2: Slug Immutability
1. Create a new Idea named "Test Slug Stability"
2. Verify slug is generated (e.g., `test-slug-stability`) in Firebase
3. Rename the Idea to "Renamed Idea"
4. Verify slug in Firebase is still `test-slug-stability`

### Test 3: ODRC Import with Backfilled Slug
1. Drop the existing ODRC file (`ODRC-Updates-Stress-Test-Session-1-2026-02-12.md`) into CC
2. File has `# Idea: pitch-challenge-you-have-a-set-amount-of-team-5101520-minute`
3. Verify auto-link matches the backfilled Idea (slug or computed-from-name match)
4. If no match → check console for diagnostic log line showing what was tried

### Test 4: ODRC Import with IdeaId
1. Generate a session brief from CC for any Idea via "Explore in Chat"
2. Verify Expected Output Format includes `# IdeaId: {firebase-key}`
3. Create a test ODRC file using that IdeaId header
4. Drop into CC → verify auto-link succeeds via Priority 1 (IdeaId)

### Test 5: App Name Fallback
1. Create an ODRC file with `# App: Command Center` (display name, not config key)
2. Drop into CC → verify app-name resolution finds `command-center`
3. Verify Ideas filtered to that app's scope

---

## Post-Task Obligations

RULE: Before reporting this task as complete:

1. Verify backfill runs on load and populates missing fields in Firebase
2. Verify slug is NOT updated when an Idea is renamed
3. Verify generated briefs include `# IdeaId:` line
4. Verify ODRC import auto-links correctly with IdeaId, slug, and app fallback
5. Verify `extractODRCMetadata` returns `ideaId` field
6. Commit all code changes
7. Archive this CLAUDE.md to `cc/specs/sp_idea_backfill_odrc_routing.md`
8. Generate completion file to `.cc/completions/`
9. Commit spec archive and completion file separately

**Completion file naming:** `YYYY-MM-DDTHH-MM-SS_idea-backfill-odrc-routing.md`

**Completion file format:**

```yaml
---
task: "Backfill missing Idea fields in Firebase, make slugs immutable, add IdeaId to ODRC header, fix import auto-link cascade"
status: complete | partial
cc-spec-id: sp_idea_backfill_odrc_routing
files:
  - path: "cc/index.html"
    action: modified
commits:
  - sha: "{sha}"
    message: "{message}"
odrc:
  new_decisions:
    - "{any decisions}"
  resolved_opens:
    - "{any resolved}"
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
