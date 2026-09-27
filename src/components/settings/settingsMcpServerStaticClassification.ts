import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

const PLACEHOLDER_PATTERN = /\b(replace-me|example|vendor|your-|placeholder)\b|C:\\path\\to\\|\/path\/to\//iu;
const FIXTURE_SERVER_PATTERN = /scripts\/fixtures\/.*mcp.*server/iu;
const REFERENCE_SERVER_PATTERN = /scripts\/reference-mcp-stdio-server\.cjs/iu;

export function createSettingsMcpServerLaunchText(server: SettingsMcpServerDraft) {
  return [server.command, server.argsText].join(' ').replace(/\\/g, '/');
}

export function hasSettingsMcpServerPlaceholderValues(server: SettingsMcpServerDraft) {
  return PLACEHOLDER_PATTERN.test([
    server.command,
    server.cwd,
    server.argsText,
    server.envJson,
  ].join(' '));
}

export function isSettingsMcpFixtureServer(server: SettingsMcpServerDraft) {
  return FIXTURE_SERVER_PATTERN.test(createSettingsMcpServerLaunchText(server));
}

export function isSettingsMcpReferenceServer(server: SettingsMcpServerDraft) {
  return REFERENCE_SERVER_PATTERN.test(createSettingsMcpServerLaunchText(server));
}
