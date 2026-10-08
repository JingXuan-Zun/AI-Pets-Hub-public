import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),actual=require('../electron/windowManager/auxiliaryWindowTopmost.cjs');
const names=['keepAuxWindowsOnTop','keepAreaPickerOnTop','keepPersistentAreaBorderOnTop','scheduleAuxWindowsOnTop','scheduleAreaPickerOnTop','schedulePersistentAreaBorderOnTop'];
export function exerciseAuxiliaryTopmost(factories=actual) {
  const outputs: unknown[]=[];
  for(let mask=0;mask<16;mask++)for(const name of names)run(name,mask);
  for(const name of names)for(const failure of ['settings','chat','area','border','keep','schedule'])run(name,15,failure);
  for(const name of names)for(const race of ['settings','chat','area','border','keep','schedule'])run(name,15,undefined,race);
  return outputs;
  function run(name: string,mask: number,failure?: string,race?: string) {
    const calls: any[][]=[],error=new Error('aux topmost error'),keys=['settings','chat','area','border'],current: any={},newer: any={},seenOptions: any[]=[];let threw=false,failed=false;
    keys.forEach((key,index)=>{current[key]=mask&(1<<index)?{id:key}:null;newer[key]={id:'new-'+key};});
    const step=(kind: string,value?: unknown)=>{calls.push([kind,value]);if(kind===failure){failed=true;throw error;}if(kind===race)keys.forEach(key=>{current[key]=newer[key];});};
    const get=(key: string)=>{step(key,current[key]?.id??null);return current[key];};
    function action(kind: string,win: any,level: number,options?: any) {
      const key=name.includes('Aux')?'aux':name.includes('AreaPicker')?'area':'border';
      assert.equal(level,key==='aux'?7:key==='area'?9:11);
      if(key==='aux')assert.equal(options,undefined);else{assert.deepEqual(options,{topmostLevel:'pop-up-menu'});assert.ok(!seenOptions.includes(options));seenOptions.push(options);}
      step(kind,{id:win?.id??null,level,options});return 'ignored';
    }
    const deps={getSettingsWindow:()=>get('settings'),getChatWindow:()=>get('chat'),getAreaPickerWindow:()=>get('area'),getPersistentAreaBorderWindow:()=>get('border'),
      keepWindowOnTop:(...args: any[])=>action('keep',args[0],args[1],args[2]),scheduleKeepWindowOnTop:(...args: any[])=>action('schedule',args[0],args[1],args[2]),
      AUX_TOPMOST_RELATIVE_LEVEL:7,AREA_PICKER_TOPMOST_RELATIVE_LEVEL:9,PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL:11,AREA_PICKER_TOPMOST_WINDOW_LEVEL:'pop-up-menu'};
    const api={...factories.createAuxWindowTopmostActions(deps),...factories.createAuxWindowTopmostScheduler(deps)};assert.deepEqual(calls,[]);
    for(let round=0;round<2;round++) {
      if(round)keys.forEach(key=>{current[key]=newer[key];});const start=calls.length;
      try{assert.equal(api[name](),undefined);}catch(caught){assert.equal(caught,error);assert.equal(calls.at(-1)?.[0],failure);threw=true;break;}
      const kind=name.startsWith('keep')?'keep':'schedule';
      assert.deepEqual(calls.slice(start).map(c=>c[0]),name.includes('Aux')?['settings',kind,'chat',kind]:[name.includes('AreaPicker')?'area':'border',kind]);
      if(round)assert.ok(calls.slice(start).filter(c=>c[0]===kind).every(c=>c[1].id.startsWith('new-')));
    }
    assert.equal(threw,failed);outputs.push({name,mask,failure,race,calls,threw});
  }
}
const root=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(root,/getAreaPickerWindow, getPersistentAreaBorderWindow, keepWindowOnTop/);
const assembly=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(assembly,/getAreaPickerWindow, getPersistentAreaBorderWindow, scheduleKeepWindowOnTop/);
console.log(`Auxiliary topmost smoke passed (${exerciseAuxiliaryTopmost().length} scenarios).`);
