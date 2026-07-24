const SBAR_CAUSE={
 stemi:{bg:"sannolik STEMI, vi defibrillerade och har nu en organiserad rytm",rec:"akut koronarangiografi med PCI"},
 pe:{bg:"massiv lungemboli, vi har gett trombolys",rec:"fortsatt antikoagulation och intensivvårdsövervakning"},
 hyperk:{bg:"svår hyperkalemi, vi har gett kalcium och membranstabiliserat",rec:"akut dialys och elektrolytkontroll"},
 hypovol:{bg:"hypovolemi av blödning, vi har gett volym och blod",rec:"blödningskontroll (kirurgi/endoskopi) och fortsatt transfusion"},
 tension:{bg:"ventilpneumothorax, vi har dekomprimerat höger thorax",rec:"thoraxdränage och lungövervakning"},
 tamponad:{bg:"hjärttamponad, vi har tömt perikardvätskan",rec:"ekokardiografi och kardiologisk/thoraxkirurgisk bedömning"},
 hypoxi:{bg:"ett hypoxiskt stopp, vi har säkrat luftvägen och syresatt",rec:"kontrollerad ventilation och utredning av luftvägsorsaken"},
 cico:{bg:"ett kvävningsstopp där mask, i-gel och intubation alla misslyckades, vi har säkrat luftvägen med en koniotomi och syresatt",rec:"ÖNH-bedömning, definitiv luftväg och åtgärd av obstruktionen (bronkoskopi/kirurgi)"},
 toxin:{bg:"en förgiftning med kraftigt breddökade QRS, vi har gett natriumbikarbonat",rec:"fortsatt intoxvård med upprepad bikarbonat och övervakning"},
 hypotermi:{bg:"svår hypotermi, vi har inlett aktiv återuppvärmning",rec:"fortsatt uppvärmning, eventuellt ECMO, och långsam handläggning"},
 hypoca:{bg:"svår hypokalcemi, vi har gett kalcium",rec:"elektrolytkorrektion och utredning av orsaken"},
 hypok:{bg:"svår hypokalemi med torsades, vi har gett magnesium och kalium",rec:"elektrolytkorrektion och telemetriövervakning"},
 commotio:{bg:"sannolik commotio cordis efter ett slag mot bröstkorgen, vi har defibrillerat",rec:"telemetriövervakning och kardiologisk bedömning, ingen ytterligare akut åtgärd krävs"},
 wpw:{bg:"pulslöst kammarflimmer utlöst av preexciterat förmaksflimmer vid WPW, vi har defibrillerat",rec:"kardiologisk bedömning och elektrofysiologisk utredning (ablation)"},
 longqt:{bg:"torsades de pointes vid läkemedelsinducerat långt QT, vi har gett magnesium",rec:"seponering av QT-förlängande läkemedel, elektrolytkorrektion och telemetriövervakning"},
 digitalis:{bg:"digitalisintoxikation med bidirektionell kammartakykardi, vi har gett digoxinspecifika antikroppsfragment (Fab)",rec:"fortsatt övervakning, elektrolytkorrektion och njurfunktionsbedömning"}
};

/* ---------- Åtgärda orsak / disponera: vart ska patienten, sedan ring och rapportera dit ---------- */
const CAUSE_DEST={
 stemi:"pci",
 hypovol:"op", tamponad:"op",
 pe:"iva", hyperk:"iva", tension:"iva", hypoxi:"iva", cico:"iva", toxin:"iva", hypotermi:"iva",
 hypoca:"iva", hypok:"iva", longqt:"iva", wpw:"iva", commotio:"iva", digitalis:"iva"
};
const DEST_INFO={
 pci:{label:"PCI-lab",names:["Lindberg","Håkansson","Ferm"],role:"PCI-jour · tar emot samtalet",portrait:()=>pImg("narkos")},
 op:{label:"Operation (kirurg)",names:["Sandberg","Novak","Ekström","Rahim","Persson"],role:"Kirurgjour · tar emot samtalet",portrait:surgeonPortrait},
 iva:{label:"IVA",names:["Björk","Lindqvist","Ahmadi","Sandberg","Okafor","Nyström","Holm","Wikström"],role:"IVA-jour · tar emot samtalet",portrait:ivaPortrait}
};
// Destinationsspecifik definitiv rekommendation när man ringt RÄTT instans (annars används SBAR_CAUSE.rec/IVA).
const DEST_REC={
 pci:"akut angiografi med PCI-beredskap, öppna ocklusionen om möjligt",
 op:{hypovol:"akut kirurgisk blödningskontroll, exempelvis explorativ laparotomi",
     tamponad:"kirurgisk exploration med perikardiotomi/sternotomi för definitiv blödningskontroll"}
};
function destRec(dest,causeId){
  if(dest==="pci")return DEST_REC.pci;
  if(dest==="op")return DEST_REC.op[causeId]||"akut kirurgisk exploration och definitiv åtgärd";
  return (SBAR_CAUSE[causeId]||{}).rec||"fortsatt intensivvård";
}
function openOrsakModal(){
  if(!S.rosc)return;
  const correct=CAUSE_DEST[S.cause.id]||"iva";
  if(typeof window!=="undefined" && window.AUTO_RHYTHM){ openDispositionCall(correct); return; }
  $("orsakModal").classList.remove("hidden");
  $("orsakStage").innerHTML=`<div class="rm-q">Vart ska patienten disponeras?</div>`+
    `<div class="rm-opts" id="orsakOpts">`+Object.keys(DEST_INFO).map(k=>`<button class="rm-opt" data-k="${k}">${DEST_INFO[k].label}</button>`).join("")+`</div>`;
  document.querySelectorAll("#orsakOpts .rm-opt").forEach(b=>{ b.onclick=()=>{ $("orsakModal").classList.add("hidden"); openDispositionCall(b.dataset.k); }; });
}

