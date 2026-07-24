/* ---------- Reflexbågar: UI-koppling ----------
   Samma mönster som tracts.js, men utan 2D-SVG-diagram -- ingen befintlig sådan att
   återanvända (till skillnad från Nervbanor), och att bygga en ny hade varit onödig,
   obeställd omfattning. Klinisk text kommer direkt från REFLEXES (reflex-data.js). */
let reflexBuilt = false, reflexSelected = "biceps";

// Samma badge-logik som dermatome-diagram.js:90-94 (lokal där, inte global) -- egen kopia
// här är enklare än att exportera/dela en global för en tre-rads funktion, och Reflexer-
// urvalet (REFLEX3D_IDS) innehåller aldrig "primitive"-typen ändå.
function _reflex3dBadge(r){
  if(r.type === "spinal") return `<span class="reflex-levels">${r.levels.map(l=>SPINAL_LEVEL_LABEL(l)).join(", ")}</span>`;
  return `<span class="reflex-levels reflex-nerves">${r.nerves.aff} → ${r.nerves.eff}</span>`;
}

function updateBrain3DForReflex(){
  if(typeof updateBrain3D !== "function") return;
  const meta = REFLEX3D_ANATOMY[reflexSelected];
  const note = document.getElementById("reflex3dNote");
  if(note) note.hidden = !(meta && meta.schematic);
  updateBrain3D(null);
  if(typeof renderBrain3DReflexArc === "function") renderBrain3DReflexArc(reflexSelected);
}

function renderReflexInfo(){
  const r = REFLEXES.find(x => x.id === reflexSelected);
  document.getElementById("reflexInfo").innerHTML = `
    <h4>${r.name}</h4>
    <p>${_reflex3dBadge(r)}</p>
    <p class="tracts-other">${r.desc}</p>`;
  updateBrain3DForReflex();
}

function renderReflexSwitch(){
  const host = document.getElementById("reflexSwitch");
  host.innerHTML = REFLEXES.filter(r => REFLEX3D_IDS.includes(r.id)).map(r =>
    `<button type="button" class="${r.id===reflexSelected?"active":""}" data-key="${r.id}">${r.name}</button>`
  ).join("");
  host.querySelectorAll("button").forEach(b => b.addEventListener("click", ()=>{
    reflexSelected = b.dataset.key;
    host.querySelectorAll("button").forEach(x=>x.classList.toggle("active", x===b));
    renderReflexInfo();
  }));
}

function initReflex3D(){
  if(reflexBuilt) return;
  reflexBuilt = true;
  renderReflexSwitch();
  renderReflexInfo();
}
