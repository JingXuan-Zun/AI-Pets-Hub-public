import { strict as assert } from 'node:assert';
import { resolveStoredAssetDisplayPath } from '../src/components/settings/settingsStoredAssetPath.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  modelCardsSource,
  videoBindingsSource,
} = readProjectSources({
  modelCardsSource: 'src/components/settings/SettingsModelCards.tsx',
  videoBindingsSource: 'src/components/settings/SettingsVideoItemBindingsSection.tsx',
});

assert.equal(
  resolveStoredAssetDisplayPath('desktop-pet-file://local/D:/AI%20Desktop%20Pet/d1/video/idle.webm'),
  'D:\\AI Desktop Pet\\d1\\video\\idle.webm',
);
assert.equal(
  resolveStoredAssetDisplayPath('desktop-pet-file://local/unc/server/share/idle.webm'),
  '\\\\server\\share\\idle.webm',
);
assert.equal(
  resolveStoredAssetDisplayPath('https://example.com/idle.webm'),
  'https://example.com/idle.webm',
);
assert.match(modelCardsSource, /已保存地址/u);
assert.match(modelCardsSource, /resolveStoredAssetDisplayPath/u);
assert.match(videoBindingsSource, /已保存地址/u);
assert.match(videoBindingsSource, /resolveStoredAssetDisplayPath/u);

console.log('settings video asset path smoke passed');
