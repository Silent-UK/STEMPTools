# First VPS setup

## 1. Register EVE application
Create a new application in https://developers.eveonline.com/applications .
Callback: **https://tools.areyouaspy.co.uk/auth/callback**
Scopes (all required for each linked character):
```
esi-clones.read_clones.v1
esi-clones.read_implants.v1
esi-industry.read_character_jobs.v1
esi-characters.read_blueprints.v1
esi-skills.read_skills.v1
esi-skills.read_skillqueue.v1
esi-planets.manage_planets.v1
esi-assets.read_assets.v1
esi-structures.read_character.v1
esi-activities.read_character.v1
esi-universe.read_structures.v1
```
The PI scope is called `manage_planets` by CCP; Tools only performs reads.
Put client ID/secret directly into the VPS .env. Do not paste them into chat or Git.

## 2. Clone with a repository deploy key
Use a new read-only deploy key for Silent-UK/STEMPTools, as with the other sites:
```
ssh-keygen -t ed25519 -f /home/gary/.ssh/stemptools_deploy -N '' -C stemptools-vps
cat /home/gary/.ssh/stemptools_deploy.pub
```
Add that public key under GitHub repository Settings → Deploy keys (read-only).
Then:
```
mkdir -p /home/gary/apps
GIT_SSH_COMMAND='ssh -i /home/gary/.ssh/stemptools_deploy -o IdentitiesOnly=yes' git clone git@github.com:Silent-UK/STEMPTools.git /home/gary/apps/tools
cd /home/gary/apps/tools
git config core.sshCommand 'ssh -i /home/gary/.ssh/stemptools_deploy -o IdentitiesOnly=yes'
cp .env.example .env
chmod 600 .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
nano .env
```
Set ENCRYPTION_KEY to the generated value, EVE_CLIENT_ID and EVE_CLIENT_SECRET. Keep BASE_URL, OWNER_CHARACTER_ID and DATA_DIR from the example. Do not run preview on the VPS.

## 3. Import official item/skill data and install service
```
sudo install -d -o gary -g gary -m 700 /var/lib/stemp-tools
curl --fail --location https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip -o /var/lib/stemp-tools/sde.zip
python3 scripts/import-sde.py /var/lib/stemp-tools/sde.zip /var/lib/stemp-tools
sudo install -m 644 deploy/stemp-tools.service deploy/stemp-tools-deploy.service deploy/stemp-tools-deploy.timer /etc/systemd/system/
sudo install -m 755 deploy/update.sh /usr/local/bin/stemp-tools-deploy
sudo systemctl daemon-reload
sudo /usr/local/bin/stemp-tools-deploy
curl --fail http://127.0.0.1:3014/health
sudo systemctl enable stemp-tools
```
Node 24+ must be at /usr/bin/node. Port 3014 must be free (`sudo ss -ltnp '( sport = :3014 )'`). If occupied, select another port in .env, nginx.conf and update.sh before installing.

## 4. Nginx and HTTPS
DNS A record must point tools.areyouaspy.co.uk to 152.53.197.223; remove any conflicting AAAA record.
```
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/stemp-tools
sudo ln -s /etc/nginx/sites-available/stemp-tools /etc/nginx/sites-enabled/stemp-tools
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d tools.areyouaspy.co.uk
```
Only test login over HTTPS after the certificate succeeds. Sign in as Silent Uk first, then create invitation links from Invitations.

## 5. Auto-updates and verification
```
sudo systemctl enable --now stemp-tools-deploy.timer
sudo systemctl status stemp-tools --no-pager
```
The deployer fetches main, installs/checks/tests a separate release, switches current, and rolls back if the local health endpoint fails. It does not change Fuel/WCFAT deployments. No database migration approvals are needed for this initial independent database.

Verify a main login, link one alt, let its initial job finish, and compare skills/PI/assets/Merc Dens against EVE. Unsupported scopes or revoked tokens will show a reconnect/refresh issue. First sync can take longer for large inventories. No fake data is loaded in production.

Update SDE by repeating its download/import with the service stopped, then start it. Keep a copy of the old catalog for rollback. Existing application snapshots and documents are in the separate tools.sqlite file.

## Optional Mining access
Enable `esi-industry.read_character_mining.v1` on the EVE application. Each pilot opts in from Mining → Connect mining access. Regular login scopes remain unchanged; existing valid mining authorizations are preserved on ordinary login.
