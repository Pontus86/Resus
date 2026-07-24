/* ---------- Toxidrom-detektiv: uppstart och DOM-koppling ---------- */
(() => {
  const form = document.getElementById("toxForm");
  const toxInputs = {};

  form.innerHTML = TOX_CATEGORIES.map(cat => `
    <div class="nihss-item-row" data-cat="${cat.id}">
      <div class="niq-label">${cat.label}<span class="niq-selected" data-sel-for="${cat.id}"></span></div>
      <div class="niq-pills">
        ${cat.options.map(o => `<button type="button" class="pill wide" data-cat="${cat.id}" data-val="${o.v}">${o.t}</button>`).join("")}
      </div>
    </div>
  `).join("");

  function setPillActive(catId, val){
    form.querySelectorAll(`.pill[data-cat="${catId}"]`).forEach(b => {
      b.classList.toggle("active", b.dataset.val === val);
    });
    form.querySelector(`.niq-selected[data-sel-for="${catId}"]`).textContent = "";
  }

  TOX_CATEGORIES.forEach(cat => { toxInputs[cat.id] = "normal"; setPillActive(cat.id, "normal"); });

  form.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const catId = btn.dataset.cat, val = btn.dataset.val;
      toxInputs[catId] = val;
      setPillActive(catId, val);
    });
  });

  document.getElementById("toxAnalyzeBtn").addEventListener("click", () => {
    const results = detectToxidromes(toxInputs);
    const resultCard = document.getElementById("toxResult");
    resultCard.style.display = "block";
    const list = document.getElementById("toxList");
    if(results.length === 0){
      list.innerHTML = `<div class="loc-candidate"><h4>Inget tydligt toxidrom</h4><p>De ifyllda fynden matchar inget av de klassiska mönstren tillräckligt väl — överväg normalfynd, blandintox, eller ett ämne utan tydligt toxidrom (t.ex. paracetamol).</p></div>`;
    } else {
      list.innerHTML = results.map((r,i) => `
        <div class="loc-candidate">
          <span class="rank">${i===0?"Mest sannolikt":"Alternativ"}</span>
          <h4>${r.name}</h4>
          <p class="tox-matched">Matchande fynd: ${r.matched.map(c => categoryLabel(c, toxInputs[c])).join(" · ")}</p>
          <ul>${r.tips.map(t => `<li>${t}</li>`).join("")}</ul>
          <p class="tox-antidote"><b>Behandling/antidot:</b> ${r.antidote}</p>
        </div>
      `).join("");
    }
    resultCard.scrollIntoView({behavior:"smooth", block:"nearest"});
  });
})();
