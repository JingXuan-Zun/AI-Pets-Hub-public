import { Files, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { GroupMemoryReadinessReviewTrendApprovalHistoryStatus } from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { SettingsGroupMemoryReadinessApprovalReleaseChecklist } from './SettingsGroupMemoryReadinessApprovalReleaseChecklist';
import {
  useSettingsGroupMemoryReadinessReviewTrendApprovalHistory,
  type GroupMemoryReadinessReviewTrendApprovalHistoryIssue,
} from './useSettingsGroupMemoryReadinessReviewTrendApprovalHistory';

const STATUS_LABELS: Record<GroupMemoryReadinessReviewTrendApprovalHistoryStatus, string> = {
  'consistent-history': '审批历史链一致', 'decision-oscillation': '审批结论出现反复',
  'decision-regression': '后续审批结论发生回退', 'duplicate-reviewed-at': '存在重复审批时间',
  'duplicate-source-report': '同一趋势报告被重复审批', 'expired-receipts': '包含过期回执',
  'future-reviewed-at': '包含未来审批时间', 'source-report-regression': '后续审批引用了更旧趋势报告',
};
const ISSUE_LABELS: Record<GroupMemoryReadinessReviewTrendApprovalHistoryIssue, string> = {
  'batch-too-large': '文件总大小超过512 KB', 'file-too-large': '单个文件超过64 KB',
  'invalid-receipt': '至少一个文件不是严格审批回执',
  'too-few-files': '至少需要2份审批回执', 'too-many-files': '一次最多选择10份回执',
};

export function SettingsGroupMemoryReadinessReviewTrendApprovalHistory(props: {
  noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFiles, preview } = useSettingsGroupMemoryReadinessReviewTrendApprovalHistory();
  const audit = preview.audit;
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">审批回执历史链审计</div>
    <p className="text-muted-foreground">严格读取2–10份回执，只读、仅内存，不保存、不执行、不启用写入。</p>
    <div className="flex items-center gap-2">
      <label style={props.noDragRegionStyle} className="inline-flex h-7 cursor-pointer items-center border px-2">
        <Files className="mr-1 h-3 w-3" />选择审批回执
        <input type="file" accept="application/json,.json" multiple className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
            void loadFiles(files);
          }} />
      </label>
      {preview.fileCount > 0 && <span>{preview.fileCount}份</span>}
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear}><X className="mr-1 h-3 w-3" />清除</Button>}
    </div>
    {preview.status === 'reading' && <p>正在审计…</p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.map((issue) => <p key={issue} className="text-destructive">{ISSUE_LABELS[issue]}</p>)}
    {audit && <div className="space-y-1">
      <p className={audit.status === 'consistent-history' ? 'text-emerald-600' : 'text-destructive'}>
        {STATUS_LABELS[audit.status]}
      </p>
      <p className="text-muted-foreground">源报告回退 {audit.sourceReportRegressionCount}
        {' '}· 重复源报告 {audit.duplicateSourceReportCount} · 结论回退 {audit.decisionRegressionCount}
        {' '}· 结论反复 {audit.decisionOscillationCount}</p>
      <p className="text-muted-foreground">最新结论 {audit.latestDecision ?? '无'} · 回执 {audit.receiptCount}</p>
      <SettingsGroupMemoryReadinessApprovalReleaseChecklist audit={audit}
        noDragRegionStyle={props.noDragRegionStyle} />
    </div>}
  </div>;
}
