import { strict as assert } from 'node:assert';
import {
  applyMcpServerDraftToConfigText,
  createEmptyMcpServerDraft,
} from '../src/components/settings/settingsMcpConfigFormUtils';
import {
  createSettingsMcpConfigPreflight,
} from '../src/components/settings/settingsMcpConfigPreflight';
import {
  createSettingsMcpRealServerConfigGuide,
} from '../src/components/settings/settingsMcpRealServerConfigGuide';
import {
  createSettingsMcpReadinessDraftPreview,
} from '../src/components/settings/settingsMcpReadinessDraftPreview';
import {
  createSettingsMcpExternalServerCandidateReview,
} from '../src/components/settings/settingsMcpExternalServerCandidateReview';
import {
  createSettingsMcpSavedConfigReadinessReview,
} from '../src/components/settings/settingsMcpSavedConfigReadinessReview';
import {
  createSettingsMcpServerDraftPreflight,
} from '../src/components/settings/settingsMcpServerDraftPreflight';
import {
  cloneMcpServerTemplateDraft,
  createMcpServerReadyDraftExamples,
  createMcpServerTemplates,
} from '../src/components/settings/settingsMcpServerTemplateUtils';
import { readProjectFile } from './smokeTestHarness.ts';

const emptyGuide = createSettingsMcpRealServerConfigGuide({
  configText: '{"servers":[]}',
  draft: createEmptyMcpServerDraft(),
});
assert.equal(emptyGuide.status, 'blocked');
assert.equal(emptyGuide.readyForReadiness, false);
assert.equal(emptyGuide.steps.find((step) => step.id === 'draft-selected')?.status, 'todo');
assert.equal(emptyGuide.steps.find((step) => step.id === 'config-preflight')?.status, 'blocked');
const emptyPreview = createSettingsMcpReadinessDraftPreview({
  configText: '{"servers":[]}',
  draft: createEmptyMcpServerDraft(),
});
assert.equal(emptyPreview.status, 'todo');
assert.equal(emptyPreview.readyForReadiness, false);
assert.equal(emptyPreview.configStatus, 'not-applied');
const emptySavedReview = createSettingsMcpSavedConfigReadinessReview({
  configText: '{"servers":[]}',
  draft: createEmptyMcpServerDraft(),
});
assert.equal(emptySavedReview.status, 'blocked');
assert.equal(emptySavedReview.canSaveConfig, true);
assert.equal(emptySavedReview.readyForSavedConfigReadiness, false);
assert.equal(emptySavedReview.steps.find((step) => step.id === 'server-candidates')?.status, 'blocked');
const emptyCandidateReview = createSettingsMcpExternalServerCandidateReview('{"servers":[]}');
assert.equal(emptyCandidateReview.status, 'warning');
assert.equal(emptyCandidateReview.candidateCount, 0);
assert.equal(emptyCandidateReview.serverCount, 0);
assert.match(emptyCandidateReview.nextAction, /Add at least one real external MCP server/u);

const npxTemplate = createMcpServerTemplates().find((template) => template.id === 'npx-package');
assert.ok(npxTemplate);
const templateGuide = createSettingsMcpRealServerConfigGuide({
  configText: '{"servers":[]}',
  draft: cloneMcpServerTemplateDraft(npxTemplate),
});
assert.equal(templateGuide.status, 'blocked');
assert.equal(templateGuide.steps.find((step) => step.id === 'replace-placeholders')?.status, 'blocked');
assert.match(templateGuide.summaryText, /draft=blocked/u);
const templatePreview = createSettingsMcpReadinessDraftPreview({
  configText: '{"servers":[]}',
  draft: cloneMcpServerTemplateDraft(npxTemplate),
});
assert.equal(templatePreview.status, 'blocked');
assert.match(templatePreview.blocker, /Replace template/u);
const templateCandidateReview = createSettingsMcpExternalServerCandidateReview(JSON.stringify({
  servers: [{
    args: ['-y', '@vendor/real-mcp-server'],
    command: 'npx.cmd',
    env: { API_KEY: 'replace-me' },
    id: 'npx-package-server',
  }],
}));
assert.equal(templateCandidateReview.status, 'blocked');
assert.equal(templateCandidateReview.rows[0]?.status, 'template');
assert.equal(templateCandidateReview.candidateCount, 0);

