/* ---------- Topplista (Supabase) & historik (lokal +, om inloggad, per konto) ---------- */
/* Använder Auth.client (auth.js) i stället för en hand-rullad fetch med bara anon-nyckeln
   — annars bär förfrågan ingen sessionstoken, och den nya "din historik"-funktionen (som
   filtrerar scores på inloggad användares user_id) skulle inte fungera. Topplistan är
   fortsatt helt öppen (alla ser alla resultat), submitScore taggar bara MED user_id när
   man råkar vara inloggad — helt valfritt, anonymt spel funkar precis som förut. */
function submitScore(entry){
  const user = window.Auth && Auth.getUser();
  const row = Object.assign({user_id: user ? user.id : null}, entry);
  return Auth.ready.then(() => Auth.client.from("scores").insert(row))
    .then(({error}) => { if(error) throw error; return true; });
}
function fetchLeaderboard(limit){
  const n = limit || 20;
  return Auth.ready.then(() => Auth.client.from("scores")
    .select("name,score,max_score,pct,cause,level,rosc,duration_s,created_at")
    .order("score", {ascending:false}).limit(n))
    .then(({data, error}) => { if(error) throw error; return data; });
}
// "Din historik", per konto: samma tabell, filtrerad på inloggad användares user_id.
// null om inte inloggad — renderLbBody() faller då tillbaka till den lokala historiken.
function fetchMyHistory(limit){
  const n = limit || 100;
  return Auth.ready.then(() => {
    const user = Auth.getUser();
    if(!user) return null;
    return Auth.client.from("scores")
      .select("name,score,max_score,pct,cause,level,rosc,duration_s,created_at")
      .eq("user_id", user.id).order("created_at", {ascending:false}).limit(n)
      .then(({data, error}) => { if(error) throw error; return data; });
  });
}
const LB_MODE_NAMES = {guided:"Guidad", normal:"Normal", advanced:"Avancerad", expert:"Expert", hardcore:"Hardcore"};

/* ---------- lokal historik (per enhet, ingen server) ---------- */
const LOCAL_HISTORY_KEY = "ahlrHistory";
const LOCAL_NAME_KEY = "ahlrPlayerName";
function getLocalHistory(){
  try{ return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY)) || []; }catch(e){ return []; }
}
function saveLocalHistory(entry){
  const hist = getLocalHistory();
  hist.unshift(entry);
  while(hist.length > 100) hist.pop();
  try{ localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(hist)); }catch(e){}
}
function getSavedName(){ try{ return localStorage.getItem(LOCAL_NAME_KEY) || ""; }catch(e){ return ""; } }
function saveName(name){ try{ localStorage.setItem(LOCAL_NAME_KEY, name); }catch(e){} }

/* ---------- UI: modal med Topplista + Din historik ---------- */
let lbTab = "top";
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE") + " " + d.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});
}
function lbRow(r, rank){
  const modeName = LB_MODE_NAMES[r.level] || r.level || "";
  const timeTxt = r.duration_s!=null ? mmss(r.duration_s) : "–";
  const rankCls = rank===1?" r1":rank===2?" r2":rank===3?" r3":"";
  return `<div class="lb-row">
    <div class="lb-row-top">
      ${rank?`<span class="lb-rank${rankCls}">${rank}</span>`:""}
      <span class="lb-name">${(r.name||"").replace(/</g,"&lt;")}</span>
      ${r.rosc?`<span class="lb-rosc">★ ROSC</span>`:""}
      <span class="lb-score">${r.score}<small> / ${r.max_score} p</small></span>
    </div>
    <div class="lb-row-details">
      <span class="lb-chip">${r.pct}%</span>
      <span class="lb-chip">${modeName}</span>
      <span class="lb-chip">⏱ ${timeTxt}</span>
      <span class="lb-chip">${(r.cause||"").replace(/</g,"&lt;")}</span>
    </div>
    <div class="lb-row-date">${fmtDate(r.created_at)}</div>
  </div>`;
}

/* ---------- Startskärm: visa nuvarande etta på topplistan ---------- */
function renderTopChampion(){
  const host = $("topChampion");
  if(!host) return;
  fetchLeaderboard(1).then(rows => {
    if(!rows.length){ host.innerHTML = ""; return; }
    const r = rows[0];
    const modeName = LB_MODE_NAMES[r.level] || r.level || "";
    const timeTxt = r.duration_s!=null ? mmss(r.duration_s) : "–";
    host.innerHTML = `<div class="top-champion">
      <span class="tc-label">🏆 Nuvarande etta</span>
      <b>${(r.name||"").replace(/</g,"&lt;")}</b>
      <span class="mini">${r.score} / ${r.max_score} p (${r.pct}%) · ${modeName} · HLR-tid ${timeTxt}</span>
    </div>`;
  }).catch(() => { host.innerHTML = ""; });
}
function renderLbBody(){
  const host = $("lbBody");
  if(!host) return;
  if(lbTab === "top"){
    host.innerHTML = `<p class="mini">Hämtar topplistan…</p>`;
    fetchLeaderboard(30).then(rows=>{
      if(!rows.length){ host.innerHTML = `<p class="mini">Ingen har spelat än, bli först!</p>`; return; }
      host.innerHTML = rows.map((r,i)=>lbRow(r,i+1)).join("");
    }).catch(()=>{
      host.innerHTML = `<p class="mini" style="color:var(--red)">Kunde inte hämta topplistan, kontrollera internetanslutningen.</p>`;
    });
  } else {
    host.innerHTML = `<p class="mini">Hämtar din historik…</p>`;
    fetchMyHistory(100).then(serverHist => {
      // Inloggad: historik från kontot (följer med mellan enheter). Utloggad: samma
      // lokala historik som innan inlogget fanns, ingen skillnad i beteende.
      const hist = serverHist !== null ? serverHist : getLocalHistory();
      if(!hist.length){ host.innerHTML = `<p class="mini">Ingen historik ännu, spela en omgång!</p>`; return; }
      host.innerHTML = hist.map(r=>lbRow(r,null)).join("");
    }).catch(() => {
      const hist = getLocalHistory();
      if(!hist.length){ host.innerHTML = `<p class="mini">Ingen historik ännu, spela en omgång!</p>`; return; }
      host.innerHTML = hist.map(r=>lbRow(r,null)).join("");
    });
  }
}
function openLeaderboard(){
  $("lbOverlay").classList.remove("hidden");
  $("lbTabTop").classList.toggle("sel", lbTab==="top");
  $("lbTabHist").classList.toggle("sel", lbTab==="hist");
  renderLbBody();
}
function closeLeaderboard(){ $("lbOverlay").classList.add("hidden"); }
