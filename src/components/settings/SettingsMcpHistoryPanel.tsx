import { SettingsMcpHistoryControls } from './SettingsMcpHistoryControls';
import { SettingsMcpHistoryList } from './SettingsMcpHistoryList';
import { SettingsMcpHistoryServerFilter } from './SettingsMcpHistoryServerFilter';
import { SettingsMcpLifecycleSummaryPanel } from './SettingsMcpLifecycleSummaryPanel';

interface SettingsMcpHistoryPanelProps {
  disabled?: boolean;
  entries: DesktopPetMcpHistoryEntryLike[];
  retentionLimit: number;
  selectedServerId: string;
  serverIds: string[];
  totalCount: number;
  onClearHistory: () => Promise<void>;
  onEditServer?: (serverId: string) => void;
  onExportHistory: () => Promise<DesktopPetMcpHistoryExportResultLike>;
  onFeedback?: (message: string) => void;
  onRefreshHistory?: () => Promise<void>;
  onRunServerDiagnostic?: (serverId: string) => Promise<void> | void;
  onSelectServer: (serverId: string) => Promise<void>;
  onSetRetentionLimit: (limit: number) => Promise<void>;
}

export function SettingsMcpHistoryPanel({
  disabled = false,
  entries,
  retentionLimit,
  selectedServerId,
  serverIds,
  totalCount,
  onClearHistory,
  onEditServer,
  onExportHistory,
  onFeedback,
  onRefreshHistory,
  onRunServerDiagnostic,
  onSelectServer,
  onSetRetentionLimit,
}: SettingsMcpHistoryPanelProps) {
  return (
    <>
      <SettingsMcpHistoryServerFilter
        disabled={disabled}
        selectedServerId={selectedServerId}
        serverIds={serverIds}
        onSelectServer={(serverId) => void onSelectServer(serverId)}
      />
      <SettingsMcpHistoryControls
        disabled={disabled}
        retentionLimit={retentionLimit}
        selectedServerId={selectedServerId}
        totalCount={totalCount}
        onClearHistory={onClearHistory}
        onExportHistory={onExportHistory}
        onSetRetentionLimit={onSetRetentionLimit}
      />
      <SettingsMcpLifecycleSummaryPanel
        disabled={disabled}
        entries={entries}
        onEditServer={onEditServer}
        onFeedback={onFeedback}
        onRefreshHistory={onRefreshHistory}
        onRunDiagnostic={onRunServerDiagnostic}
      />
      <SettingsMcpHistoryList entries={entries} />
    </>
  );
}
