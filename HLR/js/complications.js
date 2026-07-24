const COMPS={
 extravasal:{
   label:"En PVK har glidit ur",
   eligible:()=>S.lines.includes("iv"),
   fire(){ const i=S.lines.indexOf("iv"); if(i>=0)S.lines.splice(i,1); syncAccess();
     if(S.access){ log("En PVK har glidit ur, men reservinfarten säkrar fortsatt läkemedelstillförsel. Bra att ni hade två infarter!","warn"); mark("Infart ur (reserv fanns)","cause"); }
     else { log("⚠ KOMPLIKATION: PVK:n har glidit ur, läkemedel riskerar gå extravasalt. Sätt ny infart (PVK/IO/CVK)!","bad"); mark("Komplikation: infart ur","cause"); } },
   resolved:()=>S.access!=null,
   fixed:"Fungerande infart säkrad, komplikationen åtgärdad." },
 tubdisloc:{
   label:"Tubdislokation, plötsligt EtCO₂-fall",
   eligible:()=>S.airway==="tub",
   fire(){ S.airway="mask"; S.vent=true; S.capno=false;
     log("⚠ KOMPLIKATION: plötsligt EtCO₂-fall och sämre thoraxhöjning, tuben har glidit ur! Ventilera på mask och intubera om.","bad");
     mark("Komplikation: tub ur","cause"); },
   resolved:()=>S.airway==="tub",
   fixed:"Luftvägen återsäkrad (tub på plats), komplikationen åtgärdad." },
 spo2off:{
   label:"SpO₂-proben har lossnat",
   eligible:()=>S.spo2probe,
   fire(){ S.spo2probe=false;
     log("⚠ Pulsoximetern larmar, proben har lossnat och du blir av med saturationskurvan. Sätt tillbaka den.","warn");
     mark("Komplikation: SpO₂-prob ur","cause"); },
   resolved:()=>S.spo2probe,
   fixed:"SpO₂-prob åter på plats, kurvan tillbaka." }
};
function maybeComplication(){
  if(S.mode!=="veteran")return;          // håll guidad genomgång ren
  if(S.complication||S.rosc||S.ended)return;
  if(S.complicationsFired>=3)return;     // max 3 per fall
  if(!chance(S.profile==="oskar"?0.3:0.6))return;   // Oskar: veteran, komplikationer hälften så ofta
  const pool=Object.keys(COMPS).filter(k=>!S._compDone.includes(k)&&COMPS[k].eligible());
  if(!pool.length)return;
  const id=pool[Math.floor(Math.random()*pool.length)];
  S.complication=id; S._compDone.push(id); S.complicationsFired++;
  COMPS[id].fire();
}
function tickComplications(){
  if(S.rosc||S.ended)return;
  if(S.nextCompCheck===0)S.nextCompCheck=S.t+rnd(70,110);
  if(!S.complication && S.t>=S.nextCompCheck){
    S.nextCompCheck=S.t+(S.t>150?rnd(55,95):rnd(80,120));   // tätare efter ~2,5 min
    maybeComplication();
  }
  if(S.complication){
    const c=COMPS[S.complication];
    if(c.resolved()){ S.complicationsResolved++; log(c.fixed,"ok"); S.complication=null; }
  }
}

