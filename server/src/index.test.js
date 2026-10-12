import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createTouchDeckServer } from './index.js';

function connect(port, clientId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const messages = [];
    socket.on('error', reject);
    socket.on('message', raw => { const msg = JSON.parse(raw.toString()); messages.push(msg); if (msg.type === 'page') resolve({ socket, messages }); });
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', clientId })));
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
    assert.equal((await waitPage(a.socket, { type: 'navigate', direction: 'next' })).page.id, 'home');
    assert.equal((await waitPage(b.socket, { type: 'navigate', direction: 'previous' })).page.id, 'second');
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
  assert.equal(after.sources.length,2);
  assert.equal(after.sources[1].origin,'imported');
  const changed=structuredClone(after);
  changed.sources[1].descriptor.properties.temperature.type='string';
  const blocked=await put('/config',changed);
  assert.equal(blocked.status,403);
  assert.equal((await blocked.json()).error,'source_import_only');
  const newer={properties:{temperature:{type:'integer'}},actions:{},events:{}};
  const reimport=await put('/sources/import',{revision:after.revision,id:'imported-1',name:'Imported source',descriptor:newer});
  assert.equal(reimport.status,200);
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.equal(saved.sources.find(item=>item.id==='imported-1').descriptor.properties.temperature.type,'integer');
  assert.equal(saved.sources.length,2);
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
  config.sources=[{id:'sensor',name:'Sensor',origin:'manual',descriptor:{properties:{temperature:{type:'number',minimum:0,maximum:100}},actions:{},events:{}}}];
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
  assert.equal(stored.revision,1);
  assert.ok(['first','second'].includes(stored.pageSets[0].pages[0].title));
 }finally{await app.stop();await rm(dir,{recursive:true,force:true})}
});
