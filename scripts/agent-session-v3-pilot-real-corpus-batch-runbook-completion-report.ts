import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit,
  type AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry,
} from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeValidator,
  type AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
} from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';

export type AgentSessionV3PilotRealCorpusBatchRunbookCompletionStatus =
  | 'blocked'
  | 'no-intake-dirs'
  | 'ready-for-manual-review'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionStatus =
  | 'blocked'
  | 'complete'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionId =
  | 'batch-index'
  | 'field-completeness'
  | 'manifest-sources'
  | 'operator-checklist'
  | 'runtime-authority'
  | 'validator-runnable';

export interface AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterion {
  detail: string;
  id: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionId;
  status: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionStatus;
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry {
  criteria: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterion[];
  intakeDir: string;
  status: Exclude<AgentSessionV3PilotRealCorpusBatchRunbookCompletionStatus, 'no-intake-dirs'>;
  summaryText: string;
}

export interface AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult {
  blockedCriteriaCount: number;
  criteriaCount: number;
  guardrail: string;
  intakeCount: number;
  intakeEntries: AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report';
  readyCriteriaCount: number;
  readyForProductionRuntime: false;
  reportText: string;
  reviewCriteriaCount: number;
  status: AgentSessionV3PilotRealCorpusBatchRunbookCompletionStatus;
  statusCounts: Record<Exclude<AgentSessionV3PilotRealCorpusBatchRunbookCompletionStatus, 'no-intake-dirs'>, number>;
  summaryText: string;
  version: 1;
}

export interface RunAgentSessionV3PilotRealCorpusBatchRunbookCompletionReportOptions {
  includeJsonText?: boolean;
  intakeDirs?: readonly string[];
  prettyJson?: boolean;
  projectRoot?: string;
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchRunbookCompletionReportOptions {
  const intakeDirs: string[] = [];
  let includeJsonText = false;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing intake directory after --dir.');
      }
      intakeDirs.push(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    intakeDirs,
    prettyJson,
  };
}

function createCriterion(options: {
  detail: string;
  id: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionId;
  status: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionStatus;
  title: string;
}): AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterion {
  return options;
}

function createFieldCompletenessCriterion(
  fieldEntry: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry | null,
) {
  if (!fieldEntry) {
    return createCriterion({
      detail: 'field completeness audit did not return an entry for this explicit intake directory',
      id: 'field-completeness',
      status: 'blocked',
      title: 'Check sample-note, manifest, and index fields',
    });
  }
  if (fieldEntry.status !== 'complete') {
    return createCriterion({
      detail: `field audit status=${fieldEntry.status}, open=${fieldEntry.openFieldCount}, missing=${fieldEntry.missingFieldCount}, placeholder=${fieldEntry.placeholderFieldCount}, unreadable=${fieldEntry.unreadableFieldCount}`,
      id: 'field-completeness',
      status: 'blocked',
      title: 'Check sample-note, manifest, and index fields',
    });
  }

  return createCriterion({
    detail: `all ${fieldEntry.requiredFieldCount} required field(s) are complete`,
    id: 'field-completeness',
    status: 'complete',
    title: 'Check sample-note, manifest, and index fields',
  });
}

function createManifestSourcesCriterion(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
) {
  if (validator.status === 'missing' || validator.status === 'empty') {
    return createCriterion({
      detail: `validator status=${validator.status}, manifestSources=${validator.manifestReport?.sourceCount ?? 0}, pathHealth=${validator.pathHealthReport.status}`,
      id: 'manifest-sources',
      status: 'blocked',
      title: 'Point manifest at exported corpus files',
    });
  }
  if (validator.pathHealthReport.status !== 'healthy' || (validator.manifestReport?.sourceCount ?? 0) === 0) {
    return createCriterion({
      detail: `pathHealth=${validator.pathHealthReport.status}, pathIssues=${validator.pathIssueCount}, manifestSources=${validator.manifestReport?.sourceCount ?? 0}`,
      id: 'manifest-sources',
      status: 'blocked',
      title: 'Point manifest at exported corpus files',
    });
  }

  return createCriterion({
    detail: `manifestSources=${validator.manifestReport?.sourceCount ?? 0}, pathHealth=${validator.pathHealthReport.status}`,
    id: 'manifest-sources',
    status: 'complete',
    title: 'Point manifest at exported corpus files',
  });
}

function createBatchIndexCriterion(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
) {
  if (
    validator.consistencyReport.status !== 'consistent'
    || !validator.consistencyReport.baselineEntryPresent
    || !validator.consistencyReport.currentManifestReferenced
  ) {
    return createCriterion({
      detail: `consistency=${validator.consistencyReport.status}, baseline=${validator.consistencyReport.baselineEntryPresent ? 'yes' : 'no'}, realManifest=${validator.consistencyReport.currentManifestReferenced ? 'yes' : 'no'}, issues=${validator.consistencyIssueCount}`,
      id: 'batch-index',
      status: 'blocked',
      title: 'Group baseline and production-like manifests',
    });
  }

  return createCriterion({
    detail: `indexManifests=${validator.indexReport?.manifestCount ?? 0}, consistency=${validator.consistencyReport.status}`,
    id: 'batch-index',
    status: 'complete',
    title: 'Group baseline and production-like manifests',
  });
}

function createValidatorCriterion(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
) {
  if (validator.status === 'missing' || validator.status === 'empty') {
    return createCriterion({
      detail: `validator status=${validator.status}; required files or usable evidence are not present`,
      id: 'validator-runnable',
      status: 'blocked',
      title: 'Run validator without missing or empty status',
    });
  }
  if (validator.status === 'not-ready') {
    return createCriterion({
      detail: `validator status=${validator.status}; failed checks are visible for manual repair before interpretation`,
      id: 'validator-runnable',
      status: 'review-needed',
      title: 'Run validator without missing or empty status',
    });
  }

  return createCriterion({
    detail: `validator status=${validator.status}, manifestSources=${validator.manifestReport?.sourceCount ?? 0}, indexManifests=${validator.indexReport?.manifestCount ?? 0}`,
    id: 'validator-runnable',
    status: 'complete',
    title: 'Run validator without missing or empty status',
  });
}

function createOperatorChecklistCriterion(
  checklist: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
) {
  if (checklist.status === 'blocked') {
    return createCriterion({
      detail: `operator checklist has ${checklist.blockerCount} blocker item(s) and ${checklist.reviewCount} review item(s)`,
      id: 'operator-checklist',
      status: 'blocked',
      title: 'Clear operator checklist blockers',
    });
  }
  if (checklist.status === 'review-needed') {
    return createCriterion({
      detail: `operator checklist has ${checklist.reviewCount} review item(s) and no blockers`,
      id: 'operator-checklist',
      status: 'review-needed',
      title: 'Clear operator checklist blockers',
    });
  }

  return createCriterion({
    detail: 'operator checklist is ready for manual review with no blocker or review items',
    id: 'operator-checklist',
    status: 'complete',
    title: 'Clear operator checklist blockers',
  });
}

function createRuntimeAuthorityCriterion() {
  return createCriterion({
    detail: 'runbook completion report is manual evidence only and keeps readyForProductionRuntime=false',
    id: 'runtime-authority',
    status: 'complete',
    title: 'Keep runtime authority unchanged',
  });
}

function createEntryStatus(
  criteria: readonly AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterion[],
): AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry['status'] {
  if (criteria.some((criterion) => criterion.status === 'blocked')) {
    return 'blocked';
  }
  if (criteria.some((criterion) => criterion.status === 'review-needed')) {
    return 'review-needed';
  }

  return 'ready-for-manual-review';
}

function createEntrySummaryText(
  entry: Pick<AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry, 'criteria' | 'intakeDir' | 'status'>,
) {
  return [
    `intakeDir=${entry.intakeDir}`,
    `status=${entry.status}`,
    `criteria=${entry.criteria.length}`,
    `blocked=${entry.criteria.filter((criterion) => criterion.status === 'blocked').length}`,
    `review=${entry.criteria.filter((criterion) => criterion.status === 'review-needed').length}`,
    `complete=${entry.criteria.filter((criterion) => criterion.status === 'complete').length}`,
  ].join(' ');
}

async function createIntakeEntry(options: {
  fieldEntry: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry | null;
  intakeDir: string;
  prettyJson?: boolean;
}) {
  const intakeDir = path.resolve(options.intakeDir);
  const [validator, checklist] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
      intakeDir,
      prettyJson: options.prettyJson,
    }),
    runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
      intakeDir,
      prettyJson: options.prettyJson,
    }),
  ]);
  const criteria = [
    createFieldCompletenessCriterion(options.fieldEntry),
    createManifestSourcesCriterion(validator),
    createBatchIndexCriterion(validator),
    createValidatorCriterion(validator),
    createOperatorChecklistCriterion(checklist),
    createRuntimeAuthorityCriterion(),
  ];
  const entryWithoutSummary = {
    criteria,
    intakeDir,
    status: createEntryStatus(criteria),
    summaryText: '',
  } satisfies AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry;

  return {
    ...entryWithoutSummary,
    summaryText: createEntrySummaryText(entryWithoutSummary),
  };
}

function createStatusCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry[],
) {
  const statusCounts = {
    blocked: 0,
    'ready-for-manual-review': 0,
    'review-needed': 0,
  } satisfies AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult['statusCounts'];

  for (const entry of entries) {
    statusCounts[entry.status] += 1;
  }

  return statusCounts;
}

function createStatus(
  entries: readonly AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry[],
): AgentSessionV3PilotRealCorpusBatchRunbookCompletionStatus {
  if (!entries.length) {
    return 'no-intake-dirs';
  }
  if (entries.some((entry) => entry.status === 'blocked')) {
    return 'blocked';
  }
  if (entries.some((entry) => entry.status === 'review-needed')) {
    return 'review-needed';
  }

  return 'ready-for-manual-review';
}

function countCriteria(
  entries: readonly AgentSessionV3PilotRealCorpusBatchRunbookCompletionIntakeEntry[],
  status?: AgentSessionV3PilotRealCorpusBatchRunbookCompletionCriterionStatus,
) {
  return entries.reduce((sum, entry) => (
    sum + entry.criteria.filter((criterion) => !status || criterion.status === status).length
  ), 0);
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult,
    | 'blockedCriteriaCount'
    | 'criteriaCount'
    | 'intakeCount'
    | 'readyCriteriaCount'
    | 'readyForProductionRuntime'
    | 'reviewCriteriaCount'
    | 'status'
    | 'statusCounts'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchRunbookCompletionReport status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `blockedIntakes=${result.statusCounts.blocked}`,
    `reviewNeededIntakes=${result.statusCounts['review-needed']}`,
    `readyForManualReviewIntakes=${result.statusCounts['ready-for-manual-review']}`,
    `criteria=${result.criteriaCount}`,
    `blockedCriteria=${result.blockedCriteriaCount}`,
    `reviewCriteria=${result.reviewCriteriaCount}`,
    `readyCriteria=${result.readyCriteriaCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult,
    'guardrail' | 'intakeEntries' | 'statusCounts' | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    'intakeStatusCounts:',
    ...Object.entries(result.statusCounts).map(([status, count]) => `- status=${status} intakes=${count}`),
    result.intakeEntries.length ? 'runbookCompletionIntakes:' : 'runbookCompletionIntakes: none',
    ...result.intakeEntries.flatMap((entry) => [
      `- ${entry.summaryText}`,
      ...entry.criteria.map((criterion) => [
        `  - criterion=${criterion.id}`,
        `status=${criterion.status}`,
        `title=${criterion.title}`,
        `detail=${criterion.detail}`,
      ].join(' ')),
    ]),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport(
  options: RunAgentSessionV3PilotRealCorpusBatchRunbookCompletionReportOptions = {},
): Promise<AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult> {
  const intakeDirs = options.intakeDirs ?? [];
  const fieldAudit = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
    intakeDirs,
    prettyJson: options.prettyJson,
    projectRoot: options.projectRoot,
  });
  const fieldEntriesByDir = new Map(
    fieldAudit.intakeEntries.map((entry) => [path.resolve(entry.intakeDir), entry]),
  );
  const intakeEntries = await Promise.all(intakeDirs.map((intakeDir) => {
    const resolvedIntakeDir = path.resolve(intakeDir);

    return createIntakeEntry({
      fieldEntry: fieldEntriesByDir.get(resolvedIntakeDir) ?? null,
      intakeDir: resolvedIntakeDir,
      prettyJson: options.prettyJson,
    });
  }));
  const statusCounts = createStatusCounts(intakeEntries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchRunbookCompletionReportResult = {
    blockedCriteriaCount: countCriteria(intakeEntries, 'blocked'),
    criteriaCount: countCriteria(intakeEntries),
    guardrail: 'caller-owned runbook completion report only; reads only explicitly supplied --dir intake directories; does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    intakeCount: intakeEntries.length,
    intakeEntries,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report',
    readyCriteriaCount: countCriteria(intakeEntries, 'complete'),
    readyForProductionRuntime: false,
    reportText: '',
    reviewCriteriaCount: countCriteria(intakeEntries, 'review-needed'),
    status: createStatus(intakeEntries),
    statusCounts,
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

async function runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
