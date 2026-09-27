import { useEffect, useMemo, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { SettingsMcpAdvancedWorkspace } from './SettingsMcpAdvancedWorkspace';
import { SettingsMcpBeginnerOverview } from './SettingsMcpBeginnerOverview';
import { SettingsMcpSectionHeader } from './SettingsMcpSectionHeader';
import {
  createEmptyMcpServerDraft,
  findMcpServerDraftById,
  formatMcpConfigResult,
  parseMcpConfigText,
} from './settingsMcpConfigFormUtils';
import {
  createMcpServerCheckStateFromDiagnostic,
  createMcpServerCheckStateFromError,
  runSettingsMcpDiagnosticsBatch,
} from './settingsMcpDiagnosticsBatch';
import {
  createSettingsMcpHealthSummaries,
  type SettingsMcpServerCheckState,
  type SettingsMcpServerRuntimeHealth,
} from './settingsMcpHealthSummary';
import { indexMcpServerHealth } from './settingsMcpRuntimeHealthUtils';
import { mergeMcpToolsForServer } from './settingsMcpToolListUtils';
import { useSettingsMcpHistoryControls } from './useSettingsMcpHistoryControls';

const DEFAULT_MCP_CONFIG_TEXT = '{\n  "servers": []\n}\n';
const TEXT_SECTION_TITLE = '外部工具';
const TEXT_SECTION_DESC = '为桌宠连接可选工具。普通使用只需关注是否可用；协议、权限和诊断集中在高级设置中。';

export function SettingsMcpSection({ showSkillMcpProgress = false }: { showSkillMcpProgress?: boolean }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [configText, setConfigText] = useState(DEFAULT_MCP_CONFIG_TEXT);
  const [feedback, setFeedback] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [tools, setTools] = useState<DesktopPetMcpToolLike[]>([]);
  const [configPath, setConfigPath] = useState('');
  const [serverDraft, setServerDraft] = useState(createEmptyMcpServerDraft);
  const [lastToolRefreshAt, setLastToolRefreshAt] = useState<number | null>(null);
  const [lastToolRefreshError, setLastToolRefreshError] = useState<string | null>(null);
  const [lastConfigSavedAt, setLastConfigSavedAt] = useState<number | null>(null);
  const [serverChecksById, setServerChecksById] = useState<Record<string, SettingsMcpServerCheckState>>({});
  const [serverHealthById, setServerHealthById] = useState<Record<string, SettingsMcpServerRuntimeHealth>>({});
  const history = useSettingsMcpHistoryControls(setFeedback);
  const parsedConfig = useMemo(() => parseMcpConfigText(configText), [configText]);
  const healthSummaries = useMemo(() => createSettingsMcpHealthSummaries({
    checksByServerId: serverChecksById,
    lastError: lastToolRefreshError,
    lastRefreshAt: lastToolRefreshAt,
    serverHealthById,
    servers: parsedConfig.servers,
    tools,
  }), [lastToolRefreshAt, lastToolRefreshError, parsedConfig.servers, serverChecksById, serverHealthById, tools]);
  const runBusyTask = async (task: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await task();
    } finally {
      setIsBusy(false);
    }
  };

  const loadConfig = async () => {
    setIsBusy(true);
    try {
      const result = await desktopPetShellRuntime.loadMcpConfig();
      const nextText = result.rawText || DEFAULT_MCP_CONFIG_TEXT;
      const loadedConfig = parseMcpConfigText(nextText);
      setConfigText(nextText);
      setConfigPath(result.path || '');
      setServerDraft(loadedConfig.servers[0] ?? createEmptyMcpServerDraft());
      setServerChecksById({});
      setFeedback(formatMcpConfigResult(result));
      await history.refreshHistory();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to load MCP config.');
    } finally {
      setIsBusy(false);
    }
  };

  const refreshTools = async () => {
    setIsBusy(true);
    try {
      const result = await desktopPetShellRuntime.listMcpTools().catch((error) => {
        const message = error instanceof Error ? error.message : 'Refresh MCP tools failed.';
        setLastToolRefreshAt(Date.now());
        setLastToolRefreshError(message);
        throw error;
      });
      setTools(result.tools ?? []);
      setServerHealthById(indexMcpServerHealth(result.serverHealth));
      setLastToolRefreshAt(Date.now());
      setLastToolRefreshError(null);
      setServerChecksById({});
      setFeedback(`Refreshed MCP tools: ${(result.tools ?? []).length}.`);
      await history.refreshHistory();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to refresh MCP tools.');
      await history.refreshHistory();
    } finally {
      setIsBusy(false);
    }
  };

  const testServer = async (serverId: string) => {
    const normalizedServerId = serverId.trim();
    if (!normalizedServerId) {
      return;
    }

    if (!parsedConfig.servers.some((server) => server.id === normalizedServerId)) {
      setFeedback('Save this MCP server before testing it.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await desktopPetShellRuntime.inspectMcpServer({ serverId: normalizedServerId });
      const nextTools = result.tools ?? [];
      setTools((current) => mergeMcpToolsForServer(current, normalizedServerId, nextTools));
      setServerChecksById((current) => ({
        ...current,
        [normalizedServerId]: createMcpServerCheckStateFromDiagnostic(result),
      }));
      setFeedback(result.ok
        ? `MCP server ${normalizedServerId} test passed: ${nextTools.length} tools.`
        : result.error ?? 'MCP server test failed.');
      await history.refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MCP server test failed.';
      setServerChecksById((current) => ({
        ...current,
        [normalizedServerId]: createMcpServerCheckStateFromError(error, current[normalizedServerId]),
      }));
      setFeedback(message);
      await history.refreshHistory();
    } finally {
      setIsBusy(false);
    }
  };

  const testAllServers = async () => {
    const savedServers = parsedConfig.servers.filter((server) => server.id.trim());
    if (!savedServers.length) {
      setFeedback('No saved MCP servers to test.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await runSettingsMcpDiagnosticsBatch({
        currentChecksByServerId: serverChecksById,
        currentTools: tools,
        inspectServer: (serverId) => desktopPetShellRuntime.inspectMcpServer({ serverId }),
        servers: savedServers,
      });
      setTools(result.tools);
      setServerChecksById((current) => ({ ...current, ...result.checksByServerId }));
      setLastToolRefreshAt(Date.now());
      setLastToolRefreshError(result.failedCount ? `${result.failedCount} MCP server test(s) failed.` : null);
      setFeedback(`MCP batch test finished: ${result.okCount}/${result.totalCount} passed.`);
      await history.refreshHistory();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'MCP batch test failed.');
      await history.refreshHistory();
    } finally {
      setIsBusy(false);
    }
  };

  const editServer = (serverId: string) => {
    const result = findMcpServerDraftById(parsedConfig.servers, serverId);
    if (!result.server) {
      setFeedback(result.error || 'MCP server is not in the current config.');
      return;
    }

    setServerDraft(result.server);
    setFeedback(`MCP server ${result.server.id} loaded into the config form.`);
  };

  const saveConfig = async () => {
    setIsBusy(true);
    try {
      const result = await desktopPetShellRuntime.saveMcpConfig({ rawText: configText });
      setConfigText(result.rawText || configText);
      setConfigPath(result.path || configPath);
      if (!result.ok) {
        setFeedback(result.error || 'Failed to save MCP config.');
        return;
      }

      setLastConfigSavedAt(Date.now());
      setFeedback('MCP config saved.');
      await refreshTools();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to save MCP config.');
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  return (
    <div className="rounded-sm border border-border bg-secondary/20 p-4">
      <SettingsMcpSectionHeader
        advancedOpen={advancedOpen}
        disabled={isBusy}
        description={TEXT_SECTION_DESC}
        title={TEXT_SECTION_TITLE}
        onRefreshTools={() => void refreshTools()}
        onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
      />
      <SettingsMcpBeginnerOverview summaries={healthSummaries} toolCount={tools.length} />

      {advancedOpen ? (
        <SettingsMcpAdvancedWorkspace
          config={parsedConfig.config}
          configPath={configPath}
          configText={configText}
          disabled={isBusy}
          draft={serverDraft}
          feedback={feedback}
          healthSummaries={healthSummaries}
          history={history}
          lastConfigSavedAt={lastConfigSavedAt}
          parsedServers={parsedConfig.servers}
          showSkillMcpProgress={showSkillMcpProgress}
          tools={tools}
          onConfigTextChange={setConfigText}
          onDraftChange={setServerDraft}
          onEditServer={editServer}
          onFeedback={setFeedback}
          onRunBusyTask={runBusyTask}
          onRunServerDiagnostic={(serverId) => testServer(serverId)}
          onSaveConfig={() => void saveConfig()}
          onTestAllServers={() => void testAllServers()}
          onTestServer={(serverId) => void testServer(serverId)}
        />
      ) : null}
    </div>
  );
}
