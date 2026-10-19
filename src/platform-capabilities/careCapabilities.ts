import { applyFoodConsumedStats, isPetExhausted, isPetHungry } from '../components/pet/petStatsMath';
import { applyDesktopPetSlotChanges, getDesktopPetSlots, type DesktopPetSlot } from '../multiPetRoster';
import { petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability } from './platformCapabilityTypes';

// Looking after the pets from conversation: how hungry and tired they are, and feeding them
// (“给你喂块蛋糕”). Feeding by chat gives the same as one dragged food item, so hunger
// still matters; a pet that is not hungry turns it down.

const GROUP = '照顾桌宠';
const NOT_HUNGRY_BELOW = 20;

function statusLine(slot: DesktopPetSlot) {
  const { affection, fatigue, hunger } = slot.stats;
  const notes = [
    isPetHungry(hunger) ? '饿了' : hunger < NOT_HUNGRY_BELOW ? '很饱' : '',
    isPetExhausted(fatigue) ? '累坏了' : fatigue >= 70 ? '有点累' : '',
  ].filter(Boolean);
  return `${slot.personality.name}：饥饿 ${Math.round(hunger)}，疲劳 ${Math.round(fatigue)}，亲密度 ${Math.round(affection)}${notes.length ? `（${notes.join('，')}）` : ''}`;
}

const petStatus: PlatformCapability = {
  args: [{ description: '哪个角色（名字），不写就列出全部启用的', key: 'pet', type: 'string' }],
  description: 'How hungry, tired and close each pet is (0–100; higher hunger/fatigue is worse). Use before feeding or when asked “你饿不饿”.',
  describe: () => '查看桌宠状态',
  group: GROUP,
  id: 'pets.status',
  risk: 'read',
  run: ({ configRef }, args) => {
    const config = configRef.current;
    const wanted = stringArg(args, 'pet');
    const slots = wanted ? [resolvePetSlot(config, wanted)].filter((slot): slot is DesktopPetSlot => Boolean(slot)) : getDesktopPetSlots(config).filter((slot) => slot.enabled);
    if (!slots.length) return { ok: false, text: `没找到这个角色。现有角色：${petListText(config)}。` };
    return { ok: true, text: slots.map(statusLine).join('\n') };
  },
  title: '查看桌宠状态',
};

const feedPet: PlatformCapability = {
  args: [
    { description: '喂哪个角色（名字），不写就是当前在聊的角色', key: 'pet', type: 'string' },
    { description: '喂的东西，例如“蛋糕”（可选，只用来说话）', key: 'food', type: 'string' },
  ],
  description: 'Feed a pet once (“给你喂块蛋糕”“喂一下高冷小桃”). Lowers hunger like one food item; refused when the pet is already full.',
  describe: (args) => `喂${stringArg(args, 'pet') || '角色'}${stringArg(args, 'food') ? `吃${stringArg(args, 'food')}` : ''}`,
  group: GROUP,
  id: 'pets.feed',
  risk: 'personal',
  run: (context, args) => {
    const config = context.configRef.current;
    const slot = resolvePetSlot(config, stringArg(args, 'pet'), context.petId);
    if (!slot) return { ok: false, text: `没找到这个角色。现有角色：${petListText(config)}。` };
    if (slot.stats.hunger < NOT_HUNGRY_BELOW) return { ok: false, text: `${slot.personality.name} 现在很饱（饥饿 ${Math.round(slot.stats.hunger)}），吃不下了。` };
    const stats = applyFoodConsumedStats(slot.stats);
    const next = applyDesktopPetSlotChanges(config, slot.id, { stats });
    context.configRef.current = next;
    context.onUpdateConfig(next, { persist: true });
    const food = stringArg(args, 'food');
    return { ok: true, text: `${slot.personality.name} 吃了${food || '东西'}：饥饿 ${Math.round(slot.stats.hunger)} → ${Math.round(stats.hunger)}，亲密度 ${Math.round(slot.stats.affection)} → ${Math.round(stats.affection)}。` };
  },
  title: '喂桌宠',
};

export const CARE_CAPABILITIES: PlatformCapability[] = [petStatus, feedPet];
