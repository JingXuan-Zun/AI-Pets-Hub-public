import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import vm from 'node:vm';

function load(file: string, overrides: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const absolute = path.resolve('electron/appLauncher', file);
  const realRequire = createRequire(absolute);
  const module = { exports: {} as any };
  vm.runInNewContext(readFileSync(absolute, 'utf8'), {
    module, Buffer, process, Error, setTimeout, clearTimeout, ...globals,
    require: (name: string) => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
  }, { filename: absolute });
  return module.exports;
}

const { decodePowerShellOutput, compactPowerShellErrorText, stripPowerShellCliXml } = load('powerShellOutput.cjs', {});
assert.equal(decodePowerShellOutput(Buffer.from('中文输出', 'utf8')), '中文输出');
assert.equal(decodePowerShellOutput(Buffer.concat([Buffer.from([255, 254]), Buffer.from('Test 中文', 'utf16le')])), 'Test 中文');
assert.equal(decodePowerShellOutput(Buffer.alloc(0)), '');
assert.equal(stripPowerShellCliXml('\uFEFF result \n#< CLIXML noise'), 'result');
assert.equal(compactPowerShellErrorText('failure\n-EncodedCommand YWJjZA=='), 'failure -EncodedCommand <redacted>');
assert.equal(compactPowerShellErrorText('x'.repeat(950)).length, 900);

let writeFails = false, removeFails = false;
const writes = new Map<string, string>();
const removals: string[] = [];
const { createPowerShellExecutor } = load('powerShellExecutor.cjs', {
  fs: {
    writeFileSync: (file: string, text: string, encoding: string) => {
      assert.equal(encoding, 'utf8');
      assert.ok(text.startsWith('\uFEFF[Console]::OutputEncoding'), 'script files must preserve UTF-8 BOM and console encoding');
      if (writeFails) throw new Error('fixture write failed');
      writes.set(file, text);
    },
    rmSync: (file: string, options: { force: boolean }) => {
      assert.equal(options.force, true);
      removals.push(file);
      if (removeFails) throw new Error('fixture remove failed');
      writes.delete(file);
    },
  },
});
let executionFails = false;
const calls: any[] = [];
const executor = createPowerShellExecutor({ execFileAsync: async (file: string, args: string[], options: any) => {
  calls.push({ file, args, options });
  assert.equal(file, 'powershell.exe');
  assert.equal(options.encoding, 'buffer');
  assert.equal(options.windowsHide, true);
  if (executionFails) throw Object.assign(new Error('fixture execution failed'), { stderr: Buffer.from('stderr wins'), stdout: Buffer.from('stdout loses') });
  return Buffer.from('\uFEFF {"ok":true}\n#< CLIXML ignored');
} });
assert.equal(await executor.runPowerShellScript('Write-Output "中文"', 1700), '{"ok":true}');
assert.equal(calls[0].options.timeout, 1700);
assert.equal(calls[0].args.at(-2), '-EncodedCommand');
assert.ok(Buffer.from(calls[0].args.at(-1), 'base64').toString('utf16le').endsWith('Write-Output "中文"'));
const longScript = '# fixture\n'.repeat(2000);
assert.equal(await executor.runPowerShellScript(longScript), '{"ok":true}');
assert.equal(calls[1].args.at(-2), '-File');
assert.equal(removals.at(-1), calls[1].args.at(-1));
assert.equal(writes.size, 0);
executionFails = true;
await assert.rejects(executor.runPowerShellScript(longScript), /stderr wins/u);
assert.equal(removals.at(-1), calls[2].args.at(-1));
assert.equal(writes.size, 0);
writeFails = true;
const count = calls.length;
await assert.rejects(executor.runPowerShellScript(longScript), /fixture write failed/u);
assert.equal(calls.length, count, 'failed writes must not dispatch PowerShell');
assert.equal(removals.length, 3, 'cleanup must also run after write failure');
writeFails = false; executionFails = false; removeFails = true;
assert.equal(await executor.runPowerShellScript(longScript), '{"ok":true}', 'best effort cleanup must preserve successful output');

let child: EventEmitter & { unref: () => void }, unrefs = 0, spawnThrows = false;
let timeoutCallback: (() => void) | undefined;
const cleared: number[] = [];
let spawnOptions: any;
const processBridge = load('processBridge.cjs', {
  child_process: {
    execFile: (_file: string, _args: string[], options: any, callback: any) => callback(options.fixtureError, 'fixture stdout', 'fixture stderr'),
    spawn: (_file: string, _args: string[], options: any) => {
      if (spawnThrows) throw new Error('synchronous spawn failure');
      spawnOptions = options;
      child = Object.assign(new EventEmitter(), { unref: () => { unrefs++; } });
      return child;
    },
  },
}, { setTimeout: (callback: () => void) => { timeoutCallback = callback; return 123; }, clearTimeout: (id: number) => cleared.push(id) });
assert.equal(await processBridge.execFileAsync('fixture', []), 'fixture stdout');
const callbackError = new Error('callback failure');
await assert.rejects(processBridge.execFileAsync('fixture', [], { fixtureError: callbackError }), (error: any) => error === callbackError && error.stdout === 'fixture stdout' && error.stderr === 'fixture stderr');
let pending = processBridge.spawnDetachedAsync('fixture', [], { timeoutMs: 100 });
assert.equal(spawnOptions.detached, true);
assert.equal(spawnOptions.stdio, 'ignore');
assert.equal(spawnOptions.windowsHide, true);
assert.equal(Object.hasOwn(spawnOptions, 'timeoutMs'), false);
child!.emit('spawn'); await pending;
assert.equal(unrefs, 1); assert.equal(cleared.at(-1), 123);
child!.emit('error', new Error('late error')); // Settlement must remain successful.
pending = processBridge.spawnDetachedAsync('fixture', [], { timeoutMs: 100 });
child!.emit('error', new Error('asynchronous spawn failure'));
await assert.rejects(pending, /asynchronous spawn failure/u);
pending = processBridge.spawnDetachedAsync('fixture', [], { timeoutMs: 100 });
timeoutCallback!(); await assert.rejects(pending, /dispatch timed out/u);
spawnThrows = true;
await assert.rejects(processBridge.spawnDetachedAsync('fixture', []), /synchronous spawn failure/u);
console.log('app launcher process bridge smoke: PASS (encoding, errors, temporary cleanup, process settlement, timeout; isolated dispatch)');
