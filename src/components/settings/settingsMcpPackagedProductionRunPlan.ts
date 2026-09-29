export interface SettingsMcpPackagedProductionLatestBuildInfo {
  generatedAt?: string;
  latestBuild: string;
  portableExe?: string;
}

export interface SettingsMcpPackagedProductionRunPlan {
  autoQuitMs: number;
  callProbeOutputPath: string;
  collectorCommand: string;
  coverageCommand: string;
  electronLogPath: string;
  env: Record<string, string>;
  executablePath: string;
  harnessComparisonCommand: string;
  latestBuild: string;
  logDir: string;
  minimumMinutes: number;
  packagedMainHarnessCommand: string;
  productionRunId: string;
  readOnlyProbeStartCommand: string;
  runtimeLogPath: string;
  startCommand: string;
  status: 'blocked' | 'ready';
  summaryText: string;
}

const MCP_PACKAGED_PRODUCTION_MINIMUM_MINUTES = 30;
const MCP_PACKAGED_PRODUCTION_AUTO_QUIT_MS = 31 * 60 * 1000;
const MCP_PACKAGED_PRODUCTION_READ_ONLY_ROUNDS = 20;
const MCP_PACKAGED_PRODUCTION_READ_ONLY_INTERVAL_MS = 95_000;

function parseInfoLine(line: string) {
  const separatorIndex = line.indexOf('=');
  return separatorIndex > 0
    ? [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)] as const
    : null;
}

export function parseSettingsMcpPackagedProductionLatestBuildInfo(
  text: string,
): SettingsMcpPackagedProductionLatestBuildInfo {
  const info = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const entry = parseInfoLine(line);
    if (entry) {
      info.set(entry[0], entry[1]);
    }
  }

  return {
    generatedAt: info.get('incremental_generated_at') || info.get('generated_at') || undefined,
    latestBuild: info.get('latest_build') || '',
    portableExe: info.get('portable_exe') || undefined,
  };
}

function quotePowerShell(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function joinWindowsPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join('\\')
    .replace(/\\+/gu, '\\');
}

function createCollectorCommand(options: {
  artifactPath: string;
  callReportPath: string;
  configPath: string;
  outputPath: string;
  readyServerIds: string[];
  runtimeLogPath: string;
}) {
  const readyServerArgs = options.readyServerIds
    .map((serverId) => `--ready-server ${quotePowerShell(serverId)}`)
    .join(' ');
  return [
    'npx.cmd tsx .\\scripts\\agent-mcp-packaged-production-run-collector.ts',
    `--runtime-log ${quotePowerShell(options.runtimeLogPath)}`,
    `--call-report ${quotePowerShell(options.callReportPath)}`,
    `--output ${quotePowerShell(options.outputPath)}`,
    `--artifact ${quotePowerShell(options.artifactPath)}`,
    `--config-path ${quotePowerShell(options.configPath)}`,
    readyServerArgs,
    '--config-source saved-config',
  ].filter(Boolean).join(' ');
}

function createCoverageCommand(options: {
  callReportPath: string;
  outputPath: string;
  productionReportPath: string;
}) {
  return [
    'npx.cmd tsx .\\scripts\\agent-mcp-packaged-read-only-coverage.ts',
    `--input ${quotePowerShell(options.productionReportPath)}`,
    `--call-report ${quotePowerShell(options.callReportPath)}`,
    `--output ${quotePowerShell(options.outputPath)}`,
    '--pretty',
  ].join(' ');
}

function createPackagedMainHarnessCommand(options: {
  configPath: string;
  outputPath: string;
}) {
  return [
    'npx.cmd tsx .\\scripts\\agent-mcp-packaged-main-harness.ts',
    `--config ${quotePowerShell(options.configPath)}`,
    `--output ${quotePowerShell(options.outputPath)}`,
    '--rounds 3',
    '--pretty',
  ].join(' ');
}

function createHarnessComparisonCommand(options: {
  harnessReportPath: string;
  outputPath: string;
  packagedReportPath: string;
}) {
  return [
    'npx.cmd tsx .\\scripts\\agent-mcp-packaged-harness-comparison.ts',
    `--packaged-report ${quotePowerShell(options.packagedReportPath)}`,
    `--harness-report ${quotePowerShell(options.harnessReportPath)}`,
    `--output ${quotePowerShell(options.outputPath)}`,
    '--pretty',
  ].join(' ');
}

function createPackagedRunEnv(options: {
  callProbeOutputPath: string;
  configPath: string;
  logDir: string;
  productionRunId: string;
}) {
  return {
    DESKTOP_PET_MCP_CONFIG_PATH: options.configPath,
    DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID: options.productionRunId,
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE: '1',
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS: String(MCP_PACKAGED_PRODUCTION_READ_ONLY_INTERVAL_MS),
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT: options.callProbeOutputPath,
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS: String(MCP_PACKAGED_PRODUCTION_READ_ONLY_ROUNDS),
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_QUIT_ON_COMPLETE: '1',
    DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS: String(MCP_PACKAGED_PRODUCTION_AUTO_QUIT_MS),
    DESKTOP_PET_RUNTIME_LOG_DIR: options.logDir,
  };
}

