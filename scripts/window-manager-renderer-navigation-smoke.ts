import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';
const require = createRequire(import.meta.url);
const actualFactory = require('../electron/windowManager/rendererNavigation.cjs').createRendererNavigation;
const actualBuilder = require('../electron/windowManager/rendererQuery.cjs').buildRendererQuery;
const queryKeys = ['localTestDebugModelPath', 'localTestDesktopModelPath', 'localTestDebugModelScale',
  'localTestDesktopModelScale', 'localTestDebugFocusX', 'localTestDebugFocusY', 'localTestMenuPausePetId',
  'localTestMenuPauseOpenDelayMs', 'localTestMenuPauseWaitForMovementMs', 'localTestMenuPauseObserveMs',
  'localTestMenuPauseThresholdPx', 'localTestDragPrimaryPetId', 'localTestPrimarySnapBackPetId',
  'localTestDragCompanionPetId', 'localTestDragStartDelayMs', 'localTestDragWaitForMovementMs',
  'localTestDragObserveMs', 'localTestDragSampleIntervalMs', 'localTestDragDeltaX', 'localTestDragDeltaY',
  'localTestDragStepThresholdPx'];
function optionsFor(mask: number, probe: boolean) {
  const result: any = Object.fromEntries(queryKeys.map((key, index) => [key,
    !(mask & (1 << (index % 3))) ? '' : index === 0 ? 'D:\\模型 & 雪\\角色.vrm'
      : index === 1 ? 'F:\\桌宠\\角色.model3.json' : index < 6 ? '0' : `${key} & + / 雪`]));
  return Object.freeze({ ...result, pointerDiagnosticsEnabled: Boolean(mask & 1),
    forceFullShapeOnDragEnabled: Boolean(mask & 2), live2DDragProbeEnabled: probe });
}
function expectedQuery(query: any, options: any) {
  const result = { ...query };
  for (const [index, key] of queryKeys.entries()) {
    if (!options[key]) continue;
    const target = index === 0 ? 'debugModelPathBase64' : index === 1 ? 'desktopDebugModelPathBase64'
      : index === 2 ? 'debugModelScale' : index === 3 ? 'desktopDebugModelScale'
        : index === 4 ? 'debugFocusX' : index === 5 ? 'debugFocusY' : key;
    result[target] = index < 2 ? Buffer.from(options[key], 'utf8').toString('base64') : options[key];
  }
  for (const [key, target] of [['pointerDiagnosticsEnabled', 'pointerDiagnostics'],
    ['forceFullShapeOnDragEnabled', 'forceFullShapeOnDrag'], ['live2DDragProbeEnabled', 'live2dDragProbe']]) {
    if (options[key]) result[target] = '1';
  }
  return result;
}
export function exerciseRendererNavigation(factory = actualFactory) {
  const outputs: unknown[] = [];
  for (const dev of [false, true]) for (const probe of [false, true]) for (let mask = 0; mask < 8; mask++) {
    for (const navigation of ['none', 'noncatch', 'resolved', 'rejected']) for (const query of ['default', 'null', 'custom']) {
      outputs.push(exercise(dev, probe, mask, navigation, query));
    }
  }
  const urls = ['', 'invalid', 'http://localhost/?panel=settings', 'https://example.com/?panel=settings',
    'file:///D:/app/dist/index.html?panel=settings', 'file:///D:/app/dist/INDEX.HTML?panel=settings',
    'file:///D:/app/dist/other.html?panel=settings', 'file:///D:/app/dist/index.html?panel=chat',
    'ftp://example.com/index.html?panel=settings', 'file:///index.html?panel=settings&panel=chat',
    'file:///index.html?panel=chat&panel=settings', 'https://example.com/?panel=Settings',
    'file:///D:/index.html/?panel=settings', 'file:///D:/index.html?panel=%73ettings'];
  for (const dev of [false, true]) for (const state of ['null', 'destroyed', 'alive']) for (const url of urls) {
    const calls: string[] = [], api = factory({isDev: dev, path, baseDirectory: '/manager',
      queryOptions: optionsFor(0, false), logWindowEvent: () => assert.fail('URL checking must not log')});
    const win = state === 'null' ? null : {isDestroyed() {calls.push('destroyed'); return state === 'destroyed';},
      webContents: {getURL() {calls.push('url'); return url;}}};
    const result = api.isSettingsWindowAtSettingsPanelUrl(win);
    const valid = dev ? urls.indexOf(url) === 2 || urls.indexOf(url) === 3 : [4, 5, 9, 13].includes(urls.indexOf(url));
    assert.equal(result, state === 'alive' && valid);
    assert.deepEqual(calls, state === 'null' ? [] : state === 'destroyed' ? ['destroyed'] : ['destroyed','url']);
    outputs.push({dev,state,url,result,calls});
  }
  for (const failure of ['load', 'join', 'catch:get', 'catch:call', 'destroyed', 'title', 'log', 'query', 'late-log', 'late-title']) {
    outputs.push(exercise(false, ['destroyed','title','log'].includes(failure), 7, 'rejected', 'custom', failure));
  }
  for (const failure of ['destroyed', 'url']) {
    const error = new Error('URL access error'), calls: string[] = [];
    const api = factory({isDev: false,path,baseDirectory: '/manager',queryOptions: optionsFor(0,false),logWindowEvent() {}});
    assert.throws(() => api.isSettingsWindowAtSettingsPanelUrl({isDestroyed() {calls.push('destroyed'); if(failure==='destroyed')throw error; return false;},
      webContents: {getURL() {calls.push('url'); throw error;}}}), caught => caught === error);
    outputs.push({failure,calls});
  }
  return outputs;

  function exercise(dev: boolean, probe: boolean, mask: number, navigation: string, mode: string, failure?: string) {
    const calls: any[] = [], error = new Error('navigation dependency error'); let activeFailure=failure;
    let title = 'main-window', destroyed = false, rejection: ((error: any) => void) | undefined;
    const step = (name: string, ...args: any[]) => { calls.push([name,...args]); if (name === activeFailure) throw error; };
    const options = optionsFor(mask, probe), custom = Object.freeze({desktop:'custom',panel:'settings',
      debugModelPathBase64:'caller-path',debugModelScale:'caller-scale',pointerDiagnostics:'caller-pointer',
      localTestMenuPausePetId:'caller-id',extra:'中文 & + #',zero:0});
    const query = mode === 'default' ? undefined : mode === 'null' ? null : failure === 'query'
      ? {get desktop() {step('query'); return '1';}} : custom;
    const expected = expectedQuery(mode === 'default' ? {desktop:'1'} : failure === 'query' ? {} : query, options);
    const token = { get catch() {step('catch:get'); return function(this: any, callback: any) {
      assert.equal(this,token); step('catch:call'); if(navigation==='rejected')rejection=callback; return {ignored:true};
    };}};
    const win = {isDestroyed() {step('destroyed'); return destroyed;}, getTitle() {step('title'); return title;},
      loadURL(url: string) {step('load',url); return result();},
      loadFile(file: string, settings: any) {step('load',file,settings); assert.deepEqual(settings.query,expected); return result();}};
    const api = factory({isDev:dev,baseDirectory:'D:\\app\\electron',queryOptions:options,
      path:{join(...args: string[]) {step('join',args); return path.join(...args);}},
      logWindowEvent(message: string) {step('log',message);}});
    assert.deepEqual(calls, [], 'adapter creation must not navigate, encode paths or log');
    let failed = false;
    try {
      assert.equal(api.loadRenderer(win,query),undefined, 'loadRenderer retains its original void return');
      if (dev) assert.ok(calls.some(call=>call[0]==='load'&&call[1]===`http://127.0.0.1:3000/?${new URLSearchParams(expected).toString()}`));
      else assert.ok(calls.some(call=>call[0]==='join'&&call[1][0]==='D:\\app\\electron'));
      if (rejection) {
        title='latest-title'; destroyed=mask===0;
        activeFailure = failure === 'late-log' ? 'log' : failure === 'late-title' ? 'title' : failure;
        rejection({stack:'navigation stack',toString:()=> 'fallback error'});
        assert.ok(calls.some(call=>call[0]==='log'&&call[1]===`loadRenderer: failed for ${destroyed?'destroyed-window':title} query=${JSON.stringify(expected)} error=navigation stack`));
      }
    } catch(caught) {assert.ok(failure);assert.equal(caught,error);assert.equal(calls.at(-1)[0],activeFailure);failed=true;}
    assert.equal(failed,Boolean(failure));
    return JSON.parse(JSON.stringify({dev,probe,mask,navigation,mode,failure,calls,failed}));
    function result() {return navigation==='none'?undefined:navigation==='noncatch'?{catch:42}:token;}
  }
}
export function exerciseRendererQuery(builder = actualBuilder) {
  const outputs: unknown[] = [];
  for (let mask=0;mask<8;mask++) for (const probe of [false,true]) {
    const options=optionsFor(mask,probe), query=Object.freeze({desktop:'1',debugFocusX:'caller',debugModelPathBase64:'caller',extra:'雪'});
    const result=builder(query,options);assert.deepEqual(result,expectedQuery(query,options));assert.notEqual(result,query);
    outputs.push(result);
  }
  return outputs;
}
export function exerciseNavigationInitialization(factory = actualFactory) {
  const outputs: unknown[] = [];
  for (const dev of [false, true]) for (const initialProbe of [false, true]) for (const failProbeRead of [false, true]) {
    const calls: unknown[][] = [], error = new Error('initial probe read');
    let probe = initialProbe;
    const options = { get live2DDragProbeEnabled() {
      calls.push(['probe', probe]); if (failProbeRead) throw error; return probe;
    } };
    let api: any, caught: unknown;
    try {
      api = factory({ isDev: dev, path, baseDirectory: '/manager', queryOptions: options,
        logWindowEvent: (message: string) => calls.push(['log', message]) });
    } catch (value) { caught = value; }
    assert.equal(caught, failProbeRead ? error : undefined);
    assert.deepEqual(calls, [['probe', initialProbe]], 'creation retains the single original probe read');
    if (!failProbeRead) {
      probe = !initialProbe;
      const win = { isDestroyed: () => false, getTitle: () => 'live-title',
        webContents: { getURL: () => dev ? 'http://localhost/?panel=settings' : 'file:///index.html?panel=settings' },
        loadURL: (url: string) => { calls.push(['url', url]); },
        loadFile: (file: string, settings: unknown) => { calls.push(['file', file, settings]); } };
      assert.deepEqual(Object.keys(api), ['isSettingsWindowAtSettingsPanelUrl', 'loadRenderer']);
      assert.equal(api.isSettingsWindowAtSettingsPanelUrl(win), true);
      assert.equal(api.loadRenderer(win), undefined);
      assert.equal(calls.filter(call => call[0] === 'log').length, initialProbe ? 1 : 0,
        'diagnostic gate captures the initial probe while query construction reads current options');
      assert.deepEqual(calls.filter(call => call[0] === 'probe'), [['probe', initialProbe], ['probe', !initialProbe]]);
    }
    outputs.push({ dev, initialProbe, failProbeRead, calls });
  }
  return outputs;
}
const manager=readModuleProjectFunction('electron/windowManager/rendererNavigation.cjs','createWindowManagerRendererNavigation');
assert.match(manager,/createRendererNavigation\(\{\s*isDev, path, baseDirectory, logWindowEvent,/u);
const managerModules=readModuleProjectFile('electron/windowManager.cjs');
for(const key of [...queryKeys,'pointerDiagnosticsEnabled','forceFullShapeOnDragEnabled','live2DDragProbeEnabled']) assert.match(managerModules,new RegExp(`\\b${key}\\b`,'u'));
assert.equal(exerciseRendererQuery().length,16);
assert.equal(exerciseRendererNavigation().length,480);
assert.equal(exerciseNavigationInitialization().length,8);
console.log('Renderer query/navigation smoke passed (16 query + 480 navigation/URL + 8 initialization cases; overrides/Unicode/defaults/void return/live rejection/errors).');
