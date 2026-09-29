import { Download } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH,
  canRecordGroupMemoryReadinessManualReleaseReview,
  type GroupMemoryReadinessApprovalHistoryExport,
  type GroupMemoryReadinessApprovalHistoryImportIssue,
  type GroupMemoryReadinessManualReleaseDecision,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessManualReleaseReview } from './groupMemoryReadinessManualReleaseReviewDownload';

const LABELS: Record<GroupMemoryReadinessManualReleaseDecision, string> = {
  'accept-for-manual-configuration-review': '通过证据，进入人工配置评审',
  'needs-more-evidence': '需要补充证据', 'reject-for-now': '暂时驳回',
};

export function SettingsGroupMemoryReadinessManualReleaseReviewForm(props: {
  issues: GroupMemoryReadinessApprovalHistoryImportIssue[];
  noDragRegionStyle?: CSSProperties; report: GroupMemoryReadinessApprovalHistoryExport;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [decision, setDecision] = useState<GroupMemoryReadinessManualReleaseDecision>(
    'needs-more-evidence',
  );
  const [rationale, setRationale] = useState('');
  useEffect(() => {
    setAcknowledged(false); setDecision('needs-more-evidence'); setRationale('');
  }, [props.report]);
  const input = { configurationReviewOnlyAcknowledged: acknowledged,
    decision, issues: props.issues, rationale, report: props.report };
  const recordable = canRecordGroupMemoryReadinessManualReleaseReview(input);
  return <div className="space-y-2 rounded-sm bg-background/40 p-2">
    <select value={decision} style={props.noDragRegionStyle}
      onChange={(event) => setDecision(event.currentTarget.value as GroupMemoryReadinessManualReleaseDecision)}>
      {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <textarea value={rationale} maxLength={MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH}
      onChange={(event) => setRationale(event.currentTarget.value)} style={props.noDragRegionStyle}
      placeholder="评审备注（不导出原文）" className="min-h-14 w-full border bg-background p-2" />
    <label className="flex items-center gap-1 text-muted-foreground" style={props.noDragRegionStyle}>
      <input type="checkbox" checked={acknowledged}
        onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
      我确认回执只进入人工配置评审，不会自动应用配置或启用长期写入
    </label>
    <Button type="button" variant="outline" size="sm" disabled={!recordable}
      style={props.noDragRegionStyle} onClick={() => downloadGroupMemoryReadinessManualReleaseReview(input)}>
      <Download className="mr-1 h-3 w-3" />导出不可执行最终评审回执
    </Button>
  </div>;
}
