const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');

function createEnvironment(platform, mode) {
  const events = [], files = new Map(), clock = { now: 10000 };
  let sequence = 0, nativeX = 100, nativeY = 200;
  const nativeIcon = () => ({ index: 0, name: 'fixture', x: nativeX, y: nativeY, width: 96, height: 74, centerX: nativeX + 48, centerY: nativeY + 37, canMove: mode !== 'readonly', positionSource: 'shell-list-view' });
  const mockProcess = { platform, pid: 42, env: { PUBLIC: 'C:\\Public' }, cwd: () => 'C:\\Fixture' };
  const mockMath = Object.create(Math); mockMath.random = () => ++sequence / 10000;
  const app = { getPath(kind) { events.push(['path', kind]); return kind === 'temp' ? 'C:\\Temporary' : 'C:\\Desktop'; } };
  const screen = { screenToDipPoint(point) { events.push(['dip', point]); return { x: point.x / 2, y: point.y / 2 }; }, dipToScreenPoint(point) { events.push(['native', point]); return { x: point.x * 2, y: point.y * 2 }; } };
  const mockFs = {
    writeFileSync(file, script, encoding) { events.push(['write', file, encoding, createHash('sha256').update(script).digest('hex')]); files.set(file, script); },
    unlink(file, callback) { events.push(['unlink', file]); files.delete(file); callback(null); },
    existsSync(folder) { events.push(['exists', folder]); return true; },
    readdirSync(folder, options) { events.push(['directory', folder, options]); return [{ name: 'a.lnk', isDirectory: () => false }, { name: '文件夹', isDirectory: () => true }]; },
  };
  const child = { execFile(command, args, options, callback) {
    events.push(['exec', command, args, options]);
    const script = files.get(args.at(-1)), moving = /\$ok = \[DesktopPetDesktopIcon/.test(script);
    const error = Object.assign(new Error('native fixture failure'), { code: 1, signal: 'SIGTERM' });
    let stdout = '';
    if (moving) {
      nativeX = Number(script.match(/\$ScreenX = (.*)/)[1]); nativeY = Number(script.match(/\$ScreenY = (.*)/)[1]);
      stdout = mode === 'malformed-move' ? 'bad-json' : '{"ok":true}';
    } else stdout = mode === 'malformed-read' ? 'bad-json' : mode === 'empty' ? '[]' : JSON.stringify([nativeIcon()]);
    queueMicrotask(() => callback((moving && mode === 'move-error') || (!moving && mode === 'read-error') ? error : null, stdout, 'stderr fixture evidence'));
  } };
  const log = (message, details) => events.push(['log', message, typeof details === 'string' ? details.split('\n')[0] : details]);
  return { events, files, clock, app, screen, log, mockProcess, mockMath, mockFs, child };
}

function loadService(environment, baseline) {
  const modules = new Map(), root = path.resolve('electron/desktopIconService.cjs');
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const requireFixture = name => {
      if (name === 'fs') return environment.mockFs;
      if (name === 'path') return path.win32;
      if (name === 'child_process') return environment.child;
      assert.ok(name.startsWith('.'), `unexpected dependency: ${name}`);
      const dependency = path.resolve(path.dirname(file), name);
      assert.ok(dependency.startsWith(path.resolve('electron/desktopIcons') + path.sep));
      return load(dependency);
    };
    const source = file === root && baseline ? baseline : fs.readFileSync(file, 'utf8');
    new Function('require', 'module', 'process', 'Date', 'Math', source)(requireFixture, module, environment.mockProcess, { now: () => environment.clock.now }, environment.mockMath);
    return module.exports;
  }
  return load(root).createDesktopIconService;
}

async function capture(promise) {
  try { return { value: await promise }; }
  catch (error) { return { error: error.name, message: error.message }; }
}

