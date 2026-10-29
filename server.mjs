import miningRecipes from './lib/mining-recipes.json' with {type:'json'};
import {whitelistService} from "./lib/whitelist.mjs";
import {surveyList} from './lib/moon-surveys.mjs';
import {assetMatches} from "./public/asset-tree.mjs";
import {corporationService} from "./lib/corp-management.mjs";
import {CORP_SCOPES,STEMP_ID,verifyCorporation} from "./lib/corp.mjs";
import {defaultPISettings,validatePISettings,combinedProduction,combinedVolumes,jitaPricing} from "./lib/pi.mjs";
import {validSubscriptionDate} from "./public/subscription.mjs";
import { fittingView } from "./lib/fitting-view.mjs";
import skillGroups from "./lib/skill-groups.json" with { type: "json" };
import express from "express";
import helmet from "helmet";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import {
  openStore,
  transaction,
  ownedCharacter,
  visibleDocument,
} from "./lib/store.mjs";
import {
  random,
  hash,
  cryptoBox,
  cookies,
  assertOrigin,
} from "./lib/security.mjs";
import { catalog } from "./lib/catalog.mjs";
import { SCOPES, exchange, verifyToken, eveClient } from "./lib/eve.mjs";
import { syncService, piSummary } from "./lib/sync.mjs";
import {
  importSkillText,
  expandPlan,
  comparePlan,
  parseFitting,
  requirements,
} from "./lib/plans.mjs";
export function createApp(config) {
  const db = config.db || openStore(config.data),
    cat = config.cat || catalog(config.data),
    box = cryptoBox(config.key),
    eve = config.eve || eveClient(db, box, config),
    sync = syncService(db, eve, cat),
    corp = corporationService(db,box,config,cat,eve);
  const whitelist=whitelistService(db,config.membershipLookup || (async id=>(await eve.request("/characters/"+id)).data));
  const ownerUser=db.prepare("SELECT id FROM users WHERE main_id=?").get(config.owner);
  const legacy=db.prepare("SELECT * FROM corporation_connections WHERE corporation_id=?").get(STEMP_ID);
  if(ownerUser&&legacy)db.prepare("INSERT OR IGNORE INTO corp_authorizations VALUES(?,?,?,?,?,?,?,?,?,?)").run(ownerUser.id,legacy.character_id,legacy.character_name,legacy.owner_hash,STEMP_ID,legacy.tokens,JSON.stringify(["esi-characters.read_corporation_roles.v1"]),0,legacy.role,0);
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "https://images.evetech.net"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  const cookieOptions = {
    httpOnly: true,
    secure: config.base.startsWith("https:"),
    sameSite: "lax",
    path: "/",
  };
  const rate = new Map();
  app.use("/auth", (req, res, next) => {
    const ip = req.socket.remoteAddress,
      now = Date.now(),
      r = rate.get(ip);
    if (r && r.until > now) {
      if (++r.count > 100)
        return res
          .status(429)
          .send("Too many login attempts; try again shortly");
    } else rate.set(ip, { until: now + 60000, count: 1 });
    if (rate.size > 10000) rate.clear();
    next();
  });
  app.use((req, res, next) => {
    const session = cookies(req).tools_session;
    req.session = session
      ? db
          .prepare(
            "SELECT s.*,u.name,u.main_id,u.admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?",
          )
          .get(hash(session), Date.now())
      : null;
    if (req.path.startsWith("/api") || req.path.startsWith("/auth"))
      res.set("Cache-Control", "no-store");
    next();
  });
  app.use(async(req,res,next)=>{
    const path=req.path.toLowerCase();
    if(!req.session || !(path.startsWith('/api/')||path.startsWith('/auth/')) || path==='/api/logout')return next();
    try {await whitelist.check(req.session.main_id);
      if(path.startsWith('/api/'))db.prepare('INSERT INTO user_activity VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen WHERE user_activity.last_seen<excluded.last_seen-60000').run(req.session.user_id,Date.now());
      next();}
    catch(e) {
      if(e.status===403){db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.session.user_id);res.clearCookie('tools_session',cookieOptions);}
      if(path.startsWith('/api/'))return res.status(e.status).json({error:e.message});
      res.status(e.status).type('text').send(e.message);
    }
  });
  app.get("/health", (_req, res) => res.json({ ok: true, version: "0.20.24" }));
  app.get("/auth/login", (req, res) => {
    if (!config.client || !config.secret)
      return res.status(503).send("EVE login is not configured yet.");
    const corporation=req.query.corporation === "1",mining=req.query.mining === "1";
    if(mining && (!req.session||corporation))return res.sendStatus(400);
    const miningCharacter=mining?ownedCharacter(db,req.session.user_id,req.query.character):null;
    if(corporation && !req.session)return res.sendStatus(401);
    const linking = corporation || mining || req.query.link === "1";
    if (linking && !req.session)
      return res
        .status(401)
        .send("Sign in with your main before linking an alt.");
    const groupMode = linking ? req.query.group : null;
    let groupParent = null;
    if(groupMode != null) {
      if(!["main","alt"].includes(groupMode))return res.status(400).send("Choose Main or Alt");
      if(groupMode === "alt") {
        const parent=ownedCharacter(db,req.session.user_id,req.query.parent);
        const parentId=db.prepare("SELECT parent_id FROM character_groups WHERE character_id=?").get(parent.id)?.parent_id || req.session.main_id;
        if(parentId!==parent.id)return res.status(400).send("Choose a main character for this alt");
        groupParent=parent.id;
      }
    }
    const state = random(),
      browser = random(),
      verifier = random();
    db.prepare("DELETE FROM oauth WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO oauth VALUES(?,?,?,?,?,?)").run(
      hash(state),
      hash(browser),
      linking ? req.session.user_id : null,
      null,
      verifier,
      Date.now() + 600000,
    );
    if(mining)db.prepare("INSERT INTO oauth_mining VALUES(?,?)").run(hash(state),miningCharacter.id);
    if(corporation)db.prepare("INSERT INTO oauth_corporations VALUES(?)").run(hash(state));
    if(groupMode)db.prepare("INSERT INTO oauth_character_groups VALUES(?,?,?)").run(hash(state),groupMode,groupParent);
    res.cookie("tools_oauth", browser, { ...cookieOptions, maxAge: 600000 });
    const url = new URL("https://login.eveonline.com/v2/oauth/authorize");
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id: config.client,
      redirect_uri: config.base + "/auth/callback",
      scope: (corporation?CORP_SCOPES:SCOPES).join(" "),
      state,
      code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
      code_challenge_method: "S256",
    }))
      url.searchParams.set(k, v);
    res.redirect(url.href);
  });
  app.get("/auth/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "",
      browser = cookies(req).tools_oauth || "";
    const flow = db
      .prepare("SELECT * FROM oauth WHERE state=? AND browser=? AND expires>?")
      .get(hash(state), hash(browser), Date.now());
    if (!flow)
      return res.status(400).send("Login expired or invalid. Start again.");
    const corporation=!!db.prepare("SELECT 1 FROM oauth_corporations WHERE state=?").get(hash(state));
    if(corporation && !req.session)return res.sendStatus(401);
    const miningFlow=db.prepare("SELECT character_id FROM oauth_mining WHERE state=?").get(hash(state));
    const grouping=db.prepare("SELECT mode,parent_id FROM oauth_character_groups WHERE state=?").get(hash(state));
    db.prepare("DELETE FROM oauth WHERE state=?").run(hash(state));
    res.clearCookie("tools_oauth", cookieOptions);
    if (flow.user_id && req.session?.user_id !== flow.user_id)
      return res
        .status(403)
        .send("The account linking session changed. Sign in again.");
    if (typeof req.query.code !== "string")
      return res.status(400).send("EVE login was cancelled.");
    const token = await (config.exchange || exchange)(config, {
        grant_type: "authorization_code",
        code: req.query.code,
        code_verifier: flow.verifier,
        redirect_uri: config.base + "/auth/callback",
      }),
      id = await (config.verifyToken || verifyToken)(
        token.access_token,
        config.client,
        corporation?CORP_SCOPES:SCOPES,
      );
    if(miningFlow && id.id!==miningFlow.character_id)throw Object.assign(Error('Choose the pilot whose mining access you are connecting.'),{status:403});
    if(corporation) {
      const verifiedCorp=await (config.verifyCorporation||verifyCorporation)(token.access_token,id.id,config.corpNetwork||fetch);
      if(verifiedCorp.id!==STEMP_ID||!["CEO","Director"].includes(verifiedCorp.role))throw Object.assign(Error("Corporation Management is for Sacred Templars CEOs and Directors."),{status:403});
      db.prepare("INSERT INTO corp_authorizations VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET character_id=excluded.character_id,character_name=excluded.character_name,owner_hash=excluded.owner_hash,corporation_id=excluded.corporation_id,tokens=excluded.tokens,scopes=excluded.scopes,expires=excluded.expires,role=excluded.role,verified=excluded.verified").run(req.session.user_id,id.id,id.name,id.owner,verifiedCorp.id,box.seal(token),JSON.stringify(id.scopes),id.expires,verifiedCorp.role,Date.now());
      corp.connected(req.session.user_id);
      const corpInfo=verifiedCorp;
      if(req.session.main_id===config.owner)db.prepare("INSERT INTO corporation_connections VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(corporation_id) DO UPDATE SET name=excluded.name,character_id=excluded.character_id,character_name=excluded.character_name,owner_hash=excluded.owner_hash,tokens=excluded.tokens,verified=excluded.verified,role=excluded.role").run(corpInfo.id,corpInfo.name,id.id,id.name,id.owner,box.seal(token),Date.now(),corpInfo.role);
      return res.redirect("/#corp-structures");
    }
    if(!flow.user_id)await whitelist.check(id.id,true);
    const user = transaction(db, () => {
      const existing = db
        .prepare("SELECT * FROM characters WHERE id=?")
        .get(id.id);
      if (existing && existing.owner_hash !== id.owner)
        throw Object.assign(
          Error(
            "Character ownership changed. Contact the administrator before linking.",
          ),
          { status: 403 },
        );
      if (flow.user_id && existing && existing.user_id !== flow.user_id)
        throw Object.assign(
          Error("Character is already linked to another Tools account."),
          { status: 409 },
        );
      let uid = flow.user_id;
      if (!uid && existing) {
        const u = db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(existing.user_id);
        if (u.main_id !== id.id)
          throw Object.assign(Error("Sign in with your main character."), {
            status: 403,
          });
        uid = u.id;
      }
      if (!uid) {
        uid = Number(
          db
            .prepare("INSERT INTO users(main_id,name,admin) VALUES(?,?,?)")
            .run(id.id, id.name, id.id === config.owner ? 1 : 0)
            .lastInsertRowid,
        );

      }
      db.prepare(
        "INSERT INTO characters VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tokens=excluded.tokens,scopes=excluded.scopes,expires=excluded.expires,reconnect=0",
      ).run(
        id.id,
        uid,
        id.name,
        id.owner,
        box.seal(token),
        JSON.stringify(id.scopes),
        id.expires,
      );
      if(flow.user_id && grouping && !existing) {
        const parent=grouping.mode==="main"?id.id:grouping.parent_id;
        if(grouping.mode==="alt") {
          const main=ownedCharacter(db,uid,parent);
          const loginMain=db.prepare("SELECT main_id FROM users WHERE id=?").get(uid).main_id;
          if((db.prepare("SELECT parent_id FROM character_groups WHERE character_id=?").get(main.id)?.parent_id||loginMain)!==main.id)
            throw Object.assign(Error("The selected main changed. Add the character again."),{status:400});
        }
        db.prepare("INSERT INTO character_groups VALUES(?,?)").run(id.id,parent);
      }
      return uid;
    });
    if(flow.user_id || !db.prepare("SELECT 1 FROM snapshots WHERE character_id=? LIMIT 1").get(id.id))sync.queue(user,id.id,true);
    const session = random();
    if (req.session)
      db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(session),
      user,
      Date.now() + 7 * 86400000,
    );
    res.cookie("tools_session", session, {
      ...cookieOptions,
      maxAge: 7 * 86400000,
    });
    if(!flow.user_id)db.prepare("INSERT INTO user_logins VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_login=excluded.last_login").run(user,Date.now());
    res.redirect(miningFlow?"/#mining":"/");
  });
  app.use("/api", (req, res, next) => {
    if (!req.session)
      return res
        .status(401)
        .json({ error: "Sign in with your main character" });
    if (!["GET", "HEAD"].includes(req.method)) {
      try {
        assertOrigin(req, config.base);
      } catch (e) {
        return res.status(403).json({ error: e.message });
      }
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Use JSON" });
    }
    next();
  });
  app.get("/api/me", async (req,res)=>res.json({name:req.session.name,main_id:req.session.main_id,admin:req.session.main_id===config.owner,corporation:await corp.access(req.session.user_id)}));
  app.use("/api/corporation",async(req,res,next)=>{
    if(!await corp.access(req.session.user_id))return res.status(403).json({error:"Sacred Templars CEO or Director access is required. Connect corporation access again."});
    next();
  });
  app.get("/api/corporation/surveys/browser",async(req,res)=>res.json(await corp.surveys(req.query)));
  app.get("/api/corporation/surveys",(req,res)=>res.json(surveyList(req.query)));
  app.get("/api/corporation/industry",(req,res)=>res.json(corp.industrySnapshot()));
  app.get("/api/corporation/harvest",async(req,res)=>res.json(await corp.harvest()));
  app.get("/api/corporation/structures",(req,res)=>res.json(corp.snapshot()));
  app.post("/api/corporation/sync",(req,res)=>{corp.queue();res.json({ok:true});});
  app.post("/api/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    res.clearCookie("tools_session", cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/characters", (req, res) => {
    const rows = db
      .prepare(
        "SELECT id,name,reconnect FROM characters WHERE user_id=? ORDER BY (id=(SELECT main_id FROM users WHERE id=characters.user_id)) DESC, (SELECT position FROM character_order WHERE character_id=characters.id), id",
      )
      .all(req.session.user_id);
    res.json(
      rows.map((c) => ({
        ...c,
        total_sp: JSON.parse(db.prepare("SELECT data FROM snapshots WHERE character_id=? AND kind='skills'").get(c.id)?.data || "null")?.skills?.total_sp ?? null,
        isk: JSON.parse(db.prepare("SELECT data FROM snapshots WHERE character_id=? AND kind='wallet'").get(c.id)?.data || "null")?.balance ?? null,
        main: c.id === req.session.main_id,
        subscription_end: db.prepare("SELECT expires_on FROM character_subscriptions WHERE character_id=?").get(c.id)?.expires_on || null,
        parent_id: db.prepare("SELECT parent_id FROM character_groups WHERE character_id=?").get(c.id)?.parent_id || req.session.main_id,
        job:
          db.prepare("SELECT status FROM jobs WHERE character_id=?").get(c.id)
            ?.status || null,
        snapshots: db
          .prepare(
            "SELECT kind,updated,expires FROM snapshots WHERE character_id=?",
          )
          .all(c.id),
        errors: db
          .prepare("SELECT kind,message FROM sync_errors WHERE character_id=?")
          .all(c.id),
      })),
    );
  });
  app.post("/api/characters/:id/subscription",(req,res)=>{
    const c=ownedCharacter(db,req.session.user_id,req.params.id), value=req.body.expires_on;
    if(value!==null && value!=="" && !validSubscriptionDate(value))return res.status(400).json({error:"Choose a valid subscription expiry date"});
    if(value)db.prepare("INSERT INTO character_subscriptions VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET expires_on=excluded.expires_on").run(c.id,value);
    else db.prepare("DELETE FROM character_subscriptions WHERE character_id=?").run(c.id);
    res.json({expires_on:value||null});
  });
  app.post("/api/characters/:id/group",(req,res)=>{
    const c=ownedCharacter(db,req.session.user_id,req.params.id);
    const parent=ownedCharacter(db,req.session.user_id,req.body.parent_id);
    if(c.id===req.session.main_id && parent.id!==c.id)return res.status(400).json({error:"The login main must remain a main"});
    const parentGroup=db.prepare("SELECT parent_id FROM character_groups WHERE character_id=?").get(parent.id)?.parent_id || req.session.main_id;
    if(parent.id!==c.id && parentGroup!==parent.id)return res.status(400).json({error:"Choose a main character"});
    transaction(db,()=>{
      if(parent.id!==c.id)db.prepare("UPDATE character_groups SET parent_id=? WHERE parent_id=? AND character_id<>?").run(parent.id,c.id,c.id);
      db.prepare("INSERT INTO character_groups VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET parent_id=excluded.parent_id").run(c.id,parent.id);
    });
    res.json({ok:true});
  });
  app.delete("/api/characters/:id", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.params.id);
    if (c.id === req.session.main_id)
      return res.status(400).json({ error: "The main cannot be unlinked" });
    db.prepare("DELETE FROM characters WHERE id=?").run(c.id);
    res.json({ ok: true });
  });
  app.post("/api/characters/:id/sync", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.params.id);
    sync.queue(req.session.user_id, c.id, true);
    res.json({ ok: true });
  });
  app.post("/api/characters/order", (req, res) => {
    const ids = req.body.ids;
    const own = db
      .prepare("SELECT id FROM characters WHERE user_id=?")
      .all(req.session.user_id)
      .map((c) => c.id);
    if (
      !Array.isArray(ids) ||
      ids.length !== own.length ||
      new Set(ids).size !== own.length ||
      ids[0] !== req.session.main_id ||
      ids.some((id) => !own.includes(id))
    )
      return res.status(400).json({
        error: "Provide your complete character order with the main first",
      });
    transaction(db, () =>
      ids.forEach((id, index) =>
        db
          .prepare("UPDATE character_order SET position=? WHERE character_id=?")
          .run(index, id),
      ),
    );
    res.json({ ok: true });
  });
  app.post("/api/sync", (req, res) => {
    sync.queue(req.session.user_id, null, true);
    res.json({ ok: true });
  });
  function snapshot(req, kind) {
    ownedCharacter(db, req.session.user_id, req.params.id);
    const r = db
      .prepare("SELECT * FROM snapshots WHERE character_id=? AND kind=?")
      .get(Number(req.params.id), kind);
    return r
      ? { updated: r.updated, data: JSON.parse(r.data) }
      : { updated: null, data: null };
  }
  app.get("/api/skills/overview", (req,res) => {
    const rows=db.prepare("SELECT c.id,c.name,s.data,s.updated FROM characters c LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='skills' WHERE c.user_id=? ORDER BY (c.id=?) DESC,(SELECT position FROM character_order WHERE character_id=c.id),c.id").all(req.session.user_id,req.session.main_id);
    res.json(rows.map(c=>{const data=c.data?JSON.parse(c.data):null;return {id:c.id,name:c.name,updated:c.updated,total_sp:data?.skills.total_sp ?? null,queue:data?.queue.map(q=>({...q,name:cat.type(q.skill_id)?.name||String(q.skill_id)}))||[]};}));
  });
  app.get("/api/characters/:id/skills", (req, res) => {
    const s = snapshot(req, "skills");
    if (s.data) {
      s.data.skills.skills = s.data.skills.skills.map((r) => ({
        ...r,
        name: cat.type(r.skill_id)?.name || String(r.skill_id),
        group: skillGroups[cat.type(r.skill_id)?.group_id] || "Other",
      }));
      s.data.queue = s.data.queue.map((r) => ({
        ...r,
        name: cat.type(r.skill_id)?.name || String(r.skill_id),
        group: skillGroups[cat.type(r.skill_id)?.group_id] || "Other",
      }));
    }
    res.json(s);
  });
  const piRecipes=()=>cat.piRecipes?.()||[];
  const piSettings=user=>JSON.parse(db.prepare("SELECT data FROM pi_settings WHERE user_id=?").get(user)?.data||"null")||defaultPISettings();
  const pricePI=jitaPricing(db,eve),marketPI=jitaPricing(db,eve,true);
  app.get('/api/mining/refining',async(req,res)=>{
    const saved=db.prepare("SELECT s.data FROM snapshots s JOIN characters c ON c.id=s.character_id WHERE c.user_id=? AND s.kind='mining'").all(req.session.user_id);
    const ids=new Set(saved.flatMap(s=>JSON.parse(s.data).rows.map(r=>r.type_id)));
    const recipes=Object.fromEntries([...ids].filter(id=>miningRecipes[id]).map(id=>[id,miningRecipes[id]]));
    const outputs=[...new Set(Object.values(recipes).flatMap(r=>r.materials.map(m=>m.id)))];
    res.json({recipes,prices:await pricePI(outputs)});
  });
  app.get('/api/pi/market',async(req,res)=>{
    const recipes=piRecipes(),fuelNames=['Coolant','Enriched Uranium','Mechanical Parts','Oxygen','Robotics'];
    const groups=[{name:'Fuel Blocks',description:'PI ingredients used to manufacture fuel blocks.',items:fuelNames.map(name=>({id:cat.named(name),name})).filter(r=>r.id)},...[2,3,4].map(tier=>({name:'P'+tier,items:recipes.filter(r=>r.tier===tier).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>({id:r.id,name:r.name}))}))];
    const quotes=new Map((await marketPI([...new Set(groups.flatMap(g=>g.items.map(r=>r.id)))])).map(q=>[q.id,q]));
    res.json({groups:groups.map(g=>({...g,items:g.items.map(r=>({...r,...quotes.get(r.id)}))}))});
  });
  app.post("/api/pi/settings",(req,res)=>{
    try{
      const settings=validatePISettings(req.body,piRecipes());
      db.prepare("INSERT INTO pi_settings VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data").run(req.session.user_id,JSON.stringify(settings));
      res.json(settings);
    }catch(e){res.status(400).json({error:e.message});}
  });
  app.get("/api/pi/shares",(req,res)=>{
    const owner=req.session.user_id;
    res.json({recipients:db.prepare("SELECT id,name,main_id FROM users WHERE id<>? ORDER BY name COLLATE NOCASE").all(owner),
      pilots:db.prepare("SELECT id,name FROM characters WHERE user_id=? ORDER BY name COLLATE NOCASE").all(owner),
      grants:db.prepare("SELECT s.recipient_id,s.character_id FROM pi_shares s JOIN characters c ON c.id=s.character_id AND c.user_id=s.owner_id WHERE s.owner_id=?").all(owner)});
  });
  app.post("/api/pi/shares",(req,res)=>{
    const owner=req.session.user_id,{recipient_id,character_ids}=req.body;
    if(!Number.isSafeInteger(recipient_id)||recipient_id===owner||!db.prepare("SELECT id FROM users WHERE id=?").get(recipient_id)||!Array.isArray(character_ids)||character_ids.length>1000||character_ids.some(id=>!Number.isSafeInteger(id)))return res.status(400).json({error:"Choose a registered recipient and your pilots."});
    try {
      transaction(db,()=>{
        for(const id of character_ids)ownedCharacter(db,owner,id);
        db.prepare("DELETE FROM pi_shares WHERE owner_id=? AND recipient_id=?").run(owner,recipient_id);
        const add=db.prepare("INSERT INTO pi_shares VALUES(?,?,?)");
        for(const id of new Set(character_ids))add.run(owner,recipient_id,id);
      });
      res.json({ok:true});
    }catch(e){res.status(e.status||400).json({error:e.message});}
  });
  app.get("/api/pi/shared",(req,res)=>{
    const rows=db.prepare("SELECT c.id,c.name,u.name owner_name,s.data,s.updated,g.owner_id FROM pi_shares g JOIN characters c ON c.id=g.character_id AND c.user_id=g.owner_id JOIN users u ON u.id=g.owner_id LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='pi' WHERE g.recipient_id=? ORDER BY u.name COLLATE NOCASE,c.name COLLATE NOCASE").all(req.session.user_id);
    res.json(rows.map(r=>({id:r.id,name:r.name,owner_name:r.owner_name,updated:r.updated||null,data:r.data?piSummary(JSON.parse(r.data),cat):null,settings:{perfect:piSettings(r.owner_id).perfect,critical:piSettings(r.owner_id).critical}})));
  });
  app.get("/api/pi/prices",async(req,res)=>res.json(await pricePI(piSettings(req.session.user_id).targets)));
  app.get("/api/pi/dashboard",(req,res)=>{
    const settings=piSettings(req.session.user_id),recipes=piRecipes(),stock=new Map();
    const rows=db.prepare("SELECT c.id,s.data,s.updated,(SELECT message FROM sync_errors WHERE character_id=c.id AND kind='pi') error FROM characters c LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='pi' WHERE c.user_id=?").all(req.session.user_id);
    for(const row of rows)for(const planet of row.data?piSummary(JSON.parse(row.data),cat):[])for(const store of planet.storage)for(const item of store.contents){
      const current=stock.get(item.type_id)||{type_id:item.type_id,name:item.name,amount:0};
      if(Number.isFinite(item.amount)&&item.amount>0)current.amount+=item.amount;
      stock.set(item.type_id,current);
    }
    res.json({settings,products:recipes.filter(r=>[3,4].includes(r.tier)).sort((a,b)=>a.name.localeCompare(b.name)),...combinedVolumes(combinedProduction([...stock.values()],settings.targets,recipes),id=>cat.type(id)),partial:rows.some(r=>!r.data||r.error),updated:rows.length&&rows.every(r=>r.updated)?Math.min(...rows.map(r=>r.updated)):null});
  });
  app.get("/api/market/keys", async (req,res) => {
    try {
      const id=cat.named("Infomorph Decryption Key");
      const prices=await eve.publicGet("/markets/prices");
      const price=prices.find(p=>p.type_id===id)?.average_price;
      res.json({type_id:id,price:Number.isFinite(price)&&price>0?price:null,source:"EVE market average"});
    } catch {res.json({price:null,source:"EVE market average"});}
  });
  app.get("/api/operations/:kind", (req, res) => {
    if (!["pi", "dens", "industry", "clones", "mining", "wallet-history"].includes(req.params.kind))
      return res.sendStatus(404);
    const chars = db
      .prepare(
        "SELECT id,name FROM characters WHERE user_id=? ORDER BY (id=(SELECT main_id FROM users WHERE id=characters.user_id)) DESC, (SELECT position FROM character_order WHERE character_id=characters.id), id",
      )
      .all(req.session.user_id);
    res.json(
      chars.map((c) => {
        const r = db
          .prepare(
            "SELECT data,updated FROM snapshots WHERE character_id=? AND kind=?",
          )
          .get(c.id, req.params.kind);
        return {
          ...c,
          main: c.id === req.session.main_id,
        parent_id: db.prepare("SELECT parent_id FROM character_groups WHERE character_id=?").get(c.id)?.parent_id || req.session.main_id,
          updated: r?.updated || null,
          error:
            db
              .prepare(
                "SELECT message FROM sync_errors WHERE character_id=? AND kind=?",
              )
              .get(c.id, req.params.kind)?.message || null,
          data: r
            ? req.params.kind === "pi"
              ? piSummary(JSON.parse(r.data), cat)
              : JSON.parse(r.data)
            : null,
        };
      }),
    );
  });
  app.get("/api/assets", (req, res) => {
    const q = String(req.query.q || "").toLowerCase(),
      char = Number(req.query.character || 0),
      location = String(req.query.location || "").toLowerCase(),
      offset = Math.max(0, Number(req.query.offset) || 0);
    const rows = [];
    const sources = [];
    for (const c of db
      .prepare("SELECT id,name FROM characters WHERE user_id=?")
      .all(req.session.user_id)) {
      if (char && char !== c.id) continue;
      const s = db
        .prepare(
          "SELECT data,updated FROM snapshots WHERE character_id=? AND kind='assets'",
        )
        .get(c.id);
      sources.push({ id: c.id, name: c.name, updated: s?.updated || null });
      if (!s) continue;
      const data = JSON.parse(s.data);
      const inventory=data.items.map(item=>({...item,
        name:cat.type(item.type_id)?.name || String(item.type_id),
        location:data.locations[item.root_location_id] || String(item.root_location_id),
        location_type_id:data.locationTypes?.[item.root_location_id] || null,
        character:c.name,character_id:c.id,
      }));
      rows.push(...assetMatches(inventory,q,location));
    }
    const grouped = new Map();
    for (const row of rows) {
      const key = String(row.root_location_id);
      if (!grouped.has(key))
        grouped.set(key, {
          id: key,
          name: row.location,
          type_id: row.location_type_id,
          type_name: row.location_type_id
            ? cat.type(row.location_type_id)?.name || null
            : null,
          items: [],
        });
      const group = grouped.get(key);
      if (!group.type_id && row.location_type_id) {
        group.type_id = row.location_type_id;
        group.type_name = cat.type(row.location_type_id)?.name || null;
      }
      group.items.push(row);
    }
    const locations = [...grouped.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    res.json({
      total: rows.filter(a=>!a.context).length,
      locationCount: locations.length,
      locations: locations.slice(offset, offset + 20),
      items: rows.slice(offset, offset + 100),
      sources,
    });
  });
  app.get("/api/catalog", (req, res) =>
    res.json(
      cat.search(
        String(req.query.q || "").slice(0, 100),
        req.query.skills === "1",
      ),
    ),
  );
  app.get("/api/documents", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT d.id,d.owner,d.kind,d.name,d.shared,d.updated,COALESCE((SELECT tag FROM document_tags WHERE document_id=d.id),'Personal') tag,CASE WHEN d.kind='fitting' THEN d.body END fitting_body,u.name author FROM documents d JOIN users u ON u.id=d.owner WHERE d.owner=? OR d.shared=1 ORDER BY d.updated DESC",
        )
        .all(req.session.user_id)
        .map(({fitting_body,...r}) => {
          let ship=null;
          if(fitting_body) {
            try {
              const header=JSON.parse(fitting_body).trim().match(/^\[([^,]+),/);
              const type=header && cat.type(cat.named(header[1].trim()));
              if(type?.category_id===6) ship={id:type.id,name:type.name};
            } catch { /* Keep older fittings visible if their hull cannot be resolved. */ }
          }
          return {...r,ship,mine:r.owner===req.session.user_id};
        }),
    ),
  );
  function linkedPlan(row,user) {
    const link=db.prepare("SELECT plan_id FROM fitting_plans WHERE user_id=? AND fitting_id=?").get(user,row.id);
    return link ? visibleDocument(db,user,link.plan_id) : null;
  }
  function documentRequirements(row,user) {
    if(row.kind==="plan")return expandPlan(JSON.parse(row.body),cat);
    const plan=linkedPlan(row,user);
    return expandPlan([...parseFitting(JSON.parse(row.body),cat).requirements,...(plan?JSON.parse(plan.body):[])],cat);
  }
  app.post("/api/documents/:id/plan",(req,res)=>{
    const fitting=visibleDocument(db,req.session.user_id,req.params.id);
    if(fitting.kind!=="fitting")return res.status(400).json({error:"Select a fitting"});
    if(req.body.plan){
      const plan=visibleDocument(db,req.session.user_id,req.body.plan);
      if(plan.kind!=="plan")return res.status(400).json({error:"Select a skill plan"});
      db.prepare("INSERT INTO fitting_plans VALUES(?,?,?) ON CONFLICT(user_id,fitting_id) DO UPDATE SET plan_id=excluded.plan_id").run(req.session.user_id,fitting.id,plan.id);
    }else db.prepare("DELETE FROM fitting_plans WHERE user_id=? AND fitting_id=?").run(req.session.user_id,fitting.id);
    res.json({ok:true});
  });
  app.get("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    const readiness = (() => {
      const required = documentRequirements(row,req.session.user_id);
      return db.prepare("SELECT c.id,c.name,s.data,s.updated FROM characters c LEFT JOIN snapshots s ON s.character_id=c.id AND s.kind='skills' WHERE c.user_id=? ORDER BY (c.id=?) DESC,(SELECT position FROM character_order WHERE character_id=c.id),c.id").all(req.session.user_id,req.session.main_id).map(c=>{
        if(!c.data)return {id:c.id,name:c.name,updated:null,ready:null,missing:[]};
        const trained=new Map(JSON.parse(c.data).skills.skills.map(s=>[s.skill_id,s]));
        const missing=required.filter(r=>(trained.get(r.id)?.active_skill_level||0)<r.level).map(r=>({id:r.id,name:cat.type(r.id)?.name||String(r.id),required:r.level,active:trained.get(r.id)?.active_skill_level||0,trained:trained.get(r.id)?.trained_skill_level||0}));
        return {id:c.id,name:c.name,updated:c.updated,ready:missing.length===0,missing};
      });
    })();
    res.json({
      ...row,
      readiness,
      linkedPlan: row.kind === "fitting" ? linkedPlan(row,req.session.user_id)?.id || null : null,
      body:
        row.kind === "plan"
          ? JSON.parse(row.body).map((r) => ({
              ...r,
              name: cat.type(r.id)?.name || String(r.id),
            }))
          : JSON.parse(row.body),
      fitting: row.kind === "fitting" ? fittingView(JSON.parse(row.body),cat) : null,
      mine: row.owner === req.session.user_id,
    });
  });
  function documentTag(value){
    if(value===undefined)return 'Personal';
    if(typeof value!=='string'||!value.trim()||value.trim().length>40)throw Object.assign(Error('Enter a tag of 1–40 characters'),{status:400});
    const clean=value.trim();return ['Personal','Corp','Alliance'].find(t=>t.toLowerCase()===clean.toLowerCase())||clean;
  }
  app.post("/api/documents", (req, res) => {
    const tag=documentTag(req.body.tag);
    const { kind, name, body, shared } = req.body;
    if (
      !["plan", "fitting"].includes(kind) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 150
    )
      return res
        .status(400)
        .json({ error: "Enter a name up to 150 characters" });
    let valid;
    if (kind === "plan") {
      if (!Array.isArray(body) || !body.length || body.length > 500)
        throw Error("Plan must contain up to 500 skills");
      valid = expandPlan(body, cat);
    } else {
      parseFitting(body, cat);
      valid = body;
    }
    const id = random();
    db.prepare("INSERT INTO documents VALUES(?,?,?,?,?,?,?)").run(
      id,
      req.session.user_id,
      kind,
      name.trim(),
      JSON.stringify(valid),
      shared === true ? 1 : 0,
      Date.now(),
    );
    db.prepare("INSERT INTO document_tags VALUES(?,?)").run(id,tag);
    res.json({ id });
  });
  app.put("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    const tag=documentTag(req.body.tag??row.tag);
    const { name, body, shared } = req.body;
    if (typeof name !== "string" || !name.trim() || name.length > 150)
      throw Error("Enter a name up to 150 characters");
    let valid;
    if (row.kind === "plan") {
      if (!Array.isArray(body) || !body.length || body.length > 500)
        throw Error("Plan needs 1–500 skills");
      valid = expandPlan(body, cat);
    } else {
      parseFitting(body, cat);
      valid = body;
    }
    db.prepare(
      "UPDATE documents SET name=?,body=?,shared=?,updated=? WHERE id=?",
    ).run(
      name.trim(),
      JSON.stringify(valid),
      shared === true ? 1 : 0,
      Date.now(),
      row.id,
    );
    db.prepare("INSERT INTO document_tags VALUES(?,?) ON CONFLICT(document_id) DO UPDATE SET tag=excluded.tag").run(row.id,tag);
    res.json({ id: row.id });
  });
  app.patch("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    db.prepare("UPDATE documents SET shared=?,updated=? WHERE id=?").run(
      req.body.shared === true ? 1 : 0,
      Date.now(),
      row.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/documents/:id", (req, res) => {
    const row = visibleDocument(db, req.session.user_id, req.params.id);
    if (row.owner !== req.session.user_id) return res.sendStatus(403);
    db.prepare("DELETE FROM documents WHERE id=?").run(row.id);
    res.json({ ok: true });
  });
  app.post("/api/compare", (req, res) => {
    const c = ownedCharacter(db, req.session.user_id, req.body.character),
      row = visibleDocument(db, req.session.user_id, req.body.document);
    const snap = db
      .prepare(
        "SELECT data,updated FROM snapshots WHERE character_id=? AND kind='skills'",
      )
      .get(c.id);
    if (!snap)
      return res
        .status(409)
        .json({ error: "Sync this character’s skills first" });
    const data = JSON.parse(snap.data),
      body = JSON.parse(row.body),
      entries =
        documentRequirements(row,req.session.user_id);
    res.json({
      ...comparePlan(
        entries,
        data.skills,
        data.queue,
        data.attributes,
        cat,
        req.body.alpha === true,
      ),
      updated: snap.updated,
    });
  });
  app.post("/api/skill-plan/import", (req,res) => {
    try {res.json(importSkillText(req.body.text,cat));}
    catch(error) {res.status(400).json({error:error.message});}
  });
  app.post("/api/ship-plan", (req, res) => {
    const ship = cat.type(req.body.ship);
    if (ship?.category_id !== 6) throw Error("Choose a ship");
    res.json(
      expandPlan(requirements(ship.id, cat), cat).map((r) => ({
        ...r,
        name: cat.type(r.id)?.name || String(r.id),
      })),
    );
  });
  app.use("/api/admin",(req,res,next)=>req.session.main_id===config.owner?next():res.sendStatus(403));
  function adminCharacters() {
    return db.prepare(`SELECT c.id,c.user_id,c.name,c.reconnect,b.minute,b.next_due,j.status AS job,a.attempted,
    (SELECT MAX(updated) FROM snapshots WHERE character_id=c.id) AS updated
    FROM characters c JOIN character_buckets b ON b.character_id=c.id LEFT JOIN jobs j ON j.character_id=c.id LEFT JOIN sync_attempts a ON a.character_id=c.id ORDER BY c.name`).all().map(c=>({...c,errors:db.prepare("SELECT kind,message FROM sync_errors WHERE character_id=?").all(c.id)}));
  }
  app.get("/api/admin/users",(req,res)=>{
    const chars=adminCharacters();
    res.json(db.prepare("SELECT u.id,u.name,u.main_id,l.last_login,COALESCE(a.last_seen,l.last_login) last_online,a.last_seen FROM users u LEFT JOIN user_logins l ON l.user_id=u.id LEFT JOIN user_activity a ON a.user_id=u.id ORDER BY last_online DESC,u.name COLLATE NOCASE").all().map(u=>({...u,characters:chars.filter(c=>c.user_id===u.id)})));
  });
  app.get("/api/admin/esi",(req,res)=>res.json({characters:adminCharacters(),buckets:[0,10,20,30,40,50]}));
  app.get("/api/admin/corporations",(req,res)=>res.json(db.prepare("SELECT corporation_id,name,character_id,character_name,verified,role FROM corporation_connections ORDER BY name").all()));
  app.get('/api/admin/whitelist',(req,res)=>res.json(db.prepare('SELECT * FROM login_whitelist ORDER BY name').all()));
  app.post('/api/admin/whitelist',async(req,res)=>{
    const id=Number(req.body.corporation_id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Enter a valid corporation ID'});
    let data;
    try {data=await eve.publicGet('/corporations/'+id);}catch{return res.status(400).json({error:'Corporation could not be verified with ESI. Check the ID and try again.'});}
    if(typeof data?.name!=='string'||!data.name.trim())return res.status(400).json({error:'ESI did not return a corporation name'});
    db.prepare('INSERT INTO login_whitelist VALUES(?,?) ON CONFLICT(corporation_id) DO UPDATE SET name=excluded.name').run(id,data.name);
    res.json({ok:true});
  });
  app.delete('/api/admin/whitelist/:id',async(req,res)=>{
    const id=Number(req.params.id);
    if(id===await whitelist.corporation(req.session.main_id,true))return res.status(400).json({error:'Your own corporation must stay whitelisted so you can manage access.'});
    db.prepare('DELETE FROM login_whitelist WHERE corporation_id=?').run(id);
    res.json({ok:true});
  });
  app.use(
    express.static(
      new URL("./public", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
      { index: "index.html" },
    ),
  );
  app.use((err, req, res, _next) => {
    const status =
      Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 400;
    const message = String(err.message || "Request failed");
    if (req.path.startsWith("/auth"))
      return res
        .status(status)
        .type("text")
        .send(
          status === 403 || status === 409
            ? message
            : "EVE login could not be completed. Please try again.",
        );
    res.status(status).json({
      error: message.startsWith("SQLITE")
        ? "Request could not be saved"
        : message,
    });
  });
  return { app, db, cat, sync, corp };
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const config = {
    base: process.env.BASE_URL || "http://127.0.0.1:3014",
    data: process.env.DATA_DIR || join(process.cwd(), "data"),
    key: process.env.ENCRYPTION_KEY,
    client: process.env.EVE_CLIENT_ID,
    secret: process.env.EVE_CLIENT_SECRET,
    owner: Number(process.env.OWNER_CHARACTER_ID || 122543287),
    contact: process.env.ESI_CONTACT || "tools.areyouaspy.co.uk",
  };
  const { app, sync, corp } = createApp(config);
  app.listen(Number(process.env.PORT || 3014), "127.0.0.1", () =>
    console.log("Tools listening on " + (process.env.PORT || 3014)),
  );
  sync.schedule();
  corp.schedule();
  setInterval(()=>corp.schedule(),60000).unref();
  setInterval(()=>corp.tick().catch(()=>console.error("Corporation sync failed")),5000).unref();
  setInterval(() => sync.schedule(), 60000).unref();
  setInterval(
    () =>
      sync
        .tick()
        .catch(() =>
          console.error("Background sync failed; queued work will retry"),
        ),
    3000,
  ).unref();
}
