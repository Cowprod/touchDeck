import test from 'node:test';
import assert from 'node:assert/strict';
import { iconManifest, iconSource, validIcon } from './icons.js';

test('icon names are strictly bounded to Font Awesome styles', () => {
  assert.equal(validIcon('solid/house'), true);
  assert.equal(validIcon('brands/github'), true);
  for (const name of ['../package', 'solid/../secret', '/solid/house', 'solid/house.svg', 'unknown/house', 'solid/%2e%2e']) {
    assert.equal(validIcon(name), false, name);
  }
});

test('manifest deduplicates across every group page, regardless of visibility', async () => {
  const pageSet = { pages: [
    { visible: true, components: [{ type: 'Icon', icon: 'solid/house' }] },
    { visible: false, components: [{ type: 'Icon', icon: 'solid/house' }, { type: 'Icon', icon: 'solid/heart' }] }
  ] };
  const manifest = await iconManifest(pageSet);
  assert.equal(manifest.format, 'svg-source');
  assert.deepEqual(manifest.resources.map(r => r.id), ['solid/heart', 'solid/house']);
  assert.ok(manifest.resources.every(r => /^[0-9a-f]{64}$/.test(r.sha256)));
  assert.equal((await iconSource('solid/house')).sha256, manifest.resources[1].sha256);
  assert.deepEqual((await iconManifest({ pages: [] })).resources, []);
});