async function runScenario(platform, mode, space, baseline) {
  const environment = createEnvironment(platform, mode), createService = loadService(environment, baseline);
  const service = createService({ app: environment.app, screen: environment.screen, log: environment.log });
  const secondService = createService({ app: environment.app, screen: environment.screen, log: environment.log });
  assert.deepEqual(environment.events, [], 'real service initialization does not access native/path capabilities');
  assert.deepEqual(Object.keys(service), ['invalidate', 'listDesktopIcons', 'moveDesktopIcon']);
  const outcomes = [];
  outcomes.push(await capture(service.listDesktopIcons({ coordinateSpace: space })));
  const beforeCached = environment.events.filter(event => event[0] === 'exec').length;
  outcomes.push(await capture(service.listDesktopIcons({ coordinateSpace: 'native-screen' })));
  if (platform === 'win32' && ['normal', 'empty', 'readonly', 'move-error', 'malformed-move'].includes(mode)) assert.equal(environment.events.filter(event => event[0] === 'exec').length, beforeCached);
  const first = capture(service.listDesktopIcons({ forceRefresh: true, coordinateSpace: 'dip' }));
  const second = capture(service.listDesktopIcons({ forceRefresh: true, coordinateSpace: 'native-screen' }));
  service.invalidate();
  outcomes.push(...await Promise.all([first, second]));
  outcomes.push(await capture(service.moveDesktopIcon({ iconId: 'desktop-icon-0', x: 111, y: 222, coordinateSpace: space })));
  if (platform === 'win32' && mode === 'normal') assert.equal(outcomes.at(-1).value.verified, true);
  environment.clock.now += 5001; service.invalidate();
  outcomes.push(await capture(service.listDesktopIcons({ includeFileSystemFallback: true, includeReadOnlyPositionFallback: true, coordinateSpace: space })));
  const beforeIndependent = environment.events.filter(event => event[0] === 'exec').length;
  outcomes.push(await capture(secondService.listDesktopIcons({ coordinateSpace: space })));
  if (platform === 'win32') assert.equal(environment.events.filter(event => event[0] === 'exec').length, beforeIndependent + 1, 'separate services do not share cache');
  assert.equal(environment.files.size, 0, 'all native callback temporary files were cleaned');
  return { platform, mode, space, outcomes, events: environment.events };
}

function checkProductionWiring() {
  const main = fs.readFileSync('electron/main.cjs', 'utf8'), ipc = fs.readFileSync('electron/ipcHandlers.cjs', 'utf8');
  assert.match(main, /const desktopIconService = createDesktopIconService\(\{\s*app,[\s\S]*runtimeLogger\.log\('backend', 'desktop-icons', message, details\),\s*screen,/);
  assert.match(main, /const handleDisplayEnvironmentChange = \(\) => \{\s*captureService\.invalidateCaptureSourceCache\(\);\s*desktopIconService\.invalidate\(\);/);
  for (const [channel, method, argument] of [['list-desktop-icons', 'listDesktopIcons', 'options'], ['move-desktop-icon', 'moveDesktopIcon', 'request']]) {
    assert.match(ipc, new RegExp(`'desktop-pet:${channel}', async \\(_event, ${argument}\\) => \\{\\s*return desktopIconService\\.${method}\\(${argument} \\?\\? \\{\\}\\);`));
  }
  const source = fs.readFileSync('electron/desktopIconService.cjs', 'utf8'), ast = ts.createSourceFile('service.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const root = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createDesktopIconService');
  const state = root.body.statements.filter(ts.isVariableStatement).filter(node => (node.declarationList.flags & ts.NodeFlags.Let) !== 0);
  assert.deepEqual(state.flatMap(node => node.declarationList.declarations.map(declaration => declaration.name.text)), ['cachedIcons', 'cacheUpdatedAt', 'pendingRequest']);
}

async function exercise(baseline) {
  const records = [];
  for (const platform of ['win32', 'linux']) for (const mode of ['normal', 'empty', 'read-error', 'move-error', 'readonly', 'malformed-read', 'malformed-move']) for (const space of ['dip', 'native-screen']) records.push(await runScenario(platform, mode, space, baseline));
  return records;
}

async function main() {
  const current = await exercise();
  if (process.argv[2]) assert.deepEqual(current, await exercise(fs.readFileSync(process.argv[2], 'utf8')));
  checkProductionWiring();
  console.log(`Desktop icon service integration passed (${current.length} scenarios, seven requests across two independent services each${process.argv[2] ? ', original behavior identical except stack location normalization' : ''}; real helpers, controlled native bridge and production wiring).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
