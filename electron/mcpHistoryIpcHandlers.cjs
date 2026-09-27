function registerMcpHistoryIpcHandlers({
  ipcMain,
  mcpHistoryService,
  registerLoggedHandle,
  runtimeLogger,
}) {
  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:list-mcp-history', async (_event, request) => (
    mcpHistoryService.listHistory(request ?? {})
  ), {
    summarizeResult: (result) => ({
      count: Array.isArray(result?.entries) ? result.entries.length : 0,
      ok: Boolean(result?.ok),
      totalCount: result?.totalCount ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:clear-mcp-history', async (_event, request) => (
    mcpHistoryService.clearHistory(request ?? {})
  ), {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      removedCount: result?.removedCount ?? 0,
      totalCount: result?.totalCount ?? 0,
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:export-mcp-history', async (_event, request) => (
    mcpHistoryService.exportHistory(request ?? {})
  ), {
    summarizeResult: (result) => ({
      entryCount: result?.entryCount ?? 0,
      ok: Boolean(result?.ok),
    }),
  });

  registerLoggedHandle(ipcMain, runtimeLogger, 'desktop-pet:set-mcp-history-retention', async (_event, request) => (
    mcpHistoryService.setRetentionLimit(request ?? {})
  ), {
    summarizeResult: (result) => ({
      ok: Boolean(result?.ok),
      removedCount: result?.removedCount ?? 0,
      retentionLimit: result?.retentionLimit ?? 0,
    }),
  });
}

module.exports = {
  registerMcpHistoryIpcHandlers,
};
