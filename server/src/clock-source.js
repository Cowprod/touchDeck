// Test source: clock values are display data, not technical timestamps.
// Use UTC by default; the instance display time zone can be configured later.
export const CLOCK_SOURCE_ID='clock';
export const CLOCK_SOURCE={
 id:CLOCK_SOURCE_ID,name:'Horloge (UTC)',origin:'imported',
 descriptor:{title:'Horloge de test',description:'Champs de date et heure indépendants, actualisés chaque seconde (UTC).',
 properties:Object.fromEntries(['dd','mm','yyyy','hh','ii','ss'].map(name=>[name,{type:'string',readOnly:true,description:({
 dd:'Jour (01-31)',mm:'Mois (01-12)',yyyy:'Année (4 chiffres)',hh:'Heure (00-23)',ii:'Minutes (00-59)',ss:'Secondes (00-59)'
 })[name]}])),
 actions:{},events:{}}
};
export function clockValues(date=new Date()){
 const pad=n=>String(n).padStart(2,'0');
 return {dd:pad(date.getUTCDate()),mm:pad(date.getUTCMonth()+1),yyyy:String(date.getUTCFullYear()),hh:pad(date.getUTCHours()),ii:pad(date.getUTCMinutes()),ss:pad(date.getUTCSeconds())};
}
export function createClockTicker(emit,{now=()=>new Date(),schedule=setTimeout,cancel=clearTimeout}={}){
 let timer=null,active=true;
 function tick(){
  if(!active)return;
  const date=now();
  emit(clockValues(date));
  timer=schedule(tick,Math.max(1,1000-date.getMilliseconds()));
 }
 tick();
 return ()=>{active=false;if(timer!==null)cancel(timer)};
}
