import { Activity, CheckCircle2, CircleAlert } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import {
  getSettingsSkillMcpProgressItems,
  type SettingsSkillMcpProgressItem,
} from './settingsSkillMcpProgress';
import { SettingsSkillMcpProgressEvidenceExchangePanel } from './SettingsSkillMcpProgressEvidenceExchangePanel';
import {
  formatSettingsSkillMcpAreaLabel,
  formatSettingsSkillMcpBlocker,
  formatSettingsSkillMcpEvidence,
  formatSettingsSkillMcpNextStep,
  formatSettingsSkillMcpStatusLabel,
} from './settingsSkillMcpProgressLocale';

const STATUS_CLASS: Record<SettingsSkillMcpProgressItem['status'], string> = {
  'near-complete': 'text-primary',
  partial: 'text-amber-600',
};

function ProgressRow({ item }: { item: SettingsSkillMcpProgressItem }) {
  const Icon = item.status === 'near-complete' ? CheckCircle2 : CircleAlert;
  return (
    <div className="rounded-sm border border-border/80 bg-background/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-2xs font-medium text-foreground">
            {formatSettingsSkillMcpAreaLabel(item.area)}
          </div>
          <div className={`mt-1 flex items-center gap-1 font-mono text-3xs ${STATUS_CLASS[item.status]}`}>
            <Icon className="h-3 w-3 shrink-0" />
            {formatSettingsSkillMcpStatusLabel(item.status)}
          </div>
        </div>
        <div className="shrink-0 font-mono text-[13px] text-foreground">{item.estimateLabel}</div>
      </div>
      <div className="mt-2 line-clamp-2 text-3xs leading-4 text-muted-foreground">
        阻塞：{formatSettingsSkillMcpBlocker(item)}
      </div>
      <div className="mt-1 line-clamp-2 text-3xs leading-4 text-muted-foreground">
        证据：{formatSettingsSkillMcpEvidence(item)}
      </div>
      <div className="mt-1 line-clamp-2 text-3xs leading-4 text-muted-foreground">
        下一步：{formatSettingsSkillMcpNextStep(item)}
      </div>
    </div>
  );
}

export function SettingsSkillMcpProgressPanel() {
  const items = getSettingsSkillMcpProgressItems();
  return (
    <div className="rounded-sm border border-border bg-secondary/15 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            Skill / MCP 进度
          </Label>
          <div className="mt-1 text-2xs text-muted-foreground">
            工程估算、当前阻塞和下一步切片。
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs text-primary">
          <Activity className="h-3.5 w-3.5" />
          {items.length} 个领域
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <ProgressRow key={item.area} item={item} />
        ))}
      </div>
      <SettingsSkillMcpProgressEvidenceExchangePanel />
    </div>
  );
}
