export function splitQueue(queue, now = Date.now()) {
  const pending = [...queue]
    .sort((a, b) => a.queue_position - b.queue_position)
    .filter((q) => !q.finish_date || Date.parse(q.finish_date) > now);
  const current = pending.find(
    (q) => Date.parse(q.start_date) <= now && Date.parse(q.finish_date) > now,
  );
  return { current, waiting: pending.filter((q) => q !== current) };
}
export function skillGroups(skills) {
  const groups = new Map();
  for (const skill of skills) {
    const name = skill.group || "Other";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(skill);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, skills]) => ({
      name,
      skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
