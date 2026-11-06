// Diagnostics go only to the server journal. Never inspect tokens, bodies or query values.
const clients=new WeakMap();
export function esiTrace(config){
 if(!clients.has(config))clients.set(config,createEsiTrace({write:config.esiTraceLog,enabled:config.esiTrace!==false}));
 return clients.get(config);
}
export function createEsiTrace({write=line=>console.log('[ESI trace] '+JSON.stringify(line)),enabled=true,now=Date.now}={}){
 let since=now(),details=0,skipped=0;const endpoints=new Map();
 const emit=event=>{if(enabled)try{write({at:new Date(now()).toISOString(),...event});}catch{}};
 const route=url=>{try{return new URL(url).pathname.replace(/\/\d+(?=\/|$)/g,'/:id').slice(0,180);}catch{return 'unknown';}};
 function summary(reason){if(!enabled||!endpoints.size)return;emit({event:'summary',reason,window_ms:now()-since,cooldown_skips:skipped,endpoints:[...endpoints.values()].sort((a,b)=>b.errors-a.errors||b.requests-a.requests).slice(0,20)});}
 function bucket(source,method,endpoint){if(now()-since>=60000){summary('minute');since=now();details=0;skipped=0;endpoints.clear();}const key=source+' '+method+' '+endpoint;if(!endpoints.has(key)&&endpoints.size<100)endpoints.set(key,{source,method,endpoint,requests:0,cache_hits:0,errors:0,statuses:{},total_ms:0,max_ms:0});return endpoints.get(key);}
 function cache(source,path){if(!enabled)return;const b=bucket(source,'GET',route('https://esi.evetech.net'+path));if(b)b.cache_hits++;}
 function cooldown(source,path,until){if(!enabled)return;skipped++;if(skipped===1)emit({event:'cooldown_skip',source,endpoint:route('https://esi.evetech.net'+path),retry_at:new Date(until).toISOString()});}
 async function request(network,url,options={},context={}){
  if(!enabled)return network(url,options);
  const source=context.source||'unknown',method=options.method||'GET',endpoint=route(url),b=bucket(source,method,endpoint),start=now();let response,error;
  try{response=await network(url,options);return response;}catch(e){error=e;throw e;}finally{
   const ms=Math.max(0,now()-start),status=response?.status??0,failed=!!error||!response?.ok;
   if(b){b.requests++;b.errors+=Number(failed);b.total_ms+=ms;b.max_ms=Math.max(b.max_ms,ms);b.statuses[status]=(b.statuses[status]||0)+1;}
   const headers={};for(const key of ['x-esi-error-limit-remain','x-esi-error-limit-reset','retry-after','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','x-ratelimit-used','x-ratelimit-group']){const value=response?.headers?.get(key);if(value!=null)headers[key]=value.slice(0,100);}
   const low=headers['x-esi-error-limit-remain']!=null&&Number(headers['x-esi-error-limit-remain'])<10,trigger=low||status===420||status===429;
   if((failed||trigger||ms>=5000)&&details++<200)emit({event:trigger?'cooldown_trigger':failed?'request_failure':'slow_request',source,method,endpoint,status,duration_ms:ms,...(Number.isSafeInteger(context.character_id)?{character_id:context.character_id}:{}),headers,...(error?{error:['TimeoutError','AbortError','TypeError'].includes(error.name)?error.name:'Error'}:{}),...(response?.headers?.get('x-esi-request-id')?{request_id:response.headers.get('x-esi-request-id').replace(/[^a-zA-Z0-9:_-]/g,'').slice(0,100)}:{})});
   if(trigger)summary('cooldown_trigger');
  }
 }
 return {request,cache,cooldown,summary};
}
