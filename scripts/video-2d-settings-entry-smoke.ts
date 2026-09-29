import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

const { modelTabSource, modelCardsSource, videoBindingsSource } = readProjectSources({
  modelTabSource: 'src/components/settings/SettingsModelTab.tsx',
  modelCardsSource: 'src/components/settings/SettingsModelCards.tsx',
  videoBindingsSource: 'src/components/settings/SettingsVideoItemBindingsSection.tsx',
});

assert.match(videoBindingsSource, /上传自定义道具/u);
assert.match(videoBindingsSource, /选择视频文件夹/u);
assert.match(videoBindingsSource, /已绑定/u);
assert.match(videoBindingsSource, /自定义动作/u);
assert.match(videoBindingsSource, /动作名称/u);
assert.match(modelCardsSource, /交给角色：自定义动作/u);
assert.match(modelCardsSource, /例如：抚摸/u);
assert.ok(
  modelTabSource.indexOf('<SettingsVideoItemBindingsSection') <
  modelTabSource.indexOf('<SettingsModelPresetSection'),
  '视频道具设置应出现在长模型库之前',
);
console.log('2D 视频自定义道具设置入口 smoke passed');
