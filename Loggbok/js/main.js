/* ---------- Loggbok: snabbloggning, redigerbar historik, deltagartaggning, CSV in/ut ---------- */
/* Delar data helt med Checklistor (samma LogStore/checklist_logbook, se
   Checklistor/js/log-store.js) — en procedur loggad här dyker upp i Checklistors
   "Genomförda hittills"-räknare och tvärtom. Utloggat: fungerar helt lokalt (localStorage),
   utan deltagartaggning (kräver konto + användarnamn, se usernames.js). */
const KNOWN_PROCEDURES = [
  {id:"intubation", name:"Intubation (RSI)"},
  {id:"central-line", name:"Central venkateter (CVK)"},
  {id:"chest-tube", name:"Thoraxdrän"},
  {id:"lumbar-puncture", name:"Lumbalpunktion (LP)"},
  {id:"sedation", name:"Proceduranalgesi/sedering"}
];

let entries = [];      // normaliserade, mina bekräftade/avvisade rader
let pending = [];      // normaliserade rader någon ANNAN taggat mig på, väntar mitt svar
let taggerNames = {};  // user_id -> användarnamn, för pending-listan

function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtDate(ms){ return new Date(ms).toLocaleDateString("sv-SE"); }
function mmss(sec){ const m=Math.floor(sec/60), s=Math.round(sec%60); return m+":"+String(s).padStart(2,"0"); }
function parseMmSs(v){
  v=(v||"").trim();
  if(!v)return null;
  const m=v.match(/^(\d+):([0-5]?\d)$/);
  if(m)return Number(m[1])*60+Number(m[2]);
  if(/^\d+$/.test(v))return Number(v)*60;
  return null;
}
function esc(s){ return (s==null?"":String(s)).replace(/</g,"&lt;"); }
function slugFor(name){ return "custom:"+name.toLowerCase().trim().replace(/[^a-z0-9åäö]+/g,"-").slice(0,40); }
function isLoggedIn(){ return !!(window.Auth && Auth.getUser()); }

function normalizeServerRow(r){
  return {source:"server", id:r.id, localId:null, procedureId:r.checklist_id,
    name:r.checklist_name||r.checklist_id, detail:r.detail, durationS:r.duration_s,
    success:r.success, status:r.status, loggedBy:r.logged_by, ts:new Date(r.created_at).getTime()};
}
function normalizeLocalRow(e){
  return {source:"local", id:e.serverId||null, localId:e.localId, procedureId:e.procedureId,
    name:e.name||e.procedureId, detail:e.detail, durationS:e.durationS, success:e.success,
    status:e.status||"confirmed", loggedBy:null, ts:e.ts};
}

async function refreshLogbook(){
  if(window.Auth)await Auth.ready;
  if(isLoggedIn()){
    const rows=await LogStore.fetchServerHistory(1000)||[];
    const norm=rows.map(normalizeServerRow);
    entries=norm.filter(r=>r.status!=="pending");
    pending=norm.filter(r=>r.status==="pending");
    const taggerIds=[...new Set(pending.map(p=>p.loggedBy))];
    taggerNames=taggerIds.length?await Usernames.lookupByIds(taggerIds):{};
  } else {
    entries=LogStore.allLocal().map(normalizeLocalRow);
    pending=[];
    taggerNames={};
  }
  entries.sort((a,b)=>b.ts-a.ts);
  renderPending();
  renderLogTable();
  loadProcedureNames();
}

/* ---------- Väntar bekräftelse ---------- */
function renderPending(){
  const card=document.getElementById("pendingCard");
  const host=document.getElementById("pendingList");
  if(!pending.length){ card.style.display="none"; return; }
  card.style.display="block";
  host.innerHTML=pending.map(p=>`
    <div class="pending-row">
      <div>
        <b>${esc(p.name)}</b>
        <span class="mini">${fmtDate(p.ts)} · taggad av @${esc(taggerNames[p.loggedBy]||"okänd")}${p.detail?" · "+esc(p.detail):""}</span>
      </div>
      <div class="pending-actions">
        <button type="button" class="rs-btn ghost small" data-accept="${p.id}">✓ Acceptera</button>
        <button type="button" class="rs-btn ghost small" data-decline="${p.id}">✗ Avvisa</button>
      </div>
    </div>`).join("");
  host.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    await LogStore.respondToEntry(Number(b.dataset.accept),true).catch(e=>alert("Kunde inte acceptera: "+(e.message||e)));
    refreshLogbook();
  });
  host.querySelectorAll("[data-decline]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    await LogStore.respondToEntry(Number(b.dataset.decline),false).catch(e=>alert("Kunde inte avvisa: "+(e.message||e)));
    refreshLogbook();
  });
}

