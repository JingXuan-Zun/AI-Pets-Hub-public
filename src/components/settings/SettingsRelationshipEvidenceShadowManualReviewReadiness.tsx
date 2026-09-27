import type { RelationshipEvidenceShadowBatchReport } from '../../social-trend';
import { RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_ISSUE_LABELS } from './relationshipEvidenceShadowUiLabels';

export function SettingsRelationshipEvidenceShadowManualReviewReadiness(props: {
  report: RelationshipEvidenceShadowBatchReport['manualReviewReadiness'];
}) {
  const { report } = props;
  return <div className={report.eligibleForManualReview
    ? 'rounded-sm border border-border p-2 text-muted-foreground'
    : 'rounded-sm border border-amber-500/40 p-2 text-amber-700'}>
    <div>
      {report.eligibleForManualReview
        ? '离线证据已达到人工校准审查入口条件'
        : '尚未达到人工校准审查入口条件'}
    </div>
    {report.issues.length ? <ul className="mt-1 list-disc pl-4">
      {report.issues.map((issue) => <li key={issue}>
        {RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_ISSUE_LABELS[issue]}
      </li>)}
    </ul> : null}
    <p className="mt-1 text-muted-foreground">
      该结论只允许进入人工查看，不代表生产可用，不生成、应用或保存阈值。
    </p>
  </div>;
}
