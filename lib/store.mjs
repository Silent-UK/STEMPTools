import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export function openStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, "tools.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, main_id INTEGER UNIQUE NOT NULL, name TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS characters(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,owner_hash TEXT NOT NULL,tokens TEXT NOT NULL,scopes TEXT NOT NULL,expires INTEGER NOT NULL,reconnect INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS character_owner ON characters(user_id);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY,browser TEXT NOT NULL,user_id INTEGER,invite TEXT,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,created_by INTEGER,expires INTEGER NOT NULL,used_by INTEGER);
 CREATE TABLE IF NOT EXISTS snapshots(character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,kind TEXT,data TEXT NOT NULL,updated INTEGER NOT NULL,expires INTEGER NOT NULL,error TEXT,PRIMARY KEY(character_id,kind));
 CREATE TABLE IF NOT EXISTS sync_errors(character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,kind TEXT,message TEXT,PRIMARY KEY(character_id,kind));
 CREATE TABLE IF NOT EXISTS jobs(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'queued');
 CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,owner INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,name TEXT NOT NULL,body TEXT NOT NULL,shared INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS fitting_plans(user_id INTEGER REFERENCES users(id),fitting_id TEXT REFERENCES documents(id) ON DELETE CASCADE,plan_id TEXT REFERENCES documents(id) ON DELETE CASCADE,PRIMARY KEY(user_id,fitting_id));
 CREATE INDEX IF NOT EXISTS document_owner ON documents(owner,kind);
 CREATE TABLE IF NOT EXISTS esi_cache(character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,path TEXT,data TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(character_id,path));
 CREATE TABLE IF NOT EXISTS public_cache(path TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL);
 `);
  db.exec(`
 CREATE TABLE IF NOT EXISTS sync_attempts(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE, attempted INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS character_subscriptions(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE, expires_on TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS character_groups(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,parent_id INTEGER REFERENCES characters(id) ON DELETE SET NULL);
 CREATE TABLE IF NOT EXISTS character_order(character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE, position INTEGER NOT NULL);
 INSERT OR IGNORE INTO character_order SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY name,id) FROM characters;
 CREATE TRIGGER IF NOT EXISTS character_added_order AFTER INSERT ON characters BEGIN
 INSERT INTO character_order(character_id,position) VALUES(NEW.id,COALESCE((SELECT MAX(o.position)+1 FROM character_order o JOIN characters c ON c.id=o.character_id WHERE c.user_id=NEW.user_id),0));
 END;
 `);
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const v = fn();
    db.exec("COMMIT");
    return v;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function ownedCharacter(db, user, id) {
  const row = db
    .prepare("SELECT * FROM characters WHERE id=? AND user_id=?")
    .get(Number(id), user);
  if (!row) throw Object.assign(Error("Character not found"), { status: 404 });
  return row;
}
export function visibleDocument(db, user, id) {
  const row = db
    .prepare("SELECT * FROM documents WHERE id=? AND (owner=? OR shared=1)")
    .get(id, user);
  if (!row)
    throw Object.assign(Error("Plan or fitting not found"), { status: 404 });
  return row;
}
