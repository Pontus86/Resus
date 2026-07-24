/* ---------- Nervbanor genom CNS: rendering ---------- */
/* Stiliserad frontal/schematisk vy (INTE ett sagittalfoto) — medvetet val: korsning
   (decussation) är en vänster/höger-händelse och syns bara tydligt i en frontal
   projektion, vilket är exakt den kliniskt viktiga detaljen hela verktyget kretsar kring.
   Halvgenomskinlig grå siluett av hjärna+ryggmärg (bakgrund) + en färgad bana ovanpå,
   som användaren efterfrågade. */
const TRACTS_NS="http://www.w3.org/2000/svg";
function _tEl(tag,attrs){ const e=document.createElementNS(TRACTS_NS,tag); for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }

const TRACT_LEVELS=[
  {label:"C1",y:240},{label:"C5",y:320},
  {label:"T1",y:390},{label:"T6",y:505},{label:"T12",y:625},
  {label:"L3",y:678},{label:"S1",y:723},{label:"S5",y:800}
];

let tractsBuilt=false, tractsSelected="corticospinal";

// Banans EGEN röda kurva (+ röda sfärer vid faktiska synaps-"stopp", se TRACT3D_ANATOMY och
// renderBrain3DTracts i brain3d.js) bär numera all färgmarkering -- hela organ ska INTE
// rödfärgas bara för att banan passerar genom dem (det gjorde updateBrain3D({regions}) förut,
// som denna funktion anropade; nu bara updateBrain3D(null), dvs alla strukturer i sin
// normala färg). Sympatiska/parasympatiska banorna saknar riktig 3D-geometri att bygga en
// kurva av (går genom ryggmärg/perifera ganglier som inte finns i datasetet) -- notisen visas
// då i stället.
function updateBrain3DForTract(){
  if(typeof updateBrain3D!=="function")return;
  const hasRoute = typeof TRACT3D_ANATOMY!=="undefined" && !!TRACT3D_ANATOMY[tractsSelected];
  const note=document.getElementById("tracts3dNote");
  if(note) note.hidden=hasRoute;
  updateBrain3D(null);
  if(typeof renderBrain3DTracts==="function") renderBrain3DTracts(tractsSelected);
}

function buildTractsBackground(svg){
  const defs=_tEl("defs",{});
  const g0=_tEl("radialGradient",{id:"tBrainGrad",cx:"38%",cy:"30%",r:"75%"});
  g0.appendChild(_tEl("stop",{offset:"0%","stop-color":"#EDEBEA"}));
  g0.appendChild(_tEl("stop",{offset:"100%","stop-color":"#CFCAC7"}));
  defs.appendChild(g0);
  svg.appendChild(defs);

  const bg=_tEl("g",{id:"tractsBg","opacity":"0.9"});
  // Hjärna (oval siluett)
  bg.appendChild(_tEl("ellipse",{cx:160,cy:95,rx:98,ry:82,fill:"url(#tBrainGrad)",stroke:"#B7B2AF","stroke-width":2}));
  // liten "fissura longitudinalis"-antydan (mittlinje i hjärnan)
  bg.appendChild(_tEl("path",{d:"M160,20 C158,45 160,70 160,95",fill:"none",stroke:"#B7B2AF","stroke-width":1.5,opacity:"0.7"}));
  // Hjärnstam
  bg.appendChild(_tEl("path",{d:"M138,168 C138,190 140,215 145,235 L175,235 C180,215 182,190 182,168 Z",
    fill:"#D6D1CE",stroke:"#B7B2AF","stroke-width":2}));
  // Ryggmärg (kolonn)
  bg.appendChild(_tEl("path",{d:"M143,235 L177,235 L182,800 C182,820 172,838 160,850 C148,838 138,820 138,800 Z",
    fill:"#D6D1CE",stroke:"#B7B2AF","stroke-width":2}));
  // Mittlinje (streckad) genom hela hjärna+ryggmärg
  bg.appendChild(_tEl("line",{x1:160,y1:15,x2:160,y2:848,stroke:"#B7B2AF","stroke-width":1,"stroke-dasharray":"3,4",opacity:"0.8"}));
  svg.appendChild(bg);

  // Nivåmarkeringar (C/T/L/S) till höger om ryggmärgen
  const levelsG=_tEl("g",{id:"tractsLevels"});
  TRACT_LEVELS.forEach(lv=>{
    levelsG.appendChild(_tEl("line",{x1:183,y1:lv.y,x2:190,y2:lv.y,stroke:"#B7B2AF","stroke-width":1}));
    const t=_tEl("text",{x:194,y:lv.y+3,"font-size":"9","font-family":"Archivo, sans-serif",fill:"#6B6B6B"});
    t.textContent=lv.label;
    levelsG.appendChild(t);
  });
  svg.appendChild(levelsG);

  // vänster/höger-etiketter uppe vid hjärnan
  const lbl=_tEl("g",{});
  const lt=_tEl("text",{x:72,y:26,"font-size":"11","font-weight":"700","font-family":"Archivo, sans-serif",fill:"#6B6B6B"}); lt.textContent="V";
  const rt=_tEl("text",{x:244,y:26,"font-size":"11","font-weight":"700","font-family":"Archivo, sans-serif",fill:"#6B6B6B"}); rt.textContent="H";
  lbl.appendChild(lt); lbl.appendChild(rt);
  svg.appendChild(lbl);

  svg.appendChild(_tEl("g",{id:"tractsPathLayer"}));
  svg.appendChild(_tEl("g",{id:"tractsNodeLayer"}));
}

