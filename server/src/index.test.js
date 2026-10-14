import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createTouchDeckServer } from './index.js';

function connect(port, clientId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const messages = [];
    socket.on('error', reject);
    socket.on('message', raw => { const msg = JSON.parse(raw.toString()); messages.push(msg); if (msg.type === 'welcome') resolve({ socket, messages }); });
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', clientId, deviceType: 'web-simulator' })));
  });
}
function waitPage(socket, action) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('message', handler); reject(new Error('timeout')); }, 2000);
    const handler = raw => { const msg = JSON.parse(raw.toString()); if (msg.type === 'page') { clearTimeout(timeout); socket.off('message', handler); resolve(msg); } };
    socket.on('message', handler);
    socket.send(JSON.stringify(action));
  });
}
test('independent navigation, first visible page and wraparound', async () => {
  const app = createTouchDeckServer({ port: 0 });
  const { port } = await app.start();
  try {
    const a = await connect(port, 'browser-a');
    const b = await connect(port, 'browser-b');
    const aInitial = await waitPage(a.socket, { type: 'assign', groupId: 'demo' });
    const bInitial = await waitPage(b.socket, { type: 'assign', groupId: 'demo' });
    assert.equal(aInitial.page.id, 'home');
    assert.equal(bInitial.page.id, 'home');
    assert.equal((await waitPage(a.socket, { type: 'navigate', direction: 'next' })).page.id, 'second');
    assert.equal(app.clients.get('browser-b').pageId, 'home');
    assert.equal((await waitPage(a.socket, { type: 'navigate', direction: 'next' })).page.id, 'stopwatch');
    assert.equal((await waitPage(a.socket, { type: 'navigate', direction: 'next' })).page.id, 'home');
    assert.equal((await waitPage(b.socket, { type: 'navigate', direction: 'previous' })).page.id, 'stopwatch');
  } finally { await app.stop(); }
});

test('POC admin API allows private-network edits and persists validated page configuration', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'touchdeck-test-'));
  const file = join(dir, 'config.json');
  const app = createTouchDeckServer({ port: 0, host: '127.0.0.1', dataFile: file });
  const { port } = await app.start();
  const url = 'http://127.0.0.1:' + port + '/api/admin/config';
  try {
    assert.equal((await fetch(url)).status, 200);
    const headers = { 'content-type': 'application/json' };
    const initial = await (await fetch(url, { headers })).json();
    const changed = structuredClone(initial);
    changed.pageSets[0].pages[0].title = 'Updated';
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify(changed) })).status, 200);
    changed.revision+=1;
    const stored = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(stored.pageSets[0].pages[0].title, 'Updated');
    changed.pageSets[0].pages[0].components[0].w = 99;
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify(changed) })).status, 400);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).pageSets[0].pages[0].title, 'Updated');
  } finally { await app.stop(); await rm(dir, { recursive: true, force: true }); }
});