function pPick(cat){ const a=(typeof PORTRAITS!=="undefined"&&PORTRAITS[cat])||[]; return a.length?a[Math.floor(Math.random()*a.length)]:null; }
function pImg(cat){ const src=pPick(cat);
  if(!src)return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#22303a"/></svg>`;
  return `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%;display:block">`; }
function ivaPortrait(){ return pImg("iva"); }
function surgeonPortrait(){ return pImg("kirurg"); }
/* ---------- Generisk RPG-dialogmotor ---------- */
function vitalStr(){
  const bt=(S.artline||S.nibp||S.post.bt)?bpText():"blodtryck ännu ej uppmätt";
  const spo2=S.spo2probe?("SpO₂ "+spo2Value()+" %"):"SpO₂ ej mätt";
  const co2=S.capno?("EtCO₂ "+co2Value()+" kPa"):"EtCO₂ ej mätt";
  const aw=S.airway==="tub"?"intuberad":S.airway==="igel"?"i-gel":S.airway==="koniotomi"?"koniotomi (kirurgisk luftväg)":"ventileras på mask";
  const since=S.rosc?("ROSC sedan "+mmss(Math.max(0,S.t-S.roscAt))):"pågående HLR";
  return since+", "+(S.rosc?"sinusrytm, ":"")+bt+", "+spo2+", "+aw+", "+co2+"."+(S.rosc?" Medvetslös, GCS 3.":"");
}
let DLG=null, dlgTyping=null, dlgSkip=null;
function dlgShowInstant(who,cls,message){
  clearInterval(dlgTyping); dlgTyping=null; dlgSkip=null;
  $("sbarWho").textContent=who||"";
  $("sbarWho").className="sbar-who-line"+(cls==="you"?" you":"");
  const el=$("sbarText"), sc=$("sbarScroll");
  el.innerHTML=message||""; $("sbarCont").classList.remove("show");
  if(sc)sc.scrollTop=sc.scrollHeight;
}
function dlgType(who,whoCls,message,cb){
  const el=$("sbarText"), sc=$("sbarScroll");
  clearInterval(dlgTyping);
  $("sbarWho").textContent=who||"";
  $("sbarWho").className="sbar-who-line"+(whoCls==="you"?" you":"");
  el.innerHTML=""; $("sbarCont").classList.remove("show");
  const plain=(message||"").replace(/<[^>]+>/g,"");
  let i=0;
  const finish=()=>{clearInterval(dlgTyping);dlgTyping=null;dlgSkip=null;el.innerHTML=message;$("sbarCont").classList.add("show");if(sc)sc.scrollTop=sc.scrollHeight;if(cb)cb();};
  dlgSkip=finish;
  dlgTyping=setInterval(()=>{ i+=1; el.textContent=plain.slice(0,i); if(sc)sc.scrollTop=sc.scrollHeight; if(i>=plain.length)finish(); },23);
}
function openDialogue(cfg){
  if(typeof window!=="undefined" && window.AUTO_RHYTHM){
    let score=0; cfg.steps.forEach(s=>{const g=(s.choices||[]).find(c=>c.good);if(g){if(g.onPick)g.onPick();score++;}});
    if(cfg.onFinish)cfg.onFinish(true,{score,total:cfg.steps.length});
    return;
  }
  DLG=Object.assign({idx:0,score:0,total:0},cfg);
  $("sbarName").textContent=cfg.name;
  $("sbarRole").textContent=cfg.role||"";
  $("sbarPortrait").innerHTML=cfg.portrait;
  S._speedBeforeDlg=S.speed; S.speed=0; if(window.syncSpeed)window.syncSpeed();
  $("sbarChoices").innerHTML=""; $("sbarText").innerHTML="";
  $("sbarModal").classList.remove("hidden");
  dlgStep();
}
function dlgStep(){
  const step=DLG.steps[DLG.idx];
  if(step.choices && !step._shuffled && step.shuffle!==false){
    for(let i=step.choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[step.choices[i],step.choices[j]]=[step.choices[j],step.choices[i]];}
    step._shuffled=true;
  }
  $("sbarStepTag").textContent=step.tag||"";
  $("sbarChoices").innerHTML="";
  dlgType(DLG.speakerTag, "iva", resolve(step.npc), ()=>dlgChoices(step));
}
function resolve(v){return typeof v==="function"?v():v;}
function dlgChoices(step){
  const box=$("sbarChoices"); box.innerHTML="";
  step.choices.forEach((ch,i)=>{
    const b=document.createElement("button");b.className="sbar-opt";
    b.innerHTML="<span class='arrow'>▸</span>"+resolve(ch.label||ch.say);
    b.onclick=()=>dlgChoose(step,i);
    box.appendChild(b);
  });
}
function dlgChoose(step,i){
  const ch=step.choices[i];
  document.querySelectorAll("#sbarChoices .sbar-opt").forEach(b=>b.disabled=true);
  DLG.total++; if(ch.good)DLG.score++;
  if(ch.onPick)ch.onPick();
  // spelarens egen replik visas direkt (ingen rullande text)
  dlgShowInstant("DU", "you", resolve(ch.say));
  setTimeout(()=>{
      dlgType(DLG.speakerTag, "iva", resolve(ch.reply),()=>{
        if(ch.hangup){
          $("sbarChoices").innerHTML="";
          const b=document.createElement("button");b.className="big";b.textContent=DLG.hangupBtn||"Lägg på";
          b.onclick=()=>dlgClose(false); $("sbarChoices").appendChild(b);
          return;
        }
        const fb=document.createElement("div");fb.className="sbar-fb "+(ch.good?"ok":"bad");
        fb.textContent=ch.good?(DLG.okFb||"✓ Tydligt kommunicerat."):(DLG.badFb||"✗ Kunde varit tydligare.");
        $("sbarChoices").innerHTML=""; $("sbarChoices").appendChild(fb);
        const nx=document.createElement("button");nx.className="big";
        const last=DLG.idx>=DLG.steps.length-1;
        nx.textContent=last?(DLG.finishBtn||"Avsluta"):"Fortsätt ▶";
        nx.onclick=()=>{ if(last){ if(DLG.closing)dlgFinish(); else dlgClose(true); } else { DLG.idx++; dlgStep(); } };
        $("sbarChoices").appendChild(nx);
      });
  },600);
}
function dlgFinish(){
  $("sbarStepTag").textContent="KLART"; $("sbarChoices").innerHTML="";
  const closing=DLG.closing?resolve(()=>DLG.closing(DLG)):"";
  dlgType(DLG.speakerTag, "iva", closing,()=>{
    const b=document.createElement("button");b.className="big";b.textContent=DLG.endBtn||"Lägg på";
    b.onclick=()=>dlgClose(true); $("sbarChoices").appendChild(b);
  });
}
function dlgClose(success){
  clearInterval(dlgTyping);dlgTyping=null;
  $("sbarModal").classList.add("hidden");
  S.speed=S._speedBeforeDlg||1; if(window.syncSpeed)window.syncSpeed();
  const cb=DLG.onFinish, d=DLG; DLG=null;
  if(cb)cb(success,d);
  renderActions&&renderActions(true);
}

