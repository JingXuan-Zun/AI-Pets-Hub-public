import type { RelationshipEvidenceShadowReasonDriftComparison } from '../../social-trend';
import {
  RELATIONSHIP_EVIDENCE_REASON_DRIFT_LABELS,
  RELATIONSHIP_EVIDENCE_REASON_LABELS,
} from './relationshipEvidenceShadowUiLabels';

function signedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function MetricTable(props: {
  comparison: RelationshipEvidenceShadowReasonDriftComparison;
}) {
  return <table className="mt-1 w-full min-w-[40rem] border-collapse text-left">
    <thead><tr className="text-muted-foreground">
      <th className="p-1">原因</th><th className="p-1">精度变化</th>
      <th className="p-1">精度判断</th><th className="p-1">召回变化</th>
      <th className="p-1">召回判断</th>
    </tr></thead>
    <tbody>{props.comparison.metrics.map((item) => <tr key={item.reason}
      className="border-t border-border">
      <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_LABELS[item.reason]}</td>
      <td className="p-1 font-mono">{signedPercent(item.precision.delta)}</td>
      <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_DRIFT_LABELS[
        item.precision.movement
      ]}</td>
      <td className="p-1 font-mono">{signedPercent(item.recall.delta)}</td>
      <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_DRIFT_LABELS[
        item.recall.movement
      ]}</td>
    </tr>)}</tbody>
  </table>;
}

export function SettingsRelationshipEvidenceShadowReasonDriftReport(props: {
  comparisons: RelationshipEvidenceShadowReasonDriftComparison[];
}) {
  if (!props.comparisons.length) return null;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">查看原因级相邻批次稳定性</summary>
    <div className="mt-1 max-h-72 space-y-2 overflow-y-auto">
      {props.comparisons.map((item) => <div
        key={`${item.previousCorpusId}->${item.currentCorpusId}`}
        className="overflow-x-auto rounded-sm border border-border p-2">
        <div className="font-mono">{item.previousCorpusId} → {item.currentCorpusId}</div>
        <MetricTable comparison={item} />
      </div>)}
    </div>
    <p className="mt-1 text-muted-foreground">
      仅在前后批次分母均达到门槛时比较95%区间；区间不重叠仍不代表因果关系或生产阈值建议。
    </p>
  </details>;
}
