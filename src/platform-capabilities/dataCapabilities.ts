import { applyDesktopPetSlotChanges } from '../multiPetRoster';
import { PERSONA_COMMUNITY_API_URL } from '../persona-community/personaCommunityApiUrl';
import { createPersonaCommunityClient, personaCommunityErrorMessage } from '../persona-community/personaCommunityClient';
import type { PublicPersonaEntry } from '../persona-community/personaCommunityTypes';
import { petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from './platformCapabilityTypes';

// Backups and shared personas from conversation. Backups go to the app's own backups folder and
// never carry API keys; restoring one first backs up the current state, then asks. Shared
// personas can be browsed and put on a character; publishing one stays a deliberate action in
// settings, since persona text can hold private memories.

const MAX_PERSONA_CHARACTERS = 12000;

// Loaded on use: the backup format pulls in the whole config normaliser (and its bundled images),
// which every capability listing would otherwise load too.
const loadBackupFormat = () => import('../privateDataBackup');

function backupBridge() {
  return typeof window === 'undefined' ? null : window.desktopPetShell?.dataBackup ?? null;
}

const DESKTOP_ONLY = { ok: false, text: '备份只能在桌面版里做。' };

function describeBackupName(name: string) {
  const match = name.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/u);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : name;
}

async function saveBackup(context: PlatformCapabilityContext) {
  const bridge = backupBridge();
  if (!bridge) return null;
  const { buildPrivateDataExport } = await loadBackupFormat();
  const result = await bridge.save(JSON.stringify(buildPrivateDataExport(context.configRef.current), null, 2));
  if (!result.ok || !result.name) throw new Error(result.error || '备份没有保存成功。');
  return result.name;
}

const backupData: PlatformCapability = {
  args: [],
  description: 'Back up the characters, memory and settings to the app’s backups folder (“帮我备份一下”). API keys are never included. Chat history is not part of it.',
  describe: () => '备份角色、记忆和设置',
  group: '数据',
  id: 'data.backup',
  risk: 'personal',
  run: async (context) => {
    try {
      const name = await saveBackup(context);
      if (!name) return DESKTOP_ONLY;
      return { ok: true, text: `已备份（${describeBackupName(name)}），包括所有角色、记忆和设置，不含 API Key。` };
    } catch (error) {
      return { ok: false, text: `备份失败：${error instanceof Error ? error.message : String(error)}` };
    }
  },
  title: '备份数据',
};

const listBackups: PlatformCapability = {
  args: [],
  description: 'List saved backups, newest first, with their names for data.restore.',
  describe: () => '查看备份',
  group: '数据',
  id: 'data.list_backups',
  risk: 'read',
  run: async () => {
    const bridge = backupBridge();
    if (!bridge) return DESKTOP_ONLY;
    const result = await bridge.list();
    if (!result.ok) return { ok: false, text: `读不到备份：${result.error ?? '未知原因'}` };
    const backups = result.backups ?? [];
    if (!backups.length) return { ok: true, text: '还没有备份。' };
    return { ok: true, text: backups.map((backup) => `${describeBackupName(backup.name)}（${backup.name}，${Math.max(1, Math.round(backup.sizeBytes / 1024))} KB）`).join('\n') };
  },
  title: '查看备份',
};

const restoreBackup: PlatformCapability = {
  args: [{ description: 'Backup file name from data.list_backups; omitted = the newest one.', key: 'backup', type: 'string' }],
  description: 'Restore characters, memory and settings from a backup (“恢复昨天的备份”). Replaces the current ones; the current state is backed up first and this device’s API keys are kept.',
  describe: (args) => `用备份${stringArg(args, 'backup') ? `“${describeBackupName(stringArg(args, 'backup'))}”` : '（最新一份）'}覆盖现在的角色、记忆和设置（会先自动备份当前状态）`,
  group: '数据',
  id: 'data.restore',
  risk: 'change',
  run: async (context, args) => {
    const bridge = backupBridge();
    if (!bridge) return DESKTOP_ONLY;
    let name = stringArg(args, 'backup');
    if (!name) {
      const listed = await bridge.list();
      name = listed.backups?.[0]?.name ?? '';
      if (!name) return { ok: false, text: '还没有备份可以恢复。' };
    }
    const read = await bridge.read(name);
    if (!read.ok || !read.text) return { ok: false, text: `打不开这个备份：${read.error ?? '未知原因'}` };
    try {
      const { parsePrivateDataExport, preserveLocalSecrets } = await loadBackupFormat();
      const restored = parsePrivateDataExport(JSON.parse(read.text));
      const safetyBackup = await saveBackup(context);
      const next = preserveLocalSecrets(restored, context.configRef.current);
      context.configRef.current = next;
      context.onUpdateConfig(next, { persist: true });
      return { ok: true, text: `已恢复到 ${describeBackupName(name)} 的备份。恢复前的状态也存了一份（${safetyBackup ? describeBackupName(safetyBackup) : '未保存'}），需要的话可以再恢复回来。` };
    } catch (error) {
      return { ok: false, text: `恢复失败，什么都没有改：${error instanceof Error ? error.message : String(error)}` };
    }
  },
  title: '恢复备份',
};

