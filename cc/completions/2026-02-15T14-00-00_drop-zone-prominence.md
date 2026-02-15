---
task: "Make drop zone more prominent and discoverable"
status: complete
cc-spec-id: null
files:
  - path: "index.html"
    action: modified
commits:
  - sha: "88fa6f0"
    message: "Make drop zone more prominent with larger target, cloud icon, gradient (v8.69.4)"
odrc:
  new_decisions:
    - "Drop zone uses indigo gradient background instead of plain dashed border"
    - "Cloud upload SVG icon in a circular container provides visual anchor"
    - "Two-line text hierarchy: bold action text + muted file type description"
    - "Drag-over animation uses scale transform + box shadow instead of just border color change"
  resolved_opens: []
  new_opens: []
unexpected_findings:
  - "User feedback confirmed the original slim dashed border with muted text was easily overlooked"
unresolved: []
---

## Before vs After

**Before:** Slim `py-3` dashed border, `border-slate-600` (barely visible on dark bg), single line of muted `text-slate-400` text, small Upload icon. Blended into the surrounding dark theme.

**After:**
- `py-5 px-6` padding — larger click/drop target
- Indigo gradient background: `linear-gradient(135deg, rgba(79,70,229,0.06), rgba(139,92,246,0.06))`
- Dashed border in `#4f46e5` (indigo) — visible against dark bg
- Cloud upload SVG in a 40px circular indigo container
- Bold `text-slate-200` action text: "Drop files here or click to upload"
- Descriptive subtext: "Session packages (.zip) • Deploy files • Specs & docs"
- Drag-over: `scale-[1.02]` transform + `shadow-lg shadow-indigo-500/20` glow
- `group-hover` brightness increase on icon container
