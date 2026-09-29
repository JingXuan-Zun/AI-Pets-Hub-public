import { RefreshCcw, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface SettingsMcpSoakReadinessActionsProps {
  disabled: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onImport: () => void;
}

export function SettingsMcpSoakReadinessActions({
  disabled,
  isGenerating,
  onGenerate,
  onImport,
}: SettingsMcpSoakReadinessActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isGenerating}
        onClick={onGenerate}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Generate
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onImport}
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
    </div>
  );
}
