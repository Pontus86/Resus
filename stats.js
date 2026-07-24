/* ---------- Mina resultat: hämtar och ritar historik från HLR, EKG-spelet och Checklistor ---------- */
/* Allt här är rent LÄSANDE mot samma Supabase-tabeller som respektive modul redan skriver
   till (scores, ekg_game_history, checklist_logbook, checklist_ratings, custom_checklists)
   — se sql/membership.sql. Sidan kräver inlogg (annars finns ingen kontobunden historik att
   visa); det är den enda platsen på Resus där inlogg är en förutsättning snarare än ett
   tillägg, eftersom sidans HELA syfte är kontobunden historik. */

function $(id){ return document.getElementById(id); }

/* ---------- Enkel linjegraf, återanvänd för HLR/EKG-trend och CUSUM ---------- */
function drawLineChart(cv, values, opts){
  opts = opts || {};
  const dpr = window.devicePixelRatio || 1;
  const cssW = cv.clientWidth || 600, cssH = cv.clientHeight || 160;
  cv.width = cssW * dpr; cv.height = cssH * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = {l: 34, r: 12, t: 10, b: 8};
  const plotW = cssW - pad.l - pad.r, plotH = cssH - pad.t - pad.b;

  if(!values.length){
    ctx.fillStyle = "#6B6B6B"; ctx.font = "12px Archivo, sans-serif";
    ctx.fillText("Ingen data ännu", pad.l, cssH/2);
    return;
  }
  let yMin = opts.yMin != null ? opts.yMin : Math.min(...values);
  let yMax = opts.yMax != null ? opts.yMax : Math.max(...values);
  if(yMin === yMax){ yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.1;
  yMin -= yPad; yMax += yPad;

  function xAt(i){ return pad.l + (values.length === 1 ? 0.5 : i/(values.length-1)) * plotW; }
  function yAt(v){ return pad.t + (1 - (v - yMin)/(yMax - yMin)) * plotH; }

  ctx.strokeStyle = "#E7E4E3"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t+plotH); ctx.lineTo(pad.l+plotW, pad.t+plotH); ctx.stroke();

  if(opts.baseline != null){
    const by = yAt(opts.baseline);
    ctx.strokeStyle = "#B25A00"; ctx.setLineDash([4,3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, by); ctx.lineTo(pad.l+plotW, by); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = opts.color || "#F44336"; ctx.lineWidth = 2; ctx.beginPath();
  values.forEach((v,i) => { const x=xAt(i), y=yAt(v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.stroke();

  ctx.fillStyle = opts.color || "#F44336";
  values.forEach((v,i) => { const x=xAt(i), y=yAt(v); ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill(); });

  ctx.fillStyle = "#6B6B6B"; ctx.font = "10px Archivo, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [yMax-yPad, (yMin+yMax)/2, yMin+yPad].forEach(v => ctx.fillText(String(Math.round(v)), pad.l-6, yAt(v)));
}

function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE") + " " + d.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});
}
function mmss(sec){
  if(sec == null) return "–";
  const m = Math.floor(sec/60), s = Math.round(sec%60);
  return m + ":" + String(s).padStart(2,"0");
}
function esc(s){ return (s||"").replace(/</g,"&lt;"); }

/* ---------- HLR ---------- */
async function loadHlr(user){
  const { data, error } = await Auth.client.from("scores")
    .select("name,score,max_score,pct,cause,level,rosc,duration_s,created_at")
    .eq("user_id", user.id).order("created_at", {ascending:false}).limit(200);
  if(error){ console.error("scores: kunde inte hämta", error); return; }
  const rows = data || [];
  const roscCount = rows.filter(r => r.rosc).length;
  const avgPct = rows.length ? Math.round(rows.reduce((s,r)=>s+r.pct,0)/rows.length) : 0;
  $("hlrSummary").innerHTML = rows.length ? `
    <div class="stat"><b>${rows.length}</b><span>Genomförda scenarion</span></div>
    <div class="stat"><b>${avgPct}%</b><span>Snittresultat</span></div>
    <div class="stat"><b>${roscCount}/${rows.length}</b><span>ROSC uppnått</span></div>` : "";
  drawLineChart($("hlrChart"), [...rows].reverse().map(r => r.pct), {yMin:0, yMax:100, color:"#F44336"});
  $("hlrTable").innerHTML = rows.length ? [
    `<div class="row head"><span>Datum</span><span>Resultat</span><span>Läge</span><span>Orsak</span><span>Tid</span><span>ROSC</span></div>`,
    ...rows.slice(0,50).map(r => `<div class="row">
      <span>${fmtDate(r.created_at)}</span>
      <span>${r.score}/${r.max_score} (${r.pct}%)</span>
      <span>${esc(r.level)}</span>
      <span>${esc(r.cause)}</span>
      <span>${mmss(r.duration_s)}</span>
      <span>${r.rosc ? '<span class="ok-flag">✓</span>' : "–"}</span>
    </div>`)
  ].join("") : `<div class="empty">Inga HLR-scenarion loggade ännu.</div>`;
}

/* ---------- EKG-spel ---------- */
async function loadEkgGame(user){
  const rows = await GameHistoryStore.fetchServerHistory(200) || [];
  const avgMatch = rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r.match_pct),0)/rows.length) : 0;
  const bestLevel = rows.length ? Math.max(...rows.map(r=>r.level)) : 0;
  $("ekgSummary").innerHTML = rows.length ? `
    <div class="stat"><b>${rows.length}</b><span>Spelade rundor</span></div>
    <div class="stat"><b>${avgMatch}%</b><span>Snittträffsäkerhet</span></div>
    <div class="stat"><b>${bestLevel}</b><span>Högsta nivå</span></div>` : "";
  drawLineChart($("ekgChart"), [...rows].reverse().map(r => Number(r.match_pct)), {yMin:0, yMax:100, color:"#2196F3"});
  $("ekgTable").innerHTML = rows.length ? [
    `<div class="row head"><span>Datum</span><span>Nivå</span><span>Träff</span><span>Poäng</span><span>Facit</span></div>`,
    ...rows.slice(0,50).map(r => `<div class="row">
      <span>${fmtDate(r.created_at)}</span>
      <span>${r.level} (${r.condition_count} tillstånd)</span>
      <span>${Math.round(r.match_pct)}%${r.perfect?" · perfekt":""}</span>
      <span>${r.round_score} p</span>
      <span>${esc(r.target_labels)}</span>
    </div>`)
  ].join("") : `<div class="empty">Inga EKG-spelrundor loggade ännu.</div>`;
}

/* ---------- Checklistor ---------- */
const CUSUM_P0 = 0.2, CUSUM_P1 = 0.4;
const CUSUM_W_FAIL = Math.log(CUSUM_P1/CUSUM_P0);
const CUSUM_W_OK = Math.log((1-CUSUM_P1)/(1-CUSUM_P0));
function computeCusum(chronoEntries){
  let s = 0;
  return chronoEntries.map(e => { s += e.success ? CUSUM_W_OK : CUSUM_W_FAIL; return s; });
}

let logbookRows = [];
function renderCusum(){
  const filter = $("cusumFilter").value;
  const withOutcome = logbookRows.filter(r => r.success !== null && r.success !== undefined);
  const filtered = filter === "__all__" ? withOutcome : withOutcome.filter(r => (r.checklist_name || r.checklist_id) === filter);
  const chrono = [...filtered].reverse(); // logbookRows är nyast->äldst, CUSUM behöver äldst->nyast
  drawLineChart($("cusumChart"), computeCusum(chrono), {baseline: 0, color:"#C5362B"});
}

async function loadChecklists(user){
  const [logRows, custom, starred] = await Promise.all([
    LogStore.fetchServerHistory(1000),
    Auth.client.from("custom_checklists").select("id,name,created_at").eq("owner_id", user.id).order("created_at",{ascending:false}).then(r => r.data || []),
    RatingStore.fetchStarred()
  ]);
  logbookRows = logRows || [];

  $("checklistSummary").innerHTML = `
    <div class="stat"><b>${logbookRows.length}</b><span>Loggade genomföranden</span></div>
    <div class="stat"><b>${custom.length}</b><span>Egna checklistor</span></div>
    <div class="stat"><b>${(starred||[]).length}</b><span>Stjärnmärkta</span></div>`;

  $("myChecklists").innerHTML = custom.length
    ? custom.map(c => `<span class="stats-chip">${esc(c.name)}</span>`).join("")
    : `<span class="empty">Du har inte skapat några egna checklistor ännu.</span>`;

  $("starredChecklists").innerHTML = (starred && starred.length)
    ? starred.map(s => `<span class="stats-chip star">★ ${esc(s.checklist_name || s.checklist_id)}</span>`).join("")
    : `<span class="empty">Inga stjärnmärkta checklistor ännu.</span>`;

  const counts = {};
  logbookRows.forEach(r => {
    const key = r.checklist_name || r.checklist_id;
    counts[key] = (counts[key]||0) + 1;
  });
  const countEntries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  $("checklistCounts").innerHTML = countEntries.length
    ? countEntries.map(([name,n]) => `<span class="stats-chip">${esc(name)} <b>×${n}</b></span>`).join("")
    : `<span class="empty">Inga genomförda checklistor loggade ännu.</span>`;

  const cusumNames = [...new Set(logbookRows.filter(r=>r.success!=null).map(r => r.checklist_name || r.checklist_id))];
  $("cusumFilter").innerHTML = `<option value="__all__">Alla checklistor</option>` +
    cusumNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("cusumFilter").onchange = renderCusum;
  renderCusum();

  $("logbookTable").innerHTML = logbookRows.length ? [
    `<div class="row head"><span>Checklista</span><span>Datum</span><span>Tid</span><span>Utfall</span><span>Detalj</span></div>`,
    ...logbookRows.slice(0,80).map(r => `<div class="row">
      <span>${esc(r.checklist_name || r.checklist_id)}</span>
      <span>${fmtDate(r.created_at)}</span>
      <span>${r.duration_s != null ? mmss(r.duration_s) : "–"}</span>
      <span>${r.success === true ? '<span class="ok-flag">✓ Lyckad</span>' : r.success === false ? '<span class="fail-flag">✗ Misslyckad</span>' : "–"}</span>
      <span>${esc(r.detail)}</span>
    </div>`)
  ].join("") : `<div class="empty">Inga procedurer loggade ännu — logga en i Checklistor efter "Markera som genomförd".</div>`;
}

async function loadAll(){
  await Auth.ready;
  const user = Auth.getUser();
  if(!user){
    $("loggedOutCard").style.display = "block";
    $("statsContent").style.display = "none";
    return;
  }
  $("loggedOutCard").style.display = "none";
  $("statsContent").style.display = "block";
  const summary = $("summaryCard");
  summary.innerHTML = `<h3>Inloggad som ${esc(user.email)}</h3><p class="mini">Statistik samlad från alla Resus-moduler på ditt konto.</p>`;
  await Promise.all([loadHlr(user), loadEkgGame(user), loadChecklists(user)]).catch(e => console.error(e));
}

loadAll();
Auth.onChange(() => loadAll());
