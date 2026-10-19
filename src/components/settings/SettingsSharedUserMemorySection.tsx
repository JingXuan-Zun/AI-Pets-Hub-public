import { Trash2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import {
  CHARACTER_MEMORY_KIND_LABELS,
  CHARACTER_MEMORY_KINDS,
  compactMemoryText,
  createCharacterMemoryItemId,
  type CharacterMemoryItem,
  type CharacterMemoryKind,
} from '../../character-memory/characterMemoryTypes';
import { hasSharedUserMemory } from '../../character-memory/sharedUserMemory';
import type { PetConfig } from '../../types';
import { MemoryPanel } from './SettingsCharacterMemorySection';
import { inputClassName, selectClassName } from './settingsVoiceUtils';

/** “关于你”：every character reads this list; edits here apply to all of them. */
export function SettingsSharedUserMemorySection({
  applySettings,
  noDragRegionStyle,
  settings,
}: {
  applySettings: (updates: Partial<PetConfig['settings']>) => void;
  noDragRegionStyle?: CSSProperties;
  settings: PetConfig['settings'];
}) {
  const items = settings.sharedUserMemory ?? [];
  const [newItemText, setNewItemText] = useState('');
  const [newItemKind, setNewItemKind] = useState<CharacterMemoryKind>('profile');

  const save = (next: CharacterMemoryItem[]) => applySettings({ sharedUserMemory: next });
  const updateItem = (id: string, changes: Partial<CharacterMemoryItem>) => save(items.map((item) => (
    item.id === id ? { ...item, ...changes, updatedAt: Date.now() } : item
  )));
  const addItem = () => {
    const text = compactMemoryText(newItemText);
    if (!text || hasSharedUserMemory(items, text)) return;
    const now = Date.now();
    save([...items, { createdAt: now, id: createCharacterMemoryItemId(now), kind: newItemKind, source: 'manual', text, updatedAt: now }]);
    setNewItemText('');
  };

  return (
    <MemoryPanel
      title="关于你（所有角色共享）"
      description="你让角色“记住”的事，批准后记在这里，所有角色聊天时都会知道。也可以直接在这里添加、修改或删除。"
      summary={items.length ? `${items.length} 条` : '暂无'}
      noDragRegionStyle={noDragRegionStyle}
    >
      {items.length ? [...items].sort((left, right) => right.updatedAt - left.updatedAt).map((item) => (
        <div key={`${item.id}:${item.updatedAt}`} className="flex items-start gap-2" style={noDragRegionStyle}>
          <select
            className={`${selectClassName().replace('w-full', 'w-24')} shrink-0`}
            value={item.kind}
            onChange={(event) => updateItem(item.id, { kind: event.target.value as CharacterMemoryKind })}
          >
            {CHARACTER_MEMORY_KINDS.map((kind) => <option key={kind} value={kind}>{CHARACTER_MEMORY_KIND_LABELS[kind]}</option>)}
          </select>
          <input
            className={`${inputClassName()} min-w-0 flex-1`}
            defaultValue={item.text}
            onBlur={(event) => {
              const text = compactMemoryText(event.target.value);
              if (text && text !== item.text) updateItem(item.id, { text });
              else event.target.value = item.text;
            }}
          />
          <button
            type="button"
            title="删除这条记忆"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-destructive"
            onClick={() => save(items.filter((entry) => entry.id !== item.id))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )) : <div className="text-2xs text-muted-foreground">还没有。跟任意一个角色说“帮我记住……”，批准后就会出现在这里。</div>}
      <div className="flex items-center gap-2 border-t border-border pt-3" style={noDragRegionStyle}>
        <select
          className={`${selectClassName().replace('w-full', 'w-24')} shrink-0`}
          value={newItemKind}
          onChange={(event) => setNewItemKind(event.target.value as CharacterMemoryKind)}
        >
          {CHARACTER_MEMORY_KINDS.map((kind) => <option key={kind} value={kind}>{CHARACTER_MEMORY_KIND_LABELS[kind]}</option>)}
        </select>
        <input
          className={`${inputClassName()} min-w-0 flex-1`}
          value={newItemText}
          placeholder="例如：我对芒果过敏"
          onChange={(event) => setNewItemText(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') addItem(); }}
        />
        <Button type="button" size="sm" className="h-8 shrink-0" disabled={!newItemText.trim()} onClick={addItem}>
          添加
        </Button>
      </div>
    </MemoryPanel>
  );
}
