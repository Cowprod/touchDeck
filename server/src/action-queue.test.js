import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionQueue} from './action-queue.js';

test('component actions are FIFO per client and independent between clients',async()=>{
 const events=[];let release;
 const gate=new Promise(resolve=>release=resolve);
 const queue=createActionQueue({execute:async(client,action)=>{
  events.push(client+':start:'+action);
  if(action==='first')await gate;
  events.push(client+':end:'+action);
  return action;
 }});
 const first=queue.enqueue('a','first');
 const second=queue.enqueue('a','second');
 const third=queue.enqueue('b','third');
 assert.equal(await third,'third');
 assert.deepEqual(events.slice(0,3),['a:start:first','b:start:third','b:end:third']);
 release();
 assert.deepEqual(await Promise.all([first,second]),['first','second']);
 assert.deepEqual(events.slice(-3),['a:end:first','a:start:second','a:end:second']);
 assert.equal(queue.pendingClients(),0);
});

test('action errors and timeout are consumed before next queued action',async()=>{
 const errors=[];
 const queue=createActionQueue({timeoutMs:15,onError:({action,error})=>errors.push([action,error.message]),execute:async(_client,action)=>{
  if(action==='failure')throw Error('source_error');
  if(action==='hanging')return new Promise(()=>{});
  return 'ok';
 }});
 const broken=queue.enqueue('x','failure');
 const next=queue.enqueue('x','success');
 await assert.rejects(broken,/source_error/);
 assert.equal(await next,'ok');
 const timed=queue.enqueue('x','hanging');
 const after=queue.enqueue('x','success');
 await assert.rejects(timed,/action_timeout/);
 assert.equal(await after,'ok');
 assert.deepEqual(errors,[['failure','source_error'],['hanging','action_timeout']]);
});
