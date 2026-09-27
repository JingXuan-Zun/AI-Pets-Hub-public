import { Download, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createSettingsMcpSoakEvidenceFileName,
  createSettingsMcpSoakEvidenceText,
} from './settingsMcpSoakEvidence';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';
import { downloadJsonTextFile } from './settingsDownloadUtils';

interface SettingsMcpSoakEvidenceActionsProps {
  disabled?: boolean;
  onClear: () => void;
  onFeedback?: (message: string) => void;
  summary: SettingsMcpSoakSummaryResult | null;
}

export function SettingsMcpSoakEvidenceActions({
  disabled = false,
  onClear,
  onFeedback,
  summary,
}: SettingsMcpSoakEvidenceActionsProps) {
  const exportEvidence = () => {
    if (!summary) {
      return;
    }

    downloadJsonTextFile(createSettingsMcpSoakEvidenceFileName(summary), createSettingsMcpSoakEvidenceText(summary));
    onFeedback?.('MCP soak evidence exported.');
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !summary}
        onClick={exportEvidence}
      >
        <Download className="h-3.5 w-3.5" />
        Export evidence
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !summary}
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
        Clear evidence
      </Button>
    </div>
  );
}
