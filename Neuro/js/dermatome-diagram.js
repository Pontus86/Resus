/* ---------- Dermatom/myotom-kroppsdiagram: rendering och interaktion ---------- */
const FIELD_LABELS = {sensL:"Känsel V", sensR:"Känsel H", motL:"Motorik V", motR:"Motorik H"};
const DermatomeState = {sensL:"normal", sensR:"normal", motL:"normal", motR:"normal"};
let activeField = "sensR";
let reflexHighlightLevels = [];

function impliedSide(field){ return field.endsWith("L") ? "L" : "R"; }

function polyPoints(pts){ return pts.map(p => p.join(",")).join(" "); }
function centroid(pts){
  const x = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const y = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  return [x,y];
}

function renderDermatomeBody(){
  const svg = document.getElementById("dermRegions");
  const regions = buildAllBodyRegions();
  svg.innerHTML = regions.map(r => {
    const [cx,cy] = centroid(r.pts);
    const showLabel = LANDMARK_LABELS.includes(r.level);
    return `
      <g class="derm-region-group" data-level="${r.level}" data-side="${r.side ?? ""}">
        <polygon points="${polyPoints(r.pts)}" class="derm-region">
          <title>${r.level.replace("_","-")}${r.side ? (r.side==="L"?" vänster":" höger") : ""}</title>
        </polygon>
        ${showLabel ? `<text x="${cx}" y="${cy}" class="derm-landmark-label">${r.level.replace("_","-")}</text>` : ""}
      </g>
    `;
  }).join("");

  svg.querySelectorAll(".derm-region-group").forEach(g => {
    g.addEventListener("click", () => {
      const side = g.dataset.side || null;
      if(side !== null && side !== impliedSide(activeField)) return;
      DermatomeState[activeField] = g.dataset.level;
      updateDermatomeView();
    });
  });
}

function updateDermatomeView(){
  const side = impliedSide(activeField);
  const svg = document.getElementById("dermRegions");
  svg.querySelectorAll(".derm-region-group").forEach(g => {
    const gSide = g.dataset.side || null;
    const eligible = gSide === null || gSide === side;
    g.classList.toggle("ineligible", !eligible);
    const isSelected = eligible && g.dataset.level === DermatomeState[activeField];
    g.classList.toggle("selected", isSelected);
    g.classList.toggle("reflex-highlight", reflexHighlightLevels.includes(g.dataset.level) && (gSide === null || gSide === side));
  });

  document.querySelectorAll(".field-pill").forEach(b => b.classList.toggle("active", b.dataset.field === activeField));

  const fmt = v => v === "normal" ? "Normal" : SPINAL_LEVEL_LABEL(v);
  document.getElementById("dermStatus").innerHTML =
    (["sensL","sensR","motL","motR"]).map(f =>
      `<span class="${f===activeField?"current":""}">${FIELD_LABELS[f]}: <b>${fmt(DermatomeState[f])}</b></span>`
    ).join(" · ");
}

function setActiveField(field){
  activeField = field;
  reflexHighlightLevels = [];
  updateDermatomeView();
}

function getDermatomeValues(){
  return {sensR:DermatomeState.sensR, sensL:DermatomeState.sensL, motR:DermatomeState.motR, motL:DermatomeState.motL};
}

function initDermatomeDiagram(){
  renderDermatomeBody();

  document.querySelectorAll(".field-pill").forEach(btn => {
    btn.addEventListener("click", () => setActiveField(btn.dataset.field));
  });
  document.getElementById("dermNormalBtn").addEventListener("click", () => {
    DermatomeState[activeField] = "normal";
    updateDermatomeView();
  });

  const reflexList = document.getElementById("reflexList");
  const REFLEX_GROUPS = [
    {type:"spinal", heading:"Spinala reflexer"},
    {type:"cranial", heading:"Hjärnstams-/kranialnervsreflexer"},
    {type:"primitive", heading:"Primitiva reflexer / frontallobs-tecken"}
  ];
  const reflexBadge = r => {
    if(r.type === "spinal") return `<span class="reflex-levels">${r.levels.map(l=>SPINAL_LEVEL_LABEL(l)).join(", ")}</span>`;
    if(r.type === "cranial") return `<span class="reflex-levels reflex-nerves">${r.nerves.aff} → ${r.nerves.eff}</span>`;
    return `<span class="reflex-levels reflex-tag">${r.tag}</span>`;
  };
  reflexList.innerHTML = REFLEX_GROUPS.map(group => {
    const items = REFLEXES.filter(r => r.type === group.type);
    if(!items.length) return "";
    return `
      <h4 class="reflex-group-heading">${group.heading}</h4>
      ${items.map(r => `
        <button type="button" class="reflex-item" data-id="${r.id}">
          <span class="reflex-name">${r.name}</span>
          ${reflexBadge(r)}
        </button>
      `).join("")}
    `;
  }).join("");
  reflexList.querySelectorAll(".reflex-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = REFLEXES.find(x => x.id === btn.dataset.id);
      reflexHighlightLevels = r.type === "spinal" ? r.levels : [];
      document.getElementById("reflexDesc").textContent = r.desc;
      reflexList.querySelectorAll(".reflex-item").forEach(b => b.classList.toggle("active", b === btn));
      updateDermatomeView();
    });
  });

  updateDermatomeView();
}
