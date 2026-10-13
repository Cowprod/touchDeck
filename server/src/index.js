import http from 'node:http';
import os from 'node:os';

import { readFile } from 'node:fs/promises';
import { iconSource, iconManifest, iconCatalog, validIcon } from './icons.js';
import { rasterSvg } from './icon-raster.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createJsonStore } from './store.js';
import { resolvePage, FONT_SIZES } from './theme.js';
import { validateSource, validateDescriptor } from './sources.js';
import { resolveText, typedValue } from './bindings.js';
import { CLOCK_SOURCE, CLOCK_SOURCE_ID, createClockTicker, createStopwatch } from './clock-source.js';

export function createTouchDeckServer({ port = 3000, host = '0.0.0.0', dataFile = process.env.TOUCHDECK_DATA_FILE ?? new URL('../data/config.json', import.meta.url) } = {}) {
  const store = createJsonStore(dataFile);
  let ready = false;
  let configRevision = 0;
  let stopClock = null;
  const stopwatch=createStopwatch();
  let bonjour = null;
  let advertised = null;
  const instanceId = process.env.TOUCHDECK_INSTANCE_ID ?? os.hostname().replace(/[^a-zA-Z0-9_-]/g,'-');
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
    const demo=pageSets.get('demo');
    if(demo&&!demo.pages.some(page=>page.id==='stopwatch')){
      demo.pages.push({id:'stopwatch',title:'Chronomètre',visible:true,background:'dark',components:[
        {id:'sw_title',type:'Label',x:1,y:1,w:6,h:1,text:'Chronomètre',color:'light'},
        {id:'sw_elapsed',type:'Label',sourceId:'clock',x:1,y:2,w:6,h:2,text:'${elapsed}',color:'success',fontSize:'large'},
        {id:'sw_start',type:'Button',sourceId:'clock',action:'start',x:0,y:5,w:3,h:2,text:'Start',background:'success'},
        {id:'sw_stop',type:'Button',sourceId:'clock',action:'stop',x:3,y:5,w:2,h:2,text:'Stop',background:'warning',color:'dark'},
        {id:'sw_reset',type:'Button',sourceId:'clock',action:'reset',x:5,y:5,w:3,h:2,text:'Reset',background:'danger'}
      ]});
      configRevision+=1;await persist();
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
  const pendingToggles = new Map();
  const actionQueues = new Map();
  async function dispatchSource(source,action,parameters){
    if(source.id===CLOCK_SOURCE_ID){publishSourceValues(CLOCK_SOURCE_ID,stopwatch.action(action));return;}
    if(typeof source.endpoint!=='string')throw new Error('source_endpoint_missing');
    const url=new URL(source.endpoint);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash)throw new Error('invalid_source_endpoint');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    try{
      const target=new URL('actions/'+encodeURIComponent(action),url.href.endsWith('/')?url.href:url.href+'/');
      const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(parameters),signal:controller.signal,redirect:'error'});
      if(!response.ok)throw new Error('source_http_'+response.status);
    }finally{clearTimeout(timer)}
  }
  function queueAction(client,task){
    const previous=actionQueues.get(client.id)??Promise.resolve();
    const next=previous.catch(()=>{}).then(task);
    actionQueues.set(client.id,next);
    next.finally(()=>{if(actionQueues.get(client.id)===next)actionQueues.delete(client.id)}).catch(()=>{});
  }
  const latestFirmwareVersion=process.env.TOUCHDECK_FIRMWARE_VERSION??'0.1.0';
  const deviceSourceId=id=>'device_'+id.slice(0,73);
  function deviceSource(id){
    const sourceId=deviceSourceId(id);
    if(!sources.has(sourceId)){
      sources.set(sourceId,{id:sourceId,name:'Appareil '+id,origin:'imported',descriptor:{
        title:'État système de '+id,description:'Informations publiées par le serveur pour cet appareil',
        properties:Object.fromEntries(['firmwareVersion','latestVersion','updateAvailable','connected','lastSeen','deviceType'].map(key=>[key,{type:key==='updateAvailable'||key==='connected'?'boolean':'string',readOnly:true}])),
        actions:{},events:{}
      }});
    }
    return sourceId;
  }
  function publishDevice(client,connected){
    if(!client.deviceType)return;
    const sourceId=deviceSource(client.id);
    const installed=client.firmwareVersion??'';
    const version=installed.split('+')[0];
    publishSourceValues(sourceId,{firmwareVersion:installed,latestVersion:latestFirmwareVersion,
      updateAvailable:version!==''&&version!==latestFirmwareVersion,connected,
      lastSeen:new Date().toISOString(),deviceType:client.deviceType});
  }
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
  function interact(client,message){
    const group=groups.get(client.groupId),set=pageSets.get(group?.pageSetId);
    const page=set?.pages.find(p=>p.id===client.pageId);
    if(!page||message.pageId!==page.id||message.pageRevision!==configRevision)return {error:'stale_page'};
    const item=page.components.find(c=>c.id===message.componentId);
    if(!item||!['Button','Toggle'].includes(item.type)||item.disabled)return {error:'invalid_interaction'};
    const requestId=typeof message.requestId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(message.requestId)?message.requestId:null;
    if(!requestId)return {error:'invalid_request_id'};
    if(item.type==='Toggle'&&item.sourceId&&item.property){
      const source=sources.get(item.sourceId),definition=source?.descriptor?.properties?.[item.property];
      if(source&&!source.descriptor.actions?.[item.writeAction??('set_'+item.property)])return {error:'invalid_toggle_write_action'};
      if(!definition||definition.type!=='boolean'||definition.readOnly)return {error:'invalid_toggle_binding'};
      const key=client.id+':'+item.id;
      if(pendingToggles.has(key))return {error:'interaction_pending'};
      const previous=sourceValues.get(item.sourceId)?.[item.property];
      if(typeof previous!=='boolean')return {error:'source_value_unknown'};
      const expected=!previous;
      const pending={client,componentId:item.id,requestId,sourceId:item.sourceId,property:item.property,expected};
      pending.timer=setTimeout(()=>{
        if(pendingToggles.get(key)!==pending)return;
        pendingToggles.delete(key);
        send(client,{type:'interaction_result',componentId:item.id,requestId,status:'timeout',value:previous});
      },5000);
      pendingToggles.set(key,pending);
      send(client,{type:'interaction_result',componentId:item.id,requestId,status:'pending',value:previous});
      queueAction(client,async()=>{
        try{await dispatchSource(source,item.writeAction??('set_'+item.property),{value:expected})}
        catch(error){
          if(pendingToggles.get(key)===pending){
            clearTimeout(pending.timer);pendingToggles.delete(key);
            send(client,{type:'interaction_result',componentId:item.id,requestId,status:'rejected',reason:error.message,value:previous});
          }
        }
      });
      return {};
    }
    if(item.type==='Button'&&item.sourceId&&item.action){
      const source=sources.get(item.sourceId),definition=source?.descriptor?.actions?.[item.action];
      if(!definition)return {error:'invalid_action_binding'};
      const params={};
      for(const [name,value] of Object.entries(item.parameters??{})){
        const spec=definition.input?.properties?.[name]??definition.input?.[name];
        if(!spec)return {error:'invalid_action_parameter'};
        const resolved=typeof value==='object'&&value!==null&&Object.hasOwn(value,'variable')?sourceValues.get(item.sourceId)?.[value.variable]:value;
        if(resolved===undefined||!typedValue(resolved,spec))return {error:'invalid_action_parameter'};
        params[name]=resolved;
      }
      send(client,{type:'interaction_result',componentId:item.id,requestId,status:'pending'});
      queueAction(client,async()=>{
        try{
          await dispatchSource(source,item.action,params);
          send(client,{type:'interaction_result',componentId:item.id,requestId,status:'acknowledged'});
        }catch(error){
          send(client,{type:'interaction_result',componentId:item.id,requestId,status:'rejected',reason:error.message});
        }
      });
      return {};
    }
    // No action binding means no execution.
    if(item.type==='Button'){
      send(client,{type:'interaction_result',componentId:item.id,requestId,status:'rejected',reason:'action_not_configured'});
      return {};
    }
    send(client,{type:'interaction_result',componentId:item.id,requestId,status:'rejected',reason:'source_confirmation_unavailable'});
    return {};
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
    for(const [key,pending] of pendingToggles){
      if(pending.sourceId!==sourceId||!Object.hasOwn(updates,pending.property))continue;
      if(updates[pending.property]===pending.expected){
        clearTimeout(pending.timer);pendingToggles.delete(key);
        send(pending.client,{type:'interaction_result',componentId:pending.componentId,requestId:pending.requestId,status:'confirmed',value:pending.expected});
      }
    }
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
      try { const html = await readFile(fileURLToPath(new URL('../public/admin.html', import.meta.url))); response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'" }); response.end(html); }
      catch { json(500, { error: 'admin_ui_unavailable' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      response.writeHead(204, { 'cache-control': 'public, max-age=86400' });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/icons/catalog') {
      const query = url.searchParams.get('q') ?? '';
      if (query.length > 80) return json(400, { error: 'invalid_query' });
      return json(200, await iconCatalog(query));
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/icons/mask/')) {
      const name = url.pathname.slice('/api/icons/mask/'.length);
      if (!validIcon(name)) return json(400, { error: 'invalid_icon' });
      const icon = await iconSource(name);
      if (!icon) return json(404, { error: 'icon_not_found' });
      try {
        const bitmap = rasterSvg(icon.bytes.toString('utf8'), 48);
        response.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', 'x-icon-sha256': icon.sha256 });
        response.end(bitmap);
      } catch { return json(422, { error: 'unsupported_svg_path' }); }
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/icons/source/')) {
      const name = url.pathname.slice('/api/icons/source/'.length);
      if (!validIcon(name)) return json(400, { error: 'invalid_icon' });
      const icon = await iconSource(name);
      if (!icon) return json(404, { error: 'icon_not_found' });
      response.writeHead(200, { 'content-type': 'image/svg+xml', 'etag': '"' + icon.sha256 + '"', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
      response.end(icon.bytes);
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/icons/manifest/')) {
      const groupId = url.pathname.slice('/api/icons/manifest/'.length);
      const group = groups.get(groupId);
      if (!group) return json(404, { error: 'group_not_found' });
      try { return json(200, { groupId, ...await iconManifest(pageSets.get(group.pageSetId)) }); }
      catch { return json(500, { error: 'icon_manifest_unavailable' }); }
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
                if (!validId(item.id) || components.has(item.id) || (item.sourceId!==undefined&&!sourceIds.has(item.sourceId)) || !validTheme(item.background) || !validTheme(item.color) || (item.fontSize !== undefined && !Object.hasOwn(FONT_SIZES,item.fontSize)) || (item.radius !== undefined && ![0,1,2].includes(item.radius)) || (item.active !== undefined && typeof item.active !== 'boolean') || (item.disabled !== undefined && typeof item.disabled !== 'boolean') || !['Label','Button','Toggle','Icon','Gauge','Slider'].includes(item.type) || ![item.x,item.y,item.w,item.h].every(Number.isInteger) || item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1 || item.x + item.w > profile.gridColumns || item.y + item.h > profile.gridRows || (item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 250)) || (item.action!==undefined&&(item.type!=='Button'||!item.sourceId||typeof item.action!=='string')) || (item.writeAction!==undefined&&(item.type!=='Toggle'||typeof item.writeAction!=='string')) || (item.parameters!==undefined&&(item.type!=='Button'||!item.parameters||typeof item.parameters!=='object'||Array.isArray(item.parameters))) || (item.property!==undefined&&(item.type!=='Toggle'||typeof item.property!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.property)||!item.sourceId)) || (item.icon !== undefined && (item.type !== 'Icon' || !validIcon(item.icon)))) return json(400, { error: 'invalid_component' });
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
          for(const client of clients.values())publishDevice(client,client.sockets.size>0);
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
        if(data.id===CLOCK_SOURCE_ID||data.id.startsWith('device_'))return json(403,{error:'built_in_source'});
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
      if(source.id===CLOCK_SOURCE_ID||source.id.startsWith('device_'))return json(403,{error:'built_in_source'});
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
      if (request.method === 'GET') return json(200,{ clients:[...clients.values()].map(client=>({id:client.id,groupId:client.groupId,pageId:client.pageId,online:client.sockets.size>0,firmwareVersion:sourceValues.get(deviceSourceId(client.id))?.firmwareVersion??null,latestVersion:sourceValues.get(deviceSourceId(client.id))?.latestVersion??null,updateAvailable:sourceValues.get(deviceSourceId(client.id))?.updateAvailable??null,deviceType:client.deviceType??null})) });
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
        current.firmwareVersion=typeof message.firmwareVersion==='string'&&message.firmwareVersion.length<=100?message.firmwareVersion:null;
        current.deviceType=typeof message.deviceType==='string'&&message.deviceType.length<=40?message.deviceType:null;
        publishDevice(current,true);
        send(current, { type: 'welcome', clientId: current.id, groupId: current.groupId });
        send(current, snapshot(current));
      } else if (message?.type === 'interact' && current) {
        const result=interact(current,message);
        if(result.error)socket.send(JSON.stringify({type:'error',code:result.error}));
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
    socket.on('close', () => { if (current){current.sockets.delete(socket);publishDevice(current,current.sockets.size>0);} });
  });
  return {
    server, wss, clients,
    async start() {
      await initialize();
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      stopClock=createClockTicker(values=>publishSourceValues(CLOCK_SOURCE_ID,{...values,...stopwatch.values()}));
      try {
        const { Bonjour } = await import('bonjour-service');
        bonjour=new Bonjour();
        const addresses=Object.values(os.networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).map(a=>a.address);
        const uniqueAddresses=[...new Set(addresses)];
        const txt={id:instanceId,ver:'1',path:'/ws'};
        uniqueAddresses.forEach((address,i)=>{if(i<8)txt['ip'+i]=address;});
        advertised=bonjour.publish({name:'TouchDeck '+instanceId,type:'touchdeck',protocol:'tcp',port:server.address().port,txt});
        console.log('touchDeck mDNS IPv4 candidates:',uniqueAddresses.join(', '));
        console.log('touchDeck mDNS published:',instanceId,'port',server.address().port);
      } catch(error) { console.error('touchDeck mDNS publish failed:',error); }
      return server.address();
    },
    async stop() {
      for(const pending of pendingToggles.values())clearTimeout(pending.timer);
      pendingToggles.clear(); stopClock?.();stopClock=null;advertised?.stop();bonjour?.destroy();advertised=null;bonjour=null;for (const socket of wss.clients) socket.terminate(); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); }
  };
}
if (process.env.pm_id !== undefined || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  const app = createTouchDeckServer({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
  app.start().then(address => console.log('touchDeck listening on', address)).catch(error => { console.error(error); process.exitCode = 1; });
}
