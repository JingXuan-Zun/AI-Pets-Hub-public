const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const base = path.resolve(__dirname, '../electron');
const settle = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
async function scenario(fail, query, index) {
  const cache = new Map(), files = new Map(), trace = [], servers = [], pending = [];
  let now = 0, nextPid = 100;
  const fixture = path.resolve('C:/fixture/browser-tts-root-' + index);
  const sourceText = '# controlled server fixture\n';
  const hostProcess = { env: { FIXTURE: 'yes' }, execPath: path.join(fixture, 'host', 'node.exe'), platform: 'win32', cwd: () => fixture };
  const fakeFs = {
    existsSync(file) { trace.push(['exists', file]); return files.has(file) || file.endsWith('fixture-python.exe'); },
    mkdirSync(file) { trace.push(['mkdir', file]); },
    readFileSync(file) {
      trace.push(['read', file]);
      if (file === path.join(base, 'browser_tts_server.py')) return sourceText;
      assert.ok(files.has(file), 'Only fixture-backed file reads'); return files.get(file);
    },
    writeFileSync(file, text) { trace.push(['write', file]); files.set(file, text); },
  };
  function child() {
    const value = new EventEmitter(); value.pid = ++nextPid;
    value.exitCode = null; value.signalCode = null;
    value.stdout = new EventEmitter(); value.stderr = new EventEmitter();
    value.unref = () => trace.push(['unref', value.pid]);
    return value;
  }
  function spawn(command, args, options) {
    trace.push(['spawn', command, args, options.cwd]);
    const value = child();
    if (command === 'taskkill') {
      const target = servers.find(server => server.child.pid === Number(args[1]));
      assert.ok(target, 'Only fixture server terminated'); target.alive = false;
      target.child.exitCode = 0; target.child.signalCode = 'SIGKILL';
      target.child.emit('close', 0, 'SIGKILL');
      return value;
    }
    assert.equal(options.windowsHide, true);
    assert.equal(options.env.FIXTURE, 'yes'); assert.equal(options.env.PYTHONUTF8, '1');
    assert.ok(!args.includes('pip'), 'No dependency installation');
    if (args[0] === '-c') {
      queueMicrotask(() => { value.stdout.emit('data', Buffer.from('')); value.exitCode = 0; value.emit('close', 0); });
    } else {
      const port = args[args.indexOf('--port') + 1];
      servers.push({ child: value, port, alive: true, ready: port !== '9880' || servers.some(server => server.port === '9880') });
      value.stdout.emit('data', Buffer.from('fixture started\n'));
    }
    return value;
  }
  const http = { request(url, options, callback) {
    const request = new EventEmitter();
    const server = servers.findLast(server => server.port === url.port && server.alive);
    trace.push(['http', url.port, url.pathname, options.timeout]);
    request.destroy = error => request.emit('error', error);
    function respond() {
      if (!server || !server.alive) { request.emit('error', new Error('fixture offline')); return; }
      const response = new EventEmitter(); response.statusCode = server.ready ? 200 : 503;
      response.setEncoding = encoding => assert.equal(encoding, 'utf8'); callback(response);
      const body = url.pathname === '/speakers' ? [{ name: 'voice-' + url.port }] : { status: server.ready ? 'ok' : 'starting', voices_count: 1 };
      response.emit('data', JSON.stringify(body)); response.emit('end');
    }
    request.end = () => queueMicrotask(() => {
      if (url.port === '9880' && options.timeout === 2000 && server && !server.ready) {
        pending.push(() => {
          if (fail) { now = 15000; request.emit('error', new Error('fixture startup failure')); }
          else { server.ready = true; respond(); }
        });
      } else respond();
    });
    return request;
  } };
  function load(id, parent = base) {
    if (id === 'fs') return fakeFs;
    if (id === 'http') return http;
    if (id === 'child_process') return { spawn };
    if (id === 'os') return { homedir: () => path.join(fixture, 'home') };
    if (!id.startsWith('.')) { assert.equal(id, 'path'); return path; }
    const file = path.resolve(parent, id);
    assert.equal(path.dirname(file), base);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    new Function('require', 'module', '__dirname', 'process', 'Date', 'setTimeout', fs.readFileSync(file, 'utf8'))(
      dependency => load(dependency, path.dirname(file)), module, path.dirname(file), hostProcess,
      { now: () => now }, (fn, ms) => { now += ms; queueMicrotask(fn); },
    );
    return module.exports;
  }
  const production = load('./browserTtsService.cjs'); assert.equal(cache.size, 15);
  const logA = [], logB = [];
  const projectA = path.join(fixture, 'a'), projectB = path.join(fixture, 'b');
  const first = production.createBrowserTtsService({ projectRoot: projectA, log: (...args) => logA.push(args) });
  const peer = production.createBrowserTtsService({ projectRoot: projectB, log: (...args) => logB.push(args) });
  assert.ok(!trace.some(row => ['spawn', 'write', 'http'].includes(row[0])), 'Construction does not execute IO actions');
  const aSettings = { browserTtsApiUrl: 'http://fixture:9880', localVoiceRuntimePath: path.join(projectA, 'fixture-python.exe') };
  const bSettings = { browserTtsApiUrl: 'http://fixture:9882', localVoiceRuntimePath: path.join(projectB, 'fixture-python.exe') };
  let ownerSettled = false, waiterSettled = false;
  const owner = settle(query ? first.getSpeakers(aSettings) : first.ensureStarted(aSettings)).then(result => { ownerSettled = true; return result; });
  const waiter = settle(first.ensureStarted(aSettings)).then(result => { waiterSettled = true; return result; });
  for (let i = 0; i < 40; i++) await Promise.resolve();
  assert.equal(pending.length, 1); assert.equal(servers.filter(server => server.port === '9880').length, 1);
  assert.equal(ownerSettled, false); assert.equal(waiterSettled, false);
  const peerResult = await peer.ensureStarted(bSettings);
  assert.equal(peerResult.started, true); assert.equal(peerResult.available, true);
  peer.dispose();
  assert.equal(servers.find(server => server.port === '9880').alive, true, 'Peer dispose leaves first process running');
  const peerLogCount = logB.length;
  pending.shift()();
  const results = await Promise.all([owner, waiter]);
  if (fail) {
    for (const result of results) assert.equal(result.error, 'Edge-TTS 本地服务启动超时。');
    first.dispose();
    const retry = await first.ensureStarted(aSettings);
    assert.equal(retry.started, true); assert.equal(retry.available, true);
    assert.equal(servers.filter(server => server.port === '9880').length, 2);
  } else {
    if (query) assert.deepEqual(results[0].value, [{ name: 'voice-9880' }]);
    else assert.equal(results[0].value.started, true);
    assert.equal(results[1].value.started, false);
    assert.equal((await first.ensureStarted(aSettings)).started, false);
  }
  assert.deepEqual(await first.getSpeakers(aSettings), [{ name: 'voice-9880' }]);
  assert.equal(logB.length, peerLogCount, 'Instance loggers remain isolated');
  assert.equal(files.get(path.join(projectA, 'python', 'local-voice-runtime', 'browser_tts_server.py')), sourceText);
  assert.equal(files.get(path.join(projectB, 'python', 'local-voice-runtime', 'browser_tts_server.py')), sourceText);
  assert.equal(files.size, 2, 'Only own runtime script copies written');
  first.dispose(); first.dispose(); peer.dispose();
  assert.ok(servers.every(server => !server.alive));
  assert.equal(trace.filter(row => row[0] === 'spawn' && row[1] === 'taskkill').length, servers.length, 'Each process terminated once');
  assert.ok(logA.some(row => row[0] === 'Starting Browser TTS service'));
}
async function main() {
  let cases = 0;
  for (const fail of [false, true]) for (const query of [false, true]) await scenario(fail, query, cases++);
  console.log(`Browser TTS actual-root integration passed: ${cases} concurrent owner/waiter, peer isolation, timeout/retry, speaker and dispose cases; all 15 production modules; controlled host boundaries.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
