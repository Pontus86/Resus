/* Startskärmens läkarprofilväljare — byggs från DOCTOR_PROFILES (achievements.js) i stället
   för statisk HTML, eftersom vilka kort som är upplåsta beror på körtidstillstånd
   (Achievements.isUnlocked). Låsta kort visar upplåsningsvillkoret i stället för perken och
   går inte att välja; en enkel initial-bricka (badge/color) används tills riktiga foton
   finns för de nya profilerna (bara Pontus/Eric har img ännu). Bara de UPPLÅSTA profilerna
   visas som standard (annars dominerar 6 låsta kort skärmen från start) — låsta profiler
   döljs bakom en "Visa alla"-knapp tills man uttryckligen vill se vad som finns kvar att
   låsa upp. */
let profilePickerExpanded=false;
function renderProfilePicker(){
  const host=$("profilePicker");
  if(!host)return;
  if(!DOCTOR_PROFILES.some(p=>p.id===S.profile))S.profile=DOCTOR_PROFILES[0].id;
  const unlockedProfiles=DOCTOR_PROFILES.filter(p=>Achievements.isUnlocked(p.id));
  const lockedProfiles=DOCTOR_PROFILES.filter(p=>!Achievements.isUnlocked(p.id));
  const visible=profilePickerExpanded?DOCTOR_PROFILES:unlockedProfiles;
  host.innerHTML=visible.map(p=>{
    const unlocked=Achievements.isUnlocked(p.id);
    const avatar=p.img?`<img src="${p.img}" alt="${p.name}">`
      :`<div class="profile-badge" style="background:${unlocked?p.color:'#B9B5B3'}">${unlocked?p.badge:"🔒"}</div>`;
    const progress=(!unlocked&&p.counterKey)?` (${Achievements.getCounter(p.counterKey)}/${p.target})`:"";
    const sub=unlocked?`<small>${p.perk}</small>`:`<small class="lock-req">Lås upp: ${p.achText}${progress}</small>`;
    return `<button type="button" class="profile-card${unlocked&&S.profile===p.id?" selected":""}${unlocked?"":" locked"}"
        data-profile="${p.id}"${unlocked?"":" disabled title=\"Låst — se villkoret nedan\""}>
      ${avatar}
      <div><span class="profile-name">${p.name}</span>
      <span class="profile-role">${p.role}</span>
      ${sub}</div>
    </button>`;
  }).join("")+(lockedProfiles.length?`<button type="button" class="profile-expand-btn" id="profileExpandBtn">${
      profilePickerExpanded?"Visa färre profiler ▲":`Visa alla profiler (${lockedProfiles.length} låsta) ▼`
    }</button>`:"");
  const expandBtn=$("profileExpandBtn");
  if(expandBtn)expandBtn.onclick=()=>{ profilePickerExpanded=!profilePickerExpanded; renderProfilePicker(); };
  host.querySelectorAll(".profile-card:not(.locked)").forEach(btn=>{
    btn.onclick=()=>{
      S.profile=btn.dataset.profile;
      host.querySelectorAll(".profile-card").forEach(b=>b.classList.toggle("selected",b===btn));
    };
  });
}
function boot(){
  S=newState();
  try{ if(location.search.indexOf("debug")>=0){DBG.on=true;} }catch(e){}
  window.addEventListener("keydown",e=>{
    if(e.key==="F9"){ e.preventDefault(); DBG.on=!DBG.on;
      if(!DBG.on){DBG.unlock=DBG.instant=DBG.noFail=DBG.freeROSC=false;}
      buildTabs(); renderActions(true); dbgPanel(); }
    if(e.key==="Escape" && !$("startOverlay").classList.contains("hidden")){ $("startOverlay").classList.add("hidden"); }
  });
  $("startOverlayClose").onclick=()=>{ $("startOverlay").classList.add("hidden"); };
  Drawer.init();
  buildTabs();
  dbgPanel();
  renderTopChampion();
  renderProfilePicker();
  if(window.Auth)Auth.onChange(user=>{ if(user)Achievements.syncFromServer().then(renderProfilePicker); });
  $("btnGuided").onclick=()=>{Sound.init();startGame("guided");Drawer.peek(3200);};
  $("btnNormal").onclick=()=>{Sound.init();startGame("normal");Drawer.peek(3200);};
  $("btnAdvanced").onclick=()=>{Sound.init();startGame("advanced");Drawer.peek(3200);};
  $("btnExpert").onclick=()=>{Sound.init();startGame("expert");Drawer.peek(3200);};
  $("btnHardcore").onclick=()=>{Sound.init();startGame("hardcore");Drawer.peek(3200);};
  $("btnSound").onclick=()=>Sound.toggle();
  $("btnOpenLb").onclick=()=>{ lbTab="top"; openLeaderboard(); };
  $("btnCloseLb").onclick=closeLeaderboard;
  $("lbTabTop").onclick=()=>{ lbTab="top"; $("lbTabTop").classList.add("sel"); $("lbTabHist").classList.remove("sel"); renderLbBody(); };
  $("lbTabHist").onclick=()=>{ lbTab="hist"; $("lbTabHist").classList.add("sel"); $("lbTabTop").classList.remove("sel"); renderLbBody(); };
  $("btnAbort").onclick=()=>{
    if(!S.running||S.ended)return;
    S.speedSaved=S.speed;S.speed=0;syncSpeed();
    $("abortText").textContent="Tid: "+mmss(S.t)+" · Rytm vid senaste kontroll: "+(S.lastKnownRhythm||"okontrollerad")+" · "+S.shocks+" chocker · "+S.adrenalin.length+" doser adrenalin. Enligt ERC ska beslut väga in reversibla orsaker, total tid och rytm. TOR-regler ska inte användas som enda grund.";
    $("abortOverlay").classList.remove("hidden");
  };
  $("btnAbortYes").onclick=()=>{$("abortOverlay").classList.add("hidden");
    log("Beslut: återupplivningen avbryts. Dödsfall konstateras "+mmss(S.t)+" efter ankomst.","bad");
    endScenario("avbrutet");};
  $("btnAbortNo").onclick=()=>{$("abortOverlay").classList.add("hidden");S.speed=S.speedSaved||1;syncSpeed();};
  document.querySelectorAll("#speedCtl button").forEach(b=>{
    b.onclick=()=>{S.speed=+b.dataset.s;syncSpeed();};
  });
  function syncSpeed(){document.querySelectorAll("#speedCtl button").forEach(x=>x.classList.toggle("sel",+x.dataset.s===S.speed));}
  window.syncSpeed=syncSpeed;
  // SBAR: klicka i dialogrutan för att hoppa fram texten direkt
  const sbox=$("sbarBox"); if(sbox)sbox.addEventListener("click",()=>{ if(dlgTyping&&dlgSkip)dlgSkip(); });
  // ---- Klickbara objekt i rummet (alternativ till åtgärdslådan) ----
  const room=$("room");
  const room3d=$("room3d");
  const roomXY=e=>{const r=room.getBoundingClientRect();return {x:(e.clientX-r.left)*560/r.width, y:(e.clientY-r.top)*330/r.height};};
  const inR=(p,a)=>p.x>=a[0]&&p.x<=a[2]&&p.y>=a[1]&&p.y<=a[3];
  const findAct=(tab,id)=>{const a=(ACTIONS[tab]||[]).find(x=>x.id===id);return a;};
  const canDo=a=>a&&a.enabled()&&(S.mode!=="guide"||S.guideAll||S.unlocked.has(a.id));
  /* Klickzoner (gemensam logik, per-vy-geometri) */
  const A_luftvag={ show:()=>!S.rosc, run:()=>{ const a=findAct("hlr","maskvent"); if(canDo(a)){a.run();} } };
  const A_team={ show:()=>true, run:()=>{ const a=S.rosc?findAct("rosc","p_abcde"):findAct("diagnostik","status"); if(canDo(a)){a.run();} } };
  // Klick på LUCAS i rumsvyn: pausa/återuppta kompressionerna men LÅT maskinen
  // sitta kvar. (Att ta bort LUCAS helt görs via HLR-fliken.)
  const A_lucas={ show:()=>S.lucas&&!S.rosc, run:()=>{
    if(S.comp){ S.comp=false; S.compStopAt=S.t; log("LUCAS pausad, kolven stannar. Maskinen sitter kvar, återuppta inför nästa cykel.","warn"); }
    else { S.comp=true; if(S.compStopAt!==null)S.compStopAt=null; if(S.firstCompAt===null){S.firstCompAt=S.t; mark("HLR startad","comp");} log("LUCAS återupptagen, kolven går igen (102/min).","ok"); }
  } };
  const A_komp={ show:()=>!S.lucas&&!S.rosc, run:()=>{const a=findAct("hlr","comp"); if(canDo(a)){a.run();}} };
  const A_ladda={ show:()=>!S.rosc, run:()=>{ let a=!S.pads?findAct("defib","pads"):findAct("defib","laddaChock"); if(canDo(a)){a.run();} } };
  const A_defib={ show:()=>!S.rosc, run:()=>{ let a=!S.pads?findAct("defib","pads"):findAct("defib","analys"); if(canDo(a)){a.run();} } };
  const A_us={ show:()=>true, run:()=>{const a=findAct("diagnostik","us"); if(canDo(a)){a.run();}} };
  const HOT_CLASSIC=[
    { r:[124,130,178,194], ...A_luftvag },
    { r:[346,230,404,294], ...A_team },
    { r:[234,124,306,196], ...A_lucas },
    { r:[238,36,300,96],   ...A_komp },
    { r:[444,110,514,134], ...A_ladda },
    { r:[436,22,548,96],   ...A_defib },
    { r:[64,240,128,274],  ...A_us },
  ];
  // Klickzoner i dioramavyn härleds ur ROOM_LAYOUT-items (via role) så de
  // följer med när objekt flyttas i layout-editorn.
  const roleRect=(role,pad=6)=>{ const it=(ROOM_LAYOUT.items||[]).find(o=>o.role===role); if(!it)return null;
    const img=it.sprite?SPRITES[it.sprite]:null; const w=it.w? it.w : (img&&img.width? it.h*(img.width/img.height):it.h);
    return [it.x-w/2-pad, it.y-it.h/2-pad, it.x+w/2+pad, it.y+it.h/2+pad]; };
  const hotSprite=()=>{
    const defs=[["airway_staff",A_luftvag],["doctor",A_team],["bed",A_lucas],["compressor",A_komp],
      ["ladda_button",A_ladda],["defib",A_defib],["ultrasound",A_us]];
    const out=[];
    for(const [role,act] of defs){ const r=roleRect(role); if(r)out.push(Object.assign({r},act)); }
    return out;
  };
  const HOT_SPRITE=hotSprite();
  const hotspots=()=>roomView==="sprite"?hotSprite():HOT_CLASSIC;
  room.addEventListener("click",e=>{
    if(!S.running||S.ended||S.phase==="prearrival")return;
    const p=roomXY(e);
    for(const h of hotspots()){ if(h.show()&&inR(p,h.r)){ h.run(); renderActions(true); return; } }
  });
  room.addEventListener("mousemove",e=>{
    if(!S.running||S.ended){room.style.cursor="default";return;}
    const p=roomXY(e); let cur="default";
    for(const h of hotspots()){ if(h.show()&&inR(p,h.r)){ cur="pointer"; break; } }
    room.style.cursor=cur;
  });
  // 3D-vyn använder riktig raycasting. Samma åtgärdsobjekt återanvänds så att ett
  // klick aldrig skapar en separat spelregel vid sidan av åtgärdslådan.
  const ACTION_BY_3D_ROLE={
    airway_staff:A_luftvag,doctor:A_team,bed:A_lucas,compressor:A_komp,
    ladda_button:A_ladda,defib:A_defib,ultrasound:A_us
  };
  if(room3d){
    room3d.addEventListener("click",e=>{
      if(!S.running||S.ended||S.phase==="prearrival"||typeof HLRRoom3D!=="object")return;
      const action=ACTION_BY_3D_ROLE[HLRRoom3D.pick(e)];
      if(action&&action.show()){action.run();renderActions(true);}
    });
    room3d.addEventListener("mousemove",e=>{
      if(!S.running||S.ended||typeof HLRRoom3D!=="object"){room3d.style.cursor="default";return;}
      const action=ACTION_BY_3D_ROLE[HLRRoom3D.pick(e)];
      room3d.style.cursor=action&&action.show()?"pointer":"default";
    });
  }
  /* Rumsvy-växlare (Klassisk / 3D med Canvas-fallback) */
  const rvseg=$("rvseg");
  if(rvseg){ rvseg.querySelectorAll("button").forEach(b=>{
    b.onclick=()=>{ roomView=b.dataset.v;
      rvseg.querySelectorAll("button").forEach(x=>x.classList.toggle("sel",x===b));
      drawRoom(); };
  }); }
  lastReal=performance.now();
  requestAnimationFrame(loop);
  render(0.016);
}
function loop(now){
  const dtReal=Math.min(0.1,(now-lastReal)/1000);lastReal=now;
  tick(dtReal*(S.speed||0));
  Sound.tick(now);
  if(S.speed===0&&S.running&&!S.ended)render(0);
  requestAnimationFrame(loop);
}
boot();
