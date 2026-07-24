/* ---------- Resus: delad inlogg-widget (liten pill i headern) ---------- */
/* Inkludera EFTER auth.js, samma en-rads-mönster som nav.js/auth.js:
     <script src="auth-ui.js"></script> / "../auth-ui.js" / "../../../auth-ui.js"
   ALLTID position:fixed, aldrig dockad i det vanliga flödet — headern (.rs-header) har
   sin egen position:sticky-stapplingskontext (z-index:20), och EKG/HLR:s helhöga
   utfällbara lådor (#condDrawer, #drawer) ligger på z-index:45 i ROT-stapplingskontexten.
   En widget som bara docka in i headerns flöde skulle vara instängd i headerns EGNA
   kontext och alltid ritas UNDER lådorna oavsett egen z-index (z-index jämförs bara
   inom SAMMA stapplingskontext). Genom att alltid vara fixed, med koordinater uträknade
   från headerns geometri (om en finns), slipper vi den fällan helt.
   De få sidor utan .rs-header (root index.html, HLR:s ahlr.html, Blodgas) faller tillbaka
   till en fast pill uppe till vänster, bredvid nav.js:s vänsterflik. Rent tillägg: allt
   fungerar som förut utan inlogg, det här låser bara upp synk av favoriter/historik
   mellan enheter när man loggar in. */
