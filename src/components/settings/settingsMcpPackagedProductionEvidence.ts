import type {
  SettingsMcpPackagedProductionCheck,
  SettingsMcpPackagedProductionCheckId,
  SettingsMcpPackagedProductionImportedEvidence,
  SettingsMcpPackagedProductionReport,
  SettingsMcpPackagedProductionReview,
  SettingsMcpPackagedProductionServerEvidence,
  SettingsMcpPackagedProductionStatus,
} from './settingsMcpPackagedProductionEvidenceTypes';

export type {
  SettingsMcpPackagedProductionCheck,
  SettingsMcpPackagedProductionCheckId,
  SettingsMcpPackagedProductionImportedEvidence,
  SettingsMcpPackagedProductionReport,
  SettingsMcpPackagedProductionReview,
  SettingsMcpPackagedProductionServerEvidence,
  SettingsMcpPackagedProductionStatus,
} from './settingsMcpPackagedProductionEvidenceTypes';

export const MCP_PACKAGED_PRODUCTION_MIN_DURATION_MS = 30 * 60 * 1000;
export const MCP_PACKAGED_PRODUCTION_MIN_ROUNDS_PER_SERVER = 20;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function getDurationMs(report: SettingsMcpPackagedProductionReport) {
  const explicitDuration = numberValue(report.run?.durationMs);
  if (explicitDuration > 0) {
    return explicitDuration;
  }

  const startedAt = Date.parse(report.run?.startedAt || '');
  const endedAt = Date.parse(report.run?.endedAt || '');
  return Number.isFinite(startedAt) && Number.isFinite(endedAt)
    ? Math.max(0, endedAt - startedAt)
    : 0;
}

function createCheck(
  id: SettingsMcpPackagedProductionCheckId,
  title: string,
  status: SettingsMcpPackagedProductionStatus,
  detail: string,
): SettingsMcpPackagedProductionCheck {
  return { detail, id, status, title };
}

function createRuntimeCheck(report: SettingsMcpPackagedProductionReport) {
  const packaged = report.runtime?.mode === 'packaged';
  return createCheck(
    'packaged-runtime',
    'Packaged runtime evidence',
    packaged ? 'ready' : 'blocked',
    packaged
      ? `Packaged runtime reported for ${report.runtime?.platform || 'unknown platform'}.`
      : 'Report must come from a packaged app run, not dev or unknown runtime.',
  );
}

function createConfigCheck(report: SettingsMcpPackagedProductionReport) {
  const saved = report.config?.source === 'saved-config';
  return createCheck(
    'saved-config-source',
    'Saved config source',
    saved ? 'ready' : 'blocked',
    saved
      ? `Run used saved MCP config ${report.config?.configPath || '.desktop-pet-mcp.json'}.`
      : 'Run must use saved-config evidence before estimate review.',
  );
}

function createDurationCheck(durationMs: number) {
  const ready = durationMs >= MCP_PACKAGED_PRODUCTION_MIN_DURATION_MS;
  const minutes = Math.round(durationMs / 60000);
  return createCheck(
    'long-run-duration',
    'Long-run duration',
    ready ? 'ready' : 'blocked',
    ready
      ? `${minutes} minute packaged run meets the minimum window.`
      : `Need at least 30 minutes; current evidence is ${minutes} minute(s).`,
  );
}

function createProvenanceCheck(report: SettingsMcpPackagedProductionReport) {
  const provenance = report.provenance;
  const ready = provenance?.sameRunVerified === true
    && Boolean(report.run?.productionRunId)
    && Boolean(provenance.callReportSha256)
    && Boolean(provenance.runtimeLogSha256);
  return createCheck(
    'evidence-provenance',
    'Same-run evidence provenance',
    ready ? 'ready' : 'blocked',
    ready
      ? `Runtime log and packaged call report are bound to run ${report.run?.productionRunId}.`
      : 'Runtime log and packaged call rounds must be verified as artifacts from the same run.',
  );
}

function findServer(
  servers: SettingsMcpPackagedProductionServerEvidence[],
  serverId: string,
) {
  return servers.find((server) => server.id === serverId);
}

function createCoverageCheck(report: SettingsMcpPackagedProductionReport) {
  const readyServerIds = stringArray(report.config?.readyServerIds);
  const servers = report.servers || [];
  const missing = readyServerIds.filter((serverId) => !findServer(servers, serverId));
  const underRound = readyServerIds.filter((serverId) => {
    const server = findServer(servers, serverId);
    return numberValue(server?.roundCount) < MCP_PACKAGED_PRODUCTION_MIN_ROUNDS_PER_SERVER;
  });
  const ready = readyServerIds.length > 0 && missing.length === 0 && underRound.length === 0;

  return createCheck(
    'ready-server-coverage',
    'Ready server coverage',
    ready ? 'ready' : 'blocked',
    ready
      ? `${readyServerIds.length} ready server(s) have packaged long-run rows.`
      : 'Every ready server needs a packaged row with at least 20 rounds.',
  );
}

