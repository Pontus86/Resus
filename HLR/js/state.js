let S=null, ticker=null, lastReal=0;
function newState(){
  let forced=null;
  // ?case=N i URL:en tvingar fram ett specifikt fall (används av case-editorn för förhandsgranskning)
  try{ const qp=new URLSearchParams(location.search).get("case"); if(qp!==null && CASES[+qp]) forced=CASES[+qp]; }catch(e){}
  if(!forced){ try{ const f=sessionStorage.getItem("dbgCase"); if(f!==null){forced=CASES[+f]; sessionStorage.removeItem("dbgCase");} }catch(e){} }
  const kase=forced||CASES[Math.floor(Math.random()*CASES.length)];
  const base=CAUSES.find(c=>c.id===kase.cid);
  const cause=Object.assign({},base,{historia:kase.anamnes, caseId:base.id+"-"+CASES.indexOf(kase), diff:kase.diff||1, hidden:!!kase.hidden, fastPos:!!kase.fast, futile:!!kase.futile, trauma:kase.trauma||null});
  if(kase.peaType)cause.peaType=kase.peaType;    // fallet kan finjustera PEA-morfologin
  const sex=Math.random()<0.5?"man":"kvinna";
  const patient={sex,
    skin:["#EBC8A4","#DFB289","#BE8757","#8F5C35"][Math.floor(Math.random()*4)],
    hair:["#2E2A28","#54402E","#8B6B4A","#4A4A4A"][Math.floor(Math.random()*4)]};
  // Enkel (icke-tension) pneumothorax som INTE är orsaken till stoppet.
  // Trubbigt/penetrerande toraxtrauma har ofta en; den är harmlös tills någon
  // sätter en tub och börjar övertrycksventilera.
  let pneumo=null;
  if(cause.id!=="tension"){
    const p = cause.trauma ? 0.45 : (kase.pneumo?1:0.04);
    if(Math.random()<p) pneumo={side:Math.random()<0.5?"höger":"vänster",tension:false,iatrogen:false};
  }
  cause.treatedAt=null;
  const st = {
    cause, causes:[cause], patient, lucas:false, running:false, speed:1, t:0,              // t = sek sedan hjärtstopp (ambulans-HLR 2 min innan ankomst)
    profile:"pontus",   // vald läkarprofil, se DOCTOR_PROFILES (achievements.js) för hela registret + perkarnas effekt
    mode:"veteran", level:"advanced", guideStep:0, guideDone:false, guideAll:false, roscGuided:false,
    unlocked:new Set(), unlockedTabs:new Set(), coachMsg:"", newTab:null,
    rhythm:cause.rytm, fineVF:false, perfusing:false, rosc:false, dead:false, ended:false,
    // HLR
    comp:false, compStart:null, lastSwitch:0, compressorFatigue:1, qWindow:[], handsOff:0, arrestTime:0,
    compStopAt:null,
    // luftväg/ventilation
    airway:"ingen", vent:false, capno:false, o2max:false, o2Safe:false, svalgtub:false, secretions:Math.random()<0.5, suctioned:false,
    ventGap:0, intubFail:0,
    // defib
    pads:false, padPos:"AL", charged:false, chargeAt:null, shocks:0, lastAnalysis:null, analysisCount:0,
    lastKnownRhythm:null, periPauses:[], usNext:false, freshPads:false,
    // access & läkemedel
    access:null, lines:[], ivAttempts:0, cvk:false, pneumo:null, infusions:[], adrenalin:[], amiodaron:0, lidokain:0, drugsGiven:[], timeline:[],
    causeTreatedAt:null, recoverAt:null, roscRecognizeAt:null, cycles:0, roscMinTime:300+Math.round(Math.random()*120), _adrNag:false, _cprNag:false, _waitedAdr:false, treatProgress:{}, warming:0, fluids:0, bicarb:0,
    complication:null, complicationsFired:0, complicationsResolved:0, _compDone:[], nextCompCheck:0, _shockGlitchUsed:false,
    lastComplicationPerformance:0, lastComplicationChance:0,
    charging:false, chargeReadyAt:null, autoShock:false, fastDone:false, lungDone:false, _narkosSuggestAt:0, _narkosSuggested:false, surgeonNeeded:false, preppedLabels:[], mtpActive:false, dranFails:0, blodgrupperad:false, blodgrupperadAt:null, _kAlert:false, _rhythmShift:0,
    // sjuksköterskans förberedelser
    adrReady:0, amioReady:false, protokoll:false, protokollAt:null, _protRoped:false, _protAdrRoped:false,
    // protokollkvalitet: stiger när ssk är ledig, sjunker när hon är upptagen med annat — se trackWorkload/tick
    protokollQuality:0, protokollQualitySum:0, protokollQualityDt:0,
    // monitorering
    nibp:false, spo2probe:false, artline:false, lastPalp:null, kad:false,
    monTemp:null,
    // team-köer (en person – en uppgift i taget)
    queues:{lakare:[],ssk:[],usk:[],ambulans:[],narkos:[],ivassk:[],kirurg:[]}, teamArrived:false, recentFails:[], surgeonPresent:false, surgeonArriveAt:null, _compressor:null, _escLogged:{}, surgeonPendingProc:null, phase:"arrest", patientPresent:true, arrivalIn:0, orders:[],
    // ultraljud
    usDone:false, usActive:false, usFindings:null, usLastAt:null,
    // info
    revealed:{hist:false,gas:false,us:false,status:false}, gasPanel:null,
    // händelser
    cpric:{triggered:false,handled:null},
    refibArmed:false, degradeAt:rnd(600,900),
    // post-ROSC
    post:{abcde:false,ekg:false,o2:false,bt:false,airway:false,orsak:false,dest:null,sbt:0,noradr:false,fluid:0,rearrested:false,
      ekgCall:null,ekgRight:null,decline:0,lowSince:null,crashWarned:false,reArrests:0,stableAt:null},
    roscAt:null, deaths:0,
    // logg & poäng
    log:[], flags:[], busy:{},
    // arbetsbelastning per roll: aktiv tid, tillgänglig tid, komprimeringstid
    workload:{}, workloadTracked:0,
    checksExpected:0, checkDeviation:0, switchesOk:0, switchesMissed:0,
    rhythmQuiz:{correct:0,total:0,pulseCorrect:0,pulseTotal:0},
    sbar:{done:false,score:0,total:0},
    dbpAchieved:false,
    safety:{shockDuringCPR:0,shockAsystole:0,o2Fire:0},
    firstCompAt:null, firstShockAt:null, firstAdrAt:null, endReason:null,
    shockFlash:0
  };
  st.pneumo=pneumo;
  return st;
}

