import { isPluginEnabledForPet } from './pluginRoleAccess';
import comfyUiPlugin from './builtin/comfyui.plugin.json';
import devAgentPlugin from './builtin/dev-agent.plugin.json';

// Platform capabilities that belong to a built-in plugin. A character the plugin is turned off
// for neither sees nor can run them. Kept apart from the catalog so the capability registry
// can import it without pulling in the MCP and skill modules.
const CAPABILITY_PLUGINS: Record<string, string> = Object.fromEntries(
  [comfyUiPlugin, devAgentPlugin].flatMap((plugin) => (plugin.capabilityIds ?? []).map((capabilityId) => [capabilityId, `native:${plugin.id}`])),
);

export function isCapabilityEnabledForPet(capabilityId: string, petId: string | null | undefined) {
  const pluginId = CAPABILITY_PLUGINS[capabilityId];
  return !pluginId || isPluginEnabledForPet(pluginId, petId, true);
}

export function isMcpServerEnabledForPet(serverId: string, petId: string | null | undefined) {
  return isPluginEnabledForPet(`mcp:${serverId}`, petId, true);
}