test('admin rejects overlapping components and unsupported visual tokens',async()=>{
  const { mkdtemp,rm }=await import('node:fs/promises');
  const { tmpdir }=await import('node:os');
  const { join }=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'touchdeck-validation-'));
  const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
  const {port}=await app.start();
  const url='http://127.0.0.1:'+port+'/api/admin/config';
  const put=body=>fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    const config=await(await fetch(url)).json();
    const page=config.pageSets[0].pages[0];
    page.components[1].x=2;page.components[1].y=1;
    const collision=await put(config);
    assert.equal(collision.status,400);
    assert.equal((await collision.json()).error,'component_overlap');
    page.components[1].x=1;page.components[1].y=4;
    page.components[0].color='not-a-token';
    assert.equal((await put(config)).status,400);
    page.components[0].color='warning';
    page.components[0].fontSize='large';
    page.components[0].disabled=true;
    assert.equal((await put(config)).status,200);
  }finally{await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('invisible current page stays until client navigates',async()=>{
  const { mkdtemp,rm }=await import('node:fs/promises');
  const { tmpdir }=await import('node:os');
  const { join }=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'touchdeck-visibility-'));
  const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
  const {port}=await app.start();
  const url='http://127.0.0.1:'+port+'/api/admin/config';
  let socket;
  try{
    ({socket}=await connect(port,'visibility-test'));
    await waitPage(socket,{type:'assign',groupId:'demo'});
    const config=await(await fetch(url)).json();
    config.pageSets[0].pages[0].visible=false;
    const updated=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('timeout')),2000);
      const handler=raw=>{const payload=JSON.parse(raw.toString());if(payload.type==='page'){clearTimeout(timeout);socket.off('message',handler);resolve(payload)}};
      socket.on('message',handler);
    });
    assert.equal((await fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)})).status,200);
    assert.equal((await updated).page.id,'home');
    assert.equal((await waitPage(socket,{type:'navigate',direction:'next'})).page.id,'second');
  }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('admin can assign two independent HTML simulators to existing groups',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'touchdeck-simulators-'));
  const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
  const {port}=await app.start();
  let a,b;
  const assign=(id,groupId)=>fetch('http://127.0.0.1:'+port+'/api/admin/clients',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:id,groupId})});
  try{
    a=(await connect(port,'web-sim-a')).socket;
    b=(await connect(port,'web-sim-b')).socket;
    const aAssigned=new Promise(resolve=>{const handle=raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='page'&&msg.groupId==='demo'){a.off('message',handle);resolve(msg)}};a.on('message',handle)});
    assert.equal((await assign('web-sim-a','demo')).status,200);
    assert.equal((await aAssigned).page.id,'home');
    assert.equal((await waitPage(a,{type:'navigate',direction:'next'})).page.id,'second');
    assert.equal(app.clients.get('web-sim-b').pageId,null);
    const bAssigned=new Promise(resolve=>{const handle=raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='page'&&msg.groupId==='demo'){b.off('message',handle);resolve(msg)}};b.on('message',handle)});
    assert.equal((await assign('web-sim-b','demo')).status,200);
    assert.equal((await bAssigned).page.id,'home');
    assert.equal(app.clients.get('web-sim-a').pageId,'second');
    assert.equal((await assign('web-sim-a','missing')).status,400);
    assert.equal((await assign('other-id','demo')).status,404);
  }finally{a?.close();b?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('concurrent editors cannot silently overwrite a newer revision',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'touchdeck-concurrency-'));
  const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
  const {port}=await app.start();
  const url='http://127.0.0.1:'+port+'/api/admin/config';
  try{
    const stale=await(await fetch(url)).json();
    const first=structuredClone(stale);first.pageSets[0].pages[0].title='First editor';
    const put=body=>fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await put(first)).status,200);
    stale.pageSets[0].pages[0].title='Second editor';
    const second=await put(stale);
    assert.equal(second.status,409);
    assert.equal((await second.json()).error,'config_conflict');
    assert.equal((await(await fetch(url)).json()).pageSets[0].pages[0].title,'First editor');
  }finally{await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('sources persist; imported descriptors require reimport and keep identity',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-sources-'));
 const file=join(dir,'config.json');
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:file});
 const {port}=await app.start();
 const root='http://127.0.0.1:'+port+'/api/admin';
 const put=(path,body)=>fetch(root+path,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  const first=await(await fetch(root+'/config')).json();
  first.sources.push({id:'manual-1',name:'Manual source',origin:'manual',descriptor:{properties:{level:{type:'number',unit:'%' }},actions:{},events:{}}});
  const manual=await put('/config',first);assert.equal(manual.status,200);
  const revision=(await manual.json()).revision;
  const descriptor={properties:{temperature:{type:'number',unit:'C'}},actions:{trigger:{input:{type:'boolean'}}},events:{alarm:{}}};
  const imported=await put('/sources/import',{revision,id:'imported-1',name:'Imported source',descriptor});
  assert.equal(imported.status,200);
  const after=await(await fetch(root+'/config')).json();
  assert.equal(after.sources.length,4);
  assert.equal(after.sources.find(item=>item.id==='imported-1').origin,'imported');
  const changed=structuredClone(after);
  changed.sources.find(item=>item.id==='imported-1').descriptor.properties.temperature.type='string';
  const blocked=await put('/config',changed);
  assert.equal(blocked.status,403);
  assert.equal((await blocked.json()).error,'source_import_only');
  const newer={properties:{temperature:{type:'integer'}},actions:{},events:{}};
  const reimport=await put('/sources/import',{revision:after.revision,id:'imported-1',name:'Imported source',descriptor:newer});
  assert.equal(reimport.status,200);
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.equal(saved.sources.find(item=>item.id==='imported-1').descriptor.properties.temperature.type,'integer');
  assert.equal(saved.sources.length,4);
 }finally{await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('single-source placeholders resolve and stream differential updates without persisting values',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-binding-'));const file=join(dir,'config.json');
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:file});
 const {port}=await app.start();const base='http://127.0.0.1:'+port;
 let socket;
 try{
  const config=await(await fetch(base+'/api/admin/config')).json();
  config.sources.push({id:'sensor',name:'Sensor',origin:'manual',descriptor:{properties:{temperature:{type:'number',minimum:0,maximum:100}},actions:{},events:{}}});
  const comp=config.pageSets[0].pages[0].components[0];comp.sourceId='sensor';comp.text='Temp: ${temperature} °C';
  const save=await fetch(base+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)});
  assert.equal(save.status,200);
  ({socket}=await connect(port,'web-sim-binding'));
  const initial=await waitPage(socket,{type:'assign',groupId:'demo'});
  assert.equal(initial.page.components[0].text,'Temp:  °C');
  const changed=new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('No differential update')),2000);
   const handle=raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='component_update'){clearTimeout(timeout);socket.off('message',handle);resolve(msg)}};
   socket.on('message',handle);
  });
  const push=async values=>fetch(base+'/api/sources/sensor/values',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(values)});
  assert.equal((await push({temperature:23})).status,200);
  const delta=await changed;assert.equal(delta.pageId,'home');assert.equal(delta.changes[0].text,'Temp: 23 °C');
  assert.equal((await push({temperature:'bad'})).status,400);
  assert.equal((await push({temperature:123})).status,400);
 }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('parallel writes serialize revision checks and preserve a single winner',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-parallel-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 const {port}=await app.start();
 const url='http://127.0.0.1:'+port+'/api/admin/config';
 try{
  const base=await(await fetch(url)).json();
  const a=structuredClone(base),b=structuredClone(base);
  a.pageSets[0].pages[0].title='first';
  b.pageSets[0].pages[0].title='second';
  const put=config=>fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)});
  const results=await Promise.all([put(a),put(b)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const stored=await(await fetch(url)).json();
  assert.equal(stored.revision,base.revision+1);
  assert.ok(['first','second'].includes(stored.pageSets[0].pages[0].title));
 }finally{await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('built-in clock is available and streams independent fields to two labels',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-clock-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 const {port}=await app.start();
 const url='http://127.0.0.1:'+port+'/api/admin/config';
 let socket;
 try{
  const config=await(await fetch(url)).json();
  const clock=config.sources.find(source=>source.id==='clock');
  assert.ok(clock);
  assert.deepEqual(Object.keys(clock.descriptor.properties),['dd','mm','yyyy','hh','ii','ss','elapsed','running']);
  const page=config.pageSets[0].pages[0];
  page.components[0].sourceId='clock';page.components[0].text='Heure ${hh}:${ii}:${ss}';
  page.components[1].sourceId='clock';page.components[1].text='Date ${dd}/${mm}/${yyyy}';
  assert.equal((await fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)})).status,200);
  ({socket}=await connect(port,'web-sim-clock'));
  const first=await waitPage(socket,{type:'assign',groupId:'demo'});
  assert.match(first.page.components[0].text,/Heure \d{2}:\d{2}:\d{2}/);
  assert.match(first.page.components[1].text,/Date \d{2}\/\d{2}\/\d{4}/);
  const update=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('No clock tick')),2200);
   const handle=raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='component_update'&&msg.changes.length===2){clearTimeout(timer);socket.off('message',handle);resolve(msg)}};
   socket.on('message',handle);
  });
  assert.match(update.changes[0].text,/Heure \d{2}:\d{2}:\d{2}/);
  assert.match(update.changes[1].text,/Date \d{2}\/\d{2}\/\d{4}/);
  const blocked=await fetch('http://127.0.0.1:'+port+'/api/sources/clock/values',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({ss:'99'})});
  assert.equal(blocked.status,403);
 }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('component interaction validates page, type and explicitly rejects unconfigured execution', async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-interaction-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 const {port}=await app.start();
 let socket;
 try{
  const connected=await connect(port,'interaction-test');socket=connected.socket;
  const initial=await (await fetch('http://127.0.0.1:'+port+'/api/admin/config')).json();
  initial.pageSets[0].pages[0].components.push({id:'action-button',type:'Button',x:0,y:6,w:2,h:1,text:'Test'});
  initial.pageSets[0].pages[0].components.push({id:'action-toggle',type:'Toggle',x:3,y:6,w:2,h:1,text:'Test'});
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(initial)})).status,200);
  const page=await waitPage(socket,{type:'assign',groupId:'demo'});
  async function request(componentId,pageRevision=page.pageRevision){
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('interaction timeout')),2000);
    const handler=raw=>{const msg=JSON.parse(raw.toString());if(['error','interaction_result'].includes(msg.type)){clearTimeout(timer);socket.off('message',handler);resolve(msg)}};
    socket.on('message',handler);
    socket.send(JSON.stringify({type:'interact',pageId:'home',pageRevision,componentId,requestId:'req-1'}));
   });
  }
  assert.deepEqual(((await request('action-button')).status),'rejected');
  assert.equal((await request('action-toggle')).reason,'source_confirmation_unavailable');
  assert.equal((await request('title')).reason,'action_not_configured');
  assert.equal((await request('action-button',-1)).code,'stale_page');
 }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('static label/icon/button actions navigate only the interacting client',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-static-nav-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 let a,b;
 try{
  const {port}=await app.start();
  const data=await (await fetch('http://127.0.0.1:'+port+'/api/admin/config')).json();
  Object.assign(data.pageSets[0].pages[0].components[0],{type:'Icon',icon:'solid/house',action:'page_target',targetPageId:'second'});
  Object.assign(data.pageSets[0].pages[1].components[0],{type:'Label',action:'page_first'});
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)})).status,200);
  const first=await connect(port,'nav-a'),other=await connect(port,'nav-b');a=first.socket;b=other.socket;
  const pageA=await waitPage(a,{type:'assign',groupId:'demo'});
  const pageB=await waitPage(b,{type:'assign',groupId:'demo'});
  assert.equal(pageA.page.id,'home');assert.equal(pageB.page.id,'home');
  const target=await waitPage(a,{type:'interact',pageId:'home',pageRevision:pageA.pageRevision,componentId:'title',requestId:'nav-1'});
  assert.equal(target.page.id,'second');
  const back=await waitPage(a,{type:'interact',pageId:'second',pageRevision:target.pageRevision,componentId:'title2',requestId:'nav-2'});
  assert.equal(back.page.id,'home');
  const still=await waitPage(b,{type:'navigate',direction:'next'});
  assert.equal(still.page.id,'second');
 }finally{a?.close();b?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('numeric components and icon bars persist and render on client',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-graphics-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 let socket;
 try{
  const {port}=await app.start();
  const config=await (await fetch('http://127.0.0.1:'+port+'/api/admin/config')).json();
  const page=config.pageSets[0].pages[0];
  page.components[0]={...page.components[0],type:'Gauge',min:0,max:100,value:45,display:'circle'};
  const response=await fetch('http://127.0.0.1:'+port+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)});
  assert.equal(response.status,200,JSON.stringify(await response.json()));
  const connected=await connect(port,'graphic-test');socket=connected.socket;
  const state=await waitPage(socket,{type:'assign',groupId:'demo'});
  assert.equal(state.page.components[0].type,'Gauge');
  assert.equal(state.page.components[0].value,45);
  assert.equal(state.page.components[0].display,'circle');
 }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});

