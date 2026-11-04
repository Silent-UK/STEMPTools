// Native form submissions cannot follow EVE SSO redirects under form-action self.
// Use ordinary navigation while retaining both browser and server consent checks.
export function recruitSignup(event,navigate){
 const form=event.target;if(form?.id!=='recruit-signup-form')return false;
 event.preventDefault();
 if(!form.reportValidity()||form.elements.namedItem('consent')?.checked!==true)return true;
 navigate('/auth/login?recruit=1&consent=1');return true;
}
