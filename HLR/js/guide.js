const ALL_TABS=["hlr","luftvag","defib","lakemedel","diagnostik","reversibelt","rosc"];
const GUIDE=[
 {tabs:["hlr"], unlock:["comp"], spot:["comp"],
  msg:()=>"Patienten är pulslös och andas inte. <b>Starta bröstkompressioner</b>, det är alltid första åtgärden vid hjärtstopp.",
  done:()=>S.firstCompAt!==null},
 {tabs:["defib"], unlock:["pads"], spot:["pads"],
  msg:()=>"Bra! Kompressioner pågår. Nu måste du se hjärtrytmen. Gå till fliken <b>Defib &amp; rytm</b> och <b>sätt defibrilleringsplattorna</b>.",
  done:()=>S.pads},
 {unlock:["analys"], spot:["analys"],
  msg:()=>"Plattorna sitter och rytmen syns på monitorn. Gör en <b>rytmkontroll</b>: pausa kompressionerna och analysera. Kom ihåg att återuppta kompressionerna direkt efteråt.",
  done:()=>S.analysisCount>=1},
 {tabs:()=>chockbarNu()?["defib"]:["lakemedel"], unlock:["ladda","chock","pvk","io","adr"],
  spot:()=>chockbarNu()?["ladda","chock"]:["pvk","adr"],
  msg:()=>chockbarNu()
     ? "Rytmen är <b>chockbar (VF/pVT)</b>! <b>Ladda</b> defibrillatorn, helst under pågående kompressioner, och ge en <b>chock</b>. Återuppta kompressioner direkt efter."
     : "Rytmen är <b>icke-chockbar (PEA/asystoli)</b>, här defibrillerar man INTE. Skaffa istället en <b>infart (PVK)</b> under Läkemedel och ge <b>adrenalin 1 mg</b> så snart som möjligt.",
  done:()=>S.shocks>=1||S.adrenalin.length>=1},
 {tabs:["luftvag"], unlock:["o2","svalgtub","igel","intub","capno","maskvent"],
  spot:["o2","igel"],
  msg:()=>"Säkra syresättningen. Öppna fliken <b>Luftväg</b>: ge <b>maximal syrgas</b>, lägg en luftväg (i-gel eller intubation) och koppla <b>kapnografi</b>, den bekräftar tubläget och visar HLR-kvaliteten.",
  done:()=>S.o2max||S.airway!=="ingen"||S.capno},
 {unlock:["switch","lucas","amio300","amio150","lido","vatska"], spot:["switch"],
  msg:()=>"HLR är en <b>upprepad 2-minuterscykel</b>: kompressioner → rytmkontroll → chock om chockbar. Ge <b>adrenalin var 3–5 min</b> och <b>amiodaron efter 3:e chocken</b>. Byt kompressör varje cykel eller sätt en <b>LUCAS</b>. Kör ett par cykler till.",
  done:()=>S.analysisCount>=2},
 {tabs:["diagnostik"], unlock:["anamnes","status","blodgas","us","fast","lung"], spot:["anamnes","us"],
  msg:()=>"Glöm inte VARFÖR patienten fått hjärtstopp, de <b>reversibla orsakerna (4H &amp; 4T)</b>. Öppna <b>Diagnostik</b>: ta anamnes, undersök patienten, ta blodgas och beställ ultraljud till nästa rytmkontroll.",
  done:()=>S.revealed.hist||S.revealed.status||S.revealed.gas||S.revealed.us},
 {tabs:["reversibelt","lakemedel"], unlock:"ALL", spot:[],
  msg:()=>"När du hittat orsaken, <b>behandla den!</b> Fliken <b>4H &amp; 4T</b> har de riktade åtgärderna. Alla verktyg är nu upplåsta. Fortsätt tills du får <b>ROSC</b>, ge sedan post-ROSC-vård och lämna över.",
  done:()=>true}
];
function chockbarNu(){return S.lastKnownRhythm==="VF"||S.lastKnownRhythm==="pVT";}
function resolveList(v){return typeof v==="function"?v():(v||[]);}

function unlockAllTools(){
  S.guideAll=true;
  ACTIONS && Object.values(ACTIONS).forEach(list=>list.forEach(a=>S.unlocked.add(a.id)));
  ALL_TABS.forEach(t=>{ if(t!=="rosc")S.unlockedTabs.add(t); });
}
function applyGuideStep(){
  if(S.mode!=="guide")return;
  const g=GUIDE[S.guideStep]; if(!g)return;
  resolveList(g.tabs).forEach(t=>{ if(!S.unlockedTabs.has(t)){S.unlockedTabs.add(t);S.newTab=t;} });
  if(g.unlock==="ALL")unlockAllTools();
  else (g.unlock||[]).forEach(id=>S.unlocked.add(id));
  S.coachMsg=typeof g.msg==="function"?g.msg():g.msg;
  buildTabs();
  if(S.newTab){curTab=S.newTab;} 
  updateCoach(true);
  renderActions(true);
  flashDrawer();
}
function guideTick(){
  if(S.mode!=="guide")return;
  // ROSC har högsta prioritet: lås upp och fokusera post-ROSC en gång, stoppa vidare stegundervisning
  if(S.rosc){
    if(!S.roscGuided){
      S.roscGuided=true; S.guideDone=true;
      unlockAllTools(); S.unlockedTabs.add("rosc");
      ["p_abcde","p_o2","p_airway","p_ekg","p_bt","p_fluid","p_noradr","p_orsak","p_klar"].forEach(id=>S.unlocked.add(id));
      S.newTab="rosc"; curTab="rosc";
      S.coachMsg="<b>ROSC!</b> Patienten har egen cirkulation. Här i <b>Efter ROSC</b> ger du post-ROSC-vården: ABCDE, titrera syrgas till 94–98 %, kontrollera luftvägen, 12-EKG, blodtrycksmål och åtgärda orsaken. Avsluta med överlämning till IVA.";
      buildTabs(); updateCoach(true); renderActions(true); flashDrawer();
    }
    return;
  }
  if(S.guideDone)return;
  let guard=0;
  while(S.guideStep<GUIDE.length && GUIDE[S.guideStep].done() && guard++<12){
    S.guideStep++;
    if(S.guideStep>=GUIDE.length){S.guideDone=true; if(!S.rosc){S.coachMsg="Du behärskar nu hela flödet, kör vidare på egen hand tills du får ROSC. Lycka till!";updateCoach(true);} break;}
    applyGuideStep();
  }
}
function updateCoach(pulse){
  const el=$("coach");
  if(S.mode!=="guide"){el.classList.add("hidden");return;}
  el.classList.remove("hidden");
  $("coachMsg").innerHTML=S.coachMsg||"";
  $("coachStep").textContent=S.guideDone?"Klar ✓":("Steg "+Math.min(S.guideStep+1,GUIDE.length)+" / "+GUIDE.length);
  if(pulse){el.classList.remove("pulse");void el.offsetWidth;el.classList.add("pulse");}
}

/* ---------- Tick ---------- */
