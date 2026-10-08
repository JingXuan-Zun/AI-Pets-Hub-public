import { ChevronDown, Pin, PinOff, Trash2 } from 'lucide-react';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import {
  CHARACTER_MEMORY_KIND_LABELS,
  CHARACTER_MEMORY_KINDS,
  compactMemoryText,
  createCharacterMemoryItemId,
  normalizeCharacterMemoryState,
  type CharacterManualMemoryField,
  type CharacterMemoryKind,
  type CharacterMemoryState,
} from '../../character-memory/characterMemoryTypes';
import {
  buildManualMemoryTidyPrompt,
  MANUAL_MEMORY_FIELD_LABELS,
  parseManualMemoryTidy,
} from '../../character-memory/manualMemoryTidy';
import type { PetConfig, PetPersonality } from '../../types';
import { inputClassName, selectClassName } from './settingsVoiceUtils';

const smallButtonClassName = 'h-7 rounded-full border border-border/70 px-3 text-2xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40';
const textareaClassName = 'min-h-24 w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary';

function formatTime(timestamp: number) {
  return timestamp > 0
    ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';
}

function MemoryPanel({
  actions,
  children,
  description,
  noDragRegionStyle,
  summary,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  noDragRegionStyle?: CSSProperties;
  summary: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleTitle = `${expanded ? '收起' : '展开'}${title}`;
  return (
    <section className="rounded-sm border border-border bg-secondary/20">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={toggleTitle}
          style={noDragRegionStyle}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
            <div className="mt-1 text-2xs leading-4 text-muted-foreground">{description}</div>
          </div>
          <span className="shrink-0 font-mono text-2xs text-primary">{summary}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            style={noDragRegionStyle}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/60 bg-primary text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {expanded ? <div className="space-y-3 border-t border-border px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function SettingsCharacterMemorySection({
  noDragRegionStyle,
  onUpdatePersonality,
  personality,
  settings,
}: {
  noDragRegionStyle?: CSSProperties;
  onUpdatePersonality: (updates: Partial<PetPersonality>) => void;
  personality: PetPersonality;
  settings: PetConfig['settings'];
}) {
  const state = normalizeCharacterMemoryState(personality.memoryState);
  const [newItemText, setNewItemText] = useState('');
  const [newItemKind, setNewItemKind] = useState<CharacterMemoryKind>('profile');
  const [tidyingField, setTidyingField] = useState<CharacterManualMemoryField | null>(null);
  const [tidyMessage, setTidyMessage] = useState('');
  // A tidy-up waits on the model; read the memory state again when it returns.
  const latestPersonalityRef = useRef(personality);
  latestPersonalityRef.current = personality;

  const updateState = (next: CharacterMemoryState) => onUpdatePersonality({ memoryState: next });
  const updateItem = (id: string, changes: Partial<CharacterMemoryState['items'][number]>) => updateState({
    ...state,
    items: state.items.map((item) => (item.id === id ? { ...item, ...changes, updatedAt: Date.now() } : item)),
  });
  const removeItem = (id: string) => updateState({
    ...state,
    items: state.items.filter((item) => item.id !== id),
    itemsBackup: { items: state.items, savedAt: Date.now() },
  });
  const addItem = () => {
    const text = compactMemoryText(newItemText);
    if (!text) return;
    const now = Date.now();
    updateState({
      ...state,
      items: [...state.items, { createdAt: now, id: createCharacterMemoryItemId(now), kind: newItemKind, source: 'manual', text, updatedAt: now }],
    });
    setNewItemText('');
  };

  const tidyManualMemory = async (field: CharacterManualMemoryField) => {
    const original = personality[field];
    if (!original.trim() || tidyingField) return;
    setTidyingField(field);
    setTidyMessage('');
    try {
      const prompt = buildManualMemoryTidyPrompt({ field, roleName: personality.name, text: original });
      const { getConfiguredCognitionResponse } = await import('../../services/geminiService');
      const output = await getConfiguredCognitionResponse(prompt.payload, prompt.systemInstruction, settings, {
        allowReasoningContentFallback: true,
        maxTokensOverride: 4000,
        task: 'memory-retrieval',
        timeoutMs: 120_000,
      });
      const tidied = parseManualMemoryTidy(output, original);
      if (!tidied) {
        setTidyMessage('整理结果不完整，已保留原内容。');
        return;
      }
      const latestState = normalizeCharacterMemoryState(latestPersonalityRef.current.memoryState);
      onUpdatePersonality({
        [field]: tidied,
        memoryState: { ...latestState, manualBackup: { field, savedAt: Date.now(), text: original } },
      });
      setTidyMessage(`「${MANUAL_MEMORY_FIELD_LABELS[field]}」已整理：${original.trim().length} 字 → ${tidied.length} 字。`);
    } catch (error) {
      setTidyMessage(`整理失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTidyingField(null);
    }
  };

  const undoTidy = () => {
    const backup = state.manualBackup;
    if (!backup) return;
    onUpdatePersonality({ [backup.field]: backup.text, memoryState: { ...state, manualBackup: null } });
    setTidyMessage(`已恢复整理前的「${MANUAL_MEMORY_FIELD_LABELS[backup.field]}」。`);
  };

  const sortedItems = [...state.items].sort((left, right) => (
    Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || right.updatedAt - left.updatedAt
  ));

  return (
    <>
      <MemoryPanel
        title="自动记忆"
        description="角色在私聊中自动记下的事（个人信息、喜好、约定、经历），每次聊天都会带上。可以修改、删除或置顶。神经人格模式下不自动记录。"
        summary={state.items.length ? `${state.items.length} 条` : '暂无'}
        noDragRegionStyle={noDragRegionStyle}
        actions={state.itemsBackup ? (
          <Button
            type="button" variant="ghost" size="sm" className={smallButtonClassName}
            title={`恢复到 ${formatTime(state.itemsBackup.savedAt)} 删除或整理之前的样子`}
            onClick={() => updateState({ ...state, items: state.itemsBackup?.items ?? state.items, itemsBackup: null })}
          >
            撤销上次删除
          </Button>
        ) : null}
      >
        {sortedItems.length ? sortedItems.map((item) => (
          <div key={`${item.id}:${item.updatedAt}`} className="flex items-start gap-2" style={noDragRegionStyle}>
            <select
              className={`${selectClassName} w-24 shrink-0`}
              value={item.kind}
              onChange={(event) => updateItem(item.id, { kind: event.target.value as CharacterMemoryKind })}
            >
              {CHARACTER_MEMORY_KINDS.map((kind) => <option key={kind} value={kind}>{CHARACTER_MEMORY_KIND_LABELS[kind]}</option>)}
            </select>
            <input
              className={`${inputClassName} min-w-0 flex-1`}
              defaultValue={item.text}
              title={`${item.source === 'auto' ? '自动记录' : '手动添加'} · ${formatTime(item.updatedAt)}`}
              onBlur={(event) => {
                const text = compactMemoryText(event.target.value);
                if (text && text !== item.text) updateItem(item.id, { text });
                else event.target.value = item.text;
              }}
            />
            <button
              type="button"
              title={item.pinned ? '取消置顶' : '置顶：篇幅不够时也一定保留'}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border ${item.pinned ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={() => updateItem(item.id, { pinned: !item.pinned })}
            >
              {item.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              title="删除这条记忆"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )) : <div className="text-2xs text-muted-foreground">还没有自动记忆。多聊几句，角色会自己记下值得记住的事。</div>}
        <div className="flex items-center gap-2 border-t border-border pt-3" style={noDragRegionStyle}>
          <select
            className={`${selectClassName} w-24 shrink-0`}
            value={newItemKind}
            onChange={(event) => setNewItemKind(event.target.value as CharacterMemoryKind)}
          >
            {CHARACTER_MEMORY_KINDS.map((kind) => <option key={kind} value={kind}>{CHARACTER_MEMORY_KIND_LABELS[kind]}</option>)}
          </select>
          <input
            className={`${inputClassName} min-w-0 flex-1`}
            value={newItemText}
            placeholder="手动添加一条，例如：用户对芒果过敏"
            onChange={(event) => setNewItemText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addItem(); }}
          />
          <Button type="button" size="sm" className="h-8 shrink-0" disabled={!newItemText.trim()} onClick={addItem}>
            添加
          </Button>
        </div>
      </MemoryPanel>

      <MemoryPanel
        title="过往对话摘要"
        description="较早的私聊被挤出上下文时，会在后台总结到这里，每次聊天都会带上。可以直接修改。"
        summary={state.summary ? `${state.summary.text.length} 字` : '暂无'}
        noDragRegionStyle={noDragRegionStyle}
        actions={(
          <Button
            type="button" variant="ghost" size="sm" className={smallButtonClassName}
            disabled={!state.summary}
            title="清空后，下次总结会从还在记录里的旧消息重新开始"
            onClick={() => updateState({ ...state, summary: null })}
          >
            重置
          </Button>
        )}
      >
        {state.summary ? (
          <>
            <textarea
              key={state.summary.updatedAt}
              className={textareaClassName}
              style={noDragRegionStyle}
              defaultValue={state.summary.text}
              onBlur={(event) => {
                const text = event.target.value.trim();
                if (state.summary && text && text !== state.summary.text) {
                  updateState({ ...state, summary: { ...state.summary, text, updatedAt: Date.now() } });
                }
              }}
            />
            <div className="text-2xs text-muted-foreground">
              已总结到 {formatTime(state.summary.coveredUntil)} 的消息 · 更新于 {formatTime(state.summary.updatedAt)}
            </div>
          </>
        ) : (
          <div className="text-2xs text-muted-foreground">私聊记录还没有超出上下文窗口，暂时不需要摘要。</div>
        )}
      </MemoryPanel>

      <MemoryPanel
        title="整理手动记忆"
        description="手动保存的记忆会越积越多。整理会合并重复内容、去掉时间戳标题，保留所有仍然有效的事实；不满意可以撤销。"
        summary={tidyingField ? '整理中…' : ''}
        noDragRegionStyle={noDragRegionStyle}
      >
        <div className="flex flex-wrap items-center gap-2" style={noDragRegionStyle}>
          {(['userMemory', 'chatHistoryMemory'] as const).map((field) => (
            <Button
              key={field} type="button" variant="ghost" size="sm" className={smallButtonClassName}
              disabled={Boolean(tidyingField) || !personality[field].trim()}
              onClick={() => { void tidyManualMemory(field); }}
            >
              {tidyingField === field ? '整理中…' : `整理「${MANUAL_MEMORY_FIELD_LABELS[field]}」`}
            </Button>
          ))}
          {state.manualBackup ? (
            <Button type="button" variant="ghost" size="sm" className={smallButtonClassName} onClick={undoTidy}>
              撤销整理「{MANUAL_MEMORY_FIELD_LABELS[state.manualBackup.field]}」
            </Button>
          ) : null}
        </div>
        {tidyMessage ? <div className="text-2xs text-muted-foreground">{tidyMessage}</div> : null}
      </MemoryPanel>
    </>
  );
}
