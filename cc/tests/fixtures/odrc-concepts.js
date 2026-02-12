// Sample ODRC concepts for Firebase seeding
const FIXTURE_CONCEPTS = [
    { id: 'c1', type: 'OPEN', content: 'Shared files not deploying to satellite repos', status: 'active', ideaOrigin: 'idea1', scopeTags: [], specTags: ['sp_deploy_fix'], createdAt: '2026-02-10T10:00:00Z', updatedAt: '2026-02-10T10:00:00Z' },
    { id: 'c2', type: 'RULE', content: 'All shared Firebase-backed data lives as top-level state', status: 'active', ideaOrigin: 'idea1', scopeTags: ['architecture'], createdAt: '2026-02-10T11:00:00Z', updatedAt: '2026-02-10T11:00:00Z' },
    { id: 'c3', type: 'DECISION', content: 'CC validates repo state before placing artifacts', status: 'active', ideaOrigin: 'idea1', scopeTags: ['data-model'], createdAt: '2026-02-10T12:00:00Z', updatedAt: '2026-02-10T12:00:00Z' },
    { id: 'c4', type: 'OPEN', content: 'Deploy manifest does not account for nested shared directories', status: 'active', ideaOrigin: 'idea2', scopeTags: ['architecture'], createdAt: '2026-02-11T10:00:00Z', updatedAt: '2026-02-11T10:00:00Z' },
    { id: 'c5', type: 'CONSTRAINT', content: 'Single-file HTML app architecture', status: 'active', ideaOrigin: 'idea1', scopeTags: ['architecture'], createdAt: '2026-02-10T13:00:00Z', updatedAt: '2026-02-10T13:00:00Z' }
];

const FIXTURE_IDEAS = [
    { id: 'idea1', name: 'Deploy Pipeline Fix', description: 'Fix satellite deployment', type: 'base', status: 'active', appId: 'command-center', sequence: 1, createdAt: '2026-02-10T09:00:00Z', updatedAt: '2026-02-10T09:00:00Z' },
    { id: 'idea2', name: 'Deploy Improvements', description: 'Enhance deploy capabilities', type: 'addon', status: 'active', appId: 'command-center', sequence: 2, parentIdeaId: 'idea1', createdAt: '2026-02-11T09:00:00Z', updatedAt: '2026-02-11T09:00:00Z' }
];
