# Discord integration

Configure Admin > Discord independently for STEMP and NARVI. No shared credentials, separate bot process, Gateway connection or privileged intents are needed. A successful Test Connection means the REST API credentials/server permissions work; the bot can appear offline in Discord.

1. Create an application at https://discord.com/developers/applications. Copy Application ID and OAuth2 Client Secret. Create/reset the Bot Token under Bot. Keep secrets private.
2. Enable Discord Developer Mode (User Settings > Advanced), then Copy Server ID from the intended server. Enter all four values in Admin > Discord.
3. Add the exact callback shown on that page under OAuth2 > Redirects, then save it in Discord.
4. Enable the integration and save. Use the generated Invite Bot link with the bot scope and Manage Roles permission. Enable Guild Install under Installation if required.
5. In Server Settings > Roles, move the bot above the roles Tools will manage. Do not grant it Administrator. Run Test Connection. The setup notice can then be hidden; instructions remain expandable and reappear after credential changes.
6. Under Admin > Groups, optionally paste a Discord Role ID (right-click a role > Copy Role ID). Blank means no Discord role. Mapped roles must be unmanaged, below the bot and cannot grant Administrator, Manage Server or Manage Roles.
7. Players join the Discord server themselves, then link their Discord account in Tools > Settings. OAuth requests identify only. No email, message access or auto-join scope is used.

Approved site Group membership grants the mapped role; pending/rejected membership does not. Restricted membership rechecks the same requirements as site access. Removing a mapping/group/membership removes roles managed by Tools. Shared roles stay while another approved Group requires them. The bot owns the mapped roles, including a mapped role the player already had; do not map unrelated manually maintained roles. Other roles are never changed.

The worker processes one account every 15 seconds, checking accounts again after five minutes. Large installations take longer. API errors are retained on the account and retried, and Discord rate limits are respected. Changes to site membership are checked through the ordinary whitelist. Temporary membership lookup failures do not strip roles. Deleted accounts retain a minimal Discord ID/role ledger until their managed roles are removed.

Disabling integration pauses linking and role changes; existing Discord roles remain in place. Unlinking removes managed roles first, so a working integration is required when there are outstanding roles. Application/Server IDs cannot change while accounts or tracked roles remain linked. Bot Token/Client Secret rotation is supported.

Secrets are encrypted with the site's existing encryption key and never returned through the API. Back up this key and the application database using the normal procedure. Each installation requires its own Discord settings.

# Link aliases

Admin > Links accepts either an HTTP(S) destination or a bare domain (defaults to HTTPS). An optional Short Path such as Google creates https://<this-tools-site>/Google, which redirects to the destination. It does not proxy the external page or provision another hostname. Paths are case insensitive and unique, and application paths are reserved. A blank Short Path preserves direct links. Public alias URLs can be shared without sign-in, like their external destinations.