/* ---------- SBAR-överlämning till IVA ---------- */
function openDispositionCall(dest){
  if(!S.rosc)return;
  const info=DEST_INFO[dest]||DEST_INFO.iva;
  const name=info.names[Math.floor(Math.random()*info.names.length)];
  const c=S.cause;
  // Vid två samtidiga orsaker (hardcore) slås SBAR-bakgrunden ihop från BÅDA i stället för
  // att kräva handskrivet innehåll för varje möjligt par — och valfri av orsakernas rätta
  // destination godtas, eftersom en enda disposition sällan kan tillgodose två orsaker perfekt.
  const scList=S.causes.map(x=>SBAR_CAUSE[x.id]).filter(Boolean);
  const sc=scList.length?{bg:scList.map(s=>s.bg).join(" samt "), rec:scList.map(s=>s.rec).join("; ")}:{bg:"oklar orsak",rec:"fortsatt intensivvård"};
  const NM="DR "+name.toUpperCase();
  const correctDests=S.causes.map(x=>CAUSE_DEST[x.id]||"iva");
  const correct=correctDests.includes(dest);
  const correctDest=correctDests[0];
  const correctInfo=DEST_INFO[correctDest];
  S.sbar={done:false,score:0,total:0};
  const causeIds=Object.keys(SBAR_CAUSE).filter(k=>k!==c.id);
  const wrongC=causeIds[Math.floor(Math.random()*causeIds.length)];
  const wsc=SBAR_CAUSE[wrongC]||{bg:"en lungemboli som vi trombolyserat",rec:"akut trombektomi"};
  const SWRONG=[
    {txt:"en stroke",reply:"en stroke? Det stämmer inte med ett hjärtstopp. Var noga med vad som faktiskt hänt."},
    {txt:"ett krampanfall",reply:"ett krampanfall är inte samma sak som ett hjärtstopp, beskriv vad som verkligen inträffade."},
    {txt:"en svår KOL-exacerbation",reply:"det låter mer som en andningsbild än ett hjärtstopp, var exakt med situationen."},
    {txt:"en synkope utan hjärtstopp",reply:"en synkope utan stopp? Då är det en helt annan handläggning, stämmer det verkligen?"},
    {txt:"en anafylaxi",reply:"en anafylaxi? Det förändrar allt, är du säker på att det var det som gällde?"},
    {txt:"en sepsis med chock",reply:"sepsis och hjärtstopp är olika saker, beskriv vad som faktiskt hände först."}
  ];
  S._sWrong=SWRONG[Math.floor(Math.random()*SWRONG.length)];
  const mott = dest==="pci"?"PCI-lab":dest==="op"?"kirurgen":"IVA";
  const steps=[
   {tag:"S · SITUATION", npc:info.label+", dr "+name+". Jag hör att ni haft ett hjärtstopp på akuten, vad gäller det?",
    choices:[
     {good:true, say:"Det är akutläkaren. Vi har en patient med ROSC efter hjärtstopp som behöver "+mott+"-vård.", reply:"Bra, tydligt och koncist. Berätta bakgrunden."},
     {good:false, say:()=>"Det är akutläkaren. Vi har en patient med ROSC efter "+S._sWrong.txt+" som nu behöver "+mott+"-vård.", reply:()=>"Vänta, "+S._sWrong.reply,},
     {good:false, say:"Vi har en jättedålig patient, ni måste ta emot direkt!", reply:"Ta det lugnt, börja med vem du är och vad det gäller, så hänger jag med."}]},
   {tag:"B · BAKGRUND", npc:"Vad ligger bakom stoppet?",
    choices:[
     {good:true, say:"Orsaken bedöms vara "+sc.bg+".", reply:correct?"Uppfattat. Hur är patienten just nu?":"Jaha, okej."},
     {good:false, say:"Orsaken bedöms vara "+wsc.bg+".", reply:"Hmm, det rimmar illa med fynden ni beskrivit. Är du säker? Dubbelkolla vad ni faktiskt hittade och behandlade."},
     {good:false, say:"Vi vet inte riktigt, vi bara körde HLR.", reply:"Försök sammanfatta trolig orsak och given behandling, det är viktigt för fortsatt vård."}]}
  ];
  if(correct){
    steps.push({tag:"A · AKTUELLT", npc:"Hur ser patienten ut i nuläget?",
      choices:[
       {good:true, say:()=>vitalStr(), reply:"Tack, en tydlig lägesbild. Vad föreslår du?"},
       {good:false, say:"Patienten är vaken, andas själv med god saturation och är i stort sett stabil igen.", reply:"Vaken och andas själv direkt efter ett hjärtstopp låter för bra, kontrollera medvetande, luftväg och ventilation igen, det brukar inte stämma."},
       {good:false, say:"Hen verkar ganska stabil nu.", reply:"Jag behöver siffror, rytm, blodtryck, saturation, luftväg och EtCO₂."}]});
    const rec=[...new Set(S.causes.map(x=>destRec(dest,x.id)))].join("; ");
    steps.push({tag:"R · REKOMMENDATION", npc:"Vad rekommenderar du för fortsatt handläggning?",
      choices:[
       {good:true, say:"Överflytt till "+mott+": "+rec+".", reply:"Håller med, vi tar emot."},
       {good:false, say:"Överflytt till "+mott+", men i övrigt avvaktan utan definitiv åtgärd.", reply:"Det räcker inte för den här orsaken, tänk igenom vad patienten faktiskt behöver."},
       {good:false, say:"Vi väcker och extuberar patienten här nere.", reply:"Nej, direkt efter ROSC ska patienten ha kontrollerad ventilation, inte väckas."}]});
  }
  openDialogue({
    name:"Dr "+name, role:info.role, portrait:info.portrait(), speakerTag:NM,
    endBtn:"Lägg på",
    steps,
    closing:(d)=>{
      if(!correct) return "Det här låter faktiskt inte som vårt bord, det är "+correctInfo.label+" som ska ha den här patienten. Ring dit istället.";
      return (d.score>=3)
        ? "Utmärkt rapport, jag har hela bilden. Vi tar emot patienten, skicka med journal, blodgas och EKG. Snyggt jobbat!"
        : "Okej, tack. Vi tar emot, komplettera gärna med journal, blodgas och EKG så tar vi det därifrån.";
    },
    onFinish:(ok,d)=>{
      if(correct){
        S.post.orsak=true; S.post.dest=dest; S.sbar.done=true; S.sbar.score=d.score; S.sbar.total=d.total;
        flag("Korrekt disposition efter ROSC",+4);
        log("Rapport till "+info.label+" genomförd ("+d.score+"/"+d.total+" tydliga).","ok");
        mark("Telefonrapport: "+info.label,"call");
      } else {
        flag("Ringde fel instans, omdirigerad till "+correctInfo.label,-3);
        log(info.label+" avvisade fallet, hänvisar till "+correctInfo.label+". Ring rätt instans.","warn");
      }
    }
  });
}

