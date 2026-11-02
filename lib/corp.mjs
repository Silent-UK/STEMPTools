export const STEMP_ID=668298004;
export const INDUSTRY_SCOPE="esi-industry.read_corporation_jobs.v1";
export const MINING_SCOPE="esi-industry.read_corporation_mining.v1";
export const CORE_CORP_SCOPES=["esi-characters.read_corporation_roles.v1","esi-corporations.read_structures.v1","esi-assets.read_corporation_assets.v1","esi-corporations.read_starbases.v1"];
export const CORP_SCOPES=["esi-contracts.read_corporation_contracts.v1","esi-markets.read_corporation_orders.v1","esi-corporations.read_blueprints.v1","esi-corporations.read_standings.v1",...CORE_CORP_SCOPES,MINING_SCOPE,INDUSTRY_SCOPE,"esi-corporations.read_corporation_membership.v1","esi-corporations.track_members.v1","esi-corporations.read_titles.v1","esi-corporations.read_divisions.v1","esi-wallet.read_corporation_wallets.v1"];
export async function verifyCorporation(token,id,network=fetch) {
  async function get(path,privateRoute=false) {
    const response=await network("https://esi.evetech.net/latest"+path+"/",{headers:{"X-Compatibility-Date":"2026-10-17",...(privateRoute?{Authorization:"Bearer "+token}:{})},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Object.assign(Error("Could not verify corporation access. Please reconnect and try again."),{status:response.status>=500||[420,429].includes(response.status)?503:response.status===403?401:response.status});
    return response.json();
  }
  const affiliation=await network("https://esi.evetech.net/characters/affiliation",{method:"POST",headers:{"Content-Type":"application/json","X-Compatibility-Date":"2026-10-17"},body:JSON.stringify([id]),signal:AbortSignal.timeout(30000)});
  if(!affiliation.ok)throw Object.assign(Error("Could not verify corporation membership."),{status:502});
  const pilot=(await affiliation.json()).find(p=>p.character_id===id);
  if(!pilot||!Number.isSafeInteger(pilot.corporation_id))throw Object.assign(Error("Could not verify corporation membership."),{status:502});
  const corp=await get(`/corporations/${pilot.corporation_id}`);
  const roles=await get(`/characters/${id}/roles`,true);
  if(!Number.isSafeInteger(corp.ceo_id)||!Array.isArray(roles.roles))throw Object.assign(Error("Corporation verification returned incomplete data. Previous access retained."),{status:502});
  const role=corp.ceo_id===id?"CEO":roles.roles?.includes("Director")?"Director":null;
  if(!role)throw Object.assign(Error("Connect a corporation CEO or Director."),{status:403,corporationRoleDenied:true});
  return {id:pilot.corporation_id,name:corp.name,role};
}
