import { useState } from 'react';
import type {
  NeuralPersonaLearningProposal,
  NeuralPersonaLearningReconciliationStatus,
} from '../../character-graph/neural-persona';

interface ProposalCardProps {
  applicationEnabled: boolean;
  busy: boolean;
  onApply: (confirmed: boolean) => void;
  onReverse: (confirmed: boolean) => void;
  onReview: (decision: 'accept' | 'reject', confirmed: boolean) => void;
  proposal: NeuralPersonaLearningProposal;
  reconciliationStatus?: NeuralPersonaLearningReconciliationStatus;
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`;
}

function ReviewActions(props: ProposalCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  if (props.proposal.status !== 'pending-review') return null;
  const confirmationRequired = props.proposal.protectedNode && !confirmed;
  return (
    <>
      {props.proposal.protectedNode ? (
        <label className="flex items-center gap-2 text-amber-500">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          确认接受受保护节点建议
        </label>
      ) : null}
      <div className="flex gap-2">
        <button type="button" disabled={props.busy || confirmationRequired} onClick={() => props.onReview('accept', confirmed)} className="rounded-sm bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">接受建议</button>
        <button type="button" disabled={props.busy} onClick={() => props.onReview('reject', false)} className="rounded-sm border border-border px-3 py-1 disabled:opacity-50">拒绝建议</button>
      </div>
    </>
  );
}

function ApplicationActions(props: ProposalCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const applicable = ['accepted', 'applying'].includes(props.proposal.status);
  if (!applicable || !props.applicationEnabled) return null;
  const confirmationRequired = props.proposal.protectedNode && !confirmed;
  return (
    <>
      <div className="text-3xs text-amber-500">
        应用会修改图谱中的三个节点数值，并产生新的图谱 revision。
      </div>
      {props.proposal.protectedNode ? (
        <label className="flex items-center gap-2 text-amber-500">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          再次确认应用到受保护节点
        </label>
      ) : null}
      <button type="button" disabled={props.busy || confirmationRequired} onClick={() => props.onApply(confirmed)} className="rounded-sm bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">
        {props.proposal.status === 'applying' ? '恢复应用' : '应用到图谱'}
      </button>
    </>
  );
}

function ReversalActions(props: ProposalCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  if (!props.applicationEnabled || !['applied', 'reversing'].includes(props.proposal.status)) {
    return null;
  }
  const safe = ['consistent-applied', 'reversal-ready-to-resume']
    .includes(props.reconciliationStatus ?? '');
  return (
    <>
      <label className="flex items-center gap-2 text-amber-500">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        确认仅在学习数值仍完全匹配时撤销本次应用
      </label>
      <button type="button" disabled={props.busy || !confirmed || !safe} onClick={() => props.onReverse(confirmed)} className="rounded-sm border border-amber-500 px-3 py-1 text-amber-500 disabled:opacity-50">
        {props.proposal.status === 'reversing' ? '恢复撤销' : '安全撤销应用'}
      </button>
    </>
  );
}

export function NeuralPersonaLearningProposalCard(props: ProposalCardProps) {
  const { proposal } = props;
  return (
    <article className="space-y-2 rounded-sm border border-border/70 p-3 text-3xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">节点 {proposal.nodeId}</span>
        <span className="text-primary">{proposal.status}</span>
      </div>
      <div className="text-muted-foreground">净信号 {proposal.signal.netScore.toFixed(3)} · 事件 {proposal.signal.eventCount} · 图谱 r{proposal.observedGraphRevision} · 账本 r{proposal.observedLedgerRevision}</div>
      <div>权重 {signed(proposal.deltas.baseWeight)} · 置信度 {signed(proposal.deltas.confidence)} · 稳定度 {signed(proposal.deltas.stability)}</div>
      <div className="text-muted-foreground">{proposal.reasonSummary}</div>
      {proposal.status === 'applied' ? (
        <div className="text-primary">已应用到图谱 revision {proposal.appliedGraphRevision}</div>
      ) : null}
      {props.reconciliationStatus ? (
        <div className="text-muted-foreground">对账状态：{props.reconciliationStatus}</div>
      ) : null}
      {proposal.status === 'reversed' ? (
        <div className="text-primary">已安全撤销，图谱 revision {proposal.reversedGraphRevision}</div>
      ) : null}
      <ReviewActions {...props} />
      <ApplicationActions {...props} />
      <ReversalActions {...props} />
    </article>
  );
}

export function NeuralPersonaLearningProposalList(props: {
  applicationEnabled: boolean;
  busy: boolean;
  onApply: (proposalId: string, confirmed: boolean) => void;
  onReverse: (proposalId: string, confirmed: boolean) => void;
  onReview: (
    proposalId: string,
    decision: 'accept' | 'reject',
    confirmed: boolean,
  ) => void;
  proposals: NeuralPersonaLearningProposal[];
  reconciliation: ReadonlyMap<string, NeuralPersonaLearningReconciliationStatus>;
}) {
  if (!props.proposals.length) return null;
  return (
    <div className="space-y-2">
      {props.proposals.map((proposal) => (
        <NeuralPersonaLearningProposalCard
          key={proposal.proposalId}
          applicationEnabled={props.applicationEnabled}
          busy={props.busy}
          proposal={proposal}
          reconciliationStatus={props.reconciliation.get(proposal.proposalId)}
          onApply={(confirmed) => props.onApply(proposal.proposalId, confirmed)}
          onReverse={(confirmed) => props.onReverse(proposal.proposalId, confirmed)}
          onReview={(decision, confirmed) => props.onReview(
            proposal.proposalId, decision, confirmed,
          )}
        />
      ))}
    </div>
  );
}
