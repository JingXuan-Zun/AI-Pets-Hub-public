import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS,
  createAgentSessionV3PilotRealCorpusBatchSampleNoteReportFromText,
  runAgentSessionV3PilotRealCorpusBatchSampleNoteReport,
} from './agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { sampleNoteReportSource } = readProjectSources({
  sampleNoteReportSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
});

assert.match(
  sampleNoteReportSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchSampleNoteReport/u,
  'real corpus batch sample note report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  sampleNoteReportSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch sample note report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  sampleNoteReportSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch sample note report should not encode a fixed desktop tool chain.',
);

const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate();
const openReport = createAgentSessionV3PilotRealCorpusBatchSampleNoteReportFromText({
  includeJsonText: true,
  notePath: 'sample-note-template.md',
  noteText: intakeTemplate.noteText,
  prettyJson: true,
});

assert.equal(openReport.kind, 'agent-session-v3-pilot-real-corpus-batch-sample-note-report');
assert.equal(openReport.version, 1);
assert.equal(openReport.notePresent, true);
assert.equal(openReport.status, 'open-items');
assert.ok(openReport.openItemCount >= 10);
assert.ok(openReport.openItems.some((item) => item.id === 'sample-count'));
assert.ok(openReport.openItems.some((item) => item.id === 'p0-production-like-signal'));
assert.ok(openReport.openItems.some((item) => item.id === 'p0-real-exported-signal'));
assert.ok(openReport.openItems.some((item) => item.id === 'threshold-action'));
assert.match(openReport.summaryText, /status=open-items/u);
assert.match(openReport.summaryText, /notePresent=yes/u);
assert.match(openReport.reportText, /sampleNoteOpenItems:/u);
assert.match(openReport.reportText, /sample-count/u);
assert.match(openReport.reportText, /p0-production-like-signal/u);
assert.match(openReport.reportText, /p0-real-exported-signal/u);
assert.ok(openReport.jsonText);
assert.match(openReport.jsonText, /agent-session-v3-pilot-real-corpus-batch-sample-note-report/u);

let completedNoteText = intakeTemplate.noteText;
for (const check of AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS) {
  completedNoteText = completedNoteText.replaceAll(check.placeholder, `filled-${check.id}`);
}

const completeReport = createAgentSessionV3PilotRealCorpusBatchSampleNoteReportFromText({
  notePath: 'sample-note-template.md',
  noteText: completedNoteText,
});

assert.equal(completeReport.status, 'complete');
assert.equal(completeReport.openItemCount, 0);
assert.deepEqual(completeReport.openItems, []);
assert.match(completeReport.summaryText, /status=complete/u);
assert.match(completeReport.reportText, /sampleNoteOpenItems: none/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-sample-note-report-'));
try {
  const notePath = path.join(tempDir, 'sample-note-template.md');
  await writeFile(notePath, intakeTemplate.noteText, 'utf8');

  const fileReport = await runAgentSessionV3PilotRealCorpusBatchSampleNoteReport({
    includeJsonText: true,
    notePath,
    prettyJson: true,
  });

  assert.equal(fileReport.status, 'open-items');
  assert.equal(fileReport.notePath, notePath);
  assert.equal(fileReport.notePresent, true);
  assert.ok(fileReport.openItemCount >= 10);
  assert.ok(fileReport.jsonText);

  const missingReport = await runAgentSessionV3PilotRealCorpusBatchSampleNoteReport({
    includeJsonText: true,
    notePath: path.join(tempDir, 'missing-note.md'),
    prettyJson: true,
  });

  assert.equal(missingReport.status, 'missing');
  assert.equal(missingReport.notePresent, false);
  assert.equal(missingReport.openItemCount, 0);
  assert.match(missingReport.summaryText, /status=missing/u);
  assert.match(missingReport.reportText, /sampleNoteOpenItems: none/u);
  assert.ok(missingReport.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch sample note report smoke ok');
