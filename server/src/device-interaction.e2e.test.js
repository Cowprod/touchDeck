import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createTouchDeckServer } from './index.js';

const headers={'content-type':'application/json'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(port,id,deviceType){
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws'),messages=[];
 ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
 ws.send(JSON.stringify({type:'hello',clientId:id,deviceType}));
 await until(()=>messages.some(m=>m.type==='welcome'));
 return {ws,messages};
}
async function until(check){
 for(let i=0;i<150;i++){const result=check();if(result)return result;await delay(15)}
 throw Error('Timed out waiting for WebSocket state');
}
async function fixture(base){
 const data=await(await fetch(base+'/api/admin/config')).json();
 const page=data.pageSets[0].pages[0];
 page.components.push(
  {id:'level-a',type:'Slider',x:0,y:6,w:3,h:1,sourceId:'touchdeck_test',property:'level',min:0,max:100},
  {id:'level-b',type:'Slider',x:4,y:6,w:3,h:1,sourceId:'touchdeck_test',property:'level',min:0,max:100},
  {id:'level-gauge',type:'Gauge',x:0,y:7,w:3,h:1,sourceId:'touchdeck_test',property:'level',min:0,max:100}
 );
 const response=await fetch(base+'/api/admin/config',{method:'PUT',headers,body:JSON.stringify(data)});
 assert.equal(response.status,200,await response.text());
}
test('virtual sliders synchronize all bound controls across two simulators and reconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-slider-e2e-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'state.json')});
 const sockets=[];
 try{
  const {port}=await app.start(),base='http://127.0.0.1:'+port;
  await fixture(base);
  const a=await connect(port,'web-sim-a','web-simulator'),b=await connect(port,'web-sim-b','web-simulator');
  sockets.push(a.ws,b.ws);
  for(const client of [a,b]){
   const response=await fetch(base+'/api/admin/clients',{method:'PUT',headers,body:JSON.stringify({clientId:client===a?'web-sim-a':'web-sim-b',groupId:'demo'})});
   assert.equal(response.status,200);
   await until(()=>client.messages.some(m=>m.type==='page'&&m.page?.id==='home'));
  }
  const page=a.messages.findLast(m=>m.type==='page'&&m.page?.id==='home');
  a.ws.send(JSON.stringify({type:'interact',pageId:'home',pageRevision:page.pageRevision,componentId:'level-a',requestId:'level-1',value:67}));
  await until(()=>a.messages.some(m=>m.type==='interaction_result'&&m.requestId==='level-1'&&m.status==='acknowledged'));
  for(const client of [a,b]){
   const update=await until(()=>client.messages.find(m=>m.type==='component_update'&&m.changes?.some(c=>c.id==='level-a'&&c.value===67)));
   for(const id of ['level-a','level-b','level-gauge'])assert.equal(update.changes.find(c=>c.id===id)?.value,67);
  }
  b.ws.close();await new Promise(resolve=>b.ws.once('close',resolve));
  const reconnected=await connect(port,'web-sim-b','web-simulator');sockets.push(reconnected.ws);
  const snapshot=await until(()=>reconnected.messages.find(m=>m.type==='page'&&m.page?.id==='home'));
  for(const id of ['level-a','level-b','level-gauge'])assert.equal(snapshot.page.components.find(c=>c.id===id)?.value,67);
 }finally{for(const ws of sockets)ws.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});
test('physical device starts unassigned and group selection persists across server restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-assignment-e2e-')),dataFile=join(dir,'state.json');
 let app,ws;
 try{
  app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile});
  let {port}=await app.start(),base='http://127.0.0.1:'+port;
  let client=await connect(port,'esp-test-1','esp32c3');ws=client.ws;
  assert.equal(client.messages.find(m=>m.type==='welcome').groupId,null);
  assert.equal(client.messages.some(m=>m.type==='page'),false);
  ws.send(JSON.stringify({type:'assign',groupId:'demo'}));
  await until(()=>client.messages.some(m=>m.type==='error'&&m.code==='admin_required'));
  assert.equal(client.messages.some(m=>m.type==='page'),false);
  let response=await fetch(base+'/api/admin/clients',{method:'PUT',headers,body:JSON.stringify({clientId:'esp-test-1',groupId:'demo'})});
  assert.equal(response.status,200);
  await until(()=>client.messages.some(m=>m.type==='page'&&m.page?.id==='home'));
  const config=await(await fetch(base+'/api/admin/config')).json();
  config.pageSets[0].pages[0].title='Persistence regression';
  assert.equal((await fetch(base+'/api/admin/config',{method:'PUT',headers,body:JSON.stringify(config)})).status,200);
  ws.close();await new Promise(resolve=>ws.once('close',resolve));await app.stop();
  app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile});({port}=await app.start());base='http://127.0.0.1:'+port;
  client=await connect(port,'esp-test-1','esp32c3');ws=client.ws;
  assert.equal(client.messages.find(m=>m.type==='welcome').groupId,'demo');
  await until(()=>client.messages.some(m=>m.type==='page'&&m.page?.id==='home'));
  response=await fetch(base+'/api/admin/clients',{method:'PUT',headers,body:JSON.stringify({clientId:'esp-test-1',groupId:null})});
  assert.equal(response.status,200);
  await until(()=>client.messages.some(m=>m.type==='page'&&m.page===null));
 }finally{ws?.close();await app?.stop();await rm(dir,{recursive:true,force:true})}
});
