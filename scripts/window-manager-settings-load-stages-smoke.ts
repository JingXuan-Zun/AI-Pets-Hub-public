import { expandAuxiliaryWindowContentSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';
const ownershipStateSource = readModuleProjectFile('electron/windowManager/windowOwnershipStateAdapters.cjs');

const require=createRequire(import.meta.url);
const actual=require('../electron/windowManager/settingsWindowLoadStages.cjs');
const manager=expandAuxiliaryWindowContentSource(readModuleProjectFunction('electron/windowManager.cjs','createWindowManager'));
export async function exerciseSettingsWindowLoadStages(api=actual) {
  const outputs: unknown[]=[];
  const events=['did-finish-load','did-fail-load','closed'];
  const sequences=[[],[0],[1],[2],[0,2],[1,0],[2,1],[0,1,2],[1,2,0],[2,0,1]];
  for(const sequence of sequences) for(const immediate of [-1,0,1,2]) await wait(sequence,immediate);
  for(const failure of events) await wait([0,1,2],-1,failure);
  for(const force of [false,true,undefined,'forced']) for(const swap of [false,true]) for(const size of [0,1,3]) refresh(force,swap,size);
  for(const failure of ['display','windows','environment','capture'])refresh(true,true,1,failure);
  return outputs;

  async function wait(sequence: number[], immediate: number, failure?: string) {
    const calls: string[]=[],callbacks=new Map<string,()=>void>(),error=new Error('registration error');
    const win={webContents:{once:register},once:register};
    function register(event: string,callback: ()=>void) {
      calls.push(event);if(event===failure)throw error;callbacks.set(event,callback);
      if(events.indexOf(event)===immediate)callback();
    }
    const promise=api.waitForSettingsWindowLoad(win);
    assert.ok(promise instanceof Promise);
    let settled=false,value: unknown='pending',rejected=false;
    const observe=promise.then((result: unknown)=>{settled=true;value=result;},(caught: unknown)=>{assert.equal(caught,error);settled=true;rejected=true;});
    await Promise.resolve();
    assert.equal(settled,immediate>=0||Boolean(failure));
    for(const index of sequence){callbacks.get(events[index])?.();callbacks.get(events[index])?.();}
    await Promise.resolve();
    const first=immediate>=0?immediate:sequence.length?sequence[0]:-1;
    if(failure)assert.ok(rejected);else if(first>=0){assert.ok(settled);assert.equal(value,first===2?null:win);}else assert.equal(settled,false);
    if(settled)await observe;
    assert.deepEqual(calls, failure?events.slice(0,events.indexOf(failure)+1):events);
    outputs.push({sequence,immediate,failure,calls,settled,rejected,value:value===win?'window':value});
  }
  function refresh(force: unknown,swap: boolean,size: number,failure?: string) {
    const calls: unknown[][]=[],error=new Error('refresh dependency error');
    let windows=Array.from({length:size},(_,id)=>({id}));const newer=[{id:99}];
    const step=(name: string,...args: unknown[])=>{calls.push([name,...args]);if(name===failure)throw error;};
    const options={captureService:{scheduleDisplayEnvironmentBroadcast(payload: any) {step('environment',payload);assert.equal(payload.windows,windows);return {ignored:true};},
      scheduleCaptureSourceRefreshBroadcast(delay: number,payload: any){step('capture',delay,payload);assert.equal(payload.force,force);}},
      scheduleSettingsWindowDisplayRefresh(){step('display');if(swap)windows=newer;},getShellRendererWindows(){step('windows');return windows;},
      DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS:120,SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS:1600};
    const run=api.createSettingsWindowContentRefresh(options);assert.deepEqual(calls,[]);
    let failed=false;try {assert.equal(run(force),undefined);assert.deepEqual(calls.map(call=>call[0]),force?['display','windows','environment','capture']:['display','windows','environment']);}
    catch(caught){assert.ok(failure);assert.equal(caught,error);assert.equal(calls.at(-1)?.[0],failure);failed=true;}
    assert.equal(failed,Boolean(failure));outputs.push(JSON.parse(JSON.stringify({force,swap,size,failure,calls,failed})));
  }
}
// Exercise the actual cooldown factory with root-owned state and an isolated clock.
const {createSettingsWindowContentScheduler}=require('../electron/windowManager/settingsWindowContentScheduler.cjs');
function createCooldown(clock: {now:()=>number},refreshSettingsWindowContent: any) {
  let at=0;
  const run=createSettingsWindowContentScheduler({getContentRefreshAt:()=>at,setContentRefreshAt:(value: number)=>{at=value;},
    getCurrentTime:()=>clock.now(),refreshSettingsWindowContent,SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS:5000});
  return {run,at:()=>at};
}
for(const now of [0,4999,5000,5001,10000]) for(const forceDisplayRefresh of [false,true]) for(const forceCaptureSourceRefresh of [false,true]) {
  const calls: unknown[]=[],api=createCooldown({now:()=>now},(force: unknown)=>{calls.push(force);});
  api.run({forceDisplayRefresh,forceCaptureSourceRefresh});
  const refreshed=forceDisplayRefresh||now>5000;
  assert.deepEqual(calls,refreshed?[forceCaptureSourceRefresh]:[]);assert.equal(api.at(),refreshed?now:0);
  api.run();assert.equal(calls.length,refreshed?1:0,'second call at the same clock time must be cooled down');
}
// Root owns its ready Promise; finalization must not clear a newer one.
const readySource=readModuleProjectFunction('electron/windowManager/settingsWindowLifecycle.cjs','createSettingsWindowReadiness');
const {createSettingsWindowReadiness}=require('../electron/windowManager/settingsWindowLifecycle.cjs');
function createReady(waitForSettingsWindowLoad: any,createSettingsWindow: any) {
  let settingsWindow: any=null,settingsWindowReadyPromise: any=null;
  const controls=createSettingsWindowReadiness({getSettingsWindow:()=>settingsWindow,getReadyPromise:()=>settingsWindowReadyPromise,
    setReadyPromise:(promise: any)=>{settingsWindowReadyPromise=promise;},waitForSettingsWindowLoad,createSettingsWindow});
  return {run:controls.ensureSettingsWindowReady,read:()=>settingsWindowReadyPromise,set:(promise: any)=>{settingsWindowReadyPromise=promise;},window:(win: any)=>{settingsWindow=win;}};
}
for(const event of ['did-finish-load','did-fail-load','closed'])for(const replaced of [false,true]) {
  const callbacks=new Map<string,()=>void>();const win={isDestroyed:()=>false,webContents:{isLoadingMainFrame:()=>true,once:(event: string,callback: ()=>void)=>callbacks.set(event,callback)},once:(event: string,callback: ()=>void)=>callbacks.set(event,callback)};
  const api=createReady(actual.waitForSettingsWindowLoad,()=>win);const pending=api.run();assert.equal(api.run(),pending);assert.equal(api.read(),pending);
  const newer=Promise.resolve('newer');if(replaced)api.set(newer);callbacks.get(event)!();assert.equal(await pending,event==='closed'?null:win);assert.equal(api.read(),replaced?newer:null);
}
assert.match(manager,/createSettingsWindowContentRefresh\(\{\s*captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,/u);
assert.match(readySource,/waitForSettingsWindowLoad\(nextSettingsWindow\)\.finally\(/u);
assert.match((manager + ownershipStateSource),/getReadyPromise: \(\) => managerState\.settingsWindowReadyPromise/);
assert.match((manager + ownershipStateSource),/setReadyPromise: \(promise\) => \{ managerState\.settingsWindowReadyPromise = promise; \}/);
assert.equal((await exerciseSettingsWindowLoadStages()).length,71);
console.log('Settings load stages smoke passed (71 stage scenarios + 20 cooldown and 6 root Promise ownership cases).');
