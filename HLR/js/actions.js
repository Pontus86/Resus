const ACTIONS={
 hlr:[
  {id:"comp",label:()=>S.comp?"Pausa kompressioner":"Starta kompressioner",sub:()=>S.comp?"Endast vid rytmkontroll/chock":"Högkvalitativa, 100–120/min",
   enabled:()=>!S.rosc,
   run(){
     if(!S.comp){
       if(S._pausedFor){
         for(const role of Object.keys(S.queues)){
           const q=S.queues[role];
           if(q.length && q[0].handsOff){
             const t=q.shift();
             S.recentFails.push({txt:ROLE_NAMES[role]+": "+t.label+" AVBRUTEN, kompressioner återupptagna mitt i ingreppet",at:S.t});
             log(ROLE_NAMES[role]+": "+t.label+" avbryts, du startade kompressioner mitt i ingreppet. Måste göras om.","bad");
           }
         }
         S._pausedFor=false;
       }
       S.comp=true; if(S.firstCompAt===null){S.firstCompAt=S.t; mark("HLR startad","comp");}
       if(S.compStopAt!==null){ S.compStopAt=null; }
       log("Kompressioner återupptagna.","ok");
     } else {
       S.comp=false; S.compStopAt=S.t;
       log("Kompressioner pausade.","warn");
     }
   }},
  {id:"lucas",label:()=>S.lucas?"Stäng av / ta bort LUCAS":"Applicera LUCAS (mekanisk HLR)",sub:()=>S.lucas?"Återgå till manuella kompressioner":"Kort paus vid applicering · chock kan ges utan paus",cls:"crit",
   enabled:()=>!S.rosc,
   run(){
     if(S.lucas){ S.lucas=false; S.lastSwitch=S.t; S.compressorFatigue=1; S._fatiguePrompted=false;
       log("LUCAS avstängd och borttagen, manuella kompressioner återupptas. Kom ihåg att byta kompressör regelbundet.","warn"); return; }
     S.comp=false;S.compStopAt=S.t;
     enqueue("lakare","Applicerar LUCAS",20,()=>{const frigjord=compressor();S.lucas=true;S.comp=true;S.compStopAt=null;S.lastSwitch=S.t;S.compressorFatigue=1;S._compressor=null;S._escLogged={};
       log("LUCAS igång, 102/min konstant djup. Chock kan nu ges säkert utan att pausa kompressionerna.","ok");
       log("★ "+(frigjord?ROLE_NAMES[frigjord].replace(" (du)","")+" är fri":"En person är fri")+", maskinen komprimerar. Hela teamet kan nu arbeta.","ok");
       log("OBS: ingrepp nära hjärtat (ultraljud, perikardiocentes, torakotomi) kräver ändå kompressionsuppehåll, du ser ingenting medan kolven går.","sys");return{};});}},
  {id:"switch",label:()=>"Byt kompressör",sub:()=>{const c=compressor();return c?"Roterar bröstet från "+ROLE_NAMES[c].replace(" (du)","")+" · varje rytmkontroll":"Rekommenderas varje rytmkontroll (2 min)";},
   enabled:()=>!S.rosc&&!S.lucas,
   run(){
     const since=S.t-S.lastSwitch;
     const gammal=compressor();
     S.lastSwitch=S.t; S.compressorFatigue=1;
     // Rotera ankaret till nästa lediga person i kompressionsordningen
     const kandidater=COMP_ORDER.filter(r=>available(r)&&r!==gammal);
     const ny=kandidater.length?kandidater.reduce((a,b)=>queueLoad(a)<=queueLoad(b)?a:b):gammal;
     S._compressor=ny; S._escLogged={};
     const namn=r=>r?ROLE_NAMES[r].replace(" (du)",""):"ingen";
     if(since>=90){S.switchesOk++;
       log("Kompressörbyte: "+namn(ny)+" tar över bröstet från "+namn(gammal)+". Utvilad kompressör."+(ny==="lakare"?" Du står nu själv och komprimerar, du kan inte leda.":""),ny==="lakare"?"warn":"ok");}
     else log("Kompressörbyte (tidigt byte): "+namn(ny)+" tar över.","info");
   }},
  {id:"maskvent",label:()=>"Maskventilation 30:2",sub:()=>"Tvåhandsteknik, optimera tätning",
   enabled:()=>!S.rosc&&S.airway!=="tub"&&S.airway!=="igel"&&S.airway!=="koniotomi",
   run(){
     if(hasActiveCause("cico")){ S._cicoFails=(S._cicoFails||0)+1;
       if(!S._cicoMaskLogged){S._cicoMaskLogged=true;flag("Övre luftvägsobstruktion, maskventilation omöjlig",0);}
       return log("Du får inget luft in på mask, bröstkorgen rör sig inte. Total övre luftvägsobstruktion, mask och blåsa fungerar inte.","bad");}
     S.airway=S.airway==="ingen"?"mask":S.airway; S.vent=true;
     S.ventBy=S.teamArrived?"ivassk":(available("narkos")?"narkos":"ambulans");
     log("Mask och blåsa 30:2 med tvåpersonsteknik."+(hasActiveCause("hypoxi")?" Mycket svårventilerad!":""),"ok");
     if(S.secretions&&!S.suctioned)log("Det rosslar och bubblar, rikligt med sekret i luftvägen försämrar ventilationen. Sug rent.","warn");}},
  {id:"palp",label:()=>"Palpera puls (a. carotis/femoralis)",sub:()=>"Känns något? Endast under kompressionspaus",
   enabled:()=>true,
   run(){ enqueue("lakare","Palperar puls",9,()=>{
     S.lastPalp=S.t;
     if(S.rosc||(S.perfusing&&(S.rhythm==="organiserad"||S.rhythm==="sinus")))
       return{log:"Palpation: kraftig, regelbunden puls kännbar, spontan cirkulation!",cls:"ok"};
     if(S.comp) return{log:"Palpation: pulsationer känns i takt med kompressionerna (förväntat under HLR).",cls:"info"};
     return{log:"Palpation: ingen puls kännbar.",cls:"warn"};
   });}},
  {id:"sedering",label:()=>"Ge ketamin+fentanyl (låg dos)",sub:()=>"Vid HLR-inducerad medvetenhet",
   enabled:()=>S.cpric.triggered&&S.cpric.handled===null,
   run(){ if(!drugOK())return; S.cpric.handled="ratt";
     log("Små doser ketamin/fentanyl givna, patienten lugn, HLR fortsätter effektivt.","ok");
     flag("HLR-inducerad medvetenhet korrekt hanterad med lågdos sedering/analgesi",+5);}},
  {id:"relax",label:()=>"Ge enbart muskelrelaxantia",sub:()=>"⚠ till vaken patient?",cls:"crit",
   enabled:()=>S.cpric.triggered&&S.cpric.handled===null,
   run(){ S.cpric.handled="fel";
     log("Muskelrelaxantia givet ensamt till patient med tecken på medvetande, patienten paralyserad men vaken!","bad");
     flag("Muskelrelaxantia gavs ensamt vid HLR-inducerad medvetenhet (kontraindicerat)",-8);}}
 ],
 luftvag:[
  {id:"svalgtub",label:()=>S.svalgtub?"Svalgtub sitter ✓":"Sätt svalgtub",sub:()=>(S.airway==="igel"||S.airway==="tub")?"Ej aktuellt, avancerad luftväg finns redan":"Vid maskventilation, särskilt om svårventilerad · undersköterska/narkos",
   enabled:()=>!S.svalgtub&&S.airway!=="igel"&&S.airway!=="tub"&&!S.rosc,
   run(){ enqueue("airway","Sätter svalgtub",9,()=>{S.svalgtub=true;
     flag("Svalgtub vid maskventilation, öppnar luftvägen och gör masken lättare",+2);
     return{log:"Svalgtub på plats, fri luftväg och lättare maskventilation.",cls:"ok"};});}},
  {id:"sug",label:()=>"Sug rent luftvägen",sub:()=>S.secretions&&!S.suctioned?"Rikligt med sekret, sug rent för effektiv ventilation":"Rensug svalg/luftväg vid sekret eller kräkning",
   enabled:()=>!S.rosc,
   run(){ enqueue("airway","Suger rent luftvägen",11,()=>{
     if(S.secretions&&!S.suctioned){ S.suctioned=true; S.secretions=false;
       flag("Rensög sekret ur luftvägen, nu fri passage och effektiv ventilation",+2);
       return{log:"Rikligt med sekret sögs bort, luftvägen fri, ventilationen blir effektiv.",cls:"ok"};}
     return{log:"Luftvägen rensögs, sparsamt med sekret.",cls:"info"};});}},
  {id:"igel",label:()=>S.airway==="igel"?"i-gel sitter ✓":"Sätt i-gel (SGA)",sub:()=>"Kan sättas direkt · undersköterska/narkos",
   enabled:()=>S.airway!=="igel"&&S.airway!=="tub"&&S.airway!=="koniotomi",
   run(){ enqueue("airway","Sätter i-gel",17,()=>{
     if(hasActiveCause("cico")){ S._cicoFails=(S._cicoFails||0)+1;
       if(!S._cicoIgelLogged){S._cicoIgelLogged=true;flag("Larynxmask tätar ej vid övre luftvägsobstruktion",0);}
       return{fail:true,why:"i-gel tätar ej",log:"i-gel går inte att placera korrekt, den tätar inte och du får fortfarande ingen luft ned. Obstruktionen sitter för högt."};}
     S.airway="igel";S.vent=true;S.ventBy=S.teamArrived?"ivassk":(available("narkos")?"narkos":"ambulans");mark("Luftväg: i-gel","airway");
     return{log:"i-gel på plats. Ventilerar 10/min med kontinuerliga kompressioner.",cls:"ok"};});}},
  {id:"intub",label:()=>S.airway==="tub"?"Intuberad ✓":(available("narkos")?"Intubera trakealt":"Intubera (inväntar narkosläkare)"),
   sub:()=>!available("narkos")?"Narkosläkare anländer ~4 min efter larm":(S.capno?"Kapnografin är redan kopplad, tubläget bekräftas direkt (19 s)":"Videolaryngoskopi · narkosläkare (23 s)"),
   enabled:()=>S.airway!=="tub"&&S.airway!=="koniotomi"&&available("narkos"),
   run(){ enqueue("airway_adv","Intuberar (videolaryngoskopi)",S.capno?19:23,()=>{
     if(hasActiveCause("cico")){ S.intubFail++; S._cicoFails=(S._cicoFails||0)+1;
       if(!S._cicoIntubLogged){S._cicoIntubLogged=true;flag("Intubation omöjlig vid CICO, dags för kirurgisk luftväg",0);}
       return{fail:true,why:"stämbanden går ej att passera",log:"Narkosläkaren ser ingen väg ned, obstruktionen/svullnaden gör att tuben inte kan föras förbi. \u201dCan't intubate, can't oxygenate\u201d, gå vidare till kirurgisk luftväg (koniotomi) nu."};}
     const svar=hasActiveCause("hypoxi")?0.8:0.94;
     if(succeed(svar)){S.airway="tub";S.vent=true;S.ventBy=S.teamArrived?"ivassk":(available("narkos")?"narkos":"ambulans");mark("Luftväg: intuberad","airway");
       let extra=S.capno?"":" ⚠ Bekräfta tubläge med vågformskapnografi!";
       return{log:"Tuben passerar stämbanden. Ventilerar 10/min utan kompressionspaus."+extra,cls:"ok"};
     } else {S.intubFail++;
       if(S.intubFail>=2)flag("Upprepade intubationsförsök (>95 % framgång inom 2 försök krävs)",-4);
       return{fail:true,why:"tuben gick ej ned",log:"Misslyckat intubationsförsök, återgå till maskventilation."};}
   });}},
  {id:"capno",label:()=>S.capno?"Kapnografi kopplad ✓":"Koppla vågformskapnografi",sub:()=>"Fungerar med tub, i-gel eller koniotomi · bekräftar läge, mäter HLR-kvalitet & EtCO₂",
   enabled:()=>!S.capno&&(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi"),
   run(){S.capno=true;
     if(S.airway==="tub")log("Kapnografi kopplad, ihållande EtCO₂-kurva bekräftar trakealt tubläge.","ok");
     else if(S.airway==="koniotomi")log("Kapnografi kopplad till koniotomituben, EtCO₂-kurva bekräftar läge i trakea.","ok");
     else log("Kapnografi kopplad till i-gel, EtCO₂-kurva och siffervärde syns nu på monitorn.","ok");}},
  {id:"o2",label:()=>S.o2max?"Maximal syrgas ✓":"Maximal syrgas",sub:()=>"Högsta möjliga FiO₂ · IVA-personal sköter syrgassäkerhet vid chock",
   enabled:()=>!S.o2max,
   run(){S.o2max=true;log("15 L O₂ / FiO₂ 1.0 kopplat. IVA-personalen ansvarar för att flytta undan syrgasen inför varje defibrillering.","ok");}},
  {id:"koniotomi",label:()=>S.airway==="koniotomi"?"Koniotomi utförd ✓":"Koniotomi (kirurgisk luftväg)",cls:"crit",
   sub:()=>"CICO: sista utväg när mask, i-gel OCH tub misslyckats · scalpel-bougie · narkos/läkare",
   enabled:()=>S.airway!=="koniotomi"&&!S.rosc,
   run(){
     const owner=available("narkos")?"airway":"lakare";
     enqueue(owner,"Utför koniotomi (scalpel-bougie)",30,()=>{
       S.airway="koniotomi"; S.vent=true; S.ventBy=S.teamArrived?"ivassk":(available("narkos")?"narkos":"ambulans");
       mark("Luftväg: koniotomi","airway");
       if(hasActiveCause("cico")){
         flag("Kirurgisk luftväg (koniotomi) vid CICO, korrekt livräddande åtgärd",+8);
         return{log:"Koniotomin är på plats: horisontellt snitt genom lig. cricothyroideum, bougie och tub 6.0 ned i trakea. Nu går det äntligen att ventilera, bröstkorgen häver sig och EtCO₂ syns. Luftvägen är säkrad nedanför obstruktionen.",cls:"ok"};
       }
       flag("Koniotomi utan uttömda alternativ (mask/i-gel/tub var möjliga)",-6);
       return{log:"Koniotomi utförd. Kirurgisk luftväg är dock en sista utväg, här hade en mindre invasiv luftväg räckt.",cls:"warn"};});}}
 ],
 defib:[
  {id:"pads",label:()=>S.pads?"Plattor sitter ✓":"Sätt defibrilleringsplattor",sub:()=>"Antero-lateralt: apikal platta i medioaxillarlinjen",
   enabled:()=>!S.pads,
   run(){ enqueue("lakare","Applicerar plattor",13,()=>{S.pads=true;mark("Plattor på","pads");return{log:"Plattor på plats, rytm syns på monitorn.",cls:"ok"};});}},
  {id:"appos",label:()=>"Byt till antero-posteriort läge",sub:()=>"Vektorbyte vid refraktärt VF (≥3 chocker)",
   enabled:()=>S.pads&&S.padPos==="AL"&&!S.rosc,
   run(){ enqueue("lakare","Byter till AP-plattor",15,()=>{S.padPos="AP";S.freshPads=true;
     if(S.shocks>=3){flag("Vektorbyte (AP-plattor) vid refraktärt VF",+4);
       return{log:"Antero-posteriora plattor på plats, vektorbyte vid refraktärt VF.",cls:"ok"};}
     return{log:"Antero-posteriora plattor på plats.",cls:"info"};});}},
  {id:"analys",label:()=>"Rytmkontroll (pausa & analysera)",sub:()=>"Var 2:a minut · puls om organiserad rytm",
   enabled:()=>S.pads&&!S.rosc,
   run(){ if(S.comp){S.comp=false;S.compStopAt=S.t;}
     enqueue("lakare","Rytmkontroll",2,()=>{
       if(S.lastAnalysis!==null){const gap=S.t-S.lastAnalysis;S.checksExpected++;S.checkDeviation+=Math.abs(gap-120);}
       S.lastAnalysis=S.t; S.analysisCount++; mark("Rytmkontroll","check");
       if(!S.lucas && S.t-S.lastSwitch>150 && S.analysisCount>1) S.switchesMissed++;
       openRhythmModal();
       return{};
     },null,{jump:true});}},
  {id:"ladda",label:()=>S.charged?"Defibrillator laddad ✓":(S.charging?"Laddar … ⏳":"Ladda defibrillatorn (200→360 J)"),sub:()=>"Tar några sekunder · ladda under pågående kompressioner",
   enabled:()=>S.pads&&!S.charged&&!S.charging&&!S.rosc,
   run(){ S.charging=true; S.chargeReadyAt=S.t+(S.profile==="maria"?2.5:5); Sound.charge();   // Maria: kardiolog, laddar dubbelt så snabbt
     log("Defibrillatorn laddar ("+(S.shocks===0?"200 J":"360 J, eskalerad energi")+")"+(S.comp?" under pågående kompressioner …":", OBS laddas under paus …"),S.comp?"ok":"info");}},
  {id:"chock",label:()=>"⚡ DEFIBRILLERA",sub:()=>S.charging?"Inväntar full laddning …":"Alla undan! Chock, återuppta direkt",cls:"crit",
   enabled:()=>S.pads&&S.charged&&!S.rosc,
   run(){deliverShock();}},
  {id:"laddaChock",label:()=>S.charging?"Laddar & chockar … ⏳":"⚡ Ladda & chocka (ett steg)",sub:()=>"Laddar och defibrillerar automatiskt när klar",cls:"crit",
   enabled:()=>S.pads&&!S.charged&&!S.charging&&!S.rosc,
   run(){ S.charging=true; S.chargeReadyAt=S.t+(S.profile==="maria"?2.5:5); S.autoShock=true; Sound.charge();
     log("Defibrillatorn laddar för direkt defibrillering …"+(S.comp?" (kompressioner fortsätter under laddning)":""),S.comp?"ok":"info");}}
 ],
 lakemedel:[
  {id:"pvk",label:()=>S.lines.length===0?"Sätt PVK (iv)":(S.lines.length<2?"Sätt andra infart (reserv-PVK)":"Två infarter satta ✓"),
   sub:()=>S.lines.length?"Reservinfart skyddar om en spricker · sjuksköterska":"Förstahandsval · sjuksköterska",
   enabled:()=>S.lines.length<2,
   run(){ enqueue("nurse","Sätter PVK",19,()=>{
     if(succeed(S.ivAttempts===0?0.7:0.55)){addLine("iv");mark("Infart: PVK","drug");return{log:S.lines.length>1?"Andra PVK på plats, nu finns en reservinfart.":"PVK på plats, iv-väg öppen.",cls:"ok"};}
     S.ivAttempts++;
     if(S.ivAttempts>=2)log("Två misslyckade iv-försök, överväg intraosseös infart.","warn");
     return{fail:true,why:"kärlet sprack",log:"Misslyckat PVK-försök ("+S.ivAttempts+")."};});}},
  {id:"io",label:()=>S.lines.includes("io")?"IO sitter ✓":"Borra IO (intraosseöst)",sub:()=>"Efter 2 misslyckade iv-försök · sjuksköterska",
   enabled:()=>S.lines.length<2&&!S.lines.includes("io"),
   run(){ const tidig=S.ivAttempts<2&&S.lines.length===0;
     enqueue("nurse","Borrar IO (proximala tibia)",17,()=>{addLine("io");mark("Infart: IO","drug");
       if(tidig)flag("IO valdes före två iv-försök (iv är förstahandsval)",-3);
       return{log:"IO-nål på plats, infartsväg öppen.",cls:"ok"};});}},
  {id:"cvk",label:()=>S.cvk?"CVK sitter ✓":"Sätt CVK, v. femoralis",sub:()=>"Långsammare (34 s) men ingen pneumothoraxrisk · läkare",
   enabled:()=>!S.cvk&&!S.rosc,
   run(){ enqueue("lakare","Sätter CVK (v. femoralis)",39,()=>{S.cvk=true;addLine("cvk");mark("Infart: CVK","drug");
     return{log:"CVK på plats, säker central infart som medger snabb storvolyminfusion.",cls:"ok"};});}},
  {id:"cvk_sc",label:()=>S.cvk?"CVK sitter ✓":"Sätt CVK, v. subclavia",sub:()=>"Snabbare (22 s), men punkterar lungtoppen i ~15 % · läkare",
   enabled:()=>!S.cvk&&!S.rosc,
   run(){ enqueue("lakare","Sätter CVK (v. subclavia)",27,()=>{S.cvk=true;addLine("cvk");mark("Infart: CVK","drug");
     if(risk(0.15)){
       S.pneumo=S.pneumo||{side:chance(0.5)?"höger":"vänster",tension:false,iatrogen:true};
       mark("Iatrogen pneumothorax","complication");
       flag("Iatrogen pneumothorax vid subclaviapunktion",-6);
       return{log:"CVK på plats, men sticket gick för djupt. Du har punkterat lungtoppen. En pneumothorax håller på att utvecklas "+S.pneumo.side+".",cls:"bad"};
     }
     return{log:"CVK på plats via v. subclavia, snabb central infart, ingen komplikation.",cls:"ok"};});}},
  {id:"adr",label:()=>"Adrenalin 1 mg iv/io"+(S.adrReady>0?" ⚡":""),sub:()=>S.adrReady>0?"Redan uppdragen av ssk · ges direkt":"Icke-chockbar: direkt · Chockbar: efter 3:e chocken · sedan var 3–5 min",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return;
     const ready=S.adrReady>0; if(ready)S.adrReady--;
     enqueue("nurse","Ger adrenalin"+(ready?" (färdig spruta)":", drar upp"),ready?3:13,()=>{
       S.adrenalin.push(S.t); if(S.firstAdrAt===null)S.firstAdrAt=S.t; mark("Adrenalin ("+S.adrenalin.length+")","drug");
       const shockbar=(S.cause.rytm==="VF");
       if(shockbar&&S.shocks<3&&S.adrenalin.length===1)
         flag("Adrenalin före 3:e defibrilleringen vid chockbar rytm",-4);
       return{log:"Adrenalin 1 mg givet"+(ready?" direkt ur färdigdragen spruta":", flushat med 20 ml")+".",cls:"ok"};});}},
  {id:"adrprep",label:()=>S.adrReady>0?("Nästa adrenalin uppdraget ✓ ("+S.adrReady+")"):"Dra upp nästa adrenalin i förväg",
   sub:()=>"Ssk håller en dos färdig · nästa dos kan ges direkt när den är dags",cls:"drug",
   enabled:()=>!S.rosc&&S.adrReady<2,
   run(){ enqueue("nurse","Drar upp adrenalin i beredskap",11,()=>{ S.adrReady++;
     return{log:"Sjuksköterskan har en 1 mg adrenalin färdig i sprutan, redo att ges i samma stund nästa dos är dags.",cls:"ok"};});}},
  {id:"amioprep",label:()=>S.amioReady?"Amiodaron uppdraget ✓":"Dra upp amiodaron i förväg",
   sub:()=>"Ssk förbereder 300 mg inför 3:e chocken · ges snabbt när det är dags",cls:"drug",
   enabled:()=>!S.amioReady&&S.amiodaron===0&&!S.rosc,
   run(){ enqueue("nurse","Drar upp amiodaron i beredskap",12,()=>{ S.amioReady=true;
     return{log:"Amiodaron 300 mg färdigdraget och märkt, står redo att ges efter tredje defibrilleringen.",cls:"ok"};});}},
  {id:"amio300",label:()=>"Amiodaron 300 mg iv"+(S.amioReady?" ⚡":""),sub:()=>S.amioReady?"Redan uppdraget · ges direkt":"Efter 3:e chocken vid VF/pVT",cls:"drug",
   enabled:()=>S.amiodaron===0&&!S.rosc,
   run(){ if(!drugOK())return; const ready=S.amioReady; if(ready)S.amioReady=false;
     enqueue("nurse",ready?"Ger amiodaron 300 mg (färdig)":"Drar upp & ger amiodaron 300 mg",ready?4:15,()=>{ S.amiodaron=300; mark("Amiodaron 300 mg","drug");
       if(S.shocks<3)flag("Amiodaron givet före 3:e chocken",-4);
       if(!["VF","pVT"].includes(S.lastKnownRhythm))flag("Amiodaron utan känd chockbar rytm",-3);
       return{log:"Amiodaron 300 mg givet"+(ready?" direkt ur färdig spruta":"")+".",cls:"ok"};});}},
  {id:"amio150",label:()=>"Amiodaron 150 mg iv",sub:()=>"Efter 5:e chocken",cls:"drug",
   enabled:()=>S.amiodaron===300&&!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Drar upp & ger amiodaron 150 mg",15,()=>{ S.amiodaron=450; mark("Amiodaron +150 mg","drug");
       if(S.shocks<5)flag("Amiodaron 150 mg före 5:e chocken",-2);
       return{log:"Amiodaron 150 mg (tilläggsdos) givet.",cls:"ok"};});}},
  {id:"lido",label:()=>"Lidokain 100 mg iv",sub:()=>"Alternativ om amiodaron saknas",cls:"drug",
   enabled:()=>S.amiodaron===0&&S.lidokain===0&&!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Drar upp & ger lidokain",15,()=>{ S.lidokain=100;
       if(S.shocks<3)flag("Antiarytmika före 3:e chocken",-4);
       return{log:"Lidokain 100 mg givet.",cls:"ok"};});}},
  {id:"vatska",label:()=>"Vätskebolus 500 ml Ringer",sub:()=>S.cvk?"Kopplas snabbt via CVK · rinner in på 20 s":"Rinner in på 30 s · endast vid hypovolem orsak",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return; const n=(S._vN=(S._vN||0)+1);
     enqueue("nurse",(S.cvk?"Kopplar storvolymbolus (CVK) #":"Kopplar vätskebolus #")+n,S.cvk?11:17,()=>{
       const vol=S.cvk?2.0:1, dur=S.cvk?20:30;
       startInfusion("kristalloid","500 ml Ringer",dur,vol,()=>{
         let extra="";
         const cHypovol=hasActiveCause("hypovol");
         if(cHypovol){ treatStep("vatska",cHypovol); if(S.fluids>=2&&S.blodgrupperad)extra=" Blodet står framme, koppla MTP."; }
         else if(S.fluids>2.5)flag("Stora vätskevolymer utan hypovolem orsak",-3);
         log("500 ml balanserad kristalloid har runnit in"+(S.cvk?" via CVK.":".")+extra,"ok");
       });
       return{log:"Vätskebolusen är kopplad med övertryck"+(S.cvk?" via CVK":"")+", volymen är inne först när den runnit klart.",cls:"info"};});}},
  {id:"kalcium",label:()=>"Kalciumklorid 10 ml iv",sub:()=>"Endast vid hyperkalemi/kalciumblockerare",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Drar upp & ger kalciumklorid",14,()=>{
       const cKalcium=hasActiveCause("hyperk")||hasActiveCause("hypoca");
       if(cKalcium){treatStep("kalcium",cKalcium);S.treatProgress.kalcium=true;return{log:"Kalciumklorid givet, QRS smalnar på monitorn!",cls:"ok"};}
       if(currentK()>5.8){S.treatProgress.kalcium=true;flag("Kalcium vid förvärvad hyperkalemi under stoppet",+2);return{log:"Kalciumklorid givet vid stigande kalium, membranet stabiliseras och kaliumet mildras.",cls:"ok"};}
       flag("Kalcium utan specifik indikation (rutinmässigt kalcium rekommenderas inte)",-4);
       return{log:"Kalciumklorid givet.",cls:"info"};});}},
  {id:"magnesium",label:()=>"Magnesiumsulfat 2 g iv",sub:()=>"Vid torsades / misstänkt hypokalemi",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Drar upp & ger magnesiumsulfat",15,()=>{
       const cHypok=hasActiveCause("hypok"); if(cHypok){treatStep("magnesium",cHypok);return{log:"Magnesium (och kalium) givet, myokardiet stabiliseras, defibrillering bör nu kunna bryta flimret.",cls:"ok"};}
       const cLongqt=hasActiveCause("longqt"); if(cLongqt){treatStep("magnesium",cLongqt);return{log:"Magnesiumsulfat givet, QT normaliseras och torsades bör nu kunna brytas med defibrillering.",cls:"ok"};}
       if(hasActiveCause("digitalis")){return{log:"Magnesiumsulfat givet, rimligt tillägg vid digitalisutlöst arytmi, men Fab är den kausala behandlingen.",cls:"info"};}
       if((S.rhythm==="VF"||S.rhythm==="pVT")&&S.shocks>=3)return{log:"Magnesiumsulfat 2 g givet (rimligt vid misstänkt torsades).",cls:"info"};
       flag("Magnesium utan indikation (torsades/hypokalemi)",-3);
       return{log:"Magnesiumsulfat 2 g givet.",cls:"info"};});}},
  {id:"digfab",label:()=>"Digoxin-Fab (antikroppsfragment) iv",sub:()=>"Vid digitalisintox · 10–20 ampuller vid hjärtstopp",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Blandar & ger digoxin-Fab",30,()=>{
       const cDig=hasActiveCause("digitalis"); if(cDig){treatStep("digfab",cDig);return{log:"Digoxin-Fab givet, de bidirektionella komplexen normaliseras och myokardiet stabiliseras.",cls:"ok"};}
       flag("Digoxin-Fab utan misstanke om digitalisintox",-3);
       return{log:"Digoxin-Fab givet, ingen effekt, patienten står inte på digitalis.",cls:"info"};});}},
  {id:"bikarbonat",label:()=>"Natriumbikarbonat / Tribonat 100 ml iv",sub:()=>"Vid hyperkalemi, TCA-intox eller svår acidos (pH<7,0)",cls:"drug",
   enabled:()=>!S.rosc,
   run(){ if(!drugOK())return;
     enqueue("nurse","Drar upp & ger buffert (bikarbonat/Tribonat)",15,()=>{ const phWas=currentPH(); S.bicarb++;
       const cToxin=hasActiveCause("toxin"); if(cToxin){treatStep("bikarbonat",cToxin);return{log:"Bikarbonat givet, QRS-bredden minskar!",cls:"ok"};}
       if(hasActiveCause("hyperk")){flag("Bikarbonat som tillägg vid hyperkalemi",+2);return{log:"Bikarbonat givet som tillägg vid hyperkalemi.",cls:"ok"};}
       if(phWas<7.0){flag("Buffert vid uttalad acidos (pH<7,0)",+3);return{log:"Buffert givet vid svår acidos, pH stiger mot "+currentPH().toFixed(2)+", myokardiet svarar bättre på HLR och chock.",cls:"ok"};}
       flag("Bikarbonat utan specifik indikation (rutinmässigt rekommenderas inte)",-4);
       return{log:"Bikarbonat givet.",cls:"info"};});}},
  {id:"trombolys",label:()=>"Trombolys (alteplas iv)",sub:()=>"Vid misstänkt lungemboli · fortsätt HLR 60–90 min",cls:"drug",
   enabled:()=>!S.drugsGiven.includes("trombolys")&&!S._trombolysPending&&!S.rosc,
   run(){ if(!drugOK())return; S._trombolysPending=true;
     enqueue("nurse","Ger trombolys (alteplasbolus)",17,()=>{ S._trombolysPending=false; S.drugsGiven.push("trombolys");
       const cPe=hasActiveCause("pe"); if(cPe){treatStep("trombolys",cPe);S.drugTrombolysAt=S.t;return{log:"Alteplas givet. Fortsätt HLR 60–90 min, effekten kommer gradvis.",cls:"ok"};}
       flag("Trombolys utan PE-misstanke (blödningsrisk)",-6);
       return{log:"Trombolys givet.",cls:"info"};});}}
 ],
 monitor:[
  {id:"nibp",label:()=>S.nibp?"NIBP-manschett ✓ (mät om)":"Sätt blodtrycksmanschett (NIBP)",sub:()=>"Icke-invasivt · opålitligt under kompressioner",
   enabled:()=>true,
   run(){ enqueue("nurse",S.nibp?"Mäter NIBP":"Sätter NIBP-manschett",13,()=>{S.nibp=true;
     if(S.rosc)return{log:"NIBP: "+bpText()+" mmHg.",cls:"ok"};
     return{log:"NIBP: manschetten kan ej mäta ett pålitligt tryck under pågående HLR.",cls:"warn"};});}},
  {id:"spo2",label:()=>S.spo2probe?"SpO₂-pulsoximeter ✓":"Sätt pulsoximeter (SpO₂)",sub:()=>"Kräver pulsatilt flöde · svårt under HLR",
   enabled:()=>!S.spo2probe,
   run(){ enqueue("nurse","Sätter pulsoximeter",11,()=>{S.spo2probe=true;
     return{log:"Pulsoximeter på finger. "+(S.rosc?"God pletyskurva.":"Ingen tillförlitlig pletyskurva under HLR."),cls:S.rosc?"ok":"warn"};});}},
  {id:"artline",label:()=>S.artline?"Artärnål ✓ (invasivt BT)":"Sätt artärnål (a. radialis/femoralis)",sub:()=>"Invasivt blodtryck · styr fysiologiguidad HLR (DBT-mål 30)",
   enabled:()=>!S.artline,
   run(){ enqueue("nurse","Sätter artärnål",27,()=>{S.artline=true;
     return{log:"Artärnål på plats, invasivt blodtryck och en pulsatil kurva syns nu även under HLR. Sikta på diastoliskt tryck ≥30 mmHg.",cls:"ok"};});}},
  {id:"palp2",label:()=>"Palpera puls (a. carotis/femoralis)",sub:()=>"Känns något? Under kompressionspaus",
   enabled:()=>true,
   run(){ ACTIONS.hlr.find(a=>a.id==="palp").run(); }},
  {id:"kad",label:()=>S.kad?"KAD med temperaturgivare ✓ (kärntemp)":"Sätt KAD med temperaturgivare",sub:()=>"IVA-KAD · kontinuerlig kärntemperatur · undersköterska",
   enabled:()=>!S.kad,
   run(){ enqueue("usk","Sätter KAD (temperaturgivare)",20,()=>{S.kad=true;S.monTemp=Math.round(coreTemp()*10)/10;
     return{log:"IVA-KAD på plats, kontinuerlig kärntemperatur visas nu ("+coreTemp().toFixed(1)+" °C). Uppdateras fortlöpande.",cls:"ok"};});}},
  {id:"protokoll",label:()=>S.protokoll?"HLR-protokoll förs ✓":"Starta HLR-protokoll (dokumentation & tid)",
   sub:()=>S.protokoll?"Ssk dokumenterar och ropar ut tider":"Ssk tidtar cykler, läkemedel och ropar ut nästa rytmkontroll",
   enabled:()=>!S.protokoll&&!S.rosc,
   run(){ enqueue("nurse","Startar HLR-protokoll",9,()=>{ S.protokoll=true; S.protokollAt=S.t;
     flag("HLR-protokoll och tidtagning igång tidigt",+3);
     return{log:"Sjuksköterskan för nu HLR-protokoll: hon dokumenterar och ropar ut tider för rytmkontroller och läkemedel, så teamet håller takten.",cls:"ok"};});}}
 ],
 diagnostik:[
  {id:"anamnes",label:()=>S.level==="hardcore"?"Anamnes (otillgänglig)":(S.revealed.hist?"Anamnes (läs om)":"Anamnes ambulans/journal"),
   sub:()=>S.level==="hardcore"?"Ingen anamnes finns att tillgå i hardcore-läge":"Vad hände före stoppet?",
   enabled:()=>S.level!=="hardcore",
   run(){S.revealed.hist=true;log("ANAMNES: "+S.cause.historia.replace(/PKÖN/g,S.patient.sex),"warn");}},
  {id:"status",label:()=>S.revealed.status?"Undersök på nytt (ABCDE)":"Undersök patienten (ABCDE)",sub:()=>"5 steg à ~2 s · fynd kan ändras efter riktad åtgärd · läkare",
   enabled:()=>true,
   run(){ doExamABCDE(); }},
  {id:"blodgas",label:()=>S.revealed.gas?"Ny blodgas (kontroll)":"Artärblodgas (fullt paket)",
   sub:()=>S.artline?"Aspireras ur artärnålen, ingen ny punktion, halva tiden (23 s)":"pH, gaser, elektrolyter, Hb, laktat … · läkaren måste punktera artären (45 s)",
   enabled:()=>true,
   run(){ enqueue("lakare",S.artline?"Aspirerar blodgas ur artärnålen":"Tar & analyserar artärblodgas",S.artline?23:45,()=>{S.revealed.gas=true;
     const rows=gasRows();
     return{log:"BLODGAS, "+gasStr(rows),cls:"warn", after:()=>openGasReport(rows)};});}},
  {id:"temp",label:()=>S.monTemp!==null?"Mät temperatur igen":"Mät kroppstemperatur",
   sub:()=>S.kad?"Avläses direkt från KAD-givaren (2 s)":"Blåskateter/esofagus · engångsmätning (11 s) · undersköterska",
   enabled:()=>true,
   run(){ enqueue("usk",S.kad?"Avläser kärntemperatur (KAD)":"Mäter temperatur",S.kad?2:11,()=>{
     S.monTemp=Math.round(coreTemp()*10)/10;
     return{log:"Temperatur: "+S.monTemp.toFixed(1)+" °C"+(S.monTemp<35?" (hypoterm!)":"."),cls:S.monTemp<35?"warn":"info"};});}},
  {id:"us",label:()=>S.usDone?"Ultraljud hjärta (ny bild)":"Ultraljud hjärta (subxifoidalt)",
   sub:()=>(S.usLastAt!=null&&S.t-S.usLastAt<10)?"Vänta "+Math.ceil(10-(S.t-S.usLastAt))+" s innan nästa undersökning":"Kräver kompressionsuppehåll · gör det i rytmkontrollpausen",
   enabled:()=>S.usLastAt==null||S.t-S.usLastAt>=10,
   run(){
     enqueue("lakare","Utför hjärtultraljud (hands-off)",15,()=>{doCardiacUS();S.usLastAt=S.t;resumeComp();
       return{log:"ULTRALJUD: "+S.usFindings.txt,cls:"warn"};},undefined,{handsOff:true});}},
  {id:"fast",label:()=>S.fastDone?"FAST-scan (visa igen)":"FAST-scan (fri vätska i buk)",sub:()=>"Fokuserad bukultraljud · läkare",
   enabled:()=>true,
   run(){ enqueue("lakare","FAST-scan (buk)",S.usDone?10:15,()=>{ S.fastDone=true;
     if(S.causes.some(c=>c.fastPos))return{log:"FAST POSITIV: fri vätska i Morisons grop och lilla bäckenet, intraabdominell blödning. Talar starkt för hypovolemi/blödning.",cls:"warn"};
     if(S.causes.some(c=>c.id==="tamponad"))return{log:"FAST (subxifoidalt): rikligt med perikardvätska, tamponadbild.",cls:"warn"};
     if(S.causes.some(c=>c.id==="hypovol"))return{log:"FAST: ingen fri vätska intraabdominellt, blödningskällan ligger sannolikt utanför buken (t.ex. GI-kanalen).",cls:"info"};
     return{log:"FAST: ingen fri vätska i buk eller perikard.",cls:"info"};});}},
  {id:"lung",label:()=>S.lungDone?"Lungultraljud (visa igen)":"Lungultraljud (lung sliding)",sub:()=>"Pneumothorax? · läkare",
   enabled:()=>true,
   run(){ enqueue("lakare","Lungultraljud",S.usDone?9:14,()=>{ S.lungDone=true;
     if(S.causes.some(c=>c.id==="tension"))return{log:"LUNGULTRALJUD: upphävd lung sliding på höger sida med lungpunkt, pneumothorax. Talar för ventilpneumothorax.",cls:"warn"};
     if(S.pneumo&&!S.pneumo.drained){
       const p=S.pneumo;
       return{log:"LUNGULTRALJUD: upphävd lung sliding "+p.side+" med tydlig lungpunkt, PNEUMOTHORAX."+
         (p.tension?" Med halsvenstas och chock: ventilpneumothorax. Dekomprimera omedelbart."
          :(S.airway==="tub"||S.airway==="igel")?" Patienten övertrycksventileras, denna kan när som helst bli en ventilpneumothorax."
          :" Ingen tension ännu."),cls:p.tension?"bad":"warn"};
     }
     return{log:"LUNGULTRALJUD: normal lung sliding bilateralt, talar emot pneumothorax.",cls:"info"};});}}
 ],
 reversibelt:[
  {id:"naldekomp",label:()=>"Nåldekompression (2:a interkostal)",sub:()=>(S.pneumo&&S.pneumo.tension)?("Ventilpneumothorax "+S.pneumo.side+", dekomprimera nu"):"Vid ventilpneumothorax · läkare",
   enabled:()=>!S.rosc&&(!S.treatProgress.naldekomp||(S.pneumo&&S.pneumo.tension)),
   run(){ enqueue("lakare","Nåldekompression",13,()=>{S.treatProgress.naldekomp=true;
     if(S.pneumo&&S.pneumo.tension){
       const sida=S.pneumo.side; relievePneumo("nåldekompression");
       return{log:"Nåldekompression "+sida+": kraftigt luftpys! Ventilpneumothoraxen är hävd. Sätt thoraxdrän, nålen är en tillfällig lösning.",cls:"ok"};}
     const cTension=hasActiveCause("tension"); if(cTension){treatStep("naldekomp",cTension);return{log:"Nåldekompression: kraftigt luftpys! Tension hävd.",cls:"ok"};}
     if(S.pneumo&&!S.pneumo.drained){
       relievePneumo("nåldekompression");
       return{log:"Nåldekompression: lite luft pyser ut. Pneumothoraxen var inte under tryck, men den är nu avlastad.",cls:"info"};}
     flag("Nåldekompression utan tecken på ventilpneumothorax (iatrogen pneumothoraxrisk)",-5);
     return{log:"Nåldekompression utförd, inget luftpys.",cls:"info"};});}},
  {id:"thoraxdran",label:()=>S.treatProgress.thoraxdran?"Thoraxdrän lagt ✓":(S.surgeonPresent?"Thoraxdrän, kirurgen lägger":"Fingertorakostomi/thoraxdrän"),
   sub:()=>{ if(S.treatProgress.thoraxdran)return "Definitiv dekompression klar";
     if(S.surgeonPresent)return "Kirurgen på plats · 25 s · 10 % missrisk";
     const f=S.dranFails||0;
     return "Definitiv dekompression · läkare 30 s · "+Math.round(dranFailChance()*100)+" % missrisk"+(f?" (efter "+f+" misslyckade försök)":""); },
   enabled:()=>!S.treatProgress.thoraxdran&&!S.rosc,
   run(){ const kir=S.surgeonPresent;
     enqueue(kir?"kirurg":"lakare",kir?"Lägger thoraxdrän":"Fingertorakostomi",kir?25:30,()=>{
     if(risk(kir?0.10:dranFailChance())){
       S.dranFails=(S.dranFails||0)+1;
       if(!kir&&!S.surgeonNeeded){ S.surgeonNeeded=true;
         log("Ring ner kirurgjouren, eller försök igen själv, men varje försök gör nästa svårare.","warn"); }
       return{log:(kir?"Kirurgen kommer inte in i pleura, mycket svårt läge. Han gör ett nytt försök om du säger till."
                      :"Thoraxdränaget misslyckas, du kommer inte in i pleura. Blod och svullnad gör anatomin otydlig."),
              cls:"bad",fail:true,why:"kom inte in i pleura"};}
     S.treatProgress.thoraxdran=true; S.surgeonNeeded=false;
     const vem=kir?"Kirurgen lägger ett thoraxdrän":"Torakostomi";
     const cTension2=hasActiveCause("tension"); if(cTension2){treatStep("naldekomp",cTension2);return{log:vem+": kraftigt luftpys, tension hävd definitivt.",cls:"ok"};}
     if(S.pneumo&&(!S.pneumo.drained||S.pneumo.tension)){
       const t=relievePneumo("thoraxdrän"); S.pneumo.definitive=true;
       return{log:vem+" "+S.pneumo.side+": luften släpps ut och lungan expanderar."+(t?" Ventilpneumothoraxen är definitivt hävd.":" Pneumothoraxen är definitivt dränerad, nu är övertrycksventilation säker."),cls:"ok"};}
     flag("Torakostomi utan indikation",-5);
     return{log:vem+" utförd, ingen tension påvisad.",cls:"info"};});}},
  {id:"ringkir",label:()=>S.surgeonPresent?"Kirurgen är på plats ✓":(S.surgeonArriveAt!==null?"Kirurgen är på väg …":"📞 Ring kirurgjouren"),
   sub:()=>S.surgeonPresent?"Kan lägga drän, perikardiocentes och torakotomi":"Begär akut kirurgisk hjälp · du ringer själv",cls:"crit",
   enabled:()=>!S.surgeonPresent&&S.surgeonArriveAt===null&&!S.rosc,
   run(){ openSurgeon(); }},
  {id:"perikard",label:()=>"Ultraljudsledd perikardiocentes",
   sub:()=>(S.usDone?"UL-ledd, du ser nålen (10 % missrisk)":"BLIND punktion utan ultraljud (35 % missrisk)")+" · kräver kompressionsuppehåll · "+(S.surgeonPresent?"kirurg 25 s":"läkare 35 s"),
   enabled:()=>!S.treatProgress.perikard&&!S.rosc,
   run(){
     const guidad=S.usDone, skicklig=S.surgeonPresent;
     enqueue(S.surgeonPresent?"kirurg":"lakare",(guidad?"Perikardiocentes (UL-ledd, hands-off)":"Perikardiocentes (blind, hands-off)"),S.surgeonPresent?25:35,()=>{resumeComp();
     // Missrisk: ultraljudsledning är den enskilt viktigaste faktorn, kirurgen hjälper också
     let miss = guidad?0.10:0.35;
     if(skicklig) miss *= 0.5;
     if(risk(miss)){
       S.treatProgress.perikard=false;                     // får försökas igen
       const cTamp=hasActiveCause("tamponad");
       if(cTamp&&risk(0.4)){
         flag("Myokardpunktion vid perikardiocentes",-8);
         cTamp.diff=Math.min(3,(cTamp.diff||1)+1);
         return{log:"Nålen träffar myokardiet, du aspirerar pulserande blod. Hemoperikardiet förvärras. Dra ut nålen.",cls:"bad",fail:true,why:"myokardpunktion"};}
       return{log:(guidad?"Perikardiocentes: du får inte in nålen i utgjutningen, försök igen.":"Blind perikardiocentes: du träffar ingenting. Utan ultraljud vet du inte var nålen är."),cls:"bad",fail:true,why:"missad punktion"};
     }
     S.treatProgress.perikard=true;
     const cTamp2=hasActiveCause("tamponad");
     if(cTamp2){treatStep("perikard",cTamp2);
       return{log:"60 ml blod aspirerat ur perikardiet"+(guidad?" under direkt ultraljudssikt":"")+", hjärtat fylls igen!",cls:"ok"};}
     flag("Perikardiocentes utan tamponad (risk för myokardskada)",-6);
     return{log:"Perikardiocentes: ingen vätska.",cls:"info"};},undefined,{handsOff:true});}},
  {id:"torakotomi",label:()=>S.treatProgress.torakotomi?"Torakotomi utförd ✓":"Resuscitativ torakotomi (clamshell)",sub:()=>"Endast vid penetrerande toraxtrauma · "+(S.surgeonPresent?"kirurg på plats":"läkare"),cls:"crit",
   enabled:()=>!S.treatProgress.torakotomi&&!S.rosc,
   run(){
     enqueue(S.surgeonPresent?"kirurg":"lakare","Utför resuscitativ torakotomi (hands-off)",S.surgeonPresent?25:35,()=>{ S.treatProgress.torakotomi=true;resumeComp();
     const traumaCause=S.causes.find(c=>c.trauma==="penetrerande");
     if(traumaCause){
       const cTamp=hasActiveCause("tamponad"); if(cTamp){treatStep("perikard",cTamp);return{log:"Torakotomi med perikardiotomi, tamponaden töms och hjärtsåret komprimeras. Cirkulationen kan återvända.",cls:"ok"};}
       const cHyp=hasActiveCause("hypovol"); if(cHyp){S.fluids+=2;treatStep("vatska",cHyp);return{log:"Torakotomi med aortakompression och blödningskontroll, den massiva blödningen bromsas.",cls:"ok"};}
       const cTen=hasActiveCause("tension"); if(cTen){treatStep("naldekomp",cTen);return{log:"Torakotomi avlastar övertrycket i thorax.",cls:"ok"};}
       return{log:"Torakotomi utförd.",cls:"info"};
     }
     if(S.causes.some(c=>c.trauma==="trubbigt")){flag("Resuscitativ torakotomi vid trubbigt våld (mycket dålig prognos, sällan indicerad)",-4);
       return{log:"Resuscitativ torakotomi vid TRUBBIGT våld gav ingen effekt, överlevnaden är närmast obefintlig och åtgärden är inte indicerad. Fokusera på blödningskontroll och blod.",cls:"bad"};}
     flag("Resuscitativ torakotomi utan penetrerande toraxtrauma (ej indicerad)",-6);
     return{log:"Torakotomi utan indikation, ingen effekt.",cls:"bad"};},undefined,{handsOff:true});}},
  {id:"bastest",label:()=>S.blodgrupperad?"Blodgruppering klar ✓":"Skicka blodgruppering (BAS-test)",
   sub:()=>S.blodgrupperad?"0-neg står framme på blodcentralen":"Beställ TIDIGT, kortar hämtningen av blod från 26 s till 12 s",cls:"drug",
   enabled:()=>!S.blodgrupperad&&!S.rosc,
   run(){ enqueue("nurse","Skickar blodgruppering (BAS-test)",12,()=>{ S.blodgrupperad=true; S.blodgrupperadAt=S.t;
     return{log:"Blodgruppering skickad, blodcentralen tar fram korstestat blod. Det står framme när du behöver det.",cls:"ok"};});}},
  {id:"transfusion",label:()=>S.mtpActive?"MTP aktivt, blod ges ✓":"Aktivera massivt transfusionsprotokoll",
   sub:()=>(S.blodgrupperad?"Blodet står framme (12 s)":"Ogrupperat 0-neg måste hämtas (26 s)")+" · rinner in på "+(S.cvk?"30":"60")+" s",cls:"drug",
   enabled:()=>!S.mtpActive&&!S.rosc,
   run(){ if(!drugOK())return; S.mtpActive=true;
     const hamta = S.blodgrupperad?12:26;
     enqueue("nurse","Hämtar & startar blodprodukter (MTP)",hamta,()=>{
       const dur = S.cvk?30:60;      // grov central lumen halverar transfusionstiden
       startInfusion("blod","Blodprodukter 1:1:1",dur,2,()=>{
         const cHypovolMtp=hasActiveCause("hypovol");
         if(cHypovolMtp){ treatStep("vatska",cHypovolMtp);
           log("Blodprodukterna är inne, erytrocyter, plasma och trombocyter 1:1:1 samt tranexamsyra. Cirkulerande volym återställd.","ok"); }
         else { flag("Massivt transfusionsprotokoll utan blödningsorsak (onödig blodåtgång)",-4);
           log("Blodprodukterna är inne, men ingen blödningsorsak påvisad.","warn"); }
       });
       return{log:"Massivt transfusionsprotokoll igång, blodet hänger och rinner"+(S.cvk?" i grov CVK-lumen":"")+". Full effekt om "+dur+" s.",cls:"info"};});}},
  {id:"varme",label:()=>S.treatProgress.varme?"Uppvärmning pågår ✓":"Aktiv uppvärmning",sub:()=>"Varm vätska, värmetäcke · undersköterska (15 s)",
   enabled:()=>!S.treatProgress.varme&&!S.rosc,
   run(){S.treatProgress.varme=true;
     enqueue("usk","Kopplar aktiv uppvärmning",15,()=>{
       if(hasActiveCause("hypotermi")){S.warming=S.t;
         return{log:"Aktiv uppvärmning igång (varma vätskor, forcerad varmluft). Temperaturen stiger långsamt …",cls:"ok"};}
       flag("Aktiv uppvärmning utan hypotermi (onödig åtgärd)",-2);
       return{log:"Uppvärmning igång (patienten är normoterm, ingen indikation).",cls:"info"};});}},
  {id:"ecpr",label:()=>S.treatProgress.ecpr?"ECPR-team aktiverat ✓":"Aktivera ECPR-team (ECMO)",sub:()=>"Refraktärt stopp, selekterade patienter",
   enabled:()=>!S.treatProgress.ecpr&&!S.rosc,
   run(){S.treatProgress.ecpr=true;
     if(S.t>600){log("ECPR-teamet aktiverat, kanylering förbereds parallellt med fortsatt A-HLR.","ok");flag("ECPR övervägdes vid refraktärt stopp",+3);}
     else log("ECPR-teamet aktiverat tidigt.","info");}}
 ],
 rosc:[
  {id:"p_abcde",label:()=>S.post.abcde?"ABCDE utförd ✓ (gör om)":"Strukturerad ABCDE-bedömning",sub:()=>"5 steg à ~2 s · post-ROSC · läkare",
   enabled:()=>S.rosc,
   run(){ S.post.abcde=true; doExamABCDE(); }},
  {id:"p_o2",label:()=>"Titrera SpO₂ 94–98 %",sub:()=>"Undvik hyperoxi, normokapni",
   enabled:()=>S.rosc&&!S.post.o2,
   run(){S.post.o2=true;log("FiO₂ nedtitrerad, mål SpO₂ 94–98 %, normalt PaCO₂.","ok");}},
  {id:"p_ekg",label:()=>S.post.ekg?("12-EKG taget ✓, du bedömde: "+(S.post.ekgCall==="stemi"?"STEMI":"ej STEMI")):"12-avlednings-EKG",sub:()=>"Registrera och tolka själv",
   enabled:()=>S.rosc&&!S.post.ekg,
   run(){ openEkgModal(); }},
  {id:"p_bt",label:()=>"Mät blodtryck (mål systoliskt ≥100)",sub:()=>S.rosc?("Aktuellt systoliskt "+Math.round(S.post.sbt||0)+" mmHg"+(S.post.sbt>=100?" ✓":", under mål")):"Vätska/vasopressor vid behov",
   enabled:()=>S.rosc,
   run(){S.post.bt=true;const sb=Math.round(S.post.sbt);log("Blodtryck uppmätt: systoliskt "+sb+" mmHg (MAP ~"+Math.round(sb*0.66)+"). "+(S.post.sbt>=100?"Målet uppnått.":"Under målet, ge vätska och starta noradrenalininfusion."),S.post.sbt>=100?"ok":"warn");}},
  {id:"p_fluid",label:()=>"Vätskebolus 250–500 ml",sub:()=>"Rinner in på 30 s · fyll på volym före vasopressor",
   enabled:()=>S.rosc&&S.post.fluid<2&&!S.infusions.some(i=>i.kind==="postfluid"),
   run(){ enqueue("nurse","Kopplar vätskebolus (post-ROSC)",18,()=>{
     const bump=S.causes.some(c=>c.id==="hypovol"||c.trauma)?rnd(16,24):rnd(8,15);
     startInfusion("postfluid","Vätskebolus",30,0,()=>{ S.post.fluid++;
       log("Vätskebolusen har runnit in, systoliskt blodtryck "+Math.round(S.post.sbt)+" mmHg.","ok"); });
     S.infusions[S.infusions.length-1].sbtPerSec=bump/30;   // trycket stiger medan den rinner
     mark("Vätskebolus (post-ROSC)","drug");
     return{log:"Vätskebolus kopplad, trycket stiger gradvis medan den rinner in.",cls:"info"};});}},
  {id:"p_noradr",label:()=>S.post.noradr?"Noradrenalininfusion pågår ✓":"Starta noradrenalininfusion",
   sub:()=>S.cvk?"Ges centralt via CVK (8 s)":"Perifert, bör helst ges i CVK (13 s)",cls:"crit",
   enabled:()=>S.rosc&&!S.post.noradr,
   run(){ const tomTank = S.post.fluid===0;
     enqueue("nurse","Startar noradrenalininfusion",S.cvk?8:13,()=>{ S.post.noradr=true;
     mark("Noradrenalininfusion startad","drug");
     if(tomTank){
       flag("Vasopressor startad på tom tank (ingen volym given först)",-5);
       S.post.sbt=Math.min(S.post.sbt+rnd(4,9), 96);
       return{log:"Noradrenalininfusion igång, men kärlen är tomma. Trycket stiger bara till "+Math.round(S.post.sbt)+" mmHg. Du pressar ett tomt hjärta: ge volym.",cls:"warn"};
     }
     S.post.sbt=Math.max(S.post.sbt, rnd(88,98));
     return{log:"Noradrenalininfusion igång"+(S.cvk?" via CVK":"")+", systoliskt "+Math.round(S.post.sbt)+" mmHg och stigande. Titrera mot MAP ≥65.",cls:"ok"};});}},
  {id:"p_airway",label:()=>S.post.airway?"Luftväg &amp; ventilation kontrollerad ✓":"Kontrollera luftväg &amp; ventilation",
   sub:()=>(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi")?(S.capno?"Säkrad luftväg, kapnografi kopplad":"Säkrad luftväg, kapnografi EJ kopplad ännu"):"Endast mask, ingen definitiv luftväg säkrad",
   enabled:()=>S.rosc&&!S.post.airway,
   run(){ S.post.airway=true;
     mark("Luftväg & ventilation kontrollerad","airway");
     const secured=(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi");
     if(!secured){
       flag("Ingen definitiv luftväg säkrad post-ROSC",-4);
       log("Patienten ventileras bara på mask. Efter ROSC bör en definitiv luftväg (i-gel eller trakealtub) säkras och kapnografi kopplas för kontrollerad ventilation.","bad");
     } else if(!S.capno){
       flag("Kapnografi ej kopplad post-ROSC",-2);
       log("Luftvägen är säkrad ("+airwayNote()+"), men kapnografi är inte kopplad. Koppla den för att styra ventilationen och bekräfta läget.","warn");
     } else {
       flag("Luftväg och ventilation kontrollerade och säkrade post-ROSC",+3);
       log("Luftvägen är säkrad ("+airwayNote()+") med kapnografi kopplad, kontrollerad ventilation pågår. Bra.","ok");
     }
   }},
  {id:"p_orsak",label:()=>S.post.orsak?"Orsak åtgärdad / disponerad ✓ ("+(DEST_INFO[S.post.dest]||{}).label+")":"Åtgärda orsak / disponera",sub:()=>"Välj vart patienten ska, sedan ringer du och rapporterar",cls:"crit",
   enabled:()=>S.rosc&&!S.post.orsak,
   run(){ openOrsakModal(); }},
  {id:"p_klar",label:()=>"Överlämning, avsluta scenariot",sub:()=>S.rosc&&S.post.sbt<90?("Systoliskt "+Math.round(S.post.sbt)+", patienten är inte stabil"):"Kräver genomförd rapport",cls:"crit",
   enabled:()=>S.rosc,
   run(){
     const mottNamn=(DEST_INFO[S.post.dest]||DEST_INFO.iva).label;
     if(S.post.sbt<90){
       log(mottNamn+"-jouren: \"Systoliskt "+Math.round(S.post.sbt)+"? Han är inte transportstabil. Fyll på volym och få upp trycket först.\"","warn");
       flag("Försökte överlämna hemodynamiskt instabil patient",-5);
       return;
     }
     endScenario("iva");}}
 ]
}

function recoveryDelay(){            // sek tills egen cirkulation återvänder efter korrekt åtgärd
  const q=qualityAvg();
  return clamp(rnd(16,28)*(1.25-0.55*q), 12, 34);
}
// Ersätter de tidigare spridda "S.cause.id==='X'"-jämförelserna: returnerar den (ännu
// obehandlade) orsak i S.causes som matchar id, annars undefined. I normalläge finns bara
// en orsak i S.causes så beteendet är identiskt med förut; i hardcore med två samtidiga
// orsaker kan VILKEN som helst av dem kännas igen och åtgärdas oberoende av den andra.
function hasActiveCause(id){
  return (S.causes||[S.cause]).find(c=>c.id===id && c.treatedAt==null);
}
function allCausesTreated(){
  return (S.causes||[S.cause]).every(c=>c.treatedAt!=null);
}
function markCauseTreated(causeObj){ // sätter EN orsak åtgärdad; startar återhämtningsklockan när ALLA är åtgärdade
  causeObj = causeObj || S.cause;
  if(causeObj.treatedAt!=null) return;
  causeObj.treatedAt=S.t;
  mark((S.causes&&S.causes.length>1)?"Orsak åtgärdad: "+causeObj.namn:"Orsak åtgärdad","cause");
  if(allCausesTreated()){
    if(S.causeTreatedAt===null) S.causeTreatedAt=S.t;
    if(S.recoverAt===null) S.recoverAt=S.t+recoveryDelay();
  }
}
function startShockRecovery(){       // lyckad defibrillering som ännu inte perfunderar
  const eta=S.t+recoveryDelay();
  if(S.recoverAt===null||eta<S.recoverAt)S.recoverAt=eta;
}
function scheduleRecognition(){      // ROSC känns igen (EtCO₂-stegring + pulskontroll) inom några sek
  if(S.roscRecognizeAt===null)S.roscRecognizeAt=S.t+rnd(7,14);
}
function treatStep(key,causeObj){
  const c=causeObj||S.cause;
  const behov=c.behandling||[];
  if(!behov.length)return;
  S.treatProgress[key]=(S.treatProgress[key]||0)+1;
  // hypovolemi kräver 2× vätska
  if(c.id==="hypovol"){ if(S.fluids>=2&&c.treatedAt==null){markCauseTreated(c);log("Cirkulerande volym delvis återställd, hjärtat har något att pumpa med.","ok");} return;}
  if(c.id==="hypoxi")return; // hanteras i tick (luftväg+O2+ventilation över tid)
  if(c.id==="cico")return;   // hanteras i tick (koniotomi+O2+ventilation över tid)
  if(c.id==="hypotermi")return; // hanteras i tick (uppvärmning)
  if(c.id==="pe")return;        // hanteras i tick (trombolys-fördröjning)
  markCauseTreated(c);
}

/* ---------- Slumpade komplikationer ---------- */