/* ---------- Defibrillering ---------- */
function deliverShock(){
  S.charged=false;
  Sound.shock();
  // Slumpad komplikation: dålig plattkontakt → chocken levereras inte (en gång per fall, endast veteranläge)
  if(S.mode==="veteran"&&!S._shockGlitchUsed&&S.shocks>=1&&(S.rhythm==="VF"||S.rhythm==="pVT")&&chance(0.14)){
    S._shockGlitchUsed=true; S.shockFlash=0;
    log("⚠ KOMPLIKATION: dålig plattkontakt, defibrillatorn larmar och chocken levererades inte. Tryck fast plattorna och ladda om.","bad");
    mark("Komplikation: chock ej levererad","cause");
    return;
  }
  const preShockPause=S.compStopAt!==null?S.t-S.compStopAt:(S.comp?0:99);
  // säkerhet
  if(S.comp&&S.lucas){
    S.periPauses.push(0);
    log("⚡ Chock levererad under pågående mekaniska kompressioner, säkert, utan paus.","ok");
  } else if(S.comp){
    S.safety.shockDuringCPR++;
    log("⚡ CHOCK LEVERERAD MED PÅGÅENDE KOMPRESSIONER, kompressören fick stöt!","bad");
    flag("Defibrillering under pågående manuella kompressioner (allvarligt säkerhetsfel)",-10);
    S.comp=false;S.compStopAt=S.t;
  } else {
    S.periPauses.push(preShockPause);
    log("⚡ Chock levererad. Peri-chock-paus "+preShockPause.toFixed(0)+" s."+(preShockPause<=5?" Utmärkt!":""),preShockPause<=5?"ok":"warn");
  }
  // IVA-personalen flyttar automatiskt undan öppen syrgas inför chock (ingen brandrisk)
  if(!S.o2Safe&&S.o2max){ S.o2Safe=true;
    log("IVA-personalen flyttar undan syrgasen >1 m inför defibrillering.","sys"); }
  S.shockFlash=1;
  const r=S.rhythm;
  if(r!=="VF"&&r!=="pVT"){
    S.safety.shockAsystole++; S.shocks++;
    const visat=r==="organiserad"?"organiserad rytm":r;
    log("Chock på icke-chockbar rytm ("+visat+"), ingen effekt, onödig myokardskada.","bad");
    flag("Defibrillering av icke-chockbar rytm ("+visat+")",-6);
    if(r==="organiserad"&&S.perfusing&&chance(0.3)){S.perfusing=false;S.rhythm="PEA";
      log("Den osynkroniserade chocken slog ut den späda egencirkulationen.","bad");}
    updateVitals();return;
  }
  S.shocks++; if(S.firstShockAt===null)S.firstShockAt=S.t; mark("Chock "+S.shocks,"shock");
  // sannolikhet för lyckad defibrillering
  const q=qualityAvg();
  let p=0.20+0.30*q;
  p+= (S.shocks>1?0.05:0);                       // eskalerad energi
  if(S.shocks>3&&S.padPos==="AP")p+=0.15;         // vektorbyte vid refraktärt VF
  if(S.amiodaron>0)p+=0.05;
  if(recentAdrenalin())p+=0.07;
  p-=Math.min(0.25,(S.t/60)*0.012);               // tid i stopp
  if(hasActiveCause("hypotermi")&&!hypotermiVarm())p*=0.15;
  if(hasActiveCause("hypok"))p*=0.2;   // refraktärt tills magnesium/kalium
  if(hasActiveCause("longqt"))p*=0.25;  // torsades återkommer tills QT normaliserats
  if(hasActiveCause("digitalis"))p*=0.25; // refraktärt tills Fab givet
  if(S.causes.some(c=>c.id==="commotio"))p=Math.min(0.9,p+0.30);    // friskt myokard, chocken biter
  if(hasActiveCause("hypoxi"))p*=0.4;
  if(hasActiveCause("cico"))p*=0.15;   // ingen syresättning alls tills luftvägen är kirurgiskt säkrad
  if(currentPH()<7.0)p*=0.88;                      // uttalad acidos försämrar defibrillering (buffra!)
  if(S.fineVF)p*=0.75;
  p=clamp(p,0.04,0.85);
  if(S.cause.futile)p=0;                                // utsiktslöst, ingen konvertering (efter clamp)
  if(chance(p)){
    S.rhythm="organiserad";
    S.refibArmed=true;
    // vid ren chockbar orsak (STEMI) ÄR defibrilleringen åtgärden av grundproblemet
    const cShockCurable=["stemi","commotio","wpw"].map(id=>hasActiveCause(id)).find(Boolean);
    if(cShockCurable)markCauseTreated(cShockCurable);
    S.perfusing=canROSC()&&chance(0.55+ (recentAdrenalin()?0.2:0) + 0.2*q);
    if(S.perfusing){ scheduleRecognition();
      log("Chocken bryter flimret, organiserad rytm och stigande EtCO₂! Fortsätt komprimera och kontrollera puls.","ok");
    } else { startShockRecovery();
      log(canROSC()?"Chocken bryter flimret … kurvan organiseras på monitorn. Fortsätt HLR, cirkulationen kan återvända inom kort."
                   :"Chocken organiserar rytmen på monitorn, men det är för tidigt för stabil egencirkulation, fortsätt högkvalitativ HLR.","sys");
    }
  } else {
    const rn=S.rhythm==="pVT"?(S.cause.polymorf?"polymorf VT/torsades":"pulslös VT"):"VF";
    log("Kvarstående "+rn+" efter chock.","warn");
    if(S.shocks===3)log("Refraktärt läge (3 misslyckade chocker): säkerställ platt-läge, överväg vektorbyte till antero-posteriort och förbered nya plattor.","warn");
  }
  updateVitals();
}

