/* ---------- Neuro-modul: uppstart och DOM-koppling ---------- */
(() => {
  /* ---- Flikväxling: 3 toppnivå-flikar (NIHSS, Simulator, Lokalisationsalgoritm) ---- */
  const tabBtns = [...document.querySelectorAll("#tabNav button")];
  const topViews = {
    nihss: document.getElementById("nihssView"),
    simulator: document.getElementById("simulatorView"),
    algoritm: document.getElementById("algoritmView")
  };
  let lastNihssHighlight = null;   // återställs när man kommer TILLBAKA till NIHSS, se nedan

  /* ---- Simulator: intern undernavigering (Synfält/Ryggmärg/Nervbanor/Reflexer/Kärnor) ----
     Två av de fem (Nervbanor, Reflexer) delar den vanliga 3D-panelen (brain3d, se
     moveBrain3DPanelTo) med NIHSS; Kärnor har sin egen, helt separata 3D-scen (nuclei3d, se
     filkommentaren i nuclei3d.js); Ryggmärg har en egen HRA-scen som aktiveras separat.
     "panel" här styr vilken av dessa tre lägen ett undertillstånd tillhör, så
     activateSimSubMode förblir en generisk 3-vägs-växel i stället för att specialfalla
     per undertillstånd (gör det till en enda-rads-ändring att lägga till 3D för
     Synfält/Ryggmärg senare, om det någonsin blir aktuellt). */
  const SIM_SUBMODES = {
    pathway: {panel:"none"},
    spinal:  {panel:"none", onEnter:()=>setHraSpinal3DActive(true)},
    tracts:  {panel:"shared", slot:"tracts3dSlot", onEnter:()=>{ initTracts(); updateBrain3DForTract(); }},
    reflex:  {panel:"shared", slot:"reflex3dSlot", onEnter:()=>{ initReflex3D(); updateBrain3DForReflex(); }},
    nuclei:  {panel:"nuclei", onEnter:()=>{ initNucleiDiagram(); }}
  };
  const subBtns = [...document.querySelectorAll("#simSubNav button")];
  const subViews = {
    pathway: document.getElementById("pathwayView"),
    spinal: document.getElementById("spinalView"),
    tracts: document.getElementById("tractsView"),
    reflex: document.getElementById("reflexView"),
    nuclei: document.getElementById("nucleiView")
  };
  let currentSubMode = "pathway";

  function activateSimSubMode(key){
    currentSubMode = key;
    subBtns.forEach(b => b.classList.toggle("active", b.dataset.submode === key));
    Object.values(subViews).forEach(v => v.classList.remove("active"));
    subViews[key].classList.add("active");
    const cfg = SIM_SUBMODES[key];
    setNuclei3DActive(cfg.panel === "nuclei");
    setBrain3DActive(cfg.panel === "shared");
    setHraSpinal3DActive(key === "spinal");
    if(cfg.panel === "shared") moveBrain3DPanelTo(cfg.slot);
    if(cfg.onEnter) cfg.onEnter();
  }
  subBtns.forEach(b => b.addEventListener("click", () => activateSimSubMode(b.dataset.submode)));

  tabBtns.forEach(b => b.addEventListener("click", () => {
    tabBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    Object.values(topViews).forEach(v => v.classList.remove("active"));
    topViews[b.dataset.tab].classList.add("active");
    // 3D-panelen (canvas + kontroller, delad geometri/renderer -- se brain3d.js) återanvänds
    // mellan NIHSS-resultatet och Simulatorns Nervbanor/Reflexer-lägen: EN panel, flyttad i
    // DOM:en till vilket läge som är synligt just nu (se moveBrain3DPanelTo i
    // brain-diagram.js). En andra ensureBrain3D() hade bara no-opat (singleton-vakten där),
    // så ett läge utan panelen skulle annars stå tomt för alltid. Highlight/bana-kurva hör
    // till ETT läge i taget -- NIHSS-lokalisationen sparas undan och återställs (inte bara
    // nollas) när man kommer tillbaka, annars försvinner den man precis räknat ut bara för
    // att man tittat på en bana/reflex.
    if(b.dataset.tab === "nihss"){
      setHraSpinal3DActive(false);
      moveBrain3DPanelTo("nihss3dCol");
      if(typeof renderBrain3DTracts==="function") renderBrain3DTracts(null);
      if(typeof renderBrain3DReflexArc==="function") renderBrain3DReflexArc(null);
      updateBrain3D(lastNihssHighlight);
      setNuclei3DActive(false);
      setBrain3DActive(true);
    } else if(b.dataset.tab === "simulator"){
      activateSimSubMode(currentSubMode);   // återapplicera det undertillstånd man senast hade
    } else {
      // "Lokalisationsalgoritm" -- rent statiskt innehåll (text + diagrambild), ingen 3D-panel
      // alls. Stäng av den delade panelen så den inte fortsätter rendera i bakgrunden.
      setBrain3DActive(false);
      setNuclei3DActive(false);
      setHraSpinal3DActive(false);
    }
  }));

  initBrainDiagrams();

  /* ---- NIHSS: bygg kompakt formulär med ömsesidigt uteslutande knappar ---- */
  const nihssForm = document.getElementById("nihssForm");
  const nihssScores = {};

  nihssForm.innerHTML = NIHSS_ITEMS.map(item => `
    <div class="nihss-item-row" data-item="${item.id}">
      <div class="niq-label">${item.label}<span class="niq-selected" data-sel-for="${item.id}"></span></div>
      <div class="niq-pills">
        ${item.options.map(o => `<button type="button" class="pill" data-item="${item.id}" data-val="${o.v}" title="${o.t}">${o.v}</button>`).join("")}
      </div>
    </div>
  `).join("");

  function setPillActive(itemId, val){
    nihssForm.querySelectorAll(`.pill[data-item="${itemId}"]`).forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.val, 10) === val);
    });
    const item = NIHSS_ITEMS.find(x => x.id === itemId);
    const opt = item.options.find(o => o.v === val);
    nihssForm.querySelector(`.niq-selected[data-sel-for="${itemId}"]`).textContent = " — " + opt.t;
  }

  NIHSS_ITEMS.forEach(item => { nihssScores[item.id] = 0; setPillActive(item.id, 0); });

  nihssForm.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.item, val = parseInt(btn.dataset.val, 10);
      nihssScores[itemId] = val;
      setPillActive(itemId, val);
    });
  });

  document.getElementById("nihssCalcBtn").addEventListener("click", () => {
    const total = nihssTotal(nihssScores);
    const candidates = nihssLocalize(nihssScores);
    const resultCard = document.getElementById("nihssResult");
    resultCard.style.display = "block";
    document.getElementById("nihssScoreBanner").innerHTML =
      `${total} <span class="sub">NIHSS-totalpoäng (0–42)</span>`;
    setBrain3DActive(true);
    const top = candidates.find(c => c.region !== "none");
    lastNihssHighlight = top ? {region:top.region, side:top.side} : null;
    updateBrain3D(lastNihssHighlight);
    document.getElementById("nihssLocList").innerHTML = candidates.map((c,i) => `
      <div class="loc-candidate">
        <span class="rank">${i===0?"Mest sannolikt":"Alternativ"}</span>
        <h4>${c.name}</h4>
        <ul>${c.why.map(w => `<li>${w}</li>`).join("")}</ul>
      </div>
    `).join("");

    const diffs = nihssDifferentials(nihssScores);
    const diffList = document.getElementById("nihssDiffList");
    if(diffs.length){
      diffList.innerHTML = `<h3 class="diff-heading">Differentialdiagnoser att överväga (stroke mimics)</h3>` +
        diffs.map(d => `
          <div class="diff-candidate">
            <h4>${d.name}</h4>
            <p>${d.tip}</p>
          </div>
        `).join("");
    } else {
      diffList.innerHTML = "";
    }

    resultCard.scrollIntoView({behavior:"smooth", block:"nearest"});
  });

  /* ---- Spinal: klickbart dermatom/myotom-diagram ---- */
  initDermatomeDiagram();

  const spinalChoices = {sacralSparing: null, motorBelow: null, halfBelowGr3: null};
  document.querySelectorAll(".choice-btn[data-group]").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      spinalChoices[group] = btn.dataset.val;
      document.querySelectorAll(`.choice-btn[data-group="${group}"]`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if(group === "sacralSparing"){
        const show = btn.dataset.val === "yes";
        document.getElementById("motorBelowField").style.display = show ? "block" : "none";
        if(!show){
          document.getElementById("halfBelowField").style.display = "none";
          spinalChoices.motorBelow = null; spinalChoices.halfBelowGr3 = null;
          document.querySelectorAll('.choice-btn[data-group="motorBelow"],.choice-btn[data-group="halfBelowGr3"]').forEach(b => b.classList.remove("active"));
        }
      }
      if(group === "motorBelow"){
        const show = btn.dataset.val === "yes";
        document.getElementById("halfBelowField").style.display = show ? "block" : "none";
        if(!show){
          spinalChoices.halfBelowGr3 = null;
          document.querySelectorAll('.choice-btn[data-group="halfBelowGr3"]').forEach(b => b.classList.remove("active"));
        }
      }
    });
  });

  document.getElementById("spinalCalcBtn").addEventListener("click", () => {
    const input = {
      ...getDermatomeValues(),
      sacralSparing: spinalChoices.sacralSparing === "yes",
      motorBelow: spinalChoices.motorBelow,
      halfBelowGr3: spinalChoices.halfBelowGr3
    };
    if(spinalChoices.sacralSparing === null){
      alert("Ange om sakral sparing finns innan du beräknar.");
      return;
    }
    const result = spinalCompute(input);
    const resultCard = document.getElementById("spinalResult");
    resultCard.style.display = "block";
    document.getElementById("spinalNliBanner").innerHTML =
      `${result.ais} <span class="sub">${result.nliText}</span>`;
    document.getElementById("spinalAisText").textContent = result.aisText;
    resultCard.scrollIntoView({behavior:"smooth", block:"nearest"});
  });

  /* ---- Synfältsbortfall ---- */
  initVisualPathway();

  /* ---- Ryggmärgens tvärsnitt ---- */
  initCordDiagram();
})();
