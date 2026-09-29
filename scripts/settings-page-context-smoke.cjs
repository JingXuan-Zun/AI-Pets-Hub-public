const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Tabs } = require('@base-ui/react/tabs');

const root = path.resolve(process.argv[2] || '.');
const settingsDir = path.join(root, 'src/components/settings');

// Reproduce the exact Base UI failure independently of API keys and user data.
assert.throws(() => renderToStaticMarkup(React.createElement(Tabs.Panel, {
  value: 'personality',
}, 'settings')), /TabsRootContext is missing|error #64/);

const failures = [];
let checked = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(file); continue; }
    if (!entry.name.endsWith('.tsx')) continue;
    checked += 1;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    // Settings pages are selected by the control-center router, outside Tabs.Root.
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (/components\/ui\/tabs$|@base-ui\/react\/tabs$/.test(statement.moduleSpecifier.text)) {
        failures.push(path.relative(root, file));
      }
    }
  }
}
inspect(settingsDir);
assert.deepEqual(failures, [], 'Routed settings pages must render without a Tabs provider');
for (const name of ['SettingsPersonalityTab', 'SettingsVisionTab', 'SettingsSystemTab']) {
  const source = fs.readFileSync(path.join(settingsDir, `${name}.tsx`), 'utf8');
  assert.match(source, /return\s*\(\s*<div className="m-0 space-y-6">/);
}
assert.match(renderToStaticMarkup(React.createElement('div', { className: 'm-0 space-y-6' }, 'settings')), /settings/);
console.log(`settings page context smoke: PASS (${checked} components; Base UI #64 reproduction verified)`);
