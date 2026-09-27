import { Download, Files, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type {
  GroupMemoryReadinessComparison,
  GroupMemoryReadinessReviewHistoryAudit,
  GroupMemoryReadinessReviewHistoryStatus,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessReviewHistoryAudit } from './groupMemoryReadinessReviewHistoryDownload';
import {
  useSettingsGroupMemoryReadinessReviewHistory,
  type GroupMemoryReadinessReviewHistoryIssue,
} from './useSettingsGroupMemoryReadinessReviewHistory';

const STATUS_LABELS: Record<GroupMemoryReadinessReviewHistoryStatus, string> = {
  'consistent-history': '历史链一致', 'decision-oscillation': '评审结论出现反复',
  'decision-regression': '后续评审结论发生回退', 'duplicate-reviewed-at': '存在重复评审时间',
  'evidence-regression': '后续凭证引用了更旧证据', 'expired-receipts': '历史链包含过期凭证',
  'future-reviewed-at': '历史链包含未来评审时间',
};
const ISSUE_LABELS: Record<GroupMemoryReadinessReviewHistoryIssue, string> = {
  'batch-too-large': '文件总大小超过512 KB', 'file-too-large': '单个文件超过64 KB',
  'invalid-receipt': '至少一个文件不是有效的严格评审凭证',
  'too-few-files': '至少需要2份评审凭证', 'too-many-files': '一次最多选择10份凭证',
};

function HistoryAuditResult(props: {
  audit: GroupMemoryReadinessReviewHistoryAudit; noDragRegionStyle?: CSSProperties;
}) {
  const audit = props.audit;
  return <div className="space-y-1">
    <p className={audit.status === 'consistent-history' ? 'text-emerald-600' : 'text-destructive'}>
      {STATUS_LABELS[audit.status]}
    </p>
    <p className="text-muted-foreground">证据回退 {audit.evidenceRegressionCount} · 结论回退 {audit.decisionRegressionCount}
      {' '}· 结论反复 {audit.decisionOscillationCount} · 重复时间 {audit.duplicateReviewedAtCount}</p>
    <p className="text-muted-foreground">匹配当前证据 {audit.currentComparisonMatchCount}/{audit.receiptCount}
      {' '}· 最新凭证匹配 {audit.latestMatchesCurrentComparison ? '是' : '否'}</p>
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-3xs"
      style={props.noDragRegionStyle}
      onClick={() => downloadGroupMemoryReadinessReviewHistoryAudit(audit)}>
      <Download className="mr-1 h-3 w-3" />导出脱敏历史审计报告
    </Button>
    <p className="text-muted-foreground">仅导出聚合计数和最终状态，不包含原始凭证或各凭证时间。</p>
  </div>;
}

export function SettingsGroupMemoryReadinessReviewHistory(props: {
  comparison: GroupMemoryReadinessComparison; noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFiles, preview } = useSettingsGroupMemoryReadinessReviewHistory(props.comparison);
  const audit = preview.audit;
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">多份评审凭证历史链审计</div>
    <p className="text-muted-foreground">选择2–10份凭证。只读、仅内存，不保存、不执行、不启用写入。</p>
    <div className="flex flex-wrap items-center gap-2">
      <label style={props.noDragRegionStyle}
        className="inline-flex h-7 cursor-pointer items-center rounded-full border border-border px-2">
        <Files className="mr-1 h-3 w-3" />选择多份凭证
        <input type="file" accept="application/json,.json" multiple className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
            void loadFiles(files);
          }} />
      </label>
      {preview.fileCount > 0 && <span>{preview.fileCount}份</span>}
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear} className="h-7 px-2 text-3xs">
        <X className="mr-1 h-3 w-3" />清除
      </Button>}
    </div>
    {preview.status === 'reading' && <p>正在审计…</p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.map((issue) => <p key={issue} className="text-destructive">{ISSUE_LABELS[issue]}</p>)}
    {audit && <HistoryAuditResult audit={audit} noDragRegionStyle={props.noDragRegionStyle} />}
  </div>;
}
