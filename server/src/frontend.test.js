import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for(const filename of ['admin.html','index.html']){
 test('inline script parses: '+filename,async()=>{
  const html=await readFile(new URL('../public/'+filename,import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0,'expected at least one inline script');
  for(const match of scripts)assert.doesNotThrow(()=>new Function(match[1]));
 });
}

test('simulator sorting does not unconditionally reinsert live iframes',async()=>{
 const html=await readFile(new URL('../public/admin.html',import.meta.url),'utf8');
 const sort=html.slice(html.indexOf('function sortSimulators(){'),html.indexOf('\nfunction addSimulator(',html.indexOf('function sortSimulators(){')));
 assert.match(sort,/container\.children\[i\]!==desired\[i\]/);
 assert.doesNotMatch(sort,/for\s*\(const card of cards\)\s*container\.append\(card\)/);
});