const readyDraft = {
  argsText: 'server.js',
  command: 'node',
  cwd: '',
  envJson: '{}',
  id: 'ready-server',
  title: 'Ready server',
};
const applied = applyMcpServerDraftToConfigText('{"servers":[]}', readyDraft);
assert.equal(applied.error, null);
const readyGuide = createSettingsMcpRealServerConfigGuide({
  configText: applied.rawText,
  draft: readyDraft,
});
assert.equal(readyGuide.status, 'ready');
assert.equal(readyGuide.readyForReadiness, true);
assert.equal(readyGuide.steps.every((step) => step.status === 'ready'), true);
assert.equal(readyGuide.steps.find((step) => step.id === 'run-readiness')?.status, 'ready');
const readySavedReview = createSettingsMcpSavedConfigReadinessReview({
  configText: applied.rawText,
  draft: readyDraft,
});
assert.equal(readySavedReview.status, 'ready');
assert.equal(readySavedReview.readyForSavedConfigReadiness, true);
assert.match(readySavedReview.summaryText, /MCPSavedConfigReadinessReview status=ready/u);
const readyCandidateReview = createSettingsMcpExternalServerCandidateReview(applied.rawText);
assert.equal(readyCandidateReview.status, 'ready');
assert.equal(readyCandidateReview.candidateCount, 1);
assert.equal(readyCandidateReview.rows[0]?.status, 'candidate');
assert.match(readyCandidateReview.summaryText, /candidates=1\/1/u);
const readyPreview = createSettingsMcpReadinessDraftPreview({
  configText: '{"servers":[]}',
  draft: readyDraft,
});
assert.equal(readyPreview.status, 'ready');
assert.equal(readyPreview.readyForReadiness, true);
assert.match(readyPreview.summaryText, /MCPReadinessDraftPreview status=ready/u);
const unappliedDraftReview = createSettingsMcpSavedConfigReadinessReview({
  configText: '{"servers":[]}',
  draft: readyDraft,
});
assert.equal(unappliedDraftReview.status, 'blocked');
assert.equal(unappliedDraftReview.steps.find((step) => step.id === 'draft-applied')?.status, 'warning');

const warningPreview = createSettingsMcpReadinessDraftPreview({
  configText: '{"servers":[]}',
  draft: { ...readyDraft, argsText: '', command: 'node', id: 'warning-server' },
});
assert.equal(warningPreview.status, 'warning');
assert.equal(warningPreview.readyForReadiness, false);
const fixtureReview = createSettingsMcpSavedConfigReadinessReview({
  configText: JSON.stringify({
    servers: [{
      args: ['scripts/fixtures/fake-mcp-server.cjs'],
      command: 'node',
      id: 'fixture-server',
    }],
  }),
  draft: createEmptyMcpServerDraft(),
});
assert.equal(fixtureReview.status, 'warning');
assert.equal(fixtureReview.readyForSavedConfigReadiness, false);
const fixtureCandidateReview = createSettingsMcpExternalServerCandidateReview(JSON.stringify({
  servers: [{
    args: ['scripts/fixtures/fake-mcp-server.cjs'],
    command: 'node',
    id: 'fixture-server',
  }],
}));
assert.equal(fixtureCandidateReview.status, 'warning');
assert.equal(fixtureCandidateReview.candidateCount, 0);
assert.equal(fixtureCandidateReview.rows[0]?.status, 'fixture');
const referenceCandidateReview = createSettingsMcpExternalServerCandidateReview(JSON.stringify({
  servers: [{
    args: ['scripts/reference-mcp-stdio-server.cjs'],
    command: 'node',
    id: 'reference-server',
  }],
}));
assert.equal(referenceCandidateReview.status, 'warning');
assert.equal(referenceCandidateReview.rows[0]?.status, 'reference');

