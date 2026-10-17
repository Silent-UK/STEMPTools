#!/usr/bin/env bash
set -euo pipefail
exec 9>/var/lock/stemp-tools-deploy.lock
flock -n 9 || exit 0
repo=/home/gary/apps/tools
releases=/home/gary/releases/tools
runuser -u gary -- git -C "$repo" fetch origin main
sha=$(runuser -u gary -- git -C "$repo" rev-parse origin/main)
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
previous=$(readlink -f "$releases/current" || true)
release="$releases/$sha"
if [[ "$previous" == "$release" ]] && systemctl is-active --quiet stemp-tools; then exit 0; fi
install -d -o gary -g gary -m 755 "$releases" "$release"
runuser -u gary -- git -C "$repo" archive "$sha" | tar -x -C "$release"
chown -R gary:gary "$release"
if [[ ! -e "$release/data" ]]; then ln -s /var/lib/stemp-tools "$release/data"; fi
runuser -u gary -- bash -c 'cd "$1" && npm ci --omit=dev && npm run check && npm test' _ "$release"
ln -sfn "$release" "$releases/current.next"
mv -Tf "$releases/current.next" "$releases/current"
systemctl restart stemp-tools
for attempt in {1..20}; do
    if curl --silent --fail http://127.0.0.1:3014/health >/dev/null; then echo "Tools deployed: $sha"; exit 0; fi
    sleep 1
done
if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "$releases/current.next"
    mv -Tf "$releases/current.next" "$releases/current"
    systemctl restart stemp-tools
fi
echo 'Health check failed; previous release restored when available.' >&2
exit 1
