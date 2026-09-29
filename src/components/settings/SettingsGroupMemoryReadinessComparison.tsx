import { Download, FileJson, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type {
  GroupMemoryReadinessComparison,
  GroupMemoryReadinessComparisonStatus,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import { downloadGroupMemoryReadinessComparison } from './groupMemoryReadinessComparisonDownload';
import { SettingsGroupMemoryReadinessReviewWorkspace } from './SettingsGroupMemoryReadinessReviewWorkspace';
import {
  useSettingsGroupMemoryReadinessComparison,
  type GroupMemoryReadinessComparisonIssueCode,
} from './useSettingsGroupMemoryReadinessComparison';

const STATUS_LABELS: Record<GroupMemoryReadinessComparisonStatus, string> = {
  'accuracy-drift': '准确率出现明显下滑',
  'duplicate-report-time': '报告时间重复，不能视为独立运行',
  'eligible-precision-drift': '放行精度出现明显下滑',
  'insufficient-reports': '至少需要3份报告',
  'not-all-shadow-ready': '并非所有报告都达到 shadow-ready',
  'stable-shadow-evidence': '多批次结果稳定',
  'unsafe-false-eligible': '至少一批存在危险误放行',
  'unstable-gates': '至少一项门禁未持续通过',
};

const ISSUE_LABELS: Record<GroupMemoryReadinessComparisonIssueCode, string> = {
  'batch-too-large': '文件总大小超过1 MB',
  'file-too-large': '单个文件超过256 KB',
  'invalid-report': '不是受支持的脱敏门禁报告',
  'too-many-files': '一次最多选择10份报告',
};

function percent(value: number) { return `${(value * 100).toFixed(1)}%`; }

function ComparisonResult({ comparison }: { comparison: GroupMemoryReadinessComparison }) {
  return <div className="mt-2 space-y-1 rounded-sm bg-background/40 p-2 text-3xs">
    <div className="font-medium text-foreground">{STATUS_LABELS[comparison.status]}</div>
    <div className="grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-3">
      <span>报告 {comparison.reportCount}</span>
      <span>最低准确率 {percent(comparison.minimumAccuracy)}</span>
      <span>最低放行精度 {percent(comparison.minimumEligiblePrecision)}</span>
      <span>最新准确率回落 {percent(comparison.accuracyDrop)}</span>
      <span>最新放行精度回落 {percent(comparison.eligiblePrecisionDrop)}</span>
      <span>未持续通过门禁 {comparison.unstableGateIds.length}</span>
    </div>
    <p className="text-muted-foreground">
      报告不包含语料批次标识，因此批次独立性必须由测试人员人工确认，程序无法验证。
    </p>
    <p className="text-muted-foreground">
      稳定仅表示离线证据连续达标，不会开启自动正式写入。
    </p>
  </div>;
}

function ComparisonExportActions(props: {
  comparison: GroupMemoryReadinessComparison;
  confirmed: boolean;
  noDragRegionStyle?: CSSProperties;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  return <div className="mt-2 flex flex-wrap items-center gap-2 text-3xs">
    <label className="inline-flex items-center gap-1 text-muted-foreground"
      style={props.noDragRegionStyle}>
      <input type="checkbox" checked={props.confirmed}
        onChange={(event) => props.onConfirmedChange(event.currentTarget.checked)} />
      我已人工确认这些报告来自相互独立的测试批次
    </label>
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-3xs"
      style={props.noDragRegionStyle}
      onClick={() => downloadGroupMemoryReadinessComparison(props.comparison, props.confirmed)}>
      <Download className="mr-1 h-3 w-3" />导出稳定性留档
    </Button>
    <span className="text-muted-foreground">
      导出会记录人工声明，同时明确标记“程序未验证”。
    </span>
  </div>;
}

export function SettingsGroupMemoryReadinessComparison(
  props: { noDragRegionStyle?: CSSProperties },
) {
  const [independentBatchesConfirmed, setIndependentBatchesConfirmed] = useState(false);
  const { clear, loadFiles, preview } = useSettingsGroupMemoryReadinessComparison();
  const comparison = preview.comparison;
  const clearComparison = () => { setIndependentBatchesConfirmed(false); clear(); };
  return <details className="rounded-sm border border-primary/30 bg-primary/5 px-2 py-1.5">
    <summary className="cursor-pointer text-3xs text-primary">
      多份脱敏门禁报告稳定性对比
    </summary>
    <p className="mt-2 text-3xs leading-4 text-muted-foreground">
      选择3–10份不同测试批次导出的报告。仅在当前页面内存中比较，不保存、不上传。
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label style={props.noDragRegionStyle}
        className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border bg-background px-3 text-3xs">
        <FileJson className="mr-1 h-3 w-3" />选择报告
        <input type="file" accept="application/json,.json" multiple className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            setIndependentBatchesConfirmed(false);
            void loadFiles(files);
          }} />
      </label>
      {preview.fileCount > 0 && <span className="text-3xs">{preview.fileCount}份</span>}
      {preview.status === 'reading' && <span className="text-3xs">正在比较…</span>}
      {preview.status !== 'idle' && <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clearComparison} className="h-7 px-2 text-3xs">
        <X className="mr-1 h-3 w-3" />清除
      </Button>}
    </div>
    {preview.issues.length > 0 && <ul className="mt-2 text-3xs text-destructive">
      {preview.issues.map((item, index) => <li key={`${item.code}:${item.fileName}:${index}`}>
        {ISSUE_LABELS[item.code]}{item.fileName ? `：${item.fileName}` : ''}
      </li>)}
    </ul>}
    {preview.status === 'read-failed' && <p className="mt-2 text-3xs text-destructive">
      文件读取失败，请重新选择。
    </p>}
    {comparison && <ComparisonResult comparison={comparison} />}
    {comparison && <ComparisonExportActions comparison={comparison}
      confirmed={independentBatchesConfirmed} noDragRegionStyle={props.noDragRegionStyle}
      onConfirmedChange={setIndependentBatchesConfirmed} />}
    {comparison && <SettingsGroupMemoryReadinessReviewWorkspace comparison={comparison}
      independentBatchesConfirmedByTester={independentBatchesConfirmed}
      noDragRegionStyle={props.noDragRegionStyle} />}
  </details>;
}
