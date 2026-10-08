const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchSessionLifecycle.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
const names = ['launchBrowserIfNeeded', 'ensureBrowserSession', 'getSessionState', 'closeSession'];
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8');
  const t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createBrowserSearchService');
  oldSource = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text) || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ['browserProcess', 'browserSessionState'].includes(d.name.getText(t)))).map(n => n.getText(t)).join('\n');
  assert.ok(oldSource.includes('let browserProcess'));
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('(?:fs|child_process|\.\/browserSearchDevToolsWait.cjs|\.\/browserSearchSessionLifecycle.cjs)'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => {
        if (ts.isFunctionDeclaration(n)) return !names.includes(n.name?.text);
        if (!ts.isVariableStatement(n)) return true;
        return !n.declarationList.declarations.some(d => ['browserProcess', 'browserSessionState'].includes(d.name.getText(t))) && !n.getText(t).includes('createBrowserSessionLifecycle()');
      }));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    // Only the two state writes become the lifecycle's state-clearing operation.
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements))
      .replace(/clearManualCloseRequest:\s*\(\) => \{\s*browserSessionState.manualCloseRequested = false;\s*\}/g, 'clearManualCloseRequest')
      .replace(/browserSessionState.manualCloseRequested = false;/g, 'clearManualCloseRequest();');
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Root discovery/preparation/search/API unchanged except state-clearing wiring');
}
async function run(sequence, stage, killMode, original) {
  const trace = [], processes = [], failure = Error('controlled lifecycle failure');
  const fakeFs = { mkdirSync(...args) { trace.push(['mkdir', ...args]); if (stage === 'mkdir') throw failure; } };
  function spawn(...args) {
    trace.push(['spawn', ...args]); if (stage === 'spawn') throw failure;
    const p = { killed: false, handlers: {}, unref() { assert.equal(this, p); trace.push(['unref']); if (stage === 'unref') throw failure; },
      on(event, callback) { assert.equal(this, p); trace.push(['on', event]); if (stage === 'on') throw failure; p.handlers[event] = callback; },
      kill() { assert.equal(this, p); trace.push(['kill']); if (killMode === 'throw') throw failure; p.killed = true; if (killMode === 'exit') p.handlers.exit?.(); },
    };
    processes.push(p); return p;
  }
  async function waitForDevTools(port) {
    trace.push(['wait', port]);
    if (stage === 'wait-exit') processes.at(-1)?.handlers.exit?.();
    if (stage === 'wait-reject' || stage === 'wait-exit-reject') {
      if (stage === 'wait-exit-reject') processes.at(-1)?.handlers.exit?.();
      throw failure;
    }
  }
  let create;
  if (original) create = () => new Function('fs', 'spawn', 'waitForDevTools', oldSource + '\nreturn {ensureBrowserSession,getSessionState,closeSession,clearManualCloseRequest:()=>{browserSessionState.manualCloseRequested=false;}};')(fakeFs, spawn, waitForDevTools);
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => {
      if (id === 'fs') return fakeFs;
      if (id === 'child_process') return { spawn };
      if (id.endsWith('DevToolsWait.cjs')) return { waitForDevTools };
      throw Error('Unexpected dependency ' + id);
    }, module);
    create = module.exports.createBrowserSessionLifecycle;
  }
  const api = create(), other = create();
  assert.notEqual(api.ensureBrowserSession, other.ensureBrowserSession);
  const initialOther = other.getSessionState();
  let next = 0;
  for (const step of sequence) {
    try {
      if (step === 'ensure') {
        const id = ++next;
        trace.push(['result', await api.ensureBrowserSession({ browserPath: '/controlled/browser' + id, browserLabel: 'Browser' + id, port: 9200 + id, profilePath: '/controlled/profile' + id })]);
      } else if (step === 'close') api.closeSession();
      else if (step === 'clear') api.clearManualCloseRequest();
      else if (step === 'exit') processes.at(-1)?.handlers.exit?.();
      else if (step === 'old-exit') processes[0]?.handlers.exit?.();
      else if (step === 'killed' && processes.length) processes.at(-1).killed = true;
    } catch (error) { assert.equal(error, failure); trace.push(['error', error.message]); }
    const snapshot = api.getSessionState();
    trace.push(['state', snapshot]);
    snapshot.status = 'caller-mutation';
    assert.notEqual(api.getSessionState().status, 'caller-mutation', 'State snapshots are copies');
    assert.deepEqual(other.getSessionState(), initialOther, 'Instances do not share state/process');
  }
  return trace;
}
async function main() {
  const sequences = [[], ['close'], ['ensure'], ['ensure', 'ensure'], ['close', 'ensure'], ['close', 'clear', 'ensure'], ['ensure', 'close', 'ensure'], ['ensure', 'exit', 'ensure'], ['ensure', 'killed', 'ensure'], ['ensure', 'close', 'clear', 'ensure'], ['ensure', 'exit', 'clear', 'ensure', 'old-exit'], ['ensure', 'close', 'close', 'clear', 'ensure', 'ensure']];
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const sequence of sequences) for (const stage of ['normal', 'mkdir', 'spawn', 'unref', 'on', 'wait-reject', 'wait-exit', 'wait-exit-reject'])
    for (const killMode of ['normal', 'throw', 'exit']) {
      const actual = await run(sequence, stage, killMode, false);
      if (oldSource) assert.deepEqual(actual, await run(sequence, stage, killMode, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, '8f37384d3945640a0064a34123f9ccdc318a9483fa15bccc6a8db58663cba4b9', 'Reviewed lifecycle transitions and process call order');
  console.log('Session lifecycle passed: ' + cases + ' sequence/process/failure/exit/reopen/isolation cases');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
