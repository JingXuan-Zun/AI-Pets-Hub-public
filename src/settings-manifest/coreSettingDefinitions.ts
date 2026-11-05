import { activeApiProfile, applyApiProfile, readApiProfiles } from '../settings/apiProfiles';
import { registerSettings } from './settingsManifest';

// App settings (not from a plugin) the character may change through the settings manifest.

registerSettings([
  {
    choices: (config) => readApiProfiles(config.settings).map((profile) => ({ label: profile.name, value: profile.id })),
    endsReply: true,
    forModel: '“换到备用模型”“用 Gemini 那个”“DeepSeek 好像挂了换一个”：切换到用户存好的另一套模型接口配置（从下一句话起生效）。',
    group: '模型',
    id: 'ai.apiProfile',
    kind: 'choice',
    label: '接口配置',
    pageId: 'ai-model',
    read: (config) => activeApiProfile(config.settings)?.id ?? '',
    risk: 'personal',
    write: (config, value) => {
      const profile = readApiProfiles(config.settings).find((item) => item.id === value);
      return profile ? { ...config, settings: { ...config.settings, ...applyApiProfile(config.settings, profile) } } : config;
    },
  },
]);
