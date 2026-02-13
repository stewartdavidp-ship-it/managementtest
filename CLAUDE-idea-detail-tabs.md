# CLAUDE.md — Idea Detail Tabbed Concept Layout
# cc-spec-id: bug_idea_detail_tabs
# App: Command Center (index.html)
# Base version: 8.64.1
# Target version: +0.0.1
# Depends on: none

---

## Task Summary

Replace the stacked concept groups in Idea Detail (Mode 3) with a tabbed layout. The current implementation lists all four ODRC types as consecutive collapsible sections which becomes unusable with 10+ concepts. The design session selected a tabbed approach with ODRC ordering: Opens → Decisions → Rules → Constraints.

---

## What's Broken

**Location:** IdeasView, Mode 3 (Idea Detail), ~line 16148-16151

```javascript
// CURRENT — stacked groups, all visible at once:
{ODRC_TYPES.map(type => renderConceptGroup(type, ideaConcepts, false))}
```

With 16+ concepts on a single Idea (which is now common after the batch import), this produces a very long scrollable column. The design session explored three layouts (columns, tabs, collapsible sections) and selected **tabs** because:
- Columns waste horizontal space when a type has few items
- Collapsible sections still require scrolling past closed groups
- Tabs keep one type in focus and show counts on each tab

---

## What to Build

### T1: Tab State

Add local state for the active ODRC tab inside the `mode === 'idea-detail'` block. Default to `'OPEN'` since unresolved OPENs are the primary driver of next actions.

```javascript
const [activeConceptTab, setActiveConceptTab] = React.useState('OPEN');
```

### T2: Summary Bar

Above the tabs, add a concept summary bar showing counts for each type. This gives at-a-glance completeness without switching tabs.

```
📊 11 concepts: 4 Opens (1 resolved) · 6 Decisions · 1 Rule · 0 Constraints
```

Use the existing `TYPE_STYLES` object for color coding. Show resolved count parenthetically on Opens only.

### T3: Tab Bar

Replace the `ODRC_TYPES.map(type => renderConceptGroup(...))` block with a tab bar + tab panel.

**Tab bar design** — follows CC's existing dark theme:
- Four tabs in ODRC order: Opens, Decisions, Rules, Constraints
- Each tab shows: type icon (from TYPE_STYLES) + label + count badge
- Active tab: indigo bottom border or highlight matching existing CC tab patterns
- Tabs with zero concepts: still visible but muted/grayed
- If current tab has 0 items and another tab has items, auto-switch to the tab with the most items on initial render

```jsx
<div className="flex gap-1 border-b border-slate-700 mb-3">
    {ODRC_TYPES.map(type => {
        const count = ideaConcepts.filter(c => c.type === type).length;
        const active = count > 0 ? ideaConcepts.filter(c => c.type === type && c.status === 'active').length : 0;
        const style = TYPE_STYLES[type];
        return (
            <button key={type}
                onClick={() => setActiveConceptTab(type)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeConceptTab === type
                        ? 'border-indigo-400 text-white'
                        : count > 0
                            ? 'border-transparent text-slate-400 hover:text-slate-200'
                            : 'border-transparent text-slate-600'
                }`}>
                <span>{style.icon}</span> {type}s
                <span className="ml-1.5 px-1.5 py-0.5 bg-slate-700 rounded text-xs">{count}</span>
            </button>
        );
    })}
</div>
```

### T4: Tab Panel

Below the tab bar, render only the concepts for the active tab using the existing `renderConceptGroup()` helper. The helper already handles empty states (returns null).

```jsx
{renderConceptGroup(activeConceptTab, ideaConcepts, false) || (
    <div className="text-center py-8 text-slate-500">
        No {activeConceptTab.toLowerCase()}s in this idea
    </div>
)}
```

### T5: Concept Filters

Add a filter bar above the tab bar with two controls:

**Text filter:** Simple text input, filters concept `content` by case-insensitive substring. Updates tab counts to reflect filtered results. Persists across tab switches. Clear button (×) to reset.

**Status filter:** Dropdown or toggle — All / Active / Resolved. Default to "All". This replaces the Opens-specific sub-filter idea since status filtering is useful across all types, not just Opens.

Keep it minimal. As usage patterns emerge, we'll add whatever's actually needed.

---

## What NOT to Do

- Do NOT change the ConceptCard component — it works fine
- Do NOT change renderConceptGroup() — reuse it as-is for each tab panel
- Do NOT change Mode 1 (All Concepts) or Mode 2 (App Aggregate) tab structure — tabs are only for Mode 3 (Idea Detail)
- DO add the search bar to all three modes — Mode 1 searches all concepts, Mode 2 searches app-scoped concepts, Mode 3 searches idea-scoped concepts
- Do NOT add tabs to the concept edit/transition/explore modals

---

## Reference: Design Prototype

The selected design from the prototyping session used:
- Dark background matching CC theme (#1a1a2e)
- Tab buttons with colored dots matching type colors (amber=OPEN, blue=DECISION, red=RULE, gray=CONSTRAINT)
- Count badges on each tab
- Summary bar above tabs with total + per-type breakdown
- Expandable concept rows (already implemented via ConceptCard)
- Opens tab had a sub-filter: All / Unresolved / Resolved

---

## Testing

1. Navigate to IdeasView → select an Idea with 10+ concepts
2. Verify four tabs appear with correct counts
3. Click each tab — verify only that type's concepts show
4. Verify Opens tab shows first by default
5. Verify empty tab shows "No {type}s" message
6. Verify tab persists when adding/editing/deleting a concept (doesn't reset to Opens)
7. Test with the Architecture Rules idea (11 RULEs, 1 DECISION, 4 OPENs) — should default to Opens, switching to Rules should show 11 items

---

## Post-Task Obligations

RULE: Before reporting this task as complete:
1. Commit code
2. Archive this CLAUDE.md to `cc/specs/bug_idea_detail_tabs.md`
3. Generate completion file to `cc/completions/`
4. Commit spec archive and completion file separately
