// Warm PowerShell workers (electron/powerShellHost.cjs, 2026-11-08): protocol, timeouts, the
// exit-code bypass and the fall-back to spawning; on Windows also a few real-PowerShell checks.
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const { PassThrough } = require('node:stream');
const { createPowerShellHost, installSharedPowerShellHost, usesExitCode } = require('../electron/powerShellHost.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };

// A fake powershell.exe: answers each base64 script line with the reply the test chose.
function createFakeSpawn(replyFor) {
  const children = [];
  const spawn = () => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.unref = () => {};
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('exit', null, 'SIGTERM')); };
    let buffer = '';
    child.stdin.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const script = Buffer.from(buffer.slice(0, newline), 'base64').toString('utf8');
        buffer = buffer.slice(newline + 1);
        const reply = replyFor(script, child);
        if (reply === 'hang') continue;
        if (reply === 'crash') { setImmediate(() => child.emit('exit', 1, null)); continue; }
        setImmediate(() => child.stdout.write(`${Buffer.from(JSON.stringify(reply), 'utf8').toString('base64')}\n`));
      }
    });
    children.push(child);
    return child;
  };
  return { children, spawn };
}

(async () => {
  // Exit-code scripts keep their own powershell.exe.
  check(usesExitCode('"x"; exit 3') && usesExitCode('if ($bad) { exit 1 }') && usesExitCode('exit $code'), 'non-zero exit detected');
  check(!usesExitCode('"x"; exit 0') && !usesExitCode('exit') && !usesExitCode('Exit-Something'), 'exit 0 / bare exit go to the host');

  {
    const { children, spawn } = createFakeSpawn((script) => (script === 'fail'
      ? { err: 'boom', exitCode: 1, out: 'partial' }
      : { err: script === 'warn' ? 'warning' : '', exitCode: 0, out: `ran:${script}` }));
    const host = createPowerShellHost({ platform: 'win32', poolSize: 2, spawn });
    assert.deepEqual(await host.run('a'), { stderr: '', stdout: 'ran:a' }); checks += 1;
    assert.deepEqual(await host.run('warn'), { stderr: 'warning', stdout: 'ran:warn' }); checks += 1;
    await assert.rejects(host.run('fail'), (error) => error.code === 1 && error.stdout === 'partial' && /boom/.test(error.message)); checks += 1;
    assert.equal(await host.run('"x"; exit 2'), null, 'exit-code script is handed back to the caller'); checks += 1;
    const parallel = await Promise.all(['p1', 'p2', 'p3', 'p4'].map((name) => host.run(name)));
    assert.deepEqual(parallel.map((result) => result.stdout), ['ran:p1', 'ran:p2', 'ran:p3', 'ran:p4']); checks += 1;
    check(children.length === 2, `pool stays at its size (${children.length} workers)`);
    check(children.every((child) => !child.killed), 'healthy workers are reused');
    host.shutdown();
    check(children.every((child) => child.killed), 'shutdown stops every worker');
  }

  {
    // A script past its timeout: rejected like execFile, its worker retired, the next one runs.
    const { children, spawn } = createFakeSpawn((script) => (script === 'slow' ? 'hang' : { err: '', exitCode: 0, out: script }));
    const host = createPowerShellHost({ platform: 'win32', poolSize: 1, spawn });
    await assert.rejects(host.run('slow', { timeoutMs: 120 }), (error) => error.killed === true && error.signal === 'SIGTERM'); checks += 1;
    check(children[0].killed, 'timed-out worker is killed');
    assert.deepEqual(await host.run('next'), { stderr: '', stdout: 'next' }); checks += 1;
    check(children.length === 2 && !children[1].killed, 'a fresh worker took over');
    host.shutdown();
  }

  {
    // A worker that dies: that call falls back (null); after three in a row the host turns off.
    const { spawn } = createFakeSpawn(() => 'crash');
    const logged = [];
    const host = createPowerShellHost({ platform: 'win32', poolSize: 1, spawn, log: (message) => logged.push(message) });
    for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(await host.run('x'), null); checks += 1;
    check(!host.isEnabled() && logged.length === 1, 'host disabled after repeated worker failures');
    assert.equal(await host.run('x'), null); checks += 1;
  }

  check(createPowerShellHost({ platform: 'linux' }).isEnabled() === false, 'other platforms never start workers');
  if (process.platform !== 'win32') check(installSharedPowerShellHost() === null, 'no shared host off Windows');

  if (process.platform === 'win32') {
    // Real PowerShell: STA, output before `exit 0`, no variables leaking between scripts.
    const host = createPowerShellHost({ poolSize: 1 });
    const run = async (script) => (await host.run(script, { timeoutMs: 15_000 })).stdout.trim();
    check(await run('[System.Threading.Thread]::CurrentThread.GetApartmentState()') === 'STA', 'scripts run in an STA (clipboard, UI Automation)');
    check(await run('"before"; exit 0; "after"') === 'before', 'output before exit 0 is kept');
    await run('$leaky = 5');
    check(await run('"[" + $leaky + "]"') === '[]', 'variables do not leak into the next script');
    check(await run('"中文 第三次。"') === '中文 第三次。', 'Chinese text survives');
    await assert.rejects(host.run('throw "boom"', { timeoutMs: 15_000 }), (error) => error.code === 1 && /boom/.test(error.message)); checks += 1;
    host.shutdown();
  }

  console.log(`powershell host smoke ok: ${checks} checks`);
})().catch((error) => { console.error(error); process.exit(1); });