/* ---------- Åtgärdslåda (slide-out) ---------- */
const Drawer={el:null,closeTimer:null,peekTimer:null,pinned:false,
  init(){
    this.el=$("drawer");
    const open=()=>{clearTimeout(this.closeTimer);this.el.classList.add("open");};
    const scheduleClose=()=>{ if(this.pinned)return;
      clearTimeout(this.closeTimer);
      this.closeTimer=setTimeout(()=>this.el.classList.remove("open"),320); }; // liten marginal innan kollaps
    this.el.addEventListener("mouseenter",open);
    this.el.addEventListener("mouseleave",scheduleClose);
    // klick på fliken = fäst/lossa (funkar även på pekskärm)
    $("drawerTab").addEventListener("click",()=>this.togglePin());
    $("pinBtn").addEventListener("click",e=>{e.stopPropagation();this.togglePin();});
  },
  open(){if(!this.el)return;clearTimeout(this.closeTimer);this.el.classList.add("open");},
  close(){if(!this.el)return;if(!this.pinned)this.el.classList.remove("open");},
  togglePin(){if(!this.el)return;this.pinned=!this.pinned;this.el.classList.toggle("pinned",this.pinned);
    if(this.pinned)this.open(); else this.el.classList.remove("open");
    $("pinBtn").textContent=this.pinned?"Fäst ✓":"Fäst";},
  // öppna en stund (t.ex. när guiden visar en ny åtgärd) och kollapsa sen automatiskt
  peek(ms=2600){ if(!this.el||this.pinned)return; this.open();
    clearTimeout(this.peekTimer);
    this.peekTimer=setTimeout(()=>this.close(),ms); }
};
function flashDrawer(){ Drawer.peek(); }

/* ---------- Blodgaspanel (per orsak) ---------- */
// [pH, pCO2 kPa, pO2 kPa, HCO3, BE, Laktat, Krea, Hb, Na, K, Ca(joniserat), Glukos, metHb%, COHb%]
const GAS={
 stemi:   {pH:7.19,pCO2:6.6,pO2:8.8,HCO3:19,BE:-7,Lakt:8.4,Krea:96,Hb:141,Na:139,K:4.3,Ca:1.14,Glu:9.1,metHb:0.8,COHb:1.1},
 pe:      {pH:7.17,pCO2:3.8,pO2:6.8,HCO3:17,BE:-9,Lakt:9.2,Krea:88,Hb:132,Na:140,K:4.0,Ca:1.15,Glu:7.3,metHb:0.9,COHb:0.7},
 hyperk:  {pH:7.04,pCO2:5.9,pO2:10.5,HCO3:13,BE:-14,Lakt:6.1,Krea:892,Hb:104,Na:136,K:8.1,Ca:0.94,Glu:6.8,metHb:0.7,COHb:0.8},
 hypovol: {pH:7.11,pCO2:4.4,pO2:11.8,HCO3:15,BE:-13,Lakt:12.4,Krea:118,Hb:54,Na:141,K:3.9,Ca:1.05,Glu:6.2,metHb:0.9,COHb:0.9},
 tension: {pH:7.14,pCO2:9.7,pO2:5.2,HCO3:22,BE:-4,Lakt:5.6,Krea:92,Hb:138,Na:139,K:4.4,Ca:1.16,Glu:7.9,metHb:1.0,COHb:1.3},
 tamponad:{pH:7.18,pCO2:5.6,pO2:9.6,HCO3:20,BE:-6,Lakt:7.1,Krea:97,Hb:96,Na:140,K:4.1,Ca:1.12,Glu:8.0,metHb:0.8,COHb:0.9},
 hypoxi:  {pH:6.97,pCO2:12.8,pO2:3.4,HCO3:18,BE:-11,Lakt:10.6,Krea:90,Hb:139,Na:139,K:5.1,Ca:1.10,Glu:8.4,metHb:1.1,COHb:1.6},
 cico:    {pH:6.92,pCO2:14.2,pO2:2.9,HCO3:17,BE:-12,Lakt:11.8,Krea:92,Hb:140,Na:139,K:5.2,Ca:1.09,Glu:8.6,metHb:1.2,COHb:1.5},
 toxin:   {pH:7.01,pCO2:6.1,pO2:10.2,HCO3:12,BE:-16,Lakt:8.0,Krea:86,Hb:136,Na:139,K:4.0,Ca:1.13,Glu:7.0,metHb:1.2,COHb:0.9},
 hypotermi:{pH:7.10,pCO2:5.1,pO2:12.4,HCO3:20,BE:-6,Lakt:5.2,Krea:104,Hb:148,Na:140,K:4.8,Ca:1.18,Glu:9.8,metHb:0.8,COHb:0.9},
 hypoca:  {pH:7.14,pCO2:5.4,pO2:11.0,HCO3:20,BE:-5,Lakt:6.0,Krea:95,Hb:130,Na:139,K:4.3,Ca:0.62,Glu:7.0,metHb:0.8,COHb:0.9},
 hypok:   {pH:7.46,pCO2:5.2,pO2:12.0,HCO3:26,BE:2,Lakt:3.0,Krea:90,Hb:135,Na:140,K:2.1,Ca:1.15,Glu:7.0,metHb:0.8,COHb:0.9},
 commotio:{pH:7.18,pCO2:5.6,pO2:10.0,HCO3:19,BE:-6,Lakt:6.0,Krea:78,Hb:142,Na:140,K:4.0,Ca:1.16,Glu:7.2,metHb:0.8,COHb:0.9},
 wpw:     {pH:7.18,pCO2:5.6,pO2:10.0,HCO3:19,BE:-6,Lakt:6.0,Krea:78,Hb:142,Na:140,K:4.0,Ca:1.16,Glu:7.2,metHb:0.8,COHb:0.9},
 longqt:  {pH:7.20,pCO2:5.3,pO2:10.5,HCO3:21,BE:-4,Lakt:4.5,Krea:85,Hb:135,Na:138,K:3.0,Ca:1.15,Glu:7.0,metHb:0.8,COHb:0.9},
 digitalis:{pH:7.10,pCO2:5.8,pO2:9.5,HCO3:16,BE:-10,Lakt:6.5,Krea:220,Hb:148,Na:144,K:6.8,Ca:1.10,Glu:6.5,metHb:0.8,COHb:0.9}
};
const GAS_NORM={pH:[7.35,7.45],pCO2:[4.6,6.0],pO2:[10,13],HCO3:[22,26],BE:[-3,3],Lakt:[0,1.6],
  Krea:[60,105],Hb:[117,170],Na:[137,145],K:[3.5,4.6],Ca:[1.15,1.33],Glu:[4,7.8],metHb:[0,1.5],COHb:[0,2]};