test('bound button dispatches POST to source and acknowledges only after HTTP success',async()=>{
 const http=await import('node:http');
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const received=[];
 const target=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;received.push({url:req.url,body:JSON.parse(body)});res.writeHead(204);res.end()});
 await new Promise(resolve=>target.listen(0,'127.0.0.1',resolve));
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-actions-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 let socket;
 try{
  const {port}=await app.start();
  const data=await (await fetch('http://127.0.0.1:'+port+'/api/admin/config')).json();
  data.sources.push({id:'relay',name:'Relay',origin:'manual',endpoint:'http://127.0.0.1:'+target.address().port+'/',descriptor:{properties:{},actions:{fire:{input:{properties:{level:{type:'integer'}}}}},events:{}}});
  data.pageSets[0].pages[0].components.push({id:'fire',type:'Button',sourceId:'relay',action:'fire',parameters:{level:3},x:0,y:6,w:2,h:1,text:'Fire'});
  const saved=await fetch('http://127.0.0.1:'+port+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal(saved.status,200);
  const connected=await connect(port,'action-test');socket=connected.socket;
  const page=await waitPage(socket,{type:'assign',groupId:'demo'});
  const messages=[];
  const done=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('action timeout')),2000);
   socket.on('message',raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='interaction_result'){messages.push(msg);if(msg.status==='acknowledged'){clearTimeout(timer);resolve()}}});
  });
  socket.send(JSON.stringify({type:'interact',pageId:'home',pageRevision:page.pageRevision,componentId:'fire',requestId:'fire-1'}));
  await done;
  assert.deepEqual(messages.map(m=>m.status),['pending','acknowledged']);
  assert.deepEqual(received,[{url:'/actions/fire',body:{level:3}}]);
 }finally{socket?.close();await app.stop();await new Promise(resolve=>target.close(resolve));await rm(dir,{recursive:true,force:true})}
});

