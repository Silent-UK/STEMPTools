export const isSiteAdmin=(session,owner)=>Boolean(session&&(session.main_id===owner||session.admin===1));
