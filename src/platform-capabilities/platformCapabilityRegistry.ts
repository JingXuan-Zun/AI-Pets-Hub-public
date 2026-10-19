import { PRODUCTIVITY_CAPABILITIES } from '../productivity/productivityCapabilities';
import { BUILTIN_PLATFORM_CAPABILITIES } from './builtinPlatformCapabilities';
import { CARE_CAPABILITIES } from './careCapabilities';
import { DATA_CAPABILITIES } from './dataCapabilities';
import { DISPLAY_SETTINGS_CAPABILITIES } from './displaySettingsCapabilities';
import { IMAGE_CAPABILITIES } from './imageCapabilities';
import { KNOWLEDGE_CAPABILITIES } from './knowledgeCapabilities';
import { PET_ROSTER_CAPABILITIES } from './petRosterCapabilities';
import { WEATHER_CAPABILITIES } from './weatherCapabilities';
import type {
  PlatformCapability,
  PlatformCapabilityArgs,
  PlatformCapabilityContext,
  PlatformCapabilityResult,
} from './platformCapabilityTypes';

const capabilities = new Map<string, PlatformCapability>(
  [...BUILTIN_PLATFORM_CAPABILITIES, ...CARE_CAPABILITIES, ...DATA_CAPABILITIES, ...DISPLAY_SETTINGS_CAPABILITIES, ...IMAGE_CAPABILITIES, ...KNOWLEDGE_CAPABILITIES, ...PET_ROSTER_CAPABILITIES, ...PRODUCTIVITY_CAPABILITIES, ...WEATHER_CAPABILITIES].map((capability) => [capability.id, capability]),
);

/** Plugins add their capabilities here; ids must be unique. */
export function registerPlatformCapability(capability: PlatformCapability) {
  if (capabilities.has(capability.id)) throw new Error(`Platform capability already registered: ${capability.id}`);
  capabilities.set(capability.id, capability);
}

export function listPlatformCapabilities() {
  return [...capabilities.values()];
}

export function getPlatformCapability(id: string) {
  return capabilities.get(id.trim()) ?? null;
}

export function readPlatformCapabilityCall(input: { args?: PlatformCapabilityArgs; capability?: string } | undefined) {
  const id = typeof input?.capability === 'string' ? input.capability.trim() : '';
  const args = input?.args && typeof input.args === 'object' && !Array.isArray(input.args) ? input.args : {};
  return { args, capability: id ? getPlatformCapability(id) : null, id };
}

/** One line per capability for planner and router prompts. */
export function formatPlatformCapabilityCatalog() {
  return listPlatformCapabilities().map((capability) => {
    const args = capability.args.map((arg) => `${arg.key}${arg.required ? '' : '?'}:${arg.enumValues?.join('|') ?? arg.type}`).join(', ');
    return `${capability.id}(${args}) [${capability.risk}] ${capability.description}`;
  });
}

export async function runPlatformCapability(
  context: PlatformCapabilityContext,
  input: { args?: PlatformCapabilityArgs; capability?: string } | undefined,
): Promise<PlatformCapabilityResult & { capabilityId: string }> {
  const { args, capability, id } = readPlatformCapabilityCall(input);
  if (!capability) {
    return {
      capabilityId: id,
      ok: false,
      text: `没有叫“${id || '（空）'}”的平台能力。可用的有：${listPlatformCapabilities().map((entry) => entry.id).join('、')}。`,
    };
  }
  try {
    return { ...(await capability.run(context, args)), capabilityId: capability.id };
  } catch (error) {
    return { capabilityId: capability.id, ok: false, text: `${capability.title}失败：${error instanceof Error ? error.message : String(error)}` };
  }
}
