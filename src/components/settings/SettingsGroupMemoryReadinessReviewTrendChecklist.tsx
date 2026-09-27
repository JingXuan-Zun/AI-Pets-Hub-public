import { Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  buildGroupMemoryReadinessReviewTrendChecklist,
  type GroupMemoryReadinessReviewTrend,
  type GroupMemoryReadinessReviewTrendGateId,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessReviewTrend } from './groupMemoryReadinessReviewTrendDownload';

const GATE_LABELS: Record<GroupMemoryReadinessReviewTrendGateId, string> = {
  'latest-evidence': '最新报告匹配当前证据', 'match-coverage': '证据匹配率未明显回落',
  'regressed-metrics': '审计异常指标未增加', 'report-count': '至少两份严格报告',
  'trend-status': '趋势整体稳定', 'version-identity-attestation': '不同版本快照人工声明',
};

export function SettingsGroupMemoryReadinessReviewTrendChecklist(props: {
  confirmed: boolean; noDragRegionStyle?: CSSProperties;
  trend: GroupMemoryReadinessReviewTrend;
}) {
  const checklist = buildGroupMemoryReadinessReviewTrendChecklist(props.trend, props.confirmed);
  return <div className="mt-2 space-y-1 rounded-sm bg-background/40 p-2">
    <p className="font-medium text-foreground">人工版本评审检查清单：{checklist.decision}</p>
    {checklist.gates.map((gate) => <div key={gate.id}
      className="flex items-center justify-between gap-2 text-muted-foreground">
      <span>{GATE_LABELS[gate.id]}</span><span>{gate.status}</span>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-3xs"
      style={props.noDragRegionStyle}
      onClick={() => downloadGroupMemoryReadinessReviewTrend(props.trend, props.confirmed)}>
      <Download className="mr-1 h-3 w-3" />导出脱敏趋势评审报告
    </Button>
    <p className="text-muted-foreground">
      “可进入人工评审”不是启用许可，报告不可执行，也不会开启自动长期写入。
    </p>
  </div>;
}
