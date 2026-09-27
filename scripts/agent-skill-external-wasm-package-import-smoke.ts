import { strict as assert } from 'node:assert';
import {
  createAgentSkillPackageExport,
  parseAgentSkillPackageImportJson,
} from '../src/agent';

const packageExport = createAgentSkillPackageExport('character.animation')!;
const preview = parseAgentSkillPackageImportJson(JSON.stringify({
  ...packageExport,
  runtime: {
    capabilityEntrypoint: 'resume',
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: 'AGFzbQ==',
  },
}));

assert.equal(preview.ok, true);
assert.equal(preview.package?.runtime?.kind, 'wasm-pure-i32-v1');
assert.equal(preview.package?.runtime?.capabilityEntrypoint, 'resume');
assert.equal(preview.package?.runtime?.entrypoint, 'run');
assert.equal(preview.package?.runtime?.moduleBase64, 'AGFzbQ==');

const jsonPreview = parseAgentSkillPackageImportJson(JSON.stringify({
  ...packageExport,
  runtime: {
    capabilityEntrypoint: 'resume',
    entrypoint: 'run',
    kind: 'wasm-pure-json-v1',
    moduleBase64: 'AGFzbQ==',
  },
}));

assert.equal(jsonPreview.ok, true);
assert.equal(jsonPreview.package?.runtime?.kind, 'wasm-pure-json-v1');
assert.equal(jsonPreview.package?.runtime?.capabilityEntrypoint, 'resume');
assert.equal(jsonPreview.package?.runtime?.entrypoint, 'run');
assert.equal(jsonPreview.package?.runtime?.moduleBase64, 'AGFzbQ==');

console.log('agent skill external WASM package import smoke passed');
