import {
  buildDirectedRelationshipShadowReport,
  type DirectedRelationshipRepositoryData,
} from '../../character-relationship';

export function SettingsDirectedRelationshipShadowReport(props: {
  repository: DirectedRelationshipRepositoryData;
}) {
  const report = buildDirectedRelationshipShadowReport(props.repository);
  const metrics = [
    ['样本', report.sampleCount], ['人工审核', report.manualReviewCount], ['阻断', report.blockedCount],
    ['待处理', report.pendingCount], ['已批准', report.approvedCount], ['已拒绝', report.rejectedCount],
  ];
  return (
    <div className="space-y-2 rounded-sm border border-border bg-secondary/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-2xs font-semibold text-foreground">Shadow 筛选报告</h4>
        <span className="text-2xs text-amber-500">自动正式写入：关闭</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-sm bg-background/40 px-2 py-1 text-center">
            <div className="font-mono text-xs text-foreground">{value}</div>
            <div className="text-3xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-2xs leading-4 text-muted-foreground">Shadow 只记录规则判断，不会绕过用户审批修改正式关系。</p>
    </div>
  );
}
