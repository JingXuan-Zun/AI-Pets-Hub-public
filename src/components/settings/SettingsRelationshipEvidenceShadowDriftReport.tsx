import type { RelationshipEvidenceShadowDriftComparison } from '../../social-trend';
import { RELATIONSHIP_EVIDENCE_DRIFT_LABELS } from './relationshipEvidenceShadowUiLabels';

function signedPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function SettingsRelationshipEvidenceShadowDriftReport(props: {
  comparisons: RelationshipEvidenceShadowDriftComparison[];
}) {
  if (!props.comparisons.length) return null;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">查看相邻批次漂移</summary>
    <ul className="mt-1 max-h-40 space-y-2 overflow-y-auto">
      {props.comparisons.map((item) => <li
        key={`${item.previousCorpusId}->${item.currentCorpusId}`}
        className="rounded-sm border border-border p-2">
        <div className="flex flex-wrap justify-between gap-1">
          <span className="font-mono">{item.previousCorpusId} → {item.currentCorpusId}</span>
          <span>{RELATIONSHIP_EVIDENCE_DRIFT_LABELS[item.movement]}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-4">
          <span>持续误判 {signedPercent(item.deltas.sustainedFalsePositiveRate)}</span>
          <span>持续召回 {signedPercent(item.deltas.sustainedRecall)}</span>
          <span>矛盾漏检 {signedPercent(item.deltas.volatileMissRate)}</span>
          <span>证据不足误判 {signedPercent(item.deltas.insufficientMisclassificationRate)}</span>
        </div>
      </li>)}
    </ul>
    <p className="mt-1 text-muted-foreground">
      漂移仅是相邻批次的描述性差值，不代表统计显著性、因果关系或生产阈值建议。
    </p>
  </details>;
}
