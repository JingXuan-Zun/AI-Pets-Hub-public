import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotCorpusBatchIndexReport,
  type AgentSessionV3PilotCorpusBatchIndexReportResult,
} from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import {
  runAgentSessionV3PilotExternalSampleCorpusManifestLoader,
  type AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchSampleNoteReport,
  type AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchPathHealthReport,
  type AgentSessionV3PilotRealCorpusBatchPathHealthReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-path-health-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport,
  type AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchConsistencyReport,
  type AgentSessionV3PilotRealCorpusBatchConsistencyReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-consistency-report.ts';

export type AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus =
  | 'empty'
  | 'missing'
  | 'mixed'
  | 'not-ready'
  | 'ready';

export interface RunAgentSessionV3PilotRealCorpusBatchIntakeValidatorOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchPhaseCoverageSourceKindSummary {
  manifestCount: number;
  phaseCoverageClean: number;
  phaseCoverageFailedCheckCount: number;
  phaseCoverageFailedCheckKeys: AgentSessionV3PilotCorpusBatchIndexReportResult['sourceKindSummaries'][number]['phaseCoverageFailedCheckKeys'];
  phaseCoverageManifestLabels: string[];
  phaseCoverageNeedsReview: number;
  sourceKind: string;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult {
  consistencyIssueCount: number;
  consistencyReport: AgentSessionV3PilotRealCorpusBatchConsistencyReportResult;
  indexPath: string;
  indexReport: AgentSessionV3PilotCorpusBatchIndexReportResult | null;
  intakeDir: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator';
  manifestPath: string;
  manifestReport: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult | null;
  missingPaths: string[];
  noteMissing: boolean;
  noteOpenItemCount: number;
  notePath: string;
  notePresent: boolean;
  noteReport: AgentSessionV3PilotRealCorpusBatchSampleNoteReportResult;
  pathHealthReport: AgentSessionV3PilotRealCorpusBatchPathHealthReportResult;
  pathIssueCount: number;
  phaseCoverageCalibration: AgentSessionV3PilotCorpusBatchIndexReportResult['phaseCoverageCalibration'] | null;
  phaseCoverageSourceKindSummaries: AgentSessionV3PilotRealCorpusBatchPhaseCoverageSourceKindSummary[];
  reportText: string;
  schemaIssueCount: number;
  schemaShapeReport: AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult;
  status: AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotRealCorpusBatchIntakeValidatorArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchIntakeValidatorOptions {
  let includeJsonText = false;
  let intakeDir: string | null = null;
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
      intakeDir = nextArg;
      index += 1;
    } else if (!intakeDir) {
      intakeDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!intakeDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-intake-validator.ts --dir intake-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDir,
    prettyJson,
  };
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createAgentSessionV3PilotRealCorpusBatchIntakeValidatorStatus(options: {
  indexReport: AgentSessionV3PilotCorpusBatchIndexReportResult;
  manifestReport: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult;
}): AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus {
  if (options.indexReport.manifestCount === 0 || options.manifestReport.sourceCount === 0) {
    return 'empty';
  }

  if (options.indexReport.multiReport.statusCounts.notReady > 0) {
    return 'not-ready';
  }

  if (options.indexReport.multiReport.statusCounts.mixed > 0) {
    return 'mixed';
  }

  return 'ready';
}

function createAgentSessionV3PilotRealCorpusBatchPhaseCoverageSourceKindSummaries(
  indexReport: AgentSessionV3PilotCorpusBatchIndexReportResult | null,
): AgentSessionV3PilotRealCorpusBatchPhaseCoverageSourceKindSummary[] {
  return (indexReport?.sourceKindSummaries ?? []).map((summary) => ({
    manifestCount: summary.manifestCount,
    phaseCoverageClean: summary.phaseCoverageReadinessCounts.clean,
    phaseCoverageFailedCheckCount: summary.phaseCoverageFailedCheckCount,
    phaseCoverageFailedCheckKeys: [...summary.phaseCoverageFailedCheckKeys],
    phaseCoverageManifestLabels: [...summary.phaseCoverageManifestLabels],
    phaseCoverageNeedsReview: summary.phaseCoverageReadinessCounts.needsReview,
    sourceKind: summary.sourceKind,
  }));
}

function createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
    'consistencyIssueCount' | 'consistencyReport' | 'indexReport' | 'manifestReport' | 'missingPaths' | 'noteOpenItemCount' | 'notePresent' | 'noteReport' | 'pathHealthReport' | 'pathIssueCount' | 'phaseCoverageCalibration' | 'phaseCoverageSourceKindSummaries' | 'schemaIssueCount' | 'schemaShapeReport' | 'status'
  >,
) {
  const phaseCoverageNeedsReviewSourceKindCount = result.phaseCoverageSourceKindSummaries.filter((summary) => (
    summary.phaseCoverageNeedsReview > 0
  )).length;

  return [
    `AgentSessionV3PilotRealCorpusBatchIntakeValidator status=${result.status}`,
    `missing=${result.missingPaths.length}`,
    `notePresent=${result.notePresent ? 'yes' : 'no'}`,
    `noteStatus=${result.noteReport.status}`,
    `noteOpenItems=${result.noteOpenItemCount}`,
    `schemaShape=${result.schemaShapeReport.status}`,
    `schemaIssues=${result.schemaIssueCount}`,
    `pathHealth=${result.pathHealthReport.status}`,
    `pathIssues=${result.pathIssueCount}`,
    `consistency=${result.consistencyReport.status}`,
    `consistencyIssues=${result.consistencyIssueCount}`,
    `manifestSources=${result.manifestReport?.sourceCount ?? 0}`,
    `indexManifests=${result.indexReport?.manifestCount ?? 0}`,
    `indexReady=${result.indexReport?.multiReport.statusCounts.ready ?? 0}`,
    `indexMixed=${result.indexReport?.multiReport.statusCounts.mixed ?? 0}`,
    `indexNotReady=${result.indexReport?.multiReport.statusCounts.notReady ?? 0}`,
    `phaseCoverage=${result.phaseCoverageCalibration?.status ?? 'unavailable'}`,
    `phaseCoverageFailedManifests=${result.phaseCoverageCalibration?.failedManifestCount ?? 0}`,
    `phaseCoverageNeedsReviewSourceKinds=${phaseCoverageNeedsReviewSourceKindCount}`,
  ].join(' ');
}

function createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
    'consistencyReport' | 'indexReport' | 'manifestReport' | 'missingPaths' | 'noteMissing' | 'notePath' | 'noteReport' | 'pathHealthReport' | 'phaseCoverageCalibration' | 'phaseCoverageSourceKindSummaries' | 'schemaShapeReport' | 'summaryText'
  >,
) {
  const missingLines = result.missingPaths.length
    ? [
      'missingPaths:',
      ...result.missingPaths.map((missingPath) => `- ${missingPath}`),
    ]
    : ['missingPaths: none'];
  const noteLines = [
    `sampleNote: ${result.noteMissing ? 'missing' : 'present'}`,
    `sampleNotePath: ${result.notePath}`,
    result.noteReport.reportText,
  ];
  const phaseCoverageLines = result.phaseCoverageCalibration
    ? [
      result.phaseCoverageCalibration.summaryText,
      result.phaseCoverageSourceKindSummaries.length ? 'phaseCoverageSourceKinds:' : 'phaseCoverageSourceKinds: none',
      ...result.phaseCoverageSourceKindSummaries.map((summary) => [
        `- sourceKind=${summary.sourceKind}`,
        `manifests=${summary.manifestCount}`,
        `clean=${summary.phaseCoverageClean}`,
        `needsReview=${summary.phaseCoverageNeedsReview}`,
        `failedChecks=${summary.phaseCoverageFailedCheckCount}`,
        `checks=${summary.phaseCoverageFailedCheckKeys.join(',') || 'none'}`,
        `manifestsWithReview=${summary.phaseCoverageManifestLabels.join(',') || 'none'}`,
      ].join(' ')),
    ]
    : [
      'phaseCoverageCalibration: unavailable',
      'phaseCoverageSourceKinds: none',
    ];

  return [
    result.summaryText,
    ...missingLines,
    result.schemaShapeReport.reportText,
    result.pathHealthReport.reportText,
    result.consistencyReport.reportText,
    ...noteLines,
    ...phaseCoverageLines,
    result.manifestReport?.reportText ?? 'manifestReport: unavailable',
    result.indexReport?.reportText ?? 'indexReport: unavailable',
  ].join('\n');
}

function createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(
  result: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchIntakeValidator(
  options: RunAgentSessionV3PilotRealCorpusBatchIntakeValidatorOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const notePath = path.join(intakeDir, 'sample-note-template.md');
  const missingPaths = [];
  const noteReport = await runAgentSessionV3PilotRealCorpusBatchSampleNoteReport({
    notePath,
    prettyJson: options.prettyJson,
  });
  const schemaShapeReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const pathHealthReport = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const consistencyReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const notePresent = noteReport.notePresent;

  if (!(await pathExists(manifestPath))) {
    missingPaths.push(manifestPath);
  }
  if (!(await pathExists(indexPath))) {
    missingPaths.push(indexPath);
  }

  if (missingPaths.length > 0) {
    const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult = {
      consistencyIssueCount: consistencyReport.issueCount,
      consistencyReport,
      indexPath,
      indexReport: null,
      intakeDir,
      jsonText: null,
      kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator',
      manifestPath,
      manifestReport: null,
      missingPaths,
      noteMissing: !notePresent,
      noteOpenItemCount: noteReport.openItemCount,
      notePath,
      notePresent,
      noteReport,
      pathHealthReport,
      pathIssueCount: pathHealthReport.issueCount,
      phaseCoverageCalibration: null,
      phaseCoverageSourceKindSummaries: [],
      reportText: '',
      schemaIssueCount: schemaShapeReport.issueCount,
      schemaShapeReport,
      status: 'missing',
      summaryText: '',
      version: 1,
    };
    const summaryText = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(resultWithoutJson);
    const resultWithReport = {
      ...resultWithoutJson,
      reportText: createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText({
        ...resultWithoutJson,
        summaryText,
      }),
      summaryText,
    };

    return {
      ...resultWithReport,
      jsonText: options.includeJsonText
        ? createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(resultWithReport, {
          prettyJson: options.prettyJson,
        })
        : null,
    };
  }

  if (schemaShapeReport.status !== 'valid') {
    const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult = {
      consistencyIssueCount: consistencyReport.issueCount,
      consistencyReport,
      indexPath,
      indexReport: null,
      intakeDir,
      jsonText: null,
      kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator',
      manifestPath,
      manifestReport: null,
      missingPaths,
      noteMissing: !notePresent,
      noteOpenItemCount: noteReport.openItemCount,
      notePath,
      notePresent,
      noteReport,
      pathHealthReport,
      pathIssueCount: pathHealthReport.issueCount,
      phaseCoverageCalibration: null,
      phaseCoverageSourceKindSummaries: [],
      reportText: '',
      schemaIssueCount: schemaShapeReport.issueCount,
      schemaShapeReport,
      status: 'not-ready',
      summaryText: '',
      version: 1,
    };
    const summaryText = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(resultWithoutJson);
    const resultWithReport = {
      ...resultWithoutJson,
      reportText: createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText({
        ...resultWithoutJson,
        summaryText,
      }),
      summaryText,
    };

    return {
      ...resultWithReport,
      jsonText: options.includeJsonText
        ? createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(resultWithReport, {
          prettyJson: options.prettyJson,
        })
        : null,
    };
  }

  if (pathHealthReport.status !== 'healthy') {
    const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult = {
      consistencyIssueCount: consistencyReport.issueCount,
      consistencyReport,
      indexPath,
      indexReport: null,
      intakeDir,
      jsonText: null,
      kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator',
      manifestPath,
      manifestReport: null,
      missingPaths,
      noteMissing: !notePresent,
      noteOpenItemCount: noteReport.openItemCount,
      notePath,
      notePresent,
      noteReport,
      pathHealthReport,
      pathIssueCount: pathHealthReport.issueCount,
      phaseCoverageCalibration: null,
      phaseCoverageSourceKindSummaries: [],
      reportText: '',
      schemaIssueCount: schemaShapeReport.issueCount,
      schemaShapeReport,
      status: 'not-ready',
      summaryText: '',
      version: 1,
    };
    const summaryText = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(resultWithoutJson);
    const resultWithReport = {
      ...resultWithoutJson,
      reportText: createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText({
        ...resultWithoutJson,
        summaryText,
      }),
      summaryText,
    };

    return {
      ...resultWithReport,
      jsonText: options.includeJsonText
        ? createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(resultWithReport, {
          prettyJson: options.prettyJson,
        })
        : null,
    };
  }

  if (consistencyReport.status !== 'consistent') {
    const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult = {
      consistencyIssueCount: consistencyReport.issueCount,
      consistencyReport,
      indexPath,
      indexReport: null,
      intakeDir,
      jsonText: null,
      kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator',
      manifestPath,
      manifestReport: null,
      missingPaths,
      noteMissing: !notePresent,
      noteOpenItemCount: noteReport.openItemCount,
      notePath,
      notePresent,
      noteReport,
      pathHealthReport,
      pathIssueCount: pathHealthReport.issueCount,
      phaseCoverageCalibration: null,
      phaseCoverageSourceKindSummaries: [],
      reportText: '',
      schemaIssueCount: schemaShapeReport.issueCount,
      schemaShapeReport,
      status: 'not-ready',
      summaryText: '',
      version: 1,
    };
    const summaryText = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(resultWithoutJson);
    const resultWithReport = {
      ...resultWithoutJson,
      reportText: createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText({
        ...resultWithoutJson,
        summaryText,
      }),
      summaryText,
    };

    return {
      ...resultWithReport,
      jsonText: options.includeJsonText
        ? createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(resultWithReport, {
          prettyJson: options.prettyJson,
        })
        : null,
    };
  }

  const manifestReport = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
    includeReportText: true,
    manifestPath,
    prettyJson: options.prettyJson,
  });
  const indexReport = await runAgentSessionV3PilotCorpusBatchIndexReport({
    indexPath,
    prettyJson: options.prettyJson,
  });
  const status = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorStatus({
    indexReport,
    manifestReport,
  });
  const phaseCoverageSourceKindSummaries = createAgentSessionV3PilotRealCorpusBatchPhaseCoverageSourceKindSummaries(
    indexReport,
  );
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult = {
    consistencyIssueCount: consistencyReport.issueCount,
    consistencyReport,
    indexPath,
    indexReport,
    intakeDir,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-intake-validator',
    manifestPath,
    manifestReport,
    missingPaths,
    noteMissing: !notePresent,
    noteOpenItemCount: noteReport.openItemCount,
    notePath,
    notePresent,
    noteReport,
    pathHealthReport,
    pathIssueCount: pathHealthReport.issueCount,
    phaseCoverageCalibration: indexReport.phaseCoverageCalibration,
    phaseCoverageSourceKindSummaries,
    reportText: '',
    schemaIssueCount: schemaShapeReport.issueCount,
    schemaShapeReport,
    status,
    summaryText: '',
    version: 1,
  };
  const summaryText = createAgentSessionV3PilotRealCorpusBatchIntakeValidatorSummaryText(resultWithoutJson);
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createAgentSessionV3PilotRealCorpusBatchIntakeValidatorReportText({
      ...resultWithoutJson,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotRealCorpusBatchIntakeValidatorJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotRealCorpusBatchIntakeValidatorCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchIntakeValidatorArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchIntakeValidatorCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
