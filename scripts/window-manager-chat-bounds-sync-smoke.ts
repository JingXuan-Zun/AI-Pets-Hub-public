import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const require=createRequire(import.meta.url);
const actual=require('../electron/windowManager/chatWindowBoundsSync.cjs');
export function exerciseChatBoundsSync(factories=actual) {
  const outputs: unknown[]=[];
  for(const state of ['missing','destroyed','compact','live']) constraints(state);
  for(const failure of ['destroyed','compact','limits','minWidth','minHeight','minimum','maxWidth','maxHeight','maximum']) constraints('live',failure);
  constraints('live',undefined,true);
  for(const state of ['missing','destroyed','compact','live'])for(const active of [false,true])for(const was of [false,true]) {
    for(const width of [200,500])for(const height of [300,600])for(const change of ['none','x','y','width','height']) sync(state,active,was,width,height,change);
  }
  for(const failure of ['active','get','destroyed','compact','constraints','bounds','limits','was','write','resolve','setBounds']) sync('live',true,true,500,600,'x',failure);
  for(const race of ['destroyed','compact','constraints','bounds','limits','was','write','resolve','setBounds','clear']) sync('live',true,true,500,600,'x',undefined,race);
  for(const active of ['active',0,null]) sync('live',active,false,200,300,'x');
  return outputs;

  function constraints(state: string,failure?: string,mutate=false) {
    const calls: any[][]=[],error=new Error('constraints failure');let threw: unknown;
    const step=(name: string,value?: unknown)=>{calls.push([name,value]);if(name===failure)throw error;};
    let maxWidth=1000,maxHeight=900;
    const limits={get minWidth(){step('minWidth');return 300;},get minHeight(){step('minHeight');return 400;},get maxWidth(){step('maxWidth');return maxWidth;},get maxHeight(){step('maxHeight');return maxHeight;}};
    const win={isDestroyed(){assert.equal(this,win);step('destroyed');return state==='destroyed';},
      setMinimumSize(w: number,h: number){assert.equal(this,win);step('minimum',[w,h]);if(mutate){maxWidth=1200;maxHeight=1100;}},
      setMaximumSize(w: number,h: number){assert.equal(this,win);step('maximum',[w,h]);}};
    const run=factories.createChatWindowSizeConstraints({isCurrentWindowCompactMinimumSizeActive(value: unknown){assert.equal(value,win);step('compact');return state==='compact';},
      getResolvedChatPanelWindowLimits(){step('limits');return limits;}});assert.deepEqual(calls,[]);
    try{assert.equal(run(state==='missing'?null:win),undefined);}catch(caught){assert.equal(caught,error);threw=caught;}
    assert.equal(Boolean(threw),Boolean(failure));
    if(!failure&&state==='live')assert.deepEqual(calls.map(c=>c[0]),['destroyed','compact','limits','minWidth','minHeight','minimum','maxWidth','maxHeight','maximum']);
    if(mutate)assert.deepEqual(calls.at(-1),['maximum',[1200,1100]]);
    outputs.push({constraints:true,state,failure,mutate,calls,threw:Boolean(threw)});
  }

  function sync(state: string,active: unknown,was: unknown,width: number,height: number,change: string,failure?: string,race?: string) {
    const calls: any[][]=[],error=new Error('sync failure');let current: any,previous=was,threw: any,dependencyFailed=false;
    const bounds={x:10,y:-20,width,height},resolved={...bounds},normal={x:1,y:2,width:500,height:600},limits={minWidth:300,minHeight:400};
    if(change!=='none')(resolved as any)[change]++;
    function step(name: string,value?: unknown){calls.push([name,value]);if(name===failure){dependencyFailed=true;throw error;}if(name===race)current=other;if(race==='clear'&&name==='constraints')current=null;}
    function window(id: string){const win={id,isDestroyed(){assert.equal(this,win);step('destroyed',id);return state==='destroyed'&&id==='self';},
      getBounds(){assert.equal(this,win);step('bounds',id);return bounds;},setBounds(value: unknown,animate: boolean){assert.equal(this,win);assert.equal(animate,false);assert.ok(value===normal||value===resolved);step('setBounds',{id,value:value===normal?'normal':'resolved'});}};return win;}
    const self=window('self'),other=window('other');current=state==='missing'?null:self;
    const deps={getChatWindow(){step('get',current?.id??null);return current;},getWasInteractive(){step('was',previous);return previous;},
      setWasInteractive(value: unknown){step('write',value);previous=value;},isInteractiveDialogueChatActive(){step('active',active);return active;},
      isCurrentWindowCompactMinimumSizeActive(win: any){step('compact',win.id);return state==='compact';},
      applyChatWindowSizeConstraints(win: any){step('constraints',win.id);},getResolvedChatPanelWindowLimits(){step('limits');return limits;},
      getResolvedChatPanelWindowBounds(value?: unknown){if(value!==undefined)assert.equal(value,bounds);step('resolve',value===undefined?'normal':'current');return value===undefined?normal:resolved;}};
    const run=factories.createInteractiveChatWindowBoundsSync(deps);assert.deepEqual(calls,[]);
    for(let round=0;round<2;round++) {
      if(round){current=state==='missing'?null:other;previous=!was;}
      try{assert.equal(run(),undefined);}catch(caught){assert.ok(caught===error||(race==='clear'&&caught instanceof TypeError));threw=caught;break;}
      if(!failure&&!race){assert.equal(previous,active);if(state==='missing'||state==='destroyed'&&!round||state==='compact')assert.equal(calls.filter(c=>c[0]==='setBounds').length,0);}
    }
    assert.equal(threw===error,dependencyFailed);
    if(threw===error)assert.equal(calls.at(-1)?.[0],failure);
    if(!failure&&!race&&state==='live'&&active)assert.equal(calls.filter(c=>c[0]==='setBounds').length,change==='none'?0:2);
    outputs.push({state,active,was,width,height,change,failure,race,calls,previous,current:current?.id??null,threw:threw===error?'dependency':threw?'TypeError':null});
  }
}
const root=fs.readFileSync('electron/windowManager.cjs','utf8');
assert.match((root + ownershipStateSource),/getWasInteractive: \(\) => managerState\.wasInteractiveDialogueChatActive/);
assert.match((root + ownershipStateSource),/setWasInteractive: \(active\) => \{ managerState\.wasInteractiveDialogueChatActive = active; \}/);
const assembly=fs.readFileSync('electron/windowManager/chatWindowControllers.cjs','utf8');
assert.ok(assembly.indexOf('= createChatWindowSizeConstraints(')<assembly.indexOf('= createInteractiveChatWindowBoundsSync('));
assert.ok(assembly.indexOf('= createInteractiveChatWindowBoundsSync(')<assembly.indexOf('= createChatWindowEventRegistrar('));
console.log(`Chat bounds sync smoke passed (${exerciseChatBoundsSync().length} scenarios).`);
