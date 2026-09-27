import { useEffect, useState } from 'react';
import type {
  NeuralPersonaNode,
  NeuralPersonaTagReviewCommandResult,
} from '../../character-graph/neural-persona';

function resultMessage(result: NeuralPersonaTagReviewCommandResult) {
  if (result.status === 'ok') return `已提交 revision ${result.record.revision}`;
  if (result.status === 'conflict') return `版本冲突，已刷新 revision ${result.actualRevision ?? 'unknown'}。`;
  return `操作失败：${result.reason}`;
}

export function NeuralPersonaTagReviewInbox(props: {
  nodes: NeuralPersonaNode[];
  onReview: (
    nodeId: string, tagId: string, decision: 'accept' | 'reject', confirmProtected: boolean,
  ) => Promise<NeuralPersonaTagReviewCommandResult>;
  onStage: (nodeId: string, confirmProtected: boolean) => Promise<NeuralPersonaTagReviewCommandResult>;
  roleId: string;
  selectedNodeId?: string;
}) {
  const [confirmProtected, setConfirmProtected] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => { setConfirmProtected(false); setFeedback(''); }, [props.roleId]);
  const selectedNode = props.nodes.find((node) => node.nodeId === props.selectedNodeId);
  const pending = props.nodes.flatMap((node) => node.tags.filter((tag) => (
    tag.source === 'system' && tag.status === 'pending-review'
  )).map((tag) => ({ node, tag })));
  const protectedAction = Boolean(selectedNode?.protected
    || pending.some((item) => item.node.protected));
  const stage = async () => {
    if (!selectedNode) return;
    setFeedback(resultMessage(await props.onStage(selectedNode.nodeId, confirmProtected)));
  };
  const review = async (nodeId: string, tagId: string, decision: 'accept' | 'reject') => {
    setFeedback(resultMessage(await props.onReview(
      nodeId, tagId, decision, confirmProtected,
    )));
  };
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold">标签建议审核</div><div className="text-3xs text-muted-foreground">当前仅使用本地确定性词表；建议必须审核后才会参与检索。</div></div><button type="button" disabled={!selectedNode || (Boolean(selectedNode?.protected) && !confirmProtected)} onClick={() => void stage()} className="rounded-sm border border-primary px-3 py-1 text-2xs text-primary disabled:opacity-50">为选中节点生成建议</button></div>
      {protectedAction ? <label className="flex items-center gap-2 text-2xs text-amber-500"><input type="checkbox" checked={confirmProtected} onChange={(event) => setConfirmProtected(event.target.checked)} />确认修改受保护身份节点的标签</label> : null}
      {!pending.length ? <div className="text-2xs text-muted-foreground">当前没有待审核标签。</div> : <div className="space-y-2">{pending.map(({ node, tag }) => { const blocked = node.protected && !confirmProtected; return <div key={`${node.nodeId}:${tag.canonicalId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border/70 p-2 text-2xs"><div><span className="font-medium">{tag.label}</span><span className="ml-2 text-muted-foreground">{node.influenceSummary}</span></div><div className="flex gap-2"><button type="button" disabled={blocked} onClick={() => void review(node.nodeId, tag.canonicalId, 'accept')} className="rounded-sm bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50">接受</button><button type="button" disabled={blocked} onClick={() => void review(node.nodeId, tag.canonicalId, 'reject')} className="rounded-sm border border-border px-2 py-1 disabled:opacity-50">拒绝</button></div></div>; })}</div>}
      {feedback ? <div className="text-3xs text-muted-foreground">{feedback}</div> : null}
    </section>
  );
}
