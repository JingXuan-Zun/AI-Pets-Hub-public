import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),actual=require('../electron/windowManager/mainWindowResize.cjs');
const currents=[{x:100,y:100,width:500,height:600},{x:-1800,y:-500,width:300,height:400},{x:3000,y:2000,width:100,height:200},{x:1.5,y:2.5,width:101,height:203}];
const displays=[{x:0,y:0,width:1920,height:1080},{x:-1920,y:-700,width:3840,height:1780},{x:0,y:0,width:200,height:100},{x:-10.5,y:-20.5,width:1000.5,height:700.5}];
export function exerciseMainResize(factories=actual) {
  const outputs: unknown[]=[];
  for(const centered of [false,true])for(const open of [false,true,undefined,null,'open'])for(const size of [0,1,2]) {
    if(centered)for(let c=0;c<currents.length;c++)for(let d=0;d<displays.length;d++)run(centered,open,size,c,d);
    else run(centered,open,size,0,0);
  }
  for(const centered of [false,true]) {
    for(const open of [false,true,undefined,null,'open'])run(centered,open,0,0,0,undefined,undefined,true);
    for(const failure of ['get','settings','minimum','maximum','set','stack',...(centered?['bounds','display']:[])])run(centered,true,0,0,0,failure);
    run(centered,false,0,0,0,'compact');
    for(const race of ['get','settings','minimum','maximum','set','stack',...(centered?['bounds','display']:[]),'clear','width'])run(centered,true,0,0,0,undefined,race);
  }
  return outputs;
  function run(centered: boolean,open: unknown,size: number,c: number,d: number,failure?: string,race?: string,missing=false) {
    const calls: any[][]=[],error=new Error('resize error'),currentBounds=Object.freeze({...currents[c]}),displayBounds=Object.freeze({...displays[d]});let current: any,threw: any;
    const next={x:-50,y:20,width:[520,1440,2400][size],height:[720,820,1800][size]};
    const step=(name: string,value?: unknown)=>{calls.push([name,value]);if(name===failure)throw error;if(name===race)current=other;if(race==='clear'&&name==='minimum')current=null;};
    const target=race==='width'?{...next,get width(){step('width');return next.width;}}:Object.freeze(next);
    function window(id: string){const win={getBounds(){assert.equal(this,win);step('bounds',id);return currentBounds;},
      setMinimumSize(w: number,h: number){assert.equal(this,win);assert.deepEqual([w,h],[next.width,next.height]);step('minimum',id);},
      setMaximumSize(w: number,h: number){assert.equal(this,win);assert.deepEqual([w,h],[next.width,next.height]);step('maximum',id);},
      setBounds(bounds: any){assert.equal(this,win);assert.notEqual(bounds,target);assert.equal(bounds.width,next.width);assert.equal(bounds.height,next.height);
        const expected=centered?{x:Math.round(Math.max(displayBounds.x,Math.min(displayBounds.x+displayBounds.width-next.width,currentBounds.x+(currentBounds.width-next.width)/2))),y:Math.round(Math.max(displayBounds.y,Math.min(displayBounds.y+displayBounds.height-next.height,currentBounds.y+(currentBounds.height-next.height)/2)))}:{x:next.x,y:next.y};
        assert.equal(bounds.x,expected.x);assert.equal(bounds.y,expected.y);step('set',{id,bounds});}};return win;}
    const self=window('self'),other=window('other');current=missing?null:self;
    const captureService={getVirtualDisplayBounds(){assert.equal(this,captureService);step('display');return displayBounds;}};
    const deps={getMainWindow(){step('get',current===self?'self':current===other?'other':null);return current;},
      getSettingsWindowBounds(){step('settings');return target;},getCompactWindowBounds(){step('compact');return target;},captureService,
      scheduleWindowStackOnTop(){step('stack');return 'ignored';}};
    const resize=centered?factories.createMainWindowCenterResizer(deps):factories.createMainWindowSettingsResizer(deps);assert.deepEqual(calls,[]);
    for(let round=0;round<2;round++) {
      if(round)current=missing?null:other;const start=calls.length;
      try{assert.equal(resize(open),undefined);}catch(caught){assert.ok(caught===error||(race==='clear'&&caught instanceof TypeError));threw=caught;break;}
      if(!failure&&!race)assert.deepEqual(calls.slice(start).map(call=>call[0]).filter(name=>name!=='get'),missing?[]:[open?'settings':'compact',...(centered?['bounds','display']:[]),'minimum','maximum','set','stack']);
    }
    assert.equal(threw===error,Boolean(failure));if(threw===error)assert.equal(calls.at(-1)?.[0],failure);
    outputs.push({centered,open,size,c,d,failure,race,missing,calls,threw:threw===error?'dependency':threw?'TypeError':null});
  }
}
const root=fs.readFileSync('electron/windowManager.cjs','utf8');
assert.match(root,/getSettingsWindowBounds, getCompactWindowBounds, captureService/);
const assembly=fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs','utf8');
assert.match(assembly,/getMainWindow, getSettingsWindowBounds, getCompactWindowBounds, captureService, scheduleWindowStackOnTop/);
assert.ok(assembly.indexOf('= createMainWindowSettingsResizer(')>assembly.indexOf('= createWindowStackTopmost('));
console.log(`Main window resize smoke passed (${exerciseMainResize().length} scenarios).`);
