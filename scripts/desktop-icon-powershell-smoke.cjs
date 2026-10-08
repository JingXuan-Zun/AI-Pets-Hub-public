const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { compactDesktopIconPowerShellError, createDesktopIconPowerShellRunner } = require('../electron/desktopIcons/desktopIconPowerShell.cjs');

function exerciseErrorCompaction(compact) {
  const inputs = [null, '', 'plain message', ' a\n b\t c ', '#< CLIXML\n<Objs Version="1"><S S="Error">a&lt;b&gt;&amp;_x000D__x000A_c_x0009_d</S></Objs>', 'x'.repeat(1300)];
  return inputs.flatMap(input => [0, 2, 3, 8, 1200].map(limit => compact(input, limit)));
}

function createDependencies(mode, events) {
  const failure = new Error('dependency failed');
  const throwAt = stage => { if (mode === stage) throw failure; };
  let callback;
  const dependencies = {
    app: mode === 'missing-app' ? undefined : { getPath(kind) { events.push(['temp', kind]); throwAt('temp'); return mode === 'empty-temp' ? '' : '/temporary'; } },
    path: { join(...parts) { events.push(['join', ...parts]); throwAt('join'); return parts.join('/'); } },
    fs: {
      writeFileSync(...args) { events.push(['write', ...args]); throwAt('write'); },
      unlink(file, done) { events.push(['unlink', file]); throwAt('unlink'); done(new Error('ignored cleanup')); },
    },
    execFile(...args) { events.push(['exec', ...args.slice(0, 3)]); throwAt('exec'); callback = args[3]; },
  };
  return { dependencies, failure, complete: (...args) => callback(...args) };
}

async function exerciseRunner(factory) {
  const records = [];
  const modes = ['normal', 'missing-app', 'empty-temp', 'temp', 'join', 'write', 'exec', 'unlink'];
  const failures = [null, Object.assign(new Error('Command failed: secret script'), { code: 1, signal: 'SIGTERM' }), new Error('fallback message')];
  for (const mode of modes) for (const error of failures) for (const stdout of ['', 'output', 'Command failed: stdout']) for (const stderr of ['', '#< CLIXML\n<Objs><S>native_x000D__x000A_failure</S></Objs>']) {
    const events = [], fixture = createDependencies(mode, events);
    const run = factory(fixture.dependencies);
    assert.deepEqual(events, [], 'creating the runner performs no work');
    let promise, syncError, result, rejected, callbackError;
    try { promise = run('exact script\n中文'); } catch (caught) { syncError = caught; }
    if (promise) {
      const settled = promise.then(value => ({ value }), error => ({ error }));
      if (mode !== 'exec') {
        try { fixture.complete(error, stdout, stderr); } catch (caught) { callbackError = caught; }
      }
      if (!callbackError) ({ value: result, error: rejected } = await settled);
    }
    if (['temp', 'join', 'write'].includes(mode)) assert.equal(syncError, fixture.failure);
    else if (mode === 'exec') assert.equal(rejected, fixture.failure);
    else if (mode === 'unlink') assert.equal(callbackError, fixture.failure);
    else if (!error) assert.equal(result, stdout);
    else {
      const expected = stderr ? 'native failure' : stdout === 'output' ? 'output' : error.message === 'fallback message' ? error.message : stdout || error.message;
      assert.equal(rejected.message, expected);
      assert.equal(rejected.code, error.code); assert.equal(rejected.signal, error.signal);
      assert.equal(rejected.stdout, stdout); assert.equal(rejected.stderr, stderr ? 'native failure' : '');
    }
    const execution = events.find(event => event[0] === 'exec');
    if (execution) {
      assert.equal(execution[1], 'powershell.exe');
      assert.deepEqual(execution[2].slice(0, 4), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File']);
      assert.deepEqual(execution[3], { windowsHide: true, encoding: 'utf8', timeout: 2500, maxBuffer: 1048576 });
    }
    records.push({ events, result, syncError: syncError?.message, rejected: rejected && { message: rejected.message, code: rejected.code, signal: rejected.signal, stdout: rejected.stdout, stderr: rejected.stderr }, callbackError: callbackError?.message });
  }
  return records;
}

function checkModuleBudget() {
  const source = fs.readFileSync('electron/desktopIcons/desktopIconPowerShell.cjs', 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile('module.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const first = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line;
      const last = ast.getLineAndCharacterOfPosition(node.end).line;
      assert.ok(last - first + 1 <= 50, 'function exceeds 50 lines');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  assert.match(root, /createDesktopIconPowerShellRunner\(\{ app, fs, path, execFile \}\)/);
}

async function main() {
  const originalNow = Date.now, originalRandom = Math.random;
  Date.now = () => 123456; Math.random = () => 0.25;
  try {
    const current = await exerciseRunner(createDesktopIconPowerShellRunner);
    const compacted = exerciseErrorCompaction(compactDesktopIconPowerShellError);
    const baselineFile = process.argv[2];
    if (baselineFile) {
      const source = fs.readFileSync(baselineFile, 'utf8');
      const factory = new Function('dependencies', 'const { app, fs, path, execFile } = dependencies; const DESKTOP_ICON_SCRIPT_TIMEOUT_MS = 2500;\n' + source + '\nreturn runPowerShellScript;');
      const compact = new Function(source + '\nreturn compactDesktopIconPowerShellError;')();
      assert.deepEqual(current, await exerciseRunner(factory));
      assert.deepEqual(compacted, exerciseErrorCompaction(compact));
    }
    checkModuleBudget();
    console.log(`Desktop icon PowerShell smoke passed (${current.length} execution cases, ${compacted.length} error compaction cases${baselineFile ? ', original behavior identical' : ''}).`);
  } finally { Date.now = originalNow; Math.random = originalRandom; }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
