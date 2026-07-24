/* ---------- Resus: delad vänster-navigering mellan moduler ---------- */
/* Inkludera med EN rad på varje sida, relativ sökväg till denna fil:
     <script src="nav.js"></script>                              (i Resus-roten)
     <script src="../nav.js"></script>                            (en mapp ner)
     <script src="../../../nav.js"></script>                      (tre mappar ner)
   Basvägen till Resus-roten och vilken modul som är "aktuell" räknas ut automatiskt
   utifrån den sökvägen och sidans egen URL, inget mer behöver anges. */
(function(){
  const scriptEl = document.currentScript;
  const srcAttr = scriptEl ? scriptEl.getAttribute("src") : "nav.js";
  const BASE = srcAttr.replace(/nav\.js(\?.*)?$/, "");

  const MODULES = [
    {id:"home", label:"Resus (start)", href:"index.html", home:true},
    {id:"hlr", label:"A-HLR Simulator", href:"HLR/ahlr.html"},
    {id:"blodgas", label:"Blodgastolkning", href:"Blodgas/bloodgas_pkg/web/index.html"},
    {id:"ekg", label:"EKG-tränare", href:"EKG/index.html"},
    {id:"neuro", label:"Neuro", href:"Neuro/index.html"},
    {id:"kroppsatlas", label:"Kropps-atlas", href:"Kroppsatlas/index.html"},
    {id:"checklistor", label:"Checklistor", href:"Checklistor/index.html"},
    {id:"loggbok", label:"Loggbok", href:"Loggbok/index.html"},
    {id:"toxidrom", label:"Toxidrom-detektiv", href:"Toxidrom/index.html"},
    {id:"about", label:"Om Resus", href:"about.html", home:true}
  ];

  function resolve(href){ return new URL(BASE + href, location.href); }
  const here = new URL(location.href);
  MODULES.forEach(m => { m.url = resolve(m.href); m.isCurrent = (m.url.pathname === here.pathname); });

  const css = `
    #resusNav{position:fixed;top:0;left:0;height:100vh;width:288px;max-width:82vw;z-index:40;
      display:flex;flex-direction:row-reverse;font-family:"Archivo",system-ui,sans-serif;
      transform:translateX(calc(-100% + 42px));transition:transform .28s cubic-bezier(.4,0,.2,1)}
    #resusNav.open{transform:translateX(0)}
    #resusNav .rn-tab{flex:none;width:42px;background:#F44336;color:#fff;cursor:pointer;user-select:none;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
      border-radius:0 14px 14px 0;box-shadow:4px 0 16px rgba(28,27,27,.14);transition:background .15s}
    #resusNav .rn-tab:hover{background:#C5362B}
    #resusNav .rn-label{writing-mode:vertical-rl;text-orientation:mixed;
      font-weight:800;letter-spacing:.16em;font-size:12px;font-stretch:85%}
    #resusNav .rn-chevron{font-size:18px;font-weight:700;line-height:1;transition:transform .28s}
    #resusNav.open .rn-chevron{transform:rotate(180deg)}
    #resusNav .rn-body{flex:1;min-width:0;background:#FFFFFF;border-right:1px solid #E7E4E3;
      box-shadow:10px 0 34px rgba(28,27,27,.14);display:flex;flex-direction:column;overflow:hidden}
    #resusNav .rn-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;
      border-bottom:1px solid #E7E4E3;background:#F7F5F4;font-size:11px;letter-spacing:.14em;
      text-transform:uppercase;color:#6B6B6B;font-weight:700}
    #resusNav .rn-pin{background:#FFFFFF;border:1px solid #E7E4E3;color:#6B6B6B;border-radius:6px;
      padding:4px 10px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
    #resusNav .rn-pin:hover{background:#FDECEA;border-color:#F3B9B2;color:#C5362B}
    #resusNav.pinned .rn-pin{background:#F44336;color:#fff;border-color:#C5362B}
    #resusNav .rn-list{padding:8px;overflow-y:auto}
    #resusNav .rn-item{display:block;padding:12px 12px;border-radius:10px;text-decoration:none;
      color:#1C1B1B;margin-bottom:4px;transition:background .12s}
    #resusNav .rn-item:hover{background:#F7F5F4}
    #resusNav .rn-item .rn-name{font-weight:700;font-size:14px;display:block}
    #resusNav .rn-item.current{background:#FDECEA}
    #resusNav .rn-item.current .rn-name{color:#C5362B}
    #resusNav .rn-item .rn-tag{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6B6B6B}
    @media(max-width:700px){#resusNav{width:240px}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement("div");
  nav.id = "resusNav";
  nav.setAttribute("aria-label", "Resus-moduler");
  nav.innerHTML = `
    <div class="rn-tab" id="resusNavTab" title="Resus-moduler, hovra för att öppna, klicka för att fästa">
      <span class="rn-chevron">›</span>
      <span class="rn-label">MODULER</span>
    </div>
    <div class="rn-body">
      <div class="rn-head">
        <span>Resus-moduler</span>
        <button class="rn-pin" id="resusNavPin">Fäst</button>
      </div>
      <div class="rn-list">
        ${MODULES.map(m => `
          <a class="rn-item${m.isCurrent?" current":""}" href="${m.isCurrent?"#":m.url.href}"${m.isCurrent?' onclick="return false"':""}>
            <span class="rn-name">${m.label}</span>
            ${m.isCurrent?'<span class="rn-tag">Du är här</span>':(m.home?'':'<span class="rn-tag">Modul</span>')}
          </a>`).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(nav);

  let closeTimer = null, pinned = false;
  const open = () => { clearTimeout(closeTimer); nav.classList.add("open"); };
  const scheduleClose = () => { if(pinned) return; clearTimeout(closeTimer); closeTimer = setTimeout(()=>nav.classList.remove("open"), 320); };
  nav.addEventListener("mouseenter", open);
  nav.addEventListener("mouseleave", scheduleClose);
  document.getElementById("resusNavTab").addEventListener("click", togglePin);
  document.getElementById("resusNavPin").addEventListener("click", e => { e.stopPropagation(); togglePin(); });
  function togglePin(){
    pinned = !pinned;
    nav.classList.toggle("pinned", pinned);
    if(pinned) open(); else nav.classList.remove("open");
    document.getElementById("resusNavPin").textContent = pinned ? "Fäst ✓" : "Fäst";
  }
})();
