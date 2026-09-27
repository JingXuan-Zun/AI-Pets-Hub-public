import { Download } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  buildGroupMemoryReadinessApprovalReleaseChecklist,
  type GroupMemoryReadinessApprovalReleaseGateId,
  type GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessApprovalHistory } from './groupMemoryReadinessApprovalHistoryDownload';

const LABELS: Record<GroupMemoryReadinessApprovalReleaseGateId, string> = {
  'decision-stability': '审批结论没有回退或反复', 'history-status': '审批历史链整体一致',
  'latest-approval': '最新结论为通过证据', 'manual-release-review-boundary': '仅进入人工发布评审确认',
  'receipt-count': '至少两份严格审批回执', 'source-order': '源趋势报告顺序未回退',
  'time-validity': '审批回执均未过期且不来自未来', 'unique-reviews': '无重复时间或重复源报告',
};

export function SettingsGroupMemoryReadinessApprovalReleaseChecklist(props: {
  audit: GroupMemoryReadinessReviewTrendApprovalHistoryAudit;
  noDragRegionStyle?: CSSProperties;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => { setAcknowledged(false); }, [props.audit]);
  const checklist = buildGroupMemoryReadinessApprovalReleaseChecklist(
    props.audit, acknowledged,
  );
  return <div className="space-y-1 rounded-sm bg-background/40 p-2">
    <p className="font-medium text-foreground">最终人工发布前检查：{checklist.decision}</p>
    {checklist.gates.map((gate) => <div key={gate.id}
      className="flex items-center justify-between gap-2 text-muted-foreground">
      <span>{LABELS[gate.id]}</span><span>{gate.status}</span>
    </div>)}
    <label className="flex items-center gap-1 text-muted-foreground" style={props.noDragRegionStyle}>
      <input type="checkbox" checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
      我确认该结果只进入人工发布评审，不会自动启用任何功能
    </label>
    <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
      onClick={() => downloadGroupMemoryReadinessApprovalHistory(props.audit, acknowledged)}>
      <Download className="mr-1 h-3 w-3" />导出脱敏审批历史报告
    </Button>
    <p className="text-muted-foreground">报告不可执行，自动长期写入继续关闭。</p>
  </div>;
}
