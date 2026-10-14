// Deterministic, in-process source for exercising slider and feedback bindings.
export const TEST_SOURCE_ID='touchdeck_test';
export const TEST_SOURCE={
 id:TEST_SOURCE_ID,name:'Banc de test (virtuel)',origin:'imported',
 descriptor:{
  title:'Banc de test TouchDeck',description:'Source locale sans appareil ni service HTTP, avec commandes de sliders.',
  properties:{
   level:{type:'number',minimum:0,maximum:100,readOnly:false},
   brightness:{type:'number',minimum:0,maximum:100,readOnly:false},
   temperature:{type:'number',minimum:0,maximum:50,readOnly:true},
   enabled:{type:'boolean',readOnly:false},
   status:{type:'string',readOnly:true}
  },
  actions:{set_level:{},set_brightness:{},set_enabled:{},reset:{}},events:{}
 }
};
export const INITIAL_TEST_VALUES=Object.freeze({level:42,brightness:75,temperature:23.5,enabled:true,status:'Pret'});
export function createTestSource(){
 let values={...INITIAL_TEST_VALUES};
 return {
  values:()=>({...values}),
  action(name,parameters={}){
   if(name==='reset'){values={...INITIAL_TEST_VALUES};return this.values();}
   const property={set_level:'level',set_brightness:'brightness',set_enabled:'enabled'}[name];
   if(!property)throw new Error('invalid_test_action');
   const value=parameters.value;
   if(property==='enabled'){
    if(typeof value!=='boolean')throw new Error('invalid_test_value');
   }else if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw new Error('invalid_test_value');
   values={...values,[property]:value};
   return this.values();
  }
 };
}