/* ---------- Rytmkontroll (interaktiv) ---------- */
function canROSC(){ if(DBG.on&&DBG.freeROSC)return true;
  return S.t>=(S.roscMinTime||360) && (S.cycles||0)>=3 && S.causeTreatedAt!==null && !(S.pneumo&&S.pneumo.tension); }  // 5–7 min (variabelt), ≥3 cykler, åtgärdad grundorsak OCH ingen obehandlad ventilpneumothorax
function applyRhythmOutcome(){
  const r=S.rhythm;
  S.cycles=(S.cycles||0)+1;                  // varje rytmkontroll = en avslutad 2-min-cykel
  S.lastKnownRhythm=r;
  if(r==="VF"||r==="pVT"){
    const nm = r==="pVT"
      ? (S.cause.polymorf?"Polymorf kammartakykardi (torsades)":"Pulslös ventrikeltakykardi")
      : (S.fineVF?"Finvågigt VF":"Ventrikelflimmer");
    log("RYTM: "+nm+", chockbar! Ladda och defibrillera, återuppta HLR direkt.","warn");
  } else if(r==="asystoli"){
    log("RYTM: Asystoli, icke-chockbar. Fortsätt HLR, adrenalin, sök 4H/4T.","warn");
  } else { // organiserad / PEA / sinus
    if(S.perfusing){ achieveROSC(); return; }
    S.rhythm="PEA";
    log("RYTM: Organiserad elektrisk aktivitet utan puls, PEA. Fortsätt HLR.","warn");
  }
  log("Återuppta kompressioner omedelbart.","sys");
}
function resolveRhythmCheck(){ applyRhythmOutcome(); }   // bakåtkompatibel

