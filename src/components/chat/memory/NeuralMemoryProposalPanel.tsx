import { useState } from 'react';
import { Brain } from 'lucide-react';
import {
  NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH,
  NEURAL_MEMORY_PROPOSAL_TYPE_LABELS,
  type NeuralMemoryProposal,
} from '../../../neural-memory/neuralMemoryProposalTypes';

const ACTION_CLASS = 'h-6 rounded-full border px-2 text-[10px] transition-colors disabled:cursor-wait disabled:opacity-50';

function NeuralMemoryProposalCard({
  busy,
  onApprove,
  onDismiss,
  proposal,
}: {
  busy: boolean;
  onApprove: (content: string) => void;
  onDismiss: () => void;
  proposal: NeuralMemoryProposal;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.content);
  const content = editing ? draft.trim() : proposal.content;
  return (
    <article data-neural-memory-proposal={proposal.id} className="space-y-1.5 rounded-xl border border-white/80 bg-white/70 p-2 text-[10px] leading-4 text-sky-950">
      <span className="inline-flex rounded-full bg-primary/10 px-1.5 text-[9px] text-primary">
        {NEURAL_MEMORY_PROPOSAL_TYPE_LABELS[proposal.type]}
      </span>
      {editing ? (
        <textarea
          value={draft}
          maxLength={NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-16 w-full resize-y rounded-md border border-sky-100 bg-white p-1.5 text-[10px] leading-4 outline-none focus:border-primary"
        />
      ) : <p>{proposal.content}</p>}
      {proposal.sourceExcerpt ? (
        <p className="line-clamp-2 text-[9px] text-sky-700/70" title={proposal.sourceExcerpt}>来自：{proposal.sourceExcerpt}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={busy || !content} onClick={() => onApprove(content)} className={`${ACTION_CLASS} border-primary bg-primary text-white hover:bg-primary/90`}>
          {busy ? '记录中…' : '记住'}
        </button>
        <button type="button" disabled={busy} onClick={() => { setDraft(proposal.content); setEditing(!editing); }} className={`${ACTION_CLASS} border-sky-100 bg-white text-sky-800 hover:bg-sky-50`}>
          {editing ? '取消修改' : '修改'}
        </button>
        <button type="button" disabled={busy} onClick={onDismiss} className={`${ACTION_CLASS} border-transparent text-sky-700/70 hover:text-sky-950`}>
          不用记
        </button>
      </div>
    </article>
  );
}

export function NeuralMemoryProposalPanel({
  busyProposalId,
  message,
  onApprove,
  onDismiss,
  proposals,
}: {
  busyProposalId: string | null;
  message: string;
  onApprove: (proposal: NeuralMemoryProposal, content: string) => void;
  onDismiss: (proposal: NeuralMemoryProposal) => void;
  proposals: NeuralMemoryProposal[];
}) {
  if (!proposals.length && !message) return null;
  return (
    <section data-neural-memory-proposals className="flex min-h-0 flex-col gap-2 border-t border-white/70 pt-3">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] text-sky-950">
        <Brain className="h-3 w-3 text-primary" />
        记忆提议
        {proposals.length ? <span className="font-normal text-sky-700/70">{proposals.length}</span> : null}
      </div>
      {message ? <p role="status" className="px-1 text-[9px] leading-4 text-sky-700">{message}</p> : null}
      <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {proposals.map((proposal) => (
          <NeuralMemoryProposalCard
            key={proposal.id}
            busy={busyProposalId === proposal.id}
            proposal={proposal}
            onApprove={(content) => onApprove(proposal, content)}
            onDismiss={() => onDismiss(proposal)}
          />
        ))}
      </div>
    </section>
  );
}
