/* ---------- 3D-panelen: bygge + kontroller (kamera-förval, klippsnitt, cortex/märg-av/på) ----------
   Panelen (canvas + kontroller, se <template id="brain3dPanelTemplate"> i index.html) klonas
   in i sin "hemmaposition" (#nihss3dCol) vid sidladdning, och FLYTTAS (inte klonas om) mellan
   NIHSS-resultatet och Nervbanor-fliken av main.js — se moveBrain3DPanelTo(). En enda
   canvas/renderer (brain3d.js) återanvänds hela tiden, aldrig fler än en WebGL-kontext. */
function initBrainDiagrams(){
  const tpl = document.getElementById("brain3dPanelTemplate");
  const host = document.getElementById("nihss3dCol");
  if(!tpl || !host) return;
  host.appendChild(tpl.content.cloneNode(true));

  // Utfällbar strukturlåda -- samma hover/fäst-mönster som HLR:s #drawer / EKG:s #condDrawer
  // (se dessa moduler för originalet). Fäst by default (annars hoppar layouten till höger om
  // och om när man klickar strukturknapparna, precis som kommentaren i EKG:s main.js beskriver).
  (function(){
    const drawer = document.getElementById("brain3dDrawer");
    const tab = document.getElementById("brain3dDrawerTab");
    const pinBtn = document.getElementById("brain3dDrawerPinBtn");
    if(!drawer || !tab || !pinBtn) return;
    let pinned = true, closeTimer = null;
    const open = () => { clearTimeout(closeTimer); drawer.classList.add("open"); };
    const scheduleClose = () => { if(pinned) return; clearTimeout(closeTimer); closeTimer = setTimeout(() => drawer.classList.remove("open"), 320); };
    drawer.addEventListener("mouseenter", open);
    drawer.addEventListener("mouseleave", scheduleClose);
    tab.addEventListener("click", togglePin);
    pinBtn.addEventListener("click", e => { e.stopPropagation(); togglePin(); });
    function togglePin(){
      pinned = !pinned;
      drawer.classList.toggle("pinned", pinned);
      if(pinned) open(); else drawer.classList.remove("open");
      pinBtn.textContent = pinned ? "Fäst ✓" : "Fäst";
    }
    drawer.classList.add("pinned", "open");
    pinBtn.textContent = "Fäst ✓";
  })();

  document.querySelectorAll("#brain3dPresets button").forEach(b=>{
    b.addEventListener("click", ()=>{
      document.querySelectorAll("#brain3dPresets button").forEach(x=>x.classList.toggle("active", x===b));
      setBrain3DPreset(b.dataset.preset);
      // "Helkropp" ska visa vad namnet lovar -- utan detta zoomade den bara ut till en tom
      // scen (ryggmärgen/kotpelaren är av som default, se setBrain3DCordVisible-anropet
      // längre ner), vilket bara visade en ensam liten hjärna mitt i tomrummet.
      if(b.dataset.preset === "whole"){
        const cordToggle = document.getElementById("brain3dCordToggle");
        if(cordToggle && !cordToggle.checked){ cordToggle.checked = true; setBrain3DCordVisible(true); }
      }
      // Axialsnittets slider är kalibrerad för hjärnans egen höjd (-2.5..2.5 scen-enheter) --
      // ryggmärgen/kotpelaren sträcker sig långt längre ner (till ca -25), utanför slider-
      // intervallet, så ett snitt kunde ALDRIG nå längre ner än halsens allra översta del i
      // Helkropp-vyn (upptäckt: användaren såg "capsen ligger fel/vid botten" -- verklig orsak
      // var att snittet fysiskt inte kunde nå ner i ryggen alls, bara den bit av märgen/kotpelaren
      // som råkar rymmas inom hjärnans eget höjdintervall). Vidga bara nedåt i Helkropp-läget --
      // annars blir samma slider-bredd mycket mindre precis för vanliga hjärnsnitt.
      const axialSlider = document.getElementById("clipAxial");
      if(axialSlider){
        const isWhole = b.dataset.preset === "whole";
        const min = isWhole ? -26 : -2.5;
        axialSlider.min = String(min);
        const clamped = Math.max(min, Math.min(2.5, Number(axialSlider.value)));
        if(clamped !== Number(axialSlider.value)) axialSlider.value = String(clamped);
        if(!axialSlider.disabled) setBrain3DClip("axial", true, clamped);
      }
    });
  });

  // Toon/Atlas-stilväxlare -- se setBrain3DStyle i brain3d.js.
  document.querySelectorAll("#brain3dStyleToggle button").forEach(b=>{
    b.addEventListener("click", ()=>{
      document.querySelectorAll("#brain3dStyleToggle button").forEach(x=>x.classList.toggle("active", x===b));
      setBrain3DStyle(b.dataset.style);
    });
  });
  // Grupperade/distinkta färger -- se setBrain3DColorMode i brain3d.js.
  document.querySelectorAll("#brain3dColorModeToggle button").forEach(b=>{
    b.addEventListener("click", ()=>{
      document.querySelectorAll("#brain3dColorModeToggle button").forEach(x=>x.classList.toggle("active", x===b));
      setBrain3DColorMode(b.dataset.colormode);
    });
  });
  // Konturlinjen av/på (kravet i specifikationen: "outlines should be toggleable") -- se
  // setBrain3DOutlineEnabled i brain3d-post.js. AO:n (samma postprocessing-pass) stängs INTE av
  // här, bara konturens opacitet; setBrain3DPostFXEnabled (hela passet av/på) finns kvar som en
  // grövre reträttväg, bl.a. använd internt om postFX skulle krascha (se render-loopen).
  const outlineFXToggle = document.getElementById("brain3dOutlineFXToggle");
  if(outlineFXToggle){
    outlineFXToggle.addEventListener("change", ()=> setBrain3DOutlineEnabled(outlineFXToggle.checked));
  }
  // Tillfälligt av/på för snittytorna (locken) -- t.ex. för att se de klippta strukturernas
  // insida "råa"/ofyllda, utan de opaka fyllda snittytorna i vägen. Ren visningsväxel (se
  // setBrain3DCapsHidden), rör inte klippningen/snitt-planen själva.
  const capsToggle = document.getElementById("brain3dCapsToggle");
  if(capsToggle){
    capsToggle.addEventListener("change", ()=> setBrain3DCapsHidden(!capsToggle.checked));
  }

  document.querySelectorAll("#brain3dClips input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const axis = cb.dataset.axis;
      const slider = document.getElementById("clip"+axis.charAt(0).toUpperCase()+axis.slice(1));
      const flipBtn = document.getElementById("clip"+axis.charAt(0).toUpperCase()+axis.slice(1)+"Flip");
      if(slider) slider.disabled = !cb.checked;
      if(flipBtn) flipBtn.disabled = !cb.checked;
      setBrain3DClip(axis, cb.checked, slider ? Number(slider.value) : 0);
    });
  });
  document.querySelectorAll("#brain3dClips input[type=range]").forEach(sl=>{
    sl.addEventListener("input", ()=>{
      const axis = sl.dataset.axis;
      setBrain3DClip(axis, !sl.disabled, Number(sl.value));
    });
  });
  // Vänd-knapp: byter vilken halva som behålls (t.ex. framsidan i stället för baksidan av
  // hjärnan vid ett koronarsnitt), samma snittposition. Se setBrain3DClipFlip.
  document.querySelectorAll(".brain3d-flip-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const flipped = !btn.classList.contains("active");
      btn.classList.toggle("active", flipped);
      setBrain3DClipFlip(btn.dataset.axis, flipped);
    });
  });

  // Strukturknappar: valt organ rött och ogenomskinligt, alla andra genomskinliga (kontext).
  // "Visa alla" (data-group="") återställer till normalt utseende, se setBrain3DStructureHighlight.
  document.querySelectorAll("#brain3dStructs button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("#brain3dStructs button").forEach(x=>x.classList.toggle("active", x===btn));
      setBrain3DStructureHighlight(btn.dataset.group || null);
      document.querySelectorAll("#brain3dCtxRegions button").forEach(x=>x.classList.toggle("active", !x.dataset.region));
    });
  });

  // Cortex-delregioner (motorisk/sensorisk cortex, Brocas/Wernickes område osv) -- egen knapprad,
  // se setBrain3DCortexRegion (ömsesidigt uteslutande mot helorgan-highlighten ovan).
  document.querySelectorAll("#brain3dCtxRegions button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("#brain3dCtxRegions button").forEach(x=>x.classList.toggle("active", x===btn));
      setBrain3DCortexRegion(btn.dataset.region || null);
      document.querySelectorAll("#brain3dStructs button").forEach(x=>x.classList.toggle("active", !x.dataset.group));
    });
  });

  const cortexToggle = document.getElementById("brain3dCortexToggle");
  if(cortexToggle){
    cortexToggle.addEventListener("click", e=>e.stopPropagation());
    cortexToggle.addEventListener("change", ()=>setBrain3DCortexVisible(cortexToggle.checked));
  }
  const cordToggle = document.getElementById("brain3dCordToggle");
  if(cordToggle){
    cordToggle.addEventListener("click", e=>e.stopPropagation());
    cordToggle.addEventListener("change", ()=>setBrain3DCordVisible(cordToggle.checked));
  }

  // Modellen laddas nu i bakgrunden, en kategori i taget (se ensureBrain3D) -- tills dess
  // visar #brain3dLoading en platshållare (kryssrutor/snitt-kontroller går fortfarande att
  // klicka på under tiden, de bara syns inte förrän parts finns). onReady körs EN gång när
  // sista kategorin är klar: döljer platshållaren, och synkar cortex/ryggmärg-materialens
  // opacitet mot kryssrutornas FAKTISKA läge just nu (setBrain3DCortexVisible/CordVisible är
  // no-op innan parts[cat] finns, så default-anropen nedan hann inte göra något om de kördes
  // före laddningen var klar -- görs därför om här, garanterat efter att parts finns).
  const loadingEl = document.getElementById("brain3dLoading");
  ensureBrain3D(document.getElementById("brain3dCanvas"), ()=>{
    if(loadingEl) loadingEl.hidden = true;
    setBrain3DCortexVisible(cortexToggle ? cortexToggle.checked : true);
    setBrain3DCordVisible(cordToggle ? cordToggle.checked : false);
    if(brain3d.activePreset === "whole") setBrain3DPreset("whole");   // räkna om lookAtY med riktiga mått nu när ryggmärgen finns
    // Standardläge: anpassade färger + ett aktivt koronarsnitt, så man direkt ser
    // gråsubstans/myelin-övergången utan att behöva klicka sig dit själv.
    setBrain3DColorMode("custom");
    const coronalOn = document.getElementById("clipCoronalOn");
    const coronalSlider = document.getElementById("clipCoronal");
    const coronalFlip = document.getElementById("clipCoronalFlip");
    if(coronalOn){
      coronalOn.checked = true;
      if(coronalSlider) coronalSlider.disabled = false;
      if(coronalFlip) coronalFlip.disabled = false;
      setBrain3DClip("coronal", true, coronalSlider ? Number(coronalSlider.value) : 0);
    }
  });
  setBrain3DPreset("front");
  ensureBrain3DMinimap(document.getElementById("brain3dMiniCanvas"));
  ensureBrain3DCapsView(document.getElementById("brain3dCapsCanvas"));
  initBrain3DCapDebugPanel();
}

