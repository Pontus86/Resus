/* ---------- Procedurträning: sidwiring ---------- */
(() => {
  // Sant medan loadProcedure3D() väntar på att procedurens system faktiskt ska bli redo
  // (inte bara påbörjade, se _body3dOnSystemReady i Kroppsatlas/js/body3d.js) -- utan denna
  // spärr kunde "Nästa steg" klickas innan t.ex. ett nytt landmärkes system hunnit laddas
  // klart, vilket tyst gav ett uteblivet kamerafokus (B-004, se BUGS.md). renderStageInfo()
  // körs synkront direkt vid procedurval (för att uppdatera stegvisning/landmärkeslistan) OCH
  // asynkront igen när systemen väl är redo -- den synkrona första körningen får INTE aktivera
  // knappen i förtid, därav flaggan i stället för att bara lita på stageIndex.
  let systemsLoading = false;
  const canvas = document.getElementById("proc3dCanvas");
  const loadingEl = document.getElementById("proc3dLoading");
  const listHost = document.getElementById("proc3dList");
  const stageHost = document.getElementById("proc3dStages");
  const infoHost = document.getElementById("proc3dInfo");
  const nextBtn = document.getElementById("proc3dNextBtn");
  const resetBtn = document.getElementById("proc3dResetBtn");
  const checklistLink = document.getElementById("proc3dChecklistLink");

  function renderList(){
    listHost.innerHTML = PROCEDURE3D_LIST.filter(k=>PROCEDURE3D_ANATOMY[k]).map(key=>{
      const proc = PROCEDURE3D_ANATOMY[key];
      return `<button type="button" class="${key===proc3d.key?"active":""}" data-key="${key}">${proc.name}</button>`;
    }).join("");
    listHost.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=> selectProcedure(btn.dataset.key));
    });
  }

  function renderStageInfo(){
    const proc = PROCEDURE3D_ANATOMY[proc3d.key];
    if(!proc){
      stageHost.innerHTML = "";
      infoHost.innerHTML = "<p>Välj en procedur ovan.</p>";
      nextBtn.disabled = true;
      return;
    }
    stageHost.innerHTML = proc.stages.map((s,i)=>
      `<span class="proc3d-stage ${i<proc3d.stageIndex?"done":""} ${i===proc3d.stageIndex?"current":""}">${s.label}</span>`
    ).join('<span class="proc3d-stage-arrow">→</span>');

    const stage = proc3d.stageIndex>=0 ? proc.stages[proc3d.stageIndex] : null;
    const landmarksHtml = (proc.landmarks||[]).map(l=>{
      const label = l.name.replace(/_schematic(\.[lr])?$/,"").replace(/\./g," ").replace(/_/g," ");
      return `<li class="proc3d-landmark proc3d-role-${l.role}" data-name="${l.name}">
        <b>${label}</b>${l.kind==="schematic" ? '<span class="proc3d-schematic-tag">schematisk</span>' : ""}
        <p>${l.desc}</p>
      </li>`;
    }).join("");
    infoHost.innerHTML = (stage ? `<h4>${stage.label}</h4><p>${stage.desc}</p>` : `<p>Klicka "Börja" för att starta det första steget.</p>`)
      + `<ul class="proc3d-landmarks">${landmarksHtml}</ul>`;
    infoHost.querySelectorAll(".proc3d-landmark").forEach(el=>{
      el.addEventListener("click", ()=> onProc3DPick(el.dataset.name));
    });

    const atEnd = proc3d.stageIndex >= proc.stages.length-1;
    nextBtn.disabled = atEnd || systemsLoading;
    nextBtn.textContent = systemsLoading ? "Laddar…" : (proc3d.stageIndex < 0 ? "Börja" : (atEnd ? "Klar" : "Nästa steg"));

    if(checklistLink){
      checklistLink.hidden = !proc.checklistId;
    }
  }

  function selectProcedure(key){
    systemsLoading = true;
    loadProcedure3D(key, () => { systemsLoading = false; renderStageInfo(); });
    renderList();
    renderStageInfo();
  }

  nextBtn.addEventListener("click", ()=>{
    advanceProcedure3DStage();
    renderList();
    renderStageInfo();
  });
  resetBtn.addEventListener("click", ()=>{
    resetProcedure3DStage();
    renderStageInfo();
  });

  // Klick på ett landmärke i listan ELLER direkt i 3D-canvasen (via window.onBody3DPick, se
  // ensureBody3D:s raycast i Kroppsatlas/js/body3d.js) -- samma kodväg för båda.
  function onProc3DPick(name){
    const proc = PROCEDURE3D_ANATOMY[proc3d.key];
    const l = proc && (proc.landmarks||[]).find(x=>x.name===name);
    if(!l) return;
    // Riktiga strukturer får den befintliga highlight-mekaniken (body3dSelectByName, samma
    // som Kropps-atlas egen sida) -- schematiska märken har redan sin egen rollfärg och
    // behöver ingen extra highlight, se PROCEDURE3D_ROLE_COLOR.
    if(l.kind === "real") body3dSelectByName(name);
    infoHost.querySelectorAll(".proc3d-landmark").forEach(el=>{
      el.classList.toggle("picked", el.dataset.name===name);
    });
  }
  window.onBody3DPick = onProc3DPick;

  // ---- mobil: samma bottensheet-mönster som Kropps-atlas egen sidopanel ----
  const sidebarHandle = document.getElementById("proc3dSidebarHandle");
  const sidebarEl = document.getElementById("proc3dSidebar");
  if(sidebarHandle && sidebarEl){
    sidebarHandle.addEventListener("click", () => sidebarEl.classList.toggle("mobile-open"));
  }

  // ---- init ----
  renderList();
  renderStageInfo();
  ensureBody3D(canvas, () => {
    loadingEl.hidden = true;
    // Väntar med att välja en procedur tills INITIALLADDNINGEN (skelett+hjärna) är helt
    // klar, inte bara påbörjad -- body3d.loadedSystems["skeletal"] sätts sant redan när
    // laddningen STARTAR (se _body3dLoadSystem), så om vi körde detta tidigare skulle
    // loadProcedure3D:s pending-räknare kunna tro att skelettet redan fanns i registryn
    // innan OBJLoader.parse faktiskt hunnit köra klart.
    if(PROCEDURE3D_LIST.length) selectProcedure(PROCEDURE3D_LIST[0]);
  });
  setBody3DActive(true);
})();
