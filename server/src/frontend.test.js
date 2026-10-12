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
