// Test source: clock values are display data, not technical timestamps.
// Clock display time uses Europe/Paris; technical timestamps remain UTC.
export const CLOCK_SOURCE_ID='clock';
export const CLOCK_SOURCE={
 id:CLOCK_SOURCE_ID,name:'Horloge (Europe/Paris)',origin:'imported',
 descriptor:{title:'Horloge de test',description:'Champs de date et heure indépendants, actualisés chaque seconde (Europe/Paris).',
 properties:Object.fromEntries(['dd','mm','yyyy','hh','ii','ss'].map(name=>[name,{type:'string',readOnly:true,description:({
 dd:'Jour (01-31)',mm:'Mois (01-12)',yyyy:'Année (4 chiffres)',hh:'Heure (00-23)',ii:'Minutes (00-59)',ss:'Secondes (00-59)'
 })[name]}])),
 actions:{},events:{}}
};
export function clockValues(date=new Date(),timeZone='Europe/Paris'){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const value=type=>parts.find(part=>part.type===type)?.value;
 return {dd:value('day'),mm:value('month'),yyyy:value('year'),hh:value('hour'),ii:value('minute'),ss:value('second')};
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
