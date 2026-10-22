export const STEMP_ID=668298004;
export const INDUSTRY_SCOPE="esi-industry.read_corporation_jobs.v1";
export const MINING_SCOPE="esi-industry.read_corporation_mining.v1";
export const CORE_CORP_SCOPES=["esi-characters.read_corporation_roles.v1","esi-corporations.read_structures.v1","esi-assets.read_corporation_assets.v1","esi-corporations.read_starbases.v1"];
export const CORP_SCOPES=[...CORE_CORP_SCOPES,MINING_SCOPE,INDUSTRY_SCOPE];
export async function verifyCorporation(token,id,network=fetch) {
  async function get(path,privateRoute=false) {
    const response=await network("https://esi.evetech.net/latest"+path+"/",{headers:{"X-Compatibility-Date":"2026-10-17",...(privateRoute?{Authorization:"Bearer "+token}:{})},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Object.assign(Error("Could not verify corporation access. Please reconnect and try again."),{status:502});
    return response.json();
  }
  const affiliation=await network("https://esi.evetech.net/characters/affiliation",{method:"POST",headers:{"Content-Type":"application/json","X-Compatibility-Date":"2026-10-17"},body:JSON.stringify([id]),signal:AbortSignal.timeout(30000)});
  if(!affiliation.ok)throw Object.assign(Error("Could not verify corporation membership."),{status:502});
  const pilot=(await affiliation.json()).find(p=>p.character_id===id);
  if(!pilot)throw Object.assign(Error("Could not verify corporation membership."),{status:403});
  const corp=await get(`/corporations/${pilot.corporation_id}`);
  const roles=await get(`/characters/${id}/roles`,true);
  const role=corp.ceo_id===id?"CEO":roles.roles?.includes("Director")?"Director":null;
  if(!role)throw Object.assign(Error("Connect a corporation CEO or Director."),{status:403});
  return {id:pilot.corporation_id,name:corp.name,role};
}
