export const adminNav=[["admin-users","♙","Users"],["admin-groups","◇","Groups"],["admin-links","↗","Links"],["admin-pages","▤","Pages"],["admin-esi","↻","ESI Status"],["admin-corp","▣","Corp ESI"],["admin-whitelist","⚙","Whitelist"],["admin-recruitment","✓","Recruitment Settings"],["admin-discord","◉","Discord"]];
export const pageIcons=Object.fromEntries([...[
  ["overview", "◈", "Overview"],
  ["characters", "♙", "My Characters"],
  ["skills", "▤", "Skills & Queues"],
  ["clones", "◉", "Clones"],
  ["wallet", "◈", "Wallet"],
  ["contracts", "▧", "Contracts"],
  ["standings", "◇", "Standings"],
  ["ratting", "◈", "Ratting"],
  ["market", "◈", "Market"],
  ["mining", "⛏", "Mining"],
  ["industry", "⚒", "Industry"],
  ["blueprints", "▤", "Blueprints"],
  ["plans", "◇", "Skill Plans"],
  ["fittings", "△", "Fittings"],
  ["dens", "⬡", "Mercenary Dens"],
  ["pi", "◎", "Planetary Industry"],
  ["assets", "▦", "Asset Search"],
],...[['corp-overview','◈','Overview'],['corp-members','♙','Memberlist'],['corp-pilots','♙','Roles and Access'],['corp-wallet','◈','Wallet'],['corp-contracts','▧','Contracts'],['corp-assets','▦','Corp Assets'],['corp-search-pilots','⌕','Search Pilots'],['corp-standings','◇','Standings'],['corp-market','◈','Market'],['corp-industry','⚒','Industry'],['corp-blueprints','▤','Blueprints'],['corp-structures','▥','Structures'],['corp-moons','☾','Moon Mining'],['corp-surveys','☷','Moon Surveys']],...adminNav].map(([id,icon])=>[id,icon]));
export const FONT_SIZES={small:0.9,normal:1,large:1.15,"extra-large":1.3};
