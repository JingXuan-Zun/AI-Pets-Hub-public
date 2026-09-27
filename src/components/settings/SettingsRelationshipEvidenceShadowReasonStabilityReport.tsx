import type { RelationshipEvidenceShadowBatchReport } from '../../social-trend';
import {
  RELATIONSHIP_EVIDENCE_REASON_LABELS,
  RELATIONSHIP_EVIDENCE_REASON_STABILITY_LABELS,
} from './relationshipEvidenceShadowUiLabels';

export function SettingsRelationshipEvidenceShadowReasonStabilityReport(props: {
  report: RelationshipEvidenceShadowBatchReport['reasonStabilityReport'];
}) {
  const { report } = props;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">
      查看原因级多批次稳定性
    </summary>
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <thead><tr className="text-muted-foreground">
          <th className="p-1">原因</th><th className="p-1">精度连续批次</th>
          <th className="p-1">精度状态</th><th className="p-1">召回连续批次</th>
          <th className="p-1">召回状态</th>
        </tr></thead>
        <tbody>{report.metrics.map((item) => <tr key={item.reason}
          className="border-t border-border">
          <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_LABELS[item.reason]}</td>
          <td className="p-1 font-mono">{item.precision.comparableBatchCount}</td>
          <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_STABILITY_LABELS[
            item.precision.status
          ]}</td>
          <td className="p-1 font-mono">{item.recall.comparableBatchCount}</td>
          <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_STABILITY_LABELS[
            item.recall.status
          ]}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className={report.status === 'reason-stability-ready'
      ? 'mt-1 text-muted-foreground' : 'mt-1 text-amber-600'}>
      {report.status === 'reason-stability-ready'
        ? `八类原因均具备至少 ${report.minimumComparableBatches} 个连续可比较批次。`
        : `部分原因尚不足 ${report.minimumComparableBatches} 个连续可比较批次。`}
    </p>
  </details>;
}