// Slår ihop två orsakers blodgaspaneler (hardcore, två samtidiga orsaker) genom att för
// varje parameter välja det värde som avviker MEST från normalintervallet — så bådas
// karakteristiska rubbning (t.ex. hyperkalemins K 8,1 OCH hypovolemins Hb 54) syns tydligt
// i den kombinerade panelen i stället för att den ena tyst maskeras av den andra.
function mergeGasPanels(gasA, gasB){
  if(!gasA) return gasB;
  if(!gasB) return gasA;
  const out={};
  const keys=new Set([...Object.keys(gasA), ...Object.keys(gasB)]);
  keys.forEach(k=>{
    const a=gasA[k], b=gasB[k];
    if(a==null){ out[k]=b; return; }
    if(b==null){ out[k]=a; return; }
    const norm=GAS_NORM[k];
    if(!norm){ out[k]=a; return; }
    const mid=(norm[0]+norm[1])/2, span=(norm[1]-norm[0])/2;
    const devA=Math.abs(a-mid)/span, devB=Math.abs(b-mid)/span;
    out[k]=devA>=devB?a:b;
  });
  return out;
}
function currentPH(){
  const base=(S.gasPanel&&S.gasPanel.pH)||7.2;
  if(S.rosc)return clamp(base+0.12,7.0,7.45);
  const mins=(S.arrestTime||0)/60;
  let ph=base-0.05*mins;                                   // acidos ackumuleras ~0,05/min
  if(S.vent&&(S.comp||S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi"))ph+=0.018*mins*ventQuality();  // ventilation bromsar (kvalitetsberoende)
  ph+=Math.min(0.28,(S.bicarb||0)*0.09);                   // buffert höjer pH
  return clamp(ph,6.55,base+0.05);
}
function currentK(){
  const base=(S.gasPanel&&S.gasPanel.K)||4.3;
  if(S.rosc)return base;
  let k=base + 0.28*((S.arrestTime||0)/60);            // K stiger i stoppet (cellsönderfall + acidos)
  if(S.treatProgress.kalcium)k-=0.4;                    // kalcium membranstabiliserar (mildrar EKG-effekt)
  k-=0.3*Math.min(2,(S.bicarb||0));
  return clamp(k, base, 9.0);
}
function gasRows(){
  const g=S.gasPanel, jit=(v,d)=>Math.round((v+rnd(-d,d))*100)/100;
  const rows=[
    ["pH",jit(currentPH(),.01).toFixed(2),""],["pCO₂",jit(g.pCO2,.1).toFixed(1),"kPa"],
    ["pO₂",jit(g.pO2,.2).toFixed(1),"kPa"],["HCO₃⁻",Math.round(g.HCO3),"mmol/L"],
    ["BE",(g.BE>0?"+":"")+Math.round(g.BE),""],["Laktat",jit(g.Lakt,.2).toFixed(1),"mmol/L"],
    ["Krea",Math.round(g.Krea),"µmol/L"],["Hb",Math.round(g.Hb),"g/L"],
    ["Na⁺",Math.round(g.Na),"mmol/L"],["K⁺",jit(currentK(),.05).toFixed(1),"mmol/L"],
    ["Ca²⁺",jit(g.Ca,.02).toFixed(2),"mmol/L"],["Glukos",jit(g.Glu,.2).toFixed(1),"mmol/L"],
    ["metHb",jit(g.metHb,.1).toFixed(1),"%"],["COHb",jit(g.COHb,.1).toFixed(1),"%"]
  ];
  const keymap=["pH","pCO2","pO2","HCO3","BE","Lakt","Krea","Hb","Na","K","Ca","Glu","metHb","COHb"];
  const abn=(k,v)=>{const n=GAS_NORM[k];return v<n[0]||v>n[1];};
  return rows.map((r,i)=>({label:r[0],val:r[1],unit:r[2],abn:abn(keymap[i],g[keymap[i]])}));
}
function gasStr(rows){ return (rows||gasRows()).map(r=>r.label+" "+r.val+(r.unit?" "+r.unit:"")+(r.abn?" ⚠":"")).join("  ·  "); }
function gasFmt(){ return gasStr(gasRows());

}

/* ---------- Kärntemperatur & ABCDE-status ---------- */
function coreTemp(){
  if(S.causes.some(c=>c.id==="hypotermi")){
    return S.warming ? clamp(27.6+(S.t-S.warming)/60*0.85, 27.6, 36.4) : 27.6;
  }
  return S.rosc?36.7:35.8;
}
function airwayNote(){
  if(S.airway==="tub")return "trakealtub"+(S.capno?", kapnografi bekräftad":", kapnografi ej kopplad");
  if(S.airway==="igel")return "i-gel (larynxmask)";
  if(S.airway==="koniotomi")return "kirurgisk luftväg (koniotomi)";
  if(S.airway==="mask")return "mask–blåsa";
  if(S.svalgtub)return "svalgtub, mask–blåsa";
  return "ofri utan hjälpmedel";
}
// Varje steg returnerar en text; inled med ★ om fyndet förbättrats efter riktad åtgärd.
const ABCDE={
 stemi:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud, thorax höjs symmetriskt, ingen halsvenstas",
  C:()=>S.rosc?"svag central puls återkommen, fortsatt marmorerad perifert":"pulslös, blek och marmorerad, kapillär återfyllnad >4 s",
  D:()=>"medvetslös, GCS 3, ljusstela normalstora pupiller",
  E:()=>"kallsvettig, inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"},
 pe:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud, svår att syresätta trots god ventilation",
  C:()=>S.treatProgress.trombolys||S.causeTreatedAt?"★ halsvenstasen avtar, begynnande central cirkulation efter trombolys":"pulslös, uppdriven halsvenstas, cyanos i övre kroppshalvan",
  D:()=>"medvetslös, GCS 3, vida pupiller",
  E:()=>"ensidigt svullet, ömt vadben (DVT-tecken) · temp "+coreTemp().toFixed(1)+" °C"},
 hyperk:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.treatProgress.kalcium?"★ QRS smalnar på monitorn efter kalcium (membranstabilisering)":"pulslös, breddökade QRS på monitorn",
  D:()=>"medvetslös, GCS 3",
  E:()=>"AV-fistel vänster underarm, perifera ödem (dialyspatient) · temp "+coreTemp().toFixed(1)+" °C"},
 hypovol:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.fluids>=2||S.causeTreatedAt?"★ begynnande perifer återfyllnad, mindre uttalad blekhet efter volym/blod":"pulslös, uttalat blek, tomma perifera kärl, inga halsvener syns",
  D:()=>"medvetslös, GCS 3",
  E:()=>"uppspänd, öm buk · blek och kall perifert · temp "+coreTemp().toFixed(1)+" °C"},
 tension:{
  A:()=>"fri, trachea "+(S.treatProgress.naldekomp?"i medellinjen":"devierad åt motsatt sida"),
  B:()=>S.treatProgress.naldekomp?"★ andningsljud åter bilateralt, nu lättventilerad (efter dekompression)":"ensidigt upphävda andningsljud, hypersonor perkussion, svårventilerad, halsvenstas",
  C:()=>"pulslös"+(S.treatProgress.naldekomp?", halsvenstasen avtagande":", kraftig halsvenstas"),
  D:()=>"medvetslös, GCS 3",
  E:()=>"subkutant emfysem över thorax · temp "+coreTemp().toFixed(1)+" °C"},
 tamponad:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.treatProgress.perikard?"★ halsvenstasen avtar och hjärttonerna blir tydligare efter perikardiocentes":"pulslös, kraftig halsvenstas, dämpade hjärttoner, smalt pulstryck (Becks triad)",
  D:()=>"medvetslös, GCS 3",
  E:()=>"sternotomiärr (nyligen hjärtopererad) · temp "+coreTemp().toFixed(1)+" °C"},
 hypoxi:{
  A:()=>"segt sekret i luftvägen, "+airwayNote(),
  B:()=>S.o2max&&(S.airway==="tub"||S.airway==="igel")?"★ andningsljuden förbättras och cyanosen minskar med syrgas och god ventilation":"kraftigt obstruktiva/upphävda andningsljud, förlängt expirium, mycket svårventilerad",
  C:()=>"pulslös, central cyanos"+(S.o2max?", avtagande":""),
  D:()=>"medvetslös, GCS 3",
  E:()=>"inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"},
 cico:{
  A:()=>S.airway==="koniotomi"?"★ kirurgisk luftväg (koniotomi) på plats, fri passage nedanför obstruktionen":"TOTAL övre luftvägsobstruktion, går ej att ventilera, i-gel tätar ej, tuben passerar ej",
  B:()=>S.airway==="koniotomi"&&S.o2max?"★ nu ventilerbar via koniotomin, cyanosen minskar":"ingen luft in eller ut, ingen bröstkorgsrörelse, tysta lungor",
  C:()=>"pulslös, djup central cyanos"+(S.airway==="koniotomi"?", avtagande":""),
  D:()=>"medvetslös, GCS 3",
  E:()=>"griper reflexmässigt mot halsen initialt (kvävningstecken) · temp "+coreTemp().toFixed(1)+" °C"},
 toxin:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.treatProgress.bikarbonat?"★ breddökade QRS smalnar efter natriumbikarbonat":"pulslös, breddökade QRS på monitorn",
  D:()=>"medvetslös, GCS 3, vida pupiller (antikolinergt)",
  E:()=>"tomma tablettkartor i fickorna · temp "+coreTemp().toFixed(1)+" °C"},
 hypotermi:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"långsam, ytlig egenandning saknas · sidlika andningsljud",
  C:()=>"pulslös, iskall och stel, svårpalperade kärl",
  D:()=>"medvetslös, ljusstela pupiller",
  E:()=>(S.warming?"★ kärntemperaturen stiger under aktiv uppvärmning · ":"iskall, marmorerad hud, våta kläder · ")+"kärntemp "+coreTemp().toFixed(1)+" °C"+(S.kad?" (kontinuerligt via KAD)":"")},
 hypoca:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.treatProgress.kalcium?"★ QRS smalnar och QT normaliseras efter kalcium":"pulslös, breddökade QRS med förlängt QT på monitorn",
  D:()=>"medvetslös, GCS 3",
  E:()=>"karpopedala spasmer (hopdragna händer) · temp "+coreTemp().toFixed(1)+" °C"},
 hypok:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>S.treatProgress.magnesium?"★ myokardiet stabiliserat efter magnesium, flimret bör nu gå att bryta":"pulslös, refraktärt kammarflimmer (föregånget av polymorf VT/torsades)",
  D:()=>"medvetslös, GCS 3",
  E:()=>"uttalad muskelsvaghet noterad före stoppet · temp "+coreTemp().toFixed(1)+" °C"},
 commotio:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud, ingen halsvenstas",
  C:()=>"pulslös, i övrigt välcirkulerad ung patient, inga tecken till annan orsak",
  D:()=>"medvetslös, GCS 3, normalstora pupiller",
  E:()=>"ung, tidigare frisk, tydligt märke efter slaget mot bröstbenet, i övrigt inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"},
 wpw:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>"pulslös, i övrigt välcirkulerad, inga tecken till strukturell hjärtsjukdom",
  D:()=>"medvetslös, GCS 3",
  E:()=>"ung, tidigare frisk, inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"},
 longqt:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>"pulslös, polymorf kammartakykardi (torsades) föregick stoppet",
  D:()=>"medvetslös, GCS 3",
  E:()=>"inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"},
 digitalis:{
  A:()=>"fri, "+airwayNote(),
  B:()=>"sidlika andningsljud",
  C:()=>"pulslös, bidirektionell kammartakykardi föregick stoppet",
  D:()=>"medvetslös, GCS 3, illamående och synrubbningar (gulseende) enligt anhörig innan kollapsen",
  E:()=>"inga yttre skador · temp "+coreTemp().toFixed(1)+" °C"}
};
// I hardcore-läge med två samtidiga orsaker slås resultatet ihop från BÅDA orsakernas
// egna (oförändrade) ABCDE-funktioner i stället för att skriva nya kombinationstexter för
// varje möjligt par — så alla ~19 orsakers befintliga fynd återanvänds automatiskt.
function abcdeLine(step){
  const lines=(S.causes||[S.cause]).map(c=>{ const set=ABCDE[c.id]; return set?set[step]():null; }).filter(Boolean);
  if(!lines.length) return "utan anmärkning";
  return [...new Set(lines)].join(" · ");
}
// De fem stegen kan hamna hos olika teammedlemmar (läkare/narkos/kirurg via
// eskaleringskedjan) och blir därför klara i oförutsägbar ordning. Resultaten buffras
// därför och skrivs ut i bokstavsordning A→E först när samtliga fem är klara, i stället
// för att logga varje steg löpande i den (eventuellt omkastade) ordning de blir färdiga.
const ABCDE_STEP_NAMES={A:"Luftväg",B:"Andning",C:"Cirkulation",D:"Medvetande",E:"Exponering"};
function examStep(letter,results){
  enqueue("lakare","Status "+letter,3,()=>{
    results[letter]=abcdeLine(letter);
    if(letter==="E")S.revealed.status=true;
    if(Object.keys(results).length===5){
      Object.keys(ABCDE_STEP_NAMES).forEach(L=>{
        const s=results[L], good=s.includes("★");
        log(L+" · "+ABCDE_STEP_NAMES[L]+": "+s.replace(/★\s*/g,""), good?"ok":"warn");
      });
    }
    return {};
  },"ABCDE-bedömning");
}
function doExamABCDE(){
  log("ABCDE-undersökning påbörjas …","sys");
  const results={};
  Object.keys(ABCDE_STEP_NAMES).forEach(letter=>examStep(letter,results));
}

