import type { DirectedRelationshipBehaviorTrace } from '../../character-relationship';

function policySummary(trace: DirectedRelationshipBehaviorTrace) {
  return trace.policies.map((policy) => (
    `${policy.targetRoleName} · ${policy.addressStyle} · ${policy.engagementStyle} · ${policy.sharingStyle}`
  ));
}

function matchReason(trace: DirectedRelationshipBehaviorTrace) {
  const matchedIds = new Set(trace.policies.map((policy) => policy.targetRoleId));
  return trace.addressedRoleIds.some((roleId) => matchedIds.has(roleId))
    ? '本轮直接回应或拉入的角色'
    : '本轮面向群体，按在场正式关系匹配';
}

export function SettingsDirectedRelationshipBehaviorTimeline(props: {
  traces: DirectedRelationshipBehaviorTrace[];
}) {
  return (
    <details className="rounded-sm border border-border bg-background/20 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">
        关系行为解释时间线（{props.traces.length}）
      </summary>
      <p className="mt-2 text-3xs leading-4 text-amber-500">
        这里只证明策略被提供给该轮角色，不证明角色实际遵循，也不会据此修改关系。
      </p>
      {props.traces.length ? (
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {props.traces.slice(-50).reverse().map((trace) => (
            <li key={trace.id} className="rounded-sm border border-border/70 px-3 py-2 text-3xs text-muted-foreground">
              <div className="flex flex-wrap justify-between gap-2 text-2xs text-foreground">
                <span>{trace.sourceRoleName || trace.sourceRoleId} · Topic {trace.topicId ?? '无'}</span>
                <span>{new Date(trace.occurredAt).toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
              <div className="mt-1">命中对象：{trace.policies.map((policy) => policy.targetRoleName).join('、')}</div>
              <div className="mt-1">命中原因：{matchReason(trace)}</div>
              <div className="mt-1">生效策略：{policySummary(trace).join('；')}</div>
              <div className="mt-1 text-primary">结论级别：仅提供上下文</div>
            </li>
          ))}
        </ul>
      ) : <div className="py-3 text-center text-2xs text-muted-foreground">暂无关系行为解释事件。</div>}
    </details>
  );
}
