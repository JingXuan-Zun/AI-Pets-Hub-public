import { Files, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type {
  GroupMemoryReadinessReviewTrend,
  GroupMemoryReadinessReviewTrendStatus,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { SettingsGroupMemoryReadinessReviewTrendChecklist } from './SettingsGroupMemoryReadinessReviewTrendChecklist';
import {
  useSettingsGroupMemoryReadinessReviewTrend,
  type GroupMemoryReadinessReviewTrendIssue,
} from './useSettingsGroupMemoryReadinessReviewTrend';

const STATUS_LABELS: Record<GroupMemoryReadinessReviewTrendStatus, string> = {
  'duplicate-generated-at': '报告生成时间重复', 'insufficient-reports': '报告数量不足',
  'latest-evidence-mismatch': '最新报告的证据匹配失败', 'match-coverage-drift': '证据匹配率明显下降',
  'not-all-consistent': '并非所有历史审计都一致', 'regressed-audit-metrics': '审计异常指标增加',
  'stable-audit-trend': '多报告审计趋势稳定',
};
const ISSUE_LABELS: Record<GroupMemoryReadinessReviewTrendIssue, string> = {
  'batch-too-large': '文件总大小超过512 KB', 'file-too-large': '单个文件超过64 KB',
  'invalid-report': '至少一个文件不是严格的脱敏历史审计报告',
  'too-few-files': '至少需要2份报告', 'too-many-files': '一次最多选择10份报告',
};

function TrendResult(props: {
  confirmed: boolean; noDragRegionStyle?: CSSProperties; trend: GroupMemoryReadinessReviewTrend;
}) {
  return <div className="space-y-1">
    <p className={props.trend.status === 'stable-audit-trend'
      ? 'text-emerald-600' : 'text-destructive'}>{STATUS_LABELS[props.trend.status]}</p>
    <p className="text-muted-foreground">报告 {props.trend.reportCount} · 匹配率回落
      {' '}{(props.trend.matchCoverageDrop * 100).toFixed(1)}% · 恶化指标
      {' '}{props.trend.regressedMetricIds.length}</p>
    <p className="text-muted-foreground">最新证据匹配
      {' '}{props.trend.latestMatchesCurrentComparison ? '是' : '否'} · 不同版本人工声明
      {' '}{props.confirmed ? '已确认' : '未确认'}</p>
    <p className="text-muted-foreground">报告不含版本号，程序无法验证真实版本身份。</p>
    <SettingsGroupMemoryReadinessReviewTrendChecklist confirmed={props.confirmed}
      noDragRegionStyle={props.noDragRegionStyle} trend={props.trend} />
  </div>;
}

export function SettingsGroupMemoryReadinessReviewTrend(props: {
  noDragRegionStyle?: CSSProperties;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const { clear, loadFiles, preview } = useSettingsGroupMemoryReadinessReviewTrend();
  const reset = () => { setConfirmed(false); clear(); };
  return <div className="mt-2 space-y-2 rounded-sm border border-border/70 p-2 text-3xs">
    <div className="font-medium text-foreground">历史审计报告跨版本趋势</div>
    <p className="text-muted-foreground">严格读取2–10份脱敏报告，只读、仅内存，不执行、不启用写入。</p>
    <label className="flex items-center gap-1 text-muted-foreground" style={props.noDragRegionStyle}>
      <input type="checkbox" checked={confirmed}
        onChange={(event) => setConfirmed(event.currentTarget.checked)} />
      我已人工确认这些报告来自不同版本快照
    </label>
    <div className="flex flex-wrap items-center gap-2">
      <label style={props.noDragRegionStyle}
        className="inline-flex h-7 cursor-pointer items-center rounded-full border border-border px-2">
        <Files className="mr-1 h-3 w-3" />选择审计报告
        <input type="file" accept="application/json,.json" multiple className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
            setConfirmed(false); void loadFiles(files);
          }} />
      </label>
      {preview.fileCount > 0 && <span>{preview.fileCount}份</span>}
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={reset} className="h-7 px-2 text-3xs">
        <X className="mr-1 h-3 w-3" />清除
      </Button>}
    </div>
    {preview.status === 'reading' && <p>正在比较…</p>}
    {preview.status === 'read-failed' && <p className="text-destructive">文件读取失败。</p>}
    {preview.issues.map((issue) => <p key={issue} className="text-destructive">{ISSUE_LABELS[issue]}</p>)}
    {preview.trend && <TrendResult confirmed={confirmed}
      noDragRegionStyle={props.noDragRegionStyle} trend={preview.trend} />}
  </div>;
}
