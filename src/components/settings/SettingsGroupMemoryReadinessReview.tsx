import { Download } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH,
  canRecordGroupMemoryReadinessReview,
  type GroupMemoryReadinessComparison,
  type GroupMemoryReadinessReviewDecision,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessReviewReceipt } from './groupMemoryReadinessReviewReceiptDownload';

const DECISION_LABELS: Record<GroupMemoryReadinessReviewDecision, string> = {
  'accept-for-version-review': '通过本轮证据，进入版本评审',
  'needs-more-evidence': '需要补充证据',
  'reject-for-now': '暂时驳回',
};

export function SettingsGroupMemoryReadinessReview(props: {
  comparison: GroupMemoryReadinessComparison;
  independentBatchesConfirmedByTester: boolean;
  noDragRegionStyle?: CSSProperties;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [decision, setDecision] = useState<GroupMemoryReadinessReviewDecision>('needs-more-evidence');
  const [rationale, setRationale] = useState('');
  useEffect(() => {
    setAcknowledged(false); setDecision('needs-more-evidence'); setRationale('');
  }, [props.comparison]);
  const input = {
    comparison: props.comparison, decision,
    independentBatchesConfirmedByTester: props.independentBatchesConfirmedByTester,
    noAutomaticApplicationAcknowledged: acknowledged, rationale,
  };
  const recordable = canRecordGroupMemoryReadinessReview(input);
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">稳定性人工评审结论</div>
    <select value={decision} style={props.noDragRegionStyle}
      onChange={(event) => setDecision(event.currentTarget.value as GroupMemoryReadinessReviewDecision)}
      className="h-7 rounded-sm border border-border bg-background px-2">
      {Object.entries(DECISION_LABELS).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
    <textarea value={rationale} maxLength={MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH}
      style={props.noDragRegionStyle} onChange={(event) => setRationale(event.currentTarget.value)}
      placeholder="评审备注（仅记录是否填写和长度，不导出原文）"
      className="min-h-14 w-full resize-y rounded-sm border border-border bg-background p-2" />
    <label className="flex items-center gap-1 text-muted-foreground" style={props.noDragRegionStyle}>
      <input type="checkbox" checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
      我确认该结论只是不可执行评审凭证，不会自动应用或开启正式写入
    </label>
    {decision === 'accept-for-version-review' && !recordable && <p className="text-destructive">
      只有结果稳定、已人工确认独立批次并确认不可自动应用后，才能记录“通过”。
    </p>}
    <Button type="button" variant="outline" size="sm" disabled={!recordable}
      style={props.noDragRegionStyle} className="h-7 px-2 text-3xs"
      onClick={() => downloadGroupMemoryReadinessReviewReceipt(input)}>
      <Download className="mr-1 h-3 w-3" />导出不可执行评审凭证
    </Button>
  </div>;
}
