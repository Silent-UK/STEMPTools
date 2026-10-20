export const CORP_SCOPES=["esi-characters.read_corporation_roles.v1"];
export async function verifyCorporation(token,id) {
  async function get(path,privateRoute=false) {
    const response=await fetch("https://esi.evetech.net/latest"+path+"/",{headers:{"X-Compatibility-Date":"2026-10-17",...(privateRoute?{Authorization:"Bearer "+token}:{})},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Object.assign(Error("Could not verify corporation access. Please reconnect and try again."),{status:502});
    return response.json();
  }
  const pilot=await get(`/characters/${id}`);
  const corp=await get(`/corporations/${pilot.corporation_id}`);
  const roles=await get(`/characters/${id}/roles`,true);
  const role=corp.ceo_id===id?"CEO":roles.roles?.includes("Director")?"Director":null;
  if(!role)throw Object.assign(Error("Connect a corporation CEO or Director."),{status:403});
  return {id:pilot.corporation_id,name:corp.name,role};
}
