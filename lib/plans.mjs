const pairs = [
  [182, 277],
  [183, 278],
  [184, 279],
  [1285, 1286],
  [1289, 1287],
  [1290, 1288],
];
const attributes = {
  164: "charisma",
  165: "intelligence",
  166: "memory",
  167: "perception",
  168: "willpower",
};
export function requirements(type, cat) {
  const a = cat.type(type)?.attributes;
  if (!a) throw Error("Unknown item or skill " + type);
  return pairs
    .filter(([id]) => a[id] > 0)
    .map(([id, level]) => ({
      id: Number(a[id]),
      level: Number(a[level] || 1),
    }));
}
export function expandPlan(entries, cat) {
  const levels = new Map(),
    visiting = new Set();
  function add(id, level) {
    id = Number(id);
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 5 ||
      cat.type(id)?.category_id !== 16
    )
      throw Error("Select a valid skill and level 1–5");
    if (visiting.has(id)) throw Error("Circular skill prerequisite");
    if ((levels.get(id) || 0) >= level) return;
    visiting.add(id);
    for (const r of requirements(id, cat)) add(r.id, r.level);
    visiting.delete(id);
    levels.set(id, level);
  }
  for (const r of entries) add(r.id, Number(r.level));
  return [...levels].map(([id, level]) => ({ id, level }));
}
export const skillpoints = (rank, level) =>
  level === 0 ? 0 : Math.ceil(250 * rank * 2 ** (2.5 * (level - 1)));
export function comparePlan(
  entries,
  skills,
  queue,
  attrs,
  cat,
  alpha = false,
  now = Date.now(),
) {
  if (!skills?.skills) throw Error("Sync this character’s skills first");
  const trained = new Map(skills.skills.map((s) => [s.skill_id, s]));
  const rows = expandPlan(entries, cat).map((r) => {
    const type = cat.type(r.id),
      s = trained.get(r.id),
      current = s?.trained_skill_level || 0,
      active = s?.active_skill_level || 0;
    let sp = s?.skillpoints_in_skill || 0;
    for (const q of queue || []) {
      const start = Date.parse(q.start_date),
        end = Date.parse(q.finish_date);
      if (
        q.skill_id === r.id &&
        Number.isFinite(start) &&
        end > start &&
        now >= start
      ) {
        const fraction = Math.min(1, (now - start) / (end - start));
        if (
          Number.isFinite(q.training_start_sp) &&
          Number.isFinite(q.level_end_sp)
        )
          sp = Math.max(
            sp,
            q.training_start_sp +
              (q.level_end_sp - q.training_start_sp) * fraction,
          );
      }
    }
    const rank = type.attributes[275],
      primary = attrs?.[attributes[type.attributes[180]]],
      secondary = attrs?.[attributes[type.attributes[181]]];
    const remaining =
      current >= r.level ? 0 : Math.max(0, skillpoints(rank, r.level) - sp);
    const rate = (primary + secondary / 2) * (alpha ? 0.5 : 1);
    return {
      ...r,
      name: type.name,
      current,
      active,
      remaining: Number.isFinite(remaining) ? Math.ceil(remaining) : null,
      seconds:
        remaining === 0
          ? 0
          : rank > 0 && rate > 0
            ? Math.ceil((remaining / rate) * 60)
            : null,
    };
  });
  return {
    rows,
    seconds: rows.some((r) => r.seconds === null)
      ? null
      : rows.reduce((n, r) => n + r.seconds, 0),
    ready: rows.every((r) => r.active >= r.level),
    estimate:
      "Estimate using current attributes and selected training speed; remaps, boosters and paused training can change this.",
  };
}
export function parseFitting(text, cat) {
  if (typeof text !== "string" || text.length > 30000)
    throw Error("Fitting must be EFT text under 30 KB");
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()?.match(/^\[([^,]+),\s*(.+)\]$/);
  if (!header) throw Error("Start with [Ship name, Fitting name]");
  const ship = cat.named(header[1].trim());
  if (!ship || cat.type(ship)?.category_id !== 6)
    throw Error("Unknown ship: " + header[1]);
  const items = [{ id: ship, quantity: 1 }];
  for (let line of lines) {
    line = line.trim();
    if (!line || /^\[Empty .* slot\]$/i.test(line)) continue;
    for (const part of line.split(/,\s*/)) {
      const match = part.match(/^(.*?)(?:\s+x(\d+))?$/),
        id = cat.named(match[1].trim());
      if (!id) throw Error("Unknown fitting item: " + part);
      const quantity = Number(match[2] || 1);
      if (quantity < 1 || quantity > 100000)
        throw Error("Invalid item quantity");
      items.push({ id, quantity });
    }
  }
  return {
    name: header[2],
    ship,
    items,
    requirements: expandPlan(
      items.flatMap((i) => requirements(i.id, cat)),
      cat,
    ),
  };
}
