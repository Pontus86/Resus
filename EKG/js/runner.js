/* ---------- EKG-löparen: "överlev skiftet" ---------- */
/* En ständigt rullande rytmremsa i EN avledning (II — inte hela 12-avledningsrutnätet, för
   svårt att hålla reda på samtidigt) där rubbningar dyker upp av sig själva och blir gradvis
   SJUKARE ju längre de får stå obehandlade — redan ritade komplex ändras aldrig i efterhand,
   bara nya komplex (till höger) speglar dagens högre svårighetsgrad. Botas genom att välja
   rätt BEHANDLING, inte genom att peka ut diagnosen. Utöver själva EKG:t: vitalparametrar
   som reagerar på de aktiva rubbningarna, kontraindicerade behandlingsval som straffar
   hårdare än ett vanligt felval, och en hjärtstopps-eskalering där man måste känna igen
   chockbar/icke-chockbar rytm under tidspress. Inga sidokomplikationer (ingen "PVK ur
   funktion" e.dyl.) — bara patienten, remsan och behandlingsvalen.  */

const RUNNER_CONDITIONS = [
  {id:"stemi_lad", treatment:"pci", vitals:{bp:-20, spo2:-3, temp:0}},
  {id:"stemi_rca", treatment:"pci", vitals:{bp:-25, spo2:-3, temp:0}},
  {id:"stemi_lcx", treatment:"pci", vitals:{bp:-15, spo2:-2, temp:0}},
  {id:"nstemi", treatment:"antikoagulantia", vitals:{bp:-10, spo2:-2, temp:0}},
  {id:"hyperk", treatment:"kalcium", vitals:{bp:-10, spo2:0, temp:0}},
  {id:"hypok", treatment:"kalium_magnesium", vitals:{bp:-5, spo2:0, temp:0}},
  {id:"hyperca", treatment:"vatska", vitals:{bp:-8, spo2:0, temp:0}},
  {id:"hypoca", treatment:"kalcium", vitals:{bp:-5, spo2:-5, temp:0}},
  {id:"tca", treatment:"bikarbonat", vitals:{bp:-25, spo2:-6, temp:0}},
  {id:"digitalis", treatment:"digfab", vitals:{bp:-8, spo2:0, temp:0}},
  {id:"torsades", treatment:"magnesium", vitals:{bp:-30, spo2:-8, temp:0}},
  {id:"chb", treatment:"pacing", vitals:{bp:-22, spo2:-3, temp:0}},
  {id:"hypothermia", treatment:"varme", vitals:{bp:-15, spo2:-5, temp:-9}},
  {id:"vt", treatment:"defibrillering", vitals:{bp:-28, spo2:-6, temp:0}}
];
const RUNNER_TREATMENTS = {
  pci: "Akut PCI",
  antikoagulantia: "Antikoagulantia",
  kalcium: "Kalcium",
  kalium_magnesium: "Kalium/Magnesium",
  vatska: "Vätska (NaCl)",
  bikarbonat: "Natriumbikarbonat",
  digfab: "Digoxin-Fab",
  magnesium: "Magnesium",
  pacing: "Pacing",
  varme: "Aktiv uppvärmning",
  defibrillering: "Defibrillera/elkonvertera"
};
// Klassiska farliga felval — inte bara "fel", utan AKTIVT skadligt givet den aktiva
// rubbningen (t.ex. kalcium vid digitalisintox ger "stenhjärta"). Straffas hårdare än
// ett vanligt felval och får en egen distinkt varning i stället för att tystas ner.
const RUNNER_CONTRAINDICATIONS = {
  digitalis: ["kalcium"],
  hyperk: ["kalium_magnesium"],
  hypok: ["bikarbonat"]
};

