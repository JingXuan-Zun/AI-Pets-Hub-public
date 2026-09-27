import { useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';

function getHistoryRetentionLimit(
  result: Awaited<ReturnType<typeof desktopPetShellRuntime.listMcpHistory>>,
  fallbackLimit: number,
) {
  return 'retentionLimit' in result
    ? result.retentionLimit ?? result.limit ?? fallbackLimit
    : result.limit ?? fallbackLimit;
}

export function useSettingsMcpHistoryControls(onFeedback: (message: string) => void) {
  const [historyEntries, setHistoryEntries] = useState<DesktopPetMcpHistoryEntryLike[]>([]);
  const [historyRetentionLimit, setHistoryRetentionLimit] = useState(80);
  const [historyServerId, setHistoryServerId] = useState('');
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  const refreshHistory = async (limit = historyRetentionLimit, serverId = historyServerId) => {
    const result = await desktopPetShellRuntime.listMcpHistory({ limit, serverId: serverId || null });
    setHistoryEntries(result.entries ?? []);
    setHistoryRetentionLimit(getHistoryRetentionLimit(result, limit));
    setHistoryTotalCount(result.totalCount ?? 0);
  };
  const clearHistory = async () => {
    const result = await desktopPetShellRuntime.clearMcpHistory();
    onFeedback(`MCP history cleared: ${result.removedCount} removed.`);
    await refreshHistory();
  };
  const exportHistory = async () => {
    const result = await desktopPetShellRuntime.exportMcpHistory({
      limit: historyRetentionLimit,
      serverId: historyServerId || null,
    });
    onFeedback(result.ok
      ? `MCP history export prepared: ${result.entryCount} entries.`
      : 'MCP history export failed.');
    return result;
  };
  const setRetentionLimit = async (limit: number) => {
    const result = await desktopPetShellRuntime.setMcpHistoryRetention({ limit });
    setHistoryRetentionLimit(result.retentionLimit);
    onFeedback(`MCP history retention set to ${result.retentionLimit}.`);
    await refreshHistory(result.retentionLimit);
  };
  const selectHistoryServer = async (serverId: string) => {
    const normalizedServerId = serverId.trim();
    setHistoryServerId(normalizedServerId);
    await refreshHistory(historyRetentionLimit, normalizedServerId);
  };

  return {
    clearHistory,
    exportHistory,
    historyEntries,
    historyRetentionLimit,
    historyServerId,
    historyTotalCount,
    refreshHistory,
    selectHistoryServer,
    setRetentionLimit,
  };
}

export type UseSettingsMcpHistoryControlsResult = ReturnType<typeof useSettingsMcpHistoryControls>;
