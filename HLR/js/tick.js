function tick(dt){
  if(!S.running||S.ended)return;
  if(S.phase==="prearrival"){
    if(dt>0){
      S.arrivalIn=Math.max(0,S.arrivalIn-dt);
      if(S.arrivalIn<=0){ arrivePatient(); return; }
    }
    render(dt);           // ritar tom brits + nedräkning i klockan
    return;
  }
  S.t+=dt;
  if(dt>0){ processQueues(dt); trackWorkload(dt); }
  if(S.charging && S.t>=S.chargeReadyAt){ S.charging=false; S.charged=true; S.chargeAt=S.t;
    if(S.autoShock){ S.autoShock=false; log("Fulladdad, defibrillerar.","warn"); deliverShock(); }
    else log("Defibrillatorn är fulladdad och redo, ropa 'undan!' och defibrillera.","warn"); }
  tickComplications();
  if(dt>0){ tickInfusions(dt); tickPneumo(dt); }
  if(dt>0){
    if(S.rosc) tickPostROSC(dt);
    else if(S.post.rearrested) tickReArrest(dt);
    if(S.ended)return;
  }
  guideTick();
  if(!S.teamArrived && S.t>=240){ S.teamArrived=true;
    log("Förstärkning på plats: narkosläkare tar över luftvägen (kan nu intubera) och IVA-sjuksköterska tar över den kontinuerliga ventilationen (blåsa/i-gel/tub). Ambulanspersonalen stannar kvar i teamet och kan avlösa vid bröstet eller ta andra uppgifter.","ok");
    if(S.vent){S.ventBy="ivassk";
      log("Narkossköterskan tar över ventilationen, jämnare volymer och bättre tätning än tidigare.","ok");}
    buildTabs&&renderActions&&renderActions(true);
  }
  // Rytmen kan skifta mellan rytmkontrollerna, tvingar fram ny kontroll och anpassning
  if(S._rhythmShiftAt===undefined)S._rhythmShiftAt=rnd(150,250);
  if(!S.rosc && !S.ended && !S.cause.futile && !S.perfusing && S.mode==="veteran"
     && S.recoverAt===null && S._rhythmShift<1 && S.t>=S._rhythmShiftAt){
    S._rhythmShift++;
    if(S.rhythm==="VF"){ S.rhythm="asystoli";
      log("Rytmen på monitorn övergår från kammarflimmer mot en linje som liknar asystoli, gör en ny rytmkontroll och anpassa (chocka inte asystoli).","warn"); }
    else if(S.rhythm==="pVT"){ S.rhythm="VF";
      log("Den breda takykardin på monitorn har brutit ihop till kammarflimmer, gör en ny rytmkontroll. Fortfarande chockbar.","warn"); }
    else if(S.rhythm==="asystoli"){ S.rhythm="VF"; S.fineVF=true;
      log("Rytmen på monitorn har blivit oregelbunden, det ser ut som kammarflimmer nu. Gör en ny rytmkontroll, är den chockbar?","warn"); }
    else if(S.rhythm==="PEA"){ S.rhythm=chance(0.5)?"VF":"asystoli";
      log("Rytmen på monitorn förändras, gör en ny rytmkontroll för att se vad som pågår.","warn"); }
  }
  // Kirurgen anländer (~30 s efter lyckat samtal) och går in i teamet
  if(S.surgeonArriveAt!==null && !S.surgeonPresent && S.t>=S.surgeonArriveAt){
    S.surgeonPresent=true; S.surgeonArriveAt=null;
    log("Kirurgen anländer, tvättad och klar, och går in i teamet.","ok");
    if(S.surgeonPendingProc==="dran") log("Kirurgen: \u201dJag är här. Säg till när du vill att jag lägger dränet.\u201d, beordra thoraxdränet när du är redo.","warn");
    S.surgeonPendingProc=null;
    if(typeof buildTabs==="function")buildTabs(); if(typeof renderActions==="function")renderActions(true); if(typeof renderTeam==="function")renderTeam();
  }
  // (Kaliumet stiger tyst under stoppet, upptäcks endast om man kontrollerar blodgasen.)
  // Narkosläkaren tar upp frågan om att avbryta (dialog) efter en tid utan cirkulation
  if(S.teamArrived && !S.rosc && !S.ended && !DLG && (!S._narkosSuggested || (S._narkosReAskAt&&S.t>=S._narkosReAskAt))){
    if(S._narkosSuggestAt===0)S._narkosSuggestAt=rnd(360,480);
    if(S.t>=S._narkosSuggestAt && (!S._narkosReAskAt || S.t>=S._narkosReAskAt)){
      S._narkosReAskAt=null;
      openNarkosFutility();
    }
  }
  // Sjuksköterskan påminner om obehandlad grundorsak efter 5 min
  if(!S.rosc && !S.ended && !DLG && !S._causeHinted && !S.cause.futile && S.causeTreatedAt===null && S.t>=300){
    openCauseHint();
  }
  // Sjuksköterskans protokollföring är inte ett engångsklick utan en levande kvalitetsnivå:
  // den stiger medan hon faktiskt är ledig, sjunker medan hon är upptagen med annat (kompressioner
  // eller något i sin egen kö) — precis som i verkligheten hinner hon inte dokumentera konsekvent
  // samtidigt som hon gör annat.
  if(S.protokoll && !S.rosc && !S.ended){
    S.protokollQuality=clamp(S.protokollQuality+(documenting()?dt*10:-dt*6),0,100);
    S.protokollQualitySum+=S.protokollQuality*dt; S.protokollQualityDt+=dt;
  }
  // Ropar ut nästa rytmkontroll (~15 s före) och påminner om adrenalintiming — men bara om
  // dokumentationskvaliteten just nu räcker till (≥50 %), annars hinner hon inte ropa ut det.
  // Särskilt värdefullt i expertläge där hjälptimrarna upptill är dolda.
  if(S.protokoll && !S.rosc && !S.ended && S.lastAnalysis!==null){
    const sedan=S.t-S.lastAnalysis;
    if(sedan>=105 && sedan<120 && !S._protRoped){ S._protRoped=true;
      if(S.protokollQuality>=50) log("Sjuksköterskan (protokoll): \u201dSnart två minuter, gör er redo för nästa rytmkontroll om cirka 15 sekunder.\u201d","sys"); }
    if(sedan<105 && S._protRoped)S._protRoped=false;
  }
  if(S.protokoll && !S.rosc && !S.ended && S.adrenalin.length>0){
    const sedanAdr=S.t-S.adrenalin[S.adrenalin.length-1];
    if(sedanAdr>=180 && !S._protAdrRoped){ S._protAdrRoped=true;
      if(S.protokollQuality>=50) log("Sjuksköterskan (protokoll): \u201dTre minuter sedan senaste adrenalin, dags för nästa dos snart.\u201d","sys"); }
    if(sedanAdr<180 && S._protAdrRoped)S._protAdrRoped=false;
  }
  if(!S.rosc){
    S.arrestTime+=dt;
    // hands-off & kvalitet
    if(!S.comp)S.handsOff+=dt;
    if(S.comp){
      const since=S.t-S.lastSwitch;
      // Alex: IVA-sjuksköterska, kompressionskvaliteten håller sig hög dubbelt så länge.
      const fatigueGrace=S.profile==="alex"?220:110, fatigueDecay=S.profile==="alex"?260:130;
      S.compressorFatigue=S.lucas?1:(since<fatigueGrace?1:clamp(1-(since-fatigueGrace)/fatigueDecay,0.4,1));
      if(!S.lucas && since>=240 && !S._fatiguePrompted && !DLG){ openCompressorTired(); }
      if(since<15)S._fatiguePrompted=false;
    }
    S.qWindow.push(S.comp?S.compressorFatigue:0);
    if(dt>0 && S.qWindow.length>120/dt)S.qWindow.splice(0,S.qWindow.length-120/dt);
    // ventilationsgap
    if(S.vent&&(S.comp||S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi"))S.ventGap=0;else S.ventGap+=dt;
    // laddning löper ut
    if(S.charged&&S.t-S.chargeAt>30){S.charged=false;log("Defibrillatorn har laddat ur (säkerhetstimeout 30 s).","warn");}
    // hypoxi-behandling: luftväg + O2 + ventilation över tid
    { const cHypoxi=hasActiveCause("hypoxi");
      if(cHypoxi&&(S.airway==="tub"||S.airway==="igel")&&S.o2max&&S.vent){
        S.treatProgress.oxytid_hypoxi=(S.treatProgress.oxytid_hypoxi||0)+dt;
        if(S.treatProgress.oxytid_hypoxi>25){markCauseTreated(cHypoxi);log("Saturationen på blodgasen förbättras, hypoxin är under behandling.","ok");}
      }
    }
    // CICO-behandling: säkrad kirurgisk luftväg (koniotomi) + O2 + ventilation över tid
    { const cCico=hasActiveCause("cico");
      if(cCico&&S.airway==="koniotomi"&&S.o2max&&S.vent){
        S.treatProgress.oxytid_cico=(S.treatProgress.oxytid_cico||0)+dt;
        if(S.treatProgress.oxytid_cico>25){markCauseTreated(cCico);log("Efter koniotomin stiger saturationen på blodgasen, patienten går äntligen att syresätta. Obstruktionen är förbikopplad.","ok");}
      }
    }
    // hypotermi
    { const cHypo=hasActiveCause("hypotermi");
      if(cHypo&&S.warming&&hypotermiVarm()){
        markCauseTreated(cHypo);log("Kärntemperatur nu 31,5 °C, defibrillering har åter förutsättning att lyckas.","ok");
      }
    }
    // PE-trombolys: effekt efter ~3 min
    { const cPe=hasActiveCause("pe");
      if(cPe&&S.drugTrombolysAt&&S.t-S.drugTrombolysAt>45){
        markCauseTreated(cPe);log("Trombolysen börjar verka, motståndet i lungkretsloppet minskar.","ok");
      }
    }
    // spontana händelser
    spontaneousEvents(dt);
    // --- Återhämtning efter korrekt åtgärd (orsak åtgärdad eller lyckad chock) ---
    // Krav: hyfsad kompressionskvalitet. Adrenalin snabbar upp men är inte ett hårt villkor.
    // Ger effekt ~30–60 s efter rätt insats.
    if(!S.rosc && !S.cause.futile && S.recoverAt!==null && !S.perfusing){
      const adrOk=recentAdrenalin(), cprOk=qualityAvg()>0.30;
      const proceed=()=>{
        if(cprOk){
          if(!adrOk && !S._waitedAdr){ S._waitedAdr=true; S.recoverAt=S.t+14;
            if(!S._adrNag){S._adrNag=true;log("Cirkulationen är på väg tillbaka, ge adrenalin för att stötta den ytterligare.","warn");}
            return false;
          }
          return true;
        }
        S.recoverAt=S.t+8;
        if(!S._cprNag){S._cprNag=true;log("Höj kompressionskvaliteten (djup, frekvens, minimala avbrott) så cirkulationen kan komma igång.","warn");}
        return false;
      };
      if(S.rhythm==="asystoli"){
        if(S.t>=S.recoverAt && proceed()){ S.rhythm="PEA"; S.recoverAt=S.t+rnd(8,15); S._waitedAdr=false;
          log("Enstaka breda komplex syns på monitorn, elektrisk aktivitet återkommer.","sys"); }
      } else if(S.rhythm==="PEA"||S.rhythm==="organiserad"){
        if(S.t>=S.recoverAt && proceed()){
          if(!canROSC()){ S.recoverAt=S.t+6; }   // för tidigt, kräver ≥6 min OCH ≥3 cykler av HLR
          else {
            S.perfusing=true; S.rhythm="organiserad"; S.refibArmed=true; scheduleRecognition();
            log((S.capno&&(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi"))
                ? "EtCO₂ stiger plötsligt kraftigt, tecken på begynnande egen cirkulation! Kontrollera puls."
                : "Kurvan organiseras och pulsationer anas, begynnande egen cirkulation! Kontrollera puls.","ok");
          }
        }
      }
    }
    // ROSC upptäcks INTE automatiskt, patienten kan perfundera men måste bekräftas
    // med en rytm-/pulskontroll (se applyRhythmOutcome). Monitorn/EtCO₂ ger ledtråden.
    if(S.rhythm==="organiserad"&&S.refibArmed&&S.cause.rytm==="VF"){
      // refibrillering
      const refP=(S.amiodaron>0?0.0004:0.0013)*dt;
      if(chance(refP)){S.rhythm="VF";S.refibArmed=false;S.perfusing=false;
        S.roscRecognizeAt=null;S.recoverAt=null;
        log("Monitorn visar åter kaotisk kurva under kompressionerna (re-fibrillering), defibrillera igen.","warn");}
    }
    // VF-degradering
    if((S.rhythm==="VF")&&S.t>S.degradeAt){
      if(qualityAvg()<0.5&&chance(0.0008*dt)){S.rhythm="asystoli";log("Flimret har klingat av till asystoli.","bad");}
      else if(S.t>420)S.fineVF=true;
    }
    // hjälp om inget händer
    if(S.firstCompAt===null&&S.t>15&&!S._nagged){S._nagged=true;log("Patienten är pulslös, starta kompressioner!","bad");}
  }
  S.shockFlash=Math.max(0,S.shockFlash-dt*3);
  render(dt);
}

function spontaneousEvents(dt){
  // HLR-inducerad medvetenhet
  if(!S.cpric.triggered&&(S.rhythm==="VF")&&S.t>240&&qualityAvg()>0.8&&chance(0.0015*dt)){
    S.cpric.triggered=true;
    log("Patienten grimaserar och för armen mot bröstet UNDER pågående kompressioner, HLR-inducerad medvetenhet utan ROSC!","warn");
    log("Överväg små doser sedering/analgesi (ketamin/fentanyl). Ge ALDRIG enbart muskelrelaxantia.","sys");
  }
}

/* ---------- Avsluta ---------- */
function endScenario(reason){
  if(S.ended)return;
  S.ended=true;S.running=false;S.endReason=reason;
  showResults();
}

/* ---------- Poäng ---------- */
function computeScore(){
  const rows=[];let total=0;
  const add=(txt,pts,max)=>{rows.push({txt,pts,max});total+=pts;};
  const c=S.cause, shockbar=c.rytm==="VF";
  // 1. Tid till kompressioner
  const t1=S.firstCompAt===null?999:S.firstCompAt;
  add("Kompressioner startade "+(S.firstCompAt===null?"aldrig":"efter "+mmss(t1)), t1<=20?6:t1<=45?4:t1<=90?2:0,6);
  // 2. Första defibrillering (chockbar)
  if(shockbar){
    const ts=S.firstShockAt;
    add("Första defibrillering "+(ts===null?"gavs aldrig":"efter "+mmss(ts))+" (mål <3 min)", ts===null?0:ts<=180?10:ts<=300?6:2,10);
  } else {
    const ta=S.firstAdrAt;
    add("Adrenalin vid icke-chockbar rytm "+(ta===null?"gavs aldrig":"efter "+mmss(ta))+" (mål: snarast)", ta===null?0:ta<=180?10:ta<=300?6:2,10);
  }
  // 3. Adrenalin-intervall
  let adrScore=0;
  if(S.adrenalin.length>=2){
    let ok=0;for(let i=1;i<S.adrenalin.length;i++){const g=S.adrenalin[i]-S.adrenalin[i-1];if(g>=150&&g<=330)ok++;}
    adrScore=Math.round(8*ok/(S.adrenalin.length-1));
  } else if(S.adrenalin.length===1&&S.arrestTime<300) adrScore=6;
  add("Adrenalin upprepat var 3–5 min ("+S.adrenalin.length+" doser)",adrScore,8);
  // 4. Amiodaron
  if(shockbar){
    let am=0;
    if(S.amiodaron>=300&&S.shocks>=3)am+=4;
    if(S.amiodaron>=450&&S.shocks>=5)am+=2;else if(S.shocks<5&&S.amiodaron>=300)am+=2;
    if(S.lidokain&&!S.amiodaron&&S.shocks>=3)am=4;
    add("Antiarytmika efter 3:e (300 mg) och 5:e (150 mg) chocken",am,6);
  }
  // 5. Hands-off
  const frac=S.arrestTime>0?1-S.handsOff/S.arrestTime:0;
  add("Kompressionsfraktion "+(frac*100).toFixed(0)+" % (mål >80 %)", frac>=0.85?10:frac>=0.75?7:frac>=0.6?4:0,10);
  // 6. Peri-chock-pauser
  if(S.periPauses.length){
    const snitt=S.periPauses.reduce((a,b)=>a+b,0)/S.periPauses.length;
    add("Peri-chock-paus i snitt "+snitt.toFixed(1)+" s (mål <5 s, ladda under kompressioner)", snitt<=5?8:snitt<=10?5:2,8);
  }
  // 7. Rytmkontroller varje 2 min
  if(S.checksExpected>0){
    const avg=S.checkDeviation/S.checksExpected;
    add("Rytmkontroll varannan minut (snittavvikelse "+avg.toFixed(0)+" s)", avg<=15?8:avg<=30?6:avg<=60?3:0,8);
  } else add("Rytmkontroller genomfördes "+(S.analysisCount>0?"1 gång":"aldrig"),S.analysisCount>0?2:0,8);
  // 7b. Rytmigenkänning vid kontroll (quiz)
  const rq=S.rhythmQuiz;
  if(rq.total>0){
    const idPts=Math.round(6*rq.correct/rq.total);
    add("Korrekt rytmigenkänning ("+rq.correct+"/"+rq.total+")", idPts,6);
    if(rq.pulseTotal>0){
      const puPts=Math.round(4*rq.pulseCorrect/rq.pulseTotal);
      add("Korrekt puls/ROSC-bedömning vid organiserad rytm ("+rq.pulseCorrect+"/"+rq.pulseTotal+")", puPts,4);
    }
  }
  // 8. Kompressorbyten
  add("Kompressörbyten ("+S.switchesOk+" i tid, "+S.switchesMissed+" missade)", clamp(5-2*S.switchesMissed+S.switchesOk,0,5),5);
  // 8b. Slumpade komplikationer
  if(S.complicationsFired>0){
    add("Komplikationer hanterade ("+S.complicationsResolved+"/"+S.complicationsFired+")",
      Math.round(4*S.complicationsResolved/S.complicationsFired),4);
  }
  // 9. Luftväg
  let aw=0;
  if(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi")aw+=3;
  if(S.capno&&S.airway==="tub")aw+=3;else if(S.capno)aw+=2;
  if(S.o2max)aw+=2;
  if(S.airway==="tub"&&!S.capno){aw-=3;}
  add("Luftväg, kapnografi och maximal syrgas",clamp(aw,0,8),8);
  // 10. Reversibel orsak
  const identified=S.revealed.hist||S.revealed.gas||S.revealed.us||S.revealed.status;
  add("Aktivt letande efter reversibel orsak (anamnes/UL/blodgas/status)", (S.revealed.hist?1:0)+(S.revealed.gas?1:0)+(S.revealed.us?2:0)+(S.revealed.status?1:0)+(S.usDone?1:0),6);
  // 10b. Fysiologiguidad HLR (om artärnål användes)
  if(S.artline){
    add("Fysiologiguidad HLR: invasivt tryck + diastoliskt mål ≥30 mmHg", S.dbpAchieved?4:1,4);
  }
  if(c.behandling){
    add("Orsaksspecifik behandling: "+c.namn, S.causeTreatedAt!==null?10:0,10);
  } else {
    add("Orsak ("+c.namn+") kräver defibrillering, ingen specifik intra-arrest åtgärd", 5,5);
  }
  // 11. ROSC
  if(S.endReason==="rearrest3"||S.endReason==="rearrest_timeout"){
    add("Patienten avled efter re-arrest, ROSC gick inte att återställa",0,12);
    add("Post-ROSC-cirkulationen tilläts kollapsa ("+S.post.reArrests+" nya hjärtstopp)",-6,0);
  } else if(S.rosc){
    add("ROSC uppnådd efter "+mmss(S.roscAt), S.roscAt<=480?12:S.roscAt<=900?9:6,12);
    const p=S.post;const pn=[p.abcde,p.ekg,p.o2,p.bt,p.orsak,p.airway].filter(Boolean).length;
    add("Post-ROSC-vård ("+pn+"/6 åtgärder)",pn*1.5,9);
    add("Blodtrycksmål efter ROSC (systoliskt "+Math.round(p.sbt||0)+" mmHg"+(p.noradr?", noradrenalin":"")+")", p.sbt>=100?6:p.sbt>=90?3:0, 6);
    if(!p.noradr&&p.sbt<100) add("Vasopressor aldrig startad trots kvarstående hypotension",-3,0);
    if(p.reArrests) add("Patienten gick om i hjärtstopp "+p.reArrests+" gång"+(p.reArrests>1?"er":"")+" efter ROSC",-4*p.reArrests,0);
    if(c.id==="stemi") add("Reperfusion vid STEMI: "+(p.dest==="pci"?"PCI-lab aktiverat":"ingen PCI"), p.dest==="pci"?8:0,8);
    if(S.sbar.done){
      add("Rapport till mottagande enhet ("+S.sbar.score+"/"+S.sbar.total+" tydliga)", Math.round(6*S.sbar.score/Math.max(1,S.sbar.total)),6);
    } else {
      add("Rapport till mottagande enhet genomfördes inte",0,6);
    }
  } else if(S.cause.futile){
    // Utsiktslöst fall, ROSC var inte möjligt. Bedöm processen och beslutet, inte utfallet.
    add("Utsiktslöst läge (ROSC ej möjligt), bedöms på handläggning och beslut", 0, 0);
    if(S.endReason==="avbrutet"){
      const efterForslag=S._narkosSuggested;
      const rimlig=S.t>=360 && (S.rhythm==="asystoli"||S.shocks>=3||S.t>=480);
      add("Beslut att avbryta utsiktslös HLR: "+(efterForslag&&rimlig?"välavvägt och i samråd med teamet":rimlig?"rimligt":"möjligen förhastat"),
          (efterForslag&&rimlig)?12:rimlig?8:2,12);
    } else {
      add("Utsiktslös HLR fortsatte utan beslut om att avbryta (överväg att avsluta i samråd med teamet)",0,12);
    }
  } else {
    add("ROSC uppnåddes inte",0,12);
    if(S.endReason==="avbrutet"){
      const rimligt=S.t>1500&&S.rhythm==="asystoli"&&(S.causeTreatedAt||!c.behandling);
      add("Beslut att avbryta: "+(rimligt?"rimligt efter lång asystoli med åtgärdade orsaker":"möjligen förhastat, reversibla orsaker/tid kvar"),rimligt?4:-4,4);
    }
  }
  // 11b. Pneumothorax
  if(S.pneumo){
    const p=S.pneumo;
    if(p.iatrogen) add("Iatrogen pneumothorax (subclaviapunktion)",-6,0);
    if(p.tension) add("Ventilpneumothorax kvarstod obehandlad vid scenariots slut",-10,0);
    else if(p.definitive) add("Pneumothorax definitivt dränerad med thoraxdrän",6,6);
    else if(p.drained) add("Pneumothorax avlastad med nål (ej definitivt dränerad)",3,6);
    else if(!p.tension) add("Pneumothorax upptäcktes aldrig"+((S.airway==="tub"||S.airway==="igel")?", turen var med dig":""),0,6);
  }
  if(S._dbgUsed) add("⚠ DEBUGLÄGE ANVÄNT, poängen är inte giltig",0,0);
  // 12. Flaggor
  for(const f of S.flags)add(f.txt,f.pts,Math.max(0,f.pts));
  const max=rows.reduce((a,r)=>a+Math.max(r.max,0),0);
  // 13. Svårighetsbonus (avancerad/expert) — skalas mot hur väl du presterade,
  //     så bra spel i svårare läge belönas. Räknas som ren bonus (höjer inte max).
  if(!S._dbgUsed && (S.level==="advanced"||S.level==="expert"||S.level==="hardcore")){
    const factor = S.level==="hardcore" ? 0.40 : S.level==="expert" ? 0.30 : 0.15;
    const base = Math.max(0, Math.round(total));           // intjänade poäng före bonus
    const bonus = Math.round(base*factor);
    const modeLabel = S.level==="hardcore"?"Hardcore-läge":S.level==="expert"?"Expertläge":"Avancerat läge";
    if(bonus>0){ rows.push({txt:modeLabel+": svårighetsbonus (+"+Math.round(factor*100)+" % av intjänade poäng)", pts:bonus, max:0, bonus:true}); total+=bonus; }
  }
  return {rows,total:Math.round(total),max};
}

/* ---------- Teamnyttjande (arbetsbelastning per person) ----------
   Visar hur stor del av sin tid på plats varje teammedlem var aktiv (uppgift
   eller komprimering) respektive stod stilla. Hög andel stilltid hos flera
   samtidigt talar för att du som ledare kunde ha delegerat mer parallellt. */
function buildWorkload(){
  const order=["lakare","ssk","usk","ambulans","narkos","ivassk"];
  const present=order.filter(r=>S.workload[r]&&S.workload[r].avail>=1);
  if(!present.length)return "";
  let sumAvail=0,sumActive=0;
  const rows=present.map(role=>{
    const w=S.workload[role];
    const avail=Math.max(w.avail,0.1);
    const active=clamp(w.active,0,avail);
    const comp=clamp(w.comp,0,active);
    const vent=clamp(w.vent||0,0,active-comp);
    const task=Math.max(active-comp-vent,0);
    sumAvail+=avail; sumActive+=active;
    const idlePct=Math.round(100*(avail-active)/avail);
    const compPct=100*comp/avail, ventPct=100*vent/avail, taskPct=100*task/avail;
    const cls=idlePct>=60?"hi":idlePct<=30?"lo":"";
    const name=ROLE_NAMES[role].replace(" (du)","");
    const youTag=role==="lakare"?" <small>(du, teamledare)</small>":"";
    return `<div class="wl-row">
      <div class="wl-name">${name}${youTag}<small>på plats ${mmss(avail)} · aktiv ${mmss(active)}${vent>=1?" · ventilerade "+mmss(vent):""}</small></div>
      <div class="wl-bar" title="Aktiv ${Math.round(100*active/avail)} %, stilla ${idlePct} %">
        <div class="wl-seg comp" style="width:${compPct.toFixed(1)}%"></div>
        <div class="wl-seg vent" style="width:${ventPct.toFixed(1)}%"></div>
        <div class="wl-seg task" style="width:${taskPct.toFixed(1)}%"></div>
      </div>
      <div class="wl-idle-pct ${cls}">${idlePct}% stilla</div>
    </div>`;
  }).join("");
  const teamIdle=Math.round(100*(sumAvail-sumActive)/Math.max(sumAvail,1));
  const verdict = teamIdle>=55 ? "Stora delar av teamet stod stilla, mer kunde ha delegerats parallellt (t.ex. tidig infart, blodgas, ultraljud och förberedelser samtidigt)."
                : teamIdle>=35 ? "Rimligt nyttjande, men det fanns luckor där fler uppgifter kunde ha körts parallellt."
                : "Effektivt lett, teamet hölls sysselsatt med parallella uppgifter genom hela förloppet.";
  const legend=`<div class="wl-legend">
    <span><i style="background:var(--red)"></i>Komprimerar</span>
    <span><i style="background:#4E8F87"></i>Ventilerar</span>
    <span><i style="background:#3E7CB1"></i>Annan uppgift</span>
    <span><i style="background:var(--line)"></i>Stilla</span></div>`;
  return `<div class="wl"><h3>Teamnyttjande</h3>
    <p class="wl-sub">Andel av tiden på plats som varje person var sysselsatt. Som teamledare är målet att hålla fler händer i arbete samtidigt.</p>
    ${rows}${legend}
    <div class="wl-team">Teamet stod stilla i snitt <b>${teamIdle} %</b> av den samlade tiden på plats. ${verdict}</div></div>`;
}
function buildDebrief(rows){
  const total=Math.max(S.t,1);
  const tl=S.timeline.slice().sort((a,b)=>a.t-b.t);
  const shockable=S.cause.rytm==="VF";
  // --- nyckeltal ---
  const padsAt=(tl.find(e=>e.kind==="pads")||{}).t;
  const metric=(label,val,target,miss)=>`<div class="tl-metric${miss?" miss":""}"><b>${val}</b><span>${label}${target?" · "+target:""}</span></div>`;
  let metrics="";
  metrics+=metric("Tid till HLR", S.firstCompAt!=null?mmss(S.firstCompAt):"–", "mål <20 s", S.firstCompAt==null||S.firstCompAt>45);
  if(shockable) metrics+=metric("Första defibrillering", S.firstShockAt!=null?mmss(S.firstShockAt):"ingen", "mål <3 min", S.firstShockAt==null||S.firstShockAt>180);
  metrics+=metric("Första adrenalin", S.firstAdrAt!=null?mmss(S.firstAdrAt):"ingen", shockable?"efter 3:e chocken":"mål <2 min", S.firstAdrAt==null||(!shockable&&S.firstAdrAt>150));
  metrics+=metric("Orsak åtgärdad", S.causeTreatedAt!=null?mmss(S.causeTreatedAt):"aldrig", "4H & 4T", S.causeTreatedAt==null);
  metrics+=metric(S.rosc?"ROSC":(S.cause.futile?"Utsiktslöst":"Utfall"), S.rosc?mmss(S.roscAt):(S.cause.futile?"ROSC ej möjligt":"ingen ROSC"), "", S.rosc?false:!S.cause.futile);
  // --- tidslinje med radstaplade etiketter, växelvis över/under (inga överlapp) ---
  const bench = shockable ? `<div class="tl-bench" style="left:${clamp(100*180/total,0,100)}%"><span>3 min</span></div>` : "";
  const labeled=new Set(["comp","pads","shock","cause","rosc","airway","drug","rearrest","death","complication"]);
  const TRACKPX=560, LANE_H=24, GAP=8, MAXLANE=4;
  const lanes={up:[],down:[]};
  let evs="", maxUp=0, maxDown=-1;
  tl.forEach((e)=>{
    const leftPct=clamp(100*e.t/total,0,100);
    const leftPx=leftPct/100*TRACKPX;
    if(!labeled.has(e.kind)){
      evs+=`<div class="tl-ev k-${e.kind}" style="left:${leftPct}%"><i></i></div>`;
      return;
    }
    // etiketten är centrerad över punkten → halva bredden åt vardera håll
    const halfW=Math.max(24, e.label.length*3.6);
    const L=leftPx-halfW, R=leftPx+halfW;
    // välj den sida som ger lägst lane; vid lika, den sida som är minst använd
    const findLane=(side)=>{
      const arr=lanes[side]; let l=0;
      while(l<=MAXLANE && arr[l]!=null && L < arr[l]+GAP) l++;
      return l;
    };
    let up=findLane("up"), down=findLane("down");
    let side = (down<up) ? "down" : (up<down) ? "up" : (maxUp<=maxDown ? "up" : "down");
    let lane = side==="up" ? up : down;
    if(lane>MAXLANE){                       // full sida, testa den andra
      const other = side==="up" ? "down" : "up";
      const ol = findLane(other);
      if(ol<=MAXLANE){ side=other; lane=ol; } else { lane=MAXLANE; }
    }
    lanes[side][lane]=R;
    if(side==="up"){ if(lane>maxUp)maxUp=lane; } else if(lane>maxDown)maxDown=lane;
    const off=14+lane*LANE_H;
    const pos = side==="up" ? `bottom:${off}px` : `top:${off}px`;
    evs+=`<div class="tl-ev k-${e.kind}" style="left:${leftPct}%"><i></i>`+
      `<span class="tl-conn ${side}" style="height:${off-6}px"></span>`+
      `<div class="tl-lab ${side}" style="${pos}"><label>${e.label}</label><time>${mmss(e.t)}</time></div></div>`;
  });
  // topPad måste rymma: avstånd till etikett (off) + etikettens egen höjd
  // (namnrad + tidsrad + padding, ≈22px) + lite säkerhetsmarginal, annars
  // skär de översta etiketterna in i statistikrutorna ovanför tidslinjen.
  const topPad=44+maxUp*LANE_H;
  const botPad=maxDown>=0 ? 40+maxDown*LANE_H : 0;
  const legend=`<div class="tl-legend">
    <span><i style="background:#8FA3B5"></i>HLR/plattor</span>
    <span><i style="background:var(--red)"></i>Chock</span>
    <span><i style="background:#3E7CB1"></i>Läkemedel</span>
    <span><i style="background:#4E8F87"></i>Luftväg</span>
    <span><i style="background:#7E57C2"></i>Orsak åtgärdad</span>
    <span><i style="background:#c9c4c1"></i>Rytmkontroll</span>
    <span><i style="background:#E67E22"></i>Komplikation</span>
    <span><i style="background:var(--red)"></i>Re-arrest</span>
    <span><i style="background:var(--ok)"></i>ROSC</span></div>`;
  const timeline=`<div class="tl" style="margin-top:${topPad}px;margin-bottom:${botPad}px">${bench}<div class="tl-track">${evs}</div>
    <div class="tl-axis" style="top:${botPad+14}px"><span>00:00</span><span>${mmss(total)}</span></div></div>${legend}`;
  // --- tips (regelbaserade + störst poängglapp) ---
  const tips=[];
  if(shockable&&(S.firstShockAt==null||S.firstShockAt>180))
    tips.push("Defibrillera snabbare vid chockbar rytm, mål <3 min från stopp"+(S.firstShockAt!=null?" (din: "+mmss(S.firstShockAt)+")":"")+".");
  if(!shockable&&(S.firstAdrAt==null||S.firstAdrAt>150))
    tips.push("Ge adrenalin tidigt vid icke-chockbar rytm, helst inom 1–2 min"+(S.firstAdrAt!=null?" (din: "+mmss(S.firstAdrAt)+")":"")+".");
  if(S.adrenalin.length>=2){
    const bad=[];for(let i=1;i<S.adrenalin.length;i++){const g=S.adrenalin[i]-S.adrenalin[i-1];if(g<150||g>330)bad.push(Math.round(g));}
    if(bad.length)tips.push("Håll adrenalin var 3–5 min, några intervall låg utanför ("+bad.map(mmss).join(", ")+").");
  }
  if(S.causeTreatedAt==null && !S.cause.futile){
    const untreated=S.causes.filter(c=>c.treatedAt==null).map(c=>c.namn.toLowerCase());
    if(untreated.length) tips.push("Den reversibla orsaken ("+untreated.join(" och ")+") åtgärdades aldrig, använd anamnes, ultraljud, blodgas och ABCDE och behandla riktat.");
  }
  if((S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi")&&!S.capno)
    tips.push("Bekräfta och övervaka luftvägen med vågformskapnografi (EtCO₂).");
  const rq=S.rhythmQuiz;
  if(rq.total>0&&rq.correct/rq.total<0.7)
    tips.push("Träna rytmigenkänning, "+(rq.total-rq.correct)+" av "+rq.total+" rytmkontroller bedömdes fel.");
  // fyll på med störst poängglapp om få tips
  if(tips.length<3){
    rows.filter(r=>r.max>0&&r.pts<r.max).sort((a,b)=>(b.max-b.pts)-(a.max-a.pts))
      .slice(0,3-tips.length).forEach(r=>tips.push(r.txt+"."));
  }
  if(S.cause.futile) tips.unshift("Detta var ett <b>utsiktslöst läge</b> (lång nedtid / icke överlevbart grundtillstånd) där ROSC inte var möjligt. Det viktiga var välstrukturerad HLR och ett välavvägt, gemensamt beslut att avbryta när fortsatt behandling bedömdes meningslös.");
  const good=tips.length===0;
  const tipsHtml=`<div class="tips${good?" good":""}"><h3>${good?"Starkt genomförande":"Att träna på"}</h3><ul>`+
    (good?"<li>Du följde algoritmen väl och åtgärdade orsaken i tid. Utmärkt arbete!</li>"
        :tips.slice(0,4).map(t=>`<li>${t}</li>`).join(""))+`</ul></div>`;

  const workload=buildWorkload();
  return `<div class="dbrief"><h2>Debriefing</h2><div class="tl-metrics">${metrics}</div>${timeline}${workload}${tipsHtml}</div>`;
}
function showResults(){
  if(S.protokoll && S.protokollQualityDt>1){
    const avgQ=S.protokollQualitySum/S.protokollQualityDt;
    if(avgQ>=70) flag("Konsekvent förd HLR-dokumentation trots arbetsbelastning (snitt "+Math.round(avgQ)+"%)",+3);
    else if(avgQ<40) flag("Bristfällig HLR-dokumentation, sköterskan var för upptagen med annat (snitt "+Math.round(avgQ)+"%)",-3);
  }
  const newlyUnlocked=(window.Achievements?Achievements.evaluateGameEnd(S):[]);
  const {rows,total,max}=computeScore();
  const bonusRow=rows.find(r=>r.bonus);
  const bonus=bonusRow?bonusRow.pts:0;
  const base=total-bonus;
  const pct=clamp(Math.round(100*base/max),0,100);   // betyg baseras på grundpoäng mot max
  const grade=pct>=90?"Utmärkt, instruktörsnivå":pct>=75?"Mycket bra, säker A-HLR":pct>=60?"Godkänt, träna på flödet":pct>=40?"Osäkert, repetera algoritmen":"Underkänt, börja med grunderna";
  const modeName={guided:"Guidad",normal:"Normal",advanced:"Avancerad",expert:"Expert",hardcore:"Hardcore"}[S.level]||S.level;
  let html=`<h1>${S.rosc?"ROSC, patienten överlämnad":"Återupplivningen avslutad"}</h1>
  <p>Läge: <b style="color:var(--ink)">${modeName}</b> · Orsak: <b style="color:var(--ink)">${S.causes.map(c=>c.namn).join(" + ")}</b> · Initial rytm: ${S.cause.rytm} · Total tid: ${mmss(S.t)} · Chocker: ${S.shocks} · Adrenalin: ${S.adrenalin.length} doser</p>
  <p style="color:var(--amber)">${S.causes.map(c=>c.tips).join(" ")}</p>
  <div class="total">${base} / ${max} p (${pct} %)</div>${bonus>0?`<div class="total" style="margin-top:2px"><span style="color:var(--ok)">Slutpoäng: ${total} p</span> <span style="font-size:.7em">(inkl. +${bonus} bonus)</span></div>`:""}<div class="grade">${grade}</div>`;
  if(newlyUnlocked.length)html+=`<div class="unlock-banner">${newlyUnlocked.map(p=>
    `🏆 Ny läkarprofil upplåst: <b>${p.name}</b> (${p.role}) — ${p.perk}`).join("<br>")}</div>`;
  html+=buildDebrief(rows);
  html+=`<h2>Poängprotokoll</h2>`;
  for(const r of rows){
    html+=`<div class="scorebar"><b>${r.txt}</b><span class="${r.pts>=0?(r.pts>0?"p":""):"m"}">${r.pts>0?"+":""}${r.pts}${r.max>0&&r.pts>=0?" / "+r.max:""}</span></div>`;
  }
  const entry={name:getSavedName(),score:total,max_score:max,pct,cause:S.causes.map(c=>c.namn).join(" + "),level:S.level,rosc:!!S.rosc,duration_s:Math.round(S.t),created_at:new Date().toISOString()};
  saveLocalHistory(entry);

  html+=`<div class="lb-submit" id="lbSubmitBox">
    <input type="text" id="lbNameInput" maxlength="24" placeholder="Ditt namn/initialer" value="${(getSavedName()||"").replace(/"/g,"&quot;")}">
    <button class="big" id="btnSubmitScore" style="margin-top:0;width:auto">Skicka till topplistan</button>
  </div>
  <div class="mini" id="lbSubmitStatus" style="margin-top:6px"></div>`;
  html+=`<button class="big" id="btnRestart">Ny patient (slumpad orsak)</button>`;
  $("resultCard").innerHTML=html;
  $("resultOverlay").classList.remove("hidden");
  $("btnRestart").onclick=()=>{location.reload();};
  $("btnSubmitScore").onclick=()=>{
    const name=$("lbNameInput").value.trim().slice(0,24);
    if(!name){ $("lbSubmitStatus").innerHTML=`<span style="color:var(--red)">Skriv ett namn först.</span>`; return; }
    $("btnSubmitScore").disabled=true; $("lbNameInput").disabled=true;
    $("lbSubmitStatus").textContent="Skickar…";
    submitScore(Object.assign({},entry,{name})).then(()=>{
      saveName(name);
      $("lbSubmitStatus").innerHTML=`<span style="color:var(--ok)">✓ Skickat till topplistan!</span>`;
    }).catch(()=>{
      $("lbSubmitStatus").innerHTML=`<span style="color:var(--red)">Kunde inte skicka, kontrollera internetanslutningen.</span>`;
      $("btnSubmitScore").disabled=false; $("lbNameInput").disabled=false;
    });
  };
}

/* ---------- Rendering ---------- */
