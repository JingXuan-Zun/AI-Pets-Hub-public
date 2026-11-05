import { Mic } from 'lucide-react';
import type { ChatAgentApprovalDecision } from '../../types';

// Bubbles above the character that are not chat lines: a task waiting for the user's yes/no
// (answerable right there, without opening the chat window), and the microphone hearing the
// user in a voice conversation, so they can tell their voice got through.

export interface PendingApprovalBubble {
  detail: string;
  id: string;
  /** Sending, deleting, paying…: only yes/no, asked every time. */
  irreversible?: boolean;
  title: string;
}

const CARD_CLASS = 'border border-white/80 bg-white/90 px-3 py-2 shadow-[0_8px_24px_rgba(158,84,140,0.24)] backdrop-blur-sm';

function Tail() {
  return <div className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/80 bg-white/90" />;
}

export function ApprovalBubbleCard({ approval, onResolve, textColor }: {
  approval: PendingApprovalBubble;
  onResolve: (approvalId: string, decision: ChatAgentApprovalDecision) => void;
  textColor: string;
}) {
  const button = 'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors';
  return (
    <div className="relative">
      <div className={`rounded-2xl ${CARD_CLASS}`} style={{ color: textColor }}>
        <div className="text-2xs font-bold opacity-70">{approval.irreversible ? '需要你同意（做了撤不回）' : '需要你同意'}</div>
        <div className="mt-0.5 font-semibold">{approval.title}</div>
        {approval.detail ? <div className="mt-0.5 line-clamp-2 text-2xs opacity-70">{approval.detail}</div> : null}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <button type="button" onClick={() => onResolve(approval.id, 'approve')} className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}>允许</button>
          {approval.irreversible ? null : (
            <button type="button" onClick={() => onResolve(approval.id, 'approve-day')} className={`${button} border border-primary/40 text-primary hover:bg-primary/10`} title="今天的操作都不再问；发送、删除、付款这类还会问">今天都允许</button>
          )}
          <button type="button" onClick={() => onResolve(approval.id, 'deny')} className={`${button} border border-border text-muted-foreground hover:bg-muted`}>不要</button>
        </div>
      </div>
      <Tail />
    </div>
  );
}

export function VoiceInputBubbleCard({ input, textColor }: { input: 'speaking' | 'recognizing'; textColor: string }) {
  return (
    <div className="relative mx-auto w-fit">
      <div className={`flex items-center gap-1.5 rounded-full text-xs font-semibold ${CARD_CLASS}`} style={{ color: textColor }}>
        <Mic className={`h-3.5 w-3.5 text-primary ${input === 'speaking' ? 'animate-pulse' : ''}`} />
        {input === 'speaking' ? '在听你说…' : '正在听清你说的话…'}
      </div>
      <Tail />
    </div>
  );
}
