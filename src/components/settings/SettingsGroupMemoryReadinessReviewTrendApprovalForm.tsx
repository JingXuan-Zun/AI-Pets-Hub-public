import { Download } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH,
  canRecordGroupMemoryReadinessReviewTrendApproval,
  type GroupMemoryReadinessReviewTrendApprovalDecision,
  type GroupMemoryReadinessReviewTrendExport,
  type GroupMemoryReadinessReviewTrendImportIssue,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessReviewTrendApproval } from './groupMemoryReadinessReviewTrendApprovalDownload';

const LABELS: Record<GroupMemoryReadinessReviewTrendApprovalDecision, string> = {
  'accept-evidence-for-manual-review': '通过证据，进入后续人工评审',
  'needs-more-evidence': '需要补充证据', 'reject-for-now': '暂时驳回',
};

export function SettingsGroupMemoryReadinessReviewTrendApprovalForm(props: {
  issues: GroupMemoryReadinessReviewTrendImportIssue[];
  noDragRegionStyle?: CSSProperties; report: GroupMemoryReadinessReviewTrendExport;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [decision, setDecision] = useState<GroupMemoryReadinessReviewTrendApprovalDecision>(
    'needs-more-evidence',
  );
  const [rationale, setRationale] = useState('');
  useEffect(() => {
    setAcknowledged(false); setDecision('needs-more-evidence'); setRationale('');
  }, [props.report]);
  const input = { decision, issues: props.issues,
    noAutomaticApplicationAcknowledged: acknowledged, rationale, report: props.report };
  const recordable = canRecordGroupMemoryReadinessReviewTrendApproval(input);
  return <div className="space-y-2 rounded-sm bg-background/40 p-2">
    <select value={decision} style={props.noDragRegionStyle}
      onChange={(event) => setDecision(event.currentTarget.value as GroupMemoryReadinessReviewTrendApprovalDecision)}>
      {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <textarea value={rationale}
      maxLength={MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH}
      onChange={(event) => setRationale(event.currentTarget.value)} style={props.noDragRegionStyle}
      placeholder="审批备注（不导出原文）" className="min-h-14 w-full border bg-background p-2" />
    <label className="flex items-center gap-1 text-muted-foreground" style={props.noDragRegionStyle}>
      <input type="checkbox" checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
      我确认回执不可执行，不会自动应用或开启正式写入
    </label>
    {decision === 'accept-evidence-for-manual-review' && !recordable
      && <p className="text-destructive">只有清单就绪且报告未过期时才能记录通过。</p>}
    <Button type="button" variant="outline" size="sm" disabled={!recordable}
      style={props.noDragRegionStyle} onClick={() => downloadGroupMemoryReadinessReviewTrendApproval(input)}>
      <Download className="mr-1 h-3 w-3" />导出不可执行审批回执
    </Button>
  </div>;
}
