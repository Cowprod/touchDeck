import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

export function createTouchDeckServer({ port = 3000, host = '0.0.0.0' } = {}) {
  const clients = new Map();
  const groups = new Map();
  const pageSets = new Map();
  const profiles = new Map([['round-240', { id: 'round-240', width: 240, height: 240, shape: 'round', gridColumns: 8, gridRows: 8 }]]);
  const exampleSet = { id: 'demo', profileId: 'round-240', pages: [
    { id: 'home', title: 'Accueil', visible: true, components: [
      { id: 'title', type: 'Label', x: 1, y: 1, w: 6, h: 2, text: 'touchDeck' },
      { id: 'status', type: 'Label', x: 1, y: 4, w: 6, h: 1, text: 'Simulateur Web' }] },
    { id: 'second', title: 'Page 2', visible: true, components: [
      { id: 'title2', type: 'Label', x: 1, y: 2, w: 6, h: 2, text: 'Deuxieme page' }] }
  ] };
  pageSets.set(exampleSet.id, exampleSet);
  groups.set('demo', { id: 'demo', name: 'Demonstration', pageSetId: 'demo' });
  function visiblePages(groupId) {
    const group = groups.get(groupId);
    return (pageSets.get(group?.pageSetId)?.pages ?? []).filter(page => page.visible);
  }
  function snapshot(client) {
    const group = groups.get(client.groupId);
    const pageSet = pageSets.get(group?.pageSetId);
    const page = pageSet?.pages.find(item => item.id === client.pageId);
    return { type: 'page', clientId: client.id, groupId: client.groupId, profile: profiles.get(pageSet?.profileId) ?? null, page: page ?? null };
  }
  function send(client, payload) {
    const message = JSON.stringify(payload);
    for (const socket of client.sockets) if (socket.readyState === 1) socket.send(message);
  }
  function navigate(client, direction) {
    const pages = visiblePages(client.groupId);
    if (!pages.length) { client.pageId = null; send(client, snapshot(client)); return; }
    const index = pages.findIndex(page => page.id === client.pageId);
    const delta = direction === 'next' ? 1 : -1;
    client.pageId = pages[index < 0 ? (delta > 0 ? 0 : pages.length - 1) : (index + delta + pages.length) % pages.length].id;
    send(client, snapshot(client));
  }
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const json = (status, body) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); response.end(JSON.stringify(body)); };
    if (request.method === 'GET' && url.pathname === '/') {
      try { const html = await readFile(fileURLToPath(new URL('../public/index.html', import.meta.url))); response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ws: wss:" }); response.end(html); }
      catch { json(500, { error: 'ui_unavailable' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/health') return json(200, { ok: true, service: 'touchDeck' });
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') return json(200, { profiles: [...profiles.values()], groups: [...groups.values()], pageSets: [...pageSets.values()] });
    return json(404, { error: 'not_found' });
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', socket => {
    let current = null;
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { socket.send(JSON.stringify({ type: 'error', code: 'invalid_json' })); return; }
      if (message?.type === 'hello') {
        if (typeof message.clientId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(message.clientId)) {
          socket.send(JSON.stringify({ type: 'error', code: 'invalid_client_id' })); return;
        }
        if (current) current.sockets.delete(socket);
        current = clients.get(message.clientId);
        if (!current) {
          current = { id: message.clientId, groupId: null, pageId: null, sockets: new Set() };
          clients.set(current.id, current);
        }
        current.sockets.add(socket);
        send(current, { type: 'welcome', clientId: current.id, groupId: current.groupId });
        send(current, snapshot(current));
      } else if (message?.type === 'navigate' && current && ['next', 'previous'].includes(message.direction)) {
        navigate(current, message.direction);
      } else if (message?.type === 'assign' && current && typeof message.groupId === 'string' && groups.has(message.groupId)) {
        // Temporary simulator-only assignment; authorization is required before exposing beyond local development.
        if (host !== '127.0.0.1' && host !== '::1') { socket.send(JSON.stringify({ type: 'error', code: 'admin_required' })); return; }
        current.groupId = message.groupId;
        current.pageId = visiblePages(current.groupId)[0]?.id ?? null;
        send(current, snapshot(current));
      } else {
        socket.send(JSON.stringify({ type: 'error', code: 'invalid_message' }));
      }
    });
    socket.on('close', () => { if (current) current.sockets.delete(socket); });
  });
  return {
    server, wss, clients,
    async start() { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); return server.address(); },
    async stop() { for (const socket of wss.clients) socket.terminate(); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); }
  };
}
if (process.env.pm_id !== undefined || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  const app = createTouchDeckServer({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
  app.start().then(address => console.log('touchDeck listening on', address)).catch(error => { console.error(error); process.exitCode = 1; });
}
