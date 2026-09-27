export type SettingsMcpPackagedProductionStatus = 'blocked' | 'ready' | 'warning';

export type SettingsMcpPackagedProductionCheckId =
  | 'long-run-duration'
  | 'packaged-runtime'
  | 'evidence-provenance'
  | 'ready-server-coverage'
  | 'saved-config-source'
  | 'server-stability'
  | 'unsafe-automatic-calls'
  | 'visible-lifecycle';

export interface SettingsMcpPackagedProductionServerEvidence {
  failureCount?: number;
  id: string;
  listSuccessCount?: number;
  maxToolCount?: number;
  optionalCallErrorCount?: number;
  optionalCallSuccessCount?: number;
  restartEventCount?: number;
  roundCount?: number;
  toolCountChanged?: boolean;
}

export interface SettingsMcpPackagedProductionReport {
  config?: {
    candidateServerIds?: string[];
    configPath?: string;
    readyServerIds?: string[];
    source?: 'draft-config' | 'saved-config' | 'unknown';
  };
  generatedAt?: string;
  kind: 'mcp-packaged-production-long-run-report';
  lifecycle?: {
    controlledCloseCount?: number;
    gracefulQuitCount?: number;
    pooledSessionReuseCount?: number;
    startupCount?: number;
    unexpectedExitCount?: number;
  };
  provenance?: {
    callReportSha256?: string;
    runtimeLogSha256?: string;
    sameRunVerified?: boolean;
  };
  run?: {
    durationMs?: number;
    endedAt?: string;
    productionRunId?: string;
    sessionCount?: number;
    startedAt?: string;
  };
  runtime?: {
    artifactPath?: string;
    mode?: 'dev' | 'packaged' | 'unknown';
    platform?: string;
    version?: string;
  };
  safety?: {
    automaticHighRiskCallCount?: number;
    deniedHighRiskCallCount?: number;
    writeToolCallCount?: number;
  };
  servers?: SettingsMcpPackagedProductionServerEvidence[];
  version: 1;
}

export interface SettingsMcpPackagedProductionCheck {
  detail: string;
  id: SettingsMcpPackagedProductionCheckId;
  status: SettingsMcpPackagedProductionStatus;
  title: string;
}

export interface SettingsMcpPackagedProductionReview {
  blockers: string[];
  blockedCount: number;
  checks: SettingsMcpPackagedProductionCheck[];
  durationMinutes: number;
  generatedAt: string;
  kind: 'settings-mcp-packaged-production-evidence-review';
  readyCount: number;
  serverCount: number;
  status: SettingsMcpPackagedProductionStatus;
  summaryText: string;
  version: 1;
  warnings: string[];
  warningCount: number;
}

export interface SettingsMcpPackagedProductionImportedEvidence {
  inputPath: string;
  report: SettingsMcpPackagedProductionReport;
  review: SettingsMcpPackagedProductionReview;
}
