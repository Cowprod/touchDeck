// Test source: clock values are display data, not technical timestamps.
// Clock display time uses Europe/Paris; technical timestamps remain UTC.
export const CLOCK_SOURCE_ID='clock';
export const CLOCK_SOURCE={
 id:CLOCK_SOURCE_ID,name:'Horloge (Europe/Paris)',origin:'imported',
 descriptor:{title:'Horloge de test',description:'Champs de date et heure indépendants, actualisés chaque seconde (Europe/Paris).',
 properties:{
  ...Object.fromEntries(['dd','mm','yyyy','hh','ii','ss'].map(name=>[name,{type:'string',readOnly:true,description:({
   dd:'Jour (01-31)',mm:'Mois (01-12)',yyyy:'Année (4 chiffres)',hh:'Heure (00-23)',ii:'Minutes (00-59)',ss:'Secondes (00-59)'
  })[name]}])),
  elapsed:{type:'string',readOnly:true,description:'Chronomètre HH:MM:SS'},
  running:{type:'boolean',readOnly:true,description:'Chronomètre en cours'}
 },
 actions:{start:{},stop:{},reset:{}},events:{}}
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

export function createStopwatch({now=()=>performance.now()}={}){
 let accumulated=0,started=null;
 const milliseconds=()=>accumulated+(started===null?0:Math.max(0,now()-started));
 return {
  action(name){
   if(name==='start'){if(started===null)started=now()}
   else if(name==='stop'){if(started!==null){accumulated=milliseconds();started=null}}
   else if(name==='reset'){accumulated=0;if(started!==null)started=now()}
   else throw new Error('invalid_stopwatch_action');
   return this.values();
  },
  values(){
   const seconds=Math.floor(milliseconds()/1000);
   const pad=n=>String(n).padStart(2,'0');
   return {elapsed:pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds/60)%60)+':'+pad(seconds%60),running:started!==null};
  }
 };
}