const readyDraftExample = createMcpServerReadyDraftExamples()[0];
assert.ok(readyDraftExample);
assert.equal(JSON.stringify(readyDraftExample).includes('replace-me'), false);
assert.equal(JSON.stringify(readyDraftExample).includes('@vendor'), false);
assert.equal(createSettingsMcpServerDraftPreflight(readyDraftExample.draft).status, 'ready');
const readyDraftApplied = applyMcpServerDraftToConfigText('{"servers":[]}', readyDraftExample.draft);
assert.equal(readyDraftApplied.error, null);
assert.equal(createSettingsMcpConfigPreflight(readyDraftApplied.rawText).status, 'ready');
const readyDraftGuide = createSettingsMcpRealServerConfigGuide({
  configText: readyDraftApplied.rawText,
  draft: readyDraftExample.draft,
});
assert.equal(readyDraftGuide.readyForReadiness, true);

const guideSource = readProjectFile('src/components/settings/settingsMcpRealServerConfigGuide.ts');
const panelSource = readProjectFile('src/components/settings/SettingsMcpRealServerConfigGuidePanel.tsx');
const savedReviewPanelSource = readProjectFile('src/components/settings/SettingsMcpSavedConfigReadinessReviewPanel.tsx');
const savedReviewSource = readProjectFile('src/components/settings/settingsMcpSavedConfigReadinessReview.ts');
const candidateReviewPanelSource = readProjectFile('src/components/settings/SettingsMcpExternalServerCandidateReviewPanel.tsx');
const candidateReviewSource = readProjectFile('src/components/settings/settingsMcpExternalServerCandidateReview.ts');
const previewPanelSource = readProjectFile('src/components/settings/SettingsMcpReadinessDraftPreviewPanel.tsx');
const previewSource = readProjectFile('src/components/settings/settingsMcpReadinessDraftPreview.ts');
const editorBlockSource = readProjectFile('src/components/settings/SettingsMcpConfigEditorBlock.tsx');
const templatePanelSource = readProjectFile('src/components/settings/SettingsMcpServerTemplatePanel.tsx');
const templateUtilsSource = readProjectFile('src/components/settings/settingsMcpServerTemplateUtils.ts');
assert.match(guideSource, /MCPRealServerConfigGuide/u);
assert.match(guideSource, /replace-placeholders/u);
assert.match(guideSource, /run-readiness/u);
assert.match(panelSource, /Real server setup/u);
assert.match(panelSource, /draft \{guide\.draftStatus\} \/ config \{guide\.configStatus\}/u);
assert.match(panelSource, /SettingsMcpReadinessDraftPreviewPanel/u);
assert.match(previewPanelSource, /Draft readiness preview/u);
assert.match(previewSource, /MCPReadinessDraftPreview/u);
assert.match(previewSource, /applyMcpServerDraftToConfigText/u);
assert.match(editorBlockSource, /SettingsMcpRealServerConfigGuidePanel/u);
assert.match(editorBlockSource, /SettingsMcpSavedConfigReadinessReviewPanel/u);
assert.match(savedReviewSource, /MCPSavedConfigReadinessReview/u);
assert.match(savedReviewSource, /readyForSavedConfigReadiness/u);
assert.match(savedReviewSource, /readiness-source/u);
assert.match(savedReviewPanelSource, /Saved-config readiness review/u);
assert.match(savedReviewPanelSource, /readiness=\{review\.readyForSavedConfigReadiness/u);
assert.match(candidateReviewSource, /MCPExternalServerCandidateReview/u);
assert.match(candidateReviewSource, /candidateCount/u);
assert.match(candidateReviewSource, /fixture/u);
assert.match(candidateReviewSource, /reference/u);
assert.match(candidateReviewPanelSource, /External server candidates/u);
assert.match(candidateReviewPanelSource, /static review/u);
assert.match(editorBlockSource, /SettingsMcpExternalServerCandidateReviewPanel/u);
assert.doesNotMatch(candidateReviewPanelSource, /desktopPetShellRuntime/u);
assert.doesNotMatch(candidateReviewPanelSource, /child_process/u);
assert.doesNotMatch(candidateReviewPanelSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(candidateReviewPanelSource, /\bspawn(Sync)?\b/u);
assert.match(templatePanelSource, /Ready draft examples/u);
assert.match(templatePanelSource, /createMcpServerReadyDraftExamples/u);
assert.match(templateUtilsSource, /static-ready-npx-filesystem/u);
assert.match(templateUtilsSource, /@modelcontextprotocol\/server-filesystem/u);

console.log('agent MCP real-server config guide UI smoke passed');
