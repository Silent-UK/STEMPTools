import openpyxl,json
from pathlib import Path
import sys
if len(sys.argv)!=2:raise SystemExit("Usage: python scripts/import-moon-recipes.py source.xlsx")
w=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
recipes={}
for sheet in ['ore_calculator','moon_drill_calculator']:
 rows=iter(w[sheet].values);headers=next(rows);result={}
 for row in rows:
  if not row or not isinstance(row[0],str) or not isinstance(row[7],(int,float)):continue
  result[row[0]]={'batch_m3':row[7],'materials':[{'name':headers[i],'quantity':v} for i,v in enumerate(row[8:],8) if isinstance(v,(int,float)) and v>0 and headers[i] and (sheet=='ore_calculator' or i>=15)]}
 recipes['athanor' if sheet=='ore_calculator' else 'metenox']=result
(Path(__file__).resolve().parent.parent/'lib/moon-recipes.json').write_text(json.dumps({'source':'Source spreadsheet ore_calculator and moon_drill_calculator tabs','recipes':recipes},separators=(',',':')),encoding='utf-8')
print({k:len(v) for k,v in recipes.items()})
