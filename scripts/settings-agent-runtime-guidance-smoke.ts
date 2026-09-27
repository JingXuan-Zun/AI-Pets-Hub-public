import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness';
import {
  DEEPSEEK_HARNESS_CHAT_USAGE,
  getDeepSeekHarnessSetupGaps,
  NATIVE_RUNTIME_CHAT_USAGE,
} from '../src/components/settings/settingsAgentRuntimeGuidance';

assert.match(NATIVE_RUNTIME_CHAT_USAGE, /聊天/u);
assert.match(DEEPSEEK_HARNESS_CHAT_USAGE, /同一个桌宠聊天/u);
assert.match(DEEPSEEK_HARNESS_CHAT_USAGE, /读取/u);
assert.deepEqual(
  getDeepSeekHarnessSetupGaps({ apiKey: '', dshHome: '', workspace: '' }).map((item) => item.id),
  ['workspace', 'dsh-home', 'api-key'],
);
assert.deepEqual(
  getDeepSeekHarnessSetupGaps({ apiKey: 'configured', dshHome: 'D:/harness-home', workspace: 'D:/workspace' }),
  [],
);

const { sectionSource } = readProjectSources({
  sectionSource: 'src/components/settings/SettingsAgentRuntimeSection.tsx',
});
assert.match(sectionSource, /model: settings\.deepseekHarnessModel/u);
assert.match(sectionSource, /DEEPSEEK_HARNESS_CHAT_USAGE/u);
assert.doesNotMatch(sectionSource, />准备受控 Profile</u);

console.log('settings agent runtime guidance smoke passed');
