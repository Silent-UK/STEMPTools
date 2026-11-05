# Custom site pages

Admin > Pages appears after Admin > Links. Pages are created and edited by site admins, outside Inspect mode. Set a name, text, placement, order, visibility and Published flag. New pages default to drafts.

The editor uses a deliberately limited Markdown dialect: headings (# through ####), paragraphs, bold (**text**), italic (*text*), inline code (`text`), fenced code blocks, bullet/numbered lists, quotes (>), separators (---) and links ([label](https://example.com)). A visible formatting guide shows examples, and the live preview uses exactly the same renderer as the server. HTML, images, embeds, CSS and JavaScript are not supported. Raw HTML is shown as text. Text is limited to 12,000 characters. Links permit HTTP(S), mailto, or relative paths on the site; external links open with opener/referrer protection.

Choose a sidebar section: Pages (new section below Links), My Characters, Management or Corporation Management. Choose top, bottom or after a built-in page. Pages sharing an insertion point sort by numeric Order, then name. If the chosen built-in item is hidden for a reader, the custom page appears at the bottom of that section. Placing a page under Corporation Management does not grant any built-in corporation access.

All Signed-in Users includes recruits, but not anonymous visitors. Selected Groups requires approved membership in any selected Group, with the same fresh-data requirement checks as normal restricted Groups. Recruits do not inherit Group-restricted custom pages. Admins can read/edit every page, including drafts. Direct API requests recheck permissions; navigation is not an access boundary. Deleted Groups lose their grants immediately; an otherwise inaccessible Group-only page remains admin-only.

Published pages have stable links such as /#page-12. A rename does not change this ID. Drafts are absent from the sidebar. Inspect mode does not expose this global content or its editor.

Each installation stores its own pages and access settings in the existing application database. Use the normal backup procedure. No dependencies or external services are added. Deleting a page is confirmed in the editor and removes it permanently.

# Search Pilots

Corporation Management > Search Pilots appears immediately after Corp Assets. It has a separate Group page permission. Site admins and verified directors can view it; Group members need an explicit Search Pilots grant, not merely Corp Assets. Search uses saved personal inventory for every permitted registered character, including alts and recruits, rather than corporation-owned assets. Other administrators’ accounts are excluded; the viewer can search their own account. Inspect mode cannot use this global search.

Combine general search, item type, custom name (optionally exact), location and Ship/Module category. For a named Gnosis, use Item Type Gnosis and Custom Name AIR. Location includes nested ship/container paths. Results show Character, Location of Asset, Name and Type, with quantity and saved-data time. Missing/partial custom names and missing inventories are identified in Asset Coverage. Results are paginated at 100 rows and do not prove current possession.

Personal asset sync now collects singleton custom names in batches of up to 1000 with the existing asset access. Names become available on each character’s next asset sync (manual sync also works); a name lookup failure preserves prior known names without discarding inventory. A successful None response clears an obsolete custom name. Empty results may reflect incomplete or stale data.