test('toggle requires source confirmation and rejects failed HTTP command',async()=>{
 const http=await import('node:http');
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 let fail=false,called=0;
 const target=http.createServer(async(req,res)=>{called++;for await(const chunk of req){}res.writeHead(fail?503:204);res.end()});
 await new Promise(resolve=>target.listen(0,'127.0.0.1',resolve));
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-toggle-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 let socket;
 try{
  const {port}=await app.start(),base='http://127.0.0.1:'+port;
  const data=await(await fetch(base+'/api/admin/config')).json();
  data.sources.push({id:'switch',name:'Switch',origin:'manual',endpoint:'http://127.0.0.1:'+target.address().port+'/',descriptor:{properties:{enabled:{type:'boolean'}},actions:{set_enabled:{input:{properties:{value:{type:'boolean'}}}}},events:{}}});
  data.pageSets[0].pages[0].components.push({id:'switch-toggle',type:'Toggle',sourceId:'switch',property:'enabled',x:0,y:6,w:2,h:1,text:'Toggle'});
  assert.equal((await fetch(base+'/api/admin/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)})).status,200);
  assert.equal((await fetch(base+'/api/sources/switch/values',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:false})})).status,200);
  const connected=await connect(port,'toggle-test');socket=connected.socket;
  const page=await waitPage(socket,{type:'assign',groupId:'demo'});
  const events=[];
  socket.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='interaction_result')events.push(m)});
  const sendToggle=id=>socket.send(JSON.stringify({type:'interact',pageId:'home',pageRevision:page.pageRevision,componentId:'switch-toggle',requestId:id}));
  async function until(status){for(let i=0;i<100;i++){if(events.some(e=>e.status===status))return;await new Promise(r=>setTimeout(r,20))}throw new Error('missing '+status)}
  sendToggle('toggle-1');await until('pending');
  assert.equal(events.some(e=>e.status==='confirmed'),false);
  assert.equal((await fetch(base+'/api/sources/switch/values',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})).status,200);
  await until('confirmed');
  assert.ok(called>=1);
  fail=true;sendToggle('toggle-2');await until('rejected');
  assert.equal(events.find(e=>e.status==='rejected').reason,'source_http_503');
 }finally{socket?.close();await app.stop();await new Promise(resolve=>target.close(resolve));await rm(dir,{recursive:true,force:true})}
});

