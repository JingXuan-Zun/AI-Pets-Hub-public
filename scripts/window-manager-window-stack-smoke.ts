import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),actual=require('../electron/windowManager/windowStackTopmost.cjs').createWindowStackTopmost;
export function exerciseWindowStack(factory=actual) {
  const outputs: unknown[]=[];
  for(const scheduled of [false,true]) {
    for(const main of [false,true])for(const proxy of [false,true])run(scheduled,main,proxy);
    for(const failure of ['main','proxy','top0','top1','aux','border','area'])run(scheduled,true,true,failure);
    for(const race of ['main','proxy','top0','top1','aux','border','area'])run(scheduled,true,true,undefined,race);
    run(scheduled,true,true,undefined,'options');
  }
  return outputs;
  function run(scheduled: boolean,mainPresent: boolean,proxyPresent: boolean,failure?: string,race?: string) {
    const calls: any[][]=[],error=new Error('stack error'),seen: any[]=[];let main: any=mainPresent?{id:'main'}:null,proxy: any=proxyPresent?{id:'proxy'}:null,top=0,threw=false;
    const newMain={id:'new-main'},newProxy={id:'new-proxy'};
    const step=(name: string,value?: unknown)=>{calls.push([name,value]);if(name===failure)throw error;if(name===race){main=newMain;proxy=newProxy;}};
    function place(win: any,level: number,options: any) {
      const index=top++;assert.equal(level,index===0?7:8);assert.deepEqual(options,{bringToFront:true});assert.ok(!seen.includes(options));seen.push(options);
      step('top'+index,{id:win?.id??null,level,options:{...options},scheduled});if(race==='options')options.bringToFront=false;return 'ignored';
    }
    const deps={getMainWindow(){step('main',main?.id??null);return main;},getInputProxyWindow(){step('proxy',proxy?.id??null);return proxy;},MAIN_TOPMOST_RELATIVE_LEVEL:7,POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL:8,
      keepWindowOnTop:(...args: any[])=>{assert.equal(scheduled,false);return place(args[0],args[1],args[2]);},scheduleKeepWindowOnTop:(...args: any[])=>{assert.equal(scheduled,true);return place(args[0],args[1],args[2]);},
      keepAuxWindowsOnTop:()=>{assert.equal(scheduled,false);step('aux');return 'ignored';},keepPersistentAreaBorderOnTop:()=>{assert.equal(scheduled,false);step('border');return 'ignored';},keepAreaPickerOnTop:()=>{assert.equal(scheduled,false);step('area');return 'ignored';},
      scheduleAuxWindowsOnTop:()=>{assert.equal(scheduled,true);step('aux');return 'ignored';},schedulePersistentAreaBorderOnTop:()=>{assert.equal(scheduled,true);step('border');return 'ignored';},scheduleAreaPickerOnTop:()=>{assert.equal(scheduled,true);step('area');return 'ignored';}};
    const api=factory(deps);assert.deepEqual(calls,[]);
    for(let round=0;round<2;round++) {
      if(round){main=newMain;proxy=newProxy;}top=0;const start=calls.length;
      try{assert.equal(api[scheduled?'scheduleWindowStackOnTop':'keepWindowStackOnTop'](),undefined);}catch(caught){assert.equal(caught,error);assert.equal(calls.at(-1)?.[0],failure);threw=true;break;}
      assert.deepEqual(calls.slice(start).map(c=>c[0]),['main','top0','proxy','top1','aux','border','area']);
      if(round){assert.equal(calls[start+1][1].id,'new-main');assert.equal(calls[start+3][1].id,'new-proxy');}
    }
    assert.equal(threw,Boolean(failure));outputs.push({scheduled,mainPresent,proxyPresent,failure,race,calls,threw});
  }
}
const root=fs.readFileSync('electron/windowManager.cjs','utf8');
const assembly=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(assembly,/getMainWindow: \(\) => managerState\.mainWindow, getInputProxyWindow: \(\) => managerState\.postDragInputProxyWindow/);
assert.ok(assembly.indexOf('= createWindowStackTopmost(')>assembly.indexOf('= createAuxWindowTopmostScheduler('));
assert.ok(root.indexOf('= createWindowManagerPlacementControllers(')<root.indexOf('= createWindowPresentationTrayControllers('));
console.log(`Window stack smoke passed (${exerciseWindowStack().length} scenarios).`);
