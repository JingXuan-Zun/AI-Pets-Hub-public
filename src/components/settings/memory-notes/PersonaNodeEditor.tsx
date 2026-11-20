import { useEffect, useState } from 'react';

// The 人格节点's editor: her persona prompt, written by the user. It is the same text as
// 设置 → 人格 → 人格提示词 (one source), so editing either place changes both.

export function PersonaNodeAvatar(props: { avatarUrl?: string; name: string; size: number }) {
  const style = { height: props.size, width: props.size };
  return props.avatarUrl
    ? <img src={props.avatarUrl} alt="" style={style} className="shrink-0 rounded-full object-cover ring-2 ring-primary/40" />
    : <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(props.name || '人').trim().slice(0, 1)}</span>;
}

export interface GrowthDiaryEntry { createdAt: number; evidenceCount: number; kindLabel: string; nodeId: string; text: string }

/** Her 成长日记: what she grew into from experience (each one approved by the user). */
function GrowthDiary(props: { entries: GrowthDiaryEntry[]; onOpen: (nodeId: string) => void; onReflect?: () => Promise<string> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section data-growth-diary className="space-y-2 border-t border-border/70 pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">成长日记</span>
        <span className="text-2xs text-muted-foreground">她从经历里慢慢长出来的喜好、看法和小习惯；性格不会变。每一条都是你认可过的，点开能改或删。</span>
        {props.onReflect ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setBusy(true); setNote('她在回顾最近的经历…'); void props.onReflect?.().then(setNote).finally(() => setBusy(false)); }}
            className="ml-auto shrink-0 rounded border border-primary px-2 py-1 text-2xs font-semibold text-primary disabled:opacity-50"
          >
            回顾一下
          </button>
        ) : null}
      </div>
      {note ? <div className="text-2xs text-muted-foreground">{note}</div> : null}
      {props.entries.length ? (
        <ul className="space-y-1">
          {props.entries.map((entry) => (
            <li key={entry.nodeId}>
              <button type="button" onClick={() => props.onOpen(entry.nodeId)} className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-black/5">
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-2xs text-primary">{entry.kindLabel}</span>
                <span className="min-w-0 flex-1">{entry.text}</span>
                <span className="shrink-0 text-2xs text-muted-foreground">{entry.evidenceCount} 段经历</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <div className="text-2xs text-muted-foreground">还没有。她积累了足够的经历后会自己回顾，想到的变化会出现在聊天窗口左边等你认可。</div>}
    </section>
  );
}

export function PersonaNodeEditor(props: {
  avatarUrl?: string;
  growth?: GrowthDiaryEntry[];
  name: string;
  onOpenNode?: (nodeId: string) => void;
  onReflect?: () => Promise<string>;
  onSave: (personaPrompt: string) => void;
  personaPrompt: string;
}) {
  const [draft, setDraft] = useState(props.personaPrompt);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(props.personaPrompt); setSaved(false); }, [props.personaPrompt]);
  const changed = draft !== props.personaPrompt;

  return (
    <div data-persona-node-editor className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-3">
        <PersonaNodeAvatar avatarUrl={props.avatarUrl} name={props.name} size={44} />
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{props.name || '未命名角色'} · 人格</div>
          <div className="text-2xs text-muted-foreground">她出生时的样子：人格提示词由你来写。之后的经历和学到的东西都会连在这个节点周围。头像跟聊天窗口里给她设置的一样。</div>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
        placeholder="还没有内容。在这里写下她的人格提示词（性格、说话方式、和你的关系……）。"
        className="custom-scrollbar min-h-[320px] flex-1 resize-none rounded-md border border-border bg-background p-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <div className="flex items-center justify-end gap-2 text-2xs">
        <span className="text-muted-foreground">{saved ? '已保存' : changed ? '有改动未保存' : `${props.personaPrompt.length} 字`}</span>
        <button
          type="button"
          disabled={!changed}
          onClick={() => { props.onSave(draft); setSaved(true); }}
          className="rounded bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-40"
        >
          保存
        </button>
      </div>
      <GrowthDiary entries={props.growth ?? []} onOpen={(nodeId) => props.onOpenNode?.(nodeId)} onReflect={props.onReflect} />
    </div>
  );
}
