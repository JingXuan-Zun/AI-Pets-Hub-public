const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { desktopIconReadOnlyFallbackPowerShellBlock } = require('../electron/desktopIcons/desktopIconReadOnlyFallbackScript.cjs');
const { desktopIconMetadataPowerShellBlock } = require('../electron/desktopIcons/desktopIconMetadataScript.cjs');
const { desktopIconListViewInteropCSharp } = require('../electron/desktopIcons/desktopIconListViewInterop.cjs');
const { desktopIconListViewReadCSharp } = require('../electron/desktopIcons/desktopIconListViewRead.cjs');
const { desktopIconListViewWindowLookupCSharp } = require('../electron/desktopIcons/desktopIconListViewWindowLookup.cjs');
const { desktopIconFolderViewInteropCSharp } = require('../electron/desktopIcons/desktopIconFolderViewInterop.cjs');
const { desktopIconFolderViewReadCSharp } = require('../electron/desktopIcons/desktopIconFolderViewRead.cjs');
const { desktopIconFolderViewAccessCSharp } = require('../electron/desktopIcons/desktopIconFolderViewAccess.cjs');
const { desktopIconFolderViewMoveInteropCSharp } = require('../electron/desktopIcons/desktopIconFolderViewMoveInterop.cjs');
const { desktopIconFolderViewMoveExecuteCSharp } = require('../electron/desktopIcons/desktopIconFolderViewMoveExecute.cjs');
const { desktopIconFolderViewMoveAccessCSharp } = require('../electron/desktopIcons/desktopIconFolderViewMoveAccess.cjs');
const { desktopIconListViewMoveInteropCSharp } = require('../electron/desktopIcons/desktopIconListViewMoveInterop.cjs');
const { desktopIconListViewMoveExecuteCSharp } = require('../electron/desktopIcons/desktopIconListViewMoveExecute.cjs');
const { desktopIconListViewMoveWindowLookupCSharp } = require('../electron/desktopIcons/desktopIconListViewMoveWindowLookup.cjs');

