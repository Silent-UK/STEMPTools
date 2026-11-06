# ESI diagnostics

Enabled server-side by default. No UI or new API is exposed. Events appear in the existing service journal with `[ESI trace]` and a JSON record.

```sh
journalctl -u stemp-tools --since "30 minutes ago" --no-pager | grep '\[ESI trace\]'
```

Use `narvi-tools` as the service name on NARVI. `cooldown_trigger` records the response that tripped the existing limiter, including status, duration, selected rate-limit headers and an ESI request ID if provided. `request_failure` distinguishes HTTP errors from network timeouts. `summary` shows endpoint request/error/status counts, cache hits and timings for the current activity window; it emits at a cooldown trigger or when the next request arrives after a minute. `cooldown_skip` identifies local requests suppressed after a trigger. A healthy response with low error allowance can indicate earlier errors or another application sharing the server's public IP; it is not proof of a CCP outage.

Location-only failures also include the numeric location ID so invalid station targets can be identified. Other endpoint numeric IDs are normalised, query strings and request/response bodies are omitted. Character correlation uses numeric character IDs only. Tokens, cookies, authorisation headers and raw exception text are never logged. At most 200 detailed events and 100 endpoint groups are retained per activity minute; summaries show the top 20 groups. Existing system journal retention applies; no separate trace database is created. Set application config `esiTrace:false` to disable tracing. This change does not alter request scheduling, retry or cooldown decisions.

Denied structure (403/404) and missing station (404) GET lookups are remembered for 24 hours in `esi_location_failures`. Character and corporation auth contexts are separate, as are individual pilots. Public station failures use a public cache key. No 401, rate-limit or transient server errors are cached this way. Negative hits are counted in activity summaries. The first lookup after expiry retries ESI; successful responses clear the entry.

Asset Safety location 2004 resolves locally. IDs outside the documented NPC station range (60000000–63999999) are not sent to the station endpoint. See CCP ESI asset location reference: https://docs.esi.evetech.net/docs/asset_location_id.html .
