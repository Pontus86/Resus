/* ---------- Egna checklistor: skapa/redigera-formulär ---------- */
let editorState = null;

function escAttr(s){ return String(s ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

function openEditor(existing){
  editorState = existing ? {
    id: existing.id, name: existing.name, shortDesc: existing.shortDesc,
    drugs: existing.drugs.map(d => ({...d})),
    checklist: existing.checklist.map(g => ({phase: g.phase, items: [...g.items]})),
    tags: [...(existing.tags || [])]
  } : {id: null, name: "", shortDesc: "", drugs: [], checklist: [{phase:"Före", items:[]}], tags: []};

  listView.classList.remove("active");
  workspaceView.classList.remove("active");
  document.getElementById("editorView").classList.add("active");
  renderEditor();
}

function closeEditor(){
  document.getElementById("editorView").classList.remove("active");
  listView.classList.add("active");
}

function renderEditor(){
  const body = document.getElementById("editorBody");
  body.innerHTML = `
    <div class="card vision-card">
      <h3>Skapa förslag från bild, PDF eller Word</h3>
      <p>Fotografera eller ladda upp en tryckt checklista (t.ex. ett LUCEM-övningsblad) som bild, PDF eller Word-dokument (.docx) — en lokal AI-modell föreslår namn, beskrivning och faser/punkter som du sedan granskar nedan. En PDF med riktig text tolkas direkt som text; en inskannad/fotograferad PDF tolkas automatiskt som bild i stället. Kräver en lokal server (se <code>server/checklist-vision-server.js</code>). Fyller ALDRIG i dosberäkningsfälten automatiskt — lägg till läkemedel för hand.</p>
      <input type="file" id="edVisionFile" accept="image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      <button type="button" class="rs-btn" id="edVisionBtn">Välj bild, PDF eller Word-fil…</button>
      <span id="edVisionStatus" class="vision-status"></span>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>${editorState.id ? "Redigera checklista" : "Ny checklista"}</h2>
      <div class="rs-field">
        <label>Namn</label>
        <input type="text" id="edName" value="${escAttr(editorState.name)}" placeholder="t.ex. Ledpunktion knä">
      </div>
      <div class="rs-field">
        <label>Kort beskrivning</label>
        <input type="text" id="edDesc" value="${escAttr(editorState.shortDesc)}">
      </div>
      <div class="rs-field">
        <label>Taggar</label>
        <div class="tag-picker" id="edTagPicker">
          ${CHECKLIST_TAGS.map(t => `<button type="button" class="tag-chip${editorState.tags.includes(t)?" active":""}" data-tag="${escAttr(t)}">${t}</button>`).join("")}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Läkemedel (valfritt)</h3>
      <div id="edDrugs"></div>
      <button type="button" class="rs-btn" id="edAddDrug" style="margin-top:10px">+ Lägg till läkemedel</button>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Checklista</h3>
      <div id="edPhases"></div>
      <button type="button" class="rs-btn" id="edAddPhase" style="margin-top:10px">+ Lägg till fas</button>
    </div>

    <div class="answer-actions">
      ${editorState.id ? `<button type="button" class="rs-btn ghost" id="edDeleteBtn">Radera checklista</button>` : ""}
      <button type="button" class="rs-btn primary" id="edSaveBtn">Spara</button>
    </div>
    <p id="edError" class="ed-error" style="display:none"></p>
  `;

  document.getElementById("edDrugs").innerHTML = editorState.drugs.map((d,i) => `
    <div class="edit-drug-row" data-idx="${i}">
      <input type="text" placeholder="Namn" class="ed-drug-name" value="${escAttr(d.name)}">
      <input type="text" placeholder="Väg (IV/IM/Lokal...)" class="ed-drug-route" value="${escAttr(d.route||"")}">
      <input type="number" placeholder="Dos låg (mg/kg)" class="ed-drug-low" value="${d.doseLow ?? ""}" step="0.01">
      <input type="number" placeholder="Dos hög (mg/kg)" class="ed-drug-high" value="${d.doseHigh ?? ""}" step="0.01">
      <select class="ed-drug-unit">
        <option value="mg" ${d.doseUnit==="mg"?"selected":""}>mg</option>
        <option value="mikrog" ${d.doseUnit==="mikrog"?"selected":""}>mikrog</option>
      </select>
      <input type="number" placeholder="Konc./ml" class="ed-drug-conc" value="${d.conc ?? ""}" step="0.1">
      <input type="text" placeholder="Anteckning" class="ed-drug-note" value="${escAttr(d.note||"")}">
      <button type="button" class="rs-btn ghost small ed-drug-remove">Ta bort</button>
    </div>
  `).join("") || `<p class="muted ed-empty">Inga läkemedel tillagda.</p>`;

  document.getElementById("edPhases").innerHTML = editorState.checklist.map((g,gi) => `
    <div class="edit-phase" data-gidx="${gi}">
      <div class="edit-phase-head">
        <input type="text" placeholder="Fasnamn (t.ex. Före)" class="ed-phase-name" value="${escAttr(g.phase)}">
        <button type="button" class="rs-btn ghost small ed-phase-remove">Ta bort fas</button>
      </div>
      ${g.items.map((t,ii) => `
        <div class="edit-item-row" data-iidx="${ii}">
          <input type="text" class="ed-item-text" value="${escAttr(t)}">
          <button type="button" class="rs-btn ghost small ed-item-remove">Ta bort</button>
        </div>
      `).join("")}
      <button type="button" class="rs-btn small ed-add-item">+ Lägg till punkt</button>
    </div>
  `).join("");

  wireEditorEvents();
}

function wireEditorEvents(){
  document.getElementById("edName").oninput = e => editorState.name = e.target.value;
  document.getElementById("edDesc").oninput = e => editorState.shortDesc = e.target.value;

  document.querySelectorAll("#edTagPicker .tag-chip").forEach(btn => {
    btn.onclick = () => {
      const tag = btn.dataset.tag;
      const i = editorState.tags.indexOf(tag);
      if(i>=0) editorState.tags.splice(i,1); else editorState.tags.push(tag);
      btn.classList.toggle("active");
    };
  });

  const visionBtn = document.getElementById("edVisionBtn");
  const visionFile = document.getElementById("edVisionFile");
  const visionStatus = document.getElementById("edVisionStatus");
  visionBtn.onclick = () => visionFile.click();
  visionFile.onchange = async () => {
    const file = visionFile.files[0];
    if(!file) return;
    if(editorState.name || editorState.checklist.some(g => g.phase || g.items.length)){
      if(!confirm("Det här ersätter namn/beskrivning/checklista med förslaget från dokumentet. Fortsätta?")) { visionFile.value = ""; return; }
    }
    visionBtn.disabled = true;
    try{
      const result = await analyzeChecklistDocument(file, txt => visionStatus.textContent = txt);
      editorState.name = result.name || editorState.name;
      editorState.shortDesc = result.shortDesc || editorState.shortDesc;
      if(result.checklist && result.checklist.length) editorState.checklist = result.checklist;
      renderEditor();
    }catch(e){
      visionStatus.textContent = "";
      visionBtn.disabled = false;
      alert("Dokumenttolkning misslyckades ("+(e.message||"okänt fel")+") — kontrollera att den lokala servern (checklist-vision-server.js) och Ollama körs, eller fyll i formuläret för hand.");
    }
  };

  document.querySelectorAll(".edit-drug-row").forEach(row => {
    const idx = parseInt(row.dataset.idx, 10);
    const d = editorState.drugs[idx];
    row.querySelector(".ed-drug-name").oninput = e => d.name = e.target.value;
    row.querySelector(".ed-drug-route").oninput = e => d.route = e.target.value;
    row.querySelector(".ed-drug-low").oninput = e => d.doseLow = parseFloat(e.target.value) || 0;
    row.querySelector(".ed-drug-high").oninput = e => d.doseHigh = parseFloat(e.target.value) || 0;
    row.querySelector(".ed-drug-unit").onchange = e => d.doseUnit = e.target.value;
    row.querySelector(".ed-drug-conc").oninput = e => d.conc = parseFloat(e.target.value) || 1;
    row.querySelector(".ed-drug-note").oninput = e => d.note = e.target.value;
    row.querySelector(".ed-drug-remove").onclick = () => { editorState.drugs.splice(idx,1); renderEditor(); };
  });
  document.getElementById("edAddDrug").onclick = () => {
    editorState.drugs.push({id:"drug_" + editorState.drugs.length + "_" + Date.now().toString(36), name:"", route:"", doseLow:0, doseHigh:0, doseUnit:"mg", conc:1, note:""});
    renderEditor();
  };

  document.querySelectorAll(".edit-phase").forEach(phaseEl => {
    const gi = parseInt(phaseEl.dataset.gidx, 10);
    const g = editorState.checklist[gi];
    phaseEl.querySelector(".ed-phase-name").oninput = e => g.phase = e.target.value;
    phaseEl.querySelector(".ed-phase-remove").onclick = () => { editorState.checklist.splice(gi,1); renderEditor(); };
    phaseEl.querySelectorAll(".edit-item-row").forEach(itemEl => {
      const ii = parseInt(itemEl.dataset.iidx, 10);
      itemEl.querySelector(".ed-item-text").oninput = e => g.items[ii] = e.target.value;
      itemEl.querySelector(".ed-item-remove").onclick = () => { g.items.splice(ii,1); renderEditor(); };
    });
    phaseEl.querySelector(".ed-add-item").onclick = () => { g.items.push(""); renderEditor(); };
  });
  document.getElementById("edAddPhase").onclick = () => {
    editorState.checklist.push({phase:"", items:[]});
    renderEditor();
  };

  document.getElementById("edSaveBtn").onclick = saveEditor;
  const delBtn = document.getElementById("edDeleteBtn");
  if(delBtn) delBtn.onclick = async () => {
    if(!confirm("Radera den här checklistan permanent?")) return;
    await CustomStore.remove(editorState.id);
    closeEditor();
    await loadCustomChecklists();
  };
}

async function saveEditor(){
  const errorEl = document.getElementById("edError");
  errorEl.style.display = "none";
  if(!editorState.name.trim()){
    errorEl.textContent = "Namn krävs.";
    errorEl.style.display = "block";
    return;
  }
  const payload = {
    name: editorState.name.trim(),
    short_desc: editorState.shortDesc.trim(),
    drugs: editorState.drugs.filter(d => d.name.trim()),
    checklist: editorState.checklist
      .filter(g => g.phase.trim())
      .map(g => ({phase: g.phase.trim(), items: g.items.filter(t => t.trim())})),
    tags: editorState.tags
  };
  try{
    if(editorState.id) await CustomStore.update(editorState.id, payload);
    else await CustomStore.create(payload);
    closeEditor();
    await loadCustomChecklists();
  }catch(e){
    errorEl.textContent = "Kunde inte spara — kontrollera internetanslutningen.";
    errorEl.style.display = "block";
  }
}

document.getElementById("editorBackBtn").addEventListener("click", closeEditor);
