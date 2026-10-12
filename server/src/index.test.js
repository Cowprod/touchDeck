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
    const stored = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(stored.pageSets[0].pages[0].title, 'Updated');
    changed.pageSets[0].pages[0].components[0].w = 99;
    assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify(changed) })).status, 400);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).pageSets[0].pages[0].title, 'Updated');
  } finally { await app.stop(); await rm(dir, { recursive: true, force: true }); }
});
