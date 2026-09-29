import { RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface SettingsMcpSectionHeaderProps {
  advancedOpen: boolean;
  disabled?: boolean;
  description: string;
  title: string;
  onRefreshTools: () => void;
  onToggleAdvanced: () => void;
}

export function SettingsMcpSectionHeader({
  advancedOpen,
  disabled = false,
  description,
  title,
  onRefreshTools,
  onToggleAdvanced,
}: SettingsMcpSectionHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="text-xs font-semibold tracking-wide text-foreground">{title}</div>
        <div className="text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onRefreshTools}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新状态
        </Button>
        <Button type="button" variant="ghost" size="sm" aria-expanded={advancedOpen} onClick={onToggleAdvanced}>
          <Settings2 className="h-3.5 w-3.5" />
          {advancedOpen ? '收起高级设置' : '高级设置'}
        </Button>
      </div>
    </div>
  );
}
