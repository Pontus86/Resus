/* ---------- EKG-simulator: uppstart och DOM-koppling ---------- */
(() => {
  const canvas = document.getElementById("ecgCanvas");
  const CANVAS_H_FULL = canvas.height;       // 12-avledningsrutnätet (Simulator/Spela)
  const CANVAS_H_RUNNER = Math.round(CANVAS_H_FULL/4);  // löparen ritar bara EN avledning — mindre dött utrymme
  const groupsCard = document.getElementById("groupsCard");
  const summaryEl = document.getElementById("activeSummary");

  // Ett menyval per FLIK (ECG_TABS, 5 st) i stället för att visa alla ~38 knappar i tio
  // grupper på en gång — bara den valda flikens knappar syns åt gången, men VILKA tillstånd
  // som är aktiva påverkas inte av vilken flik som råkar vara synlig. Flera kliniskt
  // närliggande grupper (t.ex. Kalium+Kalcium+Läkemedel) delar samma flik men behåller sina
  // egna underrubriker och sin egen ömsesidiga uteslutning (styrd av c.group, oberoende av
  // flikindelningen — se ECG_TABS-kommentaren i conditions-data.js).
  const tabIds = Object.keys(ECG_TABS);
  groupsCard.innerHTML = `
    <div class="cd-groupnav" id="cdGroupNav">
      ${tabIds.map((t,i) => `<button type="button" data-tab="${t}" class="${i===0?"active":""}">${ECG_TABS[t].label}</button>`).join("")}
    </div>
    ${tabIds.map((tabId,i) => `
    <div class="cond-tab" data-tab="${tabId}" style="${i===0?"":"display:none"}">
      ${ECG_TABS[tabId].groups.map(groupId => `
        ${ECG_TABS[tabId].groups.length>1 ? `<div class="cond-group-label">${ECG_GROUPS[groupId]}</div>` : ""}
        <div class="cond-row">
          ${ECG_CONDITIONS.filter(c => c.group === groupId).map(c => `
            <button type="button" class="cond-btn" data-id="${c.id}" title="${c.desc}">${c.label}</button>
          `).join("")}
        </div>
      `).join("")}
    </div>`).join("")}
  `;
  const groupNav = document.getElementById("cdGroupNav");
  function syncGroupNavIndicators(){
    groupNav.querySelectorAll("button").forEach(btn => {
      const groups = ECG_TABS[btn.dataset.tab].groups;
      const hasActive = ECG_CONDITIONS.some(c => groups.includes(c.group) &&
        (Game.isActive() ? Game.isConditionActive(c.id) : Simulator.isActive(c.id)));
      btn.classList.toggle("has-active", hasActive);
    });
  }
  groupNav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      groupNav.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      groupsCard.querySelectorAll(".cond-tab").forEach(g => { g.style.display = (g.dataset.tab===btn.dataset.tab) ? "" : "none"; });
    });
  });

  function fmtLeads(arr){ return arr.join(", "); }

  // Härleder en konkret "vad ändras var"-lista direkt ur tillståndets delta-objekt,
  // så man lär sig avledningarna, inte bara läser en färdigskriven mening.
  function describeDelta(d){
    const lines = [];
    if(d.st){
      const up = Object.keys(d.st).filter(l => d.st[l] > 0);
      const down = Object.keys(d.st).filter(l => d.st[l] < 0);
      if(up.length) lines.push(`ST-höjning: ${fmtLeads(up)}`);
      if(down.length) lines.push(`ST-sänkning: ${fmtLeads(down)}`);
    }
    if(d.tInvMap) lines.push(`T-inversion: ${fmtLeads(Object.keys(d.tInvMap))}`);
    if(d.biphasicMap) lines.push(`Bifasisk T-våg: ${fmtLeads(Object.keys(d.biphasicMap))}`);
    if(d.tAmpMap) lines.push(`Förhöjd T-amplitud: ${fmtLeads(Object.keys(d.tAmpMap))}`);
    if(d.rAmpMap) lines.push(`Hög/bred R-våg: ${fmtLeads(Object.keys(d.rAmpMap))}`);
    if(d.qAmpMap) lines.push(`Patologiska Q-vågor: ${fmtLeads(Object.keys(d.qAmpMap))}`);
    if(d.rsrPrime) lines.push(`rSR'/pseudo-rSR': ${fmtLeads(Object.keys(d.rsrPrime))}`);
    if(d.qrsWide!=null && d.qrsWide>0.03) lines.push(`Breddökat QRS`);
    if(d.axis!=null) lines.push(`Axelskifte`);
    if(d.qt!=null && d.qt!==1) lines.push(d.qt>1 ? `Förlängd QT` : `Förkortad QT`);
    if(d.tScale!=null && Math.abs(d.tScale-1)>0.03) lines.push(d.tScale>1 ? `Höga/spetsiga T-vågor` : `Flacka T-vågor`);
    if(d.avBlock){
      const modeNames = {first:"Konstant men förlängd PR-tid, alla P-vågor leder", wenckebach:"Successivt förlängd PR-tid till ett bortfall (grupperad rytm)",
        mobitz2:"Konstant PR-tid, plötsliga bortfall utan förvarning", chb:"Total AV-dissociation — P-vågor och QRS helt oberoende"};
      lines.push(modeNames[d.avBlock] || "AV-block");
      if(d.prInterval!=null) lines.push(`PR-tid ~${Math.round(d.prInterval*1000)} ms`);
      if(d.atrialHr!=null) lines.push(`Förmaksfrekvens ~${d.atrialHr}/min`);
      if(d.escapeHr!=null) lines.push(`Kammarfrekvens (ersättningsrytm) ~${d.escapeHr}/min`);
      if(d.wenckebachRatio!=null) lines.push(`Cykel: ${d.wenckebachRatio} förmaksslag per bortfall`);
      if(d.mobitzRatio!=null) lines.push(`Konduktion ${d.mobitzRatio}:1`);
    } else if(d.hr!=null) lines.push(`Hjärtfrekvens ~${d.hr}/min`);
    if(d.irregular) lines.push(`Oregelbunden rytm`);
    if(d.pWave!=null && d.pWave<1) lines.push(d.pWave===0 ? `P-våg saknas` : `Reducerad P-våg`);
    if(d.lowVolt!=null && d.lowVolt<1) lines.push(`Lågvoltage`);
    if(d.alternans) lines.push(`Elektrisk alternans`);
    if(d.prDepress!=null && Math.abs(d.prDepress)>0.03) lines.push(`PR-sänkning`);
    if(d.delta) lines.push(`Deltavåg`);
    if(d.pacerSpike) lines.push(`Pacemakerspik`);
    if(d.sag) lines.push(`Skopformad ("hängmatta") ST-sänkning`);
    if(d.uWave) lines.push(`Framträdande U-våg`);
    if(d.flutterRatio) lines.push(`Sågtandade fladdervågor (${d.flutterRatio}:1)`);
    if(d.qrsOverride) lines.push(`Konkordans i bröstavledningarna`);
    if(d.fibWave) lines.push(`Kaotisk fibrillationsbaslinje`);
    if(d.torsades) lines.push(`Vridande QRS-amplitud/polaritet slag för slag`);
    if(d.osborn) lines.push(`Osborn-våg (J-våg)`);
    return lines;
  }

  // Ett reglage (0–100) betyder olika saker beroende på tillståndet: för spectrum-tillstånd
  // är det svårighetsgrad, för stages-tillstånd är det tidsförlopp (visar närmsta stadiums namn).
  function levelRowHtml(c){
    if(!c.spectrum && !c.stages) return "";
    const f = Simulator.getSeverity(c.id, defaultLevel(c));
    const pct = Math.round(f*100);
    const labelText = c.spectrum ? "Svårighetsgrad" : "Tidsförlopp";
    const valText = c.spectrum ? `${pct}%` : c.stages[Math.round(f*(c.stages.length-1))].label;
    return `<div class="severity-row">
      <label>${labelText}</label>
      <input type="range" min="0" max="100" value="${pct}" data-lvl-id="${c.id}">
      <span class="lvl-val">${valText}</span>
    </div>`;
  }

  function syncButtonActiveClasses(){
    document.querySelectorAll(".cond-btn").forEach(btn => {
      const id = btn.dataset.id;
      btn.classList.toggle("active", Game.isActive() ? Game.isConditionActive(id) : Simulator.isActive(id));
    });
    syncGroupNavIndicators();
  }

  function updateButtonStates(){
    syncButtonActiveClasses();
    const gameOn = Game.isActive();
    const activeIds = gameOn ? Game.getPlayerActiveIds() : Simulator.getActive();
    const activeConds = activeIds.map(id => ECG_CONDITIONS.find(c => c.id === id));
    if(!activeConds.length){
      summaryEl.innerHTML = `<p class="muted">${gameOn ? "Inga tillstånd valda ännu." : "Normalt sinusrytm — inga tillstånd aktiva."}</p>`;
    } else {
      summaryEl.innerHTML = `<h4>${gameOn ? "Dina val" : "Aktiva tillstånd"}</h4>` + activeConds.map(c => `
        <div class="active-item-block">
          <div class="active-item"><b>${c.label}</b></div>
          <p class="active-desc">${c.desc}</p>
          ${c.physiology ? `<p class="active-physiology"><b>Fysiologi:</b> ${c.physiology}</p>` : ""}
          ${gameOn ? "" : levelRowHtml(c)}
          <ul class="finding-list">${describeDelta(resolveConditionDelta(c, gameOn ? undefined : Simulator.getSeverity(c.id, defaultLevel(c)))).map(f => `<li>${f}</li>`).join("")}</ul>
        </div>
      `).join("");
    }
  }

  // Slider-drag ska kännas direkt: uppdatera bara canvas + procent/stadietext + fyndlista
  // för den berörda blocken, i stället för att bygga om hela summeringslistan varje "input".
  summaryEl.addEventListener("input", e => {
    const id = e.target.dataset.lvlId;
    if(!id) return;
    const val = Number(e.target.value)/100;
    Simulator.setSeverity(id, val);
    const c = ECG_CONDITIONS.find(x => x.id === id);
    const block = e.target.closest(".active-item-block");
    if(!block) return;
    const valSpan = block.querySelector(".lvl-val");
    if(valSpan) valSpan.textContent = c.spectrum ? `${Math.round(val*100)}%` : c.stages[Math.round(val*(c.stages.length-1))].label;
    const list = block.querySelector(".finding-list");
    if(list) list.innerHTML = describeDelta(resolveConditionDelta(c, val)).map(f => `<li>${f}</li>`).join("");
  });

  groupsCard.querySelectorAll(".cond-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if(Runner.isActive()) return; // rubbningar dyker upp av sig själva i löparläget, ingen manuell knapptoggling
      if(Game.isActive()) Game.toggle(btn.dataset.id);
      else { Simulator.toggle(btn.dataset.id); updateButtonStates(); }
    });
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    Simulator.reset();
    updateButtonStates();
  });

  Simulator.init(canvas);
  updateButtonStates();

  /* ---- EKG-matchningsspel: matcha ett slumpat mål-EKG med rätt kombination av knappar,
     så snabbt och exakt som möjligt. Grått = mål-EKG, svart = ditt eget försök. ---- */
  const gameHud = document.getElementById("gameHud");
  const ekgNavBtns = [...document.querySelectorAll("#ekgNav button")];
  const simIntro = document.getElementById("simIntro");
  const resetBtn = document.getElementById("resetBtn");
  const cellCard = document.getElementById("cellCard");
  const cellularPanel = document.getElementById("cellularPanel");
  const cellToggleBtn = document.getElementById("cellToggleBtn");
  const cellApView = document.getElementById("cellApView");
  const cellEcgBox = document.getElementById("cellEcgBox");
  const cellViewSwitch = document.getElementById("cellViewSwitch");
  const cellEcgCanvas = document.getElementById("cellEcgCanvas");
  let cellExpanded = true;   // Cellnivå är ett hopfällbart AVSNITT under Simulator-fliken (utfällt by default), ingen egen flik
  let cellView = "ap";   // "ap" (aktionspotential) eller "ecg" (resulterande EKG) -- reglagen ligger överst och styr båda, men bara en vy syns åt gången
  cellViewSwitch.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    cellView = b.dataset.view;
    cellViewSwitch.querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    cellApView.hidden = cellView !== "ap";
    cellEcgBox.hidden = cellView !== "ecg";
  }));

  function matchBarColor(pct){ return pct>=90 ? "var(--ok)" : pct>=50 ? "var(--warn)" : "var(--red)"; }

  function renderGameHud(evt){
    evt = evt || {};
    const st = Game.getState();
    if(evt.roundEnded){
      const resultClass = evt.perfect ? "perfect" : "timeout";
      const resultText = evt.perfect
        ? `Perfekt träff! ${evt.match.toFixed(0)}% på ${evt.elapsed.toFixed(1)}s — +${evt.roundScore} poäng`
        : evt.gaveUp
          ? `Du gav upp rundan — ${evt.match.toFixed(0)}% träffsäkerhet — +${evt.roundScore} poäng`
          : `Tiden gick ut — ${evt.match.toFixed(0)}% träffsäkerhet — +${evt.roundScore} poäng`;
      // Klicksammanfattning: varje klick spelaren gjorde under rundan, rätt (flyttade mot
      // facit) eller fel (flyttade från facit) -- se den symmetriska definitionen i game.js.
      const clickRows = evt.clickLog.map(c => `
        <li class="${c.correct ? "click-ok" : "click-bad"}">
          <span class="click-mark">${c.correct ? "✓" : "✕"}</span>
          <span>${c.added ? "Lade till" : "Tog bort"} ${c.label}</span>
        </li>`).join("");
      const clickSummaryHtml = evt.totalClicks ? `
        <div class="click-summary">
          <div class="click-summary-head">
            <b>Klick under rundan:</b> ${evt.totalClicks} totalt —
            ${evt.correctClicks} rätt, ${evt.wrongClicks} fel
            ${evt.wrongClicks ? `<span class="wrong-click-penalty">(−${evt.wrongClickPenalty} p)</span>` : ""}
          </div>
          <ul class="click-list">${clickRows}</ul>
        </div>` : `<div class="click-summary"><div class="click-summary-head">Inga klick gjordes under rundan.</div></div>`;
      gameHud.innerHTML = `
        <div class="game-stats"><span>Nivå ${evt.finishedLevel} klar</span><span>Totalt: ${st.totalScore} p</span></div>
        <div class="game-result ${resultClass}">${resultText}${evt.hintsUsed?` <span class="hint-penalty-note">(${evt.hintsUsed} ledtråd${evt.hintsUsed>1?"ar":""} använd${evt.hintsUsed>1?"a":""})</span>`:""}</div>
        <div class="game-answer"><b>Facit:</b> ${evt.targetLabels.join(", ")}</div>
        ${clickSummaryHtml}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
          <button type="button" class="rs-btn ghost" id="gameChangeLevelBtn">Byt antal tillstånd</button>
          <button type="button" class="rs-btn ghost" id="gameNextBtn">Nästa nivå →</button>
        </div>`;
      document.getElementById("gameNextBtn").addEventListener("click", () => { Game.nextRound(); });
      document.getElementById("gameChangeLevelBtn").addEventListener("click", () => { Game.stop(); renderLevelPicker(); });
      return;
    }
    const pct = Math.round(st.match);
    const pxDist = computeAvgPixelDistance(st.targetProfile, st.playerProfile, canvas.width);
    // Normaliserat mot baseline (facit jämfört med INGA val alls) i stället för ett rått
    // pixelvärde -- ett rått pixeltal betyder olika mycket beroende på hur "stort" facit är
    // (många samtidiga fynd ger naturligt större baslinjeavstånd än ett enda fynd), så samma
    // antal px kan vara "nästan i mål" i ett fall och "knappt förbättrat" i ett annat. Baseline
    // = 0 %, perfekt match = 100 %; kan bli negativt om ett felval faktiskt drar bort kurvan
    // LÄNGRE från facit än att inte ha valt något alls.
    const baselinePxDist = computeAvgPixelDistance(st.targetProfile, composeProfile([]), canvas.width);
    const pxImprovementPct = baselinePxDist > 0 ? Math.round((1 - pxDist/baselinePxDist) * 100) : 100;
    const hintsHtml = st.hintsGiven.length
      ? `<ul class="hint-list">${st.hintsGiven.map(h => `<li>${h}</li>`).join("")}</ul>` : "";
    gameHud.innerHTML = `
      <div class="game-stats">
        <span>Nivå ${st.level} · ${st.conditionCount} tillstånd</span>
        <span class="game-timer${st.timeLeft<=5?" urgent":""}">${st.timeLeft.toFixed(1)}s</span>
        ${st.wrongClicks?`<span class="wrong-click-live">${st.wrongClicks} felklick</span>`:""}
        <span>Totalt: ${st.totalScore} p</span>
      </div>
      <div class="match-bar"><div class="match-bar-fill" style="width:${pct}%;background:${matchBarColor(pct)}"></div></div>
      <div class="match-label">Träffsäkerhet: ${pct}% <span class="match-pixel-note">(${pxImprovementPct}% närmare facit än utgångsläget utan val — ${pxDist.toFixed(1)} px isär, baseline ${baselinePxDist.toFixed(1)} px)</span></div>
      ${hintsHtml}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button type="button" class="rs-btn ghost" id="gameChangeLevelBtn">Byt antal tillstånd</button>
        <button type="button" class="rs-btn ghost" id="gameHintBtn">Hint (−15%)</button>
        <button type="button" class="rs-btn ghost" id="gameGiveUpBtn">Ge upp rundan</button>
      </div>`;
    document.getElementById("gameGiveUpBtn").addEventListener("click", () => { Game.giveUp(); });
    document.getElementById("gameHintBtn").addEventListener("click", () => { Game.useHint(); });
    document.getElementById("gameChangeLevelBtn").addEventListener("click", () => { Game.stop(); renderLevelPicker(); });
  }

  // Rena timer-tick (var ~150:e ms) ska BARA uppdatera klocktexten, inte bygga om hela
  // HUD:en — annars rivs Hint/Ge upp/Byt nivå-knapparna och sätts upp på nytt varje gång,
  // vilket ibland hann kapa bort en pågående musklick mitt i (knappen "funkade inte").
  Game.setOnUpdate(evt => {
    evt = evt || {};
    if(evt.tick){
      const timerEl = gameHud.querySelector(".game-timer");
      if(timerEl){
        const st = Game.getState();
        timerEl.textContent = st.timeLeft.toFixed(1) + "s";
        timerEl.classList.toggle("urgent", st.timeLeft<=5);
      }
      return;
    }
    if(evt.roundEnded){
      GameHistoryStore.record({
        level: evt.finishedLevel, conditionCount: gameConditionCountForLevel(evt.finishedLevel),
        match: evt.match, roundScore: evt.roundScore, perfect: evt.perfect, gaveUp: evt.gaveUp,
        hintsUsed: evt.hintsUsed, targetLabels: evt.targetLabels
      });
    }
    renderGameHud(evt);
    const st = Game.getState();
    drawECG12Overlay(canvas, st.targetProfile, st.playerProfile);
    updateButtonStates();
  });

  // Startväljare: låter en hoppa direkt till t.ex. "3 tillstånd" i stället för att
  // tvingas spela sig fram genom nivå 1–6 först.
  function renderLevelPicker(){
    const max = GAME_ELIGIBLE_GROUPS.length;
    const opts = [];
    for(let n=1; n<=max; n++) opts.push(n);
    gameHud.innerHTML = `
      <div class="level-picker">
        <div class="level-picker-label">Börja med hur många samtidiga tillstånd?</div>
        <div class="level-picker-row">${opts.map(n => `<button type="button" class="rs-btn ghost" data-count="${n}">${n}</button>`).join("")}</div>
      </div>`;
    gameHud.querySelectorAll("[data-count]").forEach(b => b.addEventListener("click", () => {
      Game.start(gameFirstLevelForCount(Number(b.dataset.count)));
    }));
  }

  /* ---- EKG-löparen: rubbningar dyker upp av sig själva i en rullande remsa, botas genom
     att välja rätt BEHANDLING (inte genom att peka ut diagnosen) — ju längre man överlever,
     desto fler samtidiga rubbningar och desto tätare dyker de upp. ---- */
  const runnerHud = document.getElementById("runnerHud");
  const runnerPanel = document.getElementById("runnerPanel");
  const RUNNER_OVER_MESSAGES = {
    health: "Löparen kollapsade — för många obehandlade, allt sjukare komplex.",
    arrest_timeout: "Hjärtstopp — ingen akutåtgärd vidtagen i tid. Patienten kunde inte återupplivas.",
    arrest_wrong: "Fel akutåtgärd vid hjärtstopp — patienten kunde inte återupplivas."
  };

  function healthBarHtml(health){
    const cls = health<30 ? "low" : health<65 ? "mid" : "ok";
    return `<div class="runner-health"><div class="runner-health-fill ${cls}" style="width:${Math.max(0,health)}%"></div></div>`;
  }
  function vitalCls(kind, v){
    if(kind==="bp") return v<80?"crit":v<100?"warn":"ok";
    if(kind==="spo2") return v<85?"crit":v<92?"warn":"ok";
    if(kind==="temp") return v<33?"crit":v<35.5?"warn":"ok";
    return "ok";
  }
  function vitalsHtml(v){
    return `<div class="runner-vitals">
      <span class="vital ${vitalCls('bp',v.bp)}">BT ${v.bp}</span>
      <span class="vital ${vitalCls('spo2',v.spo2)}">SpO₂ ${v.spo2}%</span>
      <span class="vital ${vitalCls('temp',v.temp)}">Temp ${v.temp.toFixed(1)}°C</span>
    </div>`;
  }
  function arrestHtml(st){
    return `<div class="arrest-banner">
      <div class="arrest-title">HJÄRTSTOPP — trolig orsak: ${st.arrestLabel||"okänd"}</div>
      <div class="arrest-sub">Chockbar eller icke-chockbar rytm? Tid kvar: <span class="arrest-countdown">${st.arrestTimeLeft.toFixed(1)}</span>s</div>
      <div class="arrest-actions">
        <button type="button" class="rs-btn primary" data-arrest="shock">Defibrillera nu</button>
        <button type="button" class="rs-btn ghost" data-arrest="cpr">Starta HLR — icke-chockbar</button>
      </div>
    </div>`;
  }
  function wireRunnerPanelButtons(){
    runnerPanel.querySelectorAll("[data-treat]").forEach(b => b.addEventListener("click", () => Runner.treat(b.dataset.treat)));
    runnerPanel.querySelectorAll("[data-arrest]").forEach(b => b.addEventListener("click", () => Runner.resolveArrest(b.dataset.arrest)));
  }
  function renderRunnerPanel(st){
    st = st || Runner.getState();
    if(st.arrestActive){
      runnerPanel.innerHTML = arrestHtml(st);
    } else {
      runnerPanel.innerHTML = `
        <div class="runner-treatments">
          ${Object.keys(RUNNER_TREATMENTS).map(k => `<button type="button" class="rs-btn ghost" data-treat="${k}">${RUNNER_TREATMENTS[k]}</button>`).join("")}
        </div>`;
    }
    wireRunnerPanelButtons();
  }
  function flashRunnerFeedback(kind){
    const el = document.createElement("div");
    el.className = "runner-flash " + kind;
    el.textContent = kind === "correct" ? "Rätt behandling ✓"
      : kind === "contra" ? "Kontraindicerat! ⚠"
      : "Fel behandling ✗";
    runnerPanel.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function renderRunnerHud(evt){
    evt = evt || {};
    const st = Runner.getState();
    if(evt.gameOver){
      runnerHud.innerHTML = `
        <div class="runner-stats"><span>Överlevde ${evt.survived.toFixed(1)}s</span><span>Poäng: ${evt.score}</span></div>`;
      runnerPanel.innerHTML = `
        <div class="game-result timeout">${RUNNER_OVER_MESSAGES[evt.reason] || RUNNER_OVER_MESSAGES.health}</div>
        <div class="runner-stats"><span>Rätt behandlade: ${evt.correctCount}</span><span>Felval: ${evt.wrongCount}</span><span>Kontraindicerat: ${evt.contraCount}</span></div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <button type="button" class="rs-btn ghost" id="runnerRestartBtn">Starta om</button>
        </div>`;
      document.getElementById("runnerRestartBtn").addEventListener("click", () => { Runner.start(); renderRunnerHud({}); });
      return;
    }
    runnerHud.innerHTML = `
      <div class="runner-stats">
        <span>Överlevt: ${st.elapsed.toFixed(1)}s</span>
        <span>Aktiva rubbningar: ${st.disorderCount}</span>
        <span>Poäng: ${st.score}</span>
      </div>
      ${healthBarHtml(st.health)}
      ${vitalsHtml(st.vitals)}`;
    renderRunnerPanel(st);
    if(evt.correct) flashRunnerFeedback("correct");
    if(evt.wrong) flashRunnerFeedback(evt.contraindicated ? "contra" : "wrong");
  }
  Runner.setOnUpdate(evt => {
    evt = evt || {};
    if(evt.tick){
      const st = Runner.getState();
      const statsEl = runnerHud.querySelector(".runner-stats");
      const fillEl = runnerHud.querySelector(".runner-health-fill");
      const vitalsEl = runnerHud.querySelector(".runner-vitals");
      if(statsEl) statsEl.innerHTML = `<span>Överlevt: ${st.elapsed.toFixed(1)}s</span><span>Aktiva rubbningar: ${st.disorderCount}</span><span>Poäng: ${st.score}</span>`;
      if(fillEl){
        fillEl.style.width = Math.max(0,st.health) + "%";
        fillEl.className = "runner-health-fill " + (st.health<30 ? "low" : st.health<65 ? "mid" : "ok");
      }
      if(vitalsEl) vitalsEl.outerHTML = vitalsHtml(st.vitals);
      const countdownEl = runnerPanel.querySelector(".arrest-countdown");
      if(countdownEl) countdownEl.textContent = st.arrestTimeLeft.toFixed(1);
      return;
    }
    renderRunnerHud(evt);
  });

  /* ---- Cellnivå: jonkanaler/aktionspotential kopplat till EKG:t (cellular.js) ----
     Samma tre parametrar (K+, Ca2+, Na+-kanalblockad) driver BÅDE de två AP-kurvorna
     och en KONTINUERLIG EKG-profil (cellularToECGProfile, samma mergeDeltas-mekanism
     som de 38 diskreta tillstånden) — reglagen ger alltså en enda, inbördes konsekvent
     modell snarare än fristående presets. */
  const CELL_DEFAULTS = {k:4.0, ca:1.2, naBlock:0};
  let cellParams = Object.assign({}, CELL_DEFAULTS);
  const cellKInput = document.getElementById("cellK");
  const cellCaInput = document.getElementById("cellCa");
  const cellNaBlockInput = document.getElementById("cellNaBlock");
  const cellKVal = document.getElementById("cellKVal");
  const cellCaVal = document.getElementById("cellCaVal");
  const cellNaBlockVal = document.getElementById("cellNaBlockVal");
  const apVentCanvas = document.getElementById("apVentCanvas");
  const apSaCanvas = document.getElementById("apSaCanvas");
  const apVentReadout = document.getElementById("apVentReadout");
  const apSaReadout = document.getElementById("apSaReadout");
  const apVentLegend = document.getElementById("apVentLegend");
  const apSaLegend = document.getElementById("apSaLegend");
  const cellExplain = document.getElementById("cellExplain");

  function explainCellularState(params, vAP, saAP){
    const lines = [];
    if(params.k >= 6.5) lines.push("Förhöjt kalium depolariserar vilopotentialen ("+Math.round(vAP.vRest)+" mV) — det inaktiverar i sig en del av Na⁺-kanalerna.");
    if(vAP.naCond < 0.5) lines.push("Kraftigt nedsatt Na⁺-kanaltillgänglighet ("+Math.round(vAP.naCond*100)+" %) ger en långsam fas 0-uppstroke → brett QRS.");
    if(params.k >= 7.5) lines.push("P-vågen tenderar att bli lägre eller försvinna vid så uttalad hyperkalemi.");
    if(saAP.rateBpm <= 50) lines.push("SA-nodens automaticitet är nedsatt ("+saAP.rateBpm+" slag/min) — förhöjt kalium bromsar den diastoliska depolariseringen i fas 4.");
    if(params.k <= 2.5) lines.push("Lågt kalium sänker paradoxalt IKr-konduktansen → långsammare fas 3, förlängd QT och en mer framträdande U-våg.");
    if(params.ca <= 0.7) lines.push("Lågt kalcium förlänger platåfasen (fas 2) kraftigt → förlängd QT.");
    if(params.ca >= 1.9) lines.push("Högt kalcium förkortar platåfasen → kort QT.");
    if(vAP.eadRisk) lines.push("<b>Aktionspotentialen är så förlängd att en tidig efterdepolarisation (EAD) uppstår</b> — det här är den cellulära mekanismen bakom torsades de pointes.");
    if(!lines.length) lines.push("Normala jonvärden — aktionspotentialen och EKG:t ser ut som förväntat.");
    return lines;
  }
  function renderPhaseLegend(host, info){
    host.innerHTML = info.map(p =>
      `<li style="--swatch:${PHASE_SWATCH[p.key]}"><b>${p.label}</b> — ${p.desc}</li>`).join("");
  }
  function renderCellular(){
    const vAP = buildVentricularAP(cellParams);
    const saAP = buildSANodeAP(cellParams);
    drawActionPotential(apVentCanvas, vAP, {});
    drawActionPotential(apSaCanvas, saAP, {});
    apVentReadout.innerHTML = `
      <span>Vilopotential: <b>${vAP.vRest.toFixed(0)} mV</b></span>
      <span>Na⁺-tillgänglighet: <b>${Math.round(vAP.naCond*100)}%</b></span>
      <span>Uppstrokestid: <b>${vAP.upstrokeDur.toFixed(1)} ms</b></span>
      <span>Total AP-längd: <b>${Math.round(vAP.platDur+vAP.apd90)} ms</b></span>
      ${vAP.eadRisk ? `<span class="warn">⚠ EAD-risk (torsades)</span>` : ""}`;
    apSaReadout.innerHTML = `
      <span>Cykellängd: <b>${Math.round(saAP.cycleLen)} ms</b></span>
      <span>Frekvens: <b>${saAP.rateBpm} slag/min</b></span>`;
    renderPhaseLegend(apVentLegend, PHASE_INFO_VENT);
    renderPhaseLegend(apSaLegend, PHASE_INFO_SA);
    const lines = explainCellularState(cellParams, vAP, saAP);
    cellExplain.innerHTML = `<ul>${lines.map(l=>`<li>${l}</li>`).join("")}</ul>`;
    cellExplain.classList.toggle("ead", vAP.eadRisk);
    // Egen, alltid synlig mini-EKG-canvas för cellnivån (INTE den delade #ecgCanvas
    // längst upp — den tillhör condition-väljaren och ska aldrig skrivas över av
    // reglagens profil, se buggen som uppstod när cellnivå fortfarande var en egen flik
    // och delade canvas med Simulator/Spela/Överlev).
    if(!cellularPanel.hidden) drawECG12(cellEcgCanvas, cellularToECGProfile(cellParams), {});
  }
  function syncCellularSliders(){
    cellParams = {
      k: parseFloat(cellKInput.value),
      ca: parseFloat(cellCaInput.value),
      naBlock: parseFloat(cellNaBlockInput.value)
    };
    cellKVal.textContent = cellParams.k.toFixed(1).replace(".", ",") + " mmol/L";
    cellCaVal.textContent = cellParams.ca.toFixed(2).replace(".", ",") + " mmol/L";
    cellNaBlockVal.textContent = Math.round(cellParams.naBlock) + " %";
    renderCellular();
  }
  // Markerar normalvärdesintervallet direkt i reglagets spår (grön zon mot grå) genom
  // att räkna ut var data-normal-lo/hi hamnar i procent av min..max, i stället för att
  // hårdkoda samma procenttal separat i CSS:en (som annars lätt blir inaktuellt om
  // min/max/normalvärdena någonsin ändras).
  function paintNormalRange(input){
    const lo = parseFloat(input.dataset.normalLo), hi = parseFloat(input.dataset.normalHi);
    if(Number.isNaN(lo) || Number.isNaN(hi)) return;
    const min = parseFloat(input.min), max = parseFloat(input.max);
    const p0 = ((lo-min)/(max-min))*100, p1 = ((hi-min)/(max-min))*100;
    input.style.background = `linear-gradient(to right, var(--line) 0%, var(--line) ${p0}%, #8fc99a ${p0}%, #8fc99a ${p1}%, var(--line) ${p1}%, var(--line) 100%)`;
  }
  [cellKInput, cellCaInput, cellNaBlockInput].forEach(el => el.addEventListener("input", syncCellularSliders));
  [cellKInput, cellCaInput].forEach(paintNormalRange);
  document.getElementById("cellResetBtn").addEventListener("click", () => {
    cellKInput.value = CELL_DEFAULTS.k; cellCaInput.value = CELL_DEFAULTS.ca; cellNaBlockInput.value = CELL_DEFAULTS.naBlock;
    syncCellularSliders();
  });
  syncCellularSliders();

  /* ---- Hjärtats anatomi & elektrisk axel: hopfällbart avsnitt, delar profil med Simulator
     (Simulator.setOnFrame — samma profil som redan ritar det synliga 12-avlednings-EKG:t,
     se anatomy.js-filkommentaren). ---- */
  const anatomyCard = document.getElementById("anatomyCard");
  const anatomyToggleBtn = document.getElementById("anatomyToggleBtn");
  const anatomyPanel = document.getElementById("anatomyPanel");
  const anatomyViewSwitch = document.getElementById("anatomyViewSwitch");
  const axisCanvas = document.getElementById("axisCanvas");
  const axis3dView = document.getElementById("axis3dView");
  const territoryView = document.getElementById("territoryView");
  const bullseyeView = document.getElementById("bullseyeView");
  const heart3dIsolate = document.getElementById("heart3dIsolate");
  let anatomyExpanded = true;
  let anatomyView = "axis3d";   // "axis3d" (elektrisk axel + 3D-hjärta, sida vid sida), "territory" eller "bullseye"

  heart3dIsolate.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    heart3dIsolate.querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    setHeart3DIsolate(b.dataset.part || null);
  }));

  function renderAnatomy(pr){
    if(!anatomyExpanded) return;
    pr = pr || Simulator.getProfile();
    if(anatomyView === "axis3d"){
      drawAxisDiagram(axisCanvas, pr);
      renderAxisReadout(pr);
      ensureHeart3D(document.getElementById("heart3dCanvas"));
      updateHeart3D(pr);
    } else if(anatomyView === "territory"){
      renderTerritoryMap(pr);
    } else if(anatomyView === "bullseye"){
      renderBullseye(pr);
    }
  }
  anatomyToggleBtn.addEventListener("click", () => {
    anatomyExpanded = !anatomyExpanded;
    anatomyToggleBtn.textContent = anatomyExpanded ? "▲ Dölj" : "▾ Visa";
    anatomyPanel.hidden = !anatomyExpanded;
    if(anatomyExpanded) renderAnatomy(); else setHeart3DActive(false);
  });
  anatomyViewSwitch.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    anatomyView = b.dataset.view;
    anatomyViewSwitch.querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    axis3dView.hidden = anatomyView !== "axis3d";
    territoryView.hidden = anatomyView !== "territory";
    bullseyeView.hidden = anatomyView !== "bullseye";
    if(anatomyView !== "axis3d") setHeart3DActive(false);
    renderAnatomy();
  }));
  Simulator.setOnFrame(renderAnatomy);
  renderAnatomy();   // panelen är utfälld by default (anatomyExpanded=true) — måste ritas en gång direkt, inte bara vänta på nästa Simulator-ritning

  function showTab(tab){
    if(tab !== "game") Game.stop();
    if(tab !== "runner") Runner.stop();
    gameHud.hidden = tab !== "game";
    runnerHud.hidden = tab !== "runner";
    runnerPanel.hidden = tab !== "runner";
    simIntro.hidden = tab !== "sim";
    resetBtn.hidden = tab !== "sim";
    // Cellnivå och Hjärtats anatomi är EGNA KORT under Simulator-fliken (inte egna flikar) —
    // hela kortet (rubrik + "styrs av"-badge + toggle-knapp) döljs utanför sim-fliken, inte
    // bara den hopfällbara panelen, annars läcker rubriken/badgen ut på Spela/Överlev-flikarna.
    cellCard.hidden = tab !== "sim";
    cellularPanel.hidden = !(tab === "sim" && cellExpanded);
    anatomyCard.hidden = tab !== "sim";
    anatomyPanel.hidden = !(tab === "sim" && anatomyExpanded);
    if(tab !== "sim" || anatomyView !== "axis3d") setHeart3DActive(false);
    canvas.height = tab === "runner" ? CANVAS_H_RUNNER : CANVAS_H_FULL;
    canvas.hidden = false;
    if(tab === "sim"){
      Simulator.silentReset();
      Simulator.init(canvas);
      updateButtonStates();
      if(cellExpanded) renderCellular();
      if(anatomyExpanded) renderAnatomy();
    } else if(tab === "game"){
      Simulator.silentReset();
      renderLevelPicker();
    } else if(tab === "runner"){
      Simulator.silentReset();
      Runner.init(canvas);
      Runner.start();
      renderRunnerHud({});
    }
    summaryEl.hidden = (tab === "runner");
  }
  cellToggleBtn.addEventListener("click", () => {
    cellExpanded = !cellExpanded;
    cellToggleBtn.textContent = (cellExpanded ? "▲ Dölj" : "▾ Visa");
    cellularPanel.hidden = !cellExpanded;
    if(cellExpanded) renderCellular();
  });

  ekgNavBtns.forEach(btn => btn.addEventListener("click", () => {
    if(btn.classList.contains("active")) return;
    ekgNavBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showTab(btn.dataset.tab);
  }));

  /* ---- Utfällbar låda: fäst by default (annars ändrar canvasbredden storlek varje gång
     lådan öppnas/stängs på hover, vilket får EKG:t att "hoppa" varje gång man väljer ett
     tillstånd) — klicka för att lösgöra om man vill ha den undanskymd i stället. ---- */
  const drawer = document.getElementById("condDrawer");
  const pinBtn = document.getElementById("condPinBtn");
  let pinned = true, closeTimer = null;
  const open = () => { clearTimeout(closeTimer); drawer.classList.add("open"); };
  const scheduleClose = () => { if(pinned) return; clearTimeout(closeTimer); closeTimer = setTimeout(() => drawer.classList.remove("open"), 320); };
  drawer.addEventListener("mouseenter", open);
  drawer.addEventListener("mouseleave", scheduleClose);
  document.getElementById("condDrawerTab").addEventListener("click", togglePin);
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
