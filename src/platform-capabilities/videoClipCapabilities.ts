import { publishVideoClipRequest } from '../pet-runtime/video2d/videoItemInteraction';
import type { PetConfig } from '../types';
import { petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability } from './platformCapabilityTypes';

// A video character plays a clip by name (README known issue, fixed 2026-11-18): her library is a
// folder of clip groups (待机/, 开心/, 跳舞/ …); "跳个舞" plays one clip from 跳舞/, then she goes
// back to what she was doing. Without a name, or with one that matches nothing, she gets the list.

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_\-·.]+/gu, '');

/** The folder for a spoken clip name: exact first, then one name containing the other. */
export function matchClipFolder<T extends { name: string }>(folders: T[], wanted: string): T | null {
  const target = normalize(wanted);
  if (!target) return null;
  return folders.find((folder) => normalize(folder.name) === target)
    ?? folders.find((folder) => normalize(folder.name).includes(target))
    ?? folders.find((folder) => target.includes(normalize(folder.name)) && normalize(folder.name).length >= 2)
    ?? null;
}

function videoLibraryOf(config: PetConfig, modelUrl: string) {
  return config.customModelPresets.find((preset) => preset.type === '2d' && preset.renderKind === 'video' && preset.url === modelUrl)?.videoLibraryRootPath?.trim() || '';
}

export const VIDEO_CLIP_CAPABILITIES: PlatformCapability[] = [{
  args: [
    { description: 'The clip to play, as the user said it (“跳舞”“打招呼”); leave empty to get the list of clips.', key: 'clip', type: 'string' },
    { description: 'Which character (name); default is the one the user is talking to.', key: 'pet', type: 'string' },
  ],
  description: 'Play one clip from a 2D video character’s clip library by name (“跳个舞”“挥挥手”), then she goes back to idle. Only for video characters; empty clip lists what she has.',
  describe: (args) => `播放“${stringArg(args, 'clip') || '动作列表'}”`,
  group: '角色',
  id: 'pet.play_video_clip',
  risk: 'personal',
  run: async (context, args) => {
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    const slot = resolvePetSlot(config, petArg, context.petId ?? null);
    if (!slot) return { ok: false, text: `没找到叫“${petArg}”的角色。现有角色：${petListText(config)}。` };
    const name = slot.personality.name;
    const rootPath = slot.modelType === '2d' ? videoLibraryOf(config, slot.modelUrl) : '';
    if (!rootPath) return { ok: false, text: `${name}不是视频角色，或者还没设置视频库（设置 → 桌宠 → 模型）。做动作请用动作工具。` };
    const inspected = await window.desktopPetShell?.inspect2DVideoLibrary?.({ rootPath });
    const folders = inspected?.ok ? inspected.folders ?? [] : [];
    if (!folders.length) return { ok: false, text: `${name}的视频库里没有能播放的片段（${inspected?.error ?? '读不到'}）。` };
    const names = folders.map((folder) => folder.name).join('、');
    const wanted = stringArg(args, 'clip');
    const folder = matchClipFolder(folders, wanted);
    if (!folder) return { ok: !wanted, text: wanted ? `${name}没有叫“${wanted}”的片段。有这些：${names}。` : `${name}有这些片段：${names}。` };
    if (!slot.enabled || !slot.modelVisible || !publishVideoClipRequest({ folderPath: folder.folderPath, modelUrl: slot.modelUrl })) {
      return { ok: false, text: `${name}现在不在桌面上，播不了。` };
    }
    return { ok: true, text: `${name}正在播放“${folder.name}”。` };
  },
  title: '播放视频片段',
}];
