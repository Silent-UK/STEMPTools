"""Merge tab-separated moon scans into STEMP's existing dataset without overwriting conflicts.
Usage: python scripts/merge-moon-surveys.py --date YYYY-MM-DD [--write] file.txt ...
Location IDs and names are resolved from the locally installed CCP SDE.
"""
import argparse, collections, csv, datetime, gzip, hashlib, json, re, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
TIERS={'Bitumens':'R4','Coesite':'R4','Sylvite':'R4','Zeolites':'R4','Cobaltite':'R8','Euxenite':'R8','Scheelite':'R8','Titanite':'R8','Chromite':'R16','Otavite':'R16','Sperrylite':'R16','Vanadinite':'R16','Carnotite':'R32','Cinnabar':'R32','Pollucite':'R32','Zircon':'R32','Loparite':'R64','Monazite':'R64','Xenotime':'R64','Ytterbite':'R64'}
def roman(n):
 out=''
 for value,letter in [(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
  while n>=value:out+=letter;n-=value
 return out
def number(value):
 if value.isdigit():return int(value)
 n=next((i for i in range(1,101) if roman(i)==value.upper()),None)
 if n is None:raise ValueError('Invalid planet number: '+value)
 return n
def locations(path,requested):
 with zipfile.ZipFile(path) as z:
  def records(name):
   with z.open(name+'.jsonl') as f:
    for line in f:yield json.loads(line)
  systems={r['name']['en'].casefold():r for r in records('mapSolarSystems') if r['name']['en'].casefold() in requested}
  regions={r['_key']:r['name']['en'] for r in records('mapRegions')}
  constellations={r['_key']:r['name']['en'] for r in records('mapConstellations')}
  ids={r['_key'] for r in systems.values()}
  planets={r['_key']:r['celestialIndex'] for r in records('mapPlanets') if r['solarSystemID'] in ids}
  moons={(r['solarSystemID'],planets[r['orbitID']],r['orbitIndex']):r['_key'] for r in records('mapMoons') if r['solarSystemID'] in ids}
 return systems,regions,constellations,moons
def parse_ores(cells):
 ores=[];issues=[];notes=[];i=0
 canonical={n.casefold():n for n in TIERS}
 while i<len(cells):
  name=cells[i].strip();i+=1
  if not name:
   if i<len(cells) and re.fullmatch(r'0(?:\.0+)?%?',cells[i].strip()):i+=1
   continue
  if name.upper() in ['N/A','NA','NONE']:
   if i<len(cells) and (not cells[i].strip() or re.fullmatch(r'0(?:\.0+)?%?',cells[i].strip())):i+=1
   else:issues.append('Placeholder has a nonzero or missing quantity')
   continue
  if name in ['Monzanite','Sheelite']:
   corrected={'Monzanite':'Monazite','Sheelite':'Scheelite'}[name];notes.append('Corrected ore spelling '+name+' to '+corrected);name=corrected
  name=canonical.get(name.casefold(),name)
  if name not in TIERS:issues.append('Unknown ore name: '+name);continue
  value=cells[i].strip() if i<len(cells) else ''
  fraction=None
  if re.fullmatch(r'[0-9]+\.[0-9]+\.%',value):notes.append('Removed stray trailing decimal point for '+name);value=value[:-2]+'%'
  if re.fullmatch(r'0\.[0-9]+|1(?:\.0+)?',value):
   i+=1;fraction=float(value);notes.append('Read decimal fraction for '+name+' as '+str(fraction*100)+'%')
  elif re.fullmatch(r'(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)%+',value):
   i+=1;fraction=float(value.rstrip('%'))/100
   if value.endswith('%%'):notes.append('Removed repeated percent sign for '+name)
   if not 0<fraction<=1:issues.append('Invalid percentage for '+name);fraction=None
  else:
   issues.append('Missing or invalid percentage for '+name)
   if value not in TIERS and value!='Monzanite':i+=1
  if any(o['name']==name for o in ores):issues.append('Repeated ore: '+name)
  ores.append({'name':name,'fraction':fraction,'tier':TIERS[name]})
 if not ores:issues.append('No valid ores supplied')
 if sum(o['fraction'] or 0 for o in ores)>1.001:issues.append('Composition exceeds 100%')
 return ores,list(dict.fromkeys(issues)),notes
# Accept differences within one displayed 0.01 percentage point; retain original precision.
def compatible(a,b):
 x={o['name'].casefold():o['fraction'] for o in a};y={o['name'].casefold():o['fraction'] for o in b}
 return x.keys()==y.keys() and all(x[k]==y[k] if x[k] is None or y[k] is None else abs(x[k]-y[k])<=0.000101 for k in x)
def precision_upgrade(a,b):
 x={o['name'].casefold():o['fraction'] for o in a};y={o['name'].casefold():o['fraction'] for o in b}
 return x.keys()==y.keys() and bool(x) and all(x[k] is not None and y[k] is not None and abs(x[k]*100-round(x[k]*100))<1e-8 and abs(x[k]-y[k])<=0.005000001 for k in x) and any(abs(x[k]-y[k])>0.000101 for k in x)
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--date',required=True);parser.add_argument('--write',action='store_true');parser.add_argument('files',nargs='+');args=parser.parse_args();datetime.date.fromisoformat(args.date)
 data=json.loads(gzip.decompress((ROOT/'lib/moon-surveys.json.gz').read_bytes()));found={r['key']:r for r in data['rows']};before=len(found)
 batches=[];requested=set()
 for path in args.files:
  raw=Path(path).read_bytes();lines=list(csv.reader(raw.decode('utf-8-sig').splitlines(),delimiter='\t'));batch=[]
  for rowno,row in enumerate(lines,1):
   if not any(c.strip() for c in row):continue
   row=[c.strip() for c in row]
   if 'Ore 1' in row:continue
   if len(row) not in [12,13]:raise ValueError(f'{path}:{rowno}: expected 12 or 13 columns')
   offset=len(row)-12;system=row[offset];requested.add(system.casefold());batch.append((rowno,row,offset))
  batches.append((hashlib.sha256(raw).hexdigest(),batch))
 systems,regions,constellations,moons=locations(ROOT/'data/sde.zip',requested)
 report={'input_rows':0,'added':0,'duplicates':0,'conflicts':0,'precision_updates':[],'quality_rows':[],'normalised_rows':[],'conflict_rows':[],'regions':collections.Counter(),'batches':[]}
 for digest,batch in batches:
  label='Additional scans '+args.date+' '+digest[:10];report['batches'].append({'source':label,'rows':len(batch),'sha256':digest});data['tabs'][label]=len(batch)
  for rowno,row,offset in batch:
   report['input_rows']+=1;system,planet,moon,tier=row[offset:offset+4];planet=number(planet);moon=int(moon)
   meta=systems.get(system.casefold())
   if not meta or (meta['_key'],planet,moon) not in moons:raise ValueError(f'Unknown moon: {system} {planet} {moon} (source row {rowno})')
   system=meta['name']['en'];key=f'{system}|{planet}|{moon}';ores,issues,notes=parse_ores(row[offset+4:]);source={'tab':label,'row':rowno,'provided_tier':tier,'sha256':digest}
   if offset and row[0]!=constellations[meta['constellationID']]:notes.append('Constellation resolved from SDE; supplied '+row[0])
   record={'key':key,'region':regions[meta['regionID']],'constellation':constellations[meta['constellationID']],'system':system,'planet':planet,'moon':moon,'name':f'{system} {roman(planet)} - Moon {moon}','moon_id':moons[(meta['_key'],planet,moon)],'ores':ores,'issues':issues,'sources':[source]}
   if notes:record['import_notes']=notes;report['normalised_rows'].append({'moon':record['name'],'notes':notes})
   if issues:record['raw_source_row']=row;report['quality_rows'].append({'moon':record['name'],'issues':issues,'source':label,'row':rowno})
   if key in found:
    old=found[key]
    if source in old['sources']:report['duplicates']+=1;continue
    old['sources'].append(source)
    if notes:old.setdefault('supplemental_notes',[]).append({'source':label,'row':rowno,'notes':notes})
    if compatible(old['ores'],ores) and (not issues or sorted(issues)==sorted(old.get('issues',[]))):report['duplicates']+=1
    elif not issues and precision_upgrade(old['ores'],ores):
     old.setdefault('precision_history',[]).append({'ores':old['ores'],'sources':old['sources'][:-1]})
     old['ores']=ores;old.setdefault('import_notes',[]).append('Updated whole-percent composition with matching two-decimal scan; original retained in source history.')
     report['precision_updates'].append(record['name'])
    else:
     report['conflict_rows'].append({'moon':record['name'],'previous':old['ores'],'incoming':ores});old['conflict']=True;old.setdefault('alternatives',[]).append({'ores':ores,'tab':label,'row':rowno,'issues':issues,'notes':notes,'raw_source_row':row});report['conflicts']+=1
   else:found[key]=record;report['added']+=1;report['regions'][record['region']]+=1
 data['rows']=sorted(found.values(),key=lambda r:(r['region'],r['system'],r['planet'],r['moon']));data['imported']=args.date
 data.setdefault('supplemental_imports',[])
 for b in report['batches']:
  if not any(r['sha256']==b['sha256'] for r in data['supplemental_imports']):data['supplemental_imports'].append({**b,'date':args.date})
 report.update({'before':before,'after':len(found),'unique_keys':len({r['key'] for r in data['rows']}),'written':args.write})
 if args.write:(ROOT/'lib/moon-surveys.json.gz').write_bytes(gzip.compress(json.dumps(data,separators=(',',':'),ensure_ascii=False).encode('utf-8'),mtime=0))
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
