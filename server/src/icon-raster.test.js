import test from 'node:test';
import assert from 'node:assert/strict';
import { iconSource } from './icons.js';
import { rasterSvg } from './icon-raster.js';

test('Font Awesome masks are deterministic, packed and nonempty', async () => {
  for (const name of ['solid/house','solid/heart','solid/gear','solid/circle-check','brands/github','solid/user-injured']) {
    const icon = await iconSource(name);
    assert.ok(icon, name);
    const mask = rasterSvg(icon.bytes.toString('utf8'));
    assert.equal(mask.length, 290);
    assert.equal(mask[0], 48);
    assert.equal(mask[1], 48);
    assert.ok(mask.subarray(2).some(byte => byte !== 0), name);
    assert.deepEqual(mask, rasterSvg(icon.bytes.toString('utf8')));
  }
});

test('HTTP device bitmap endpoint returns expected packed mask', async () => {
  const { createTouchDeckServer } = await import('./index.js');
  const app = createTouchDeckServer({ port: 0, host: '127.0.0.1' });
  const { port } = await app.start();
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/api/icons/mask/solid/house');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.length, 290);
    assert.equal(bytes[0], 48);
    assert.equal(bytes[1], 48);
  } finally { await app.stop(); }
});
