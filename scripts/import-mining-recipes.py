"""Extract published asteroid/ice reprocessing recipes from CCP JSONL SDE."""
import json,sys,zipfile
from pathlib import Path
with zipfile.ZipFile(sys.argv[1] if len(sys.argv)>1 else 'data/sde.zip') as z:
 def rows(name):
  with z.open(name) as f:
   for line in f: yield json.loads(line)
 types={r['_key']:r for r in rows('types.jsonl')}
 groups={r['_key']:r['categoryID'] for r in rows('groups.jsonl')}
 recipes={}
 for r in rows('typeMaterials.jsonl'):
  t=types.get(r['_key'],{})
  if groups.get(t.get('groupID'))==25 and t.get('published') and r['materials']:
   recipes[str(r['_key'])]={'name':t['name']['en'],'portion':t.get('portionSize',1),'materials':[{'id':m['materialTypeID'],'name':types[m['materialTypeID']]['name']['en'],'quantity':m['quantity']} for m in r['materials']]}
Path('lib/mining-recipes.json').write_text(json.dumps(recipes,ensure_ascii=True,separators=(',',':')),encoding='utf-8')
print('Imported',len(recipes),'reprocessing recipes')