/* ---------- Snabblogga ---------- */
function addQuickRow(){
  const div=document.createElement("div");
  div.className="quick-row";
  div.innerHTML=`
    <input type="text" class="qr-proc" list="procedureNames" placeholder="Procedur (valfri text)">
    <input type="date" class="qr-date" value="${todayStr()}">
    <input type="number" class="qr-count" min="1" value="1" title="Antal">
    <input type="text" class="qr-participants" placeholder="Deltagare (användarnamn, kommaseparerat)"${isLoggedIn()?"":" disabled title=\"Logga in för att tagga kollegor\""}>
    <button type="button" class="qr-remove" title="Ta bort rad">×</button>`;
  div.querySelector(".qr-remove").onclick=()=>div.remove();
  document.getElementById("quickRows").appendChild(div);
}

async function logAll(){
  const rows=[...document.querySelectorAll(".quick-row")];
  const status=document.getElementById("quickStatus");
  let created=0, tagged=0; const errors=[];
  for(const row of rows){
    const name=row.querySelector(".qr-proc").value.trim();
    if(!name)continue;
    const date=row.querySelector(".qr-date").value||todayStr();
    const count=Math.max(1,Number(row.querySelector(".qr-count").value)||1);
    const participants=row.querySelector(".qr-participants").value.trim();
    const usernamesList=participants?participants.split(",").map(s=>s.trim()).filter(Boolean):[];
    const known=KNOWN_PROCEDURES.find(p=>p.name===name);
    const procedureId=known?known.id:slugFor(name);
    for(let i=0;i<count;i++){ LogStore.record(procedureId,{name,date}); created++; }
    for(const uname of usernamesList){
      try{ await LogStore.tagParticipant(uname,procedureId,{name,date}); tagged++; }
      catch(e){ errors.push(uname+": "+(e.message||e)); }
    }
  }
  if(!created){ status.textContent="Fyll i minst procedur på en rad."; status.className="mini"; return; }
  status.textContent=`${created} logg${created===1?"":"ar"} tillagda`+(tagged?`, ${tagged} deltagare taggade`:"")+(errors.length?`. Fel: ${errors.join("; ")}`:".");
  status.className="mini"+(errors.length?" err":"");
  document.getElementById("quickRows").innerHTML="";
  addQuickRow();
  // Inserten till servern sker i bakgrunden (LogStore.record väntar inte in svaret) — en
  // kort fördröjning innan omladdning så raderna hunnit få ett server-id, annars kan
  // "Logga allt" följt direkt av en redigering sakna serverId att peka på.
  setTimeout(refreshLogbook,isLoggedIn()?700:0);
}

/* ---------- Redigerbar loggbokstabell ---------- */
function doUpdate(entry,patch){
  if(isLoggedIn()){
    if(!entry.id)return;
    LogStore.updateEntryByServerId(entry.id,patch).catch(e=>alert("Kunde inte spara: "+(e.message||e)));
  } else {
    LogStore.updateEntry(entry.localId,patch);
  }
}
function doDelete(entry){
  if(isLoggedIn()){
    if(entry.id)LogStore.deleteEntryByServerId(entry.id).catch(e=>alert("Kunde inte radera: "+(e.message||e)));
  } else {
    LogStore.deleteEntry(entry.localId);
  }
}
function renderLogTable(){
  const host=document.getElementById("logTable");
  if(!entries.length){ host.innerHTML=`<div class="empty">Inga loggade procedurer ännu — använd snabbloggningen ovan.</div>`; return; }
  const me=isLoggedIn()?Auth.getUser().id:null;
  host.innerHTML=`<div class="row head"><span>Procedur</span><span>Datum</span><span>Tid</span><span>Utfall</span><span>Detalj</span><span></span></div>`+
    entries.map((e,i)=>{
      const successVal=e.success===true?"ok":e.success===false?"fail":"";
      const taggedBadge=(e.loggedBy&&me&&e.loggedBy!==me)?`<span class="tag-badge">taggad</span>`:"";
      return `<div class="row log-row" data-idx="${i}">
        <span class="log-name">${esc(e.name)}${taggedBadge}</span>
        <span><input type="date" class="log-date" value="${new Date(e.ts).toISOString().slice(0,10)}"></span>
        <span><input type="text" class="log-duration" placeholder="mm:ss" value="${e.durationS!=null?mmss(e.durationS):""}"></span>
        <span><select class="log-success">
          <option value=""${successVal===""?" selected":""}>–</option>
          <option value="ok"${successVal==="ok"?" selected":""}>Lyckades</option>
          <option value="fail"${successVal==="fail"?" selected":""}>Misslyckades</option>
        </select></span>
        <span><input type="text" class="log-detail" placeholder="detalj" value="${esc(e.detail)}"></span>
        <span><button type="button" class="log-delete" title="Radera">×</button></span>
      </div>`;
    }).join("");
  host.querySelectorAll(".log-row").forEach(rowEl=>{
    const entry=entries[Number(rowEl.dataset.idx)];
    rowEl.querySelector(".log-date").addEventListener("change",e=>doUpdate(entry,{date:e.target.value}));
    rowEl.querySelector(".log-duration").addEventListener("change",e=>{
      const raw=e.target.value.trim();
      const sec=parseMmSs(raw);
      if(sec!=null||raw==="")doUpdate(entry,{durationS:sec});
    });
    rowEl.querySelector(".log-success").addEventListener("change",e=>{
      const v=e.target.value;
      doUpdate(entry,{success:v==="ok"?true:v==="fail"?false:null});
    });
    rowEl.querySelector(".log-detail").addEventListener("change",e=>doUpdate(entry,{detail:e.target.value}));
    rowEl.querySelector(".log-delete").addEventListener("click",()=>{
      doDelete(entry);
      entries.splice(Number(rowEl.dataset.idx),1);
      renderLogTable();
    });
  });
}

