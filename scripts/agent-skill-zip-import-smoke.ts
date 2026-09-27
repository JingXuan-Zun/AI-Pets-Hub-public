import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { MAX_AGENT_SKILL_ARCHIVE_BYTES, parseAgentSkillZip, readAgentSkillImportFile } from '../src/agent/agentSkillArchiveImport';

const zip = zipSync({
  'download-main/skills/video/SKILL.md': strToU8('---\nname: video-prompt\ndescription: Video prompts\n---\n# Video\nRead references/style.md'),
  'download-main/skills/video/references/style.md': strToU8('Always include sound cues.'),
  'download-main/skills/writing/SKILL.md': strToU8('---\nname: writing\ndescription: Writing\n---\n# Writing\nWrite clearly.'),
  'download-main/README.md': strToU8('Repository readme'),
  '../escape/SKILL.md': strToU8('# Invalid'),
  'download-main/skills/video/scripts/run.py': strToU8('raise Exception("must not run")'),
});
const result = parseAgentSkillZip(zip, 'download.zip');
assert.deepEqual(result.skills.map((skill) => skill.id), ['external.video-prompt', 'external.writing']);
assert.match(result.skills[0].instructions, /Always include sound cues/);
assert.doesNotMatch(result.skills[0].instructions, /Repository readme|Write clearly|must not run/);
assert.throws(() => parseAgentSkillZip(new Uint8Array([1, 2, 3]), 'broken.zip'));
assert.throws(() => parseAgentSkillZip(zipSync({ 'README.md': strToU8('readme') }), 'empty.zip'), /SKILL.md/);
assert.equal(MAX_AGENT_SKILL_ARCHIVE_BYTES, 200 * 1024 * 1024);
const archiveAtLimit = await readAgentSkillImportFile({
  name: 'at-limit.zip',
  size: MAX_AGENT_SKILL_ARCHIVE_BYTES,
  arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
  text: async () => '',
});
assert.equal(archiveAtLimit.skills.length, 2);
let oversizedArchiveWasRead = false;
await assert.rejects(() => readAgentSkillImportFile({
  name: 'too-large.zip',
  size: MAX_AGENT_SKILL_ARCHIVE_BYTES + 1,
  arrayBuffer: async () => { oversizedArchiveWasRead = true; return new ArrayBuffer(0); },
  text: async () => '',
}), /200 MB/);
assert.equal(oversizedArchiveWasRead, false);
console.log('ZIP multi-skill discovery, references, invalid archives and path filtering passed');

const { installAgentImportedSkills } = await import('../src/agent/agentSkillImportInstallation');
const saved = new Map<string, string>();
const storage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => { saved.set(key, value); },
  removeItem: (key: string) => { saved.delete(key); },
};
const installed = installAgentImportedSkills(storage, 'primary', result);
assert.equal(installed.library.skills.length, 2);
assert.deepEqual(installed.bindings.primary, result.skills.map((skill) => skill.id));
assert.equal(installAgentImportedSkills(storage, 'other', result).library.skills.length, 2);
assert.equal(JSON.parse(saved.get('desktop-pet.agent-skill-bindings.v1')!).primary.length, 2);
const before = new Map(saved);
let writes = 0;
assert.throws(() => installAgentImportedSkills({ ...storage, setItem: (key, value) => {
  if (++writes === 2) throw new Error('simulated quota failure');
  storage.setItem(key, value);
} }, 'third', result), /quota/);
assert.deepEqual(saved, before, 'a failed bindings write must roll back the library');
console.log('ZIP installation, role enabling, idempotency and failed-write rollback passed');

const mixed = parseAgentSkillZip(zipSync({
  'usable/SKILL.md': strToU8('---\nname: usable\n---\n# Usable\nWrite a poem.'),
  'scripted/SKILL.md': strToU8('---\nname: scripted\n---\n# Scripted\nRun scripts/run.py to complete this skill.'),
  'scripted/scripts/run.py': strToU8('print("not executed")'),
  'nested/SKILL.md': strToU8('---\nname: parent\n---\n# Parent\nParent instructions'),
  'nested/child/SKILL.md': strToU8('---\nname: child\n---\n# Child\nChild instructions'),
  'nested/child/references/note.md': strToU8('Child-specific reference'),
}), 'mixed.zip');
assert.equal(mixed.skills.some((skill) => skill.id === 'external.scripted'), false);
assert.ok(mixed.warnings.some((warning) => warning.includes('scripts/run.py')));
assert.match(mixed.skills.find((skill) => skill.id === 'external.child')!.instructions, /Child-specific reference/);
assert.doesNotMatch(mixed.skills.find((skill) => skill.id === 'external.parent')!.instructions, /Child-specific reference/);
console.log('unsupported dependencies and nested reference ownership passed');
