import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
export function catalog(dir) {
  const db = new DatabaseSync(join(dir, "catalog.sqlite"), { readOnly: true });
  return {
    type(id) {
      const r = db.prepare("SELECT * FROM types WHERE id=?").get(Number(id));
      return r ? { ...r, attributes: JSON.parse(r.attributes) } : null;
    },
    named(name) {
      return db
        .prepare(
          "SELECT id FROM types WHERE name=? COLLATE NOCASE AND published=1 ORDER BY id LIMIT 1",
        )
        .get(name)?.id;
    },
    search(q, skills = false) {
      return db
        .prepare(
          "SELECT id,name,category_id FROM types WHERE published=1 AND name LIKE ?" +
            (skills ? " AND category_id=16" : "") +
            " ORDER BY name LIMIT 40",
        )
        .all("%" + q.replace(/[%_]/g, "") + "%");
    },
    schematic(id) {
      const r = db
        .prepare("SELECT data FROM schematics WHERE id=?")
        .get(Number(id));
      return r ? JSON.parse(r.data) : null;
    },
    operation(id) {
      const r = db
        .prepare("SELECT data FROM operations WHERE id=?")
        .get(Number(id));
      return r ? JSON.parse(r.data) : null;
    },
    close() {
      db.close();
    },
  };
}
