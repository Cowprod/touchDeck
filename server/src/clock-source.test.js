import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOCK_SOURCE,clockValues,createClockTicker} from './clock-source.js';
test('clock descriptor exposes six independent string properties',()=>{
 assert.deepEqual(Object.keys(CLOCK_SOURCE.descriptor.properties),['dd','mm','yyyy','hh','ii','ss']);
 for(const value of Object.values(CLOCK_SOURCE.descriptor.properties))assert.equal(value.type,'string');
});
test('clock uses configured time zone with zero padded date/time',()=>{
 assert.deepEqual(clockValues(new Date('2026-12-09T03:04:05.000Z'),'UTC'),{dd:'09',mm:'12',yyyy:'2026',hh:'03',ii:'04',ss:'05'});
});
test('Paris clock accounts for daylight saving time',()=>{
 assert.equal(clockValues(new Date('2026-07-12T12:00:00Z')).hh,'14');
 assert.equal(clockValues(new Date('2026-12-12T12:00:00Z')).hh,'13');
});
test('clock ticks on second boundary and can be stopped',()=>{
 const events=[],delays=[],timers=[];
 const stop=createClockTicker(values=>events.push(values),{
  now:()=>new Date('2026-10-12T23:40:00.250Z'),
  schedule:(callback,ms)=>{delays.push(ms);timers.push(callback);return timers.length},
  cancel:()=>{}
 });
 assert.equal(events.length,1);assert.equal(delays[0],750);
 timers[0]();assert.equal(events.length,2);
 stop();timers[1]();assert.equal(events.length,2);
});
