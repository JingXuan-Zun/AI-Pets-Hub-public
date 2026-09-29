import type {
  RelationshipEvidenceShadowBatchReport,
  RelationshipEvidenceShadowRateMetric,
} from '../../social-trend';

const METRIC_LABELS: Record<RelationshipEvidenceShadowRateMetric, string> = {
  'insufficient-misclassification': '证据不足误判',
  'sustained-false-positive': '持续模式误判',
  'sustained-recall': '持续模式召回',
  'volatile-miss': '矛盾漏检',
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function SettingsRelationshipEvidenceShadowConfidenceReport(props: {
  confidenceReport: RelationshipEvidenceShadowBatchReport['confidenceReport'];
}) {
  const report = props.confidenceReport;
  return <details>
    <summary className="cursor-pointer text-muted-foreground">查看95%置信区间与分母</summary>
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <thead><tr className="text-muted-foreground">
          <th className="p-1">指标</th><th className="p-1">观察值</th>
          <th className="p-1">分母</th><th className="p-1">95%区间</th>
        </tr></thead>
        <tbody>{report.intervals.map((item) => <tr key={item.metric}
          className="border-t border-border">
          <td className="p-1">{METRIC_LABELS[item.metric]}</td>
          <td className="p-1 font-mono">{percent(item.observedRate)}</td>
          <td className={item.denominatorSufficient ? 'p-1 font-mono' : 'p-1 font-mono text-amber-600'}>
            {item.denominator}/{report.minimumDenominator}
          </td>
          <td className="p-1 font-mono">{percent(item.lowerBound)}–{percent(item.upperBound)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {report.insufficientDenominatorMetrics.length ? <p className="mt-1 text-amber-600">
      分母不足的指标只展示观察值，不用于判断批次风险升降。
    </p> : null}
  </details>;
}
