import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('merge_moons',Path(__file__).with_name('merge-moon-surveys.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class MoonImportTest(unittest.TestCase):
 def test_percentages_and_zero_placeholders(self):
  ores,issues,notes=module.parse_ores(['Coesite','80%','N/A','0.00%','N/A','0'])
  self.assertEqual(issues,[]);self.assertEqual(len(ores),1);self.assertEqual(ores[0]['fraction'],.8)
 def test_known_source_typos_are_recorded(self):
  ores,issues,notes=module.parse_ores(['Monzanite','9.21%%','Sheelite','17.94.%'])
  self.assertEqual(issues,[]);self.assertEqual([r['name'] for r in ores],['Monazite','Scheelite']);self.assertEqual(len(notes),4)
 def test_missing_value_does_not_consume_next_ore(self):
  ores,issues,notes=module.parse_ores(['Chromite','Scheelite','17.94%','',''])
  self.assertEqual(ores[0]['fraction'],None);self.assertAlmostEqual(ores[1]['fraction'],.1794);self.assertTrue(issues)
 def test_conflicts_are_not_rounding_or_ore_order(self):
  a=[{'name':'Coesite','fraction':.453518569469},{'name':'Sylvite','fraction':.248165696859}]
  self.assertTrue(module.compatible(a,[{'name':'Sylvite','fraction':.2481},{'name':'Coesite','fraction':.4535}]))
  self.assertFalse(module.compatible(a,[{'name':'Zeolites','fraction':.2481},{'name':'Coesite','fraction':.4535}]))
 def test_decimal_fractions_and_empty_zero_slots(self):
  ores,issues,notes=module.parse_ores(['Bitumens','0.329097122','Coesite','26.95%','','0.00%'])
  self.assertEqual(issues,[]);self.assertEqual(ores[0]['fraction'],.329097122);self.assertEqual(len(ores),2);self.assertTrue(notes)
 def test_whole_percent_upgrades_require_matching_ores_and_rounding(self):
  a=[{'name':'Loparite','fraction':.2},{'name':'Scheelite','fraction':.09}]
  self.assertTrue(module.precision_upgrade(a,[{'name':'Loparite','fraction':.1974},{'name':'Scheelite','fraction':.0916}]))
  self.assertFalse(module.precision_upgrade(a,[{'name':'Loparite','fraction':.19},{'name':'Scheelite','fraction':.0916}]))
  self.assertFalse(module.precision_upgrade([{'name':'Ore','fraction':.123456}],[{'name':'Ore','fraction':.1234}]))
 def test_incomplete_composition_is_not_normalised(self):
  ores,issues,_=module.parse_ores(['Bitumens','30%','Sylvite','50%'])
  self.assertEqual(sum(o['fraction'] for o in ores),.8);self.assertEqual(issues,[])
 def test_invalid_totals_and_locations(self):
  self.assertTrue(module.parse_ores(['Bitumens','60%','Sylvite','60%'])[1]);self.assertEqual(module.number('IX'),9);self.assertEqual(module.number('10'),10)
  with self.assertRaises(ValueError):module.number('IIX')
if __name__=='__main__':unittest.main()
