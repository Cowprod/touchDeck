import test from 'node:test';
import assert from 'node:assert/strict';
import { iconSource } from './icons.js';
import { rasterSvg } from './icon-raster.js';

test('Font Awesome masks are deterministic, packed and nonempty', async () => {
  for (const name of ['solid/house','solid/heart','solid/gear','solid/circle-check','brands/github']) {
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
