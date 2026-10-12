import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDescriptor,validateSource,referencesMissing} from './sources.js';

test('descriptors retain typed properties, actions and events',()=>{
 const descriptor={properties:{temperature:{type:'number',unit:'°C',minimum:-20,maximum:80}},actions:{reset:{input:{type:'boolean'}}},events:{overheat:{}}};
 assert.equal(validateDescriptor(descriptor),true);
 assert.equal(validateSource({id:'source-1',name:'Capteur',origin:'imported',descriptor}),true);
 assert.equal(validateDescriptor({properties:{invalid:{}}}),false);
 assert.equal(validateSource({id:'bad id',name:'Capteur',origin:'manual',descriptor}),false);
 assert.equal(validateSource({id:'source-1',name:'Capteur',origin:'random',descriptor}),false);
});

test('reimport reports stale references without deleting them',()=>{
 const bindings=[{section:'properties',id:'temperature'},{section:'properties',id:'humidity'},{section:'actions',id:'reset'}];
 const changed={properties:{temperature:{type:'number'}},actions:{},events:{}};
 assert.deepEqual(referencesMissing(changed,bindings),[bindings[1],bindings[2]]);
 assert.equal(bindings.length,3);
});
