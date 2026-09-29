export type SettingsMcpSoakReadinessServerStatus =
  | 'blocked'
  | 'fixture'
  | 'ready'
  | 'reference';

export interface SettingsMcpSoakReadinessServerStatusInput {
  fakeFixture?: boolean;
  readyForRealSoak?: boolean;
  referenceServer?: boolean;
}

export function getSettingsMcpSoakReadinessServerStatus(
  server: SettingsMcpSoakReadinessServerStatusInput,
): SettingsMcpSoakReadinessServerStatus {
  if (server.readyForRealSoak) {
    return 'ready';
  }

  if (server.fakeFixture) {
    return 'fixture';
  }

  return server.referenceServer ? 'reference' : 'blocked';
}
