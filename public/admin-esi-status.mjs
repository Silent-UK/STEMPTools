// Reflect recorded sync/authentication state; an expiring access token is not itself invalid.
export function accountEsiStatus(characters=[]){
 if(!characters.length)return {level:'unknown',label:'No Characters',detail:'No linked characters.'};
 const invalid=characters.filter(c=>c.reconnect),issues=characters.filter(c=>c.errors?.length),waiting=characters.filter(c=>!c.updated),running=characters.filter(c=>['queued','running'].includes(c.job));
 const names=rows=>rows.map(c=>c.name).join(', ');
 if(invalid.length)return {level:'invalid',label:invalid.length+' Reconnect Required',detail:'Reconnect required: '+names(invalid)+'. Expand this user for per-pilot details.'};
 if(issues.length)return {level:'warning',label:issues.length+' Sync Issues',detail:'Sync needs attention: '+names(issues)+'. This may be an endpoint or scope issue, rather than an invalid account connection.'};
 if(waiting.length)return {level:'unknown',label:'Awaiting Sync',detail:'No successful snapshot yet: '+names(waiting)+'.'};
 if(running.length)return {level:'syncing',label:'Syncing',detail:'Queued or running: '+names(running)+'.'};
 return {level:'connected',label:'Connected',detail:'All linked pilots have synced, with no recorded authentication or sync errors. Status reflects the latest sync.'};
}
