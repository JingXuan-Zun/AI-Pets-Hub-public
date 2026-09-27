import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';

export interface McpHistoryEntryLike {
  error?: unknown;
  serverId?: string;
  status?: string;
  type?: string;
}

export interface McpHistoryServiceLike {
  listHistory: (request?: { limit?: number; serverId?: string }) => {
    entries: McpHistoryEntryLike[];
  };
}

function summarizeHistoryStatus(entries: McpHistoryEntryLike[]) {
  const byStatus: Record<string, number> = {};
  for (const entry of entries) {
    const key = `${String(entry.type || '')}:${String(entry.status || '')}`;
    byStatus[key] = (byStatus[key] || 0) + 1;
  }

  return byStatus;
}

function collectHistoryErrorSamples(entries: McpHistoryEntryLike[]) {
  return entries
    .map((entry) => entry.error)
    .filter((error) => error !== null && error !== undefined && String(error).trim())
    .map((error) => redactMcpSoakText(error, 160))
    .slice(0, 3);
}

export function summarizeMcpSoakHistory(history: McpHistoryServiceLike, serverId: string) {
  const entries = history.listHistory({ limit: 200, serverId }).entries;
  return {
    byStatus: summarizeHistoryStatus(entries),
    errorSamples: collectHistoryErrorSamples(entries),
    totalCount: entries.length,
  };
}
