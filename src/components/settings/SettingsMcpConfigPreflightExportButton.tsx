import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import {
  createSettingsMcpConfigPreflightExportName,
  formatSettingsMcpConfigPreflightExportText,
} from './settingsMcpConfigPreflightExport';
import { downloadJsonTextFile } from './settingsDownloadUtils';

interface SettingsMcpConfigPreflightExportButtonProps {
  preflight: SettingsMcpConfigPreflightResult;
}

export function SettingsMcpConfigPreflightExportButton({
  preflight,
}: SettingsMcpConfigPreflightExportButtonProps) {
  const exportPreflight = () => {
    downloadJsonTextFile(
      createSettingsMcpConfigPreflightExportName(preflight),
      formatSettingsMcpConfigPreflightExportText(preflight),
    );
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={exportPreflight}
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </Button>
  );
}
