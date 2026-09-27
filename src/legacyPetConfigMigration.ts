export interface LegacyAgentRuntimeSettingsMigration {
  activeSettings: Record<string, unknown>;
  legacyAgentRuntimeMode: unknown;
}

export function migrateLegacyAgentRuntimeSettings(
  settings: Record<string, unknown>,
): LegacyAgentRuntimeSettingsMigration {
  const {
    agentRuntimeMode: legacyAgentRuntimeMode,
    ...activeSettings
  } = settings;
  return {
    activeSettings,
    legacyAgentRuntimeMode,
  };
}
