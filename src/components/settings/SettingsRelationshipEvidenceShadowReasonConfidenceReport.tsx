import type { RelationshipEvidenceShadowBatchReport } from '../../social-trend';
import { RELATIONSHIP_EVIDENCE_REASON_LABELS } from './relationshipEvidenceShadowUiLabels';

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function interval(lowerBound: number, upperBound: number) {
  return `${percent(lowerBound)}–${percent(upperBound)}`;
}

export function SettingsRelationshipEvidenceShadowReasonConfidenceReport(props: {
  report: RelationshipEvidenceShadowBatchReport['reasonConfidenceReport'];
}) {
  const { report } = props;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">
      查看原因级95%置信区间
    </summary>
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <thead><tr className="text-muted-foreground">
          <th className="p-1">原因</th><th className="p-1">精度分子/分母</th>
          <th className="p-1">精度区间</th><th className="p-1">召回分子/分母</th>
          <th className="p-1">召回区间</th>
        </tr></thead>
        <tbody>{report.metrics.map((item) => <tr key={item.reason}
          className="border-t border-border">
          <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_LABELS[item.reason]}</td>
          <td className={item.precision.denominatorSufficient ? 'p-1 font-mono'
            : 'p-1 font-mono text-amber-600'}>
            {item.precision.numerator}/{item.precision.denominator}
          </td>
          <td className="p-1 font-mono">{interval(
            item.precision.lowerBound, item.precision.upperBound,
          )}</td>
          <td className={item.recall.denominatorSufficient ? 'p-1 font-mono'
            : 'p-1 font-mono text-amber-600'}>
            {item.recall.numerator}/{item.recall.denominator}
          </td>
          <td className="p-1 font-mono">{interval(
            item.recall.lowerBound, item.recall.upperBound,
          )}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {report.status === 'insufficient-reason-denominators' ? <p
      className="mt-1 text-amber-600">
      部分原因的精度或召回分母不足 {report.minimumDenominator}，仅作描述性观察。
    </p> : <p className="mt-1 text-muted-foreground">
      八类原因的精度与召回分母均达到 {report.minimumDenominator}。
    </p>}
  </details>;
}
