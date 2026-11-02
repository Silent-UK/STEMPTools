export function industryWithJobs(rows){return rows.filter(row=>Array.isArray(row.data?.jobs)&&row.data.jobs.length>0);}
