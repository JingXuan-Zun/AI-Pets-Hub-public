const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../electron/persistedConfigImageRules.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = new Set(['CONFIG_ASSET_PROTOCOL_ROOT', 'INLINE_IMAGE_EXTERNALIZE_THRESHOLD_BYTES', 'IMAGE_EXTENSION_BY_MIME_TYPE', 'normalizeSequenceAssetFolderName', 'buildLocalConfigAssetUrl', 'parseInlineImageDataUrl']);
function statements(text) { return ts.createSourceFile('config.cjs', text, 99, true).statements; }
function moved(n) { return names.has(n.name?.text || n.declarationList?.declarations[0]?.name?.text); }
if (old) {
  assert.deepEqual(statements(source).filter(moved).map(n => n.getText()), statements(old).filter(moved).map(n => n.getText()));
  const current = fs.readFileSync(require.resolve('../electron/persistedConfigStore.cjs'), 'utf8');
  assert.deepEqual(statements(current).filter(n => !n.getText().includes("require('./persistedConfigImageRules.cjs')")).map(n => n.getText()), statements(old).filter(n => !moved(n)).map(n => n.getText()));
}
function load(text, baseline) {
  const module = { exports: {} };
  const body = baseline ? statements(text).filter(moved).map(n => n.getText()).join('\n') + '\nmodule.exports = { normalizeSequenceAssetFolderName, buildLocalConfigAssetUrl, parseInlineImageDataUrl };' : text;
  const fixedPath = { resolve: value => path.win32.resolve('C:\\fixture', value) };
  new Function('require', 'module', (baseline ? "const path = require('path');\n" : '') + body)(() => fixedPath, module);
  return module.exports;
}
const api = load(source, false), previous = old && load(old, true);
const hash = crypto.createHash('sha256'); let cases = 0;
function outcome(api, name, args) {
  try { return { value: api[name](...args) }; } catch (error) { return { error: error.name, message: error.message }; }
}
function check(name, args) {
  const actual = outcome(api, name, args);
  if (previous) assert.deepEqual(actual, outcome(previous, name, args));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const value of [undefined, null, false, 0, 15, '', ' . ', ' a/b\\c:*?<>| ', '中文目录', 'a\u0000b\u001fc', 'x'.repeat(90), {}, ['a', 'b']]) {
  for (const fallback of ['fallback', undefined, '']) check('normalizeSequenceAssetFolderName', [value, fallback]);
}
for (const value of ['C:\\images\\a b.png', '\\\\server\\share\\中文 #?.png', '/images/a.png', 'relative.png', '../parent.png', '', undefined, null, 42]) check('buildLocalConfigAssetUrl', [value]);
const values = [undefined, null, 0, {}, '', 'DATA:image/png;base64,YQ==', 'data:Image/png;base64,YQ==', 'data:image/png;base64', 'data:image/png,YQ==', 'data:image/unknown;base64,YQ==', 'data:image/png;base64,', 'data:image/png;base64,!!!!', 'data:image/png;BASE64,Y Q==\n', 'data:image/png;foo;base64,YQ', 'data:image/png;base64,YQ=='];
for (const mime of ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg+xml', 'webp', 'x-icon', 'PNG']) values.push(`data:image/${mime};base64,YQ==`);
for (const length of [65535, 65536, 65537]) values.push('data:image/png;base64,' + 'A'.repeat(length - 22));
for (const value of values) for (const options of [undefined, {}, { force: false }, { force: true }, { force: 'yes' }, null]) check('parseInlineImageDataUrl', [value, options]);
assert.equal(api.normalizeSequenceAssetFolderName(' a/b:?. ', 'fallback'), 'a-b--');
assert.equal(api.normalizeSequenceAssetFolderName('x'.repeat(90), 'fallback').length, 80);
assert.equal(api.buildLocalConfigAssetUrl('\\\\server\\share\\a b.png'), 'desktop-pet-file://local/unc/server/share/a%20b.png');
assert.equal(api.parseInlineImageDataUrl('data:image/png;base64,YQ=='), null);
assert.equal(api.parseInlineImageDataUrl('data:image/png;base64,Y Q==\n', { force: true }).buffer.toString(), 'a');
assert.equal(api.parseInlineImageDataUrl(values.at(-3)), null);
assert.ok(api.parseInlineImageDataUrl(values.at(-2)));
assert.ok(api.parseInlineImageDataUrl(values.at(-1)));
const digest = hash.digest('hex');
if (!old) assert.equal(digest, 'b7e41991080f05678c7fb863ad1cc61b14bdac733cc64b6f40023d58e3f6b07e');
console.log(`Persisted config image rules passed: ${cases} cases; ${digest}`);
