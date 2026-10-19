import {
  addDesktopPetSlot,
  applyDesktopPetModelSelection,
  applyDesktopPetSlotChanges,
  canAddDesktopPetSlot,
  getDesktopPetSlots,
} from '../multiPetRoster';
import type { PetConfig, PetModelPreset } from '../types';
import { petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from './platformCapabilityTypes';

// Building the cast from conversation: see the model library, give a character another model
// (“换成康熙那个模型”), and add a new character (“再来一个桌宠，叫小雪，用茉莉安的模型”).
// Models come only from the library the user imported; importing files stays in settings.

const GROUP = '角色';
const MAX_NAME_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 600;

const MODEL_TYPE_LABELS: Record<string, string> = { '2d': '2D', '3d': '3D', live2d: 'Live2D' };

function modelLabel(preset: PetModelPreset) {
  return `${preset.name}（${MODEL_TYPE_LABELS[preset.type] ?? preset.type}）`;
}

function modelLibraryText(config: PetConfig) {
  return config.customModelPresets.map((preset) => preset.name).join('、') || '（模型库是空的）';
}

/** A library model by name: exact, then contained either way, ignoring case and spaces. */
function resolveModelPreset(config: PetConfig, wanted: string): PetModelPreset | null {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/gu, '');
  const target = normalize(wanted);
  if (!target) return null;
  const presets = config.customModelPresets;
  return presets.find((preset) => normalize(preset.name) === target)
    ?? presets.find((preset) => normalize(preset.name).includes(target))
    ?? presets.find((preset) => target.includes(normalize(preset.name)))
    ?? null;
}

function commit(context: PlatformCapabilityContext, next: PetConfig) {
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

const listModels: PlatformCapability = {
  args: [],
  description: 'List the model library (the character models the user imported) and which character uses each. Use before changing a model or creating a character.',
  describe: () => '查看模型库',
  group: GROUP,
  id: 'models.list',
  risk: 'read',
  run: ({ configRef }) => {
    const config = configRef.current;
    if (!config.customModelPresets.length) return { ok: true, text: '模型库是空的。可以在设置的“模型库”里导入模型。' };
    const slots = getDesktopPetSlots(config);
    return {
      ok: true,
      text: config.customModelPresets.map((preset) => {
        const users = slots.filter((slot) => slot.modelUrl === preset.url).map((slot) => slot.personality.name);
        return `${modelLabel(preset)}${users.length ? `：${users.join('、')}在用` : ''}`;
      }).join('\n'),
    };
  },
  title: '查看模型库',
};

const setPetModel: PlatformCapability = {
  args: [
    { description: '换哪个角色（名字），不写就是当前在聊的角色', key: 'pet', type: 'string' },
    { description: 'Model name from the library (see models.list).', key: 'model', required: true, type: 'string' },
  ],
  description: 'Give a character another model from the library (“换成康熙那个模型”“把小桃换成 Live2D 的”). Also puts the character on the desktop.',
  describe: (args) => `把${stringArg(args, 'pet') || '角色'}的模型换成“${stringArg(args, 'model')}”`,
  group: GROUP,
  id: 'pets.set_model',
  risk: 'change',
  run: (context, args) => {
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    const slot = resolvePetSlot(config, petArg, context.petId);
    if (!slot) return { ok: false, text: `没找到这个角色。现有角色：${petListText(config)}。` };
    const preset = resolveModelPreset(config, stringArg(args, 'model'));
    if (!preset) return { ok: false, text: `模型库里没有这个模型。现有模型：${modelLibraryText(config)}。` };
    if (slot.modelUrl === preset.url) return { ok: true, text: `${slot.personality.name}已经在用“${preset.name}”了。` };
    commit(context, applyDesktopPetModelSelection(config, slot.id, { modelType: preset.type, modelUrl: preset.url }));
    return { ok: true, text: `${slot.personality.name}换成了“${modelLabel(preset)}”。` };
  },
  title: '换模型',
};

const createPet: PlatformCapability = {
  args: [
    { description: '新角色的名字', key: 'name', required: true, type: 'string' },
    { description: 'Model name from the library; omitted = same model as the main character.', key: 'model', type: 'string' },
    { description: '性格和说话方式，一两句话，例如“傲娇、嘴硬心软，说话带点毒舌”', key: 'personality', type: 'string' },
  ],
  description: 'Add a new character to the desktop (“再来一个桌宠，叫小雪，用茉莉安的模型，性格温柔”). It starts enabled and visible.',
  describe: (args) => {
    const model = stringArg(args, 'model');
    return `新建桌宠“${stringArg(args, 'name')}”${model ? `，用“${model}”模型` : ''}`;
  },
  group: GROUP,
  id: 'pets.create',
  risk: 'change',
  run: (context, args) => {
    const config = context.configRef.current;
    const name = stringArg(args, 'name');
    if (!name) return { ok: false, text: '新角色叫什么名字？' };
    if (name.length > MAX_NAME_LENGTH) return { ok: false, text: `名字太长了，最多 ${MAX_NAME_LENGTH} 个字。` };
    if (getDesktopPetSlots(config).some((slot) => slot.personality.name.trim() === name)) {
      return { ok: false, text: `已经有叫“${name}”的角色了，换个名字吧。` };
    }
    if (!canAddDesktopPetSlot(config)) return { ok: false, text: '桌宠数量已经到上限，先删掉一个再新建。' };
    const modelArg = stringArg(args, 'model');
    const preset = modelArg ? resolveModelPreset(config, modelArg) : null;
    if (modelArg && !preset) return { ok: false, text: `模型库里没有“${modelArg}”。现有模型：${modelLibraryText(config)}。` };
    const personalityText = stringArg(args, 'personality').slice(0, MAX_DESCRIPTION_LENGTH);

    const withSlot = addDesktopPetSlot(config);
    const added = getDesktopPetSlots(withSlot).at(-1);
    if (!added || withSlot === config) return { ok: false, text: '没能新建角色。' };
    const placeholderName = added.personality.name;
    const next = applyDesktopPetSlotChanges(withSlot, added.id, {
      personality: {
        ...added.personality,
        name,
        systemInstruction: personalityText
          ? `你现在扮演桌宠“${name}”。${personalityText}请始终保持角色感，回复简短自然，带一点陪伴感。`
          : added.personality.systemInstruction.split(placeholderName).join(name),
      },
    });
    commit(context, preset ? applyDesktopPetModelSelection(next, added.id, { modelType: preset.type, modelUrl: preset.url }) : next);
    return {
      ok: true,
      text: `新角色“${name}”已经出现在桌面上了${preset ? `，用的是“${modelLabel(preset)}”` : '，先用了和主角色一样的模型'}。可以在设置里继续调整人设。`,
    };
  },
  title: '新建桌宠',
};

export const PET_ROSTER_CAPABILITIES: PlatformCapability[] = [listModels, setPetModel, createPet];
