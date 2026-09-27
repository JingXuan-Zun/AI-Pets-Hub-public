import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport } from './agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts';

export type AgentSessionV3PilotRealCorpusBatchCloseoutAuditStatus =
  | 'aligned'
  | 'attention-needed';

export interface AgentSessionV3PilotRealCorpusBatchCloseoutAuditDocCoverage {
  docPath: string;
  mentionedSmokeCount: number;
}

export interface AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult {
  cliContractAuditMentionCount: number;
  cliContractSmokeCount: number;
  docCoverage: AgentSessionV3PilotRealCorpusBatchCloseoutAuditDocCoverage[];
  docsChecked: string[];
  guardrail: string;
  indexedSmokeDocMentionCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-closeout-audit';
  missingCliContractAuditMentionCount: number;
  missingCliContractAuditMentionNames: string[];
  missingDocMentionCount: number;
  missingDocMentionNames: string[];
  readyForProductionRuntime: false;
  realSampleGapCount: number;
  reportText: string;
  smokeGroupCounts: Record<string, number>;
  smokeIndexEntryCount: number;
  smokeIndexMissingCount: number;
  smokeIndexUnindexedCount: number;
  status: AgentSessionV3PilotRealCorpusBatchCloseoutAuditStatus;
  statusDashboardSummaryText: string;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchCloseoutAuditOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const DOC_PATHS = [
  'PROJECT_AGENT_V3_PILOT_PLAN.md',
  'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
  'PROJECT_AGENT_V2_STATUS.md',
  'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
];

function readProjectFile(projectRoot: string, relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function createStatus(options: {
  missingCliContractAuditMentionCount: number;
  missingDocMentionCount: number;
  smokeIndexMissingCount: number;
  smokeIndexUnindexedCount: number;
}): AgentSessionV3PilotRealCorpusBatchCloseoutAuditStatus {
  if (
    options.missingCliContractAuditMentionCount > 0
    || options.missingDocMentionCount > 0
    || options.smokeIndexMissingCount > 0
    || options.smokeIndexUnindexedCount > 0
  ) {
    return 'attention-needed';
  }

  return 'aligned';
}

function createDocCoverage(options: {
  docTexts: readonly { path: string; text: string }[];
  smokeNames: readonly string[];
}) {
  return options.docTexts.map((doc) => ({
    docPath: doc.path,
    mentionedSmokeCount: options.smokeNames.filter((name) => doc.text.includes(name)).length,
  }));
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult,
    | 'cliContractAuditMentionCount'
    | 'cliContractSmokeCount'
    | 'indexedSmokeDocMentionCount'
    | 'missingCliContractAuditMentionCount'
    | 'missingDocMentionCount'
    | 'readyForProductionRuntime'
    | 'realSampleGapCount'
    | 'smokeIndexEntryCount'
    | 'smokeIndexMissingCount'
    | 'smokeIndexUnindexedCount'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchCloseoutAudit status=${result.status}`,
    `smokes=${result.smokeIndexEntryCount}`,
    `indexedDocMentions=${result.indexedSmokeDocMentionCount}`,
    `missingDocMentions=${result.missingDocMentionCount}`,
    `cliContractSmokes=${result.cliContractSmokeCount}`,
    `cliContractAuditMentions=${result.cliContractAuditMentionCount}`,
    `missingCliContractAuditMentions=${result.missingCliContractAuditMentionCount}`,
    `missingIndexedSmokes=${result.smokeIndexMissingCount}`,
    `unindexedSmokes=${result.smokeIndexUnindexedCount}`,
    `realSampleGaps=${result.realSampleGapCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult,
    | 'docCoverage'
    | 'guardrail'
    | 'missingCliContractAuditMentionNames'
    | 'missingDocMentionNames'
    | 'smokeGroupCounts'
    | 'statusDashboardSummaryText'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `statusDashboard: ${result.statusDashboardSummaryText}`,
    'smokeGroups:',
    ...Object.entries(result.smokeGroupCounts).map(([group, count]) => `- group=${group} count=${count}`),
    'docCoverage:',
    ...result.docCoverage.map((doc) => `- doc=${doc.docPath} mentionedSmokes=${doc.mentionedSmokeCount}`),
    result.missingDocMentionNames.length ? 'missingDocMentionSmokes:' : 'missingDocMentionSmokes: none',
    ...result.missingDocMentionNames.map((name) => `- ${name}`),
    result.missingCliContractAuditMentionNames.length
      ? 'missingCliContractAuditMentions:'
      : 'missingCliContractAuditMentions: none',
    ...result.missingCliContractAuditMentionNames.map((name) => `- ${name}`),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchCloseoutAudit(
  options: CreateAgentSessionV3PilotRealCorpusBatchCloseoutAuditOptions = {},
): AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
    projectRoot,
  });
  const statusDashboard = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
    projectRoot,
  });
  const docTexts = DOC_PATHS.map((docPath) => ({
    path: docPath,
    text: readProjectFile(projectRoot, docPath),
  }));
  const combinedDocText = docTexts.map((doc) => doc.text).join('\n');
  const smokeNames = smokeIndex.entries.map((entry) => entry.name).sort();
  const cliContractSmokeNames = smokeIndex.entries
    .filter((entry) => entry.group === 'cli-contract')
    .map((entry) => entry.name)
    .sort();
  const cliContractAuditText = readProjectFile(
    projectRoot,
    'scripts/agent-session-v3-pilot-cli-json-contract-coverage-audit-smoke.ts',
  );
  const missingDocMentionNames = smokeNames.filter((name) => !combinedDocText.includes(name));
  const missingCliContractAuditMentionNames = cliContractSmokeNames
    .filter((name) => !cliContractAuditText.includes(name));
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchCloseoutAuditResult = {
    cliContractAuditMentionCount: cliContractSmokeNames.length - missingCliContractAuditMentionNames.length,
    cliContractSmokeCount: cliContractSmokeNames.length,
    docCoverage: createDocCoverage({
      docTexts,
      smokeNames,
    }),
    docsChecked: [...DOC_PATHS],
    guardrail: 'caller-owned closeout audit only; does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    indexedSmokeDocMentionCount: smokeNames.length - missingDocMentionNames.length,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-closeout-audit',
    missingCliContractAuditMentionCount: missingCliContractAuditMentionNames.length,
    missingCliContractAuditMentionNames,
    missingDocMentionCount: missingDocMentionNames.length,
    missingDocMentionNames,
    readyForProductionRuntime: false,
    realSampleGapCount: statusDashboard.gapCount,
    reportText: '',
    smokeGroupCounts: smokeIndex.groupCounts,
    smokeIndexEntryCount: smokeIndex.entryCount,
    smokeIndexMissingCount: smokeIndex.missingCount,
    smokeIndexUnindexedCount: smokeIndex.unindexedCount,
    status: createStatus({
      missingCliContractAuditMentionCount: missingCliContractAuditMentionNames.length,
      missingDocMentionCount: missingDocMentionNames.length,
      smokeIndexMissingCount: smokeIndex.missingCount,
      smokeIndexUnindexedCount: smokeIndex.unindexedCount,
    }),
    statusDashboardSummaryText: statusDashboard.summaryText,
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutText);
  const resultWithReport = {
    ...resultWithoutText,
    reportText: createReportText({
      ...resultWithoutText,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

function runAgentSessionV3PilotRealCorpusBatchCloseoutAuditCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchCloseoutAuditCli();
}