(function(){
  if(!window.Auth){ console.warn("auth-ui.js kräver att auth.js laddas först."); return; }

  // Samma självlokaliserande BASE-mönster som auth.js/nav.js, så länken till "Mina
  // resultat" (stats.html, ligger i Resus-roten) blir rätt oavsett hur många mappar ner
  // den aktuella sidan ligger.
  const scriptEl = document.currentScript;
  const srcAttr = scriptEl ? scriptEl.getAttribute("src") : "auth-ui.js";
  const BASE = srcAttr.replace(/auth-ui\.js(\?.*)?$/, "");

  const header = document.querySelector(".rs-header");
  const css = `
    #authWidget{position:fixed;z-index:9999;font-family:"Archivo",system-ui,sans-serif}
    #authPill{display:flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;border:1.5px solid #E7E4E3;
      background:#FFFFFF;color:#1C1B1B;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.06);
      transition:border-color .15s,background .15s}
    #authPill:hover{border-color:#F3B9B2;background:#FDECEA}
    #authPill .au-dot{width:7px;height:7px;border-radius:50%;background:#6B6B6B}
    #authPill.in .au-dot{background:#2E7D32}
    #authPopover{display:none;position:absolute;top:calc(100% + 8px);${header ? "right:0" : "left:0"};width:260px;padding:14px;border-radius:12px;
      border:1.5px solid #E7E4E3;background:#FFFFFF;box-shadow:0 4px 24px rgba(0,0,0,.12);text-align:left}
    #authPopover.open{display:block}
    #authPopover h4{margin:0 0 8px;font-size:13px;color:#1C1B1B}
    #authPopover p{margin:0 0 10px;font-size:12px;color:#6B6B6B;line-height:1.4}
    #authPopover input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1.5px solid #E7E4E3;font-size:13px;margin-bottom:8px}
    #authPopover button{width:100%;padding:9px;border-radius:8px;border:none;background:#F44336;color:#fff;font-weight:700;font-size:12.5px;cursor:pointer}
    #authPopover button:hover{background:#C5362B}
    #authPopover button.ghost{background:transparent;color:#C5362B;margin-top:6px}
    #authPopover button.ghost:hover{background:#FDECEA}
    #authPopover .au-msg{font-size:12px;margin-top:8px}
    #authPopover .au-msg.ok{color:#2E7D32}
    #authPopover .au-msg.err{color:#C5362B}
    .au-username-box{margin-bottom:8px}
    .au-username{display:block;font-size:12px;color:#1C1B1B;background:#F7F5F4;border-radius:8px;padding:7px 10px;margin-bottom:8px}
  `;
  const styleEl = document.createElement("style"); styleEl.textContent = css; document.head.appendChild(styleEl);

  const root = document.createElement("div"); root.id = "authWidget";
  root.innerHTML = `
    <div id="authPill"><span class="au-dot"></span><span id="authPillLabel">…</span></div>
    <div id="authPopover"></div>`;
  document.body.appendChild(root);

  const pill = root.querySelector("#authPill");
  const pillLabel = root.querySelector("#authPillLabel");
  const popover = root.querySelector("#authPopover");

  // .rs-header centrerar sitt innehåll med max-width — "höger kant av innehållet" är
  // alltså INTE samma sak som "höger kant av viewporten" på breda skärmar, därför mäts
  // headerns egen rect i stället för att bara anta ett fast avstånd från viewportkanten.
  function positionWidget(){
    if(header){
      const r = header.getBoundingClientRect();
      root.style.top = Math.round(r.top + r.height/2 - 17) + "px";
      root.style.right = Math.round(window.innerWidth - r.right + 20) + "px";
      root.style.left = "";
    } else {
      root.style.top = "12px"; root.style.left = "56px"; root.style.right = "";
    }
  }
  positionWidget();
  window.addEventListener("resize", positionWidget);

  function renderLoggedOut(){
    popover.innerHTML = `
      <h4>Logga in</h4>
      <p>Spara favoritprocedurer och din historik mellan enheter. Ingen lösenord — du får en kod via mail.</p>
      <input type="email" id="authEmail" placeholder="din@mail.se" autocomplete="email">
      <button type="button" id="authSendBtn">Skicka kod</button>
      <div class="au-msg" id="authMsg"></div>`;
    popover.querySelector("#authSendBtn").onclick = async () => {
      const email = popover.querySelector("#authEmail").value.trim();
      const msg = popover.querySelector("#authMsg");
      if(!email){ msg.textContent = "Ange en giltig mailadress."; msg.className = "au-msg err"; return; }
      msg.textContent = "Skickar…"; msg.className = "au-msg";
      try{
        await Auth.sendLoginCode(email);
        renderCodeStep(email);
      }catch(e){
        msg.textContent = "Kunde inte skicka koden (" + (e.message||"okänt fel") + ").";
        msg.className = "au-msg err";
      }
    };
  }
  // Steg 2: koden skrivs in i appen i stället för att klicka länken i mailet — en länk
  // skulle ändå aldrig komma hela vägen tillbaka hit (se auth.js-kommentaren om file://).
  function renderCodeStep(email){
    popover.innerHTML = `
      <h4>Ange koden</h4>
      <p>Vi skickade en kod till <b>${email.replace(/</g,"&lt;")}</b>. Klicka INTE länken i mailet (fungerar inte här) — skriv koden nedan.</p>
      <input type="text" id="authCode" placeholder="123456" inputmode="numeric" autocomplete="one-time-code" maxlength="10">
      <button type="button" id="authVerifyBtn">Verifiera kod</button>
      <button type="button" class="ghost" id="authBackBtn">Tillbaka</button>
      <div class="au-msg" id="authMsg"></div>`;
    popover.querySelector("#authBackBtn").onclick = () => renderLoggedOut();
    popover.querySelector("#authVerifyBtn").onclick = async () => {
      const code = popover.querySelector("#authCode").value.trim();
      const msg = popover.querySelector("#authMsg");
      if(!code){ msg.textContent = "Ange koden från mailet."; msg.className = "au-msg err"; return; }
      msg.textContent = "Verifierar…"; msg.className = "au-msg";
      try{
        await Auth.verifyEmailCode(email, code);
        // Auth.onChange (nedan) ritar om till den inloggade vyn automatiskt.
      }catch(e){
        msg.textContent = "Fel kod (" + (e.message||"okänt fel") + "), kontrollera och försök igen.";
        msg.className = "au-msg err";
      }
    };
  }
  function renderLoggedIn(user){
    popover.innerHTML = `
      <h4>Inloggad</h4>
      <p>${(user.email||"").replace(/</g,"&lt;")}</p>
      <div id="authUsernameBox" class="au-username-box">Laddar användarnamn…</div>
      <a href="${BASE}stats.html" id="authStatsLink" style="display:block;text-decoration:none;background:#F44336;color:#fff;
        font-weight:700;font-size:12.5px;text-align:center;padding:9px;border-radius:8px;margin-bottom:6px">Mina resultat</a>
      <button type="button" class="ghost" id="authSignOutBtn">Logga ut</button>`;
    popover.querySelector("#authSignOutBtn").onclick = async () => { await Auth.signOut(); popover.classList.remove("open"); };
    renderUsernameBox();
  }
  // Användarnamn krävs för att kunna TAGGAS på en procedur i Loggbok-modulen (usernames.js) —
  // uppmanar till att sätta ett direkt efter inlogg om man saknar, men blockerar inget annat.
  async function renderUsernameBox(){
    const box = popover.querySelector("#authUsernameBox");
    if(!box || !window.Usernames) return;
    const name = await Usernames.myUsername();
    if(!popover.querySelector("#authUsernameBox")) return;   // popovern hann stängas/ritas om under väntan
    if(name){
      box.innerHTML = `<span class="au-username">Användarnamn: <b>@${name.replace(/</g,"&lt;")}</b></span>`;
      return;
    }
    box.innerHTML = `
      <p style="margin:0 0 6px">Sätt ett användarnamn, så kan kollegor tagga dig i loggboken.</p>
      <input type="text" id="authUsernameInput" placeholder="anvandarnamn" maxlength="20" autocomplete="off">
      <button type="button" id="authSetUsernameBtn">Spara användarnamn</button>
      <div class="au-msg" id="authUsernameMsg"></div>`;
    popover.querySelector("#authSetUsernameBtn").onclick = async () => {
      const val = popover.querySelector("#authUsernameInput").value;
      const msg = popover.querySelector("#authUsernameMsg");
      try{
        await Usernames.setUsername(val);
        renderUsernameBox();
      }catch(e){
        msg.textContent = e.message || "Kunde inte spara.";
        msg.className = "au-msg err";
      }
    };
  }
  function render(user){
    pill.classList.toggle("in", !!user);
    pillLabel.textContent = user ? (user.email||"").split("@")[0] : "Logga in";
    if(popover.classList.contains("open")) (user ? renderLoggedIn(user) : renderLoggedOut());
  }

  pill.addEventListener("click", () => {
    const open = popover.classList.toggle("open");
    if(open) (Auth.getUser() ? renderLoggedIn(Auth.getUser()) : renderLoggedOut());
  });
  document.addEventListener("click", e => { if(!root.contains(e.target)) popover.classList.remove("open"); });

  Auth.ready.then(() => render(Auth.getUser()));
  Auth.onChange(user => render(user));
})();
