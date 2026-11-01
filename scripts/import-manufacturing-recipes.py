"""Extract manufacturing materials/products from CCP JSONL SDE, without private site data."""
import json,sys,zipfile
from pathlib import Path
archive=Path(sys.argv[1] if len(sys.argv)>1 else 'data/sde.zip')
target=Path(sys.argv[2] if len(sys.argv)>2 else 'lib/manufacturing-recipes.json')
with zipfile.ZipFile(archive) as source:
 recipes={}
 for line in source.open('blueprints.jsonl'):
  row=json.loads(line);activity=row.get('activities',{}).get('manufacturing')
  if activity and activity.get('materials') and activity.get('products'):recipes[str(row['_key'])]={'materials':activity['materials'],'products':activity['products'],'time':activity.get('time')}
target.write_text(json.dumps({'source':'CCP JSONL SDE blueprints.jsonl','blueprints':recipes},separators=(',',':')),encoding='utf-8')
print('Extracted',len(recipes),'manufacturing recipes')