test('stopwatch demo page executes Start Stop Reset through WebSocket and clock source',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'touchdeck-stopwatch-e2e-'));
 const app=createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(dir,'config.json')});
 let socket;
 try{
  const {port}=await app.start();({socket}=await connect(port,'stopwatch-e2e'));
  await waitPage(socket,{type:'assign',groupId:'demo'});
  await waitPage(socket,{type:'navigate',direction:'next'});
  const page=await waitPage(socket,{type:'navigate',direction:'next'});
  assert.equal(page.page.id,'stopwatch');
  assert.equal(page.page.components.find(c=>c.id==='sw_elapsed').text,'00:00:00');
  async function action(componentId){
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('stopwatch interaction timeout')),2000);
    const listener=raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='interaction_result'&&msg.componentId===componentId&&msg.status==='acknowledged'){clearTimeout(timer);socket.off('message',listener);resolve(msg)}};
    socket.on('message',listener);
    socket.send(JSON.stringify({type:'interact',pageId:'stopwatch',pageRevision:page.pageRevision,componentId,requestId:componentId+'-1'}));
   });
  }
  await action('sw_start');
  await new Promise(resolve=>setTimeout(resolve,1150));
  await action('sw_stop');
  await action('sw_reset');
  assert.equal(app.clients.get('stopwatch-e2e').pageId,'stopwatch');
 }finally{socket?.close();await app.stop();await rm(dir,{recursive:true,force:true})}
});


