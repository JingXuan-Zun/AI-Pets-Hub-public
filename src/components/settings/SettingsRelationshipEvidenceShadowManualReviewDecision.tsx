import { Download, Upload } from 'lucide-react';
import type { ChangeEvent, CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import {
  createRelationshipEvidenceShadowManualReviewEvidenceReference,
  parseRelationshipEvidenceShadowManualReviewDecisionJson,
  type RelationshipEvidenceShadowBatchReport,
} from '../../social-trend';
import { downloadRelationshipEvidenceShadowManualReviewDecisionTemplate } from './relationshipEvidenceShadowManualReviewDecisionTemplateDownload';
import { RELATIONSHIP_EVIDENCE_REVIEW_DECISION_ISSUE_LABELS } from './relationshipEvidenceShadowUiLabels';
import { SettingsRelationshipEvidenceShadowManualReviewReceiptButton } from './SettingsRelationshipEvidenceShadowManualReviewReceiptButton';

const DECISION_LABELS = {
  'accept-for-further-manual-work': '接受并进入后续人工工作',
  'needs-more-evidence': '需要更多证据',
  'reject-for-now': '暂时拒绝',
} as const;

type DecisionResult = ReturnType<
  typeof parseRelationshipEvidenceShadowManualReviewDecisionJson
> | null;

function ValidationResult(props: { result: DecisionResult }) {
  const { result } = props;
  if (result?.decision) return <p className="mt-1 text-muted-foreground">
    校验通过：{DECISION_LABELS[result.decision.decision]}。结果未保存，也不会应用阈值。
  </p>;
  if (!result?.issues.length) return null;
  return <ul className="mt-1 list-disc pl-4 text-amber-600">
    {result.issues.map((issue, index) => <li key={`${issue.path}-${index}`}>
      {RELATIONSHIP_EVIDENCE_REVIEW_DECISION_ISSUE_LABELS[issue.code]}（{issue.path}）
    </li>)}
  </ul>;
}

export function SettingsRelationshipEvidenceShadowManualReviewDecision(props: {
  batchReport: RelationshipEvidenceShadowBatchReport;
  noDragRegionStyle?: CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<DecisionResult>(null);
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const reference = createRelationshipEvidenceShadowManualReviewEvidenceReference(
      props.batchReport,
    );
    try {
      setResult(parseRelationshipEvidenceShadowManualReviewDecisionJson(
        await file.text(), reference,
      ));
    } finally {
      input.value = '';
    }
  };
  return <div className="rounded-sm border border-border p-2">
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
        onClick={() => downloadRelationshipEvidenceShadowManualReviewDecisionTemplate(
          props.batchReport,
        )} className="h-7 rounded-full px-2 text-3xs">
        <Download className="mr-1 h-3 w-3" />下载决定模板
      </Button>
      <Button type="button" variant="outline" size="sm" style={props.noDragRegionStyle}
        onClick={() => inputRef.current?.click()} className="h-7 rounded-full px-2 text-3xs">
        <Upload className="mr-1 h-3 w-3" />只读校验决定文件
      </Button>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden
        onChange={handleFile} />
    </div>
    <ValidationResult result={result} />
    {result?.decision ? <SettingsRelationshipEvidenceShadowManualReviewReceiptButton
      decision={result.decision} noDragRegionStyle={props.noDragRegionStyle}
    /> : null}
    <p className="mt-1 text-muted-foreground">
      模板需在外部填写理由、审查时间并确认已审查证据；导入只校验，不保存或执行决定。
    </p>
  </div>;
}
