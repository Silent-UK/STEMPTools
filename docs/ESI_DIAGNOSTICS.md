# ESI diagnostics

Enabled server-side by default. No UI or new API is exposed. Events appear in the existing service journal with `[ESI trace]` and a JSON record.

```sh
journalctl -u stemp-tools --since "30 minutes ago" --no-pager | grep '\[ESI trace\]'
```

Use `narvi-tools` as the service name on NARVI. `cooldown_trigger` records the response that tripped the existing limiter, including status, duration, selected rate-limit headers and an ESI request ID if provided. `request_failure` distinguishes HTTP errors from network timeouts. `summary` shows endpoint request/error/status counts, cache hits and timings for the current activity window; it emits at a cooldown trigger or when the next request arrives after a minute. `cooldown_skip` identifies local requests suppressed after a trigger. A healthy response with low error allowance can indicate earlier errors or another application sharing the server's public IP; it is not proof of a CCP outage.

Endpoint numeric IDs are normalised, query strings and request/response bodies are omitted. Character correlation uses numeric character IDs only. Tokens, cookies, authorisation headers and raw exception text are never logged. At most 200 detailed events and 100 endpoint groups are retained per activity minute; summaries show the top 20 groups. Existing system journal retention applies; no separate trace database is created. Set application config `esiTrace:false` to disable tracing. This change does not alter request scheduling, retry or cooldown decisions.
