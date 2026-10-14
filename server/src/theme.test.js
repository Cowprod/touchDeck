import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, FONT_SIZES, resolvePage } from './theme.js';

test('server resolves theme tokens, dimensions and state without mutating source', () => {
  const profile={width:240,height:240,gridColumns:8,gridRows:8};
  const page={id:'p',title:'Test',visible:true,background:'dark',components:[
    {id:'a',type:'Button',x:2,y:1,w:3,h:2,text:'Action',background:'success',color:'light',fontSize:'large',active:true,disabled:false}
  ]};
  const snapshot=JSON.stringify(page);
  const result=resolvePage(page,profile);
  assert.equal(result.backgroundColor,COLORS.dark);
  assert.deepEqual([result.components[0].x,result.components[0].y,result.components[0].w,result.components[0].h],[60,30,90,60]);
  assert.equal(result.components[0].backgroundColor,COLORS.success);
  assert.equal(result.components[0].textColor,COLORS.light);
  assert.equal(result.components[0].fontSize,FONT_SIZES.large);
  assert.equal(result.components[0].active,true);
  assert.equal(result.components[0].disabled,false);
  assert.equal(JSON.stringify(page),snapshot);
  assert.equal(result.components[0].background,undefined);
});
test('legacy pages resolve with defaults and missing pages remain null',()=>{
  const profile={width:240,height:240,gridColumns:8,gridRows:8};
  assert.equal(resolvePage(null,profile),null);
  const page=resolvePage({id:'p',title:'Old',visible:true,components:[{id:'a',type:'Label',x:0,y:0,w:1,h:1}]},profile);
  assert.equal(page.components[0].fontSize,FONT_SIZES.normal);
  assert.equal(page.components[0].disabled,false);
});

test('icons use transparent background unless explicitly configured', () => {
  const page={id:'p',title:'p',visible:true,components:[{id:'i',type:'Icon',icon:'solid/house',x:0,y:0,w:2,h:2,color:'danger'}]};
  const profile={width:240,height:240,gridColumns:8,gridRows:8};
  const icon=resolvePage(page,profile).components[0];
  assert.equal(icon.backgroundColor,null);
  assert.equal(icon.textColor,'#dc3545');
  assert.equal(icon.icon,'solid/house');
  page.components[0].background='light';
  assert.equal(resolvePage(page,profile).components[0].backgroundColor,'#f8f9fa');
});

test('numeric and icon bar components carry bounded display metadata to clients',()=>{
 const profile={width:240,height:240,gridColumns:8,gridRows:8};
 const page={id:'p',title:'Components',visible:true,components:[
  {id:'g',type:'Gauge',x:0,y:0,w:2,h:2,min:-20,max:80,value:25,display:'arc'},
  {id:'p',type:'Progress',x:2,y:0,w:2,h:1,value:60,orientation:'vertical'},
  {id:'s',type:'Slider',x:0,y:3,w:4,h:1,min:10,max:50,value:30,property:'level'},
  {id:'b',type:'IconBar',x:0,y:4,w:4,h:1,icons:['solid/house','solid/gear']}
 ]};
 const result=resolvePage(page,profile).components;
 assert.deepEqual([result[0].min,result[0].max,result[0].value,result[0].display],[-20,80,25,'arc']);
 assert.equal(result[1].orientation,'vertical');
 assert.equal(result[2].property,'level');
 assert.deepEqual(result[3].icons,['solid/house','solid/gear']);
});

test('validation fixture in admin has seven non-overlapping pages with all component types',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {Script,runInNewContext}=await import('node:vm');
 const html=await readFile(new URL('../public/admin.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g))new Script(match[1]);
 const fixture=html.match(/function buildValidationSet\\(\\)\\{[\\s\\S]*?\\n\\}\\n\\$\\('createTestSet'\\)/);
 assert.ok(fixture,'fixture generator must be present');
 const code=fixture[0].replace(/\\n\\$\\('createTestSet'\\)$/,'');
 const generated=runInNewContext(code+';buildValidationSet()', {newId:()=> 'abcdef0123456789'});
 assert.equal(generated.set.pages.length,7);
 assert.equal(generated.group.pageSetId,generated.set.id);
 const types=new Set();
 for(const page of generated.set.pages){
  const cells=new Set();
  for(const component of page.components){
   types.add(component.type);
   assert.ok(component.x>=0&&component.y>=0&&component.x+component.w<=8&&component.y+component.h<=8);
   for(let y=component.y;y<component.y+component.h;y++)for(let x=component.x;x<component.x+component.w;x++){
    const key=x+':'+y;
    assert.ok(!cells.has(key),'overlap '+page.id+' '+key);
    cells.add(key);
   }
  }
 }
 for(const type of ['Label','Icon','Button','Gauge','Progress','Slider','IconBar'])assert.ok(types.has(type),type);
});
