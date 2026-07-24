/* ---------- Kärnmodulen: UI-koppling (drawer, strukturlista, kamera) ----------
   Motsvarigheten till brain-diagram.js för huvudmodellen, men mycket enklare -- ingen klippning,
   inga stil-/färglägen, bara en lista med kärnor grupperade i sektioner (se
   Neuro/models/nuclei/manifest.js) i samma utfällbara högerlåda som resten av sajten
   (se brain-diagram.js/EKG/HLR för samma mönster). Laddas lat, först när fliken faktiskt
   besöks (anropas från main.js) -- annars hade ~31MB inbäddad geometri laddats på varje
   sidladdning även för besökare som aldrig öppnar fliken. */
let _nucleiDiagramInitialized = false;
function initNucleiDiagram(){
  if(_nucleiDiagramInitialized) return;
  _nucleiDiagramInitialized = true;

  const groupsEl = document.getElementById("nuclei3dGroups");
  const loadingEl = document.getElementById("nuclei3dLoading");
  if(groupsEl && window.NUCLEI3D_MANIFEST){
    const order = NUCLEI3D_GROUPS_ORDER.filter(k => NUCLEI3D_MANIFEST[k]);
    groupsEl.innerHTML = `
      <div class="brain3d-structs" id="nuclei3dReset">
        <button type="button" class="active" data-key="">Visa alla</button>
      </div>
      ${order.map(groupKey => `
        <div class="brain3d-sidebar-heading">${NUCLEI3D_MANIFEST[groupKey].label}</div>
        <div class="brain3d-structs" data-group="${groupKey}">
          ${NUCLEI3D_MANIFEST[groupKey].items.map(it => `<button type="button" data-key="${it.key}">${it.label}</button>`).join("")}
        </div>
      `).join("")}
    `;
    const allButtons = () => groupsEl.querySelectorAll("button[data-key]");
    allButtons().forEach(btn=>{
      btn.addEventListener("click", ()=>{
        allButtons().forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        setNuclei3DHighlight(btn.dataset.key || null);
      });
    });
  }

  ensureNuclei3D(document.getElementById("nuclei3dCanvas"), ()=>{
    if(loadingEl) loadingEl.hidden = true;
  });

  // Samma hover/fäst-drawer-mönster som brain-diagram.js/HLR/EKG.
  const drawer = document.getElementById("nuclei3dDrawer");
  const tab = document.getElementById("nuclei3dDrawerTab");
  const pinBtn = document.getElementById("nuclei3dDrawerPinBtn");
  if(drawer && tab && pinBtn){
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
  }
}
