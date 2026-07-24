/* ---------- Checklistor: uppstart och DOM-koppling ---------- */
/* Ingen IIFE här (till skillnad från andra moduler) — custom-editor.js behöver kunna
   anropa renderList() efter att en egen checklista sparats/raderats. */
const listView = document.getElementById("listView");
const workspaceView = document.getElementById("workspaceView");
const procedureList = document.getElementById("procedureList");

let current = null; // aktiv procedurmall
let checkedItems = new Set();
let customProcedures = [];
let customLoadError = false;
let activeTagFilters = new Set(); // tomt = visa alla

function fmtNum(v, unit){ return unit === "mg" ? v.toFixed(1) : Math.round(v).toString(); }
function allProcedures(){ return [...PROCEDURES, ...customProcedures]; }
// Checklistor skapade före inlogget fanns (ownerId null) förblir öppet redigerbara av
// alla, som förut. En checklista med satt ownerId kan bara redigeras av den ägaren.
function canEditCustom(p){
  if(!p.ownerId) return true;
  const user = window.Auth && Auth.getUser();
  return !!user && user.id === p.ownerId;
}

function cardHtml(p, isCustom){
  const rating = RatingStore.get(p.id);
  const tagsHtml = (p.tags||[]).map(t => `<span class="proc-tag">${t}</span>`).join("");
  const inner = `
    <div class="proc-card-info">
      ${isCustom ? `<span class="proc-kicker">Egen checklista</span>` : ""}
      <h2>${p.name}</h2>
      <p>${p.shortDesc}</p>
      ${tagsHtml ? `<div class="proc-tags">${tagsHtml}</div>` : ""}
      <p class="proc-count">Genomförda hittills: <b>${LogStore.countFor(p.id)}</b></p>
      <div class="proc-rating" data-id="${p.id}">
        <button type="button" class="rate-btn up${rating>0?" active":""}" data-rate="1" title="Bra checklista">👍</button>
        <button type="button" class="rate-btn down${rating<0?" active":""}" data-rate="-1" title="Mindre bra">👎</button>
      </div>
      ${isCustom && canEditCustom(p) ? `<div class="custom-actions">
        <button type="button" class="rs-btn" data-action="edit" data-id="${p.id}">Redigera</button>
        <button type="button" class="rs-btn ghost" data-action="delete" data-id="${p.id}">Radera</button>
      </div>` : ""}
    </div>`;
  return isCustom
    ? `<div class="card proc-card custom" data-id="${p.id}" style="background-image:url('${cardArtFor(p.id)}')">${inner}</div>`
    : `<a class="card proc-card" href="#" data-id="${p.id}" style="background-image:url('${cardArtFor(p.id)}')">${inner}</a>`;
}

// Bäst (flest tumme upp, sedan obetygsatt, sämst tumme ner) överst — ordning inom
// samma betyg bevaras (stabil sortering), så listan inte hoppar om slumpmässigt.
function sortByRating(list){
  return list.map((p,i) => ({p,i})).sort((a,b) => {
    const d = RatingStore.get(b.p.id) - RatingStore.get(a.p.id);
    return d !== 0 ? d : a.i - b.i;
  }).map(x => x.p);
}

function renderFilterBar(){
  const bar = document.getElementById("tagFilterBar");
  if(!bar) return;
  bar.innerHTML = CHECKLIST_TAGS.map(t => `<button type="button" class="tag-chip${activeTagFilters.has(t)?" active":""}" data-tag="${t}">${t}</button>`).join("")
    + (activeTagFilters.size ? `<button type="button" class="tag-chip clear" id="tagFilterClear">Rensa filter</button>` : "");
  bar.querySelectorAll(".tag-chip[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tag;
      if(activeTagFilters.has(t)) activeTagFilters.delete(t); else activeTagFilters.add(t);
      renderList();
    });
  });
  const clearBtn = document.getElementById("tagFilterClear");
  if(clearBtn) clearBtn.addEventListener("click", () => { activeTagFilters.clear(); renderList(); });
}

