/* ---------- Synbanan: rendering av synfältsbortfall + lesionsval ---------- */
let _clipIdCounter = 0;

function fieldDefectMarkup(cx, cy, r, shape){
  if(!shape || shape.type === "none") return "";
  let clipRect = null;
  if(shape.type === "half" || shape.type === "halfSparing"){
    const o = shape.offset || 0;
    clipRect = shape.side === "L"
      ? {x:cx-r, y:cy-r, w:o+r, h:2*r}
      : {x:cx+o, y:cy-r, w:r-o, h:2*r};
  } else if(shape.type === "quad"){
    clipRect = {
      x: shape.side === "L" ? cx-r : cx,
      y: shape.vert === "U" ? cy-r : cy,
      w: r, h: r
    };
  }
  let svg = "";
  if(clipRect){
    const clipId = `fdClip${_clipIdCounter++}`;
    svg += `<clipPath id="${clipId}"><rect x="${clipRect.x}" y="${clipRect.y}" width="${clipRect.w}" height="${clipRect.h}"/></clipPath>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" class="field-loss" clip-path="url(#${clipId})"/>`;
  } else {
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" class="field-loss"/>`;
  }
  if(shape.type === "halfSparing"){
    svg += `<circle cx="${cx}" cy="${cy}" r="${r*0.22}" class="macula-spare"/>`;
  }
  return svg;
}

function renderFieldCircle(groupId, shape){
  const g = document.getElementById(groupId);
  if(!g) return;
  g.innerHTML = fieldDefectMarkup(50, 50, 42, shape);
}

function selectLesionSite(id){
  const site = VISUAL_LESION_SITES.find(s => s.id === id);
  if(!site) return;
  document.querySelectorAll(".lesion-marker").forEach(m => m.classList.toggle("active", m.dataset.id === id));
  document.querySelectorAll(".gallery-thumb").forEach(t => t.classList.toggle("active", t.dataset.id === id));
  renderFieldCircle("fieldL", site.L);
  renderFieldCircle("fieldR", site.R);
  document.getElementById("pathwaySiteName").textContent =
    site.name + (site.sideLabel ? "" : " (mittlinjestruktur)");
  document.getElementById("pathwaySiteDesc").textContent = site.desc;
}

function initVisualPathway(){
  const markerGroup = document.getElementById("lesionMarkers");
  markerGroup.innerHTML = VISUAL_LESION_SITES.map(s => `
    <g class="lesion-marker" data-id="${s.id}">
      <circle cx="${s.x}" cy="${s.y}" r="11"/>
      <text x="${s.x}" y="${s.y}" text-anchor="middle" dominant-baseline="central">${s.level}</text>
    </g>
  `).join("");
  markerGroup.querySelectorAll(".lesion-marker").forEach(m => {
    m.addEventListener("click", () => selectLesionSite(m.dataset.id));
  });

  const gallery = document.getElementById("pathwayGallery");
  gallery.innerHTML = VISUAL_LESION_SITES.map(s => `
    <button type="button" class="gallery-thumb" data-id="${s.id}" title="${s.name}">
      <svg viewBox="0 0 100 50" class="gallery-svg">
        <circle cx="25" cy="25" r="21" class="field-outline"/>
        <g class="gallery-shape-l"></g>
        <circle cx="75" cy="25" r="21" class="field-outline"/>
        <g class="gallery-shape-r"></g>
      </svg>
      <span>${s.sideLabel ? s.sideLabel[0] : "M"}${s.level}</span>
    </button>
  `).join("");
  gallery.querySelectorAll(".gallery-thumb").forEach(btn => {
    const site = VISUAL_LESION_SITES.find(s => s.id === btn.dataset.id);
    btn.querySelector(".gallery-shape-l").innerHTML = fieldDefectMarkup(25, 25, 21, site.L);
    btn.querySelector(".gallery-shape-r").innerHTML = fieldDefectMarkup(75, 25, 21, site.R);
    btn.addEventListener("click", () => selectLesionSite(btn.dataset.id));
  });

  selectLesionSite("nerve-R");
}
