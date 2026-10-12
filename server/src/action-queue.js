// D-037: per-client FIFO with consumed errors; execution state is memory-only (D-040).
export function createActionQueue({ execute, timeoutMs=5000, onError=()=>{} }) {
 if(typeof execute!=='function')throw new TypeError('execute must be a function');
 const tails=new Map();
 function enqueue(clientId,action){
  const before=tails.get(clientId)??Promise.resolve();
  const job=before.then(async()=>{
   const controller=new AbortController();
   let timer;
   try {
    const aborted=new Promise((_,reject)=>{
     controller.signal.addEventListener('abort',()=>reject(new Error('action_timeout')),{once:true});
    });
    timer=setTimeout(()=>controller.abort(),timeoutMs);
    return await Promise.race([Promise.resolve().then(()=>execute(clientId,action,{signal:controller.signal})),aborted]);
   }catch(error){
    try{onError({clientId,action,error})}catch{}
    throw error;
   }finally{clearTimeout(timer)}
  });
  const recovered=job.catch(()=>{});
  tails.set(clientId,recovered);
  recovered.then(()=>{if(tails.get(clientId)===recovered)tails.delete(clientId)});
  return job;
 }
 return {enqueue, pendingClients:()=>tails.size};
}
