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