const Runner = (() => {
  const RAMP_SECONDS = 14;          // tid för en rubbning att gå från nyupptäckt till fullt utvecklad
  const SICK_THRESHOLD = 0.2;       // under denna svårighetsgrad räknas den inte som ett hot mot vitalparametrarna
  const DRAIN_RATE = 2.2;           // hp/s vid full svårighetsgrad (skalar linjärt mellan tröskeln och 100%)
  const HEAL_ON_CURE = 12, DAMAGE_ON_WRONG = 7, DAMAGE_CONTRA = 16;
  const SPAWN_START = 9, SPAWN_MIN = 4, SPAWN_RAMP = 0.03;
  const MAX_CONCURRENT_CAP = 3, RAMP_UP_EVERY = 40; // +1 samtidig rubbning var 40:e sekund
  const ARREST_GRACE_SEC = 6;       // hur länge en FULLT utvecklad rubbning får stå innan hjärtstopp utlöses
  const ARREST_WINDOW_SEC = 9;      // tid att välja rätt akutåtgärd innan spelet är slut
  const BASE_VITALS = {bp:120, spo2:98, temp:37.0};

  let active=false, over=false, overReason="";
  let startTime=0, elapsed=0, lastDraw=0;
  let disorders=[];              // [{id, treatment, spawnedAt, fullSinceAt}]
  let maxConcurrent=1, nextSpawnAt=3;
  let health=100, score=0, correctCount=0, wrongCount=0, contraCount=0;
  let arrestActive=false, arrestDisorder=null, arrestStartedAt=0;
  let rafHandle=null, canvasEl=null, onUpdate=null;

  function pickNewDisorder(){
    const activeIds=disorders.map(d=>d.id);
    const pool=RUNNER_CONDITIONS.filter(c=>!activeIds.includes(c.id));
    if(!pool.length) return null;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function severityAt(d,t){ return Math.max(0, Math.min(1, (t-d.spawnedAt)/RAMP_SECONDS)); }
  function baseDeltaFor(condDef){ return condDef.stages ? condDef.stages[condDef.defaultStageIndex||0].delta : condDef.delta; }
  // Profilen så som den ser ut VID TIDPUNKTEN t — bara rubbningar som redan fanns då bidrar,
  // var och en skalad efter sin egen svårighetsgrad just då. Tidigare/senare slag opåverkade.
  function profileAtTime(t){
    const deltas = disorders.filter(d=>d.spawnedAt<=t).map(d=>{
      const condDef=ECG_CONDITIONS.find(c=>c.id===d.id);
      return scaleDeltaBySeverity(baseDeltaFor(condDef), severityAt(d,t));
    });
    return mergeDeltas(deltas);
  }
  function maxSeverityAtTime(t){
    const act=disorders.filter(d=>d.spawnedAt<=t);
    return act.length ? Math.max(...act.map(d=>severityAt(d,t))) : 0;
  }
  function vitalsAtTime(t){
    let bp=BASE_VITALS.bp, spo2=BASE_VITALS.spo2, temp=BASE_VITALS.temp;
    disorders.filter(d=>d.spawnedAt<=t).forEach(d=>{
      const sev=severityAt(d,t);
      const def=RUNNER_CONDITIONS.find(c=>c.id===d.id);
      if(def && def.vitals){
        bp += (def.vitals.bp||0)*sev;
        spo2 += (def.vitals.spo2||0)*sev;
        temp += (def.vitals.temp||0)*sev;
      }
    });
    return {bp:Math.max(45,Math.round(bp)), spo2:Math.max(55,Math.round(spo2)), temp:Math.round(Math.max(27,temp)*10)/10};
  }

  function updateDifficulty(){ maxConcurrent=Math.min(MAX_CONCURRENT_CAP, 1+Math.floor(elapsed/RAMP_UP_EVERY)); }
  function spawnIfDue(){
    if(arrestActive) return; // dramatisk paus — inga nya rubbningar mitt i ett hjärtstopp
    if(elapsed>=nextSpawnAt && disorders.length<maxConcurrent){
      const c=pickNewDisorder();
      if(c) disorders.push({id:c.id, treatment:c.treatment, spawnedAt:elapsed, fullSinceAt:null});
    }
    if(elapsed>=nextSpawnAt) nextSpawnAt=elapsed+Math.max(SPAWN_MIN, SPAWN_START-elapsed*SPAWN_RAMP);
  }

  function updateSeverityFlags(){
    disorders.forEach(d=>{
      const sev=severityAt(d,elapsed);
      if(sev>=0.999 && d.fullSinceAt==null) d.fullSinceAt=elapsed;
    });
  }
  function checkArrestTrigger(){
    if(arrestActive) return;
    const d=disorders.find(x=>x.fullSinceAt!=null && (elapsed-x.fullSinceAt)>ARREST_GRACE_SEC);
    if(d){
      arrestActive=true; arrestDisorder=d; arrestStartedAt=elapsed;
      if(onUpdate) onUpdate({arrestStarted:true});
    }
  }
  function applyPassiveDrain(dt){
    if(arrestActive) return;
    const worst=maxSeverityAtTime(elapsed);
    if(worst>SICK_THRESHOLD){
      const frac=(worst-SICK_THRESHOLD)/(1-SICK_THRESHOLD);
      health=Math.max(0, health-dt*DRAIN_RATE*frac);
    }
  }

  // Ritar EN avledning (II) över hela canvasens bredd i stället för 12-ledningsrutnätet —
  // samma bygg-slag-i-tid-teknik som drawECG12 använder, men fristående så varje slag kan
  // frysa sin EGEN, tidsstyrda profil (severityAt vid slagets starttid).
  function drawStrip(winStart){
    const cv=canvasEl, g=cv.getContext("2d"), W=cv.width, H=cv.height;
    const MM=W/250;
    g.fillStyle="#FFF6F4"; g.fillRect(0,0,W,H);
    g.strokeStyle="#F7D2CE"; g.lineWidth=0.5; g.beginPath();
    for(let x=0;x<=W;x+=MM){ g.moveTo(x,0); g.lineTo(x,H); }
    for(let y=0;y<=H;y+=MM){ g.moveTo(0,y); g.lineTo(W,y); }
    g.stroke();
    g.strokeStyle="#E08D86"; g.lineWidth=0.9; g.beginPath();
    for(let x=0;x<=W;x+=MM*5){ g.moveTo(x,0); g.lineTo(x,H); }
    for(let y=0;y<=H;y+=MM*5){ g.moveTo(0,y); g.lineTo(W,y); }
    g.stroke();

    // PXMV/y0 skalar mot CANVASENS HÖJD (inte MM/bredden) — löparens remsa är mycket lägre
    // än 12-avledningsrutnätet (bara EN kurva att få plats för), så amplituden måste krympa
    // med höjden för att fylla den i stället för att lämna dött utrymme ovan/under kurvan.
    const PXS=42*MM, PXMV=H*0.3;
    const x0=6*MM, y0=H*0.62;
    const secs=(W-2*x0)/PXS;
    const beats=[]; let tb=0, k=0;
    while(tb<winStart+secs+3){
      beats.push(tb);
      const beatPr=profileAtTime(tb);
      const jit = beatPr.irregular ? 1+beatPr.irregular*(2*(((k*0.6180339887)%1))-1) : 1;
      tb += (60/(beatPr.hr||72))*jit; k++;
      if(k>3000) break;
    }
    let bi=0; while(bi+1<beats.length && beats[bi+1]<=winStart) bi++;
    const N=Math.round(secs*440);
    g.lineWidth=1.9; g.lineJoin="round"; g.strokeStyle="#12181C"; g.beginPath();
    for(let i=0;i<=N;i++){
      const t=winStart+i/440;
      while(bi+1<beats.length && beats[bi+1]<=t) bi++;
      const beatPr=profileAtTime(beats[bi]);   // profilen "fryst" vid SLAGETS start — inga retroaktiva ändringar
      const span=(beats[bi+1]??(beats[bi]+60/(beatPr.hr||72)))-beats[bi];
      const p=(t-beats[bi])/span;
      const v=ecgSample("II", p, beatPr, bi);
      const x=x0+(t-winStart)*PXS, y=y0-v*PXMV;
      i?g.lineTo(x,y):g.moveTo(x,y);
    }
    g.stroke();

    const nowPr=profileAtTime(winStart);
    g.fillStyle="#5A4A48"; g.font=`${Math.round(3.1*MM)}px ui-monospace,monospace`;
    g.fillText("II · rytmremsa", x0, Math.min(14*MM, H*0.22));
    g.fillText(Math.round(nowPr.hr||72)+" slag/min", W-32*MM, H-Math.min(6*MM, H*0.12));
  }

  function loop(now){
    if(!active||over) return;
    if(!startTime) startTime=now;
    const prevElapsed=elapsed;
    elapsed=(now-startTime)/1000;
    const dt=Math.max(0, elapsed-prevElapsed);

    updateDifficulty();
    spawnIfDue();
    updateSeverityFlags();
    checkArrestTrigger();
    applyPassiveDrain(dt);
    score += dt*4;

    if(arrestActive && (elapsed-arrestStartedAt)>ARREST_WINDOW_SEC){
      endGame("arrest_timeout"); return;
    }
    if(health<=0){ endGame("health"); return; }

    if(now-lastDraw>50){
      lastDraw=now;
      drawStrip(elapsed);
      if(onUpdate) onUpdate({tick:true});
    }
    rafHandle=requestAnimationFrame(loop);
  }

  function treat(key){
    if(!active||over||arrestActive) return;
    const idx=disorders.findIndex(d=>d.treatment===key);
    if(idx>=0){
      const d=disorders[idx];
      const sev=severityAt(d,elapsed);
      disorders.splice(idx,1); correctCount++;
      const speedBonus = sev<0.35 ? 60 : sev<0.65 ? 25 : 0;
      score += 100+speedBonus;
      health=Math.min(100, health+HEAL_ON_CURE);
      if(onUpdate) onUpdate({correct:true, speedBonus});
      return;
    }
    wrongCount++;
    const dangerous = disorders.some(d=>(RUNNER_CONTRAINDICATIONS[d.id]||[]).includes(key))
                    || (key==="defibrillering" && !disorders.some(d=>d.treatment==="defibrillering"));
    if(dangerous){
      contraCount++;
      health=Math.max(0, health-DAMAGE_CONTRA);
      if(onUpdate) onUpdate({wrong:true, contraindicated:true});
    } else {
      health=Math.max(0, health-DAMAGE_ON_WRONG);
      if(onUpdate) onUpdate({wrong:true});
    }
  }

  function resolveArrest(action){ // action: "shock" | "cpr"
    if(!arrestActive) return;
    const shockable = arrestDisorder.treatment==="defibrillering";
    const correct = (action==="shock"&&shockable) || (action==="cpr"&&!shockable);
    if(correct){
      disorders=disorders.filter(x=>x!==arrestDisorder);
      health=55; score+=300;
      arrestActive=false; arrestDisorder=null;
      if(onUpdate) onUpdate({arrestResolved:true});
    } else {
      endGame("arrest_wrong");
    }
  }

  function start(){
    active=true; over=false; overReason=""; startTime=0; elapsed=0; lastDraw=0;
    disorders=[]; maxConcurrent=1; nextSpawnAt=3;
    health=100; score=0; correctCount=0; wrongCount=0; contraCount=0;
    arrestActive=false; arrestDisorder=null; arrestStartedAt=0;
    rafHandle=requestAnimationFrame(loop);
  }
  function endGame(reason){
    over=true; active=false; overReason=reason||"health";
    if(rafHandle){ cancelAnimationFrame(rafHandle); rafHandle=null; }
    if(onUpdate) onUpdate({gameOver:true, reason:overReason, score:Math.round(score), survived:elapsed, correctCount, wrongCount, contraCount});
  }
  function stop(){
    active=false; over=true;
    if(rafHandle){ cancelAnimationFrame(rafHandle); rafHandle=null; }
  }
  function init(canvas){ canvasEl=canvas; }
  function isActive(){ return active; }
  function getState(){
    const vitals=vitalsAtTime(elapsed);
    return {
      elapsed, score:Math.round(score), health, vitals,
      disorderCount:disorders.length, maxConcurrent, over, correctCount, wrongCount, contraCount,
      arrestActive,
      arrestTimeLeft: arrestActive ? Math.max(0, ARREST_WINDOW_SEC-(elapsed-arrestStartedAt)) : 0,
      arrestLabel: arrestActive ? (ECG_CONDITIONS.find(c=>c.id===arrestDisorder.id)||{}).label : null
    };
  }
  function setOnUpdate(fn){ onUpdate=fn; }

  return {start, stop, init, treat, resolveArrest, isActive, getState, setOnUpdate};
})();
