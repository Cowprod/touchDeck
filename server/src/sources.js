// Descriptor validation for D-038/D-042/D-043/D-044.
// Descriptors retain source-defined WoT-like metadata; no hidden business interpretation.
const idPattern=/^[a-zA-Z0-9_-]{1,80}$/;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateDescriptor(descriptor){
 if(!plain(descriptor))return false;
 for(const section of ['properties','actions','events']){
  if(descriptor[section]===undefined)continue;
  if(!plain(descriptor[section])||Object.keys(descriptor[section]).length>200)return false;
  for(const [id,definition] of Object.entries(descriptor[section])){
   if(!idPattern.test(id)||!plain(definition))return false;
   if(section==='properties'&&(typeof definition.type!=='string'||!definition.type.length))return false;
  }
 }
 return true;
}
export function validateSource(source){
 return plain(source)&&idPattern.test(source.id)&&typeof source.name==='string'&&source.name.length>0&&source.name.length<=120
   &&['manual','imported'].includes(source.origin)&&validateDescriptor(source.descriptor);
}
export function referencesMissing(descriptor,referenced){
 return referenced.filter(ref=>(descriptor[ref.section]??{})[ref.id]===undefined);
}
