export function validSubscriptionDate(value) {
 if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value;
}
export function subscriptionStatus(value,now=Date.now()) {
 if(!validSubscriptionDate(value))return {label:'Not set',color:null,days:null};
 const today=new Date(now).toISOString().slice(0,10);
 const days=Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 const green=[91,211,145],orange=[245,165,65],red=[245,85,85];
 const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
 const color=days>=30?green:days>=10?mix(orange,green,(days-10)/20):mix(red,orange,Math.max(0,days)/10);
 return {days,label:days<0?'Expired':`${days} ${days===1?'day':'days'}`,color:`rgb(${color.join(',')})`};
}
