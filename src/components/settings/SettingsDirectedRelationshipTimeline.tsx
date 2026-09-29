import type { DirectedRelationshipAuditEntry, DirectedRelationshipOperationKind } from '../../character-relationship';

const LABELS: Record<DirectedRelationshipOperationKind, string> = {
  invalidate: '标记失效', 'remove-role': '角色删除清理', restore: '恢复', rollback: '回滚', upsert: '保存/修改',
};

function scores(entry: DirectedRelationshipAuditEntry) {
  const dimensions = entry.after?.dimensions ?? entry.before?.dimensions;
  return dimensions ? `信任 ${dimensions.trust} / 亲密 ${dimensions.intimacy} / 警惕 ${dimensions.vigilance}` : '';
}

export function SettingsDirectedRelationshipTimeline(props: { entries: DirectedRelationshipAuditEntry[] }) {
  return (
    <details className="rounded-sm border border-border bg-background/20 px-3 py-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">关系审计时间线（{props.entries.length}）</summary>
      {props.entries.length ? (
        <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">
          {props.entries.slice(-20).reverse().map((entry) => (
            <li key={entry.id} className="rounded-sm border border-border/70 px-3 py-2 text-3xs text-muted-foreground">
              <div className="flex justify-between gap-2 text-2xs text-foreground">
                <span>{LABELS[entry.kind]} · {entry.relationshipId}</span>
                <span>{new Date(entry.recordedAt).toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
              <div className="mt-1">{scores(entry)} · {entry.reason} · {entry.source}</div>
              {entry.revertsAuditId ? <div className="mt-1 text-primary">回滚目标：{entry.revertsAuditId}</div> : null}
            </li>
          ))}
        </ul>
      ) : <div className="py-3 text-center text-2xs text-muted-foreground">暂无审计记录。</div>}
    </details>
  );
}
