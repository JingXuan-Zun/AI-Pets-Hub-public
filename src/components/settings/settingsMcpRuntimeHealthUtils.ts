import { type SettingsMcpServerRuntimeHealth } from './settingsMcpHealthSummary';

export function indexMcpServerHealth(healthItems?: DesktopPetMcpServerHealthLike[]) {
  return Object.fromEntries(
    (healthItems ?? [])
      .filter((item) => item.serverId)
      .map((item) => [item.serverId, item]),
  ) as Record<string, SettingsMcpServerRuntimeHealth>;
}
