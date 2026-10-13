import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredGlyphs, glyphBitmap, glyphId, parseGlyphId, fontManifest } from './font-glyphs.js';

test('group font manifest includes only visible component text and reserved dynamic digits', async () => {
 const set={pages:[
  {visible:true,components:[{type:'Label',fontSize:'small',text:'GPU ${gpu_temp_c}°'},{type:'Label',fontSize:'large',text:'12:34'}]},
  {visible:false,components:[{type:'Label',text:'HIDDEN'}]}
 ]};
 const keys=requiredGlyphs(set,()=> 'number').map(({size,codepoint})=>glyphId(size,codepoint));
 assert(keys.includes('12-'+('G'.codePointAt(0)).toString(16)));
 assert(keys.includes('12-'+('0'.codePointAt(0)).toString(16)));
 assert(keys.includes('20-'+(':'.codePointAt(0)).toString(16)));
 assert(!keys.includes('15-'+('H'.codePointAt(0)).toString(16)));
 const manifest=await fontManifest(set,()=> 'number');
 assert.equal(manifest.font,'IBM Plex Mono');
 assert(manifest.resources.every(resource=>resource.sha256.length===64));
});
test('glyph endpoint format contains compact alpha4 bitmap with stable hash',async()=>{
 const g=await glyphBitmap(15,'A'.codePointAt(0));
 assert.equal(g.bytes[0],0x54);
 assert.equal(g.bytes.length,4+Math.ceil(g.bytes[1]*g.bytes[2]/2));
 assert.equal((await glyphBitmap(15,65)).sha256,g.sha256);
 assert.deepEqual(parseGlyphId('15-41'),{size:15,codepoint:65});
 assert.equal(parseGlyphId('17-41'),null);
});
