import { X } from 'lucide-react';
import {
  STATUS_FACT_TTL_MS,
  clearStatusFacts,
  removeStatusFact,
  useStatusFacts,
} from '../../character-status/characterStatusBoard';

// Under 角色之间互通近况: every fact on the board, who it is about and who said it; each can be
// deleted.

function ago(at: number) {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));
  return minutes < 60 ? `${minutes} 分钟前` : `${Math.round(minutes / 60)} 小时前`;
}

export function SettingsCharacterStatusBoard() {
  const facts = useStatusFacts().filter((fact) => Date.now() - fact.createdAt < STATUS_FACT_TTL_MS);
  const sorted = [...facts].sort((left, right) => right.createdAt - left.createdAt);

  return (
    <div className="space-y-2 rounded-sm border border-border/70 bg-background/40 p-2 text-2xs leading-5 text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span>近况板：{sorted.length} 条（24 小时后不再使用）</span>
        {sorted.length ? (
          <button type="button" className="rounded-sm border border-border px-2 py-0.5 hover:bg-secondary" onClick={clearStatusFacts}>
            全部清空
          </button>
        ) : null}
      </div>
      {sorted.length ? sorted.map((fact) => (
        <div key={fact.id} className="flex items-start gap-2">
          <span className="flex-1">
            <span className="font-semibold text-foreground">{fact.subjectName}</span>：{fact.text}
            <span className="ml-1 opacity-70">（{fact.kind === 'self' ? '自己说的' : `${fact.sourceName}说的`}，{ago(fact.createdAt)}）</span>
          </span>
          <button type="button" aria-label="删除这条近况" className="rounded-sm p-0.5 hover:bg-secondary" onClick={() => removeStatusFact(fact.id)}>
            <X className="h-3 w-3" />
          </button>
        </div>
      )) : <div>还没有记下近况。角色在聊天里说起自己或别人在做什么时会记在这里。</div>}
    </div>
  );
}