function renderList(){
  renderFilterBar();
  const matchesFilter = p => !activeTagFilters.size || (p.tags||[]).some(t => activeTagFilters.has(t));

  const builtinCards = sortByRating(PROCEDURES.filter(matchesFilter)).map(p => cardHtml(p, false)).join("");
  const customCards = sortByRating(customProcedures.filter(matchesFilter)).map(p => cardHtml(p, true)).join("");

  const customStatus = customLoadError
    ? `<p class="proc-count" style="color:var(--warn)">Kunde inte hämta egna checklistor just nu.</p>`
    : "";

  procedureList.innerHTML = builtinCards + customCards
    || `<p class="muted" style="grid-column:1/-1">Inga checklistor matchar de valda taggarna.</p>`;
  document.getElementById("customStatus").innerHTML = customStatus;

  procedureList.querySelectorAll(".proc-card:not(.custom)").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); openProcedure(el.dataset.id); });
  });
  procedureList.querySelectorAll(".proc-card.custom").forEach(el => {
    el.addEventListener("click", () => openProcedure(el.dataset.id));
  });
  procedureList.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const p = customProcedures.find(x => x.id === btn.dataset.id);
      openEditor(p);
    });
  });
  procedureList.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      if(!confirm("Radera den här checklistan permanent?")) return;
      await CustomStore.remove(btn.dataset.id);
      await loadCustomChecklists();
    });
  });
  procedureList.querySelectorAll(".rate-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation(); e.preventDefault();
      const id = btn.closest(".proc-rating").dataset.id;
      const val = parseInt(btn.dataset.rate, 10);
      const p = allProcedures().find(x => x.id === id);
      RatingStore.set(id, RatingStore.get(id) === val ? 0 : val, p && p.name); // klick igen på samma = nollställ
      renderList();
    });
  });
}

async function loadCustomChecklists(){
  try{
    const rows = await CustomStore.list();
    customProcedures = rows.map(customRowToProcedure);
    customLoadError = false;
  }catch(e){
    customLoadError = true;
  }
  renderList();
}

function openProcedure(id){
  current = allProcedures().find(p => p.id === id);
  checkedItems = new Set();
  listView.classList.remove("active");
  workspaceView.classList.add("active");
  renderWorkspace();
}

function backToList(){
  workspaceView.classList.remove("active");
  listView.classList.add("active");
  renderList();
}

function renderWorkspace(){
  document.getElementById("wsTitle").textContent = current.name;
  document.getElementById("wsDesc").textContent = current.shortDesc;
  document.getElementById("wsCount").textContent = LogStore.countFor(current.id);

  document.getElementById("drugList").innerHTML = current.drugs.map(d => `
    <div class="drug-row">
      <label class="drug-check">
        <input type="checkbox" data-drug="${d.id}">
        <span>${d.name} <span class="muted">(${d.route})</span></span>
      </label>
      <div class="drug-dose" id="dose-${d.id}">—</div>
      <div class="drug-note muted">${d.note || ""}</div>
    </div>
  `).join("");

  document.getElementById("checklistBody").innerHTML = current.checklist.map(group => `
    <div class="checklist-phase">
      <h4>${group.phase}</h4>
      ${group.items.map((t,i) => `
        <label class="check-item">
          <input type="checkbox" data-key="${group.phase}|${i}">
          <span>${t}</span>
        </label>
      `).join("")}
    </div>
  `).join("");

  document.getElementById("noteBox").value = "";
  document.getElementById("doneBanner").style.display = "none";
  wireWorkspaceEvents();
  updateDoses();
}

function updateDoses(){
  const weight = parseFloat(document.getElementById("weightInput").value) || 0;
  current.drugs.forEach(d => {
    const el = document.getElementById(`dose-${d.id}`);
    if(weight <= 0){ el.textContent = "Ange vikt för att beräkna dos"; return; }
    const lo = d.doseLow*weight, hi = d.doseHigh*weight;
    const volLo = lo/d.conc, volHi = hi/d.conc;
    el.textContent = `${fmtNum(lo,d.doseUnit)}–${fmtNum(hi,d.doseUnit)} ${d.doseUnit} (${volLo.toFixed(1)}–${volHi.toFixed(1)} ml vid ${d.conc} ${d.doseUnit}/ml)`;
  });
}

function chosenDrugsForNote(){
  const weight = parseFloat(document.getElementById("weightInput").value) || 0;
  return [...document.querySelectorAll('#drugList input[data-drug]:checked')].map(cb => {
    const d = current.drugs.find(x => x.id === cb.dataset.drug);
    const lo = d.doseLow*weight, hi = d.doseHigh*weight;
    const volLo = lo/d.conc, volHi = hi/d.conc;
    return {
      name: d.name,
      doseText: weight>0 ? `${fmtNum(lo,d.doseUnit)}–${fmtNum(hi,d.doseUnit)} ${d.doseUnit}` : "dos ej beräknad (vikt saknas)",
      volumeText: weight>0 ? `${volLo.toFixed(1)}–${volHi.toFixed(1)} ml` : ""
    };
  });
}

