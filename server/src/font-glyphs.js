import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';
import { createCanvas } from '@napi-rs/canvas';

const FONT_URL = new URL('../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff', import.meta.url);
let loaded;
async function font() {
  if (!loaded) loaded = readFile(FONT_URL).then(data => opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  return loaded;
}
export const FONT_FAMILY = 'IBM Plex Mono';
export const FONT_SIZES = [12, 15, 20];
const DYNAMIC_NUMERIC = '0123456789-+.,:%° /';
const DYNAMIC_TEXT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_.,:/+%°!?()[]#@éèêëàâîïôùûüçÉÈÀ';
export function requiredGlyphs(pageSet, sourceLookup = () => null) {
  const bySize = new Map();
  for (const page of pageSet?.pages ?? []) {
    if (page.visible === false) continue;
    for (const item of page.components ?? []) {
      if (item.type === 'Icon') continue;
      const size = item.fontSize === 'small' ? 12 : item.fontSize === 'large' ? 20 : 15;
      if (!bySize.has(size)) bySize.set(size, new Set());
      const chars = bySize.get(size);
      const text = String(item.text ?? '');
      const matches = [...text.matchAll(/\$\{([a-zA-Z0-9_-]{1,80})\}/g)];
      const plain = text.replace(/\$\{[a-zA-Z0-9_-]{1,80}\}/g, '');
      for (const char of plain) chars.add(char);
      for (const match of matches) {
        const type = sourceLookup(item.sourceId, match[1]);
        const reserve = ['number','integer','boolean'].includes(type) || ['page_number','page_count'].includes(match[1]) ? DYNAMIC_NUMERIC : DYNAMIC_TEXT;
        for (const char of reserve) chars.add(char);
      }
    }
  }
  return [...bySize].flatMap(([size, chars]) => [...chars].filter(ch => ch !== '\n' && ch !== '\r' && ch !== '\t').map(ch => ({ size, codepoint: ch.codePointAt(0) }))).sort((a,b) => a.size-b.size || a.codepoint-b.codepoint);
}
export const glyphId = (size, codepoint) => size + '-' + codepoint.toString(16);
export function parseGlyphId(id) {
  const match = /^(12|15|20)-([0-9a-f]{1,6})$/.exec(id);
  if (!match) return null;
  const size = Number(match[1]), codepoint = parseInt(match[2], 16);
  if (codepoint < 32 || codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff)) return null;
  return { size, codepoint };
}
const cache = new Map();
export async function glyphBitmap(size, codepoint) {
  const id = glyphId(size,codepoint);
  if (cache.has(id)) return cache.get(id);
  const face = await font();
  const glyph = face.charToGlyph(String.fromCodePoint(codepoint));
  const width = Math.max(1, Math.ceil((glyph.advanceWidth || face.unitsPerEm * .6) * size / face.unitsPerEm));
  const height = size + 4;
  if (width > 64 || height > 64) throw Error('glyph_too_large');
  const canvas = createCanvas(width,height), ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,width,height);
  const path = glyph.getPath(0,size, size);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const command of path.commands) {
    if (command.type === 'M') ctx.moveTo(command.x,command.y);
    else if (command.type === 'L') ctx.lineTo(command.x,command.y);
    else if (command.type === 'Q') ctx.quadraticCurveTo(command.x1,command.y1,command.x,command.y);
    else if (command.type === 'C') ctx.bezierCurveTo(command.x1,command.y1,command.x2,command.y2,command.x,command.y);
    else if (command.type === 'Z') ctx.closePath();
  }
  ctx.fill();
  const pixels = ctx.getImageData(0,0,width,height).data;
  const result = Buffer.alloc(4 + Math.ceil(width*height/2));
  result[0]=0x54;result[1]=width;result[2]=height;result[3]=width;
  for(let i=0;i<width*height;i++){
    const alpha = Math.round(pixels[i*4+3]/17);
    result[4+(i>>1)] |= (i&1) ? alpha : (alpha<<4);
  }
  const value = { bytes: result, sha256: createHash('sha256').update(result).digest('hex') };
  cache.set(id,value);
  return value;
}
export async function fontManifest(pageSet, sourceLookup) {
  const resources=[];
  for (const {size,codepoint} of requiredGlyphs(pageSet,sourceLookup)) {
    const raster=await glyphBitmap(size,codepoint);
    resources.push({id:glyphId(size,codepoint),sha256:raster.sha256,bytes:raster.bytes.length});
  }
  return {schemaVersion:1,font:FONT_FAMILY,format:'alpha4',resources};
}
