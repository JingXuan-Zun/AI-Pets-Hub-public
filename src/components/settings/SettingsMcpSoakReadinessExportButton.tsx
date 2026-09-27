import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

interface SettingsMcpSoakReadinessExportButtonProps {
  disabled?: boolean;
  summary: SettingsMcpSoakReadinessSummaryResult;
}

function createReadinessExportText(summary: SettingsMcpSoakReadinessSummaryResult) {
  return `${JSON.stringify({
    exportedAt: new Date().toISOString(),
    kind: 'mcp-real-server-soak-readiness-settings-export',
    summary,
    version: 1,
  }, null, 2)}\n`;
}

function createReadinessExportName(summary: SettingsMcpSoakReadinessSummaryResult) {
  const source = summary.source || 'unknown';
  const status = summary.status || 'blocked';
  return `mcp-soak-readiness-${source}-${status}.json`;
}

export function SettingsMcpSoakReadinessExportButton({
  disabled = false,
  summary,
}: SettingsMcpSoakReadinessExportButtonProps) {
  const exportSummary = () => {
    downloadJsonTextFile(createReadinessExportName(summary), createReadinessExportText(summary));
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={exportSummary}
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </Button>
  );
}