function serverHasStabilityIssue(server: SettingsMcpPackagedProductionServerEvidence) {
  return numberValue(server.failureCount) > 0
    || numberValue(server.optionalCallErrorCount) > 0
    || numberValue(server.restartEventCount) > 0
    || numberValue(server.maxToolCount) <= 0
    || server.toolCountChanged !== false;
}

function createStabilityCheck(report: SettingsMcpPackagedProductionReport) {
  const servers = report.servers || [];
  const unstable = servers.filter(serverHasStabilityIssue);
  const ready = servers.length > 0 && unstable.length === 0;
  return createCheck(
    'server-stability',
    'Server stability',
    ready ? 'ready' : 'blocked',
    ready
      ? `${servers.length} server(s) report zero failures, restarts, optional-call errors, or tool drift.`
      : `${unstable.length || servers.length} server row(s) need stability review before progress can move.`,
  );
}

function createLifecycleCheck(report: SettingsMcpPackagedProductionReport) {
  const lifecycle = report.lifecycle;
  const ready = numberValue(lifecycle?.startupCount) > 0
    && numberValue(lifecycle?.controlledCloseCount) > 0
    && numberValue(lifecycle?.unexpectedExitCount) === 0;
  return createCheck(
    'visible-lifecycle',
    'Visible lifecycle evidence',
    ready ? 'ready' : 'blocked',
    ready
      ? 'Startup, controlled close, and zero unexpected exits are visible.'
      : 'Need packaged startup, controlled close, and zero unexpected-exit evidence.',
  );
}

function createSafetyCheck(report: SettingsMcpPackagedProductionReport) {
  const safety = report.safety;
  const ready = Boolean(safety) && numberValue(safety?.automaticHighRiskCallCount) === 0;
  return createCheck(
    'unsafe-automatic-calls',
    'Unsafe automatic calls',
    ready ? 'ready' : 'blocked',
    ready
      ? 'No automatic high-risk MCP tool calls were reported.'
      : 'Report must prove automatic high-risk MCP calls stayed at zero.',
  );
}

function getOverallStatus(checks: SettingsMcpPackagedProductionCheck[]) {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked' as const;
  }

  return checks.some((check) => check.status === 'warning') ? 'warning' as const : 'ready' as const;
}

export function createSettingsMcpPackagedProductionReview(
  report: SettingsMcpPackagedProductionReport,
): SettingsMcpPackagedProductionReview {
  const durationMs = getDurationMs(report);
  const checks = [
    createRuntimeCheck(report),
    createConfigCheck(report),
    createDurationCheck(durationMs),
    createProvenanceCheck(report),
    createCoverageCheck(report),
    createStabilityCheck(report),
    createLifecycleCheck(report),
    createSafetyCheck(report),
  ];
  const readyCount = checks.filter((check) => check.status === 'ready').length;
  const warningCount = checks.filter((check) => check.status === 'warning').length;
  const blockedCount = checks.filter((check) => check.status === 'blocked').length;
  const status = getOverallStatus(checks);

  return {
    blockedCount,
    blockers: checks.filter((check) => check.status === 'blocked').map((check) => check.detail),
    checks,
    durationMinutes: Math.round(durationMs / 60000),
    generatedAt: new Date().toISOString(),
    kind: 'settings-mcp-packaged-production-evidence-review',
    readyCount,
    serverCount: report.servers?.length ?? 0,
    status,
    summaryText: `MCPPackagedProductionEvidence status=${status} ready=${readyCount}/${checks.length} servers=${report.servers?.length ?? 0} durationMinutes=${Math.round(durationMs / 60000)}`,
    version: 1,
    warningCount,
    warnings: checks.filter((check) => check.status === 'warning').map((check) => check.detail),
  };
}

function isPackagedProductionReport(value: unknown): value is SettingsMcpPackagedProductionReport {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Partial<SettingsMcpPackagedProductionReport>).kind === 'mcp-packaged-production-long-run-report'
    && (value as Partial<SettingsMcpPackagedProductionReport>).version === 1;
}

export function parseSettingsMcpPackagedProductionEvidenceText(
  text: string,
  inputPath: string,
): SettingsMcpPackagedProductionImportedEvidence {
  const parsed = JSON.parse(text) as unknown;
  if (!isPackagedProductionReport(parsed)) {
    throw new Error('Input is not an MCP packaged-production long-run report.');
  }

  return {
    inputPath,
    report: parsed,
    review: createSettingsMcpPackagedProductionReview(parsed),
  };
}
