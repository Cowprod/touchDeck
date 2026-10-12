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
