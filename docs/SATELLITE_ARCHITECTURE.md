# Command Center — Satellite Architecture

## Overview

Command Center uses a satellite architecture where the core app (`index.html`) handles deploys, session management, and configuration, while specialized feature groups are extracted into standalone satellite apps that share credentials and design tokens.

**Core:** `/command-center/index.html` (~20K lines)
**Satellites:** `/command-center/{satellite}/index.html` (3–7K lines each)
**Shared:** `/command-center/shared/cc-shared.css` + `cc-shared.js`

## Architecture Diagram

```
command-center/
├── index.html                  ← CC Core (deploys, sessions, backlog, settings)
├── shared/
│   ├── cc-shared.css           ← Design tokens, component styles (~400 lines)
│   └── cc-shared.js            ← Secrets reader, Firebase init, header components (~330 lines)
├── infrastructure/
│   └── index.html              ← Infrastructure satellite (repos, Firebase, domains)
├── quality/
│   └── index.html              ← Quality satellite (issues, releases, archive)
└── analytics/
    └── index.html              ← Analytics satellite (portfolio, users, streams, briefs)
```

## How Satellites Work

### Credential Sharing

CC Core writes credentials to `localStorage` under `gs_*` keys:
- `gs_github_token` — GitHub Personal Access Token
- `gs_firebase_sa` — Firebase Service Account JSON
- `gs_firebase_uid` — Authenticated user's Firebase UID
- `gs_config` — App/project configuration object
- `gs_api_key` — Anthropic API key

Satellites read these via the `CC` object from `cc-shared.js`:
```javascript
const token = CC.getGitHubToken();
const sa = CC.getFirebaseSA();
const uid = CC.getFirebaseUid();
```

If credentials are missing, satellites show the `MissingCredentials` component with a link back to CC Core Settings.

### Shared Design System

All satellites load `cc-shared.css` for consistent dark-mode styling:
```html
<link rel="stylesheet" href="../shared/cc-shared.css">
```

CSS custom properties (`--cc-*`) define the palette. Satellites can override them:
```css
:root { --cc-accent: #10b981; } /* Override accent to green */
```

### Firebase Initialization

Satellites that need Firebase call the shared initializer:
```javascript
const { db, auth } = initFirebase(CC);
```

This reads the service account from `CC.getFirebaseSA()` and initializes the Firebase Admin SDK.

### Navigation Between Apps

- **CC Core → Satellite:** The satellite launcher (🛰️ dropdown) in CC Core's header opens satellites in new tabs.
- **Satellite → CC Core:** Each satellite has a header with the CC logo that links back to Core. The `CC.getCoreUrl()` method resolves the correct path.
- **Satellite → Satellite:** Not currently implemented; each satellite operates independently.

## Building a New Satellite

### 1. Create the File

```
command-center/
└── my-satellite/
    └── index.html
```

### 2. HTML Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CC — My Satellite</title>
    <link rel="stylesheet" href="../shared/cc-shared.css">
    <!-- Tailwind CDN for utility classes -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="cc-body">
    <div id="root"></div>

    <!-- React + Babel -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <!-- Firebase (if needed) -->
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

    <!-- CC Shared -->
    <script src="../shared/cc-shared.js"></script>

    <script type="text/babel">
        function App() {
            const [ready, setReady] = React.useState(false);

            // Check credentials
            const token = CC.getGitHubToken();
            const sa = CC.getFirebaseSA();

            if (!token || !sa) {
                return <MissingCredentials satelliteName="My Satellite" />;
            }

            return (
                <div className="min-h-screen" style={{ background: 'var(--cc-bg-body)' }}>
                    <SatelliteHeader name="My Satellite" icon="🔮" />
                    <main className="max-w-6xl mx-auto px-6 py-6">
                        {/* Your content here */}
                    </main>
                </div>
            );
        }

        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    </script>
</body>
</html>
```

### 3. Register in CC Core

Add to `DEFAULT_APP_DEFINITIONS` in CC Core's `CC_SEED_MANIFEST`:
```javascript
'cc-my-satellite': {
    id: 'cc-my-satellite',
    name: 'My Satellite',
    icon: '🔮',
    appType: 'internal',
    project: 'command-center',
    // ...
}
```

Add to the satellite launcher array in CC Core's nav:
```javascript
{ id: 'my-satellite', icon: '🔮', label: 'My Satellite', desc: 'Description', ready: true }
```

### 4. Copy Services from Core

Satellites need their own copies of any Firebase services they use. Pattern:
- Copy the service definition from CC Core
- Keep only the methods the satellite actually calls
- Initialize with the satellite's own Firebase instance

Example — a minimal WorkItemService for read-only access:
```javascript
const WorkItemService = {
    listen(uid, callback) {
        const ref = db.ref(`command-center/${uid}/backlog`);
        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            callback(data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : []);
        });
        return () => ref.off();
    }
};
```

## Conventions

### File Size Targets
- Core: ≤ 20,000 lines
- Each satellite: ≤ 7,000 lines
- Shared CSS: ≤ 500 lines
- Shared JS: ≤ 500 lines

### What Stays in Core
- Deploy workflow (file drop, staging, GitHub Pages push, promotion)
- Session management (Claude Prep, Session Launch, Session Log)
- Backlog / Work items (CRUD + status transitions)
- Settings and credential management
- App/project configuration
- Satellite launcher nav

### What Goes in Satellites
- Feature-heavy views that aren't part of the daily deploy/session loop
- Read-heavy dashboards and analytics
- Administrative tools (repo management, DNS, Firebase config)
- Archive management and release coordination

### Naming
- Satellite folder name matches the satellite launcher ID: `infrastructure/`, `quality/`, `analytics/`
- CSS classes use `.cc-` prefix
- localStorage keys use `gs_` prefix (shared) or `cc_` prefix (core-only)
- Firebase paths use `command-center/{uid}/` prefix

### Styling
- Use Tailwind utility classes for layout
- Use `cc-shared.css` component classes for buttons, cards, modals, etc.
- Use CSS custom properties (`--cc-*`) for theme colors
- Dark mode only — the design system is optimized for dark backgrounds

## Current Satellites

| Satellite | Path | Lines | Purpose |
|-----------|------|-------|---------|
| Infrastructure | `/infrastructure/` | ~7,000 | Repo health, Firebase console, domain management, GitHub token management |
| Quality | `/quality/` | ~3,700 | Issue tracking, release coordination, gs-active archive management |
| Analytics | `/analytics/` | ~4,000 | Portfolio dashboard, user stats, work streams, product briefs, activity feed |

## History

The satellite architecture was implemented across Sessions 1–7 (v8.49.0 – v8.54.0):

| Session | Version | Focus | Core Lines |
|---------|---------|-------|-----------|
| 1 | v8.49.0 | Shared foundation + secrets migration | 31,760 |
| 2 | v8.49.1 | Infrastructure satellite built | 31,780 |
| 3 | v8.50.0 | Infrastructure extracted from core | 25,750 |
| 4 | v8.51.0 | Quality satellite built + extracted | 23,150 |
| 5 | v8.52.0 | Analytics satellite built + extracted | 20,285 |
| 6 | v8.53.0 | Dashboard workflow (Launch & Land) | 20,350 |
| 7 | v8.54.0 | Polish + documentation | ~20,300 |

Total reduction: **31,774 → ~20,300 lines (-36%)** while adding ~15,000 lines of satellite functionality.