/* ---------- Procedur-autocomplete: kända checklistor + egna + tidigare loggade namn ---------- */
async function loadProcedureNames(){
  const dl=document.getElementById("procedureNames");
  const names=new Set(KNOWN_PROCEDURES.map(p=>p.name));
  entries.forEach(e=>{ if(e.name)names.add(e.name); });
  if(window.Auth){
    try{
      await Auth.ready;
      const {data}=await Auth.client.from("custom_checklists").select("name");
      (data||[]).forEach(r=>r.name&&names.add(r.name));
    }catch(e){}
  }
  dl.innerHTML=[...names].sort().map(n=>`<option value="${esc(n)}">`).join("");
}

/* ---------- CSV-export ---------- */
function csvEscape(v){
  v=v==null?"":String(v);
  return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
}
function exportCsv(){
  const header=["Procedur","Datum","Tid (sekunder)","Utfall","Detalj"];
  const rows=entries.map(e=>[
    e.name, new Date(e.ts).toISOString().slice(0,10), e.durationS!=null?e.durationS:"",
    e.success===true?"Lyckades":e.success===false?"Misslyckades":"", e.detail||""
  ]);
  const csv=[header,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
  // BOM (﻿) i förkant: annars gissar Excel fel teckenkodning och å/ä/ö blir fel.
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="loggbok-"+todayStr()+".csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

/* ---------- CSV-import ---------- */
function parseCsv(text){
  const rows=[]; let row=[], field="", inQuotes=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQuotes=false; }
      else field+=c;
    } else if(c==='"'){ inQuotes=true; }
    else if(c===","){ row.push(field); field=""; }
    else if(c==="\n"||c==="\r"){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(field); field=""; rows.push(row); row=[];
    } else field+=c;
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  return rows.filter(r=>r.length>1||r[0]!=="");
}
function importCsv(file){
  const status=document.getElementById("importStatus");
  const reader=new FileReader();
  reader.onload=()=>{
    const text=String(reader.result).replace(/^﻿/,"");
    const rows=parseCsv(text);
    if(!rows.length){ status.textContent="Tom fil."; return; }
    const header=rows[0].map(h=>h.trim().toLowerCase());
    const idx={
      name: header.findIndex(h=>/procedur|checklist/.test(h)),
      date: header.findIndex(h=>/datum|date/.test(h)),
      duration: header.findIndex(h=>/tid|duration/.test(h)),
      success: header.findIndex(h=>/utfall|success|resultat/.test(h)),
      detail: header.findIndex(h=>/detalj|detail|kommentar/.test(h))
    };
    if(idx.name<0||idx.date<0){ status.textContent="Kunde inte hitta kolumnerna Procedur/Datum i filen."; return; }
    let ok=0, skipped=0;
    for(const r of rows.slice(1)){
      const name=(r[idx.name]||"").trim();
      const dateRaw=(r[idx.date]||"").trim();
      if(!name||!dateRaw){ skipped++; continue; }
      const date=new Date(dateRaw);
      if(isNaN(date.getTime())){ skipped++; continue; }
      const durRaw=idx.duration>=0?(r[idx.duration]||"").trim():"";
      const durationS=durRaw?(/^\d+$/.test(durRaw)?Number(durRaw):parseMmSs(durRaw)):null;
      const succRaw=idx.success>=0?(r[idx.success]||"").trim().toLowerCase():"";
      const success=/lyckad|success|^ok$|✓|sant|true/.test(succRaw)?true
        :/misslyck|fail|✗|falskt|false/.test(succRaw)?false:null;
      const detail=idx.detail>=0?(r[idx.detail]||"").trim():"";
      const known=KNOWN_PROCEDURES.find(p=>p.name===name);
      const procedureId=known?known.id:slugFor(name);
      LogStore.record(procedureId,{name,date:date.toISOString(),durationS,success,detail});
      ok++;
    }
    status.textContent=`${ok} rader importerade`+(skipped?`, ${skipped} rader hoppades över (saknade procedur/datum eller ogiltigt datum).`:".");
    setTimeout(refreshLogbook,isLoggedIn()?800:0);
  };
  reader.readAsText(file,"utf-8");
}

document.getElementById("addRowBtn").onclick=addQuickRow;
document.getElementById("logAllBtn").onclick=logAll;
document.getElementById("exportCsvBtn").onclick=exportCsv;
document.getElementById("importCsvInput").addEventListener("change",e=>{
  const file=e.target.files[0];
  if(file)importCsv(file);
  e.target.value="";
});

addQuickRow();
refreshLogbook();
if(window.Auth)Auth.onChange(()=>refreshLogbook());
