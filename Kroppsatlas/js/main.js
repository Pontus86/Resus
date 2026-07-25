/* ---------- Kropps-atlas: sidwiring ---------- */
(() => {
  // Sökbart index = Open3DModel-manifestet, HRA:s kvinnliga bäckenorgan PLUS hjärn-/
  // ryggmärgskategorierna (de två senare ingår inte i BODY3D_MANIFEST). Utan detta hittar
  // sökrutan aldrig t.ex. "Livmoder", "Cortex" eller "Thalamus" trots att strukturerna går att
  // ladda och klicka på i 3D-vyn.
  const fullIndex = (window.BODY3D_MANIFEST||[])
    .concat(typeof BODY3D_FEMALE_PELVIS_PARTS === "undefined" ? [] : BODY3D_FEMALE_PELVIS_PARTS)
    .concat(
    BODY3D_BRAIN_CATEGORIES.map(b => ({
      name: b.cat, label: b.label, system: "brain", region: b.region,
      side: b.cat.endsWith("_l") ? "l" : (b.cat.endsWith("_r") ? "r" : "mid")
    }))
    );

  const systemsHost = document.getElementById("body3dSystems");
  systemsHost.innerHTML = BODY3D_SYSTEMS.map(sys => `
    <label class="body3d-check">
      <input type="checkbox" data-system="${sys}" ${BODY3D_DEFAULT_ON[sys] ? "checked" : ""}>
      ${BODY3D_SYSTEM_LABEL[sys]}
      <span class="body3d-system-loading" data-loading-for="${sys}" hidden>laddar…</span>
    </label>
  `).join("");
  systemsHost.querySelectorAll("input[type=checkbox]").forEach(chk => {
    chk.addEventListener("change", () => {
      const sys = chk.dataset.system;
      if(chk.checked && body3d && !body3d.loadedSystems[sys]){
        const loadingEl = systemsHost.querySelector(`[data-loading-for="${sys}"]`);
        if(loadingEl) loadingEl.hidden = false;
        chk.disabled = true;
      }
      setBody3DSystemVisible(sys, chk.checked);
    });
  });
  window.onBody3DSystemLoaded = (sys) => {
    const loadingEl = systemsHost.querySelector(`[data-loading-for="${sys}"]`);
    if(loadingEl) loadingEl.hidden = true;
    const chk = systemsHost.querySelector(`input[data-system="${sys}"]`);
    if(chk) chk.disabled = false;
  };

  const regionsHost = document.getElementById("body3dRegions");
  regionsHost.innerHTML = BODY3D_REGIONS_ORDER.map((r,i) => `
    <button class="body3d-chip ${i===0?"active":""}" data-region="${r}">${BODY3D_REGION_LABEL[r]}</button>
  `).join("");
  regionsHost.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      regionsHost.querySelectorAll("button").forEach(b => b.classList.toggle("active", b===btn));
      setBody3DRegionFilter(btn.dataset.region);
    });
  });

  document.querySelectorAll(".body3d-chip-row button[data-side]").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("active", b===btn));
      setBody3DSideFilter(btn.dataset.side);
    });
  });

  document.querySelectorAll("button[data-preset]").forEach(btn => {
    btn.addEventListener("click", () => setBody3DPreset(btn.dataset.preset));
  });

  // ---- sök ----
  const searchInput = document.getElementById("body3dSearch");
  const resultsHost = document.getElementById("body3dResults");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if(q.length < 2){ resultsHost.innerHTML = ""; return; }
    const matches = fullIndex
      .filter(p => `${p.name} ${p.label||""}`.toLowerCase().replace(/_/g," ").includes(q))
      .slice(0, 60);
    resultsHost.innerHTML = matches.map(p => `
      <button class="body3d-result" data-name="${p.name}">
        ${(p.label||p.name).replace(/_/g," ")}
        <span class="body3d-result-tag">${BODY3D_SYSTEM_LABEL[p.system]}</span>
      </button>
    `).join("") || `<div class="body3d-no-results">Inga träffar.</div>`;
    resultsHost.querySelectorAll("button[data-name]").forEach(btn => {
      btn.addEventListener("click", () => selectStructure(btn.dataset.name));
    });
  });

  function selectStructure(name){
    const sys = fullIndex.find(p=>p.name===name);
    if(sys && body3d && !body3d.loadedSystems[sys.system]){
      const chk = systemsHost.querySelector(`input[data-system="${sys.system}"]`);
      if(chk && !chk.checked){ chk.checked = true; chk.dispatchEvent(new Event("change")); }
    }
    body3dSelectByName(name);
    updateSelectedInfo(name);
  }
  window.onBody3DPick = selectStructure;

  function updateSelectedInfo(name){
    const info = document.getElementById("body3dSelectedInfo");
    const meta = fullIndex.find(p=>p.name===name);
    if(!meta){ info.textContent = "Ingen struktur vald."; return; }
    const sideLabel = meta.side==="l" ? "Vänster" : (meta.side==="r" ? "Höger" : "Mittlinje");
    info.innerHTML = `<strong>${(meta.label||name).replace(/_/g," ")}</strong><br>
      ${BODY3D_SYSTEM_LABEL[meta.system]} · ${BODY3D_REGION_LABEL[meta.region]||meta.region} · ${sideLabel}`;
  }

  document.getElementById("body3dIsolateChk").addEventListener("change", (e) => {
    setBody3DIsolate(e.target.checked);
  });
  document.getElementById("body3dClearBtn").addEventListener("click", () => {
    body3dClearSelection();
    updateSelectedInfo(null);
    searchInput.value = "";
    resultsHost.innerHTML = "";
  });

  // ---- snitt ----
  document.querySelectorAll(".body3d-clip-row").forEach(row => {
    const axis = row.dataset.axis;
    const enable = row.querySelector(".clip-enable");
    const slider = row.querySelector(".clip-slider");
    const flipBtn = row.querySelector(".body3d-flip");
    let flip = false;
    function apply(){ setBody3DClip(axis, enable.checked, parseFloat(slider.value), flip); }
    enable.addEventListener("change", apply);
    slider.addEventListener("input", apply);
    flipBtn.addEventListener("click", () => { flip = !flip; flipBtn.classList.toggle("active", flip); apply(); });
  });

  // ---- mobil: handtaget överst i sidopanelen fäller ut/in panelen som ett bottensheet ----
  // (se css/mobile-drawers.css -- .body3d-sidebar har ingen hover/fäst-låda att återanvända
  // som HLR/Neuro/EKG:s drawer-mönster, så en egen enkel klass-toggling räcker här.)
  const sidebarHandle = document.getElementById("body3dSidebarHandle");
  const sidebarEl = document.getElementById("body3dSidebar");
  if(sidebarHandle && sidebarEl){
    sidebarHandle.addEventListener("click", () => sidebarEl.classList.toggle("mobile-open"));
  }

  // ---- init ----
  const canvas = document.getElementById("body3dCanvas");
  const loadingEl = document.getElementById("body3dLoading");
  ensureBody3D(canvas, () => { loadingEl.hidden = true; });
  setBody3DActive(true);
})();
