import type {
  RelationshipEvidenceWindowScopeReason,
  ScopedRelationshipEvidenceWindow,
  RelationshipEvidenceWindowReason,
} from '../../social-trend';

const SCOPE_REASON_LABELS: Record<RelationshipEvidenceWindowScopeReason, string> = {
  'ambiguous-formal-memory-link': '多个正式记忆组，未自动归类',
  'formal-memory-link': '已关联正式群体记忆',
  'no-formal-memory-link': '未关联正式群体记忆',
};

const REASON_LABELS: Record<RelationshipEvidenceWindowReason, string> = {
  'contradictory-signals': '方向信号互相矛盾',
  'high-rejection-rate': '用户拒绝比例偏高',
  'high-rollback-rate': '审核回滚比例偏高',
  'insufficient-distinct-messages': '不同来源消息不足3条',
  'insufficient-signals': '有效信号不足3条',
  'short-duration': '观察跨度不足24小时',
  'sustained-pattern': '达到持续模式 Shadow 条件',
  'unresolved-target': '目标角色尚未解析',
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ScopeProvenance(props: {
  memoryGroupNames: Record<string, string>;
  snapshots: ScopedRelationshipEvidenceWindow['scopeProvenance'];
}) {
  if (!props.snapshots.length) return null;
  return <details className="mt-2 rounded-sm border border-border/70 px-2 py-1">
    <summary className="cursor-pointer text-muted-foreground">
      范围来源快照（{props.snapshots.length}）
    </summary>
    {props.snapshots.map((snapshot) => <div className="mt-1 break-all text-muted-foreground"
      key={`${snapshot.sourceMessageId}:${snapshot.recordId}:${snapshot.originalGroupId}:${snapshot.source}:${snapshot.capturedAt}`}>
      原始范围：{props.memoryGroupNames[snapshot.originalGroupId] || snapshot.originalGroupId}；
      {snapshot.latestCorrectionId && <>
        纠正后历史范围：{props.memoryGroupNames[snapshot.effectiveGroupId] || snapshot.effectiveGroupId}；
        有效记录：{snapshot.effectiveRecordId}；纠正：{snapshot.latestCorrectionId}；
      </>}
      来源：{snapshot.source === 'candidate-approval' ? '候选批准' : '手动保存'}；
      消息：{snapshot.sourceMessageId}
    </div>)}
  </details>;
}

export function SettingsRelationshipEvidenceWindowCard(props: {
  memoryGroupNames: Record<string, string>;
  roleNames: Record<string, string>;
  window: ScopedRelationshipEvidenceWindow;
}) {
  const { window } = props;
  const sourceName = props.roleNames[window.sourceRoleId] || window.sourceRoleName || window.sourceRoleId;
  const targetName = props.roleNames[window.targetRoleId] || window.targetRoleName || window.targetRoleId;
  const days = (window.durationMs / (24 * 60 * 60 * 1000)).toFixed(1);
  return (
    <article className="rounded-sm border border-border bg-background/30 p-3 text-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{sourceName} → {targetName}</span>
        <span className="font-mono text-primary">{window.readiness}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        记忆范围：{window.memoryGroupId
          ? (props.memoryGroupNames[window.memoryGroupId] || window.memoryGroupId)
          : SCOPE_REASON_LABELS[window.scopeReason]}
      </div>
      <ScopeProvenance memoryGroupNames={props.memoryGroupNames}
        snapshots={window.scopeProvenance} />
      <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-4">
        <span>有效信号：{window.eligibleSignalCount}</span><span>不同消息：{window.distinctSourceMessageCount}</span>
        <span>跨度：{days}天</span><span>规则阻断：{window.blockedCount}</span>
        <span>批准：{window.approvalCount}</span><span>拒绝率：{percent(window.rejectionRate)}</span>
        <span>回滚率：{percent(window.rollbackRate)}</span>
        <span>关系级纠正审计：{window.correctionAuditCount}（未按记忆组归属）</span>
      </div>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <div>信任净变化 {window.dimensions.trust.netDelta}，方向一致性 {percent(window.dimensions.trust.consistency)}</div>
        <div>亲密净变化 {window.dimensions.intimacy.netDelta}，方向一致性 {percent(window.dimensions.intimacy.consistency)}</div>
        <div>警惕净变化 {window.dimensions.vigilance.netDelta}，方向一致性 {percent(window.dimensions.vigilance.consistency)}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {window.reasons.map((reason) => <span key={reason}
          className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          {REASON_LABELS[reason]}
        </span>)}
      </div>
      {window.retainedHistoryMayBeTruncated && <div className="mt-2 text-amber-600">
        仓储已达到详细记录保留上限，本窗口可能只包含最近保留的部分样本。
      </div>}
    </article>
  );
}
