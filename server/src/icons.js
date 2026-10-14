import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// SVGs are server-only source assets. ESP firmware must not decode SVG.
const ROOT = new URL('../node_modules/@fortawesome/fontawesome-free/svgs/', import.meta.url);
export const validIcon = name => typeof name === 'string' && /^(solid|regular|brands)\/[a-z0-9-]{1,80}$/.test(name);

export async function iconSource(name) {
  if (!validIcon(name)) return null;
  try {
    const bytes = await readFile(new URL(name + '.svg', ROOT));
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function iconManifest(pageSet) {
  const names = [...new Set((pageSet?.pages ?? []).flatMap(page =>
    page.components.flatMap(item => item.type === 'Icon' && validIcon(item.icon) ? [item.icon] : item.type === 'IconBar' ? (item.icons ?? []).filter(validIcon) : [])
  ))].sort();
  const resources = [];
  for (const name of names) {
    const source = await iconSource(name);
    if (!source) throw new Error('icon_missing:' + name);
    resources.push({ id: name, sha256: source.sha256, sourceBytes: source.bytes.length });
  }
  return { schemaVersion: 1, format: 'svg-source', resources };
}

export async function iconCatalog(query = '', limit = 80) {
  const term = String(query).toLowerCase().trim();
  const matches = [];
  for (const style of ['solid', 'regular', 'brands']) {
    const files = await readdir(new URL(style + '/', ROOT));
    for (const file of files) {
      if (!file.endsWith('.svg')) continue;
      const name = style + '/' + file.slice(0, -4);
      if (!term || name.includes(term)) matches.push(name);
    }
  }
  matches.sort();
  return { total: matches.length, icons: matches.slice(0, limit) };
}