test('admin protects a group referenced by an offline persisted device', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'touchdeck-offline-assignment-'));
  const file = join(dir, 'config.json');
  const first = createTouchDeckServer({ port: 0, host: '127.0.0.1', dataFile: file });
  let app = first;
  try {
    const { port } = await first.start();
    const initial = await (await fetch('http://127.0.0.1:' + port + '/api/admin/config')).json();
    await first.stop();
    const persisted = { ...initial, schemaVersion: 1, deviceAssignments: { 'offline-device-1': initial.groups[0].id } };
    await writeFile(file, JSON.stringify(persisted));
    app = createTouchDeckServer({ port: 0, host: '127.0.0.1', dataFile: file });
    const restarted = await app.start();
    const url = 'http://127.0.0.1:' + restarted.port + '/api/admin/config';
    const config = await (await fetch(url)).json();
    const assignedGroup = config.groups[0].id;
    config.groups = config.groups.filter(group => group.id !== assignedGroup);
    const response = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'group_has_clients', groupId: assignedGroup });
    const after = await (await fetch(url)).json();
    assert.ok(after.groups.some(group => group.id === assignedGroup));
  } finally {
    await app.stop();
    await rm(dir, { recursive: true, force: true });
  }
});


test('D-028: referenced page sets, sources and device profiles remain protected', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'touchdeck-d028-'));
  const app = createTouchDeckServer({ port: 0, host: '127.0.0.1', dataFile: join(dir, 'config.json') });
  const { port } = await app.start();
  const url = 'http://127.0.0.1:' + port + '/api/admin/config';
  const put = config => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) });
  try {
    const original = await (await fetch(url)).json();
    const setId = original.groups[0].pageSetId;
    const withoutSet = structuredClone(original);
    withoutSet.pageSets = withoutSet.pageSets.filter(set => set.id !== setId);
    const setResponse = await put(withoutSet);
    assert.equal(setResponse.status, 409);
    assert.deepEqual(await setResponse.json(), { error: 'page_set_in_use', pageSetId: setId });

    const withBadProfile = structuredClone(original);
    withBadProfile.pageSets[0].profileId = 'removed-profile';
    const profileResponse = await put(withBadProfile);
    assert.equal(profileResponse.status, 400);
    assert.equal((await profileResponse.json()).error, 'invalid_page_set');

    const sourceId = 'd028_manual_source';
    const source = { id: sourceId, name: 'D028 source', origin: 'manual', descriptor: { properties: {}, actions: {}, events: {} } };
    const withSource = structuredClone(original);
    withSource.sources.push(source);
    const bound = withSource.pageSets[0].pages[0].components[0];
    bound.sourceId = sourceId;
    const created = await put(withSource);
    assert.equal(created.status, 200);
    const current = await (await fetch(url)).json();
    const withoutSource = structuredClone(current);
    withoutSource.sources = withoutSource.sources.filter(item => item.id !== sourceId);
    const sourceResponse = await put(withoutSource);
    assert.equal(sourceResponse.status, 409);
    assert.deepEqual(await sourceResponse.json(), { error: 'source_in_use', sourceId });
    const persisted = await (await fetch(url)).json();
    assert.ok(persisted.sources.some(item => item.id === sourceId));
    assert.equal(persisted.pageSets[0].pages[0].components[0].sourceId, sourceId);
  } finally {
    await app.stop();
    await rm(dir, { recursive: true, force: true });
  }
});


test('admin has four unified tabs and legacy Sources URL redirects to its tab', async () => {
  const { readFile, mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { Script } = await import('node:vm');
  const html = await readFile(fileURLToPath(new URL('../public/admin.html', import.meta.url)), 'utf8');
  for (const tab of ['editor', 'groups', 'sources', 'devices']) {
    assert.match(html, new RegExp('data-td-view="' + tab + '"'));
  }
  assert.match(html, /id="td-sources"/);
  assert.match(html, /id="catalogue"/);
  assert.match(html, /const sections=\\{editor,groups,sources:sourcesSection,devices\\}/);
  const scripts = [...html.matchAll(new RegExp('<script(?:\\s[^>]*)?>([\\s\\S]*?)</script>', 'g'))];
  assert.ok(scripts.length >= 2);
  for (const [, code] of scripts) new Script(code);
  const dir = await mkdtemp(join(tmpdir(), 'touchdeck-unified-admin-'));
  const app = createTouchDeckServer({ port: 0, host: '127.0.0.1', dataFile: join(dir, 'config.json') });
  try {
    const { port } = await app.start();
    const response = await fetch('http://127.0.0.1:' + port + '/admin/sources', { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin#sources');
  } finally {
    await app.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
