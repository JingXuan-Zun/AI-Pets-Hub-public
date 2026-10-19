import { applyDesktopPetSlotChanges } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityArgs, PlatformCapabilityContext } from './platformCapabilityTypes';

// Knowledge bases from conversation (“把这个加到知识库里”). The global one is read by every
// character; a character's own one holds its lore and background. Changes go into every
// later prompt and the text may come from a web page or file, so adding and removing ask
// the user first with the text shown.

const GROUP = '知识库';
const MAX_ADD_CHARS = 4000;
const MAX_READ_CHARS = 6000;

type Scope = 'global' | 'character';

function scopeOf(args: PlatformCapabilityArgs): Scope {
  return stringArg(args, 'scope') === 'character' ? 'character' : 'global';
}

/** The text of the chosen knowledge base, and how to write it back. */
function target(context: PlatformCapabilityContext, args: PlatformCapabilityArgs) {
  const config = context.configRef.current;
  if (scopeOf(args) === 'global') {
    return {
      label: '全局知识库（所有角色共用）',
      text: config.settings.globalKnowledgeBase,
      write: (text: string): PetConfig => ({ ...config, settings: { ...config.settings, globalKnowledgeBase: text } }),
    };
  }
  const slot = resolvePetSlot(config, stringArg(args, 'pet'), context.petId);
  if (!slot) return null;
  return {
    label: `${slot.personality.name} 的角色知识`,
    text: slot.personality.knowledgeBase,
    write: (text: string): PetConfig => applyDesktopPetSlotChanges(config, slot.id, { personality: { ...slot.personality, knowledgeBase: text } }),
  };
}

function paragraphs(text: string) {
  return text.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const scopeArgs = [
  { description: 'global：所有角色共用的知识库（默认）；character：某个角色自己的设定和背景知识', enumValues: ['global', 'character'], key: 'scope', type: 'string' as const },
  { description: 'scope 为 character 时是哪个角色（名字），不写就是当前角色', key: 'pet', type: 'string' as const },
];

const addKnowledge: PlatformCapability = {
  args: [
    { description: '要加进去的内容（整理好的文字，可以是一段资料、设定、规则）', key: 'text', required: true, type: 'string' },
    ...scopeArgs,
  ],
  description: 'Add text to a knowledge base (“把这个加到知识库里”, “记到你的设定里”). For facts about the user themselves use the memory tool instead.',
  describe: (args) => `加到${scopeOf(args) === 'global' ? '全局知识库' : '角色知识'}：${clip(stringArg(args, 'text'), 120)}`,
  group: GROUP,
  id: 'knowledge.add',
  risk: 'change',
  run: (context, args) => {
    const text = stringArg(args, 'text');
    if (!text) return { ok: false, text: '需要要加的内容。' };
    if (text.length > MAX_ADD_CHARS) return { ok: false, text: `内容太长了（${text.length} 字），一次最多 ${MAX_ADD_CHARS} 字。先整理成要点再加。` };
    const kb = target(context, args);
    if (!kb) return { ok: false, text: `没找到这个角色。现有角色：${petListText(context.configRef.current)}。` };
    const existing = kb.text.trim();
    if (paragraphs(existing).includes(text)) return { ok: true, text: `${kb.label}里已经有这段了。` };
    const next = kb.write(existing ? `${existing}\n\n${text}` : text);
    context.configRef.current = next;
    context.onUpdateConfig(next, { persist: true });
    return { ok: true, text: `已加到${kb.label}（现在共 ${paragraphs(existing).length + 1} 段）。` };
  },
  title: '加到知识库',
};

const readKnowledge: PlatformCapability = {
  args: scopeArgs,
  description: 'Read a knowledge base, e.g. before answering “知识库里都有什么” or to find a paragraph to remove.',
  describe: (args) => `查看${scopeOf(args) === 'global' ? '全局知识库' : '角色知识'}`,
  group: GROUP,
  id: 'knowledge.read',
  risk: 'read',
  run: (context, args) => {
    const kb = target(context, args);
    if (!kb) return { ok: false, text: `没找到这个角色。现有角色：${petListText(context.configRef.current)}。` };
    const parts = paragraphs(kb.text);
    if (!parts.length) return { ok: true, text: `${kb.label}是空的。` };
    return { ok: true, text: clip(`${kb.label}（${parts.length} 段）：\n${parts.map((part, index) => `${index + 1}. ${part}`).join('\n')}`, MAX_READ_CHARS) };
  },
  title: '查看知识库',
};

const removeKnowledge: PlatformCapability = {
  args: [
    { description: '要删的那段：knowledge.read 里的段落序号，或段落里的关键词', key: 'match', required: true, type: 'string' },
    ...scopeArgs,
  ],
  description: 'Remove one paragraph from a knowledge base (“把关于 XX 的那段从知识库删掉”).',
  describe: (args) => `从${scopeOf(args) === 'global' ? '全局知识库' : '角色知识'}删掉：${stringArg(args, 'match')}`,
  group: GROUP,
  id: 'knowledge.remove',
  risk: 'change',
  run: (context, args) => {
    const kb = target(context, args);
    if (!kb) return { ok: false, text: `没找到这个角色。现有角色：${petListText(context.configRef.current)}。` };
    const parts = paragraphs(kb.text);
    const match = stringArg(args, 'match');
    const number = /^\d+$/u.test(match) ? Number(match) : NaN;
    const index = Number.isInteger(number) && number >= 1 && number <= parts.length
      ? number - 1
      : parts.findIndex((part) => match && part.includes(match));
    if (index < 0) return { ok: false, text: `${kb.label}里没找到这段。先用 knowledge.read 看看有哪些。` };
    const next = kb.write(parts.filter((_, position) => position !== index).join('\n\n'));
    context.configRef.current = next;
    context.onUpdateConfig(next, { persist: true });
    return { ok: true, text: `已从${kb.label}删掉：${clip(parts[index], 60)}` };
  },
  title: '从知识库删除',
};

export const KNOWLEDGE_CAPABILITIES: PlatformCapability[] = [addKnowledge, readKnowledge, removeKnowledge];
