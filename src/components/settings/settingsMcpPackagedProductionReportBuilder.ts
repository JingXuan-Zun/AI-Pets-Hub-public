import type { SettingsMcpSoakServerSummary, SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';
import type {
  SettingsMcpPackagedProductionReport,
  SettingsMcpPackagedProductionServerEvidence,
} from './settingsMcpPackagedProductionEvidenceTypes';
import type {
  SettingsMcpPackagedReadOnlyCallReport,
  SettingsMcpPackagedReadOnlyCallReportServer,
} from './settingsMcpPackagedReadOnlyCoverage';

export interface SettingsMcpPackagedProductionReportBuildOptions {
  automaticHighRiskCallCount?: number;
  configPath?: string;
  configSource: 'draft-config' | 'saved-config' | 'unknown';
  controlledCloseCount?: number;
  deniedHighRiskCallCount?: number;
  durationMs?: number;
  endedAt?: string;
  gracefulQuitCount?: number;
  packagedArtifactPath?: string;
  platform?: string;
  pooledSessionReuseCount?: number;
  readyServerIds: string[];
  runtimeMode: 'dev' | 'packaged' | 'unknown';
  runtimeVersion?: string;
  sessionCount?: number;
  soakSummary: SettingsMcpSoakSummaryResult;
  startedAt?: string;
  startupCount?: number;
  unexpectedExitCount?: number;
  writeToolCallCount?: number;
}

export interface SettingsMcpPackagedProductionBoundReportBuildOptions {
  callReport: SettingsMcpPackagedReadOnlyCallReport;
  callReportSha256: string;
  configPath?: string;
  controlledCloseCount: number;
  durationMs: number;
  endedAt?: string;
  gracefulQuitCount: number;
  packagedArtifactPath?: string;
  readyServerIds: string[];
  runtimeLogSha256: string;
  runtimeVersion?: string;
  startedAt?: string;
  startupCount: number;
  unexpectedExitCount: number;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function createServerEvidence(
  server: SettingsMcpSoakServerSummary,
): SettingsMcpPackagedProductionServerEvidence {
  return {
    failureCount: server.failureCount,
    id: server.id,
    listSuccessCount: Math.max(0, server.roundCount - server.failureCount),
    maxToolCount: server.maxToolCount,
    optionalCallErrorCount: server.optionalCallErrorCount,
    optionalCallSuccessCount: server.optionalCallSuccessCount,
    restartEventCount: server.restartEventCount,
    roundCount: server.roundCount,
    toolCountChanged: server.toolCountChanged,
  };
}

function createRunFields(options: SettingsMcpPackagedProductionReportBuildOptions) {
  return {
    durationMs: numberValue(options.durationMs),
    endedAt: options.endedAt,
    sessionCount: numberValue(options.sessionCount),
    startedAt: options.startedAt,
  };
}

function createLifecycleFields(options: SettingsMcpPackagedProductionReportBuildOptions) {
  return {
    controlledCloseCount: numberValue(options.controlledCloseCount),
    gracefulQuitCount: numberValue(options.gracefulQuitCount),
    pooledSessionReuseCount: numberValue(options.pooledSessionReuseCount),
    startupCount: numberValue(options.startupCount),
    unexpectedExitCount: numberValue(options.unexpectedExitCount),
  };
}

function createSafetyFields(options: SettingsMcpPackagedProductionReportBuildOptions) {
  return {
    automaticHighRiskCallCount: numberValue(options.automaticHighRiskCallCount),
    deniedHighRiskCallCount: numberValue(options.deniedHighRiskCallCount),
    writeToolCallCount: numberValue(options.writeToolCallCount),
  };
}

export function createSettingsMcpPackagedProductionReportFromSoakSummary(
  options: SettingsMcpPackagedProductionReportBuildOptions,
): SettingsMcpPackagedProductionReport {
  const readyServerIds = uniqueStrings(options.readyServerIds);
  const candidateServerIds = options.soakSummary.servers.map((server) => server.id).filter(Boolean);
  return {
    config: {
      candidateServerIds,
      configPath: options.configPath,
      readyServerIds,
      source: options.configSource,
    },
    generatedAt: new Date().toISOString(),
    kind: 'mcp-packaged-production-long-run-report',
    lifecycle: createLifecycleFields(options),
    run: createRunFields(options),
    runtime: {
      artifactPath: options.packagedArtifactPath,
      mode: options.runtimeMode,
      platform: options.platform,
      version: options.runtimeVersion,
    },
    safety: createSafetyFields(options),
    servers: options.soakSummary.servers.map(createServerEvidence),
    version: 1,
  };
}

function createBoundServerEvidence(
  server: SettingsMcpPackagedReadOnlyCallReportServer,
): SettingsMcpPackagedProductionServerEvidence {
  return {
    failureCount: numberValue(server.listFailureCount),
    id: server.id,
    listSuccessCount: numberValue(server.listSuccessCount),
    maxToolCount: numberValue(server.maxToolCount),
    optionalCallErrorCount: numberValue(server.optionalCallErrorCount)
      + numberValue(server.optionalCallSkippedCount),
    optionalCallSuccessCount: numberValue(server.optionalCallSuccessCount),
    restartEventCount: numberValue(server.restartEventCount),
    roundCount: numberValue(server.roundCount),
    toolCountChanged: server.toolCountChanged,
  };
}

export function createSettingsMcpPackagedProductionReportFromBoundCallReport(
  options: SettingsMcpPackagedProductionBoundReportBuildOptions,
): SettingsMcpPackagedProductionReport {
  const readyServerIds = uniqueStrings(options.readyServerIds);
  return {
    config: {
      candidateServerIds: (options.callReport.servers || []).map((server) => server.id),
      configPath: options.configPath,
      readyServerIds,
      source: 'saved-config',
    },
    generatedAt: new Date().toISOString(),
    kind: 'mcp-packaged-production-long-run-report',
    lifecycle: {
      controlledCloseCount: options.controlledCloseCount,
      gracefulQuitCount: options.gracefulQuitCount,
      startupCount: options.startupCount,
      unexpectedExitCount: options.unexpectedExitCount,
    },
    provenance: {
      callReportSha256: options.callReportSha256,
      runtimeLogSha256: options.runtimeLogSha256,
      sameRunVerified: true,
    },
    run: {
      durationMs: options.durationMs,
      endedAt: options.endedAt,
      productionRunId: options.callReport.productionRunId || undefined,
      sessionCount: options.startupCount,
      startedAt: options.startedAt,
    },
    runtime: {
      artifactPath: options.packagedArtifactPath,
      mode: options.callReport.runtime?.mode || 'unknown',
      platform: options.callReport.runtime?.platform,
      version: options.runtimeVersion || options.callReport.runtime?.version,
    },
    safety: {
      automaticHighRiskCallCount: numberValue(options.callReport.safety?.unexpectedToolCallCount),
      writeToolCallCount: numberValue(options.callReport.safety?.unexpectedToolCallCount),
    },
    servers: (options.callReport.servers || []).map(createBoundServerEvidence),
    version: 1,
  };
}
