const TABLIST=[["hlr","HLR"],["luftvag","Luftväg"],["defib","Defib & rytm"],["lakemedel","Läkemedel"],["monitor","Övervakning"],["diagnostik","Diagnostik"],["reversibelt","4H & 4T"],["rosc","Efter ROSC"]];
let curTab="hlr";
function tabVisible(id){
  if(DBG.on&&DBG.unlock)return true;
  if(S.mode!=="guide"||S.guideAll)return true;
  return S.unlockedTabs.has(id);
}
function actionVisible(a){
  if(S.mode!=="guide"||S.guideAll)return true;
  return S.unlocked.has(a.id);
}
function setTab(t){curTab=t;
  if(S.mode==="guide"&&t===S.newTab)S.newTab=null;
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("sel",b.dataset.t===t));
  buildTabs();renderActions(true);}
function buildTabs(){
  const vis=TABLIST.filter(([id])=>tabVisible(id));
  $("tabs").innerHTML=vis.map(([id,l])=>`<button data-t="${id}" class="${id===curTab?"sel":""} ${id===S.newTab?"newtab":""}">${l}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>setTab(b.dataset.t));
}
// Avancerad/expert: ersätt tipset med hur lång tid åtgärden tar.
// Tiden = enqueue(...)-durationen i åtgärdens run(). Saknas den är åtgärden momentan.
const _timeCache=new WeakMap();
function actionTimeHint(a){
  if(_timeCache.has(a))return _timeCache.get(a);
  let hint="direkt";
  try{
    const src=(a.run||function(){}).toString();
    // hitta högsta durationen bland enqueue-anrop (procedurer kan ha flera steg,
    // och durationen kan vara ett villkorsuttryck som S.capno?19:23)
    let best=null;
    const call=/enqueue\s*\(/g; let cm;
    while((cm=call.exec(src))!==null){
      // ta segmentet mellan enqueue( och callbacken (=> eller function)
      const rest=src.slice(cm.index+cm[0].length);
      const end=rest.search(/=>|\bfunction\b/);
      let seg=end>=0?rest.slice(0,end):rest;
      seg=seg.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,"");   // ta bort strängliteraler (doser i etiketter m.m.)
      // alla heltal/decimaltal i durations-läget (efter etikett & ev. villkorsuttryck)
      const nums=(seg.match(/[0-9]+(?:\.[0-9]+)?/g)||[]).map(parseFloat);
      // hoppa över tal som uppenbart hör till strängar redan filtrerade bort av segmentgränsen
      nums.forEach(v=>{ if(v>=2&&v<=600&&(best===null||v>best))best=v; });
    }
    if(best!==null){
      // samma golv som enqueue tillämpar: moment under 5 s rundas upp
      const shown=best<5?best+5:best;
      hint="≈ "+Math.round(shown)+" s";
    }
  }catch(e){}
  _timeCache.set(a,hint);
  return hint;
}
let lastActionsHTML="";
function currentSpots(){
  if(S.mode!=="guide"||S.guideDone)return [];
  const g=GUIDE[S.guideStep]; if(!g)return [];
  return resolveList(g.spot);
}
function renderActions(force){
  const spots=currentSpots();
  let list=(ACTIONS[curTab]||[]);
  if(S.mode==="guide"&&!S.guideAll)list=list.filter(actionVisible);
  const pre=S.phase==="prearrival";
  const html=list.map((a)=>{
    const ordered=pre&&S.orders&&S.orders.some(o=>o.tab===curTab&&o.id===a.id);
    const dis=!S.running||S.ended||(!pre&&!a.enabled()&&!(DBG.on&&DBG.unlock));
    const spot=spots.includes(a.id)&&!dis?" spot":"";
    let sub=(S.level==="advanced"||S.level==="expert"||S.level==="hardcore")?actionTimeHint(a):a.sub();
    if(pre)sub=ordered?"✓ Beordrad, förbereds nu, startar vid ankomst (halva tiden)":"Klicka för att beordra i förväg";
    return `<button class="act ${a.cls||""}${spot}${ordered?" ordered":""}" data-id="${a.id}" ${dis?"disabled":""}>${a.label()}<small>${sub}</small></button>`;
  }).join("")||`<div style="color:var(--muted);padding:8px 4px;font-size:12px">Inga tillgängliga åtgärder i den här fliken ännu.</div>`;
  if(html!==lastActionsHTML||force){
    lastActionsHTML=html;$("actions").innerHTML=html;
    document.querySelectorAll("#actions .act").forEach(b=>{
      b.onclick=()=>{const a=(ACTIONS[curTab]||[]).find(x=>x.id===b.dataset.id);
        if(!a||!S.running||S.ended)return;
        if(S.phase==="prearrival"){ toggleOrder(curTab,a.id); renderActions(true); renderTeam(); return; }
        if(a.enabled()){ a.run();guideTick(); }
        renderActions(true);renderTeam();};
    });
  }
}
function toggleOrder(tab,id){
  S.orders=S.orders||[];
  const i=S.orders.findIndex(o=>o.tab===tab&&o.id===id);
  if(i>=0){ S.orders.splice(i,1); log("Order återtagen: "+id,"sys"); }
  else { S.orders.push({tab,id}); const a=(ACTIONS[tab]||[]).find(x=>x.id===id);
    log("Beordrat i förväg: "+(a?a.label():id)+", startar när patienten rullas in.","ok"); }
}
function renderTeam(){
  let html="";
  // Undersköterskan komprimerar när hon inte har en luftvägsuppgift.
  // Ambulanspersonalen står kvar och kan fortfarande komprimera eller ventilera
  // efter att narkosteamet anlänt, så de visas så länge de faktiskt gör något.
  const roles=["lakare","ssk","usk"];
  if(S.teamArrived)roles.push("narkos","ivassk");
  else roles.push("ambulans");
  // säkerställ att den som faktiskt komprimerar eller ventilerar alltid syns
  const chestRole=handsOnChest(), ventRole=(S.vent?S.ventBy:null);
  for(const extra of [chestRole,ventRole]){
    if(extra&&available(extra)&&!roles.includes(extra))roles.push(extra);
  }
  for(const role of roles){
    const q=S.queues[role]||[], active=q[0];
    const pct=active?clamp(100*(1-active.remaining/active.dur),0,100):0;
    const qn=q.length>1?`<span class="q">+${q.length-1} i kö</span>`:"";
    let idle="ledig";
    const venting=(role===S.ventBy && S.vent);
    if(venting){const vq=ventQuality();idle="Ventilerar "+((S.airway==="tub"||S.airway==="igel")?"10/min":"30:2 (blåsa)")+(vq>=1?" · god teknik":vq>=0.7?" · godtagbart":" · ojämnt");}
    const komprimerar=(role===handsOnChest());
    const ankrad=(role===compressor());
    if(komprimerar)idle="KOMPRIMERAR, händerna är upptagna";
    else if(ankrad)idle="vid bröstet (kompressionsuppehåll)";
    const stalled=komprimerar&&active;
    const occupied=active||venting||komprimerar;
    html+=`<div class="trole ${occupied?"active":""} ${komprimerar?"comp":""}">
      <span class="who">${ROLE_NAMES[role]}</span>
      <span class="task">${stalled?"⏸ "+active.label+" väntar · komprimerar":(active?active.label+" · "+Math.ceil(active.remaining)+" s":idle)}</span>
      ${active&&!stalled?`<span class="bar"><i style="width:${pct}%"></i></span>`:""}${qn}</div>`;
  }
  // kirurgen visas när den anlänt
  if(S.surgeonPresent){
    const q=S.queues.kirurg||[], active=q[0];
    const pct=active?clamp(100*(1-active.remaining/active.dur),0,100):0;
    html+=`<div class="trole ${active?"active":""}"><span class="who">Kirurg</span>
      <span class="task">${active?active.label+" · "+Math.ceil(active.remaining)+" s":"på plats"}</span>
      ${active?`<span class="bar"><i style="width:${pct}%"></i></span>`:""}</div>`;
  }
  // Pågående infusioner, ingen person är upptagen, men volymen är inte inne än
  for(const inf of S.infusions){
    const pct=clamp(100*(1-inf.left/inf.dur),0,100);
    html+=`<div class="trole active inf"><span class="who">${inf.kind==="blod"?"🩸 Blod":"💧 Infusion"}</span>
      <span class="task">${inf.label} · ${Math.max(0,Math.ceil(inf.left))} s kvar</span>
      <span class="bar"><i style="width:${pct}%"></i></span></div>`;
  }
  if(!S.teamArrived&&S.running&&!S.rosc){
    const kvar=Math.max(0,240-S.t);
    html+=`<div class="trole" style="opacity:.7"><span class="who">Förstärkning</span><span class="task">narkosläkare + narkossköterska anländer om ${mmss(kvar)}</span></div>`;
  }
  for(const f of S.recentFails){
    html+=`<div class="tfail">✖ ${f.txt}</div>`;
  }
  if(S.complication){
    html+=`<div class="tfail" style="animation:none">⚠ KOMPLIKATION: ${COMPS[S.complication].label}, åtgärda!</div>`;
  }
  if(S.cpric.triggered&&S.cpric.handled===null)
    html+=`<div class="tfail" style="animation:none">⚠ Patienten visar tecken på medvetande under HLR, överväg sedering!</div>`;
  $("teamstatus").innerHTML=html;
}

/* ---------- Init & loop ---------- */
function personalize(t){return (t||"").replace(/PKÖN/g, S.patient&&S.patient.sex==="kvinna"?"kvinna":"man");}
function ambulancePortrait(){ return pImg("ambulans"); }
/* Före ankomst kan ingen åtgärd utföras på patienten, allt du klickar blir en ORDER
   som startar i samma stund patienten rullas in. Att beordra i förväg innebär att
   utrustningen dukas fram/dras upp, så momentet sedan tar halva tiden. */
function needsPatient(id){ return true; }
const ARRIVAL_SECONDS=20;

function startGame(level){
  $("startOverlay").classList.add("hidden");
  S.level=level;
  S.mode = (level==="guided") ? "guide" : "veteran";   // guidad = genomgång; normal/avancerad/expert = alla verktyg
  document.body.classList.toggle("expert", level==="expert"||level==="hardcore");
  S.running=false; S.speed=0; S.t=0;
  S.cause.treatedAt=null;
  // Hardcore: två SAMTIDIGA reversibla orsaker i stället för en. Anamnesen är ändå helt
  // otillgänglig i hardcore, så den andra orsaken behöver ingen egen (ohörd) historia —
  // den hämtas direkt ur CAUSES, förbi det kurerade CASES/anamnes-systemet.
  if(level==="hardcore"){
    const others=CAUSES.filter(c=>c.id!==S.cause.id);
    const secondBase=others[Math.floor(Math.random()*others.length)];
    const second=Object.assign({},secondBase,{historia:"",caseId:secondBase.id+"-hardcore2",diff:1,hidden:false,fastPos:false,trauma:null,treatedAt:null});
    S.causes=[S.cause,second];
    S.gasPanel=mergeGasPanels(GAS[S.cause.id],GAS[second.id]);
  } else {
    S.causes=[S.cause];
    S.gasPanel=Object.assign({},GAS[S.cause.id]);
  }
  // Hardcore: ingen ambulansanamnes, ingen förfas — patienten dyker upp direkt.
  if(level==="hardcore" || (typeof window!=="undefined" && window.AUTO_RHYTHM)){ beginArrest(); return; }  // headless: hoppa förfas
  openAmbulanceCall();
}
function openAmbulanceCall(){
  const anamnes=personalize(S.cause.historia);
  openDialogue({
    name:"Ambulans 4-9-20", role:"Anropar akutrummet · på väg in", portrait:ambulancePortrait(), speakerTag:"AMBULANS",
    endBtn:"Till akutrummet ▶", finishBtn:"Till akutrummet ▶", okFb:"✓ Mottaget.",
    steps:[
     {tag:"INKOMMANDE", npc:"Akuten, ambulans 4-9-20 här. Vi kommer in med ett hjärtstopp och pågående HLR. "+anamnes,
      choices:[
       {good:true, say:"Uppfattat, vi tar emot i akutrum 1, teamet förbereds. Kör in!",
        reply:"Bra. Vi är i ambulanshallen nu, framme hos er om cirka "+ARRIVAL_SECONDS+" sekunder."}]}
    ],
    onFinish:()=>{ S.revealed.anamnes=true; beginPreArrival(); }
  });
}
/* ---- Förfas: du står i akutrummet, patienten är inte inne än ---- */
function beginPreArrival(){
  S.phase="prearrival"; S.patientPresent=false; S.running=true; S.speed=1; S.t=0;
  S.arrivalIn=ARRIVAL_SECONDS;
  S.preppedLabels=[];
  if(window.syncSpeed)window.syncSpeed();
  unlockAllTools(); $("coach").classList.add("hidden");
  log("Du står i akutrum 1. Patienten är på väg in, förbered det du kan under tiden.","sys");
  log("Ambulansanamnes: "+personalize(S.cause.historia),"sys");
  log("Beordra uppgifter nu: det som kräver patienten startar i samma stund hen rullas in. Utrustning kan dukas fram direkt.","sys");
  buildTabs(); renderActions(true); renderTeam();
}
function arrivePatient(){
  S.phase="arrest"; S.patientPresent=true; S.arrivalIn=0;
  beginArrest();
  // förbeordrade uppgifter startar i samma stund patienten är inne, utrustningen är redan framdukad
  const orders=(S.orders||[]).slice(); S.orders=[];
  S._preppedNow=true;
  orders.forEach(o=>{ const a=(ACTIONS[o.tab]||[]).find(x=>x.id===o.id); if(a&&a.enabled())a.run(); });
  S._preppedNow=false;
  if(orders.length)log("Dina "+orders.length+" förbeordrade uppgifter startar nu, utrustningen är redan framme, så de går dubbelt så snabbt.","ok");
  renderActions(true); renderTeam();
}
function beginArrest(){
  S.phase="arrest"; S.patientPresent=true;
  S.running=true; S.speed=1; S.t=0; S.revealed.anamnes=true;
  if(window.syncSpeed)window.syncSpeed();
  if(S.level==="hardcore"){
    log("Patienten anträffas akut medvetslös och pulslös, ingen andning. Ingen ambulans, ingen anamnes tillgänglig — förhistorien är okänd.","bad");
    log("Teamet är samlat: du är teamledare. Kompressör, luftväg och sjuksköterska på plats, var och en gör en sak i taget.","sys");
  } else {
    log("Patienten rullas in i akutrum 1, pulslös, ingen andning, gråblek. Ambulansen har gjort HLR under transport.","bad");
    if(!S.preppedLabels.length)log("Ambulansanamnes: "+personalize(S.cause.historia),"sys");
    log("Teamet är samlat: du är teamledare. Kompressör, luftväg (ambulans) och sjuksköterska på plats, var och en gör en sak i taget.","sys");
  }
  if(S.mode==="guide"){ S.guideStep=0; applyGuideStep(); }
  else { unlockAllTools(); $("coach").classList.add("hidden"); }
  buildTabs(); renderActions(true); renderTeam();
}
/* ---------- Ljud (Web Audio) ---------- */
const Sound={
  ctx:null, enabled:true, nextClick:0, nextBeep:0, nextBreath:0, nextDrip:0, master:null,
  init(){ if(!this.ctx){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return; this.ctx=new AC();
      this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
    }catch(e){ this.ctx=null; } }
    if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume(); },
  blip(freq,dur,type,vol){ if(!this.enabled||!this.ctx)return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type||"square"; o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol||0.1,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t+dur+0.02); },
  click(){ this.blip(1600,0.035,"square",0.09); },       // metronomklick
  beep(){ this.blip(920,0.09,"sine",0.07); },            // monitor-pip (ROSC)
  noise(dur,vol,frequency){ if(!this.enabled||!this.ctx)return; const t=this.ctx.currentTime;
    const len=Math.floor(this.ctx.sampleRate*dur),buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len);
    const src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    src.buffer=buf;filter.type="lowpass";filter.frequency.value=frequency||900;gain.gain.value=vol||.025;
    src.connect(filter).connect(gain).connect(this.master);src.start(t); },
  breath(){ this.noise(.24,.032,720);this.blip(185,.18,"sine",.018); },
  lucasThump(){ this.blip(82,.075,"sine",.055);this.noise(.055,.018,320); },
  drip(){ this.blip(1280,.028,"sine",.022); },
  charge(){ if(!this.enabled||!this.ctx)return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="sawtooth";
    o.frequency.setValueAtTime(280,t); o.frequency.exponentialRampToValueAtTime(1500,t+2.4);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.1); g.gain.setValueAtTime(0.05,t+2.2); g.gain.exponentialRampToValueAtTime(0.0001,t+2.5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t+2.6); },
  shock(){ if(!this.enabled||!this.ctx)return; const t=this.ctx.currentTime;
    const len=Math.floor(this.ctx.sampleRate*0.14), buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
    const s=this.ctx.createBufferSource();s.buffer=buf; const gn=this.ctx.createGain();gn.gain.value=0.22; s.connect(gn).connect(this.master); s.start(t);
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="sine"; o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(45,t+0.16);
    g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2); o.connect(g).connect(this.master); o.start(t); o.stop(t+0.22); },
  alarm(){ this.blip(440,0.12,"square",0.06); setTimeout(()=>this.blip(330,0.12,"square",0.06),140); },
  toggle(){ this.enabled=!this.enabled; const b=$("btnSound"); if(b)b.textContent=this.enabled?"🔊":"🔇"; if(this.enabled)this.init(); return this.enabled; },
  tick(now){ if(!this.enabled||!this.ctx||!S)return;
    if(S.running&&S.comp&&!S.rosc&&S.speed>0){ if(now>=this.nextClick){
      if(S.lucas)this.lucasThump();else this.click();
      this.nextClick=now+(60000/110)/Math.max(1,S.speed); } }
    else this.nextClick=now;
    if(S.running&&S.rosc){ if(now>=this.nextBeep){ this.beep(); this.nextBeep=now+(60000/95); } }
    else this.nextBeep=now;
    if(S.running&&S.vent&&!S.rosc&&S.speed>0){if(now>=this.nextBreath){
      this.breath();this.nextBreath=now+6000/Math.max(1,S.speed);}}
    else this.nextBreath=now;
    if(S.running&&S.infusions&&S.infusions.length&&S.speed>0){if(now>=this.nextDrip){
      this.drip();this.nextDrip=now+2200/Math.max(1,S.speed);}}
    else this.nextDrip=now;
  }
};