/* ---------- Team-köer: en roll = en uppgift i taget ---------- */
const ROLE_NAMES={lakare:"Läkare (du)",ssk:"Sjuksköterska",usk:"Undersköterska",ambulans:"Ambulanspersonal",narkos:"Narkosläkare",ivassk:"Narkossköterska",kirurg:"Kirurg"};
const TEAM=[
 {role:"lakare",from:0},{role:"ssk",from:0},{role:"usk",from:0},{role:"ambulans",from:0},
 {role:"narkos",from:240},{role:"ivassk",from:240}
];
function available(role){if(role==="kirurg")return S.surgeonPresent;const m=TEAM.find(t=>t.role===role);return !!m&&S.t>=m.from;}
function roleBusy(role){return (S.queues[role]||[]).length>0;}
// Routing: kategori -> faktisk person. "nurse" fördelas på ssk/narkos-ssk, "airway" på undersköterska/narkosläkare.
/* Åtgärder som kräver hands-off: pausa kompressionerna medan de pågår.
   Pausen räknas in i kompressionsfraktionen precis som peri-chock-pausen. */
/* Pneumothorax + övertrycksventilation via tub/i-gel → ventilpneumothorax.
   Luft pressas in i pleura vid varje andetag och kan inte ut. Utvecklas över ~45 s,
   med stigande lufttryck och fallande EtCO₂ som varning innan den konverterar. */
