import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Making a plugin with the character: a skill is written into a draft, installed by the real
// plugin package service, joins the skill library turned on for that character, and updating it
// bumps the version; a tool plugin is refused without the dev assistant.
const require = createRequire(import.meta.url);
const { createPluginPackageService } = require('../electron/pluginPackageService.cjs');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-creation-'));
const service = createPluginPackageService({ trashItem: async () => {}, userDataPath: base });
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  desktopPetShell: {
    plugins: {
      installFolder: (folder: string) => service.installFromFolder(folder),
      list: async () => ({ ok: true, plugins: service.list() }),
      readSkill: async (id: string) => ({ ok: true, text: service.readSkillText(id) }),
      writeDraft: async (id: string, files: Record<string, string>) => service.writeDraft({ files, id }),
    },
  },
  localStorage: { getItem: (key: string) => store.get(key) ?? null, removeItem: (key: string) => store.delete(key), setItem: (key: string, value: string) => store.set(key, value) },
};

const { PLUGIN_CREATION_CAPABILITIES } = await import('../src/plugins/pluginCreationCapabilities');
const createSkill = PLUGIN_CREATION_CAPABILITIES.find((item) => item.id === 'plugins.create_skill')!;
const createTool = PLUGIN_CREATION_CAPABILITIES.find((item) => item.id === 'plugins.create_tool')!;
const config = { personality: { name: '大肥鱼' }, settings: { devAgent: { enabled: false } }, companionPets: [] };
const context = { configRef: { current: config }, onUpdateConfig: () => {}, petId: 'primary' } as never;
const args = {
  description: '陪你练日语口语', examples: '我们练日语吧\n纠正我的发音', id: 'japanese-buddy',
  instructions: '## 怎么陪练\n1. 先问用户今天想练什么场景。\n2. 用简单日语对话，每句后面附中文。\n3. 用户说错时温柔地指出并给正确说法。',
  name: '日语陪练', use_when: '用户想练日语、问日语怎么说时',
};

assert.equal(createSkill.risk, 'change', 'making a plugin asks first');
assert.match(createSkill.describe(args), /日语陪练.*陪你练日语口语[\s\S]*什么时候用：用户想练日语/u, 'the confirmation reads like a feature card');
const made = await createSkill.run(context, args);
assert.equal(made.ok, true, made.text);
assert.match(made.text, /已做好技能插件「日语陪练」v0\.1\.0/u);
const library = JSON.parse(store.get('desktop-pet.agent-external-skills.v1')!);
const skill = library.skills.find((item: { sourceName: string }) => item.sourceName === 'plugin:japanese-buddy');
assert.ok(skill, 'joined the skill library');
assert.match(skill.instructions, /温柔地指出/u);
assert.deepEqual(JSON.parse(store.get('desktop-pet.agent-skill-bindings.v1')!).primary, [skill.id], 'turned on for this character');
assert.equal(service.list()[0].author, '和大肥鱼一起做的');

const updated = await createSkill.run(context, { ...args, instructions: `${args.instructions}\n4. 每次结束总结三个新词。` });
assert.match(updated.text, /已更新技能插件「日语陪练」v0\.1\.1/u);
assert.ok(fs.existsSync(path.join(base, 'plugins', '.previous', 'japanese-buddy')), 'the previous version is kept');
assert.equal(JSON.parse(store.get('desktop-pet.agent-external-skills.v1')!).skills.filter((item: { sourceName: string }) => item.sourceName === 'plugin:japanese-buddy').length, 1, 'updated, not duplicated');

assert.match((await createSkill.run(context, { ...args, id: 'Bad Id' })).text, /英文小写/u);
assert.match((await createSkill.run(context, { ...args, instructions: '太短' })).text, /具体的技能说明/u);
assert.match((await createTool.run(context, { description: '看热门', id: 'bili-hot', name: 'B站热门', tools: 'hot()' })).text, /需要开发助手/u);

fs.rmSync(base, { recursive: true, force: true });
console.log('plugin creation smoke passed');
