const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const productionRoot = path.resolve(__dirname, '../electron');
const schema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false };
const tool = { name: 'echo', inputSchema: schema };
const success = { content: [{ type: 'text', text: 'done' }], structuredContent: { done: true } };

// Only host boundaries are substituted. Every local production require uses the actual source.
function createFixture() {
  const modules = new Map(), files = new Map(), timers = new Set(), children = [], wire = [], events = [];
  let clock = 10000;
  const root = path.join(productionRoot, 'fixture-root');
  const config = { servers: [{ id: 'fixture', command: 'fixture.cmd', args: ['serve'], timeoutMs: 1000 }] };
  const fixtureProcess = { platform: 'win32', env: { SystemRoot: 'C:\\Windows', SAFE: 'retained', API_KEY: 'host-secret', NODE_OPTIONS: 'blocked' } };
  const writeConfig = (value = config, target = root) => files.set(path.join(target, '.desktop-pet-mcp.json'), JSON.stringify(value));
  writeConfig();
  const hostFs = { existsSync: file => files.has(file), readFileSync: file => {
    assert.ok(files.has(file), 'Unexpected host file read: ' + file);
    return files.get(file);
  } };
  function setTimer(callback, delay) {
    const timer = { callback, delay, due: clock + delay, unref() {} };
    timers.add(timer);
    return timer;
  }
  function respond(child, message, result = success, error = null) {
    const text = JSON.stringify({ jsonrpc: '2.0', id: message.id, ...(error ? { error: { message: error } } : { result }) }) + '\n';
    // Ignore malformed/unrelated lines and assemble a response split across stdout chunks.
    queueMicrotask(() => {
      if (child.dead) return;
      child.stdout.emit('data', 'not-json\n' + JSON.stringify({ id: -1, result: {} }) + '\n' + text.slice(0, 9));
      child.stdout.emit('data', text.slice(9));
    });
  }
  const behavior = { hold: false, error: null, initializeError: null };
  function spawn(command, args, options) {
    const child = new EventEmitter();
    Object.assign(child, { pid: 100 + children.length, command, args, options, dead: false, ended: false });
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdout.setEncoding = child.stderr.setEncoding = value => assert.equal(value, 'utf8');
    child.stdin = {
      end() { child.ended = true; },
      write(text, encoding, callback) {
        assert.equal(encoding, 'utf8');
        const message = JSON.parse(text);
        wire.push({ child, message });
        callback?.(null);
        if (!('id' in message)) return;
        if (message.method === 'initialize') respond(child, message, {}, behavior.initializeError);
        else if (message.method === 'tools/list') respond(child, message, { tools: [tool] });
        else {
          assert.equal(message.method, 'tools/call');
          if (!behavior.hold) respond(child, message, success, behavior.error);
        }
      },
    };
    child.kill = () => { child.dead = true; queueMicrotask(() => child.emit('close', 0, null)); return true; };
    children.push(child);
    return child;
  }
  const childProcess = { spawn, execFileSync(command, args) {
    assert.equal(command, 'taskkill');
    assert.deepEqual(args.slice(2), ['/T', '/F']);
    const child = children.find(candidate => candidate.pid === Number(args[1]));
    assert.ok(child); child.kill();
  } };
  const host = { fs: hostFs, path, child_process: childProcess };
  function load(file) {
    assert.equal(path.dirname(file), productionRoot, 'Unexpected local dependency');
    assert.ok(path.basename(file).startsWith('mcp') && file.endsWith('.cjs'));
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const requireActual = id => {
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
      if (['ajv', 'ajv/dist/2019', 'ajv/dist/2020'].includes(id)) return require(id);
      assert.ok(Object.hasOwn(host, id), 'Unexpected host dependency: ' + id);
      return host[id];
    };
    const Clock = class extends Date { static now() { return clock; } };
    new Function('require', 'module', 'exports', '__dirname', '__filename', 'process', 'Date', 'setTimeout', 'clearTimeout', fs.readFileSync(file, 'utf8'))(
      requireActual, module, module.exports, path.dirname(file), file, fixtureProcess, Clock, setTimer, timer => timers.delete(timer),
    );
    return module.exports;
  }
  const api = load(path.join(productionRoot, 'mcpStdioClientService.cjs'));
  assert.equal(modules.size, 32, 'Full root production dependency graph must load');
  const history = {
    recordSessionEvent: value => events.push(['session', value]),
    recordToolCallStart: value => events.push(['start', value]),
    recordToolCallResult: value => events.push(['result', value]),
    recordDiagnostic: value => events.push(['diagnostic', value]),
  };
  const health = {
    getRetryGate: () => ({ allowed: true }), getStatus: () => ({ status: 'ok' }),
    recordSuccess: id => events.push(['health-success', id]),
    recordFailure: (id, error) => events.push(['health-failure', id, error.message]),
  };
  const clients = [];
  function client(options = {}) {
    const instance = api.createMcpStdioClientService({ projectRoot: root, reuseSessions: true, idleSessionTimeoutMs: 50, history, health, ...options });
    clients.push(instance); return instance;
  }
  const calls = () => wire.filter(item => item.message.method === 'tools/call');
  const request = (requestId = 'call', value = 'valid') => ({ serverId: 'fixture', name: 'echo', arguments: { value }, requestId });
  const flush = async () => { for (let count = 0; count < 20; count++) await Promise.resolve(); };
  const until = async predicate => {
    for (let count = 0; count < 200; count++) { if (predicate()) return; await Promise.resolve(); }
    assert.fail('Expected transport boundary was never reached');
  };
  function cleanup() {
    clients.forEach(instance => instance.dispose());
    assert.equal(timers.size, 0, 'RPC and idle timers must be released');
    assert.ok(children.every(child => child.dead && child.ended), 'All spawned processes must be closed');
  }
  return { root, config, writeConfig, client, calls, request, children, wire, events, timers, behavior, respond, flush, until, cleanup,
    advance: amount => { clock += amount; },
    fire: timer => { assert.ok(timers.delete(timer)); clock = Math.max(clock, timer.due); timer.callback(); },
  };
}

