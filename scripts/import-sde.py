"""Import CCP JSONL static data from a ZIP, atomically. No third-party Python dependencies."""
import sys,zipfile,json,sqlite3,os
from pathlib import Path
archive=Path(sys.argv[1]); root=Path(sys.argv[2] if len(sys.argv)>2 else 'data');root.mkdir(parents=True,exist_ok=True)
tmp=root/'catalog.new.sqlite'; target=root/'catalog.sqlite'
if tmp.exists():tmp.unlink()
db=sqlite3.connect(tmp)
db.executescript('CREATE TABLE types(id INTEGER PRIMARY KEY,name TEXT,group_id INTEGER,category_id INTEGER,published INTEGER,volume REAL,attributes TEXT); CREATE INDEX type_name ON types(name COLLATE NOCASE); CREATE TABLE schematics(id INTEGER PRIMARY KEY,data TEXT); CREATE TABLE operations(id INTEGER PRIMARY KEY,data TEXT); CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);')
with zipfile.ZipFile(archive) as z:
 def rows(name):
  with z.open(name) as f:
   for line in f:yield json.loads(line)
 groups={r['_key']:r['categoryID'] for r in rows('groups.jsonl')}
 dogma={r['_key']:{str(a['attributeID']):a['value'] for a in r.get('dogmaAttributes',[])} for r in rows('typeDogma.jsonl')}
 for r in rows('types.jsonl'):
  db.execute('INSERT INTO types VALUES(?,?,?,?,?,?,?)',(r['_key'],r.get('name',{}).get('en',str(r['_key'])),r['groupID'],groups.get(r['groupID']),int(r.get('published',False)),r.get('volume',0),json.dumps(dogma.get(r['_key'],{}))))
 for r in rows('planetSchematics.jsonl'):db.execute('INSERT INTO schematics VALUES(?,?)',(r['_key'],json.dumps(r)))
 for r in rows('mercenaryTacticalOperations.jsonl'):db.execute('INSERT INTO operations VALUES(?,?)',(r['_key'],json.dumps(r)))
 db.execute('INSERT INTO metadata VALUES(?,?)',('source',archive.name))
db.commit();print('Imported',db.execute('SELECT count(*) FROM types').fetchone()[0],'types');db.close();os.replace(tmp,target)