function createStartCommand(executablePath: string, env: Record<string, string>) {
  return [
    ...Object.entries(env).map(([name, value]) => `$env:${name}=${quotePowerShell(value)}`),
    `Start-Process -FilePath ${quotePowerShell(executablePath)}`,
  ].join('; ');
}

function resolveExecutablePath(options: {
  executablePath?: string;
  executablePathExists?: (candidatePath: string) => boolean;
  latestBuildInfo: SettingsMcpPackagedProductionLatestBuildInfo;
}) {
  const exists = options.executablePathExists || (() => true);
  if (options.executablePath) {
    return exists(options.executablePath) ? options.executablePath : '';
  }

  const candidates = [
    options.latestBuildInfo.latestBuild
      ? joinWindowsPath(options.latestBuildInfo.latestBuild, 'win-unpacked', 'AI Desktop Pet.exe')
      : '',
    options.latestBuildInfo.portableExe || '',
  ].filter(Boolean);
  return candidates.find(exists) || '';
}

export function createSettingsMcpPackagedProductionRunPlan(options: {
  executablePath?: string;
  executablePathExists?: (candidatePath: string) => boolean;
  mcpConfigPath?: string;
  latestBuildInfo: SettingsMcpPackagedProductionLatestBuildInfo;
  logDir: string;
  outputPath: string;
  packagedRuntimeContractReady?: boolean;
  readyServerIds: string[];
  productionRunId?: string;
}): SettingsMcpPackagedProductionRunPlan {
  const latestBuild = options.latestBuildInfo.latestBuild;
  const executablePath = resolveExecutablePath(options);
  const runtimeLogPath = joinWindowsPath(options.logDir, 'desktop-pet-main.log');
  const electronLogPath = joinWindowsPath(options.logDir, 'electron-main.log');
  const callProbeOutputPath = joinWindowsPath(options.logDir, 'packaged-read-only-call-report.json');
  const harnessOutputPath = joinWindowsPath(options.logDir, 'packaged-main-harness-call-report.json');
  const harnessComparisonPath = joinWindowsPath(options.logDir, 'packaged-harness-comparison.json');
  const packagedRuntimeContractReady = options.packagedRuntimeContractReady !== false;
  const status = executablePath && options.readyServerIds.length > 0 && packagedRuntimeContractReady
    ? 'ready'
    : 'blocked';
  const configPath = options.mcpConfigPath || '.desktop-pet-mcp.json';
  const productionRunId = options.productionRunId || 'mcp-packaged-production-run';
  const env = createPackagedRunEnv({
    callProbeOutputPath,
    configPath,
    logDir: options.logDir,
    productionRunId,
  });
  const startCommand = status === 'ready' ? createStartCommand(executablePath, env) : '';
  return {
    autoQuitMs: MCP_PACKAGED_PRODUCTION_AUTO_QUIT_MS,
    callProbeOutputPath,
    collectorCommand: createCollectorCommand({
      artifactPath: executablePath,
      callReportPath: callProbeOutputPath,
      configPath,
      outputPath: options.outputPath,
      readyServerIds: options.readyServerIds,
      runtimeLogPath,
    }),
    coverageCommand: createCoverageCommand({
      callReportPath: callProbeOutputPath,
      outputPath: joinWindowsPath(options.logDir, 'packaged-read-only-coverage-review.json'),
      productionReportPath: options.outputPath,
    }),
    electronLogPath,
    env,
    executablePath,
    harnessComparisonCommand: createHarnessComparisonCommand({
      harnessReportPath: harnessOutputPath,
      outputPath: harnessComparisonPath,
      packagedReportPath: callProbeOutputPath,
    }),
    latestBuild,
    logDir: options.logDir,
    minimumMinutes: MCP_PACKAGED_PRODUCTION_MINIMUM_MINUTES,
    packagedMainHarnessCommand: createPackagedMainHarnessCommand({
      configPath,
      outputPath: harnessOutputPath,
    }),
    productionRunId,
    readOnlyProbeStartCommand: startCommand,
    runtimeLogPath,
    startCommand,
    status,
    summaryText: `MCPPackagedRunPlan status=${status} minimumMinutes=30 autoQuitMs=${MCP_PACKAGED_PRODUCTION_AUTO_QUIT_MS} readyServers=${options.readyServerIds.length} runtimeContract=${packagedRuntimeContractReady ? 'current' : 'stale'} readOnlyProbe=enabled rounds=${MCP_PACKAGED_PRODUCTION_READ_ONLY_ROUNDS} intervalMs=${MCP_PACKAGED_PRODUCTION_READ_ONLY_INTERVAL_MS}`,
  };
}
