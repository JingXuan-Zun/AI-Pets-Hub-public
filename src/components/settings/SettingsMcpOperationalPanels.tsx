import { SettingsMcpDiagnosticsBatchActions } from './SettingsMcpDiagnosticsBatchActions';
import { SettingsMcpEvidenceProgressBlock } from './SettingsMcpEvidenceProgressBlock';
import { SettingsMcpFieldPolicyTable } from './SettingsMcpFieldPolicyTable';
import { SettingsMcpHistoryPanel } from './SettingsMcpHistoryPanel';
import { SettingsMcpServerHealthList } from './SettingsMcpServerHealthList';
import { SettingsMcpSessionPoolPanel } from './SettingsMcpSessionPoolPanel';
import { SettingsMcpPolicyBulkActions } from './SettingsMcpPolicyBulkActions';
import { SettingsMcpPolicyEditor } from './SettingsMcpPolicyEditor';
import { SettingsMcpToolPolicyTable } from './SettingsMcpToolPolicyTable';
import { SettingsMcpToolRiskList } from './SettingsMcpToolRiskList';
import { SettingsSkillMcpProgressPanel } from './SettingsSkillMcpProgressPanel';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import type { SettingsMcpServerHealthSummary } from './settingsMcpHealthSummary';
import type { UseSettingsMcpHistoryControlsResult } from './useSettingsMcpHistoryControls';

interface SettingsMcpOperationalPanelsProps {
  configPath: string;
  config: Record<string, unknown>;
  configText: string;
  disabled: boolean;
  feedback: string;
  healthSummaries: SettingsMcpServerHealthSummary[];
  history: UseSettingsMcpHistoryControlsResult;
  lastConfigSavedAt?: number | null;
  parsedServers: SettingsMcpServerDraft[];
  showSkillMcpProgress?: boolean;
  tools: DesktopPetMcpToolLike[];
  onConfigTextChange: (text: string) => void;
  onEditServer: (serverId: string) => void;
  onFeedback: (message: string) => void;
  onRunBusyTask: (task: () => Promise<void>) => Promise<void>;
  onRunServerDiagnostic: (serverId: string) => Promise<void> | void;
  onTestAllServers: () => void;
}

export function SettingsMcpOperationalPanels({
  configPath,
  config,
  configText,
  disabled,
  feedback,
  healthSummaries,
  history,
  lastConfigSavedAt = null,
  parsedServers,
  showSkillMcpProgress = false,
  tools,
  onConfigTextChange,
  onEditServer,
  onFeedback,
  onRunBusyTask,
  onRunServerDiagnostic,
  onTestAllServers,
}: SettingsMcpOperationalPanelsProps) {
  return (
    <div className="mt-3 space-y-2 text-2xs leading-5 text-muted-foreground">
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        {configPath || '.desktop-pet-mcp.json'}
      </div>
      {showSkillMcpProgress ? <SettingsSkillMcpProgressPanel /> : null}
      <SettingsMcpPolicyEditor
        configText={configText}
        onConfigTextChange={onConfigTextChange}
        onFeedback={onFeedback}
      />
      <SettingsMcpPolicyBulkActions
        configText={configText}
        onConfigTextChange={onConfigTextChange}
        onFeedback={onFeedback}
        tools={tools}
      />
      <SettingsMcpToolPolicyTable
        configText={configText}
        onConfigTextChange={onConfigTextChange}
        onFeedback={onFeedback}
        tools={tools}
      />
      <SettingsMcpFieldPolicyTable
        configText={configText}
        onConfigTextChange={onConfigTextChange}
        onFeedback={onFeedback}
        tools={tools}
      />
      <SettingsMcpDiagnosticsBatchActions
        disabled={disabled}
        serverCount={parsedServers.length}
        onTestAll={onTestAllServers}
      />
      <SettingsMcpEvidenceProgressBlock
        configText={configText}
        disabled={disabled}
        healthSummaries={healthSummaries}
        lastConfigSavedAt={lastConfigSavedAt}
        toolCount={tools.length}
        onFeedback={onFeedback}
      />
      <SettingsMcpServerHealthList summaries={healthSummaries} />
      <SettingsMcpSessionPoolPanel
        disabled={disabled}
        onFeedback={onFeedback}
        onShowHistory={(serverId) => void history.selectHistoryServer(serverId)}
      />
      <SettingsMcpHistoryPanel
        disabled={disabled}
        entries={history.historyEntries}
        retentionLimit={history.historyRetentionLimit}
        selectedServerId={history.historyServerId}
        serverIds={parsedServers.map((server) => server.id).filter(Boolean)}
        totalCount={history.historyTotalCount}
        onClearHistory={() => onRunBusyTask(history.clearHistory)}
        onEditServer={onEditServer}
        onExportHistory={history.exportHistory}
        onFeedback={onFeedback}
        onRefreshHistory={() => history.refreshHistory()}
        onRunServerDiagnostic={onRunServerDiagnostic}
        onSelectServer={(serverId) => onRunBusyTask(() => history.selectHistoryServer(serverId))}
        onSetRetentionLimit={(limit) => onRunBusyTask(() => history.setRetentionLimit(limit))}
      />
      <SettingsMcpToolRiskList config={config} tools={tools} />
      {feedback ? (
        <div className="rounded-sm border border-border bg-background/40 px-3 py-2">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