function generateNote(){
  const ctx = {
    weight: document.getElementById("weightInput").value,
    indication: document.getElementById("indicationInput").value,
    complications: document.getElementById("complicationsInput").value,
    chosenDrugs: chosenDrugsForNote(),
    checkedItems
  };
  document.getElementById("noteBox").value = current.buildNote(ctx);
}

// "mm:ss" eller ren minutsiffra -> sekunder. Otolkbart (tomt fält, skräptext) -> null,
// vilket LogStore.updateEntry tolkar som "rör inte fältet".
function parseMmSs(v){
  v = (v||"").trim();
  if(!v) return null;
  const m = v.match(/^(\d+):([0-5]?\d)$/);
  if(m) return Number(m[1])*60 + Number(m[2]);
  if(/^\d+$/.test(v)) return Number(v)*60;
  return null;
}

// Loggningen sker DIREKT vid klick (ingen extra bekräftelseklick, samma engångs-friktion
// som förut) — tid/utfall är uttryckligen VALFRITT ("optional info") och fylls i EFTER,
// direkt i banderollen, utan att behöva öppna proceduren igen.
function renderDoneBanner(localId){
  const banner = document.getElementById("doneBanner");
  const loggedIn = window.Auth && Auth.getUser();
  banner.style.display = "block";
  banner.innerHTML = `
    <div class="rs-tag ok">Loggad — sparad lokalt${loggedIn ? " och till ditt konto" : ""}</div>
    <div class="done-extra">
      <label>Tid: <input type="text" id="logDurationInput" placeholder="mm:ss" inputmode="numeric"></label>
      <div class="done-success-row">
        <button type="button" class="rs-btn ghost small" data-success="1">✓ Lyckades</button>
        <button type="button" class="rs-btn ghost small" data-success="0">✗ Misslyckades</button>
      </div>
      <span class="done-extra-saved" id="doneExtraSaved"></span>
    </div>`;
  function flashSaved(){
    const el = document.getElementById("doneExtraSaved");
    if(!el) return;
    el.textContent = "Sparat ✓";
    setTimeout(() => { if(el) el.textContent = ""; }, 1500);
  }
  banner.querySelector("#logDurationInput").addEventListener("change", e => {
    const sec = parseMmSs(e.target.value);
    if(sec != null){ LogStore.updateEntry(localId, {durationS: sec}); flashSaved(); }
  });
  banner.querySelectorAll("[data-success]").forEach(b => b.addEventListener("click", () => {
    banner.querySelectorAll("[data-success]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    LogStore.updateEntry(localId, {success: b.dataset.success === "1"});
    flashSaved();
  }));
}

function wireWorkspaceEvents(){
  document.getElementById("backBtn").onclick = backToList;
  document.getElementById("weightInput").oninput = updateDoses;
  document.getElementById("genNoteBtn").onclick = generateNote;
  document.getElementById("copyNoteBtn").onclick = () => {
    const box = document.getElementById("noteBox");
    box.select();
    navigator.clipboard?.writeText(box.value).catch(()=>{});
  };
  document.getElementById("doneBtn").onclick = () => {
    generateNote();
    const entry = LogStore.record(current.id, {name: current.name, detail: document.getElementById("indicationInput").value});
    document.getElementById("wsCount").textContent = LogStore.countFor(current.id);
    renderDoneBanner(entry.localId);
  };
  document.querySelectorAll('#checklistBody input[data-key]').forEach(cb => {
    cb.addEventListener("change", () => {
      if(cb.checked) checkedItems.add(cb.dataset.key); else checkedItems.delete(cb.dataset.key);
    });
  });
}

document.getElementById("newChecklistBtn").addEventListener("click", () => openEditor(null));

renderList();
loadCustomChecklists();

// Inloggning (auth.js) → hämta/slå ihop favoritbetyg från servern och rita om listan så
// sorteringen (bäst överst) speglar dem. Utloggad: RatingStore fortsätter fungera rent
// lokalt, ingen skillnad mot innan inlogget fanns.
if(window.Auth){
  Auth.onChange(user => { if(user){ RatingStore.syncFromServer().then(renderList); LogStore.syncFromServer(); } else renderList(); });
}
