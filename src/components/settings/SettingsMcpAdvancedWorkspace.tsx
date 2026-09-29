import { Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { SettingsMcpConfigEditorBlock } from './SettingsMcpConfigEditorBlock';
import { SettingsMcpOperationalPanels } from './SettingsMcpOperationalPanels';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import type { SettingsMcpServerHealthSummary } from './settingsMcpHealthSummary';
import type { UseSettingsMcpHistoryControlsResult } from './useSettingsMcpHistoryControls';

interface SettingsMcpAdvancedWorkspaceProps {
  config: Record<string, unknown>;
  configPath: string;
  configText: string;
  disabled: boolean;
  draft: SettingsMcpServerDraft;
  feedback: string;
  healthSummaries: SettingsMcpServerHealthSummary[];
  history: UseSettingsMcpHistoryControlsResult;
  lastConfigSavedAt: number | null;
  parsedServers: SettingsMcpServerDraft[];
  showSkillMcpProgress: boolean;
  tools: DesktopPetMcpToolLike[];
  onConfigTextChange: (text: string) => void;
  onDraftChange: (draft: SettingsMcpServerDraft) => void;
  onEditServer: (serverId: string) => void;
  onFeedback: (message: string) => void;
  onRunBusyTask: (task: () => Promise<void>) => Promise<void>;
  onRunServerDiagnostic: (serverId: string) => Promise<void> | void;
  onSaveConfig: () => void;
  onTestAllServers: () => void;
  onTestServer: (serverId: string) => void;
}

function AdvancedWorkspaceHeader({
  disabled,
  onSaveConfig,
}: Pick<SettingsMcpAdvancedWorkspaceProps, 'disabled' | 'onSaveConfig'>) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-semibold text-foreground">高级配置与诊断</div>
        <div className="mt-1 text-2xs text-muted-foreground">供熟悉 MCP、命令行和权限策略的用户使用。</div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onSaveConfig}>
        <Save className="h-3.5 w-3.5" />
        保存配置
      </Button>
    </div>
  );
}

export function SettingsMcpAdvancedWorkspace(props: SettingsMcpAdvancedWorkspaceProps) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <AdvancedWorkspaceHeader disabled={props.disabled} onSaveConfig={props.onSaveConfig} />
      <SettingsMcpConfigEditorBlock
        configText={props.configText}
        draft={props.draft}
        onConfigTextChange={props.onConfigTextChange}
        onDraftChange={props.onDraftChange}
        onFeedback={props.onFeedback}
        onTestServer={props.onTestServer}
      />
      <SettingsMcpOperationalPanels
        config={props.config}
        configPath={props.configPath}
        configText={props.configText}
        disabled={props.disabled}
        feedback={props.feedback}
        healthSummaries={props.healthSummaries}
        history={props.history}
        lastConfigSavedAt={props.lastConfigSavedAt}
        parsedServers={props.parsedServers}
        showSkillMcpProgress={props.showSkillMcpProgress}
        tools={props.tools}
        onConfigTextChange={props.onConfigTextChange}
        onEditServer={props.onEditServer}
        onFeedback={props.onFeedback}
        onRunBusyTask={props.onRunBusyTask}
        onRunServerDiagnostic={props.onRunServerDiagnostic}
        onTestAllServers={props.onTestAllServers}
      />
    </div>
  );
}
