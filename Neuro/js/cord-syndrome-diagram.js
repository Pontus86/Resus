/* ---------- Ryggmärgens tvärsnitt: nivåprofil, bansystem och lesionsöverlägg ---------- */
const CORD_TRACTS = [
  {id:"dorsalL", label:"Baksträng V", path:"M157 42 C135 42 113 49 99 61 L130 96 C140 89 150 86 157 87 Z"},
  {id:"dorsalR", label:"Baksträng H", path:"M163 42 C185 42 207 49 221 61 L190 96 C180 89 170 86 163 87 Z"},
  {id:"corticospinalL", label:"Kortikospinal V", path:"M99 61 C77 76 67 101 70 132 L112 126 C112 106 119 91 130 80 Z"},
  {id:"corticospinalR", label:"Kortikospinal H", path:"M221 61 C243 76 253 101 250 132 L208 126 C208 106 201 91 190 80 Z"},
  {id:"spinothalamicL", label:"Spinothalamisk V", path:"M70 139 C75 177 100 205 136 215 L143 169 C129 159 119 145 114 130 Z"},
  {id:"spinothalamicR", label:"Spinothalamisk H", path:"M250 139 C245 177 220 205 184 215 L177 169 C191 159 201 145 206 130 Z"}
];

const CORD_LESIONS = {
  complete:"M45 20 H275 V238 H45 Z",
  central:"M160 92 C130 92 114 111 116 137 C118 161 136 174 160 174 C184 174 202 161 204 137 C206 111 190 92 160 92 Z",
  leftHalf:"M42 20 H160 V240 H42 Z",
  anterior:"M49 116 C58 190 101 231 160 234 C219 231 262 190 271 116 C239 137 207 149 160 151 C113 149 81 137 49 116 Z",
  posterior:"M84 27 C105 50 127 68 160 95 C193 68 215 50 236 27 Z"
};

function renderCordTracts(){
  const svg = document.getElementById("cordRegions");
  svg.innerHTML = CORD_TRACTS.map(tract=>
    `<path d="${tract.path}" class="cord-region cord-${tract.id.replace(/[LR]$/,"").toLowerCase()}" data-id="${tract.id}"><title>${tract.label}</title></path>`
  ).join("");
}

function updateCordLevel(level){
  const group = level.startsWith("C") ? "cervical" : level.startsWith("T") ? "thoracic" : level.startsWith("L") ? "lumbar" : "sacral";
  const profile = CORD_LEVEL_PROFILES[group];
  document.getElementById("cordOutlineShape").setAttribute("d",profile.outer);
  document.getElementById("cordGrayMatter").setAttribute("d",profile.gray);
  setHraSpinalLevel(level);
}

function applySyndrome(id){
  const syndrome = CORD_SYNDROMES.find(item=>item.id === id);
  document.querySelectorAll(".cord-region").forEach(element=>{
    element.classList.toggle("affected",syndrome.affected.includes(element.dataset.id));
  });
  document.getElementById("cordCentralCore").classList.toggle("affected",syndrome.affected.includes("centralCore"));
  const lesion = document.getElementById("cordLesion");
  lesion.setAttribute("d",CORD_LESIONS[syndrome.lesion]);
  document.querySelectorAll(".syndrome-pill").forEach(button=>button.classList.toggle("active",button.dataset.id === id));
  document.getElementById("cordSyndromeName").textContent = syndrome.name;
  document.getElementById("cordSyndromeDesc").textContent = syndrome.desc;
}

function initCordDiagram(){
  renderCordTracts();
  const levelSelect = document.getElementById("cordLevelSelect");
  const levels = window.HRA_SPINAL_LEVELS || ["C1","C2","C3","C4","C5","C6","C7","C8","T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12","L1","L2","L3","L4","L5","S1","S2","S3","S4"];
  levelSelect.innerHTML = levels.map(level=>`<option value="${level}"${level==="C5"?" selected":""}>${level}</option>`).join("");
  levelSelect.addEventListener("change",()=>updateCordLevel(levelSelect.value));

  const pillWrap = document.getElementById("syndromePills");
  pillWrap.innerHTML = CORD_SYNDROMES.map(syndrome=>
    `<button type="button" class="syndrome-pill" data-id="${syndrome.id}">${syndrome.name}</button>`
  ).join("");
  pillWrap.querySelectorAll(".syndrome-pill").forEach(button=>{
    button.addEventListener("click",()=>applySyndrome(button.dataset.id));
  });
  updateCordLevel("C5");
  applySyndrome("complete");
}