/* ---------- Kirurgjouren (vid misslyckat thoraxdrän) ---------- */
const SURG_NAMES=["Sandberg","Novak","Ekström","Rahim","Persson"];
function openSurgeon(){
  const name=SURG_NAMES[Math.floor(Math.random()*SURG_NAMES.length)];
  const NM="DR "+name.toUpperCase();
  openDialogue({
    name:"Dr "+name, role:"Kirurgjour · mitt i en operation", portrait:surgeonPortrait(), speakerTag:NM,
    okFb:"✓ Tydligt, han lyssnar.", badFb:"✗ Otydligt, han tappar tålamodet.",
    hangupBtn:"Han la på, ring igen", endBtn:"Avsluta samtalet",
    steps:[
     {tag:"KIRURGJOUREN", npc:"Kirurgjouren. Jag står mitt inne i en operation, vad vill du?",
      choices:[
       {good:true, say:"Hej, akutläkaren. Patient i hjärtstopp med ventilpneumothorax där thoraxdränaget misslyckats, jag behöver dig akut för att lägga ett drän.",
        reply:"...Okej. Håll det kort och koncist. Vad är läget?"},
       {hangup:true, say:"Du måste komma ner NU, det är kaos här!",
        reply:"Jag har inte tid med panik. Ring tillbaka när du kan säga vad du faktiskt behöver."},
       {hangup:true, say:"Öh, vi har hållit på ett tag och det är lite rörigt...",
        reply:"Det där hjälper mig inte. Ring igen när du samlat dig."}]},
     {tag:"LÄGET", npc:"Vad är status, kortfattat?",
      choices:[
       {good:true, say:()=>"Ventilpneumothorax, nåldekomprimerad men behöver definitivt drän. Pågående HLR, "+vitalStr()+" Allt är framdukat.",
        reply:"Bra. Då kommer jag ner direkt. Ha thoraxlådan öppen och tvätta redan."},
       {hangup:true, say:"Det är svårt att säga exakt hur det ser ut just nu...",
        reply:"Då kan jag inte prioritera det här mitt i min operation. Ring tillbaka med ett tydligt läge."}]}
    ],
    closing:()=>"Jag är på väg. Vi löser det här tillsammans, ha allt klart.",
    onFinish:(ok)=>{
      if(ok){
        S.surgeonNeeded=false;
        S.surgeonArriveAt=S.t+30; S.surgeonPendingProc="dran";
        log("Kirurgen är på väg ner, framme om ca 30 sekunder. Fortsätt högkvalitativ HLR under tiden.","ok");
      } else {
        log("Kirurgen la på. Ring igen och var tydlig och koncis, situation, problem och vad du behöver.","warn");
      }
    }
  });
}
/* ---------- Enklare team-porträtt (SVG) ---------- */
function staffPortrait(top,cap){
  const skin=["#EBC8A4","#DFB289","#BE8757","#8F5C35"][Math.floor(Math.random()*4)];
  const hair=["#3a2f28","#6B4F35","#8a8a8a","#2E2A28"][Math.floor(Math.random()*4)];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#20303a"/>
    <rect x="18" y="72" width="64" height="34" rx="12" fill="${top}"/>
    <path d="M40 74v6a10 6 0 0 0 20 0v-6" fill="${top}"/>
    <circle cx="50" cy="45" r="21" fill="${skin}"/>
    ${cap?`<path d="M28 42a22 22 0 0 1 44 0v-2a22 12 0 0 0 -44 0z" fill="${cap}"/>`:`<path d="M28 46a22 22 0 0 1 44 0c0-18-10-26-22-26S28 28 28 46z" fill="${hair}"/>`}
    <circle cx="43" cy="46" r="2.1" fill="#2b2b2b"/><circle cx="57" cy="46" r="2.1" fill="#2b2b2b"/>
    <path d="M45 55q5 3 10 0" stroke="#9c6b4e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}
const uskPortrait=()=>staffPortrait("#5C8FC9");      // undersköterska, blå skjorta
const sskPortrait=()=>staffPortrait("#4E9A86");      // sjuksköterska, grön skjorta

/* ---------- Narkosläkaren: överväga att avbryta (dialog) ---------- */
function openNarkosFutility(){
  S._narkosSuggested=true; S.narkosSuggestedAt=S.t;
  const mins=Math.round(S.t/60);
  S._futility=null;
  openDialogue({
    name:"Narkosläkare", role:"Överväger fortsatt behandling", portrait:pImg("narkos"), speakerTag:"NARKOSLÄKARE",
    endBtn:"Verkställ beslut", finishBtn:"Verkställ beslut",
    steps:[{tag:"BESLUT", shuffle:false,
      npc:"Vi har följt algoritmen i "+mins+" minuter utan tecken på egen cirkulation"+(S.cause.futile?", och det finns inga tecken som talar för att detta går att vända":", och jag ser ingen reversibel orsak kvar att åtgärda")+". Ska vi överväga att avbryta återupplivningen?",
      choices:[
        {label:"Fortsätt ett tag till", say:"Vi fortsätter, jag vill ge det några cykler till och säkerställa att vi inte missat något åtgärdbart.",
         reply:"Okej, vi kör vidare. Jag säger till igen om läget inte ändras.", onPick:()=>{S._futility="continue";}},
        {label:"Avsluta återupplivningen", say:"Jag håller med, vi har gjort allt rimligt och konsekvent. Vi avslutar och konstaterar dödsfallet.",
         reply:"Uppfattat. Vi avslutar. Ett välorganiserat arbete under svåra förutsättningar.", onPick:()=>{S._futility="end";}}
      ]}],
    onFinish:()=>{ if(S._futility==="end"){ endScenario("Teamet beslutade gemensamt att avbryta HLR (utsiktslöst)."); }
                   else { S._narkosReAskAt=S.t+150; } }
  });
}

/* ---------- Undersköterskan trött efter lång kompression (dialog) ---------- */
function openCompressorTired(){
  S._fatiguePrompted=true;
  openDialogue({
    name:"Undersköterska", role:"Kompressör", portrait:pImg("nurse"), speakerTag:"UNDERSKÖTERSKA",
    endBtn:"Klart", finishBtn:"Klart",
    steps:[{tag:"KOMPRESSÖR", shuffle:false,
      npc:"Jag har komprimerat i över fyra minuter nu och börjar bli rejält trött, jag känner att djupet sjunker. Vi måste göra något så att kvaliteten inte blir lidande.",
      choices:[
        {label:"Byt kompressör", say:"Bra att du säger till, vi byter kompressör direkt.",
         reply:"Skönt, tack. Ny och pigg kompressör tar över på en gång.", onPick:()=>{ const a=ACTIONS.hlr.find(x=>x.id==="switch"); if(a&&a.enabled())a.run(); }},
        {label:"Sätt på LUCAS (mekanisk HLR)", say:"Vi kopplar på LUCAS så får du vila, den ger jämnt djup och frekvens.",
         reply:"Perfekt, då blir kompressionerna jämna hela vägen och jag kan hjälpa till med annat.", onPick:()=>{ const a=ACTIONS.hlr.find(x=>x.id==="lucas"); if(a&&!S.lucas&&a.enabled())a.run(); }}
      ]}]
  });
}

/* ---------- Sjuksköterskan påminner om obehandlad grundorsak (dialog) ---------- */
const NURSE_HINT={
  stemi:"Vi har chockat flera gånger utan att flimret bryts, ska vi dubbelkolla plattornas placering och överväga vektorbyte, och tänka på att detta troligen är kardiellt?",
  pe:"Med tanke på anamnesen, kan det vara en massiv lungemboli? Har du tänkt på trombolys?",
  hyperk:"Med njursvikten/dialysbakgrunden, kan kaliumet vara högt? Har du tänkt på kalciumklorid?",
  hypovol:"Hen har ju blött rejält, kan det vara hypovolemi? Har du tänkt på vätska och blod?",
  tension:"Ensidiga andningsljud och halsvenstas, kan det vara en tryckpneumothorax? Har du tänkt på att avlasta?",
  tamponad:"Dämpade hjärttoner och halsvenstas, kan det vara en hjärttamponad? Har du tänkt på ultraljud och tömning?",
  hypoxi:"Det började som en luftvägshändelse, kan det vara hypoxi? Har vi verkligen fri luftväg och god ventilation?",
  cico:"Vi får ju ingen luft in, mask, i-gel och tub, ingenting fungerar. Är det dags för en kirurgisk luftväg (koniotomi)?",
  toxin:"Med tabletterna hen tagit, kan det vara en förgiftning? Har du tänkt på buffert/motgift?",
  hypotermi:"Hen var ju rejält nedkyld, kan hypotermi ligga bakom? Har du tänkt på att mäta tempen och värma aktivt?",
  hypoca:"Kan kalknivån vara låg? Har du tänkt på att ge kalcium?",
  hypok:"De breda, polymorfa komplexen, kan det vara lågt kalium/magnesium? Har du tänkt på magnesiumsulfat?",
  commotio:"Ett kraftigt slag mot bröstet precis innan kollapsen, ung och tidigare frisk, kan det här vara commotio cordis? Tidig defibrillering är allt som behövs.",
  wpw:"Ett gammalt EKG med deltavåg och kraftig hjärtklappning som blev pulslös, kan det här vara WPW med preexciterat förmaksflimmer? Kom ihåg att AV-nodsblockerare är kontraindicerade.",
  longqt:"Återkommande svimningar och nyinsatta QT-förlängande läkemedel före kollapsen, kan det här vara torsades vid förvärvat långt QT? Har du tänkt på magnesium?",
  digitalis:"Patienten står på digoxin och har varit uttorkad med stigande kreatinin, med bidirektionell VT, kan det här vara digitalisintoxikation? Har du tänkt på Fab-antikroppar?"
};
function openCauseHint(){
  S._causeHinted=true;
  // Peka på en orsak som fortfarande är obehandlad (relevant i hardcore med två samtidiga
  // orsaker) i stället för alltid den första/primära, annars blir tipset inaktuellt så fort
  // den första är åtgärdad men den andra kvarstår.
  const untreated=S.causes.find(c=>c.treatedAt==null) || S.cause;
  const hint=NURSE_HINT[untreated.id]||"Har du tänkt igenom de reversibla orsakerna (4H och 4T), finns det något åtgärdbart vi missat?";
  openDialogue({
    name:"Sjuksköterska", role:"Reflekterar över orsaken", portrait:pImg("nurse"), speakerTag:"SJUKSKÖTERSKA",
    endBtn:"Tillbaka", finishBtn:"Tillbaka",
    steps:[{tag:"REVERSIBEL ORSAK", shuffle:false,
      npc:hint,
      choices:[
        {label:"Ja, bra tänkt, vi åtgärdar det", say:"Bra att du lyfter det, vi tar tag i den orsaken nu.",
         reply:"Toppen, jag förbereder det som behövs.", },
        {label:"Vi avvaktar tills vidare", say:"Vi avvaktar med det just nu.",
         reply:"Okej, säg till om du ändrar dig, jag har det i åtanke.", }
      ]}]
  });
}

function openGasReport(rows){
  if(typeof window!=="undefined" && window.AUTO_RHYTHM)return;   // headless: hoppa popupen
  const grid=$("gasGrid"); if(!grid)return;
  grid.innerHTML=rows.map(r=>`<div class="gas-row${r.abn?" abn":""}"><span class="lbl">${r.label}</span><span class="val">${r.val}${r.unit?" "+r.unit:""}</span></div>`).join("");
  $("gasMeta").innerHTML="Provtid "+mmss(S.t)+" · art. prov · "+(S.patient?S.patient.sex:"patient")+" · pågående hjärtstopp";
  S._speedBeforeGas=S.speed; S.speed=0; if(window.syncSpeed)window.syncSpeed();
  $("gasModal").classList.remove("hidden");
  $("gasOk").onclick=()=>{ $("gasModal").classList.add("hidden"); S.speed=S._speedBeforeGas||1; if(window.syncSpeed)window.syncSpeed(); };
}
/* Hur snabbt trycket faller utan vasopressor (mmHg/min).
   Vasoplegisk chock efter lång nedtid, blödning och toxinorsaker rasar; kort chockbart stopp
   med åtgärdad orsak är stabilare. */
function declineRate(){
  const c=S.cause;
  let r = 3.2;                                   // grund: post-arrest-svikt
  if(c.id==="hypovol"||c.trauma) r = 7.0;        // fortsatt blödande
  else if(c.id==="toxin") r = 5.5;               // myokarddepression
  else if(c.id==="pe") r = 5.2;                  // kvarstående obstruktion
  else if(c.id==="tamponad"||c.id==="tension") r = 4.8;
  else if(c.id==="hyperk"||c.id==="hypoca") r = 3.8;
  else if(c.id==="stemi") r = 4.4;               // kardiogen
  else if(c.id==="hypoxi") r = 3.6;
  else if(c.id==="cico") r = 3.8;                // svår hypoxisk skuld tills luftvägen säkrats
  if(S.t>720) r *= 1.3;                          // lång nedtid, sämre myokard
  if(S.post.reArrests) r *= 1+0.35*S.post.reArrests;
  return r/60;                                   // per sekund, vid OBEHANDLAD orsak
}
// Post-ROSC-svikt varierar med orsaken: rent elektriska händelser i ett strukturellt friskt hjärta
// (commotio, WPW, torsades av korrigerbar elektrolytrubbning) klarar sig ofta förvånansvärt bra,
// medan pumpsvikt/blödning/toxisk myokarddepression/uttalad hypoxi ger uttalad post-arrest-chock.
const POST_ROSC_SEVERE=["hypovol","toxin","hyperk","hypoxi","cico"];
const POST_ROSC_MILD=["commotio","wpw","longqt","hypok","hypoca"];
function postRoscTier(){
  const c=S.cause;
  if(c.trauma || POST_ROSC_SEVERE.includes(c.id)) return "severe";
  if(POST_ROSC_MILD.includes(c.id)) return "mild";
  return "moderate";
}
function achieveROSC(){
  S.rosc=true;S.roscAt=S.t;S.comp=false;S.perfusing=true;S.rhythm="sinus"; mark("ROSC","rosc");
  const tier=postRoscTier();
  S.post.sbt=Math.round(tier==="severe"?rnd(50,68):tier==="mild"?rnd(85,105):rnd(65,85));
  S.post.decline=declineRate(); S.post.lowSince=null; S.post.crashWarned=false;
  S.post.rearrested=false; S.post.deadline=null; S.post._d60=S.post._d120=S.post._w75=false;
  S.post.ekgRight=S.causes.some(c=>c.id==="stemi");
  log("★ PULS PALPERAS, ROSC efter "+mmss(S.t)+"! EtCO₂ stiger kraftigt.","ok");
  if(S.post.sbt>=100) log("Post-ROSC: blodtrycket är förvånansvärt bra (systoliskt ~"+S.post.sbt+" mmHg). Fortsätt övervaka noga, ingen uttalad chock just nu.","ok");
  else if(S.post.sbt>=85) log("Post-ROSC: blodtrycket är i underkant (systoliskt ~"+S.post.sbt+" mmHg). Håll noga koll, ingen uttalad chock men marginal saknas.","warn");
  else log("Post-ROSC: blodtrycket är LÅGT (systoliskt ~"+S.post.sbt+" mmHg), typisk post-arrest-svikt. Ge vätska och starta noradrenalininfusion (mål MAP ≥65 / systoliskt ≥100).","warn");
  if(S.post.decline*60>2.2) log("Cirkulationen är instabil, trycket faller. Du har inte lång tid på dig.","bad");
  log("Fortsatt post-ROSC-vård: ABCDE, syrgas 94–98 %, 12-EKG, blodtryck, temperaturkontroll, åtgärda orsak.","sys");
  if(S.mode==="guide"){ // säkerställ att post-ROSC-verktygen är åtkomliga innan vi byter flik
    unlockAllTools(); S.unlockedTabs.add("rosc");
    ["p_abcde","p_o2","p_airway","p_ekg","p_bt","p_fluid","p_noradr","p_orsak","p_klar"].forEach(id=>S.unlocked.add(id));
  }
  setTab("rosc");
}

/* ============================================================
   12-AVLEDNINGS-EKG
   Modellen: en hjärtvektor i frontalplanet projiceras på hexaxial-
   systemets sex axlar (I, II, III, aVR, aVL, aVF). Precordialavled-
   ningarna V1–V6 modelleras med sin R/S-progression i horisontalplanet.
   Att projicera i stället för att rita tolv kurvor för hand ger rätt
   polaritet gratis: aVR blir negativ, reciproka sänkningar hamnar
   automatiskt mitt emot ST-höjningarna.
   Skala: 25 mm/s, 10 mm/mV, som på riktigt papper.
   ============================================================ */
