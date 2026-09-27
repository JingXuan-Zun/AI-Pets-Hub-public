import { Download, FileJson, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type {
  GroupMemoryCandidateShadowReadiness,
  GroupMemoryShadowCorpusImportIssueCode,
  GroupMemoryRepositoryData,
} from '../../group-memory';
import { Button } from '../../../components/ui/button';
import {
  useSettingsGroupMemoryShadowCorpusPreview,
  type GroupMemoryShadowCorpusPreviewState,
} from './useSettingsGroupMemoryShadowCorpusPreview';
import { downloadGroupMemoryShadowCorpusTemplate } from './groupMemoryShadowCorpusTemplateDownload';
import { SettingsGroupMemoryShadowCorpusGuide } from './SettingsGroupMemoryShadowCorpusGuide';
import { SettingsGroupMemoryAutoWriteReadiness } from './SettingsGroupMemoryAutoWriteReadiness';

const ISSUE_LABELS: Record<GroupMemoryShadowCorpusImportIssueCode, string> = {
  'corpus-too-large': '文件超过 1 MB',
  'duplicate-candidate-id': '候选 ID 重复',
  'duplicate-sample-id': '样本 ID 重复',
  'forbidden-field': '包含禁止导入的原始数据字段',
  'invalid-corpus-id': '语料 ID 无效',
  'invalid-json': 'JSON 格式损坏',
  'invalid-root': 'JSON 根结构无效',
  'invalid-sample': '样本结构无效',
  'invalid-samples': '样本列表无效',
  'redaction-not-confirmed': '未确认已经人工脱敏',
  'sensitive-content': '检测到可能的隐私或凭据',
  'too-many-samples': '样本超过 500 条',
  'unsupported-schema': '语料版本不受支持',
};

const READINESS_LABELS: Record<GroupMemoryCandidateShadowReadiness, string> = {
  'below-eligible-precision': '自动放行精度不足',
  'below-overall-accuracy': '总体准确率不足',
  'insufficient-eligible-samples': '实际任务正例不足',
  'insufficient-samples': '总样本数量不足',
  ready: '达到当前离线门槛',
  'unsafe-false-eligible': '存在危险误放行',
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function TemplateDownloadButton({ style }: { style?: CSSProperties }) {
  return (
    <Button
      type="button" variant="outline" size="sm" style={style}
      onClick={downloadGroupMemoryShadowCorpusTemplate}
      className="h-8 rounded-full px-3 text-2xs"
    >
      <Download className="mr-1 h-3 w-3" />下载示例模板
    </Button>
  );
}

function ImportIssues({ preview }: { preview: GroupMemoryShadowCorpusPreviewState }) {
  if (preview.status === 'read-failed') {
    return <p className="mt-2 text-3xs text-destructive">{preview.errorMessage}</p>;
  }
  if (!preview.issues.length) return null;
  return (
    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-3xs text-destructive">
      {preview.issues.slice(0, 20).map((issue, index) => (
        <li key={`${issue.code}-${issue.path}-${index}`}>
          {ISSUE_LABELS[issue.code]}：<span className="font-mono">{issue.path}</span>
        </li>
      ))}
    </ul>
  );
}

function ShadowReport({ preview }: { preview: GroupMemoryShadowCorpusPreviewState }) {
  const report = preview.report;
  if (!report) return null;
  return (
    <div className="mt-3 space-y-2 rounded-sm border border-border bg-background/40 p-2 text-3xs">
      <div className="font-medium text-foreground">
        {preview.corpusId} · {READINESS_LABELS[report.readiness]}
      </div>
      <div className="grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-4">
        <span>样本 {report.sampleCount}</span>
        <span>任务正例 {report.expectedEligibleCount}</span>
        <span>准确率 {percent(report.accuracy)}</span>
        <span>放行精度 {percent(report.eligiblePrecision)}</span>
      </div>
      <div className={report.falseEligibleCount ? 'text-destructive' : 'text-muted-foreground'}>
        危险误放行：{report.falseEligibleCount}
      </div>
      {report.mismatches.length ? (
        <ul className="max-h-28 space-y-1 overflow-y-auto border-t border-border pt-2 text-muted-foreground">
          {report.mismatches.slice(0, 10).map((mismatch) => (
            <li key={mismatch.sampleId} className="break-all font-mono">
              {mismatch.sampleId} · {mismatch.expectedDecision} → {mismatch.actualDecision}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface SettingsGroupMemoryShadowCorpusPreviewProps {
  noDragRegionStyle?: CSSProperties;
  repository: GroupMemoryRepositoryData;
}

export function SettingsGroupMemoryShadowCorpusPreview(
  { noDragRegionStyle, repository }: SettingsGroupMemoryShadowCorpusPreviewProps,
) {
  const { clear, loadFile, preview } = useSettingsGroupMemoryShadowCorpusPreview();
  return (
    <details className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-primary">
        离线候选语料评估（只读、不保存）
      </summary>
      <p className="mt-2 text-3xs leading-4 text-muted-foreground">
        仅在当前设置页内存中读取人工脱敏 JSON；不会上传、写入配置或生成记忆候选。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TemplateDownloadButton style={noDragRegionStyle} />
        <label
          style={noDragRegionStyle}
          className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border bg-background px-3 text-2xs text-foreground"
        >
          <FileJson className="mr-1 h-3 w-3" />选择 JSON
          <input
            type="file" accept="application/json,.json" className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = '';
              void loadFile(file);
            }}
          />
        </label>
        {preview.fileName ? <span className="max-w-52 truncate text-3xs">{preview.fileName}</span> : null}
        {preview.status === 'reading' ? <span className="text-3xs">正在校验…</span> : null}
        {preview.status !== 'idle' ? (
          <Button
            type="button" variant="ghost" size="sm" style={noDragRegionStyle}
            onClick={clear} className="h-7 rounded-full px-2 text-3xs"
          >
            <X className="mr-1 h-3 w-3" />清除
          </Button>
        ) : null}
      </div>
      <ImportIssues preview={preview} />
      <ShadowReport preview={preview} />
      <SettingsGroupMemoryAutoWriteReadiness noDragRegionStyle={noDragRegionStyle}
        repository={repository}
        shadowReport={preview.report} />
      <SettingsGroupMemoryShadowCorpusGuide />
    </details>
  );
}
