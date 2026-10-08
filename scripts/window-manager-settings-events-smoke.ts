import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';
const ownershipStateSource = readModuleProjectFile('electron/windowManager/windowOwnershipStateAdapters.cjs');

const require=createRequire(import.meta.url);
const actualFactory=require('../electron/windowManager/settingsWindowEvents.cjs').createSettingsWindowEventRegistrar;
const events=['did-finish-load','close','show','hide','focus','restore','move','resize','closed'];
export function exerciseSettingsWindowEvents(factory=actualFactory) {
  const outputs: unknown[]=[];
  for(const diagnostics of [false,true])for(const current of ['self','other','null'])for(const quitting of [false,true])for(const destroyed of [false,true])for(const visible of [false,true])for(const loading of [false,true]) {
    outputs.push(exercise({diagnostics,current,quitting,destroyed,visible,loading}));
  }
  for(const failure of ['open-handler',...events.map(event=>'register:'+event)])outputs.push(exercise({},'attach',failure));
  const failures: Record<string,string[]>={open:['external'], 'did-finish-load':['getWindow','destroyed','broadcast','visible','refresh'],
    close:['quitting','prevent','window-hide'],show:['border','notify','broadcast','stack','top','loading','refresh'],
    hide:['notify','stack','quitting','main-ready'],focus:['top'],restore:['top'],move:['top'],resize:['top'],
    closed:['getWindow','clearWindow','clearPromise','notify']};
  for(const [event,errors] of Object.entries(failures))for(const failure of errors)outputs.push(exercise({},event,failure));
  for(const [race,event] of [['destroyed','did-finish-load'],['prevent','close'],['notify','hide']])outputs.push(exercise({race},event));
  return outputs;
  function exercise(config: any,target?: string,failure?: string) {
    config={diagnostics:true,current:'self',quitting:false,destroyed:false,visible:true,loading:false,...config};
    const calls: any[]=[],callbacks=new Map<string,any>(),error=new Error('settings event error');
    const shell={identity:'shell'},other={identity:'other'};let current: any,quitting=config.quitting,ready: any={pending:true};
    let enabledFailure=target==='attach'?failure:undefined;
    const step=(name: string,...args: any[])=>{calls.push([name,...args.map(arg=>arg===win?'window':arg===other?'other':arg===shell?'shell':arg)]);if(name===enabledFailure)throw error;};
    const register=(kind: string,event: string,callback: any)=>{step('register:'+event,kind);callbacks.set(event,{callback,once:kind==='once'});};
    const win={webContents:{setWindowOpenHandler(callback: any){step('open-handler');callbacks.set('open',{callback,once:false});},once:(event: string,callback: any)=>register('once',event,callback),isLoadingMainFrame(){step('loading');return config.loading;}},
      on:(event: string,callback: any)=>register('on',event,callback),isDestroyed(){step('destroyed');if(config.race==='destroyed')current=other;return config.destroyed;},isVisible(){step('visible');return config.visible;},hide(){step('window-hide');}};
    current=config.current==='self'?win:config.current==='other'?other:null;
    const dependencies={shell,openExternalSafely(actualShell: any,url: string){assert.equal(actualShell,shell);step('external',actualShell,url);return {ignored:true};},
      getSettingsWindow(){step('getWindow');return current;},getIsQuitting(){step('quitting');return quitting;},
      clearSettingsWindow(){step('clearWindow');current=null;},clearSettingsWindowReadyPromise(){step('clearPromise');ready=null;},
      broadcastSharedState(){step('broadcast');},scheduleSettingsWindowContentRefresh(){step('refresh');},
      disableDwmSystemBorderForWindow(actualWin: any){assert.equal(actualWin,win);step('border',actualWin);return {ignored:true};},
      notifySettingsWindowState(){step('notify');if(config.race==='notify')quitting=true;},scheduleWindowStackOnTop(){step('stack');},
      scheduleKeepWindowOnTop(actualWin: any,level: number){assert.equal(actualWin,win);assert.equal(level,3);step('top',actualWin,level);return 'top-result';},
      AUX_TOPMOST_RELATIVE_LEVEL:3,HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS:config.diagnostics,
      showMainWindowWhenReady(reason: string){step('main-ready',reason);}};
    const attach=factory(dependencies);assert.deepEqual(calls,[],'factory creation must not read live state or register listeners');
    let failed=false;
    try {
      assert.equal(attach(win),undefined);assert.deepEqual(calls.map(call=>call[0]),['open-handler',...events.map(event=>'register:'+event)]);
      assert.equal(calls[1][1],'once');assert.ok(calls.slice(2).every(call=>call[1]==='on'));
      assert.equal(current,config.current==='self'?win:config.current==='other'?other:null);
      enabledFailure=failure;
      if(target&&target!=='attach') {
        const start=calls.length;invoke(target);
        if(config.race==='destroyed'){assert.equal(current,other);assert.deepEqual(calls.slice(start).map(call=>call[0]),['getWindow','destroyed','broadcast','visible','refresh']);}
        if(config.race==='prevent'){assert.equal(quitting,true);assert.deepEqual(calls.slice(start).map(call=>call[0]),['quitting','prevent','window-hide']);}
        if(config.race==='notify'){assert.equal(quitting,true);assert.deepEqual(calls.slice(start).map(call=>call[0]),['notify','stack','quitting']);}
      } else if(!target) {
        for(let round=0;round<2;round++) {
          if(round){quitting=!quitting;current=other;ready={newer:true};}
          const openResult=invoke('open');assert.deepEqual(openResult,{action:'deny'});
          for(const event of events) {
            const start=calls.length,wasCurrent=current,wasQuitting=quitting;
            const result=invoke(event),names=calls.slice(start).map(call=>call[0]);
            if(event==='did-finish-load')assert.deepEqual(names,round?[]:wasCurrent!==win?['getWindow']:config.destroyed?['getWindow','destroyed']:['getWindow','destroyed','broadcast','visible',...(config.visible?['refresh']:[])]);
            if(event==='close')assert.deepEqual(names,wasQuitting?['quitting']:['quitting','prevent','window-hide']);
            if(event==='show')assert.deepEqual(names,['border','notify','broadcast','stack','top','loading',...(config.loading?[]:['refresh'])]);
            if(event==='hide')assert.deepEqual(names,['notify','stack',...(config.diagnostics?['quitting',...(!wasQuitting?['main-ready']:[])]:[])]);
            if(['focus','restore','move','resize'].includes(event)){assert.deepEqual(names,['top']);assert.equal(result,'top-result');}
            if(event==='closed'){assert.equal(current,wasCurrent===win?null:wasCurrent);assert.equal(ready,null);assert.deepEqual(names,['getWindow',...(wasCurrent===win?['clearWindow']:[]),'clearPromise','notify']);}
          }
        }
      }
    }catch(caught){assert.ok(failure);assert.equal(caught,error);assert.equal(calls.at(-1)[0],failure);failed=true;}
    assert.equal(failed,Boolean(failure));
    return JSON.parse(JSON.stringify({config,target,failure,calls,current:current===win?'window':current===other?'other':current,quitting,ready,failed}));
    function invoke(event: string){const entry=callbacks.get(event);if(!entry)return undefined;if(entry.once)callbacks.delete(event);return event==='open'?entry.callback({url:'https://example.com/safe'}):event==='close'?entry.callback({preventDefault(){step('prevent');if(config.race==='prevent')quitting=true;}}):entry.callback();}
  }
}
const manager=readModuleProjectFunction('electron/windowManager.cjs','createWindowManager');
assert.match((manager + ownershipStateSource),/getIsQuitting: \(\) => managerState\.isQuitting/u);
const assembly=readModuleProjectFunction('electron/windowManager/settingsWindowControllers.cjs','createSettingsWindowControllers');
assert.match(assembly,/getSettingsWindow, getIsQuitting, clearSettingsWindow, clearSettingsWindowReadyPromise/u);
assert.match((manager + ownershipStateSource),/clearSettingsWindow: \(\) => \{ managerState\.settingsWindow = null; \}/u);
assert.match((manager + ownershipStateSource),/clearSettingsWindowReadyPromise: \(\) => \{ managerState\.settingsWindowReadyPromise = null; \}/u);
const creator=readModuleProjectFunction('electron/windowManager/settingsWindowLifecycle.cjs','createSettingsWindowCreator');
assert.match(assembly,/createSettingsWindowCreator\(\{[\s\S]*?scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachSettingsWindowEvents, loadRenderer,/u);
assert.match(creator,/scheduleKeepWindowOnTop\(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL\);\s*attachSettingsWindowEvents\(nextSettingsWindow\);\s*loadRenderer\(nextSettingsWindow, \{ desktop: '1', panel: 'settings' \}\)/u);
assert.equal(exerciseSettingsWindowEvents().length,137);
console.log('Settings window events smoke passed (137 scenarios; 96 with two event rounds; live state/ownership/once vs on/order/races/returns/errors).');
