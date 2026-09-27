import type {
  RelationshipEvidenceShadowReasonReport,
} from '../../social-trend';
import { RELATIONSHIP_EVIDENCE_REASON_LABELS } from './relationshipEvidenceShadowUiLabels';

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function SettingsRelationshipEvidenceShadowReasonReport(props: {
  report: RelationshipEvidenceShadowReasonReport;
}) {
  const { report } = props;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">
      查看原因级覆盖（{percent(report.reasonCoverageRate)}）
    </summary>
    <div className="mt-1 text-muted-foreground">
      已标注 {report.labeledSampleCount}，原因集合完全匹配 {report.exactMatchCount}，
      旧版未标注 {report.unlabeledLegacySampleCount}
    </div>
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <thead><tr className="text-muted-foreground">
          <th className="p-1">原因</th><th className="p-1">预期/实际</th>
          <th className="p-1">精度</th><th className="p-1">召回</th>
        </tr></thead>
        <tbody>{report.metrics.map((item) => <tr key={item.reason}
          className="border-t border-border">
          <td className="p-1">{RELATIONSHIP_EVIDENCE_REASON_LABELS[item.reason]}</td>
          <td className="p-1 font-mono">{item.expectedCount}/{item.actualCount}</td>
          <td className="p-1 font-mono">{percent(item.precision)}</td>
          <td className="p-1 font-mono">{percent(item.recall)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {report.missingExpectedReasons.length ? <p className="mt-1 text-amber-600">
      尚未覆盖：{report.missingExpectedReasons.map(
        (reason) => RELATIONSHIP_EVIDENCE_REASON_LABELS[reason],
      ).join('、')}
    </p> : null}
    {report.mismatches.length ? <details className="mt-1">
      <summary className="cursor-pointer text-muted-foreground">查看原因不匹配样本</summary>
      <ul className="max-h-24 overflow-y-auto font-mono">
        {report.mismatches.slice(0, 10).map((item) => <li key={item.sampleId}>
          {item.sampleId} · [{item.expectedReasons.join(',')}] → [{item.actualReasons.join(',')}]
        </li>)}
      </ul>
    </details> : null}
  </details>;
}
