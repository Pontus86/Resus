/* ---------- Ryggmärgens tvärsnitt: geometri och rendering ---------- */
/* Vinklar: 0°=höger(kl.3), 90°=fram/anteriort(kl.6), 180°=vänster(kl.9), 270°=bak/posteriort(kl.12) —
   dvs medurs precis som en klocka sedd framifrån. Regionerna är förenklade sektorer, inte
   anatomiskt exakta traktgränser. */
const CORD_CX = 110, CORD_CY = 110, CORD_R = 92;
const CORD_REGIONS = [
  {id:"dorsalR",        a0:270, a1:305, rIn:44, rOut:86},
  {id:"dorsalL",        a0:235, a1:270, rIn:44, rOut:86},
  {id:"corticospinalR", a0:305, a1:350, rIn:44, rOut:86},
  {id:"corticospinalL", a0:190, a1:235, rIn:44, rOut:86},
  {id:"spinothalamicR", a0:350, a1:450, rIn:44, rOut:86},
  {id:"spinothalamicL", a0:90,  a1:190, rIn:44, rOut:86}
];

function polarXY(cx,cy,r,angleDeg){
  const a = angleDeg * Math.PI/180;
  return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
}
function wedgePath(cx,cy,rIn,rOut,a0,a1){
  const large = (a1-a0) > 180 ? 1 : 0;
  const [x0,y0] = polarXY(cx,cy,rOut,a0);
  const [x1,y1] = polarXY(cx,cy,rOut,a1);
  const [x2,y2] = polarXY(cx,cy,rIn,a1);
  const [x3,y3] = polarXY(cx,cy,rIn,a0);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${rOut},${rOut} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} `+
         `L${x2.toFixed(1)},${y2.toFixed(1)} A${rIn},${rIn} 0 ${large} 0 ${x3.toFixed(1)},${y3.toFixed(1)} Z`;
}

function renderCordDiagram(){
  const svg = document.getElementById("cordRegions");
  svg.innerHTML = CORD_REGIONS.map(r =>
    `<path d="${wedgePath(CORD_CX,CORD_CY,r.rIn,r.rOut,r.a0,r.a1)}" class="cord-region" data-id="${r.id}"/>`
  ).join("");
}

function applySyndrome(id){
  const syn = CORD_SYNDROMES.find(s => s.id === id);
  document.querySelectorAll(".cord-region").forEach(el => {
    el.classList.toggle("affected", syn.affected.includes(el.dataset.id));
  });
  document.getElementById("cordCentralCore").classList.toggle("affected", syn.affected.includes("centralCore"));
  document.querySelectorAll(".syndrome-pill").forEach(b => b.classList.toggle("active", b.dataset.id === id));
  document.getElementById("cordSyndromeName").textContent = syn.name;
  document.getElementById("cordSyndromeDesc").textContent = syn.desc;
}

function initCordDiagram(){
  renderCordDiagram();
  const pillWrap = document.getElementById("syndromePills");
  pillWrap.innerHTML = CORD_SYNDROMES.map(s =>
    `<button type="button" class="syndrome-pill" data-id="${s.id}">${s.name}</button>`
  ).join("");
  pillWrap.querySelectorAll(".syndrome-pill").forEach(btn => {
    btn.addEventListener("click", () => applySyndrome(btn.dataset.id));
  });
  applySyndrome("complete");
}
