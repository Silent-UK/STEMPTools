"""Build fitting Dogma data from CCP's JSONL SDE. No private/site data is read."""
import json,sys,zipfile
from pathlib import Path
archive=Path(sys.argv[1] if len(sys.argv)>1 else 'data/sde.zip')
target=Path(sys.argv[2] if len(sys.argv)>2 else 'lib/fitting-dogma.json')
with zipfile.ZipFile(archive) as z:
 def rows(name):
  for line in z.open(name):yield json.loads(line)
 groups={r['_key']:r for r in rows('groups.jsonl')}
 dogma={r['_key']:r for r in rows('typeDogma.jsonl')}
 types=[];used=set();cats={6,7,8,16,18,20,32,87}
 for t in rows('types.jsonl'):
  g=groups.get(t['groupID'],{})
  if g.get('categoryID') not in cats or (not t.get('published') and t['groupID']!=1306):continue
  d=dogma.get(t['_key'],{});a={str(x['attributeID']):x['value'] for x in d.get('dogmaAttributes',[])}
  for field,attr in [('mass',4),('capacity',38),('volume',161),('radius',162)]:
   if field in t:a.setdefault(str(attr),t[field])
  effects=[x['effectID'] for x in d.get('dogmaEffects',[])];used.update(effects)
  types.append(dict(i=t['_key'],n=t.get('name',{}).get('en',str(t['_key'])),g=t['groupID'],a=a,e=effects))
 effects=[]
 for e in rows('dogmaEffects.jsonl'):
  if e['_key'] not in used:continue
  mods=[]
  for m in e.get('modifierInfo',[]):
   mod={dest:m[src] for src,dest in [('func','f'),('domain','d'),('operation','op'),('modifiedAttributeID','to'),('modifyingAttributeID','from'),('groupID','g'),('skillTypeID','s')] if src in m};mods.append(mod)
  out=dict(i=e['_key'],n=e['name'],cat=e['effectCategoryID'],mods=mods)
  for src,dest in [('durationAttributeID','dur'),('dischargeAttributeID','dis'),('rangeAttributeID','rng'),('falloffAttributeID','fal'),('resistanceAttributeID','res')]:
   if src in e:out[dest]=e[src]
  effects.append(out)
 attrs=[]
 for a in rows('dogmaAttributes.jsonl'):
  out={'i':a['_key'],'n':a['name'],'def':a.get('defaultValue',0),'st':int(a.get('stackable',False)),'hi':int(a.get('highIsGood',False))}
  for src,dest in [('maxAttributeID','max'),('unitID','u'),('attributeCategoryID','cat')]:
   if src in a:out[dest]=a[src]
  attrs.append(out)
 usedgroups={t['g'] for t in types}
 raw={'version':{'generated':'CCP SDE: '+archive.name},'types':types,'attributes':attrs,'effects':effects,'groups':[dict(i=id,n=g.get('name',{}).get('en',str(id)),c=g['categoryID']) for id,g in groups.items() if id in usedgroups],'categories':[],'cloneGrades':[]}
 target.write_text(json.dumps(raw,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
 print(f'Built {len(types)} fitting types, {len(effects)} effects and {len(attrs)} attributes ({target.stat().st_size:,} bytes).')
