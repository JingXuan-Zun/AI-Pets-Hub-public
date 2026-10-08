const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { buildSpawnSpec } = require('../electron/browserTtsRules.cjs');
const httpSource = fs.readFileSync(require.resolve('../electron/browserTtsHttp.cjs'), 'utf8');
const commandSource = fs.readFileSync(require.resolve('../electron/browserTtsCommands.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const statements = text => ts.createSourceFile('tts.cjs', text, 99, true).statements;
const names = ['HEALTH_TIMEOUT_MS', 'requestJson', 'spawnCommand'];
const moved = n => names.includes(n.name?.text || n.declarationList?.declarations[0]?.name?.text);
if (old) {
  assert.deepEqual([...statements(httpSource), ...statements(commandSource)].filter(moved).map(n => n.getText()), statements(old).filter(moved).map(n => n.getText()));
  const retained = text => statements(text).filter(n => !moved(n) && !n.getText().includes("require('http')") && !/require\('\.\/browserTts(Http|Commands)\.cjs'\)/.test(n.getText())).map(n => n.getText());
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8')), retained(old));
}
function emitter(trace, label) {
  const listeners = new Map();
  return {
    on(event, fn) { trace.push([label, 'on', event]); listeners.set(event, { fn, once: false }); return this; },
    once(event, fn) { trace.push([label, 'once', event]); listeners.set(event, { fn, once: true }); return this; },
    emit(event, value) { const item = listeners.get(event); if (item) { if (item.once) listeners.delete(event); item.fn(value); } },
  };
}
function load(baseline, kind, dependencies) {
  if (baseline) {
    const body = statements(old).filter(moved).map(n => n.getText()).join('\n');
    return new Function('http', 'spawn', 'buildSpawnSpec', body + `\nreturn ${kind === 'http' ? 'requestJson' : 'spawnCommand'};`)(dependencies.http, dependencies.spawn, buildSpawnSpec);
  }
  const module = { exports: {} };
  new Function('require', 'module', kind === 'http' ? httpSource : commandSource)(id => id === 'http' ? dependencies.http : id === 'child_process' ? { spawn: dependencies.spawn } : { buildSpawnSpec }, module);
  return kind === 'http' ? module.exports.requestJson : module.exports.spawnCommand;
}
function normalize(result) {
  if (result?.error instanceof Error) return { ...result, error: { name: result.error.name, message: result.error.message } };
  return result;
}
async function httpCase(baseline, status, chunks, options, mode) {
  const trace = [], request = emitter(trace, 'request');
  request.destroy = error => { trace.push(['destroy', error.message]); request.emit('error', error); };
  const http = { request(url, settings, callback) {
    trace.push(['request', url.toString(), settings]);
    if (mode === 'throw') throw new Error('request failure');
    request.end = () => {
      trace.push(['end']);
      queueMicrotask(() => {
        if (mode === 'timeout') { request.emit('timeout'); return; }
        if (mode === 'error') { request.emit('error', new Error('network failure')); return; }
        const response = emitter(trace, 'response'); response.statusCode = status;
        response.setEncoding = value => trace.push(['encoding', value]);
        callback(response);
        for (const chunk of chunks) response.emit('data', chunk);
        response.emit('end');
        if (mode === 'late-error') request.emit('error', new Error('late network failure'));
      });
    };
    return request;
  } };
  let result, error;
  try { result = await load(baseline, 'http', { http })(new URL('http://fixture/health'), options); }
  catch (e) { error = { name: e.name, message: e.message }; }
  return { result, error, trace };
}
async function commandCase(baseline, candidate, options, exitCode, mode, chunks) {
  const trace = [], child = emitter(trace, 'child');
  child.stdout = emitter(trace, 'stdout'); child.stderr = emitter(trace, 'stderr');
  function spawn(command, args, settings) {
    trace.push(['spawn', command, args, settings]);
    if (mode === 'throw') throw new Error('spawn failure');
    queueMicrotask(() => {
      for (const chunk of chunks) child.stdout.emit('data', Buffer.from(chunk));
      child.stderr.emit('data', Buffer.from('diagnostic'));
      if (mode === 'error-first') child.emit('error', new Error('process failure'));
      child.emit('close', exitCode);
      if (mode === 'close-first') child.emit('error', new Error('late process failure'));
    });
    return child;
  }
  let result, error;
  try { result = normalize(await load(baseline, 'command', { spawn })(candidate, ['-m', 'fixture'], options)); }
  catch (e) { error = { name: e.name, message: e.message }; }
  return { result, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let httpCases = 0, commandCases = 0;
  for (const status of [undefined, 199, 200, 204, 299, 300, 500])
  for (const chunks of [[], ['{}'], ['null'], ['[1]'], ['not-json'], ['{"text":', '"中文"}']])
  for (const options of [undefined, { timeoutMs: 0, method: '', headers: null }, { method: 'POST', timeoutMs: 123, headers: { fixture: 'yes' } }, null])
  for (const mode of ['normal', 'throw', 'timeout', 'error', 'late-error']) {
    const actual = await httpCase(false, status, chunks, options, mode);
    if (old) assert.deepEqual(actual, await httpCase(true, status, chunks, options, mode));
    hash.update(JSON.stringify(actual)); httpCases++;
  }
  for (const candidate of [undefined, null, {}, { executable: 'python' }, { executable: 'py', args: ['-3'] }, { executable: 'py', args: 3 }])
  for (const options of [undefined, {}, { cwd: 'fixture', env: { ONLY: 'fixture' } }, null])
  for (const exitCode of [0, 1, null]) for (const mode of ['normal', 'throw', 'error-first', 'close-first'])
  for (const chunks of [[], ['output'], ['中', '文']]) {
    const actual = await commandCase(false, candidate, options, exitCode, mode, chunks);
    if (old) assert.deepEqual(actual, await commandCase(true, candidate, options, exitCode, mode, chunks));
    hash.update(JSON.stringify(actual)); commandCases++;
  }
  assert.deepEqual((await httpCase(false, 200, [], undefined, 'normal')).result.body, null);
  assert.deepEqual((await httpCase(false, 500, ['bad'], undefined, 'normal')).result, { ok: false, statusCode: 500, body: { raw: 'bad' } });
  assert.equal((await httpCase(false, 200, [], undefined, 'timeout')).error.message, 'browser_tts_health_timeout');
  assert.equal((await commandCase(false, { executable: 'py' }, {}, 0, 'normal', ['中', '文'])).result.stdout, '中文');
  assert.equal((await commandCase(false, { executable: 'py' }, {}, 0, 'error-first', [])).result.ok, false);
  assert.equal((await commandCase(false, { executable: 'py' }, {}, 0, 'close-first', [])).result.ok, true);
  const digest = hash.digest('hex');
  if (!old) assert.equal(digest, 'e495e780067bc466e514494f45934db3601857214de1002d862f9e7bfc41108e');
  console.log(`Browser TTS transport passed: ${httpCases} HTTP and ${commandCases} process cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
