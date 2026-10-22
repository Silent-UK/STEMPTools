import openpyxl,json,gzip,collections,re,hashlib,datetime
from pathlib import Path
import sys
if len(sys.argv)!=2:raise SystemExit("Usage: python scripts/import-moon-surveys.py source.xlsx")
w=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
source='https://docs.google.com/spreadsheets/d/1xImQnwoqVzMsisidnutSx3wY702weoc37ktbw8XosuY/edit'
def region(s):return {'Vale':'Vale of the Silent','Geminate West':'Geminate'}.get(s,s)
def roman(n):
 out=''
 for v,k in [(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
  while n>=v:out+=k;n-=v
 return out
moon_lookup={}
for row in list(w['moons'].values)[1:]:
 if len(row)>6 and isinstance(row[0],(int,float)):
  moon_lookup[str(row[4]).casefold()]=(int(row[0]),int(row[1]),region(str(row[6])))
tiers={r[0]:r[2] for r in list(w['moon_tiers'].values)[1:] if len(r)>2 and isinstance(r[0],str)}
found={};counts={};invalid=[];conflicts=0
for sheet in w:
 iterator=iter(sheet.values);header=next(iterator,())
 if list(header[:5])!=['Region','Const','System','Planet','Moon']:continue
 counts[sheet.title]=0
 for line,row in enumerate(iterator,2):
  if not row or not any(row[:5]):continue
  try:
   reg,const,system=str(row[0]).strip(),str(row[1]).strip(),str(row[2]).strip()
   def number(v):return int(openpyxl.utils.datetime.to_excel(v)) if isinstance(v,datetime.datetime) else int(v)
   planet,moon=number(row[3]),number(row[4])
   if planet<=0 or moon<=0:raise ValueError('Invalid location')
   ores=[];issues=[]
   for i in range(5,13,2):
    name=row[i] if len(row)>i else None;qty=row[i+1] if len(row)>i+1 else None
    if name=='':name=None
    if qty=='':qty=None
    if name is None and qty is None:continue
    if not isinstance(name,str) or name.startswith('#'):
     issues.append('Missing or invalid ore name');continue
    if qty is not None and (not isinstance(qty,(int,float)) or not 0<=qty<=1):
     issues.append('Missing or invalid ore quantity');qty=None
    ores.append({'name':name.strip(),'fraction':qty,'tier':tiers.get(name.strip())})
   name=f'{system} {roman(planet)} - Moon {moon}';match=moon_lookup.get(name.casefold())
   key=f'{system}|{planet}|{moon}'
   record={'key':key,'region':region(reg),'constellation':const,'system':system,'planet':planet,'moon':moon,'name':name,'moon_id':match[0] if match else None,'ores':ores,'issues':issues,'sources':[{'tab':sheet.title,'row':line}]}
   if match and match[2]!=record['region']:record['region']=match[2]
   counts[sheet.title]+=1
   if key in found:
    old=found[key];old['sources']+=record['sources']
    a={o['name']:o['fraction'] for o in old['ores']};b={o['name']:o['fraction'] for o in ores}
    if set(a)!=set(b) or any((a[k]!=b[k] if a[k] is None or b[k] is None else abs(a[k]-b[k])>0.000001) for k in a if k in b):
     old['conflict']=True;old.setdefault('alternatives',[]).append({'ores':ores,'tab':sheet.title,'row':line});conflicts+=1
   else:found[key]=record
  except (ValueError,TypeError,IndexError) as e:invalid.append({'tab':sheet.title,'row':line,'reason':str(e)})
rows=sorted(found.values(),key=lambda r:(r['region'],r['system'],r['planet'],r['moon']))
data={'source':source,'imported':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'daily_m3':w['MoonPricing']['F6'].value,'rate_source':'MoonPricing!F6','tabs':counts,'invalid':invalid,'rows':rows}
out=Path(__file__).resolve().parent.parent/'lib/moon-surveys.json.gz'
with gzip.open(out,'wt',encoding='utf-8') as f:json.dump(data,f,separators=(',',':'),ensure_ascii=False)
print(json.dumps({'moons':len(rows),'tabs':counts,'invalid':invalid[:15],'invalid_count':len(invalid),'conflicts':sum(bool(r.get('conflict')) for r in rows),'matched_ids':sum(r['moon_id'] is not None for r in rows),'regions':dict(collections.Counter(r['region'] for r in rows)),'bytes':out.stat().st_size}))
