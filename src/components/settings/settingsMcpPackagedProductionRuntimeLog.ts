export interface SettingsMcpPackagedProductionRuntimeLogSummary {
  controlledCloseCount: number;
  durationMs: number;
  endedAt?: string;
  gracefulQuitCount: number;
  quitExitCode: number | null;
  productionRunId?: string;
  runtimeMode: 'dev' | 'packaged' | 'unknown';
  startupCount: number;
  startedAt?: string;
  summaryText: string;
  unexpectedExitCount: number;
}

function parseIsoTimestamp(line: string) {
  const match = /^\[([^\]]+)\]/u.exec(line);
  const timestamp = match ? Date.parse(match[1]) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function detectRuntimeMode(text: string) {
  const bootstrapLine = text.split(/\r?\n/u).find((line) => line.includes('main-process] bootstrap')) || '';
  if (/isDev:\s*false/u.test(bootstrapLine) && /isLocalTest:\s*false/u.test(bootstrapLine)) {
    return 'packaged' as const;
  }
  if (/isDev:\s*true/u.test(bootstrapLine)) {
    return 'dev' as const;
  }

  return 'unknown' as const;
}

function parseQuitExitCode(text: string) {
  const match = /main-process\] quit \{exitCode:\s*(-?\d+)/u.exec(text);
  return match ? Number(match[1]) : null;
}

function parseProductionRunId(text: string) {
  const match = /mcpPackagedProductionRunId:\s*([^,}\s]+)/u.exec(text);
  return match?.[1]?.trim() || undefined;
}

function countMatches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].length;
}

function collectRuntimeTimestamps(lines: string[]) {
  return lines
    .map(parseIsoTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== null);
}

function createUnexpectedExitCount(text: string, quitExitCode: number | null) {
  const errorCount = countMatches(text, /(uncaughtException|unhandledRejection|render-process-gone|crashed)/gu);
  const abnormalQuit = quitExitCode !== null && quitExitCode !== 0 ? 1 : 0;
  return errorCount + abnormalQuit;
}

export function createSettingsMcpPackagedProductionRuntimeLogSummary(
  text: string,
): SettingsMcpPackagedProductionRuntimeLogSummary {
  const lines = text.split(/\r?\n/u);
  const timestamps = collectRuntimeTimestamps(lines);
  const startedMs = Math.min(...timestamps);
  const endedMs = Math.max(...timestamps);
  const durationMs = timestamps.length > 1 ? Math.max(0, endedMs - startedMs) : 0;
  const quitExitCode = parseQuitExitCode(text);
  const startupCount = countMatches(text, /main-process\] whenReady: complete/gu);
  const controlledCloseCount = countMatches(text, /main-process\] before-quit/gu);
  const gracefulQuitCount = countMatches(text, /main-process\] will-quit/gu)
    + (quitExitCode === 0 ? 1 : 0);
  const runtimeMode = detectRuntimeMode(text);
  const unexpectedExitCount = createUnexpectedExitCount(text, quitExitCode);

  return {
    controlledCloseCount,
    durationMs,
    endedAt: timestamps.length ? new Date(endedMs).toISOString() : undefined,
    gracefulQuitCount,
    quitExitCode,
    productionRunId: parseProductionRunId(text),
    runtimeMode,
    startupCount,
    startedAt: timestamps.length ? new Date(startedMs).toISOString() : undefined,
    summaryText: `MCPPackagedRuntimeLog mode=${runtimeMode} durationMinutes=${Math.round(durationMs / 60000)} startup=${startupCount} controlledClose=${controlledCloseCount} unexpected=${unexpectedExitCount}`,
    unexpectedExitCount,
  };
}
