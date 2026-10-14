import test from 'node:test';
import assert from 'node:assert/strict';
import {TEST_SOURCE,TEST_SOURCE_ID,createTestSource,INITIAL_TEST_VALUES} from './test-source.js';

test('virtual source declares writable numeric sliders and read-only feedback',()=>{
 assert.equal(TEST_SOURCE.id,TEST_SOURCE_ID);
 assert.equal(TEST_SOURCE.descriptor.properties.level.readOnly,false);
 assert.equal(TEST_SOURCE.descriptor.properties.brightness.readOnly,false);
 assert.equal(TEST_SOURCE.descriptor.properties.temperature.readOnly,true);
 assert.ok(TEST_SOURCE.descriptor.actions.set_level);
 assert.ok(TEST_SOURCE.descriptor.actions.set_brightness);
});
test('virtual source applies validated actions, retains state and resets',()=>{
 const source=createTestSource();
 assert.deepEqual(source.values(),INITIAL_TEST_VALUES);
 assert.equal(source.action('set_level',{value:67}).level,67);
 assert.equal(source.action('set_brightness',{value:0}).brightness,0);
 assert.equal(source.action('set_enabled',{value:false}).enabled,false);
 assert.equal(source.values().level,67);
 for(const value of [-1,101,NaN,'42'])assert.throws(()=>source.action('set_level',{value}),/invalid_test_value/);
 assert.throws(()=>source.action('set_enabled',{value:1}),/invalid_test_value/);
 assert.throws(()=>source.action('missing',{}),/invalid_test_action/);
 assert.deepEqual(source.action('reset'),INITIAL_TEST_VALUES);
});
