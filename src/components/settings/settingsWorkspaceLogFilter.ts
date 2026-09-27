export type SettingsRuntimeLogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type SettingsRuntimeLogSource = 'core' | 'runtime' | 'agent' | 'plugin' | 'mcp' | 'vision' | 'voice';

export interface SettingsRuntimeLogOption<TValue extends string> {
  label: string;
  value: TValue;
}

export interface ParsedSettingsRuntimeLog {
  level: SettingsRuntimeLogLevel;
  line: string;
  source: SettingsRuntimeLogSource;
}

export const SETTINGS_RUNTIME_LOG_LEVEL_OPTIONS: readonly SettingsRuntimeLogOption<SettingsRuntimeLogLevel>[] = [
  { label: 'DEBUG', value: 'debug' },
  { label: 'INFO', value: 'info' },
  { label: 'WARNING', value: 'warning' },
  { label: 'ERROR', value: 'error' },
  { label: 'CRITICAL', value: 'critical' },
];

export const SETTINGS_RUNTIME_LOG_SOURCE_OPTIONS: readonly SettingsRuntimeLogOption<SettingsRuntimeLogSource>[] = [
  { label: 'Core', value: 'core' },
  { label: 'Runtime', value: 'runtime' },
  { label: 'Agent', value: 'agent' },
  { label: '插件', value: 'plugin' },
  { label: 'MCP', value: 'mcp' },
  { label: '视觉', value: 'vision' },
  { label: '语音', value: 'voice' },
];

export const DEFAULT_SETTINGS_RUNTIME_LOG_LEVELS: readonly SettingsRuntimeLogLevel[] = ['warning', 'error', 'critical'];
export const DEFAULT_SETTINGS_RUNTIME_LOG_SOURCES: readonly SettingsRuntimeLogSource[] = SETTINGS_RUNTIME_LOG_SOURCE_OPTIONS.map((option) => option.value);

const CRITICAL_PATTERN = /\b(?:critical|fatal|panic)\b|严重|致命|崩溃/i;
const ERROR_PATTERN = /\b(?:error|failed|failure|exception|reject(?:ed|ion)?)\b|错误|失败|异常/i;
const WARNING_PATTERN = /\b(?:warn|warning|blocked)\b|警告|阻止/i;
const DEBUG_PATTERN = /\b(?:debug|trace)\b|调试/i;

function resolveLogLevel(line: string): SettingsRuntimeLogLevel {
  if (CRITICAL_PATTERN.test(line)) return 'critical';
  if (ERROR_PATTERN.test(line)) return 'error';
  if (WARNING_PATTERN.test(line)) return 'warning';
  if (DEBUG_PATTERN.test(line)) return 'debug';
  return 'info';
}

function resolveLogSource(line: string): SettingsRuntimeLogSource {
  const normalizedLine = line.toLowerCase();
  if (/\bmcp\b/.test(normalizedLine)) return 'mcp';
  if (/\b(?:agent|skill)\b|插件/.test(normalizedLine)) {
    return normalizedLine.includes('skill') || normalizedLine.includes('插件') ? 'plugin' : 'agent';
  }
  if (/\b(?:voice|speech|tts|stt|audio)\b|语音|音频/.test(normalizedLine)) return 'voice';
  if (/\b(?:vision|visual|render|live2d|vrm|vrma|unity|three)\b|视觉|渲染|模型/.test(normalizedLine)) return 'vision';
  if (/\b(?:runtime|ipc)\b|运行|事件/.test(normalizedLine)) return 'runtime';
  return 'core';
}

export function parseSettingsRuntimeLog(line: string): ParsedSettingsRuntimeLog {
  return { level: resolveLogLevel(line), line, source: resolveLogSource(line) };
}

export function filterSettingsRuntimeLogs(
  lines: readonly string[],
  selectedLevels: readonly SettingsRuntimeLogLevel[],
  selectedSources: readonly SettingsRuntimeLogSource[],
): ParsedSettingsRuntimeLog[] {
  const levelSet = new Set(selectedLevels);
  const sourceSet = new Set(selectedSources);
  return lines.map(parseSettingsRuntimeLog).filter((entry) => levelSet.has(entry.level) && sourceSet.has(entry.source));
}