function smoothPath(points){
  if(points.length<2)return "";
  let d=`M${points[0].x},${points[0].y} `;
  for(let i=0;i<points.length-1;i++){
    const p0=points[i], p1=points[i+1];
    const mx=(p0.x+p1.x)/2, my=(p0.y+p1.y)/2;
    d+=`Q${p0.x},${p0.y} ${mx.toFixed(1)},${my.toFixed(1)} `;
  }
  const last=points[points.length-1];
  d+=`L${last.x},${last.y}`;
  return d;
}

function showTractInfo(node){
  const host=document.getElementById("tractsInfo");
  if(!host)return;
  if(!node){ host.innerHTML=`<p class="tracts-hint">Hovra över en markerad struktur i diagrammet till vänster.</p>`; return; }
  host.innerHTML=`
    <h4>${node.name}</h4>
    <p class="tracts-role"><b>I den här banan:</b> ${node.role}</p>
    <p class="tracts-other"><b>Även:</b> ${node.other}</p>`;
}

function renderTractPath(){
  const svg=document.getElementById("tractsSvg");
  const pathLayer=svg.querySelector("#tractsPathLayer");
  const nodeLayer=svg.querySelector("#tractsNodeLayer");
  pathLayer.innerHTML=""; nodeLayer.innerHTML="";

  const sys=TRACT_SYSTEMS[tractsSelected];
  const d=smoothPath(sys.points);
  const path=_tEl("path",{d,fill:"none",stroke:sys.color,"stroke-width":3.2,"stroke-linecap":"round","stroke-linejoin":"round",opacity:"0.92"});
  pathLayer.appendChild(path);

  // liten pil vid slutpunkten, visar riktningen banan går
  const last=sys.points[sys.points.length-1], prev=sys.points[sys.points.length-2];
  const ang=Math.atan2(last.y-prev.y,last.x-prev.x);
  const ah=7;
  const arrow=_tEl("path",{d:`M${last.x},${last.y} L${last.x-ah*Math.cos(ang-0.5)},${last.y-ah*Math.sin(ang-0.5)} L${last.x-ah*Math.cos(ang+0.5)},${last.y-ah*Math.sin(ang+0.5)} Z`,fill:sys.color});
  pathLayer.appendChild(arrow);

  sys.points.forEach(p=>{
    if(p.decussate){
      const x=_tEl("text",{x:(p.x+ (sys.points[sys.points.indexOf(p)+1]||p).x)/2, y:p.y-8,"font-size":"13","font-weight":"800",
        "text-anchor":"middle",fill:sys.color,opacity:"0.85"});
      x.textContent="✕";
      pathLayer.appendChild(x);
    }
    if(!p.info)return;
    const dot=_tEl("circle",{cx:p.x,cy:p.y,r:6,fill:"#fff",stroke:sys.color,"stroke-width":2.5,class:"tract-node"});
    dot.addEventListener("mouseenter",()=>showTractInfo(p.info));
    dot.addEventListener("click",()=>showTractInfo(p.info));
    nodeLayer.appendChild(dot);
  });

  // basala ganglierna: alltid synlig, oavsett vald bana
  const bonus=TRACT_BONUS_NODE;
  const bdot=_tEl("circle",{cx:bonus.x,cy:bonus.y,r:6,fill:"#fff",stroke:"#6B6B6B","stroke-width":2.5,"stroke-dasharray":"2,1.5",class:"tract-node"});
  bdot.addEventListener("mouseenter",()=>showTractInfo(bonus));
  bdot.addEventListener("click",()=>showTractInfo(bonus));
  nodeLayer.appendChild(bdot);

  document.getElementById("tractsSummary").innerHTML=`<p><b style="color:${sys.color}">${sys.name}.</b> ${sys.summary}</p>`;
  showTractInfo(null);
  updateBrain3DForTract();
}

function renderTractsSwitch(){
  const host=document.getElementById("tractsSwitch");
  host.innerHTML=TRACT_ORDER.map(key=>{
    const s=TRACT_SYSTEMS[key];
    return `<button type="button" class="${key===tractsSelected?"active":""}" data-key="${key}" style="--tc:${s.color}">${s.short}</button>`;
  }).join("");
  host.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    tractsSelected=b.dataset.key;
    host.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));
    renderTractPath();
  }));
}

function initTracts(){
  if(tractsBuilt)return;
  tractsBuilt=true;
  const svg=document.getElementById("tractsSvg");
  buildTractsBackground(svg);
  renderTractsSwitch();
  renderTractPath();
}
