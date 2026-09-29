import { Download, FileJson, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import {
  RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_THRESHOLDS,
  type RelationshipEvidenceWindowReadiness,
} from '../../social-trend';
import { downloadRelationshipEvidenceShadowCorpusTemplate } from './relationshipEvidenceShadowCorpusTemplateDownload';
import {
  useSettingsRelationshipEvidenceShadowCorpus,
  type RelationshipEvidenceShadowPreviewIssueCode,
  type RelationshipEvidenceShadowPreviewState,
} from './useSettingsRelationshipEvidenceShadowCorpus';
import { SettingsRelationshipEvidenceShadowBatchReport } from './SettingsRelationshipEvidenceShadowBatchReport';
import { RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS } from './relationshipEvidenceShadowUiLabels';

const READINESS: RelationshipEvidenceWindowReadiness[] = [
  'insufficient-evidence', 'volatile-shadow', 'sustained-shadow',
];
const READINESS_LABELS: Record<RelationshipEvidenceWindowReadiness, string> = {
  'insufficient-evidence': '证据不足', 'sustained-shadow': '持续模式',
  'volatile-shadow': '波动/矛盾',
};
const ISSUE_LABELS: Record<RelationshipEvidenceShadowPreviewIssueCode, string> = {
  'batch-too-large': '文件总大小超过 5 MB',
  'corpus-too-large': '文件超过 1 MB', 'duplicate-candidate-id': '候选 ID 重复',
  'duplicate-sample-id': '样本 ID 重复', 'forbidden-field': '包含禁止导入的数据字段',
  'duplicate-corpus-id': '语料批次 ID 重复',
  'invalid-corpus-id': '语料 ID 或创建时间无效', 'invalid-json': 'JSON 格式损坏',
  'invalid-root': 'JSON 根结构无效', 'invalid-sample': '样本结构无效',
  'invalid-samples': '样本列表无效', 'redaction-not-confirmed': '未确认人工脱敏',
  'sensitive-content': '检测到可能的隐私或凭据', 'too-many-samples': '样本超过 500 条',
  'unexpected-field': '包含模板未定义字段', 'unsupported-schema': '语料版本不受支持',
  'too-many-files': '一次最多选择 20 个文件',
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function ImportIssues({ preview }: { preview: RelationshipEvidenceShadowPreviewState }) {
  if (preview.status === 'read-failed') {
    return <p className="mt-2 text-3xs text-destructive">{preview.errorMessage}</p>;
  }
  if (!preview.issues.length) return null;
  return <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-3xs text-destructive">
    {preview.issues.slice(0, 20).map((issue, index) => <li
      key={`${issue.code}-${issue.path}-${index}`}>
      {ISSUE_LABELS[issue.code]}：<span className="font-mono">{issue.path}</span>
    </li>)}
  </ul>;
}

function ConfusionMatrix({ preview }: { preview: RelationshipEvidenceShadowPreviewState }) {
  const matrix = preview.report?.confusionMatrix;
  if (!matrix) return null;
  return <div className="overflow-x-auto">
    <table className="w-full min-w-96 border-collapse text-center text-3xs">
      <caption className="mb-1 text-left text-muted-foreground">行是预期，列是实际</caption>
      <thead><tr><th className="p-1 text-left">预期 \ 实际</th>
        {READINESS.map((value) => <th className="p-1" key={value}>{READINESS_LABELS[value]}</th>)}
      </tr></thead>
      <tbody>{READINESS.map((expected) => <tr key={expected} className="border-t border-border">
        <th className="p-1 text-left font-normal">{READINESS_LABELS[expected]}</th>
        {READINESS.map((actual) => <td className="p-1 font-mono" key={actual}>
          {matrix[expected][actual]}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

function ShadowReport({ preview }: { preview: RelationshipEvidenceShadowPreviewState }) {
  const report = preview.report;
  const thresholds = RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_THRESHOLDS;
  if (!report) return null;
  return <div className="mt-3 space-y-2 rounded-sm border border-border bg-background/40 p-2 text-3xs">
    <div className="flex flex-wrap items-center justify-between gap-1 font-medium text-foreground">
      <span>{preview.corpusId}</span><span className="text-primary">
        {RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS[report.calibrationStatus]}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-3">
      <span>样本 {report.sampleCount}</span><span>匹配 {report.matchedCount}</span>
      <span>证据不足类 {report.classCounts['insufficient-evidence']}</span>
      <span>矛盾类 {report.classCounts['volatile-shadow']}</span>
      <span>持续类 {report.classCounts['sustained-shadow']}</span>
      <span>持续误判 {percent(report.sustainedFalsePositiveRate)}</span>
      <span>持续召回 {percent(report.sustainedRecall)}</span>
      <span>矛盾漏检 {percent(report.volatileMissRate)}</span>
      <span>证据不足误判 {percent(report.insufficientMisclassificationRate)}</span>
    </div>
    {report.calibrationIssues.length ? <div className="flex flex-wrap gap-1 text-amber-600">
      {report.calibrationIssues.map((issue) => <span key={issue}
        className="rounded-full border border-current px-2 py-0.5">
        {RELATIONSHIP_EVIDENCE_CALIBRATION_LABELS[issue]}</span>)}
    </div> : null}
    <p className="text-muted-foreground">
      此结论仅表示脱敏语料达到离线校准要求，不代表允许自动生成候选或写入正式关系。
    </p>
    <p className="text-muted-foreground">
      门槛：至少{thresholds.minimumSamples}条、每类至少{thresholds.minimumSamplesPerClass}条；
      持续误判为0，持续召回不低于{percent(thresholds.minimumSustainedRecall)}，
      矛盾漏检和证据不足误判均不高于{percent(thresholds.maximumVolatileMissRate)}。
    </p>
    <ConfusionMatrix preview={preview} />
    {report.mismatches.length ? <ul className="max-h-28 space-y-1 overflow-y-auto border-t border-border pt-2 text-muted-foreground">
      {report.mismatches.slice(0, 10).map((item) => <li key={item.sampleId} className="break-all font-mono">
        {item.sampleId} · {item.expectedReadiness} → {item.actualReadiness}
        {item.reasons.length ? ` · ${item.reasons.join(', ')}` : ''}
      </li>)}
    </ul> : null}
  </div>;
}

export function SettingsRelationshipEvidenceShadowCorpusPreview(props: {
  noDragRegionStyle?: CSSProperties;
}) {
  const { clear, loadFiles, preview } = useSettingsRelationshipEvidenceShadowCorpus();
  return <details className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-2">
    <summary className="cursor-pointer text-2xs text-primary">
      关系证据脱敏语料评估（只读、不保存）
    </summary>
    <p className="mt-2 text-3xs leading-4 text-muted-foreground">
      可同时选择多份结构化脱敏 JSON，仅在当前设置页内存中聚合；不会上传、保存、生成候选、写正式关系或影响聊天。
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
        onClick={downloadRelationshipEvidenceShadowCorpusTemplate}
        className="h-8 rounded-full px-3 text-2xs">
        <Download className="mr-1 h-3 w-3" />下载示例模板
      </Button>
      <label style={props.noDragRegionStyle}
        className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border bg-background px-3 text-2xs text-foreground">
        <FileJson className="mr-1 h-3 w-3" />选择 JSON
        <input type="file" accept="application/json,.json" multiple className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
            void loadFiles(files);
          }} />
      </label>
      {preview.fileName ? <span className="max-w-52 truncate text-3xs">{preview.fileName}</span> : null}
      {preview.status === 'reading' ? <span className="text-3xs">正在校验…</span> : null}
      {preview.status !== 'idle' ? <Button type="button" variant="ghost" size="sm"
        style={props.noDragRegionStyle} onClick={clear} className="h-7 rounded-full px-2 text-3xs">
        <X className="mr-1 h-3 w-3" />清除
      </Button> : null}
    </div>
    <ImportIssues preview={preview} />
    <ShadowReport preview={preview} />
    {preview.batchReport ? <SettingsRelationshipEvidenceShadowBatchReport
      batchReport={preview.batchReport}
      noDragRegionStyle={props.noDragRegionStyle}
    /> : null}
  </details>;
}
