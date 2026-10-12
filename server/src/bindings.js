// D-038 text substitution: a component references exactly one source.
// Missing/unset variables resolve to an empty string, never to a fabricated value.
const VARIABLE=/\$\{([a-zA-Z0-9_-]{1,80})\}/g;
export function resolveText(text,sourceId,source,values){
 if(typeof text!=='string'||!sourceId)return text??'';
 return text.replace(VARIABLE,(_match,key)=>{
   if(!Object.hasOwn(source?.descriptor?.properties??{},key))return '';
   const value=values?.[key];
   return value===undefined||value===null?'':String(value);
 });
}
export function textReferences(text){
 if(typeof text!=='string')return [];
 return [...text.matchAll(VARIABLE)].map(match=>match[1]);
}
export function staleTextReferences(text,source){
 return textReferences(text).filter(key=>!Object.hasOwn(source?.descriptor?.properties??{},key));
}
export function typedValue(value,definition){
 switch(definition?.type){
  case 'number':return typeof value==='number'&&Number.isFinite(value);
  case 'integer':return Number.isInteger(value);
  case 'boolean':return typeof value==='boolean';
  case 'string':return typeof value==='string';
  default:return value===null||typeof value==='number'||typeof value==='boolean'||typeof value==='string';
 }
}