// ---- F9 cap-felsökningspanel ----
// Ren utforskningsyta för att experimentera sig fram till cap-buggarna själv (se
// setBrain3DCapDebug/setBrain3DCapAxisDebug i brain3d.js) i stället för att jag ska analysera
// skärmdumpar åt dig. En "organrad" per snittbar struktur (på/av, vänd, test, bbox-avläsning
// för att jämföra mot lockens läge, återställ allt) följd av tre axelrader (sagittal/koronar/
// axial) med redigerbara X/Y/Z (ABSOLUT världsposition för just DET locket) och tjocklek.
function initBrain3DCapDebugPanel(){
  const panel = document.getElementById("brain3dCapDebugPanel");
  const table = document.getElementById("brain3dCapDebugTable");
  if(!panel || !table) return;
  const logToggle = document.getElementById("brain3dCapLogToggle");
  if(logToggle) logToggle.addEventListener("change", ()=> setBrain3DLogCapDraws(logToggle.checked));
  const AXIS_LABEL = {sagittal:"↳ sagittal", coronal:"↳ koronar", axial:"↳ axial"};
  function fmt(n){ return Math.round(n*1000)/1000; }
  function bboxText(cat){
    const box = _brain3dWorldBox(cat);
    if(!box) return "(ingen bbox)";
    return `X:[${fmt(box.min.x)}, ${fmt(box.max.x)}] Y:[${fmt(box.min.y)}, ${fmt(box.max.y)}] Z:[${fmt(box.min.z)}, ${fmt(box.max.z)}]`;
  }
  let built = false;
  function buildAxisRow(cat, axisKey){
    const tr = document.createElement("tr");
    tr.className = "cdbg-axis";
    const pos = getBrain3DCapCurrentPosition(cat, axisKey) || [0,0,0];
    const ax = getBrain3DCapAxisState(cat, axisKey);
    const thickness = ax.thickness==null ? BRAIN3D_CAP_THICKNESS_DEFAULT : ax.thickness;
    tr.innerHTML = `<td>${AXIS_LABEL[axisKey]}</td>
      <td><input type="number" step="0.01" value="${fmt(pos[0])}" data-field="overrideX"></td>
      <td><input type="number" step="0.01" value="${fmt(pos[1])}" data-field="overrideY"></td>
      <td><input type="number" step="0.01" value="${fmt(pos[2])}" data-field="overrideZ"></td>
      <td><input type="number" step="0.005" min="0.0005" value="${thickness}" data-field="thickness"></td>
      <td colspan="3"></td>
      <td><button type="button" data-action="reset-axis">↺</button></td>`;
    tr.querySelectorAll("input[data-field]").forEach(inp=>{
      inp.addEventListener("input", ()=> setBrain3DCapAxisDebug(cat, axisKey, {[inp.dataset.field]: Number(inp.value)}));
    });
    tr.querySelector("button[data-action=reset-axis]").addEventListener("click", ()=>{
      resetBrain3DCapAxisDebug(cat, axisKey);
      const p = getBrain3DCapCurrentPosition(cat, axisKey) || [0,0,0];
      tr.querySelector("[data-field=overrideX]").value = fmt(p[0]);
      tr.querySelector("[data-field=overrideY]").value = fmt(p[1]);
      tr.querySelector("[data-field=overrideZ]").value = fmt(p[2]);
      tr.querySelector("[data-field=thickness]").value = BRAIN3D_CAP_THICKNESS_DEFAULT;
    });
    return tr;
  }
  function buildOrganRows(cat){
    const rows = [];
    const head = document.createElement("tr");
    head.className = "cdbg-organ";
    const dbg = getBrain3DCapDebugState(cat) || {on:true, eps:0, flip:false, bypass:false};
    head.innerHTML = `<td><b>${cat}</b></td>
      <td colspan="4"><small>${bboxText(cat)}</small></td>
      <td>På <input type="checkbox" ${dbg.on?"checked":""} data-field="on"></td>
      <td>Vänd <input type="checkbox" ${dbg.flip?"checked":""} data-field="flip"></td>
      <td>Test <input type="checkbox" ${dbg.bypass?"checked":""} data-field="bypass"></td>
      <td><button type="button" data-action="reset-organ">↺ allt</button></td>`;
    head.querySelectorAll("input[type=checkbox]").forEach(cb=>{
      cb.addEventListener("change", ()=> setBrain3DCapDebug(cat, {[cb.dataset.field]: cb.checked}));
    });
    rows.push(head);
    const axisRows = Object.keys(brain3d.clip).map(axisKey=>buildAxisRow(cat, axisKey));
    head.querySelector("button[data-action=reset-organ]").addEventListener("click", ()=>{
      resetBrain3DCapDebug(cat);
      head.querySelectorAll("input[type=checkbox]").forEach(cb=> cb.checked = (cb.dataset.field==="on"));
      axisRows.forEach(tr=> tr.querySelector("button[data-action=reset-axis]").click());
    });
    return rows.concat(axisRows);
  }
  function build(){
    if(built || !brain3d || !brain3d.loaded) return;
    built = true;
    // Locken har bara sin INITIALA (0,0,0) three.js-position tills _updateStencilCapPositions
    // körts minst en gång (annars sker det först när ett snitt faktiskt slås på) -- kör den nu
    // så X/Y/Z-fälten visar var locket FAKTISKT skulle hamna, inte bara (0,0,0).
    _updateStencilCapPositions(brain3d.clip, brain3d.parts);
    const cats = getBrain3DCapDebugCategories();
    table.innerHTML = `<tr><th>Struktur/Axel</th><th>X</th><th>Y</th><th>Z</th><th>Tjocklek</th>
      <th>På</th><th>Vänd</th><th>Test</th><th></th></tr>`;
    cats.forEach(cat=> buildOrganRows(cat).forEach(tr=> table.appendChild(tr)));
  }
  document.addEventListener("keydown", e=>{
    if(e.key !== "F9") return;
    e.preventDefault();
    panel.hidden = !panel.hidden;
    if(!panel.hidden) build();
  });
}

// Flyttar HELA panelen (canvas + alla kontroller) mellan flikarnas platshållare -- anropas
// av main.js:s flikväxling. containerId är "nihss3dCol" eller "tracts3dSlot".
function moveBrain3DPanelTo(containerId){
  const panel = document.getElementById("brain3dPanel");
  const drawer = document.getElementById("brain3dDrawer");
  const target = document.getElementById(containerId);
  if(!target)return;
  // Lådan (position:fixed, se css) ligger som ett SYSKON till panelen, inte ett barn -- måste
  // flyttas med för hand, annars blir den kvar under den GAMLA flikens sektion och försvinner
  // (display:none på en förälder döljer även fixed-positionerade barn) så fort man byter flik.
  if(panel) target.prepend(panel);
  if(drawer) target.appendChild(drawer);
}
