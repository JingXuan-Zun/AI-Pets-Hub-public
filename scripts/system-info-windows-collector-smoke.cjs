const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { getWindowsSystemInfoPowerShellScript: getScript } = require('../electron/systemInfoWindowsScript.cjs');

const root = path.resolve(__dirname, '..');
const scriptText = fs.readFileSync(path.join(root, 'electron/systemInfoWindowsScript.cjs'), 'utf8');
const collectorText = fs.readFileSync(path.join(root, 'electron/systemInfoWindowsCollector.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const script = getScript();
const scriptDigest = crypto.createHash('sha256').update(script).digest('hex');
const printer = ts.createPrinter();
const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast);
const movedNames = ['getWindowsSystemInfoPowerShellScript', 'runTemporaryPowerShellScript', 'runWindowsSystemInfoPowerShell'];
let oldFunctions;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  oldFunctions = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && movedNames.includes(n.name.text));
  const oldScript = new Function(oldFunctions[0].getText(oldAst) + '\nreturn getWindowsSystemInfoPowerShellScript();')();
  assert.equal(script, oldScript);
  const collectorAst = parse(collectorText);
  assert.deepEqual(oldFunctions.slice(1).map(n => print(n, oldAst)), collectorAst.statements.filter(ts.isFunctionDeclaration).map(n => print(n, collectorAst)));
  const nextAst = parse(fs.readFileSync(path.join(root, 'electron/systemInfoService.cjs'), 'utf8'));
  const imports = n => ts.isVariableStatement(n) && /require\(/.test(n.getText());
  assert.deepEqual(oldAst.statements.filter(n => !oldFunctions.includes(n) && !imports(n)).map(n => print(n, oldAst)), nextAst.statements.filter(n => !imports(n)).map(n => print(n, nextAst)));
  oldFunctions = oldFunctions.slice(1).map(n => n.getText(oldAst)).join('\n\n');
}
for (const text of [scriptText, collectorText]) {
  assert.ok(text.split('\n').length <= 300);
  const ast = parse(text);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.equal(getScript(), script);
assert.equal(script.split('\n').length, 108);
assert.ok(script.startsWith('[Console]::InputEncoding'));
assert.ok(script.endsWith('} | ConvertTo-Json -Depth 6 -Compress'));
assert.ok(script.indexOf('Read-RegistryValue') < script.indexOf('$cpuModel ='));

async function scenario(source, fixture) {
  const calls = [];
  const processError = fixture.error ? Object.assign(new Error('process failure'), { code: 'FIXTURE' }) : null;
  const fakeFs = {
    writeFileSync(file, value, encoding) {
      calls.push(['write', file, crypto.createHash('sha256').update(value).digest('hex'), encoding]);
      if (fixture.writeFailure) throw new Error('write failure');
    },
    unlink(file, callback) { calls.push(['unlink', file]); callback(fixture.cleanupFailure ? new Error('cleanup failure') : null); },
  };
  const execFile = (command, args, options, callback) => {
    calls.push(['exec', command, args, options]);
    if (fixture.spawnFailure) throw new Error('spawn failure');
    callback(processError, fixture.stdout, fixture.stderr);
  };
  const fakeRequire = name => {
    if (name === 'child_process') return { execFile };
    if (name === 'fs') return fakeFs;
    if (name === 'os') return { tmpdir: () => '/fixture/temp' };
    if (name === 'path') return path.posix;
    if (name === './systemInfoWindowsScript.cjs') return { getWindowsSystemInfoPowerShellScript: getScript };
    throw new Error('Unexpected boundary: ' + name);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'process', 'Date', 'Math', source)(fakeRequire, module, { platform: fixture.platform, pid: 42 }, { now: () => 123 }, { round: Math.round, random: () => 0.25 });
  let result;
  try { result = { value: await module.exports.runWindowsSystemInfoPowerShell() }; }
  catch (error) { result = { error: error.name, message: error.message }; }
  if (fixture.platform !== 'win32') {
    assert.deepEqual(result, { value: null });
    assert.deepEqual(calls, []);
  } else {
    assert.equal(calls[0][1], '/fixture/temp/desktop-pet-system-info-42-123-25000.ps1');
    if (!fixture.writeFailure) {
      assert.deepEqual(calls[1].slice(1), ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', calls[0][1]], { windowsHide: true, encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024 }]);
      assert.equal(calls.filter(call => call[0] === 'unlink').length, 1);
    }
  }
  return { result, calls, stderr: processError?.stderr };
}

(async () => {
  const previousSource = oldFunctions && "const { execFile } = require('child_process');\nconst fs = require('fs');\nconst os = require('os');\nconst path = require('path');\nconst { getWindowsSystemInfoPowerShellScript } = require('./systemInfoWindowsScript.cjs');\n" + oldFunctions + '\nmodule.exports = { runWindowsSystemInfoPowerShell };';
  const results = [];
  for (const platform of ['win32', 'linux']) {
    for (const stdout of [undefined, '', '  ', '{}', ' null ', '[]', '{"cpu":{"model":"CPU"}}', 'invalid', '\uFEFF{}']) {
      for (const stderr of ['', ' warning ']) {
        for (const error of [false, true]) {
          const fixture = { platform, stdout, stderr, error };
          const result = await scenario(collectorText, fixture);
          if (previousSource) assert.deepEqual(result, await scenario(previousSource, fixture));
          results.push(result);
        }
      }
    }
  }
  for (const fault of ['writeFailure', 'spawnFailure', 'cleanupFailure']) {
    for (const error of [false, true]) {
      const fixture = { platform: 'win32', stdout: '{}', stderr: ' warning ', error, [fault]: true };
      const result = await scenario(collectorText, fixture);
      if (previousSource) assert.deepEqual(result, await scenario(previousSource, fixture));
      results.push(result);
    }
  }
  assert.deepEqual((await scenario(collectorText, { platform: 'win32', stdout: '{}', error: true })).result, { value: {} });
  assert.deepEqual((await scenario(collectorText, { platform: 'win32', stdout: '', stderr: ' warning ', error: true })).result, { value: { error: 'process failure: warning' } });
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expectedScript = 'c8b6e806040fb2106ef1e09b3dd255f993d50e598d3468e97c26c31bc6f25a2c';
  const expected = 'ee2fcc49b44c0b9d6d51f1684cc44c52f88056ffaa470ff38c07d86032be91f5';
  assert.equal(scriptDigest, expectedScript);
  assert.equal(digest, expected);
  console.log(`system-info-windows-collector: ${results.length} cases passed; ${digest}; script ${scriptDigest}${previousSource ? '; exact script and original collector/root AST unchanged' : ''}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
