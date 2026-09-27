import {
  DEFAULT_SETTINGS_RUNTIME_LOG_LEVELS,
  DEFAULT_SETTINGS_RUNTIME_LOG_SOURCES,
  filterSettingsRuntimeLogs,
  parseSettingsRuntimeLog,
} from '../src/components/settings/settingsWorkspaceLogFilter';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mcpError = parseSettingsRuntimeLog('[12:00:00][frontend][设置窗/MCP] MCP request failed: timeout');
assert(mcpError.level === 'error', 'MCP request failed should be parsed as error');
assert(mcpError.source === 'mcp', 'MCP scope should be parsed as MCP');

const voiceWarning = parseSettingsRuntimeLog('[12:00:01][backend][语音] 音频设备警告');
assert(voiceWarning.level === 'warning', 'warning wording should be parsed as warning');
assert(voiceWarning.source === 'voice', '语音 scope should be parsed as voice');

const regularRuntime = parseSettingsRuntimeLog('[12:00:02][frontend][主界面/runtime] renderer runtime logging ready');
assert(regularRuntime.level === 'info', 'unmarked runtime logs should be parsed as info');
assert(regularRuntime.source === 'runtime', 'runtime scope should be parsed as runtime');

const visible = filterSettingsRuntimeLogs(
  [
    '[12:00:00][frontend][设置窗/MCP] MCP request failed: timeout',
    '[12:00:01][backend][语音] 音频设备警告',
    '[12:00:02][frontend][主界面/runtime] renderer runtime logging ready',
  ],
  ['warning', 'error'],
  ['mcp', 'voice'],
);
assert(visible.length === 2, 'level and source filters should both control visible log entries');
assert(DEFAULT_SETTINGS_RUNTIME_LOG_LEVELS.join(',') === 'warning,error,critical', 'default should focus on actionable logs');
assert(DEFAULT_SETTINGS_RUNTIME_LOG_SOURCES.length === 7, 'all known sources should be selected initially');

console.log('settings workspace log filtering smoke passed');