const RM_OPTS=[
 {key:"vf", label:"Ventrikelflimmer (VF)",             sub:"Kaotisk, oregelbunden, chockbar"},
 {key:"vt", label:"Ventrikeltakykardi (VT)",           sub:"Bred, regelbunden, snabb, chockbar om pulslös"},
 {key:"asys",label:"Asystoli",                          sub:"Ingen aktivitet, platt/lätt vågig, icke-chockbar"},
 {key:"org", label:"Organiserad elektrisk aktivitet",   sub:"QRS-komplex, puls avgör PEA vs ROSC"}
];
const RM_DESC={
 vf:"<b>Ventrikelflimmer:</b> kaotisk, oregelbunden kurva utan urskiljbara QRS. <b>Chockbar</b>, defibrillera och återuppta HLR omedelbart.",
 vt:"<b>Pulslös ventrikeltakykardi:</b> breda, regelbundna, snabba komplex. <b>Chockbar</b>, defibrillera.",
 asys:"<b>Asystoli:</b> avsaknad av elektrisk aktivitet (kontrollera avledningar och förstärkning). <b>Icke-chockbar</b>, HLR, adrenalin och sök 4H/4T.",
 org:"<b>Organiserad elektrisk aktivitet:</b> identifierbara QRS-komplex. EKG:t avgör inte om det finns puls, <b>palpera central puls</b> för att skilja PEA från ROSC."
};
// Kompletterande morfologisk kommentar efter korrekt/felaktigt svar
function rhythmNuance(){
  const c=S.cause, r=S.rhythm;
  if(r==="pVT"){
    if(c.polymorf&&c.id==="wpw")return "Komplexen är breda, <b>oregelbundna</b> och varierar i bredd, preexciterat förmaksflimmer. AV-nodsblockerare är kontraindicerade.";
    if(c.polymorf)return "Amplituden vrider sig kring baslinjen i en spolform, <b>torsades de pointes</b>. Tänk magnesium och långt QT.";
    if(c.id==="digitalis")return "Axeln kastar om slag för slag, <b>bidirektionell VT</b>, närmast patognomont för digitalisintoxikation.";
    return "Regelbundna, breda komplex i hög frekvens, monomorf pulslös VT.";
  }
  if(r==="PEA"||r==="organiserad"){
    const pt=S.causeTreatedAt?null:c.peaType;
    if(pt==="sine")return "P-vågorna är borta och QRS smälter ihop med T till en <b>sinusvåg</b>, tänk uttalad hyperkalemi.";
    if(pt==="idio")return "Mycket breda, långsamma komplex utan P-vågor, <b>idioventrikulär rytm</b>, ett preterminalt fynd.";
    if(pt==="brady")return "Långsamma, glesa komplex utan P-vågor, <b>agonal/bradykard PEA</b>. Ofta hypoxi eller uttalad hypovolemi.";
    if(pt==="narrowfast")return "Smala QRS i hög frekvens med låg amplitud, hjärtat slår snabbt men får inget att pumpa. Tänk <b>obstruktion eller tom kammare</b> (tamponad, PE, hypovolemi).";
    if(pt==="narrow")return "Smala QRS i nära normal frekvens, den elektriska aktiviteten är bevarad, problemet är mekaniskt.";
    if(c.bredQRS)return "Breddökade QRS, tänk hyperkalemi, natriumkanalblockad (TCA) eller hypokalcemi.";
  }
  if(r==="VF"&&S.fineVF)return "Lågamplitudigt, finvågigt VF, kan förväxlas med asystoli. Kontrollera förstärkning och avledning innan du kallar det asystoli.";
  return null;
}
function trueRhythmKey(){
  const r=S.rhythm;
  if(r==="VF")return "vf"; if(r==="pVT")return "vt"; if(r==="asystoli")return "asys";
  return "org";
}
let rmRAF=null;
function drawRhythmStrip(){
  const cv=$("rhythmStrip"); if(!cv||!cv.getContext)return;
  const g=cv.getContext("2d"),W=600,H=150;
  const now=(typeof performance!=="undefined"?performance.now():0)/1000;
  g.fillStyle="#0a1410";g.fillRect(0,0,W,H);
  g.strokeStyle="rgba(80,140,110,.16)";g.lineWidth=1;
  for(let x=0;x<W;x+=24){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
  for(let y=0;y<H;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  g.strokeStyle="#35E08E";g.lineWidth=2.2;g.lineJoin="round";g.beginPath();
  for(let i=0;i<=W;i+=2){
    const tt=now-(W-i)*0.006;
    const v=miniSig(tt);
    const yy=H*0.55-v*H*0.34;
    i===0?g.moveTo(i,yy):g.lineTo(i,yy);
  }
  g.stroke();
  g.fillStyle="#7fae95";g.font="11px 'IBM Plex Mono'";g.fillText("II · 25 mm/s",10,H-10);
  rmRAF=requestAnimationFrame(drawRhythmStrip);
}
function openRhythmModal(){
  if(S.rosc||S.ended)return;
  S.rhythmQuiz.total++;
  if(typeof window!=="undefined"&&window.AUTO_RHYTHM){ S.rhythmQuiz.correct++; applyRhythmOutcome(); return; }
  S._speedBeforeRM=S.speed; S.speed=0; if(window.syncSpeed)window.syncSpeed();
  $("rhythmModal").classList.remove("hidden");
  cancelAnimationFrame(rmRAF); drawRhythmStrip();
  $("rmTitle").textContent="Rytmkontroll";
  $("rmSub").textContent="Allt är pausat. Bedöm rytmen på skärmen och välj.";
  const stage=$("rmStage");
  stage.innerHTML=`<div class="rm-q">Vilken rytm ser du på monitorn?</div><div class="rm-opts" id="rmOpts">`+
    RM_OPTS.map(o=>`<button class="rm-opt" data-k="${o.key}">${o.label}<small>${o.sub}</small></button>`).join("")+`</div>`;
  document.querySelectorAll("#rmOpts .rm-opt").forEach(b=>b.onclick=()=>answerRhythm(b.dataset.k));
}
function answerRhythm(pick){
  const correct=trueRhythmKey(), good=pick===correct;
  if(good)S.rhythmQuiz.correct++;
  document.querySelectorAll("#rmOpts .rm-opt").forEach(b=>{b.disabled=true;
    if(b.dataset.k===correct)b.classList.add("correct");
    else if(b.dataset.k===pick)b.classList.add("wrong");});
  if(!good){ const fb=document.createElement("div");fb.className="rm-feedback bad";
    fb.innerHTML="<b>Inte riktigt.</b> "+RM_DESC[correct]; $("rmStage").appendChild(fb); }
  const nu=rhythmNuance();
  if(nu){ const nb=document.createElement("div"); nb.className="rm-feedback"+(good?"":" bad");
    nb.innerHTML=nu; $("rmStage").appendChild(nb); }
  addScoreLine("Rytmigenkänning: "+S.rhythmQuiz.correct+"/"+S.rhythmQuiz.total);
  if(correct==="org") renderPulseStep(); else appendContinue();
}
function renderPulseStep(){
  const hasPulse=!!S.perfusing;
  S.rhythmQuiz.pulseTotal++;
  const stage=$("rmStage");
  const p=document.createElement("div");p.className="rm-pulse";
  p.innerHTML="Du palperar central puls i 10 sekunder … "+(hasPulse?"<span class='yes'>PULS KÄNNS</span>":"<span class='no'>INGEN PULS</span>");
  stage.appendChild(p);
  const q=document.createElement("div");q.className="rm-q";q.textContent="Din bedömning?";stage.appendChild(q);
  const opts=document.createElement("div");opts.className="rm-opts two";opts.id="rmPulseOpts";
  opts.innerHTML=`<button class="rm-opt" data-k="pea">PEA, ingen puls<small>Fortsätt HLR, adrenalin, sök 4H/4T</small></button>
    <button class="rm-opt" data-k="rosc">ROSC, palpabel puls<small>Avsluta HLR, påbörja post-ROSC-vård</small></button>`;
  stage.appendChild(opts);
  document.querySelectorAll("#rmPulseOpts .rm-opt").forEach(b=>b.onclick=()=>answerPulse(b.dataset.k,hasPulse));
}
function answerPulse(pick,hasPulse){
  const correct=hasPulse?"rosc":"pea", good=pick===correct;
  if(good)S.rhythmQuiz.pulseCorrect++;
  document.querySelectorAll("#rmPulseOpts .rm-opt").forEach(b=>{b.disabled=true;
    if(b.dataset.k===correct)b.classList.add("correct");
    else if(b.dataset.k===pick)b.classList.add("wrong");});
  const fb=document.createElement("div");fb.className="rm-feedback "+(good?"ok":"bad");
  fb.innerHTML=good
    ? "<b>Rätt bedömning.</b> "+(hasPulse?"Palpabel puls med organiserad rytm = ROSC. Påbörja post-ROSC-vård.":"Organiserad rytm utan puls = PEA. Fortsätt HLR och leta reversibla orsaker.")
    : "<b>Fel bedömning.</b> "+(hasPulse?"Det fanns en palpabel puls, detta är ROSC, inte PEA. Fortsatta kompressioner på en patient med egen cirkulation är skadligt.":"Det saknades puls, detta är PEA, inte ROSC. Fortsätt HLR.");
  $("rmStage").appendChild(fb);
  addScoreLine("Puls/ROSC-bedömning: "+S.rhythmQuiz.pulseCorrect+"/"+S.rhythmQuiz.pulseTotal);
  appendContinue();
}
function addScoreLine(txt){const s=document.createElement("div");s.className="rm-score";s.textContent=txt;$("rmStage").appendChild(s);}
function appendContinue(){const b=document.createElement("button");b.className="big";b.textContent="Fortsätt";b.onclick=closeRhythmModal;$("rmStage").appendChild(b);}
function closeRhythmModal(){
  cancelAnimationFrame(rmRAF);rmRAF=null;
  $("rhythmModal").classList.add("hidden");
  applyRhythmOutcome();
  if(!S.rosc){ S.speed=S._speedBeforeRM||1; if(window.syncSpeed)window.syncSpeed(); }
  else { S.speed=S._speedBeforeRM||1; if(window.syncSpeed)window.syncSpeed(); }
  renderActions(true);
}

/* ---------- SBAR-överlämning till IVA (RPG-dialog) ---------- */