function personaClient() {
  return PERSONA_COMMUNITY_API_URL ? createPersonaCommunityClient({ apiUrl: PERSONA_COMMUNITY_API_URL }) : null;
}

function resolvePersonaEntry(entries: PublicPersonaEntry[], wanted: string) {
  const target = wanted.trim().toLowerCase();
  return entries.find((entry) => entry.title.toLowerCase() === target)
    ?? entries.find((entry) => entry.title.toLowerCase().includes(target) || entry.filename.toLowerCase().includes(target))
    ?? null;
}

/** The persona prompt in a shared file: plain text as is; JSON by its usual prompt fields. */
export function extractPersonaText(text: string, format: PublicPersonaEntry['format']) {
  if (format !== 'json') return text.trim();
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['systemInstruction', 'system_prompt', 'systemPrompt', 'prompt', 'persona', 'personality', 'description', 'content']) {
      const field = value?.[key];
      if (typeof field === 'string' && field.trim()) return field.trim();
    }
  } catch {
    return '';
  }
  return text.trim();
}

const browsePersonas: PlatformCapability = {
  args: [{ description: 'Optional keyword to filter by title or description.', key: 'query', type: 'string' }],
  description: 'Browse personas other users shared (titles, authors, descriptions).',
  describe: () => '浏览大家分享的人格',
  group: '人格分享',
  id: 'personas.browse',
  risk: 'read',
  run: async (_context, args) => {
    const client = personaClient();
    if (!client) return { ok: false, text: '人格分享暂未开放。' };
    try {
      const query = stringArg(args, 'query').toLowerCase();
      const entries = (await client.list()).filter((entry) => !query
        || [entry.title, entry.description ?? '', entry.author ?? ''].some((value) => value.toLowerCase().includes(query)));
      if (!entries.length) return { ok: true, text: query ? '没有找到相关的人格分享。' : '还没有人分享人格。' };
      return {
        ok: true,
        text: entries.slice(0, 20).map((entry) => `${entry.title}${entry.author ? `（${entry.author}）` : ''}${entry.description ? `：${entry.description.slice(0, 60)}` : ''}`).join('\n'),
      };
    } catch (error) {
      return { ok: false, text: personaCommunityErrorMessage(error, '暂时无法加载人格分享列表。') };
    }
  },
  title: '浏览人格分享',
};

const applyPersona: PlatformCapability = {
  args: [
    { description: 'Title of the shared persona (from personas.browse).', key: 'persona', required: true, type: 'string' },
    { description: '给哪个角色用（名字），不写就是当前在聊的角色', key: 'pet', type: 'string' },
  ],
  description: 'Download a shared persona and make it a character’s persona (“给小桃换上那个傲娇大小姐人格”). The character keeps its name, model and memories.',
  describe: (args) => `下载分享的人格“${stringArg(args, 'persona')}”，换给${stringArg(args, 'pet') || '当前角色'}（替换原来的人设）`,
  group: '人格分享',
  id: 'personas.apply',
  risk: 'change',
  run: async (context, args) => {
    const client = personaClient();
    if (!client) return { ok: false, text: '人格分享暂未开放。' };
    const config = context.configRef.current;
    const slot = resolvePetSlot(config, stringArg(args, 'pet'), context.petId);
    if (!slot) return { ok: false, text: `没找到这个角色。现有角色：${petListText(config)}。` };
    try {
      const entry = resolvePersonaEntry(await client.list(), stringArg(args, 'persona'));
      if (!entry) return { ok: false, text: '没找到这个人格分享，可以先浏览一下有哪些。' };
      const { blob } = await client.download(entry);
      const personaText = extractPersonaText(await blob.text(), entry.format);
      if (!personaText) return { ok: false, text: '这个分享文件里没有可用的人设内容。' };
      if (personaText.length > MAX_PERSONA_CHARACTERS) return { ok: false, text: `这个人设太长了（${personaText.length} 字），超过 ${MAX_PERSONA_CHARACTERS} 字，没有换上。` };
      // The old persona is replaced, so keep a way back.
      const safetyBackup = await saveBackup(context).catch(() => null);
      const next = applyDesktopPetSlotChanges(context.configRef.current, slot.id, { personality: { ...slot.personality, systemInstruction: personaText } });
      context.configRef.current = next;
      context.onUpdateConfig(next, { persist: true });
      return {
        ok: true,
        text: `${slot.personality.name}换上了人格“${entry.title}”。${safetyBackup ? `原来的人设在 ${describeBackupName(safetyBackup)} 的备份里，想换回来可以恢复。` : '原来的人设已被替换。'}`,
      };
    } catch (error) {
      return { ok: false, text: personaCommunityErrorMessage(error, '下载人格分享失败。') };
    }
  },
  title: '换上分享的人格',
};

export const DATA_CAPABILITIES: PlatformCapability[] = [backupData, listBackups, restoreBackup, browsePersonas, applyPersona];
