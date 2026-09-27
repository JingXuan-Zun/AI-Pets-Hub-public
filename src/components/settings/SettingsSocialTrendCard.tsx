import type { DirectedRelationshipSocialTrend } from '../../social-trend';

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function SettingsSocialTrendCard(props: {
  memoryGroupNames: Record<string, string>;
  roleNames: Record<string, string>;
  trend: DirectedRelationshipSocialTrend;
}) {
  const { trend } = props;
  const sourceName = props.roleNames[trend.sourceRoleId] || trend.sourceRoleId;
  const targetName = props.roleNames[trend.targetRoleId] || trend.targetRoleName;
  return (
    <article className="rounded-sm border border-border bg-background/30 p-3 text-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{sourceName} → {targetName}</span>
        <span className={trend.active ? 'text-emerald-500' : 'text-muted-foreground'}>
          {trend.active ? '有效关系' : '已失效关系'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>信任：{trend.currentDimensions.trust} <span className="text-primary">({signed(trend.delta.trust)})</span></div>
        <div>亲密：{trend.currentDimensions.intimacy} <span className="text-primary">({signed(trend.delta.intimacy)})</span></div>
        <div>警惕：{trend.currentDimensions.vigilance} <span className="text-primary">({signed(trend.delta.vigilance)})</span></div>
      </div>
      <div className="mt-2 leading-4 text-muted-foreground">
        最早保留快照：{new Date(trend.windowStartAt).toLocaleString()}；正式审计 {trend.formalAuditCount}；
        批准 {trend.approvedReviewCount}；操作回滚 {trend.operationRollbackCount}；审核回滚 {trend.reviewRollbackCount}；
        策略提供 {trend.policySuppliedCount}。
      </div>
      {trend.sharedTopicCount > 0 && <div className="mt-1 break-words text-muted-foreground">
        与正式群体记忆同 Topic：{trend.sharedTopicIds.join('、')}（仅表示共现，不表示关系变化原因）
      </div>}
      {trend.sharedMemoryGroups.map((group) => (
        <div className="mt-1 break-words text-muted-foreground" key={group.memoryGroupId}>
          记忆组 {props.memoryGroupNames[group.memoryGroupId] || group.memoryGroupId}：
          {group.sharedTopicIds.join('、')}
        </div>
      ))}
      {trend.historyTruncated && <div className="mt-1 text-amber-600">
        创建审计已不在保留窗口中，变化量仅以最早保留快照为基线。
      </div>}
    </article>
  );
}
