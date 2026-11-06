# Asset Search and Asset Safety

Search Exact matches the full item type name, ignoring case and surrounding spaces. Ship/container context and fitted modules remain visible. Location filtering is unchanged.

The Asset Safety section follows the selected pilot or Search All, independently of the text filters. Only assets flagged AssetSafety, rooted at location 2004, or contained within those wrappers are listed. An inaccessible structure alone is not classified as Asset Safety.

Asset sync also checks personal EVE notifications when the existing esi-characters.read_notifications.v1 scope is granted. Only personal StructureItemsMovedToSafety metadata is retained, up to 500 transfers per pilot. Raw notification bodies and unrelated notifications are not stored. A failed notification check retains saved transfer dates and does not fail the asset inventory sync.

Transfer notifications do not identify individual wraps. Their recovery milestones are shown separately from packages. EVE FILETIME milestone fields are preferred; missing fields use the notification timestamp plus the published 5-day/20-day intervals. First observation time is never used. Recovered or relocated packages cannot be confirmed by the notification history, so passed deadlines are not labelled as confirmed delivery. Missing notifications mean unknown recovery dates.

Rules: https://support.eveonline.com/hc/en-us/articles/208289365-Asset-Safety
Notification fields: https://pkg.go.dev/github.com/antihax/goesi/notification#StructureItemsMovedToSafety
