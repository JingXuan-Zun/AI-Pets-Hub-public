import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {readModuleProjectFunction} from './projectModuleSource.mjs';
const require=createRequire(import.meta.url);
const actualFactory=require('../electron/windowManager/settingsWindowOptions.cjs').createSettingsWindowOptionsBuilder;
export function exerciseSettingsWindowOptions(factory=actualFactory) {
  const outputs: unknown[]=[];
  for(const bounds of ['normal','negative','conflict','null'])for(const partition of [undefined,null,'',false,0,'persist:settings','temporary','中文'])for(const icon of ['empty','normal','conflict','symbol'])outputs.push(exercise(bounds,partition,icon));
  for(const failure of ['bounds','icon','width','height','join'])outputs.push(exercise('normal','persist:settings','normal',failure));
  for(const race of ['bounds','icon','width'])outputs.push(exercise('normal','persist:settings','normal',undefined,race));
  return outputs;
  function exercise(mode: string,partition: unknown,icon: string,failure?: string,race?: string) {
    const calls: any[]=[];const error=new Error('settings options dependency error'),symbol=Symbol('extra');
    let minimumWidth=1180,minimumHeight=600,iconName='original.ico';
    const step=(name: string,...args: unknown[])=>{calls.push([name,...args]);if(name===failure)throw error;};
    const marker={identity:true};
    const input: any=mode==='null'?null:mode==='conflict'?{x:1,y:2,width:3,height:4,minWidth:1,minHeight:2,frame:true,transparent:false,resizable:true,webPreferences:{preload:'caller',nodeIntegration:true},extra:marker}
      :{get x(){step('bounds');if(race==='bounds')minimumWidth=1300;return mode==='negative'?-1920:20;},y:-100,width:1440,height:820,extra:marker};
    if(input)Object.freeze(input);
    const settings={get minWidth(){step('width');if(race==='width')minimumHeight=700;return minimumWidth;},get minHeight(){step('height');return minimumHeight;}};
    const options={getBrowserWindowIconOptions(){step('icon');if(race==='icon')minimumWidth=1400;return icon==='empty'?{}:icon==='conflict'?{icon:iconName,width:777,minWidth:99,transparent:false,resizable:true,webPreferences:{sandbox:true}}:icon==='symbol'?{icon:iconName,[symbol]:marker}:{icon:iconName};},
      SETTINGS_PANEL_WINDOW_BOUNDS:settings,path:{join(...args: string[]){step('join',args);return path.join(...args);}},baseDirectory:'D:\\app\\electron',sessionPartition:partition};
    const build=factory(options);assert.deepEqual(calls,[],'factory creation must not read dimensions, icons or preload');
    const results: any[]=[];let failed=false;
    try {
      for(let round=0;round<2;round++) {
        if(round){minimumWidth=1500;minimumHeight=800;iconName='latest.ico';}
        const result=build(input);assert.notEqual(result,input);assert.equal(result.minWidth,minimumWidth);assert.equal(result.minHeight,minimumHeight);
        assert.equal(result.resizable,false);assert.equal(result.transparent,true);assert.equal(result.frame,false);assert.equal(result.hasShadow,false);assert.equal(result.thickFrame,false);
        assert.equal(result.show,false);assert.equal(result.alwaysOnTop,false);assert.equal(result.skipTaskbar,false);assert.equal(result.focusable,true);assert.equal(result.autoHideMenuBar,true);
        assert.equal(result.backgroundColor,'#00000000');assert.equal(result.title,'AI Desktop Pet Settings');
        assert.deepEqual(result.webPreferences,{backgroundThrottling:false,preload:path.join(options.baseDirectory,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false,...(partition?{partition}:{})});
        if(mode!=='null')assert.equal(result.extra,marker);
        if(icon==='symbol')assert.equal(result[symbol],marker);
        if(icon!=='empty')assert.equal(result.icon,iconName);
        if(icon==='conflict')assert.equal(result.width,777);
        if(round)assert.notEqual(result.webPreferences,results[0].webPreferences);
        results.push(result);
      }
      const names=calls.slice(0,calls.length/2).map(call=>call[0]);
      assert.deepEqual(names,mode==='normal'||mode==='negative'?['bounds','icon','width','height','join']:['icon','width','height','join']);
    }catch(caught){assert.ok(failure);assert.equal(caught,error);assert.equal(calls.at(-1)[0],failure);failed=true;}
    assert.equal(failed,Boolean(failure));return JSON.parse(JSON.stringify({mode,partition,icon,failure,race,calls,results,failed}));
  }
}
const manager=readModuleProjectFunction('electron/windowManager.cjs','createWindowManager');
assert.match(manager,/baseDirectory: __dirname/u);
const auxiliary=readModuleProjectFunction('electron/windowManager/auxiliaryWindowCreationControllers.cjs','createAuxiliaryWindowCreationControllers');
assert.match(auxiliary,/getBrowserWindowIconOptions,\s*SETTINGS_PANEL_WINDOW_BOUNDS,\s*path,\s*baseDirectory,\s*sessionPartition,/u);
const assembly=readModuleProjectFunction('electron/windowManager/settingsWindowControllers.cjs','createSettingsWindowControllers');
assert.match(assembly,/createSettingsWindowOptionsBuilder\(\{\s*getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory, sessionPartition,/u);
const creator=readModuleProjectFunction('electron/windowManager/settingsWindowLifecycle.cjs','createSettingsWindowCreator');
assert.match(assembly,/createSettingsWindowCreator\(\{[\s\S]*?getSettingsPanelWindowBounds, BrowserWindow, buildSettingsWindowOptions, attachLoadLogging,/u);
assert.match(creator,/const initialBounds = getSettingsPanelWindowBounds\(\);\s*const nextSettingsWindow = new BrowserWindow\(buildSettingsWindowOptions\(initialBounds\)\);/u);
assert.equal(exerciseSettingsWindowOptions().length,136);
console.log('Settings window options smoke passed (136 scenarios, two calls each for normal/race cases; ordering/overrides/live limits/partition/identity/errors).');