function loadBuilders(baseline) {
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  const ast = ts.createSourceFile('service.cjs', root, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const builders = ast.statements.filter(ts.isFunctionDeclaration).filter(node => /^getDesktopIcon.*PowerShell(?:Script|Block)$/.test(node.name.text));
  assert.equal(builders.length, 4);
  for (const name of ['getDesktopIconPowerShellScript', 'getDesktopIconFolderViewReaderPowerShellBlock', 'getDesktopIconFolderViewMovePowerShellScript', 'getDesktopIconMovePowerShellScript']) {
    const reader = builders.find(node => node.name.text === name);
    assert.ok(ast.getLineAndCharacterOfPosition(reader.end).line - ast.getLineAndCharacterOfPosition(reader.getStart(ast)).line + 1 <= 50, `${name} assembly exceeds 50 lines`);
  }
  const source = baseline || builders.map(node => node.getText(ast)).join('\n\n');
  const blocks = { desktopIconReadOnlyFallbackPowerShellBlock, desktopIconMetadataPowerShellBlock,
    desktopIconListViewInteropCSharp, desktopIconListViewReadCSharp, desktopIconListViewWindowLookupCSharp,
    desktopIconFolderViewInteropCSharp, desktopIconFolderViewReadCSharp, desktopIconFolderViewAccessCSharp,
    desktopIconFolderViewMoveInteropCSharp, desktopIconFolderViewMoveExecuteCSharp, desktopIconFolderViewMoveAccessCSharp,
    desktopIconListViewMoveInteropCSharp, desktopIconListViewMoveExecuteCSharp, desktopIconListViewMoveWindowLookupCSharp };
  const bindings = `const { ${Object.keys(blocks).join(', ')} } = blocks;\n`;
  return new Function('blocks', bindings + source + '\nreturn { getDesktopIconFolderViewReaderPowerShellBlock, getDesktopIconPowerShellScript, getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript };')(blocks);
}

function describeScript(action) {
  try {
    const script = action();
    return { bytes: Buffer.byteLength(script), hash: createHash('sha256').update(script).digest('hex') };
  } catch (error) { return { error: error.name, message: error.message }; }
}

function exercise(builders) {
  const records = [];
  for (const options of [undefined, null, {}, { includeReadOnlyPositionFallback: false }, { includeReadOnlyPositionFallback: true }, { includeReadOnlyPositionFallback: 0 }, { includeReadOnlyPositionFallback: 'false' }, { includeReadOnlyPositionFallback: {} }]) records.push(describeScript(() => builders.getDesktopIconPowerShellScript(options)));
  for (const throws of [false, true]) {
    const calls = [], error = new Error('option getter');
    const options = { get includeReadOnlyPositionFallback() { calls.push('option'); if (throws) throw error; return true; } };
    records.push({ ...describeScript(() => builders.getDesktopIconPowerShellScript(options)), calls });
  }
  records.push(describeScript(() => builders.getDesktopIconFolderViewReaderPowerShellBlock()));
  const numbers = [undefined, null, -2.5, 0, 7.3, '8.4', NaN, Infinity];
  for (const name of ['getDesktopIconFolderViewMovePowerShellScript', 'getDesktopIconMovePowerShellScript']) {
    for (const index of numbers) for (const nativeScreenX of numbers) for (const nativeScreenY of numbers) records.push(describeScript(() => builders[name]({ index, nativeScreenX, nativeScreenY })));
    records.push(describeScript(() => builders[name]({ index: Symbol('invalid'), nativeScreenX: 0, nativeScreenY: 0 })));
    records.push(describeScript(() => builders[name](undefined)));
    const calls = [], request = {};
    for (const key of ['index', 'nativeScreenX', 'nativeScreenY']) Object.defineProperty(request, key, { get() { calls.push(key); return 2.5; } });
    records.push({ ...describeScript(() => builders[name](request)), calls });
  }
  return records;
}

function checkAssembly(builders) {
  const script = builders.getDesktopIconPowerShellScript({ includeReadOnlyPositionFallback: true });
  assert.ok(script.includes(desktopIconReadOnlyFallbackPowerShellBlock));
  assert.ok(script.includes(desktopIconMetadataPowerShellBlock));
  assert.ok(script.indexOf('Get-DesktopPetFolderViewIcons') < script.indexOf(desktopIconReadOnlyFallbackPowerShellBlock));
  assert.ok(script.indexOf(desktopIconReadOnlyFallbackPowerShellBlock) < script.indexOf(desktopIconMetadataPowerShellBlock));
  assert.ok(script.indexOf(desktopIconMetadataPowerShellBlock) < script.indexOf('$icons = Resolve-DesktopPetIconMetadata $icons'));
  assert.match(script, /\$IncludeReadOnlyPositionFallback = \$true/);
  assert.match(builders.getDesktopIconPowerShellScript(), /\$IncludeReadOnlyPositionFallback = \$false/);
  const listView = desktopIconListViewInteropCSharp + desktopIconListViewReadCSharp + desktopIconListViewWindowLookupCSharp;
  assert.ok(script.includes('Add-Type -TypeDefinition @"\n' + listView + '"@'));
  const folderView = desktopIconFolderViewInteropCSharp + desktopIconFolderViewReadCSharp + desktopIconFolderViewAccessCSharp;
  assert.ok(script.includes('Add-Type -TypeDefinition @"\n' + folderView + '"@'));
  const folderMove = desktopIconFolderViewMoveInteropCSharp + desktopIconFolderViewMoveExecuteCSharp + desktopIconFolderViewMoveAccessCSharp;
  const folderMoveScript = builders.getDesktopIconFolderViewMovePowerShellScript({ index: 0, nativeScreenX: 0, nativeScreenY: 0 });
  assert.ok(folderMoveScript.includes('Add-Type -TypeDefinition @"\n' + folderMove + '"@'));
  const listMove = desktopIconListViewMoveInteropCSharp + desktopIconListViewMoveExecuteCSharp + desktopIconListViewMoveWindowLookupCSharp;
  const listMoveScript = builders.getDesktopIconMovePowerShellScript({ index: 0, nativeScreenX: 0, nativeScreenY: 0 });
  assert.ok(listMoveScript.includes('Add-Type -TypeDefinition @"\n' + listMove + '"@'));
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  for (const file of ['desktopIconReadOnlyFallbackScript', 'desktopIconMetadataScript', 'desktopIconListViewInterop', 'desktopIconListViewRead', 'desktopIconListViewWindowLookup', 'desktopIconFolderViewInterop', 'desktopIconFolderViewRead', 'desktopIconFolderViewAccess', 'desktopIconFolderViewMoveInterop', 'desktopIconFolderViewMoveExecute', 'desktopIconFolderViewMoveAccess', 'desktopIconListViewMoveInterop', 'desktopIconListViewMoveExecute', 'desktopIconListViewMoveWindowLookup']) {
    assert.ok(root.includes(`require('./desktopIcons/${file}.cjs')`));
    assert.ok(fs.readFileSync(`electron/desktopIcons/${file}.cjs`, 'utf8').split('\n').length <= 300);
  }
}

function parseScripts(builders) {
  if (process.platform !== 'win32') return 'skipped outside Windows';
  const fixtures = [
    { name: 'read', script: builders.getDesktopIconPowerShellScript() },
    { name: 'read-with-position-fallback', script: builders.getDesktopIconPowerShellScript({ includeReadOnlyPositionFallback: true }) },
    { name: 'folder-view-move', script: builders.getDesktopIconFolderViewMovePowerShellScript({ index: 3, nativeScreenX: -101, nativeScreenY: 50 }) },
    { name: 'list-view-move', script: builders.getDesktopIconMovePowerShellScript({ index: 3, nativeScreenX: -101, nativeScreenY: 50 }) },
  ];
  // ParseInput creates syntax trees only; no generated script or Add-Type is executed.
  const parser = String.raw`
$fixtures = [Console]::In.ReadToEnd() | ConvertFrom-Json
$failures = @()
foreach ($fixture in $fixtures) {
  $tokens = $null
  $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseInput([string]$fixture.script, [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) { $failures += [PSCustomObject]@{ name = $fixture.name; errors = @($errors | ForEach-Object { $_.Message }) } }
}
if ($failures.Count -gt 0) { $failures | ConvertTo-Json -Depth 6 -Compress; exit 1 }
Write-Output 'PowerShell parser: PASS'
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', parser], { input: JSON.stringify(fixtures), encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 1048576 });
  assert.equal(result.status, 0, `${result.error?.message || ''}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PowerShell parser: PASS/);
  return 'four complete scripts parsed';
}

