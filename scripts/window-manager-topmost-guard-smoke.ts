import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),actual=require('../electron/windowManager/mainWindowTopmostGuard.cjs');
export function exerciseTopmostGuard(factories=actual) {
  const outputs: unknown[]=[];
  for(const a of ['missing','destroyed','hidden','visible'])for(const b of ['missing','destroyed','hidden','visible'])for(const c of ['missing','destroyed','hidden','visible']) query(a,b,c);
  for(const failure of ['settings.get','settings.destroyed','settings.visible','chat.get','chat.destroyed','chat.visible','area.get','area.destroyed','area.visible'])query('hidden','hidden','hidden',failure);
  for(const race of ['settings.destroyed','settings.visible','chat.destroyed','area.destroyed'])query('hidden','hidden','hidden',undefined,race);
  for(const existing of ['null','zero','occupied'])for(const returned of ['normal','plain','zero','null','undefined'])for(const visible of [false,true])guard(existing,returned,visible);
  for(const failure of ['get','interval','set','unref.get','unref','visible','main','top','clear'])guard('null','normal',false,failure);
  for(const race of ['interval','set','unref.get','unref','visible','clear'])guard('null','normal',false,undefined,race);
  guard('null','normal',false,undefined,'immediate');guard('null','normal',false,'top','immediate');
  return outputs;
  function query(a: string,b: string,c: string,failure?: string,race?: string) {
    const calls: string[]=[],error=new Error('visibility error');let threw: unknown;const current: any={};
    const step=(name: string)=>{calls.push(name);if(name===failure)throw error;if(name===race)current[name.split('.')[0]]=other;};
    const other={isDestroyed:()=>false,isVisible:()=>true};
    function window(id: string,state: string){const win={isDestroyed(){assert.equal(this,win);step(id+'.destroyed');return state==='destroyed';},isVisible(){assert.equal(this,win);step(id+'.visible');return state==='visible';}};return state==='missing'?null:win;}
    current.settings=window('settings',a);current.chat=window('chat',b);current.area=window('area',c);
    const deps={getSettingsWindow(){step('settings.get');return current.settings;},getChatWindow(){step('chat.get');return current.chat;},getAreaPickerWindow(){step('area.get');return current.area;}};
    const run=factories.createAuxWindowVisibilityQuery(deps);assert.deepEqual(calls,[]);let result: unknown;
    try{result=run();assert.equal(typeof result,'boolean');}catch(caught){assert.equal(caught,error);threw=caught;}
    if(!failure&&!race)assert.equal(result,[a,b,c].includes('visible'));
    assert.equal(Boolean(threw),Boolean(failure));outputs.push({a,b,c,failure,race,calls,result,threw:Boolean(threw)});
  }
  function guard(existing: string,returned: string,visible: boolean,failure?: string,race?: string) {
    const calls: any[][]=[],error=new Error('guard error'),callbacks: (()=>void)[]=[];let timer: any=existing==='occupied'?{id:'occupied'}:existing==='zero'?0:null,main={id:'main'},threw: any;
    const replacement={id:'replacement',unref(){step('replacement.unref');}};
    function id(value: any){return value?.id??value;}
    function step(name: string,value?: unknown){calls.push([name,value]);if(name===failure)throw error;if(name===race){timer=replacement;main={id:'new'};}}
    const normal={id:'normal',get unref(){step('unref.get');return function(this: any){assert.ok(this===normal||this===replacement);step('unref',id(this));};}};
    const value=returned==='normal'?normal:returned==='plain'?{id:'plain'}:returned==='zero'?0:returned==='null'?null:undefined;
    const deps={getGuardTimer(){step('get',id(timer));return timer;},setGuardTimer(value: any){step('set',id(value));timer=value;},
      getMainWindow(){step('main',main.id);return main;},hasVisibleAuxWindow(){step('visible');return visible;},
      keepWindowOnTop(win: unknown,level: number){assert.equal(win,main);assert.equal(level,7);step('top',main.id);return 'ignored';},
      MAIN_TOPMOST_RELATIVE_LEVEL:7,TOPMOST_GUARD_INTERVAL_MS:250,
      setInterval(callback: ()=>void,delay: number){assert.equal(delay,250);step('interval');callbacks.push(callback);if(race==='immediate')callback();return value;},
      clearInterval(value: any){assert.equal(value,timer);step('clear',id(value));}};
    const controls=factories.createMainWindowTopmostGuard(deps);assert.deepEqual(calls,[]);
    try{assert.equal(controls.startMainTopmostGuard(),undefined);assert.equal(controls.startMainTopmostGuard(),undefined);for(const callback of callbacks){callback();main={id:'late'};callback();}assert.equal(controls.stopMainTopmostGuard(),undefined);assert.equal(controls.stopMainTopmostGuard(),undefined);}catch(caught){assert.ok(caught===error||caught instanceof TypeError);threw=caught;}
    if(threw===error)assert.equal(calls.at(-1)?.[0],failure);
    if(!failure&&returned!=='null'&&returned!=='undefined'){assert.ok(timer===null||timer===0);if(existing==='occupied')assert.equal(callbacks.length,0);}
    outputs.push({existing,returned,visible,failure,race,calls,timer:id(timer),threw:threw===error?'dependency':threw?'TypeError':null});
  }
}
const root=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(root,/getGuardTimer: \(\) => managerState\.mainTopmostGuard, setGuardTimer: \(timer\) => \{ managerState\.mainTopmostGuard = timer; \}/);
const assembly=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(assembly,/getMainWindow, hasVisibleAuxWindow, keepWindowOnTop/);
console.log(`Topmost guard smoke passed (${exerciseTopmostGuard().length} scenarios).`);
