import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { projectPath } from './smokeTestHarness.ts';
import {
  applySettingsMcpFieldPolicyDraft,
  collectSettingsMcpSchemaFields,
  getSettingsMcpFieldPolicyDraft,
} from '../src/components/settings/settingsMcpFieldPolicyUtils';

const tool = { name: 'resource_action', serverId: 'schema-server' };
const fields = collectSettingsMcpSchemaFields({
  properties: {
    nested: { properties: { token: { type: 'string' } }, type: 'object' },
    operation: { enum: ['read', 'delete'], type: 'string' },
  },
  type: 'object',
});
assert.deepEqual(fields.map((field) => field.path), ['/nested', '/nested/token', '/operation']);
const boundedFields = collectSettingsMcpSchemaFields({
  properties: Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`field-${index}`, { type: 'string' }])),
  type: 'object',
});
assert.equal(boundedFields.length, 64);
const depthFields = collectSettingsMcpSchemaFields({
  properties: {
    one: { properties: {
      two: { properties: {
        three: { properties: { four: { type: 'string' } }, type: 'object' },
      }, type: 'object' },
    }, type: 'object' },
  },
  type: 'object',
});
assert.deepEqual(depthFields.map((field) => field.path), ['/one', '/one/two', '/one/two/three']);
const complexFields = collectSettingsMcpSchemaFields({
  $defs: {
    credentials: {
      properties: { token: { type: 'string' } },
      type: 'object',
    },
  },
  allOf: [
    { properties: { credentials: { $ref: '#/$defs/credentials' } } },
    {
      properties: {
        choice: {
          oneOf: [
            { properties: { left: { type: 'boolean' } }, type: 'object' },
            { properties: { right: { type: 'number' } }, type: 'object' },
          ],
        },
        tuple: {
          prefixItems: [
            { type: 'string' },
            { properties: { id: { type: 'string' } }, type: 'object' },
          ],
          type: 'array',
        },
        scalarList: { items: { type: 'string' }, type: 'array' },
        objectList: {
          items: { properties: { id: { type: 'string' } }, type: 'object' },
          type: 'array',
        },
      },
    },
  ],
  type: 'object',
});
const complexByPath = new Map(complexFields.map((field) => [field.path, field]));
for (const path of [
  '/choice',
  '/choice/left',
  '/choice/right',
  '/credentials',
  '/credentials/token',
  '/objectList',
  '/scalarList',
  '/tuple',
  '/tuple/0',
  '/tuple/1',
  '/tuple/1/id',
]) assert.equal(complexByPath.has(path), true, `missing complex schema field ${path}`);
assert.equal(complexByPath.get('/credentials')?.valuePolicySupported, false);
assert.equal(complexByPath.get('/tuple')?.valuePolicySupported, false);
assert.equal(complexByPath.get('/tuple/0')?.valuePolicySupported, true);
assert.equal(complexByPath.get('/tuple/1')?.valuePolicySupported, false);
assert.equal(complexByPath.get('/scalarList')?.arrayItemValuePolicySupported, true);
assert.equal(complexByPath.get('/scalarList')?.valuePolicySupported, false);
assert.equal(complexByPath.get('/objectList')?.arrayItemValuePolicySupported, false);

const denied = applySettingsMcpFieldPolicyDraft('{"servers":[]}', tool, '/operation', {
  mode: 'deny-values',
  valuesText: '["delete"]',
});
assert.equal(denied.error, null);
assert.deepEqual(getSettingsMcpFieldPolicyDraft(denied.rawText, tool, '/operation'), {
  mode: 'deny-values',
  valuesText: '["delete"]',
});
const deniedArrayValues = applySettingsMcpFieldPolicyDraft(denied.rawText, tool, '/items', {
  mode: 'deny-array-values',
  valuesText: '["blocked"]',
});
assert.equal(deniedArrayValues.error, null);
assert.deepEqual(getSettingsMcpFieldPolicyDraft(deniedArrayValues.rawText, tool, '/items'), {
  mode: 'deny-array-values',
  valuesText: '["blocked"]',
});
assert.equal(deniedArrayValues.rawText.includes('"mode": "deny-items"'), true);
const removed = applySettingsMcpFieldPolicyDraft(denied.rawText, tool, '/operation', {
  mode: 'inherit',
  valuesText: '[]',
});
assert.equal(removed.error, null);
assert.equal(removed.rawText.includes('/operation'), false);
assert.match(
  applySettingsMcpFieldPolicyDraft('{"servers":[]}', tool, '/operation', {
    mode: 'allow-values',
    valuesText: '[]',
  }).error ?? '',
  /non-empty JSON array/u,
);

const panelSource = fs.readFileSync(projectPath('src/components/settings/SettingsMcpFieldPolicyTable.tsx'), 'utf8');
const operationalSource = fs.readFileSync(projectPath('src/components/settings/SettingsMcpOperationalPanels.tsx'), 'utf8');
assert.match(panelSource, /deny-field/u);
assert.match(panelSource, /deny-values/u);
assert.match(panelSource, /allow-values/u);
assert.match(panelSource, /deny-array-values/u);
assert.match(panelSource, /allow-array-values/u);
assert.match(panelSource, /disabled=\{!field\.valuePolicySupported\}/u);
assert.match(panelSource, /disabled=\{!field\.arrayItemValuePolicySupported\}/u);
assert.match(panelSource, /onClick=\{\(\) => removeDraft\(field\.path\)\}/u);
assert.match(operationalSource, /SettingsMcpFieldPolicyTable/u);

console.log('agent MCP field policy UI smoke passed');