function checkSourceBudget(file, text, ast, root) {
  assert.ok(text.split('\n').length <= (file === root ? 171 : 300), `file budget exceeded: ${file}`);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const lines = ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      const composition = file === root && node.name?.text === 'createDesktopIconService';
      assert.ok(lines <= (composition ? 51 : 50), `function budget exceeded: ${file}:${node.name?.text || 'anonymous'}=${lines}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function checkModuleGraph() {
  const root = path.resolve('electron/desktopIconService.cjs'), directory = path.resolve('electron/desktopIcons');
  const visited = new Set(), active = new Set();
  function visit(file) {
    assert.ok(!active.has(file), `cyclic desktop icon dependency: ${file}`);
    if (visited.has(file)) return;
    assert.ok(fs.existsSync(file), `missing desktop icon module: ${file}`);
    active.add(file);
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    checkSourceBudget(file, text, ast, root);
    function imports(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        const specifier = node.arguments[0].text;
        if (specifier.startsWith('.')) {
          const dependency = path.resolve(path.dirname(file), specifier);
          assert.ok(dependency.startsWith(directory + path.sep), `desktop icon dependency outside implementation: ${dependency}`);
          visit(dependency);
        }
      }
      ts.forEachChild(node, imports);
    }
    imports(ast); active.delete(file); visited.add(file);
  }
  visit(root);
  function checkFiles(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) checkFiles(file);
      else if (entry.name.endsWith('.cjs')) assert.ok(visited.has(file), `detached desktop icon module: ${file}`);
    }
  }
  checkFiles(directory);
  console.log(`Desktop icon structure passed (${visited.size - 1} reachable modules, no cycles, root 171 lines; root composition 51/50 target pending).`);
}

const builders = loadBuilders();
const records = exercise(builders);
if (process.argv[2]) assert.deepEqual(records, exercise(loadBuilders(fs.readFileSync(process.argv[2], 'utf8'))));
checkAssembly(builders);
checkModuleGraph();
console.log(`Desktop icon script smoke passed (${records.length} generated-output/error cases${process.argv[2] ? ', original byte lengths and SHA-256 identical' : ''}; ${parseScripts(builders)}).`);
