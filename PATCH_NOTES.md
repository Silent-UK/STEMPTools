# STEMP Tools v0.22.1
## The Management Update · 31 October 2026

### Your Characters
- **Ratting:** combined NPC bounty and ESS income, with a breakdown for pilots who earned ISK. Filter by Day, Week, Current Month, 30, 60, 90 Days or All Time.
- **Market:** buy and sell orders across linked pilots, with pilot, item, location and status filters. Include order history to see fulfilled, cancelled and expired orders separately.
- **Saved Fitting Imports:** copy a pilot's saved in-game fittings into Tools from the Fittings page. Imports are private by default and leave the EVE originals unchanged.
- **Make Main:** promote an incorrectly grouped alt to a main character in your character list. Your account's sign-in main stays the same.

### Settings & Navigation
- New **My Characters** and **Management** sidebar headings, with consistent capitalisation throughout the menu.
- Smaller sidebar rows, icons and branding. Sections work as an accordion, with the current page's section opening automatically.
- New **Settings** switches for Ratting, Market, Mining, Industry, Mercenary Dens and Planetary Industry.
- Hidden features pause their dedicated syncing. Data needed elsewhere continues syncing, including Wallet history and PI shared with other players.
- Turning a feature back on resumes its collection on the next sync and keeps its previously saved data.

### Groups
- Browse groups with an icon, name, description and application option.
- Support for **Auto Accept**, **Admin Approval** and **Restricted** membership.
- Restricted groups can require ship ownership and active skill levels on the same pilot, including Titan and Dreadnought presets and specific ship/skill searches.
- Admins can create and edit groups, approve applications, revoke membership and grant access to individual Corporation Management pages.
- Restricted access is checked against fresh character snapshots when used.

### Corporation Management
- **Overview:** corporation details, Dotlan member statistics, zKillboard combat totals and the latest ten Eve Who joiners and leavers, where available.
- **Memberlist:** corporation members, last reported activity, ship and location, with confirmation of Tools registration.
- **Pilots:** titles, join dates and last login, plus searchable assigned and grantable roles. Optional details show hangar and wallet division access, including location scopes and title-derived roles.
- **Corp Assets:** corporation inventory grouped by location, with item and location searches and expandable ship/container contents.
- **Wallet:** seven division balances, retained journal entries and market transactions, with division and transaction filters.
- **External Links:** admins can add names, descriptions and URLs for links displayed under Corporation Management.
- Each new corporation page has its own group permission.

### Administration & Connections
- **Inspect Only:** Mail and Contacts pages appear only during an administrator's read-only inspection of an account. Both support pilot selection; mail supports message viewing and older messages, and contacts are paginated.
- **Users:** tighter aligned rows, corporation names, smaller portraits and compact expandable character health. Schedule and error details stay tucked away until needed.
- Normal character connections now request personal and corporation scopes together. Eligible Sacred Templars CEOs/Directors are detected automatically.
- Removed the separate CEO/Director connection option from Add Character.
- Ordinary members can still connect normally. Corporation access continues to require valid roles or an explicit Tools group grant.

### Before You Dive In
- **Reconnect your characters once** to grant the updated permissions.
- Ratting's All Time means retained wallet history, not lifetime earnings. Day, Week and Month use UTC; weeks start Monday. Ratting excludes loot, LP, mission rewards and corporation tax.
- Market history depends on what ESI supplies and Tools has retained. A disappearing order is never assumed to be fulfilled.
- Corporation activity, ships, locations and access information are reported snapshots. Structure ACLs and container locks can affect actual in-game access.
- External sources may be delayed or unavailable. Failed refreshes retain previous complete data where available and show a warning.

Validated with **119 automated tests**, syntax checks and browser checks using isolated sample data.
