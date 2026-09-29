import { MessageCircleMore, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import type { GroupUserAttention, GroupUserAttentionDecision } from '../../../../chatState';

interface GroupUserAttentionPromptProps {
  attention: GroupUserAttention;
  onResolve: (decision: GroupUserAttentionDecision, text?: string) => void | Promise<void>;
}

function AttentionHeader({ attention }: { attention: GroupUserAttention }) {
  return (
    <div className="flex items-start gap-2 text-amber-950">
      <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-semibold">{attention.roleName} 正在等你回应</div>
        <div className="mt-1 line-clamp-2 text-[11px] text-amber-800">{attention.promptText}</div>
      </div>
    </div>
  );
}

interface AttentionActionsProps {
  draft: string;
  isResolving: boolean;
  onContinue: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}

function AttentionActions(props: AttentionActionsProps) {
  return (
    <>
      <div className="mt-3 flex min-w-0 gap-2">
        <Input
          value={props.draft}
          disabled={props.isResolving}
          onChange={(event) => props.onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              props.onSend();
            }
          }}
          placeholder="输入你想插话的内容…"
          className="h-8 min-w-0 flex-1 bg-white text-xs"
        />
        <Button type="button" size="sm" disabled={props.isResolving || !props.draft.trim()}
          onClick={props.onSend} className="h-8 shrink-0">
          <Send className="mr-1 h-3 w-3" />插话
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" disabled={props.isResolving}
        onClick={props.onContinue}
        className="mt-2 h-7 w-full text-[11px] text-amber-900 hover:bg-amber-100">
        让角色们继续聊
      </Button>
    </>
  );
}

export function GroupUserAttentionPrompt({
  attention,
  onResolve,
}: GroupUserAttentionPromptProps) {
  const [draft, setDraft] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    setDraft('');
    setIsResolving(false);
  }, [attention.sourceMessageKey]);

  const resolve = async (decision: GroupUserAttentionDecision, text?: string) => {
    if (isResolving) {
      return;
    }
    setIsResolving(true);
    try {
      await onResolve(decision, text);
    } finally {
      setIsResolving(false);
    }
  };

  const sendInterjection = () => {
    const text = draft.trim();
    if (text) {
      void resolve('interject', text);
    }
  };

  return (
    <section
      className="mx-4 mb-2 rounded-2xl border border-amber-200/80 bg-amber-50/95 p-3 shadow-[0_12px_32px_rgba(180,83,9,0.12)]"
      aria-live="polite"
      data-group-user-attention="true"
    >
      <AttentionHeader attention={attention} />
      <AttentionActions
        draft={draft}
        isResolving={isResolving}
        onContinue={() => void resolve('continue')}
        onDraftChange={setDraft}
        onSend={sendInterjection}
      />
    </section>
  );
}
