export async function collectWalletHistory(c,eve,cat,previous){
 if(!JSON.parse(c.scopes).includes('esi-wallet.read_character_wallet.v1'))throw Object.assign(Error('Reconnect this character to enable Wallet.'),{status:403});
 const prefix='/characters/'+c.id+'/wallet',journal=[],transactions=[],seenJournal=new Set(),seenTransactions=new Set();
 let pages=1;
 for(let page=1;page<=pages;page++){
  const result=await eve.request(prefix+'/journal?page='+page,c);
  if(!Array.isArray(result.data)||!Number.isInteger(result.pages)||result.pages<1||result.pages>1000||(page>1&&result.pages!==pages))throw Error('Incomplete wallet journal');
  pages=result.pages;
  for(const r of result.data){if(!Number.isSafeInteger(r.id)||seenJournal.has(r.id)||!Number.isFinite(Date.parse(r.date))||(r.amount!=null&&!Number.isFinite(r.amount)))throw Error('Invalid wallet journal');seenJournal.add(r.id);journal.push(r)}
 }
 let cursor=null;
 for(let page=0;page<1000;page++){
  const result=await eve.request(prefix+'/transactions'+(cursor===null?'':'?from_id='+cursor),c);
  if(!Array.isArray(result.data))throw Error('Invalid wallet transactions');
  if(!result.data.length)break;
  for(const r of result.data){if(!Number.isSafeInteger(r.transaction_id)||seenTransactions.has(r.transaction_id)||(cursor!==null&&r.transaction_id>=cursor)||!Number.isFinite(Date.parse(r.date))||!Number.isSafeInteger(r.quantity)||r.quantity<0||!Number.isFinite(r.unit_price)||r.unit_price<0||typeof r.is_buy!=='boolean')throw Error('Invalid wallet transaction');seenTransactions.add(r.transaction_id);transactions.push({...r,name:cat.type(r.type_id)?.name||'Type '+r.type_id})}
  cursor=Math.min(...result.data.map(r=>r.transaction_id));if(page===999)throw Error('Incomplete transaction history');
 }
 const names={...(previous?.names||{})},ids=[...new Set([...journal.flatMap(r=>[r.first_party_id,r.second_party_id]),...transactions.map(r=>r.client_id)].filter(id=>Number.isSafeInteger(id)&&id>0&&!names[id]))];
 for(let i=0;i<ids.length;i+=1000){try{const result=await eve.request('/universe/names',null,'POST',ids.slice(i,i+1000));for(const n of result.data)names[n.id]=n.name;}catch{/* Keep IDs visible when public name lookup is unavailable. */}}
 const merge=(old,fresh,key)=>[...new Map([...(old||[]),...fresh].map(r=>[r[key],r])).values()].sort((a,b)=>b.date.localeCompare(a.date)||b[key]-a[key]);
 return {journal:merge(previous?.journal,journal,'id'),transactions:merge(previous?.transactions,transactions,'transaction_id'),names,started_at:previous?.started_at||Date.now()};
}
