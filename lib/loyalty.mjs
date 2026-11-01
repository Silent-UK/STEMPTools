export const LOYALTY_SCOPE='esi-characters.read_loyalty.v1';
export async function collectLoyalty(character,eve){
 if(!JSON.parse(character.scopes).includes(LOYALTY_SCOPE))throw Object.assign(Error('Reconnect this pilot to enable LP Wallet.'),{status:403});
 const rows=await eve.get('/characters/'+character.id+'/loyalty/points',character);
 if(!Array.isArray(rows)||rows.some(row=>!Number.isSafeInteger(row.corporation_id)||row.corporation_id<=0||!Number.isSafeInteger(row.loyalty_points)||row.loyalty_points<0))throw Error('Invalid loyalty point balances');
 const balances=[];
 for(const row of rows){let corporation='Corporation '+row.corporation_id;try{const detail=await eve.publicGet('/corporations/'+row.corporation_id);if(typeof detail.name==='string'&&detail.name.trim())corporation=detail.name;}catch{}
 balances.push({...row,corporation});}
 return {balances};
}
