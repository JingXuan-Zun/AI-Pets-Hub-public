import { useEffect, useRef, useState } from 'react';
import {
  createNeuralPersonaFeedbackInspection,
  type NeuralPersonaFeedbackCommandResult,
  type NeuralPersonaFeedbackKind,
  type NeuralPersonaNode,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaReinforcementLedgerRecord,
} from '../../character-graph/neural-persona';
import { useNeuralPersonaFeedbackPanelState } from './useNeuralPersonaFeedbackPanelState';

const KIND_LABELS: Record<NeuralPersonaFeedbackKind, string> = {
  correction: '修正', dismissal: '忽略/不采用', negative: '负向', positive: '正向',
};

function resultMessage(result: NeuralPersonaFeedbackCommandResult) {
  if (result.status === 'ok') return `已写入账本 revision ${result.record.revision}`;
  if (result.status === 'idempotent') return `事件已存在，账本保持 revision ${result.record.revision}`;
  if (result.status === 'conflict') {
    return `${result.conflictScope === 'graph' ? '图谱' : '账本'}版本冲突，已刷新。`;
  }
  return `写入失败：${result.reason}`;
}

function FeedbackForm(props: {
  disabled: boolean;
  node: NeuralPersonaNode | null;
  onSubmit: (kind: NeuralPersonaFeedbackKind, magnitude: number, summary: string) => void;
}) {
  const [kind, setKind] = useState<NeuralPersonaFeedbackKind>('positive');
  const [magnitude, setMagnitude] = useState(0.5);
  const [summary, setSummary] = useState('');
  useEffect(() => { setSummary(''); }, [props.node?.nodeId]);
  const submit = () => {
    props.onSubmit(kind, magnitude, summary.trim());
  };
  return (
    <div className="space-y-2 rounded-sm border border-border/70 p-3">
      <div className="text-2xs text-muted-foreground">{props.node ? `目标：${props.node.influenceSummary}` : '先在图谱中选择一个节点。'}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={kind} onChange={(event) => setKind(event.target.value as NeuralPersonaFeedbackKind)} className="h-8 rounded-sm border border-border bg-secondary px-2 text-2xs">{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={magnitude} onChange={(event) => setMagnitude(Number(event.target.value))} className="h-8 rounded-sm border border-border bg-secondary px-2 text-2xs"><option value={0.25}>轻微 0.25</option><option value={0.5}>中等 0.50</option><option value={0.75}>明显 0.75</option><option value={1}>强烈 1.00</option></select>
      </div>
      <textarea value={summary} maxLength={240} onChange={(event) => setSummary(event.target.value)} placeholder="填写明确证据，例如：用户明确表示更喜欢这种回答方式。" className="min-h-16 w-full rounded-sm border border-border bg-secondary p-2 text-2xs" />
      <button type="button" disabled={props.disabled || !summary.trim()} onClick={submit} className="rounded-sm bg-primary px-3 py-1.5 text-2xs text-primary-foreground disabled:opacity-50">记录显式反馈</button>
    </div>
  );
}

function ProjectionList(props: {
  graphRecord: NeuralPersonaPersistedRecord;
  ledger: NeuralPersonaReinforcementLedgerRecord;
}) {
  const inspection = createNeuralPersonaFeedbackInspection(
    props.graphRecord.graph, props.ledger, Date.now(),
  );
  if (!inspection.nodes.length) {
    return <div className="text-2xs text-muted-foreground">账本中还没有反馈事件。</div>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">{inspection.nodes.map((item) => <div key={item.nodeId} className="rounded-sm border border-border/70 p-2 text-3xs"><div className="font-medium">{item.influenceSummary ?? item.nodeId}</div><div className="mt-1 text-muted-foreground">状态 {item.nodeStatus} · 事件 {item.projection.eventCount} · 正向 {item.projection.positiveScore.toFixed(3)} · 抑制 {item.projection.negativeScore.toFixed(3)} · 净值 {item.projection.netScore.toFixed(3)}</div></div>)}</div>
  );
}

function EventHistory(props: { ledger: NeuralPersonaReinforcementLedgerRecord }) {
  const events = [...props.ledger.events].reverse().slice(0, 20);
  if (!events.length) return null;
  return (
    <details className="rounded-sm border border-border/70 p-2 text-3xs"><summary className="cursor-pointer text-2xs">最近事件（最多显示 20 条）</summary><div className="mt-2 space-y-2">{events.map((event) => <div key={event.eventId} className="border-t border-border/50 pt-2"><div>{KIND_LABELS[event.kind]} · 强度 {event.magnitude.toFixed(2)} · 节点 {event.nodeId}</div><div className="text-muted-foreground">{event.evidence.summary}</div><div className="text-muted-foreground">证据 {event.evidence.sourceType} · 图谱 revision {event.observedGraphRevision ?? '未记录'}</div></div>)}</div></details>
  );
}

export function NeuralPersonaFeedbackPanel(props: {
  enabled: boolean;
  graphRecord: NeuralPersonaPersistedRecord;
  selectedNodeId?: string;
}) {
  const controller = useNeuralPersonaFeedbackPanelState(props.enabled, props.graphRecord);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const activeRoleId = useRef(props.graphRecord.roleId);
  activeRoleId.current = props.graphRecord.roleId;
  const node = props.graphRecord.graph.nodes.find(
    (item) => item.nodeId === props.selectedNodeId,
  ) ?? null;
  useEffect(() => { setFeedback(''); setSubmitting(false); }, [props.graphRecord.roleId]);
  if (!props.enabled || controller.state.status === 'disabled') return null;
  const submit = async (
    kind: NeuralPersonaFeedbackKind, magnitude: number, summary: string,
  ) => {
    if (!node) return;
    const roleId = props.graphRecord.roleId;
    setSubmitting(true);
    try {
      const result = await controller.recordFeedback({
        kind, magnitude, nodeId: node.nodeId, summary,
      });
      if (activeRoleId.current === roleId) setFeedback(resultMessage(result));
    } finally {
      if (activeRoleId.current === roleId) setSubmitting(false);
    }
  };
  const blocked = !node || node.status !== 'active'
    || (node.expiresAt !== undefined && node.expiresAt <= Date.now());
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div><div className="text-xs font-semibold">显式反馈与强化账本</div><div className="text-3xs text-muted-foreground">只记录经过证据说明的反馈并生成只读投影；不会自动修改图谱。</div></div>
      <FeedbackForm disabled={submitting || blocked || controller.state.status === 'loading' || controller.state.status === 'error'} node={node} onSubmit={(kind, magnitude, summary) => void submit(kind, magnitude, summary)} />
      {controller.state.status === 'loading' ? <div className="text-2xs text-muted-foreground">正在读取反馈账本…</div> : null}
      {controller.state.status === 'missing' ? <div className="text-2xs text-muted-foreground">尚未创建账本；首次有效提交时自动创建。</div> : null}
      {controller.state.status === 'error' ? <div className="text-2xs text-destructive">账本读取失败：{controller.state.message}</div> : null}
      {controller.state.status === 'ready' ? <><ProjectionList graphRecord={props.graphRecord} ledger={controller.state.record} /><EventHistory ledger={controller.state.record} /></> : null}
      {feedback ? <div className="text-3xs text-muted-foreground">{feedback}</div> : null}
    </section>
  );
}
