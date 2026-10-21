import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createTouchDeckServer } from '../src/index.js';

test('OTA publication rejects mismatch and commits a verified release without installation', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const build = join(root, '.pio/build/esp32c3_diagnostic');
  const ota = join(root, 'server/data/ota');
  // Never run this filesystem fixture against a deployed OTA release.
  for (const path of [build, ota]) {
    try { await stat(path); throw new Error('OTA test refuses to touch existing directory: '+path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const tmp = await mkdtemp(join(tmpdir(), 'touchdeck-ota-test-'));
  const token = 'test-only-ota-token-000000000000';
  const oldToken = process.env.TOUCHDECK_OTA_ADMIN_TOKEN;
  process.env.TOUCHDECK_OTA_ADMIN_TOKEN = token;
  const image = Buffer.alloc(8192, 0);
  image[0] = 0xe9;
  image.write('0.1.2', 128);
  const hash = createHash('sha256').update(image).digest('hex');
  const app = createTouchDeckServer({port:0,host:'127.0.0.1',dataFile:join(tmp,'config.json')});
  try {
    await mkdir(build,{recursive:true});
    await writeFile(join(build,'firmware.bin'),image);
    const address = await app.start();
    const base = 'http://127.0.0.1:'+address.port;
    const get = async p => fetch(base+p).then(r=>r.json());
    const publish = async payload => {
      const r = await fetch(base+'/api/admin/firmware/publish',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      return {status:r.status,body:await r.json()};
    };
    const release = {version:'0.1.2',sha256:hash,size:image.length};
    assert.equal((await publish({...release,version:'invalid'})).status,400);
    assert.equal((await publish({...release,version:'0.1.1'})).status,409);
    assert.equal((await publish({...release,sha256:'0'.repeat(64)})).status,409);
    assert.equal((await publish({...release,size:image.length+1})).status,409);
    assert.equal((await get('/api/firmware/manifest')).available,false);
    const unauthorized = await fetch(base+'/api/admin/firmware/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(release)});
    assert.equal(unauthorized.status,403);
    const ok = await publish(release);
    assert.equal(ok.status,200);
    assert.equal(ok.body.version,'0.1.2');
    const manifest = await get('/api/firmware/manifest');
    assert.equal(manifest.version,'0.1.2');
    assert.equal(manifest.sha256,hash);
    assert.equal(manifest.size,image.length);
    assert.equal(manifest.path,undefined);
    const download = await fetch(base+'/api/firmware/esp32c3.bin');
    assert.equal(download.status,200);
    assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),hash);
    assert.equal((await readFile(join(ota,'release.json'),'utf8')).includes('firmware-'+hash+'.bin'),true);
    assert.equal((await publish({...release,version:'1.0.0'})).status,409);
    assert.equal((await get('/api/firmware/manifest')).version,'0.1.2');
  } finally {
    await app.stop().catch(()=>{});
    if (oldToken === undefined) delete process.env.TOUCHDECK_OTA_ADMIN_TOKEN;
    else process.env.TOUCHDECK_OTA_ADMIN_TOKEN = oldToken;
    await rm(tmp,{recursive:true,force:true});
    await rm(build,{recursive:true,force:true});
    await rm(ota,{recursive:true,force:true});
  }
});
