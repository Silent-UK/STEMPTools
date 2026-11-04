// Only access changes rebuild navigation; ordinary snapshot updates keep forms in place.
export function accessChanged(before,after){
 const state=account=>JSON.stringify({main:account?.main_id,recruit:Boolean(account?.recruit),admin:Boolean(account?.admin),owner:Boolean(account?.owner),director:Boolean(account?.director),corporation:Boolean(account?.corporation),recruiter:Boolean(account?.recruiter),inspect:account?.inspect||null,corporate_pages:[...(account?.corporate_pages||[])].sort(),pages:(account?.pages||[]).map(page=>[page.id,page.name,page.section,page.after,page.position])});
 return state(before)!==state(after);
}
export function managementNavigation(account){
 return [...(account.recruit||account.inspect?.recruitment_only?[]:[['groups','◇','Groups'],['settings','⚙','Settings']]),...(account.recruiter?[['recruitment','♙','Recruitment']]:[]),...(account.recruit?[['recruit-application','♙','Application']]:[])];
}
