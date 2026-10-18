// Comparison rows are prerequisite-first. Include every untrained level.
export function missingSkillText(rows) {
 const roman=['','I','II','III','IV','V'], lines=[], seen=new Set();
 for(const row of rows) {
  const trained=row.current ?? row.trained, required=row.level ?? row.required;
  if(!Number.isInteger(trained)||!Number.isInteger(required)||trained<0||required>5||!row.name)continue;
  for(let level=trained+1;level<=required;level++) {
   const line=`${row.name} ${roman[level]}`;
   if(!seen.has(line)){seen.add(line);lines.push(line);}
  }
 }
 return lines.join('\n');
}