const scenarios = [
  ['pooled discovery, handshake, transport and reuse', async f => {
    const client = f.client();
    assert.equal(client.listServers()[0].id, 'fixture');
    assert.equal((await client.listTools()).tools[0].name, 'echo');
    assert.deepEqual(await client.callTool(f.request()), successWithFlag());
    assert.deepEqual(await client.callTool(f.request('again')), successWithFlag());
    assert.equal(f.children.length, 1);
    assert.deepEqual(f.wire.map(item => item.message.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/list', 'tools/call', 'tools/list', 'tools/call']);
    assert.deepEqual(f.children[0].args, ['/d', '/s', '/c', 'fixture.cmd', 'serve']);
    assert.equal(f.children[0].options.shell, false);
    assert.equal(f.children[0].options.env.SAFE, 'retained');
    assert.equal(f.children[0].options.env.API_KEY, undefined);
    assert.equal(f.children[0].options.env.NODE_OPTIONS, undefined);
    assert.equal(client.getSessionStatus()[0].pendingCount, 0);
  }],
  ['one-shot schema and execution close independently', async f => {
    const client = f.client({ reuseSessions: false });
    assert.deepEqual(await client.callTool(f.request()), successWithFlag());
    assert.equal(f.children.length, 2);
    assert.ok(f.children.every(child => child.dead));
    assert.deepEqual(client.getSessionStatus(), []);
    assert.equal(client.resetSession().closedCount, 0);
    assert.equal(client.dispose(), 0);
  }],
  ['field and schema gates prevent tool execution', async f => {
    const client = f.client();
    f.config.policies = { tools: { 'fixture/echo': { fields: { '/value': { mode: 'deny', values: ['secret'] } } } } };
    f.writeConfig();
    const denied = await client.callTool(f.request('denied', 'secret'));
    assert.equal(denied.structuredContent.fieldPolicy.error, 'mcp_field_policy_denied');
    assert.equal(f.children.length, 0);
    assert.ok(!JSON.stringify(denied).includes('secret'));
    const invalid = await client.callTool(f.request('schema', 12));
    assert.equal(invalid.isError, true);
    assert.ok(invalid.structuredContent.schemaValidation);
    assert.equal(f.children.length, 1); assert.equal(f.calls().length, 0);
    assert.equal((await client.callTool({ serverId: 'unknown', name: 'echo' })).isError, true);
    assert.equal(f.calls().length, 0);
  }],
  ['concurrent calls serialize actual RPC and retain arguments', async f => {
    f.behavior.hold = true;
    const client = f.client();
    const first = client.callTool(f.request('first', 'one')), second = client.callTool(f.request('second', 'two'));
    await f.until(() => f.calls().length === 1); await f.flush();
    assert.equal(f.calls().length, 1);
    f.respond(f.calls()[0].child, f.calls()[0].message);
    await f.until(() => f.calls().length === 2);
    f.respond(f.calls()[1].child, f.calls()[1].message);
    assert.deepEqual(await Promise.all([first, second]), [successWithFlag(), successWithFlag()]);
    assert.deepEqual(f.calls().map(item => item.message.params.arguments.value), ['one', 'two']);
    assert.equal(f.children.length, 1);
  }],
  ['cancellation closes queued calls without restart failure', async f => {
    f.behavior.hold = true;
    const client = f.client();
    const first = client.callTool(f.request('first')), second = client.callTool(f.request('second'));
    await f.until(() => f.calls().length === 1); await f.flush();
    assert.equal(client.cancelToolCall({ requestId: 'first' }).ok, true);
    assert.ok((await Promise.all([first, second])).every(result => result.isError));
    assert.equal(f.calls().length, 1);
    assert.equal(client.cancelToolCall({ requestId: 'first' }).cancelled, false);
    assert.ok(!f.events.some(event => event[0] === 'health-failure'));
    f.behavior.hold = false;
    assert.equal((await client.callTool(f.request('reopen'))).isError, false);
    assert.equal(f.children.length, 2);
  }],
  ['same request id in two clients remains isolated', async f => {
    f.behavior.hold = true;
    const firstClient = f.client(), secondClient = f.client();
    const first = firstClient.callTool(f.request()), second = secondClient.callTool(f.request());
    await f.until(() => f.calls().length === 2);
    assert.equal(firstClient.cancelToolCall({ requestId: 'call' }).ok, true);
    assert.equal((await first).isError, true);
    const peer = f.calls()[1]; assert.equal(peer.child.dead, false);
    f.respond(peer.child, peer.message);
    assert.equal((await second).isError, false);
    assert.equal(secondClient.getSessionStatus()[0].closed, false);
  }],
  ['RPC failure, cooldown and expiry recovery', async f => {
    const client = f.client(); f.behavior.error = 'fixture RPC failure';
    assert.equal((await client.callTool(f.request())).isError, true);
    assert.equal(client.getSessionStatus()[0].restartStatus, 'cooldown');
    assert.equal(client.getSessionStatus()[0].restartConsecutiveFailures, 1);
    await assert.rejects(client.callTool(f.request('blocked')), /Retry|cooling|restart/i);
    assert.equal(f.children.length, 1);
    assert.deepEqual((await client.listTools()).tools, []);
    f.advance(2000); f.behavior.error = null;
    assert.equal((await client.callTool(f.request('recovered'))).isError, false);
    assert.equal(client.getSessionStatus()[0].restartConsecutiveFailures, 0);
    assert.ok(f.events.some(event => event[1]?.status === 'restart-recovered'));
  }],
  ['initialization failure releases transport and enters cooldown', async f => {
    const client = f.client(); f.behavior.initializeError = 'fixture handshake failure';
    await assert.rejects(client.callTool(f.request()), /handshake failure/);
    assert.equal(f.calls().length, 0); assert.equal(f.children[0].dead, true);
    assert.equal(client.getSessionStatus()[0].restartStatus, 'cooldown');
    assert.equal(client.resetSession().closedCount, 0);
    f.behavior.initializeError = null;
    assert.equal((await client.callTool(f.request('retry'))).isError, false);
  }],
  ['configuration replacement and explicit reset', async f => {
    const client = f.client(); await client.callTool(f.request());
    f.config.servers[0].args = ['changed']; f.writeConfig();
    await client.callTool(f.request('changed'));
    assert.equal(f.children.length, 2); assert.equal(f.children[0].dead, true);
    assert.equal(client.getSessionStatus()[0].lastCloseKind, 'replaced');
    assert.equal(client.resetSession({ serverId: 'fixture' }).closedCount, 1);
    assert.deepEqual(client.getSessionStatus(), []);
    await client.callTool(f.request('reset'));
    assert.equal(f.children.length, 3); assert.equal(client.dispose('config-save'), 1);
  }],
  ['idle eviction and independent configuration roots', async f => {
    const peerRoot = path.join(f.root, 'peer');
    f.writeConfig({ servers: [{ id: 'peer', command: 'peer.exe' }] }, peerRoot);
    const client = f.client(), peer = f.client({ projectRoot: peerRoot });
    await client.callTool(f.request()); await peer.listTools();
    assert.equal(peer.listServers()[0].id, 'peer');
    const timer = [...f.timers][0]; assert.equal(timer.delay, 50); f.fire(timer);
    assert.equal(f.children[0].dead, true); assert.equal(f.children[1].dead, false);
    assert.deepEqual(client.getSessionStatus(), []);
    assert.equal(peer.getSessionStatus()[0].serverId, 'peer');
    await client.callTool(f.request('idle-reopen'));
    assert.equal(client.getSessionStatus()[0].lastCloseKind, 'idle-timeout');
  }],
  ['request timeout closes pending process and cleans active cancellation', async f => {
    f.behavior.hold = true; const client = f.client();
    const call = client.callTool(f.request()); await f.until(() => f.calls().length === 1);
    const timer = [...f.timers].find(candidate => candidate.delay === 1000);
    assert.ok(timer); f.fire(timer);
    const result = await call; assert.equal(result.isError, true);
    assert.match(result.content[0].text, /timed out/);
    assert.equal(client.cancelToolCall({ requestId: 'call' }).cancelled, false);
    assert.equal(client.getSessionStatus()[0].restartStatus, 'cooldown');
    assert.ok(f.events.some(event => event[1]?.status === 'timeout'));
  }],
];

function successWithFlag() { return { ...success, isError: false }; }
async function main() {
  for (const [name, run] of scenarios) {
    const fixture = createFixture();
    try { await run(fixture); fixture.cleanup(); }
    catch (error) { throw new Error(name, { cause: error }); }
  }
  console.log(`MCP root integration passed: ${scenarios.length} scenarios using all 32 actual production modules; only configuration, process, environment and clock boundaries controlled.`);
}
// A referenced real watchdog makes unresolved promises fail instead of silently exiting successfully.
const watchdog = setTimeout(() => { console.error('MCP root integration did not complete'); process.exit(1); }, 15000);
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
