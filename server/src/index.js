import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createJsonStore } from './store.js';
import { resolvePage, FONT_SIZES } from './theme.js';
import { validateSource, validateDescriptor } from './sources.js';
import { resolveText, typedValue } from './bindings.js';
import { CLOCK_SOURCE, CLOCK_SOURCE_ID, createClockTicker } from './clock-source.js';

export function createTouchDeckServer({ port = 3000, host = '0.0.0.0', dataFile = process.env.TOUCHDECK_DATA_FILE ?? new URL('../data/config.json', import.meta.url) } = {}) {
  const store = createJsonStore(dataFile);
  let ready = false;
  let configRevision = 0;
  let stopClock = null;
  let mutationTail=Promise.resolve();
  function serializeMutation(operation){
    const task=mutationTail.catch(()=>{}).then(operation);
    mutationTail=task.catch(()=>{});
    return task;
  }
  async function initialize() {
    if (ready) return;
    const saved = await store.load(null);
    if (saved) {
      if (!Array.isArray(saved.groups) || !Array.isArray(saved.pageSets)) throw new Error('Invalid persisted configuration');
      configRevision = Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0;
      groups.clear(); pageSets.clear();
      for (const group of saved.groups) groups.set(group.id, group);
      for (const pageSet of saved.pageSets) pageSets.set(pageSet.id, pageSet);
      sources.clear();for(const source of saved.sources??[])sources.set(source.id,source);
    }
    // Built-in test source: a regular imported descriptor, no second backend.
    if(JSON.stringify(sources.get(CLOCK_SOURCE_ID))!==JSON.stringify(CLOCK_SOURCE)){
      sources.set(CLOCK_SOURCE_ID,CLOCK_SOURCE);
      configRevision+=1;
      await persist();
    }
    ready = true;
  }
  function persist() { return store.save({ schemaVersion: 1, revision: configRevision, groups: [...groups.values()], pageSets: [...pageSets.values()], sources:[...sources.values()] }); }
  function broadcastConfig() {
    for (const client of clients.values()) {
      if (client.groupId && !groups.has(client.groupId)) { client.groupId = null; client.pageId = null; }
      const group = groups.get(client.groupId);
      const allPages = pageSets.get(group?.pageSetId)?.pages ?? [];
      if (!allPages.some(page => page.id === client.pageId)) client.pageId = visiblePages(client.groupId)[0]?.id ?? null;
      send(client, snapshot(client));
    }
  }
  const clients = new Map();
  const groups = new Map();
  const pageSets = new Map();
  const sources = new Map();
  const sourceValues = new Map();
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
    const hydrated=page?{...page,components:page.components.map(item=>({...item,text:resolveText(item.text,item.sourceId,sources.get(item.sourceId),sourceValues.get(item.sourceId))}))}:null;
    return { type: 'page', pageRevision:configRevision, clientId: client.id, groupId: client.groupId, profile: profiles.get(pageSet?.profileId) ?? null, page: resolvePage(hydrated, profiles.get(pageSet?.profileId)) };
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
  function publishSourceValues(sourceId,updates){
    const source=sources.get(sourceId);
    if(!source)return false;
    const values={...(sourceValues.get(sourceId)??{}),...updates};
    sourceValues.set(sourceId,values);
    for(const client of clients.values()){
      const group=groups.get(client.groupId),set=pageSets.get(group?.pageSetId),page=set?.pages.find(item=>item.id===client.pageId);
      if(!page)continue;
      const changes=page.components.filter(item=>item.sourceId===sourceId).map(item=>({id:item.id,text:resolveText(item.text,sourceId,source,values)}));
      if(changes.length)send(client,{type:'component_update',pageId:page.id,pageRevision:configRevision,changes});
    }
    return true;
  }
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const json = (status, body) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); response.end(JSON.stringify(body)); };
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const assets = {
        '/assets/quartz/bootstrap.min.css': ['../node_modules/bootswatch/dist/quartz/bootstrap.min.css', 'text/css; charset=utf-8'],
        '/assets/fontawesome/css/all.min.css': ['../node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'text/css; charset=utf-8']
      };
      const fontMatch = /^\/assets\/fontawesome\/webfonts\/(fa-(?:solid-900|regular-400|brands-400)\.(?:woff2|ttf))$/.exec(url.pathname);
      const asset = assets[url.pathname] ?? (fontMatch ? ['../node_modules/@fortawesome/fontawesome-free/webfonts/' + fontMatch[1], fontMatch[1].endsWith('.woff2') ? 'font/woff2' : 'font/ttf'] : null);
      if (!asset) return json(404, { error: 'asset_not_found' });
      try {
        const bytes = await readFile(fileURLToPath(new URL(asset[0], import.meta.url)));
        response.writeHead(200, { 'content-type': asset[1], 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
        response.end(bytes);
      } catch { json(500, { error: 'asset_unavailable' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/') {
      try { const html = await readFile(fileURLToPath(new URL('../public/index.html', import.meta.url))); response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ws: wss:" }); response.end(html); }
      catch { json(500, { error: 'ui_unavailable' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/admin') {
      try { const html = await readFile(fileURLToPath(new URL('../public/admin.html', import.meta.url))); response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net" }); response.end(html); }
      catch { json(500, { error: 'admin_ui_unavailable' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      response.writeHead(204, { 'cache-control': 'public, max-age=86400' });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/health') return json(200, { ok: true, service: 'touchDeck' });
    if (url.pathname === '/api/admin/config') {
      if (request.method === 'GET') return json(200, { revision: configRevision, groups: [...groups.values()], pageSets: [...pageSets.values()], sources:[...sources.values()] });
      if (request.method === 'PUT') return serializeMutation(async()=>{
        try {
          let body = '';
          for await (const chunk of request) { body += chunk; if (body.length > 262144) return json(413, { error: 'too_large' }); }
          const config = JSON.parse(body);
          if (!Number.isSafeInteger(config.revision) || config.revision !== configRevision)
            return json(409, { error: 'config_conflict', currentRevision: configRevision });
          if (!Array.isArray(config.groups) || !Array.isArray(config.pageSets) || config.groups.length > 100 || config.pageSets.length > 100) return json(400, { error: 'invalid_config' });
          const requestedSources = config.sources===undefined?[...sources.values()]:config.sources;
          if(!Array.isArray(requestedSources)||requestedSources.length>100)return json(400,{error:'invalid_sources'});
          if(!requestedSources.some(source=>source.id===CLOCK_SOURCE_ID))return json(409,{error:'built_in_source'});
          const sourceIds=new Set();
          for(const source of requestedSources){
            if(!validateSource(source)||sourceIds.has(source.id))return json(400,{error:'invalid_source'});
            sourceIds.add(source.id);
            if(source.id===CLOCK_SOURCE_ID&&JSON.stringify(source)!==JSON.stringify(CLOCK_SOURCE))return json(403,{error:'built_in_source'});
            const prior=sources.get(source.id);
            if(source.origin==='imported'&&(!prior||JSON.stringify(prior.descriptor)!==JSON.stringify(source.descriptor)))
              return json(403,{error:'source_import_only',sourceId:source.id});
          }
          const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
          const themeTokens = new Set(['primary','secondary','success','warning','danger','info','light','dark']);
          const validTheme = value => value === undefined || themeTokens.has(value);
          const sets = new Set();
          for (const set of config.pageSets) {
            if (!validId(set.id) || sets.has(set.id) || !profiles.has(set.profileId) || !Array.isArray(set.pages) || set.pages.length > 100) return json(400, { error: 'invalid_page_set' });
            sets.add(set.id);
            const ids = new Set();
            const profile = profiles.get(set.profileId);
            for (const page of set.pages) {
              if (!validId(page.id) || ids.has(page.id) || typeof page.title !== 'string' || page.title.length > 120 || typeof page.visible !== 'boolean' || !validTheme(page.background) || !Array.isArray(page.components) || page.components.length > 100) return json(400, { error: 'invalid_page' });
              ids.add(page.id);
              const components = new Set();
              const occupied = new Set();
              for (const item of page.components) {
                if (!validId(item.id) || components.has(item.id) || (item.sourceId!==undefined&&!sourceIds.has(item.sourceId)) || !validTheme(item.background) || !validTheme(item.color) || (item.fontSize !== undefined && !Object.hasOwn(FONT_SIZES,item.fontSize)) || (item.active !== undefined && typeof item.active !== 'boolean') || (item.disabled !== undefined && typeof item.disabled !== 'boolean') || !['Label','Button','Toggle','Icon','Gauge','Slider'].includes(item.type) || ![item.x,item.y,item.w,item.h].every(Number.isInteger) || item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1 || item.x + item.w > profile.gridColumns || item.y + item.h > profile.gridRows || (item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 250))) return json(400, { error: 'invalid_component' });
                components.add(item.id);
                for (let yy = item.y; yy < item.y + item.h; yy++) for (let xx = item.x; xx < item.x + item.w; xx++) {
                  const cell = yy * profile.gridColumns + xx;
                  if (occupied.has(cell)) return json(400, { error: 'component_overlap', pageId: page.id, componentId: item.id });
                  occupied.add(cell);
                }
              }
            }
          }
          for(const priorSource of sources.values()){
            if(!sourceIds.has(priorSource.id)&&config.pageSets.some(set=>set.pages.some(page=>page.components.some(item=>item.sourceId===priorSource.id))))
              return json(409,{error:'source_in_use',sourceId:priorSource.id});
          }
          for (const group of groups.values()) {
            if (!config.groups.some(next => next.id === group.id) && [...clients.values()].some(client => client.groupId === group.id))
              return json(409, { error: 'group_has_clients', groupId: group.id });
          }
          for (const set of pageSets.values()) {
            if (!sets.has(set.id) && config.groups.some(group => group.pageSetId === set.id))
              return json(409, { error: 'page_set_in_use', pageSetId: set.id });
          }
          const groupIds = new Set();
          for (const group of config.groups) {
            if (!validId(group.id) || groupIds.has(group.id) || typeof group.name !== 'string' || group.name.length > 120 || !sets.has(group.pageSetId)) return json(400, { error: 'invalid_group' });
            groupIds.add(group.id);
          }
          await store.save({ schemaVersion: 1, revision: configRevision + 1, groups: config.groups, pageSets: config.pageSets, sources:requestedSources });
          configRevision += 1;
          groups.clear(); pageSets.clear();
          for (const set of config.pageSets) pageSets.set(set.id, set);
          for (const group of config.groups) groups.set(group.id, group);
          sources.clear();for(const source of requestedSources)sources.set(source.id,source);
          broadcastConfig();
          return json(200, { ok: true, revision: configRevision });
        } catch (error) { return json(400, { error: 'invalid_request' }); }
      });
      return json(405, { error: 'method_not_allowed' });
    }
    if (url.pathname === '/api/admin/sources/import' && request.method === 'PUT') return serializeMutation(async()=>{
      try {
        let body='';for await(const chunk of request){body+=chunk;if(body.length>131072)return json(413,{error:'too_large'})}
        const data=JSON.parse(body);
        if(!Number.isSafeInteger(data.revision)||data.revision!==configRevision)return json(409,{error:'config_conflict',currentRevision:configRevision});
        const idOk=typeof data.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(data.id);
        if(!idOk||!validateDescriptor(data.descriptor)||typeof data.name!=='string'||!data.name.length||data.name.length>120)return json(400,{error:'invalid_descriptor'});
        if(!sources.has(data.id)&&sources.size>=100)return json(400,{error:'source_limit'});
        if(data.id===CLOCK_SOURCE_ID)return json(403,{error:'built_in_source'});
        const source={id:data.id,name:data.name,origin:'imported',descriptor:data.descriptor};
        const nextSources=[...sources.values()].filter(item=>item.id!==data.id).concat(source);
        await store.save({schemaVersion:1,revision:configRevision+1,groups:[...groups.values()],pageSets:[...pageSets.values()],sources:nextSources});
        configRevision+=1;sources.set(data.id,source);sourceValues.delete(data.id);broadcastConfig();
        return json(200,{ok:true,revision:configRevision,source});
      }catch{return json(400,{error:'invalid_request'})}
    });
    const sourcePushMatch=/^\/api\/sources\/([a-zA-Z0-9_-]{1,80})\/values$/.exec(url.pathname);
    if(sourcePushMatch&&request.method==='PUT'){
      const source=sources.get(sourcePushMatch[1]);
      if(!source)return json(404,{error:'source_not_found'});
      if(source.id===CLOCK_SOURCE_ID)return json(403,{error:'built_in_source'});
      try{
        let body='';for await(const chunk of request){body+=chunk;if(body.length>32768)return json(413,{error:'too_large'})}
        const updates=JSON.parse(body);
        if(!updates||typeof updates!=='object'||Array.isArray(updates))return json(400,{error:'invalid_values'});
        for(const [name,value] of Object.entries(updates)){
          const definition=source.descriptor.properties?.[name];
          if(!definition||!typedValue(value,definition))return json(400,{error:'invalid_property',property:name});
          if(typeof value==='number'&&((typeof definition.minimum==='number'&&value<definition.minimum)||(typeof definition.maximum==='number'&&value>definition.maximum)))return json(400,{error:'out_of_range',property:name});
        }
        publishSourceValues(source.id,updates);
        return json(200,{ok:true,updated:Object.keys(updates).length});
      }catch{return json(400,{error:'invalid_request'})}
    }
    if (url.pathname === '/api/admin/clients') {
      if (request.method === 'GET') return json(200,{ clients:[...clients.values()].map(client=>({id:client.id,groupId:client.groupId,pageId:client.pageId,online:client.sockets.size>0})) });
      if (request.method === 'PUT') {
        try {
          let body='';for await(const chunk of request){body+=chunk;if(body.length>4096)return json(413,{error:'too_large'})}
          const data=JSON.parse(body);
          if(typeof data.clientId!=='string'||!Object.hasOwn(data,'groupId')||(data.groupId!==null&&!groups.has(data.groupId)))return json(400,{error:'invalid_assignment'});
          const client=clients.get(data.clientId);
          if(!client)return json(404,{error:'client_not_found'});
          if(!client.id.startsWith('web-sim-'))return json(403,{error:'only_web_simulators_supported'});
          client.groupId=data.groupId;
          client.pageId=visiblePages(client.groupId)[0]?.id??null;
          send(client,{type:'welcome',clientId:client.id,groupId:client.groupId});
          send(client,snapshot(client));
          return json(200,{ok:true});
        }catch{return json(400,{error:'invalid_request'})}
      }
      return json(405,{error:'method_not_allowed'});
    }
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
        if (message.groupId !== 'demo') { socket.send(JSON.stringify({ type: 'error', code: 'admin_required' })); return; }
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
    async start() { await initialize(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); stopClock=createClockTicker(values=>publishSourceValues(CLOCK_SOURCE_ID,values)); return server.address(); },
    async stop() { stopClock?.();stopClock=null;for (const socket of wss.clients) socket.terminate(); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); }
  };
}
if (process.env.pm_id !== undefined || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  const app = createTouchDeckServer({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
  app.start().then(address => console.log('touchDeck listening on', address)).catch(error => { console.error(error); process.exitCode = 1; });
}
