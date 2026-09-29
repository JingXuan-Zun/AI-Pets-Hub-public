import type { SocialEventEvidenceKind, SocialEventEvidenceReference } from '../../social-timeline';

const EVIDENCE_LABELS: Record<SocialEventEvidenceKind, string> = {
  'candidate-reference': '候选记录',
  'chat-message': '来源消息（不等于事实）',
  'evidence-scope-snapshot': '证据范围快照（只读）',
  'record-snapshot': '正式记录快照',
  'relationship-policy': '关系策略快照（仅提供）',
  'task-result': '已完成任务结果（来自 factualSummary）',
  'transition-reason': '状态迁移原因',
};

export function SettingsSocialEventEvidence(props: {
  evidence: SocialEventEvidenceReference[];
}) {
  if (!props.evidence.length) return null;
  return (
    <details className="mt-2 rounded-sm border border-border/70 bg-secondary/20 px-2 py-1.5">
      <summary className="cursor-pointer text-2xs text-primary">
        查看证据详情（{props.evidence.length}）
      </summary>
      <div className="mt-2 space-y-2">
        {props.evidence.map((item, index) => (
          <div key={`${item.kind}:${item.referenceId ?? 'none'}:${index}`}
            className="border-l border-border pl-2 text-2xs leading-4 text-muted-foreground">
            <div className="font-medium text-foreground">{EVIDENCE_LABELS[item.kind]}</div>
            {item.referenceId && <div className="break-all font-mono">ID：{item.referenceId}</div>}
            {item.excerpt && <div className="break-words">{item.excerpt}</div>}
          </div>
        ))}
      </div>
    </details>
  );
}
