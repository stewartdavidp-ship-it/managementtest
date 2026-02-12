// Sample completion files as they would appear in cc/completions/
const FIXTURE_COMPLETION_FILES = {
    planned: {
        fileName: '2026-02-12T14-30-00_fix-shared-deploy.md',
        content: `---
task: "Fix shared file deployment — cc-shared.css and cc-shared.js were not being copied to satellite repos"
status: complete
files:
  - path: "src/deploy.js"
    action: modified
  - path: "shared/cc-shared.css"
    action: modified
commits:
  - sha: "a1b2c3d"
    message: "Add shared directory to satellite deploy manifest"
odrc:
  resolved_opens:
    - "Shared files not deploying to satellite repos"
  applied_decisions:
    - "CC validates repo state before placing artifacts"
unexpected_findings:
  - "Deploy script had no error handling for missing source files"
unresolved:
  - item: "Deploy script lacks error handling"
    reason: "Separate concern, flagged for follow-up"
---

## Approach
Fixed the deploy manifest to include shared directory.
`,
        specId: 'sp_deploy_fix'
    },

    unplanned: {
        fileName: '2026-02-12T16-00-00_css-cleanup.md',
        content: `---
task: "Clean up stale CSS references across satellite apps"
status: complete
files:
  - path: "shared/cc-shared.css"
    action: modified
commits:
  - sha: "e4f5g6h"
    message: "Remove stale font references from shared CSS"
---

## Approach
Found and removed references to fonts removed in v8.47.
`,
        specId: null
    },

    partial: {
        fileName: '2026-02-12T18-00-00_api-migration.md',
        content: `---
task: "Migrate API calls from v1 to v2 endpoints"
status: partial
files:
  - path: "src/api.js"
    action: modified
commits:
  - sha: "i7j8k9l"
    message: "Migrate auth endpoints to v2"
unresolved:
  - item: "Data endpoints still on v1"
    reason: "Requires schema changes not yet approved"
---

## Approach
Started with auth endpoints as they have no schema dependencies.
`
    },

    invalidYaml: {
        fileName: '2026-02-12T19-00-00_bad-format.md',
        content: `---
task: Missing closing quote
status: complete
---
This file has invalid YAML.
`
    }
};
