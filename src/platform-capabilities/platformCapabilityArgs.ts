import { getDesktopPetSlots, type DesktopPetSlot } from '../multiPetRoster';
import type { PetConfig } from '../types';
import type { PlatformCapabilityArgs } from './platformCapabilityTypes';

export function stringArg(args: PlatformCapabilityArgs, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function booleanArg(args: PlatformCapabilityArgs, key: string): boolean | null {
  const value = args[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'on' || value === '开' || value === '开启') return true;
  if (value === 'false' || value === 'off' || value === '关' || value === '关闭') return false;
  return null;
}

export function numberArg(args: PlatformCapabilityArgs, key: string): number | null {
  const value = typeof args[key] === 'string' ? Number(args[key]) : args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The pet named in `pet` (name or slot id), or the one the user is talking to. */
export function resolvePetSlot(config: PetConfig, petArg: string, fallbackPetId?: string | null): DesktopPetSlot | null {
  const slots = getDesktopPetSlots(config);
  const wanted = petArg.trim().toLowerCase();
  if (wanted) {
    return slots.find((slot) => slot.id.toLowerCase() === wanted)
      ?? slots.find((slot) => slot.personality.name.trim().toLowerCase() === wanted)
      ?? slots.find((slot) => slot.personality.name.trim().toLowerCase().includes(wanted))
      ?? null;
  }
  return slots.find((slot) => slot.id === fallbackPetId) ?? slots[0] ?? null;
}

export function petListText(config: PetConfig) {
  return getDesktopPetSlots(config).map((slot) => slot.personality.name).join('、');
}
