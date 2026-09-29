import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../../../components/ui/button';
import {
  parseSettingsMcpConfigPreflightExportText,
  type SettingsMcpConfigPreflightImportedPayload,
} from './settingsMcpConfigPreflightExport';

interface SettingsMcpConfigPreflightImportButtonProps {
  onError: (message: string) => void;
  onImported: (payload: SettingsMcpConfigPreflightImportedPayload) => void;
}

export function SettingsMcpConfigPreflightImportButton({
  onError,
  onImported,
}: SettingsMcpConfigPreflightImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importFile = async (file: File) => {
    try {
      onImported(parseSettingsMcpConfigPreflightExportText(await file.text(), file.name));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'MCP config preflight import failed.');
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        className="hidden"
        accept="application/json,.json"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            void importFile(file);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
    </>
  );
}