function tickPneumo(dt){
  const p=S.pneumo;
  if(!p||p.definitive)return;              // thoraxdrän = definitiv, kan aldrig återkomma
  if(p.tension)return;
  const seal = (S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi");
  if(!(seal&&S.vent)){ p.build=Math.max(0,(p.build||0)-dt*0.5); return; }
  p.build=(p.build||0)+dt;
  if(p.build>14&&!p._w1){p._w1=true;
    log("Patienten blir svårventilerad, stigande lufttryck i ventilatorn. Andningsljudet är svagare på "+p.side+" sida.","warn");}
  if(p.build>30&&!p._w2){p._w2=true;
    log("EtCO₂ faller trots oförändrade kompressioner. Halsvenerna spänner. Något stiger i thorax.","bad");}
  if(p.build>=45){
    p.tension=true;
    mark(p.reTension?"Ventilpneumothorax (återkommer)":"Ventilpneumothorax","complication");
    if(!p.reTension) flag(p.iatrogen?"Iatrogen pneumothorax utvecklades till ventilpneumothorax under övertrycksventilation"
                   :"Pneumothorax utvecklades till ventilpneumothorax under övertrycksventilation",-10);
    S.perfusing=false;
    if(S.rosc){ log("⚠ Ventilpneumothorax "+p.side+", trycket faller katastrofalt.","bad"); S.post.sbt=Math.min(S.post.sbt,44); }
    else { S.rhythm="PEA"; S.cause.peaType="brady"; }
    log("⚠ VENTILPNEUMOTHORAX ("+p.side+")"+(p.reTension?" IGEN, nålen räcker inte, den ockluderas. Lägg ett thoraxdrän.":": trakea devierad, halsvenstas, upphävt andningsljud. Övertrycksventilationen har pumpat upp pleuran.")+" Dekomprimera NU.","bad");
  }
}
function relievePneumo(how){
  const p=S.pneumo; if(!p)return false;
  const wasTension=p.tension;
  p.tension=false; p.build=0; p._w1=p._w2=false; p.drained=true;
  if(how==="nåldekompression") p.reTension=true;   // nålen är tillfällig, kan pysa igen
  if(wasTension){
    mark("Dekomprimerad","cause");
    flag("Ventilpneumothorax dekomprimerad med "+how,+8);
  }
  return wasTension;
}

/* Infusioner: sjuksköterskan kopplar påsen (kötid) och går vidare, men volymen
   är inte inne i patienten förrän den runnit klart. Klara vätskor 30 s, blod 60 s.
   Effekten (S.fluids) bokförs först när infusionen är färdig. */
function startInfusion(kind,label,dur,vol,doneFn){
  if(DBG.on&&DBG.instant)dur=0.1;
  S.infusions.push({kind,label,dur,left:dur,vol,doneFn});
  log(label+" kopplad, rinner in på "+dur+" s.","info");
}
function tickInfusions(dt){
  for(let i=S.infusions.length-1;i>=0;i--){
    const inf=S.infusions[i];
    inf.left-=dt;
    if(inf.sbtPerSec&&S.rosc) S.post.sbt=Math.min(S.post.noradr?128:112, S.post.sbt+inf.sbtPerSec*dt);
    if(inf.left<=0){
      S.infusions.splice(i,1);
      S.fluids+=inf.vol;
      if(inf.doneFn)inf.doneFn();
    }
  }
}
function infusionRunning(){ return S.infusions.length>0; }
function infusionLabel(){
  if(!S.infusions.length)return "";
  return S.infusions.map(i=>i.label+" "+Math.max(0,Math.ceil(i.left))+" s").join(" · ");
}

// En paus är hands-off, inte ett personbyte: samma person återupptar efteråt.
/* Varje misslyckat dränförsök gör nästa svårare: blod, svullnad och förstörd anatomi. */
function dranFailChance(){ return Math.min(0.75, 0.40 + 0.15*(S.dranFails||0)); }
function pauseComp(){ if(S.comp){ S.comp=false; S.compStopAt=S.t; S._pausedFor=true; } }
function resumeComp(){ if(S._pausedFor&&!S.rosc&&!S.ended){ S._pausedFor=false; S.comp=true; S.compStopAt=null; } else S._pausedFor=false; }

/* ---------- Kompetenstrappa och eskalering ----------
   Kompressioner är ett ANKAR, inte en uppgift: den som komprimerar är upptagen
   och kan inte göra något annat. Uppgiften flyttas i stället uppåt i kompetens.
   En underskötersk-uppgift kan göras av sjuksköterska eller läkare, aldrig tvärtom. */
const TIER={usk:1, ambulans:1, ssk:2, ivassk:2, lakare:3, narkos:3, kirurg:3};
const ESCALATION={
  usk:      ["usk","ambulans","ssk","ivassk","lakare"],
  ambulans: ["ambulans","usk","ssk","ivassk","lakare"],
  ssk:      ["ssk","ivassk","lakare"],
  ivassk:   ["ivassk","ssk","narkos","lakare"],
  lakare:   ["lakare","narkos","kirurg"],
  narkos:   ["narkos","lakare"],
  kirurg:   ["kirurg","lakare"]
};
/* Vem komprimerar just nu? Den lägsta lediga i kompressionsordningen.
   LUCAS gör att ingen människa binds. */
const COMP_ORDER=["usk","ambulans","ivassk","ssk","lakare"];
const COMP_LABEL={usk:"USK",ambulans:"AMBULANS",ivassk:"NARKOS-SSK",ssk:"SSK",lakare:"⚠ DU (LÄKARE)",narkos:"NARKOSLÄK",kirurg:"KIRURG"};
/* Vem är ankrad vid bröstet? Under en kort hands-off-paus står personen kvar
   vid patienten, därför behåller vi identiteten och släpper den bara vid
   LUCAS, ROSC eller scenarioslut. */
function compressor(){
  if(S.lucas||S.rosc||S.ended)return null;
  if(!S.comp&&!S._pausedFor)return null;
  if(S._compressor&&available(S._compressor))return S._compressor;
  for(const r of COMP_ORDER){ if(available(r)){ S._compressor=r; return r; } }
  return null;
}
/* Ankrad ≠ blockerad. Under en hands-off-paus står personen kvar men händerna är fria. */
function handsOnChest(){ return (S.comp&&!S.lucas&&!S.rosc&&!S.ended)?compressor():null; }
function isOccupied(role){ return role===handsOnChest(); }
/* Vem sköter den kontinuerliga ventilationen just nu? Prioritera narkossköterska,
   sedan narkosläkare, annars ambulans, men aldrig samma person som håller
   händerna på bröstet. Räknas om varje tick så att ingen ventilerar och
   komprimerar samtidigt. */
const VENT_ORDER=["ivassk","narkos","ambulans","ssk","usk","lakare"];
function ventilator(){
  if(!S.vent||S.rosc||S.ended)return null;
  const chest=handsOnChest();
  // behåll nuvarande om den fortfarande går bra (tillgänglig och inte komprimerar)
  if(S.ventBy&&available(S.ventBy)&&S.ventBy!==chest)return S.ventBy;
  for(const r of VENT_ORDER){ if(available(r)&&r!==chest)return r; }
  return null;
}
/* Dokumentation är, precis som kompressioner/ventilation, en levande ANKRAD aktivitet
   snarare än ett engångsklick: sjuksköterskan dokumenterar exakt så länge protokollet är
   igång och hon är fri (varken komprimerar eller har en uppgift i sin kö) — och avbryter
   TVÄRT så fort hon får en annan uppgift, precis som i verkligheten. Enda källan till
   sanning för "är hon ledig att dokumentera just nu?", använd av både kvalitetsmätaren
   (tick.js) och poängen för färdiga åtgärder (processQueues). */
function documenting(){
  if(!S.protokoll||S.rosc||S.ended)return false;
  if(S._compressor==="ssk")return false;
  const q=S.queues.ssk;
  return !(q&&q.length);
}
function queueLoad(role){ return (S.queues[role]||[]).length; }

/* Välj den bäst lämpade personen: gå uppåt i kompetens tills någon
   varken komprimerar eller är märkbart mer belastad. */
function assignRole(base){
  const chain=(ESCALATION[base]||[base]).filter(r=>available(r)&&TIER[r]>=TIER[base]);
  if(!chain.length)return base;
  const owner=chain[0];
  // 1) Ägaren komprimerar → uppgiften måste gå vidare. Kompressioner går först.
  // 2) Ägaren har ≥2 fler uppgifter i kön än en kandidat → avlasta (Eric: redan ≥1, teamet avlastar varandra snabbare).
  const free=chain.filter(r=>!isOccupied(r));
  if(!free.length)return owner;                        // alla komprimerar (kan inte hända)
  if(isOccupied(owner)){
    const best=free.reduce((a,b)=>queueLoad(a)<=queueLoad(b)?a:b);
    if(best!==owner&&!S._escLogged[base+best]){S._escLogged[base+best]=1;
      log(ROLE_NAMES[best]+" tar över uppgiften, "+ROLE_NAMES[owner].replace(" (du)","")+" komprimerar och kan inte släppa bröstet.","sys");}
    return best;
  }
  const escThreshold=S.profile==="eric"?1:2;
  const best=free.reduce((a,b)=>queueLoad(a)<=queueLoad(b)?a:b);
  if(best!==owner&&queueLoad(owner)-queueLoad(best)>=escThreshold){
    log(ROLE_NAMES[best]+" avlastar "+ROLE_NAMES[owner].replace(" (du)","")+" som har fullt upp.","sys");
    return best;
  }
  return owner;
}

/* Uppgifter som ENDAST en viss kompetens får göra, dessa eskalerar aldrig. */
const STRICT={airway_adv:"narkos", kirurg:"kirurg"};
function routeRole(cat){
  if(STRICT[cat]) return STRICT[cat];
  if(cat==="nurse") return assignRole("ssk");   // ssk är ägaren; assignRole avlastar till ivassk vid behov
  if(cat==="airway") return assignRole(available("narkos")?"narkos":"ambulans");
  return assignRole(cat); // lakare, ssk, usk, narkos, ivassk
}
const PROFILE_DRUG_RE=/adrenalin|amiodaron|lidokain|kalcium|magnesium|digoxin|buffert|Tribonat|trombolys/i;
const PROFILE_ULTRALJUD_RE=/ultraljud|FAST-scan/i;
function enqueue(cat,label,dur,doneFn,group,opts){
  const role=routeRole(cat);
  if(S.profile==="pontus")dur=dur*0.7;   // Pontus: proceduralist, alla procedurer 30 % snabbare
  // Math.max(5,...) i stället för en ren multiplikation: annars kan ett redan kort moment
  // (t.ex. "färdig spruta"-adrenalin, dur 3) hamna strax UNDER 5-sekundersgolvet nedan och
  // triggra dess "+5"-tillägg, vilket paradoxalt gör det LÅNGSAMMARE än utan perken.
  if(S.profile==="freja"&&(cat==="airway"||cat==="airway_adv"))dur=Math.max(5,dur*0.6);   // Freja: anestesiolog, luftväg 40 % snabbare
  if(S.profile==="priya"&&cat==="nurse"&&PROFILE_DRUG_RE.test(label))dur=Math.max(5,dur*0.6);   // Priya: farmakolog, läkemedel 40 % snabbare
  if(S.profile==="johan"&&cat==="lakare"&&PROFILE_ULTRALJUD_RE.test(label))dur=Math.max(5,dur*0.5);   // Johan: ultraljud 50 % snabbare
  // Akut prioritet (rytmkontroll): läggs direkt efter pågående uppgift, glöms aldrig, köas aldrig bakom annat.
  if(opts&&opts.jump){
    const q=S.queues[role];
    if(q.some(t=>t.label===label))return;
    const task={label,dur:Math.max(2,dur),remaining:Math.max(2,dur),done:doneFn,started:false,forget:false,group,jump:true};
    const running=(q.length&&q[0].started)?1:0;   // avbryt inte något som redan påbörjats
    q.splice(running,0,task);
    if(q.length>running+1)log(ROLE_NAMES[role]+": "+label+" går före, övriga uppgifter får vänta.","warn");
    else log(ROLE_NAMES[role]+": "+label+" påbörjas.","sys");
    return;
  }
  if(DBG.on&&DBG.instant)dur=0.1;          // debug: hoppa över kötiden
  else if(dur<5)dur+=5;                    // inget moment går på under ~5 s (realistiskt golv)
  // Överbelastning kostar tid: en stressad person arbetar långsammare, inte slarvigare.
  const load=(S.queues[role]||[]).length;
  if(load>=1)dur=Math.round(dur*(1+0.18*load));   // +18 % per uppgift som redan väntar
  if(S._preppedNow)dur=Math.max(2,dur*0.5);   // förbeordrat: utrustningen är redan framdukad
  if(S.preppedLabels&&S.preppedLabels.length&&S.preppedLabels.some(s=>label.includes(s)))dur=Math.max(2,dur*0.5);
  if(S.queues[role].some(t=>t.label===label)){log(ROLE_NAMES[role]+": "+label+" är redan i kön.","sys");return;}
  const q=S.queues[role];
  const groupMember=group&&q.find(t=>t.group===group);   // delprocedur i en redan köad procedur?
  let forget, firstOfUnit=true;
  if(groupMember){ forget=groupMember.forget; firstOfUnit=false; }   // ärver hela procedurens glömsk-beslut
  else {
    // räkna distinkta "enheter" i kön (en grupp = en enhet) → köplats
    const units=new Set(); q.forEach(t=>units.add(t.group||t.label));
    const pos=units.size+1;
    let forgetChance={1:0,2:0.04,3:0.18,4:0.40}[pos] ?? 0.60;
    if(S.profile==="oskar")forgetChance*=0.4;   // Oskar: veteran, glömmer sällan uppgifter vid hög belastning
    forget=(S.mode==="veteran") && S.profile!=="eric" && risk(forgetChance);   // Eric: teamledare, glömmer aldrig
  }
  q.push({label,dur,remaining:dur,done:doneFn,started:false,forget,group,handsOff:!!(opts&&opts.handsOff)});
  if(firstOfUnit){
    const units=new Set(); q.forEach(t=>units.add(t.group||t.label)); const pos=units.size;
    const name=group||label;
    log(ROLE_NAMES[role]+": "+name+(pos>1?" ställd i kö (plats "+pos+")"+(pos>=3?", hög arbetsbelastning, risk att det glöms.":"."):" påbörjas."),pos>=4?"warn":"sys");
  }
}
function processQueues(dt){
  const busy=handsOnChest();    // den som håller händerna på bröstet gör inget annat
  for(const role of Object.keys(S.queues)){
    const q=S.queues[role]; if(!q.length)continue;
    if(role===busy){
      // Uppgiften ligger kvar men rör sig inte, personen komprimerar.
      if(!q[0]._stalled){ q[0]._stalled=true;
        log(ROLE_NAMES[role]+" kan inte påbörja "+q[0].label+", händerna är på bröstet.","warn"); }
      continue;
    }
    if(q[0]._stalled)q[0]._stalled=false;
    // hoppa förbi uppgifter/procedurer som glömts bort pga för många köade saker på samma person
    if(q[0].forget && !q[0].started){
      const t=q[0], nm=t.group||t.label;
      if(t.group){ while(q.length && q[0].group===t.group) q.shift(); }  // hela proceduren glöms som en helhet
      else q.shift();
      log(ROLE_NAMES[role]+" hann inte med i röran och glömde: "+nm+", dubbelkolla och be dem göra om.","bad");
      S.recentFails.push({txt:ROLE_NAMES[role]+": "+nm+" GLÖMD (för många uppgifter i kö)",at:S.t});
      continue;
    }
    const task=q[0];
    if(!task.started && task.handsOff) pauseComp();   // pausa kompressioner precis när ingreppet FAKTISKT börjar, inte redan i kön
    task.started=true; task.remaining-=dt;
    if(task.remaining<=0){
      // Fånga läget INNAN done() körs (som annars kan hinna ändra hennes kö) — dokumenterar
      // hon just nu (ledig, protokoll igång) när åtgärden blir klar, antecknar hon den: +1p.
      // Aldrig hennes EGEN uppgift (då var hon upptagen med just den, inte dokumentation).
      const documented = role!=="ssk" && documenting();
      q.shift();
      const res=task.done?task.done():null;
      if(res&&res.fail){
        S.recentFails.push({txt:ROLE_NAMES[role]+": "+task.label+" MISSLYCKADES"+(res.why?", "+res.why:""),at:S.t});
        if(res.log)log(res.log,"bad");
      } else if(res&&res.log){ log(res.log,res.cls||"ok"); }
      if(res&&res.after)res.after();
      if(documented){
        flag("Sjuksköterskan dokumenterade: "+task.label,+1);
        log("Sjuksköterskan (protokoll): \u201d"+task.label+" – noterat.\u201d","sys");
      }
    }
  }
  S.recentFails=S.recentFails.filter(f=>S.t-f.at<3.2);
}

/* ---------- Arbetsbelastning per person ----------
   Räknar, sekund för sekund, hur stor andel av tiden varje tillgänglig
   teammedlem faktiskt gör något (uppgift i kön eller komprimerar) mot hur
   länge de har varit på plats. Ger ledaren en bild av hur väl teamet nyttjas. */
function trackWorkload(dt){
  if(dt<=0||S.rosc||S.ended)return;
  const chest=handsOnChest();
  // Håll ventilatören uppdaterad: om den som ventilerar nu måste komprimera,
  // lämnar någon annan över ventilationen (loggas när det faktiskt byter person).
  if(S.vent){
    const vent=ventilator();
    if(vent!==S.ventBy){
      const gammal=S.ventBy;
      S.ventBy=vent;
      if(gammal&&vent&&gammal===chest&&!S.rosc&&!S.ended)
        log(ROLE_NAMES[vent].replace(" (du)","")+" tar över ventilationen när "+ROLE_NAMES[gammal].replace(" (du)","")+" måste hålla händerna på bröstet.","sys");
    }
  }
  const venter=(S.vent)?S.ventBy:null;
  for(const t of TEAM){
    const role=t.role;
    if(!available(role))continue;                 // ännu inte på plats → räknas inte
    let w=S.workload[role]; if(!w){ w={avail:0,active:0,comp:0,vent:0}; S.workload[role]=w; }
    w.avail+=dt;
    const q=S.queues[role];
    const working=(role===chest) || (role===venter) || (q&&q.length&&q[0].started&&!q[0]._stalled);
    if(working)w.active+=dt;
    if(role===chest)w.comp+=dt;
    if(role===venter)w.vent+=dt;
  }
  S.workloadTracked+=dt;
}


/* ---------- Debugpanel (F9, eller ?debug i URL) ---------- */
function dbgPanel(){
  let el=$("dbgPanel");
  if(!DBG.on){ if(el)el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="dbgPanel"; el.className="dbg"; document.body.appendChild(el); }
  const cb=(k,txt)=>`<label><input type="checkbox" data-k="${k}" ${DBG[k]?"checked":""}>${txt}</label>`;
  el.innerHTML=`<h4>Debug · F9</h4>`+
    cb("unlock","Lås upp allt")+
    cb("instant","Momentant (0,1 s)")+
    cb("noFail","Inga misslyckanden")+
    cb("freeROSC","ROSC utan villkor")+
    `<div class="row">
       <button data-a="rosc">Ge ROSC</button>
       <button data-a="treat">Åtgärda orsak</button>
     </div>
     <div class="row">
       <button data-a="skip60">+60 s</button>
       <button data-a="pneumo">Pneumothorax</button>
     </div>
     <select data-a="cause"><option value="">byt orsak (startar om)</option>${
       CAUSES.map(c=>`<option value="${c.id}" ${S.cause&&S.cause.id===c.id?"selected":""}>${c.namn}</option>`).join("")}</select>
     <div class="hint" id="dbgHint">Orsak: <span class="warn">${S.cause?S.cause.namn:"–"}</span>${S.cause&&S.cause.futile?" (utsiktslöst)":""}<br>
       Rytm: ${S.rhythm||"–"} · t=${mmss(S.t||0)}${DBG.instant?'<br><span class="warn">Momentant döljer kö-/eskaleringssystemet.</span>':""}</div>`;
  el.querySelectorAll("input[data-k]").forEach(b=>b.onchange=()=>{
    DBG[b.dataset.k]=b.checked; if(b.checked)S._dbgUsed=true; buildTabs(); renderActions(true); dbgPanel();});
  el.querySelectorAll("button[data-a]").forEach(b=>b.onclick=()=>{dbgAction(b.dataset.a);});
  const sel=el.querySelector("select[data-a=cause]");
  if(sel)sel.onchange=()=>{ if(sel.value)dbgForceCause(sel.value); };
}
function dbgTick(){
  if(!DBG.on)return;
  const h=$("dbgHint"); if(!h)return;
  h.innerHTML=`Orsak: <span class="warn">${S.cause?S.cause.namn:"–"}</span>${S.cause&&S.cause.futile?" (utsiktslöst)":""}<br>`+
    `Rytm: ${S.rhythm||"–"} · t=${mmss(S.t||0)}${S.rosc?" · ROSC · sbt "+Math.round(S.post.sbt):""}`+
    (DBG.instant?'<br><span class="warn">Momentant döljer kö-/eskaleringssystemet.</span>':"");
}
function dbgAction(a){
  S._dbgUsed=true;
  if(a==="rosc"){
    if(S.rosc){log("DEBUG: redan ROSC.","sys");return;}
    if(S.causeTreatedAt===null)S.causeTreatedAt=S.t;
    S.perfusing=true; achieveROSC();
  }
  else if(a==="treat"){ if(S.causeTreatedAt===null){S.causeTreatedAt=S.t; mark("Orsak åtgärdad (debug)","cause"); log("DEBUG: orsaken markerad som åtgärdad.","sys");} }
  else if(a==="skip60"){ S.t+=60; log("DEBUG: +60 s.","sys"); }
  else if(a==="pneumo"){
    S.pneumo=S.pneumo||{side:"höger",tension:false,iatrogen:false,build:0};
    log("DEBUG: pneumothorax "+S.pneumo.side+" tillagd. Intubera och ventilera för att utlösa tension.","sys");
  }
  buildTabs(); renderActions(true); dbgPanel();
}
function dbgForceCause(id){
  const kase=CASES.find(k=>k.cid===id);
  if(!kase){log("DEBUG: inget fall för "+id,"bad");return;}
  const i=CASES.indexOf(kase);
  sessionStorage.setItem("dbgCase",String(i));
  location.reload();
}

/* ---------- Logg ---------- */
function log(msg,cls="info"){
  S.log.push({t:S.t,msg,cls});
  const el=document.createElement("div");
  el.innerHTML=`<span class="t">${mmss(S.t)}</span><span class="${cls}">${msg}</span>`;
  $("log").appendChild(el); $("log").scrollTop=1e9;
}
function flag(txt,pts){S.flags.push({txt,pts});}
function pulseAbort(){ const b=$("btnAbort"); if(b){ b.classList.add("nudge"); setTimeout(()=>{const x=$("btnAbort");if(x)x.classList.remove("nudge");},8000); } }
// tidslinje-händelse (för debriefing); undviker dubbletter på samma sekund/etikett
function mark(label,kind){
  if(S.timeline.some(e=>e.label===label&&Math.abs(e.t-S.t)<1))return;
  S.timeline.push({t:S.t,label,kind});
}

/* ---------- Åtgärder ---------- */
function drugOK(){ if(!S.access){log("Ingen fungerande infart, sätt PVK, IO eller CVK först.","warn");return false;} return true;}
function syncAccess(){ S.access = S.lines.length ? (S.lines.includes("iv")?"iv":S.lines[0]) : null; }
function addLine(type){ S.lines.push(type); syncAccess(); }
