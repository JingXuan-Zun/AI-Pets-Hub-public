import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface SettingsMcpHistoryControlsProps {
  disabled?: boolean;
  retentionLimit: number;
  selectedServerId?: string;
  totalCount: number;
  onClearHistory: () => Promise<void>;
  onExportHistory: () => Promise<DesktopPetMcpHistoryExportResultLike>;
  onSetRetentionLimit: (limit: number) => Promise<void>;
}

function downloadHistoryExport(result: DesktopPetMcpHistoryExportResultLike) {
  if (!result.ok || !result.text || typeof window === 'undefined') {
    return false;
  }

  const url = window.URL.createObjectURL(new Blob([result.text], {
    type: result.mimeType || 'application/json',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName || 'mcp-history.json';
  link.click();
  window.URL.revokeObjectURL(url);
  return true;
}

export function SettingsMcpHistoryControls({
  disabled = false,
  retentionLimit,
  selectedServerId = '',
  totalCount,
  onClearHistory,
  onExportHistory,
  onSetRetentionLimit,
}: SettingsMcpHistoryControlsProps) {
  const [limitText, setLimitText] = useState(String(retentionLimit || 80));

  const commitRetentionLimit = async () => {
    const parsed = Number(limitText);
    if (!Number.isFinite(parsed)) {
      setLimitText(String(retentionLimit || 80));
      return;
    }

    await onSetRetentionLimit(parsed);
  };
  const exportHistory = async () => {
    downloadHistoryExport(await onExportHistory());
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="mr-auto text-2xs text-muted-foreground">
        MCP history retention: {totalCount}/{retentionLimit || 80}{selectedServerId ? ` / ${selectedServerId}` : ''}
      </div>
      <Input
        className="h-7 w-20 text-2xs"
        min={1}
        max={200}
        type="number"
        value={limitText}
        disabled={disabled}
        onBlur={() => void commitRetentionLimit()}
        onChange={(event) => setLimitText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void commitRetentionLimit();
          }
        }}
      />
      <Button type="button" variant="outline" size="icon-xs" title="Export MCP history" disabled={disabled || totalCount === 0} onClick={() => void exportHistory()}>
        <Download className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" title="Clear MCP history" disabled={disabled || totalCount === 0} onClick={() => void onClearHistory()}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
