/* ---------- EKG-simulator: tillstånd och gruppering ---------- */
/* Varje "condition" bidrar med en delta-profil som läggs ihop med alla andra just nu
   aktiva tillstånd (se composeProfile). Tillstånd med samma "group" är ömsesidigt
   uteslutande (klick på en stänger av ev. andra aktiva i samma grupp) — grupplösa
   ("group:null") går alltid att kombinera fritt med vad som helst.

   Sammansättningsregler per fält (se composeProfile): st/tInvMap/rsrPrime slås ihop
   per avledning (st: summa, tInvMap/rsrPrime: max), qrsWide summeras (så t.ex.
   vänster + höger fascikelblock kan kombineras med grenblock), qt multipliceras
   (två QT-förlängande fynd förstärker varandra), axis/tScale/lowVolt/alternans/delta/
   prDepress/hr/irregular tar senast satta värde, pWave tar minsta värdet (mest
   avsaknad av P-våg vinner om flera tillstånd rör den). Detta är en pedagogisk
   modell, inte validerad mot riktiga EKG-mätvärden. */
const ECG_GROUPS = {
  ischemia:   "ST-förändring / ischemi",
  potassium:  "Kalium",
  calcium:    "Kalcium",
  rhythm:     "Rytm",
  conduction: "Retledningshinder",
  fascicular: "Fascikelblock",
  toxicology: "Läkemedel/intox",
  pacemaker:  "Pacemaker",
  avblock:    "AV-block",
  other:      "Övrigt"
};
// Läkemedel/intox och Övrigt är rena samlingsfack av orelaterade tillstånd, inte alternativa
// diagnoser för samma sak (till skillnad från t.ex. STEMI/NSTEMI) — en patient kan mycket väl
// ha flera samtidigt (TCA- och digitalisintox, eller lungemboli + hypotermi). Toggle-logiken
// (Simulator/Game) slår därför INTE av syskon inom dessa två grupper.
const ECG_NONEXCLUSIVE_GROUPS = new Set(["toxicology", "other"]);

// Menyfliken (höger nav) är en REN visningsgruppering, separat från ECG_GROUPS ovan — flera
// kliniskt närliggande grupper visas under EN flik för att hålla antalet flikar lågt (5 i
// stället för 10), men c.group (ömsesidig uteslutning) ändras INTE: kalium och kalcium ska
// t.ex. fortfarande kunna vara aktiva samtidigt även om de nu delar flik.
const ECG_TABS = {
  ischemia:    {label: "ST-förändring / ischemi", groups: ["ischemia"]},
  electrolyte: {label: "Elektrolyt & läkemedel",   groups: ["potassium", "calcium", "toxicology"]},
  rhythm:      {label: "Rytm",                     groups: ["rhythm"]},
  conduction:  {label: "Retledningshinder",        groups: ["conduction", "fascicular", "avblock", "pacemaker"]},
  other:       {label: "Övrigt",                   groups: ["other"]}
};

const ECG_CONDITIONS = [
  // ---- ST-förändring / ischemi (ömsesidigt uteslutande) ----
  // LAD/RCA/LCx har ett "Tidsförlopp"-reglage (stages) i stället för en enda fast delta:
  // steg 0 (hyperakut) modellerar de höga, breda, symmetriska T-vågorna som är EKG:ts allra
  // första STEMI-tecken (innan mätbar ST-höjning), steg 1 är den etablerade bilden (tidigare
  // enda läget), steg 2/3 visar T-inversion och tillkommande patologiska Q-vågor i samma
  // territorium efter hand — samma spektrum som man ser seriellt hos en riktig patient.
  {id:"stemi_lad", label:"STEMI, LAD (anterior)", group:"ischemia",
    desc:"Anterior STEMI, LAD-territoriet. Dra i tidsförloppsreglaget för att se hela det naturliga förloppet från hyperakuta T-vågor till gammal Q-vågsinfarkt.",
    physiology:"Total ocklusion av LAD ger transmural ischemi i framvägg/septum. De drabbade cellerna kan inte upprätthålla normal vilopotential, vilket skapar en 'skadeström' mellan friskt och ischemiskt myokard som förskjuter ST-sträckan. Eftersom LAD försörjer stora delar av framväggen och septum syns förändringen brett över V1–V5.",
    defaultStageIndex:1,
    stages:[
      {label:"Hyperakut (0–20 min)", delta:{st:{V1:0.02,V2:0.05,V3:0.06,V4:0.05,V5:0.02}, tAmpMap:{V1:0.3,V2:0.55,V3:0.65,V4:0.55,V5:0.35}}},
      {label:"Etablerad STEMI (min–timmar)", delta:{st:{V1:0.15,V2:0.5,V3:0.6,V4:0.45,V5:0.2,I:0.05,aVL:0.1,II:-0.12,III:-0.18,aVF:-0.15}}},
      {label:"Evolverande (timmar–dagar)", delta:{st:{V1:0.05,V2:0.15,V3:0.2,V4:0.15,V5:0.05}, tInvMap:{V1:0.3,V2:0.55,V3:0.6,V4:0.55,V5:0.3}, qAmpMap:{V2:0.5,V3:0.6,V4:0.5}}},
      {label:"Gammal infarkt (veckor+)", delta:{qAmpMap:{V2:0.9,V3:1.0,V4:0.9}, tInvMap:{V2:0.15,V3:0.15}}}
    ]},
  {id:"stemi_rca", label:"STEMI, RCA (inferior)", group:"ischemia",
    desc:"Inferior STEMI, RCA-territoriet (III > II). Dra i tidsförloppsreglaget för att se förloppet från hyperakut till gammal infarkt.",
    physiology:"Samma transmurala skadeström som vid LAD-ocklusion, men i den inferiora väggen. Lead III ligger mer åt höger i frontalplanet än II och fångar därför den högerdominanta RCA-skadan bäst (III > II), medan reciprok ST-sänkning ses i avledningar som 'ser' åt vänster/superiort (I, aVL). Proximal ocklusion drabbar ofta även höger kammare.",
    defaultStageIndex:1,
    stages:[
      {label:"Hyperakut (0–20 min)", delta:{st:{II:0.03,III:0.04,aVF:0.04,I:-0.02,aVL:-0.03}, tAmpMap:{II:0.4,III:0.5,aVF:0.45}}},
      {label:"Etablerad STEMI (min–timmar)", delta:{st:{II:0.35,III:0.45,aVF:0.4,I:-0.1,aVL:-0.18,V1:0.06}}},
      {label:"Evolverande (timmar–dagar)", delta:{st:{II:0.12,III:0.15,aVF:0.14,I:-0.04,aVL:-0.06}, tInvMap:{II:0.4,III:0.5,aVF:0.45}, qAmpMap:{II:0.4,III:0.5,aVF:0.45}}},
      {label:"Gammal infarkt (veckor+)", delta:{qAmpMap:{II:0.7,III:0.85,aVF:0.75}, tInvMap:{II:0.15,III:0.15,aVF:0.15}}}
    ]},
  {id:"stemi_lcx", label:"STEMI, LCx (lateral)", group:"ischemia",
    desc:"Lateral STEMI, LCx-territoriet — ofta \"elektriskt tyst\" och lättare att missa. Dra i tidsförloppsreglaget för att se förloppet.",
    physiology:"LCx försörjer den laterala/basala vänsterkammarväggen, ett område som inget standardavledning ligger direkt över — samma transmurala skadeström som andra STEMI, men den 'osynliga' vinkeln gör att ST-höjningen ofta blir diskret trots ett stort infarktområde, ett känt fallgrop vid EKG-tolkning.",
    defaultStageIndex:1,
    stages:[
      {label:"Hyperakut (0–20 min)", delta:{st:{I:0.02,aVL:0.03,V5:0.03,V6:0.03}, tAmpMap:{I:0.3,aVL:0.35,V5:0.4,V6:0.35}}},
      {label:"Etablerad STEMI (min–timmar)", delta:{st:{I:0.22,aVL:0.28,V5:0.32,V6:0.28,III:-0.12,aVF:-0.1}}},
      {label:"Evolverande (timmar–dagar)", delta:{st:{I:0.08,aVL:0.1,V5:0.12,V6:0.1}, tInvMap:{I:0.35,aVL:0.4,V5:0.45,V6:0.4}, qAmpMap:{V5:0.4,V6:0.4,I:0.2}}},
      {label:"Gammal infarkt (veckor+)", delta:{qAmpMap:{V5:0.6,V6:0.6,I:0.3}, tInvMap:{I:0.15,aVL:0.15,V5:0.15,V6:0.15}}}
    ]},
  {id:"stemi_posterior", label:"STEMI, posterior", group:"ischemia",
    desc:"Ingen direkt avledning ser baksidan — i stället indirekta spegelbildstecken i V1–V3: ST-sänkning, hög/bred R-våg och upprätt T-våg. Bekräfta med posteriora avledningar (V7–V9) vid misstanke.",
    physiology:"Den bakre kammarväggen har ingen avledning som 'tittar' på den direkt, men V1–V3 ligger som en spegelbild på motsatt sida av hjärtat. Det som posteriort skulle synas som ST-höjning, breda R-vågor och upprätta T-vågor visas därför omvänt (spegelvänt) i de främre bröstavledningarna.",
    delta:{st:{V1:-0.15,V2:-0.2,V3:-0.15}, rAmpMap:{V1:0.35,V2:0.3}}},
  {id:"nstemi", label:"NSTEMI", group:"ischemia",
    desc:"ST-sänkning och T-inversion utan ST-höjning — subtotal ischemi.",
    physiology:"Subendokardiell (icke-transmural) ischemi drabbar först hjärtats innersta muskellager, som är känsligast för minskat perfusionstryck eftersom det ligger längst bort från kranskärlens epikardiella grenar. Skadeströmmen pekar då bort från epikardiet, vilket ger ST-sänkning snarare än ST-höjning i de avledningar som täcker området.",
    delta:{st:{V4:-0.15,V5:-0.2,V6:-0.15,II:-0.1}, tInvMap:{V4:0.5,V5:0.6,V6:0.5}}},
  {id:"wellens_a", label:"Wellens syndrom A (bifasisk)", group:"ischemia",
    desc:"Bifasiska T-vågor V2–V3 (tidigare/mindre vanligt mönster) utan ST-höjning — kritisk LAD-stenos.",
    physiology:"Kritisk proximal LAD-stenos ger återkommande, kortvarig framväggsischemi som hinner återhämta sig mellan episoderna i stället för att övergå i infarkt. Det karakteristiska T-vågsmönstret uppstår under reperfusionsfasen och kvarstår som ett 'fingeravtryck' av hotande infarkt mellan attackerna, även om patienten är smärtfri för stunden.",
    delta:{biphasicMap:{V2:0.8,V3:0.8}, st:{V2:0.03,V3:0.03}, qt:1.05}},
  {id:"wellens_b", label:"Wellens syndrom B (djup inversion)", group:"ischemia",
    desc:"Djupa, symmetriska T-inversioner V2–V3 (vanligast) utan ST-höjning — kritisk LAD-stenos.",
    physiology:"Samma mekanism som Wellens A (kritisk proximal LAD-stenos med reperfusion mellan ischemiska episoder), men i det vanligare och mer uttalade stadiet där T-vågen är helt (inte bara delvis) inverterad — ett tecken på mer uttalad myokardiell stunning.",
    delta:{tInvMap:{V2:0.9,V3:0.9}, st:{V2:0.04,V3:0.04}, qt:1.05}},
  {id:"dewinter", label:"de Winter T-vågor", group:"ischemia",
    desc:"Uppåtsluttande ST-sänkning i J-punkten som glider över i höga, symmetriska T-vågor V2–V4 — STEMI-ekvivalent vid proximal LAD-ocklusion.",
    physiology:"Ses vid akut, ofta subtotal, proximal LAD-ocklusion. Mekanismen liknar Wellens (kritisk framväggsischemi), men ger en annan elektrisk signatur — uppåtsluttande ST-sänkning som glider över i höga T-vågor i stället för klassisk ST-höjning — och klassas ändå som en STEMI-ekvivalent som kräver akut kranskärlsröntgen.",
    delta:{st:{V2:-0.08,V3:-0.1,V4:-0.08,aVR:0.05}, tAmpMap:{V2:0.5,V3:0.6,V4:0.5}}},
  {id:"pericarditis", label:"Perikardit", group:"ischemia",
    desc:"Diffus ST-förändring plus PR-sänkning. Dra i tidsförloppsreglaget för att se Spodicks fyra klassiska EKG-stadier.",
    physiology:"Inflammationen i perikardiet sprider sig ofta till det direkt underliggande subepikardiella myokardiet (myoperikardit), vilket ger en DIFFUS skadeström över hela hjärtat i stället för STEMI:s regionala kärlterritorium. PR-sänkningen speglar samtidig, parallell påverkan på förmakens repolarisation.",
    defaultStageIndex:0,
    stages:[
      {label:"Stadium I (diffus ST-höjning + PR-sänkning)", delta:{st:{I:0.15,II:0.2,III:0.15,aVF:0.18,V2:0.2,V3:0.25,V4:0.2,V5:0.18,V6:0.15,aVR:-0.15}, prDepress:-0.18}},
      {label:"Stadium II (normalisering, flacka T-vågor)", delta:{prDepress:-0.1, tScale:0.7}},
      {label:"Stadium III (diffus T-inversion)", delta:{tInvMap:{I:0.3,II:0.35,III:0.3,aVF:0.32,V2:0.35,V3:0.4,V4:0.35,V5:0.3,V6:0.28}}},
      {label:"Stadium IV (normaliserat)", delta:{}}
    ]},
  {id:"earlyrepol", label:"Tidig repolarisation", group:"ischemia",
    desc:"Godartad ST-höjning, mest precordialt, utan reciprok sänkning.",
    physiology:"En normalvariant där epikardiets yttre muskellager repolariserar tidigare än endokardiet (vanligast hos unga, vältränade personer), vilket skapar en godartad, konkav ST-höjning med en typiskt 'notchad' J-punkt. Avsaknaden av reciprok ST-sänkning skiljer den från patologisk ST-höjning.",
    delta:{st:{V4:0.15,V5:0.15,V6:0.1,I:0.05,II:0.08}}},

  // ---- Kalium (ömsesidigt uteslutande) ----
  // spectrum:true = svårighetsgraden är ett reglage (0–100%) i stället för på/av: vid låg
  // svårighetsgrad ser man bara antytt spetsiga T-vågor, vid 100% det fullt uttalade fyndet
  // (för hyperkalemi: breddökning som glider ihop till sinusvågsmönster, P-vågen helt borta).
  {id:"hyperk", label:"Hyperkalemi", group:"potassium", spectrum:true,
    desc:"Spetsiga T-vågor tilltagande till breddökat QRS, utslätad P-våg och (vid svår hyperkalemi) sinusvågsmönster. Dra i svårighetsgradsreglaget.",
    physiology:"Förhöjt extracellulärt kalium minskar gradienten över cellmembranet, vilket gör vilomembranpotentialen mindre negativ. Det påskyndar först repolarisationen (spetsiga T-vågor), men vid högre nivåer inaktiveras natriumkanalerna och depolarisationen blir långsammare och bredare (QRS). Vid mycket svår hyperkalemi glider den utslätade P-vågen och det breda QRS-komplexet ihop till ett sinusvågsmönster strax innan asystoli/VF.",
    delta:{tScale:2.6, qrsWide:3.2, pWave:0}},
  {id:"hypok", label:"Hypokalemi", group:"potassium", spectrum:true,
    desc:"Flacka T-vågor, framträdande U-våg, lätt ST-sänkning. Dra i svårighetsgradsreglaget.",
    physiology:"Lågt extracellulärt kalium hyperpolariserar cellmembranet och förlänger repolarisationen, vilket ger flacka T-vågor och en mer framträdande U-våg (sen repolarisation i Purkinjefibrer/papillarmuskler). Den ökade cellulära retbarheten som lågt kalium ger bidrar också till arytmibenägenheten.",
    delta:{tScale:0.4, uWave:1.3, st:{II:-0.05,V3:-0.05}}},

  // ---- Kalcium (ömsesidigt uteslutande) ----
  {id:"hyperca", label:"Hyperkalcemi", group:"calcium",
    desc:"Kort QT-tid.",
    physiology:"Kalcium styr längden på platåfasen (fas 2) i myocytens aktionspotential. Höga kalciumnivåer förkortar platån och därmed hela repolarisationen, vilket ger en kort QT-tid.",
    delta:{qt:0.65}},
  {id:"hypoca", label:"Hypokalcemi", group:"calcium",
    desc:"Lång QT-tid.",
    physiology:"Lågt kalcium förlänger platåfasen i aktionspotentialen och därmed repolarisationen, vilket förlänger QT-tiden och ökar risken för torsades de pointes.",
    delta:{qt:1.4}},

  // ---- Rytm (ömsesidigt uteslutande) ----
  {id:"afib", label:"Förmaksflimmer", group:"rhythm",
    desc:"Oregelbunden rytm utan P-vågor (per definition — ingen organiserad förmaksaktivering), i stället en kaotisk fibrillationsbaslinje.",
    physiology:"Multipla kaotiska re-entry-vågor cirkulerar samtidigt i förmaken i stället för en enda organiserad depolarisationsvåg från sinusknutan. Det ger en snabb, oorganiserad elektrisk aktivitet (fibrillationsvågor) utan sann P-våg, och AV-noden släpper igenom impulser oregelbundet — vilket ger den karakteristiska 'absolut oregelbundna' kammarrytmen.",
    delta:{pWave:0, irregular:0.4, hr:112, fibWave:1}},
  {id:"aflutter_2to1", label:"Förmaksfladder, 2:1-block", group:"rhythm",
    desc:"Sågtandade fladdervågor (~300/min), mest synliga i II/III/aVF och V1 — varannan konducterar, kammarfrekvens ~150/min, oftast regelbunden.",
    physiology:"En enda, stabil re-entry-krets (oftast runt trikuspidalisringen) snurrar med konstant hastighet (~300/min) och skapar de sågtandade fladdervågorna. AV-noden kan fysiologiskt bara leda en bråkdel av dessa impulser vidare, vilket ger en förutsägbar blockeringskvot (här 2:1) och därmed en regelbunden kammarfrekvens.",
    delta:{pWave:0, flutterRatio:2, hr:150}},
  {id:"aflutter_3to1", label:"Förmaksfladder, 3:1-block", group:"rhythm",
    desc:"Sågtandade fladdervågor (~300/min) — var tredje konducterar, kammarfrekvens ~100/min.",
    physiology:"Samma stabila förmaksflädder-krets som vid 2:1-block, men AV-noden befinner sig i ett mer refraktärt tillstånd (t.ex. pga AV-nodsbromsande läkemedel) och släpper därför bara igenom var tredje impuls.",
    delta:{pWave:0, flutterRatio:3, hr:100}},
  {id:"vt", label:"VT (ventrikeltakykardi)", group:"rhythm",
    desc:"Mycket bred, bisarr, monomorf takykardi. Extrem/nordvästlig axel och konkordans (alla bröstavledningar samma polaritet) är specifika VT-tecken. AV-dissociation (P-vågor helt oberoende av och ofta långsammare än QRS) stärker diagnosen ytterligare men går inte att visa i denna modell, som delar en gemensam tidsaxel för P och QRS.",
    physiology:"En re-entry-krets eller fokal urladdning i kammarmuskulaturen tar över rytmen helt, utan koppling till förmaken. Depolarisationen sprids långsamt cell-till-cell genom arbetsmyokardiet i stället för via det snabba His-Purkinje-systemet, vilket ger det breda QRS-komplexet; ursprunget i själva kammarmuskulaturen ger konkordans i bröstavledningarna och ofta en extrem axel.",
    delta:{pWave:0, hr:188, qrsWide:3.6, axis:-100, qrsOverride:1}},
  {id:"avnrt", label:"AVNRT", group:"rhythm",
    desc:"Smal, regelbunden, mycket snabb takykardi, P-vågor svåra att se.",
    physiology:"En medfödd dubbel retledningsbana i/nära AV-noden (en snabb och en långsam bana) möjliggör en liten re-entry-krets som snurrar mycket snabbt runt AV-noden. Eftersom kretsen är liten och förmak/kammare depolariseras nästan samtidigt, döljs P-vågen ofta inuti QRS-komplexet.",
    delta:{pWave:0.1, hr:175}},
  {id:"torsades", label:"Torsades de pointes (\"electrical storm\")", group:"rhythm",
    desc:"Polymorf VT — QRS-amplitud och -polaritet vrider sig successivt kring baslinjen slag för slag, klassiskt utlöst av förlängd QT.",
    physiology:"Kraftigt förlängd repolarisation (lång QT) skapar tidiga efterdepolarisationer som kan utlösa en polymorf VT. Den heterogena repolarisationen i olika delar av kammarmyokardiet gör att den elektriska axeln successivt vrider sig runt baslinjen i stället för att ge ett stabilt, monomorft mönster som vid vanlig VT.",
    delta:{pWave:0, hr:230, qrsWide:2.8, qt:1.5, torsades:1}},

  // ---- Retledningshinder (ömsesidigt uteslutande) ----
  {id:"wpw", label:"WPW", group:"conduction",
    desc:"Deltavåg, kort PR, breddökat QRS av fusion.",
    physiology:"En medfödd accessorisk retledningsbana (Kents bunt) utanför AV-noden leder impulsen till kammaren utan AV-nodens normala fördröjning, vilket ger kort PR-tid. Kammaren depolariseras delvis via denna snabba, onormala väg (deltavågen) och delvis via det vanliga His-Purkinje-systemet — en fusion som breddar QRS.",
    delta:{delta:1, qrsWide:0.3, st:{V5:-0.05,V6:-0.05,I:-0.04}}},
  {id:"rbbb", label:"Höger grenblock (RBBB)", group:"conduction",
    desc:"Brett QRS med rSR'-mönster i V1–V2.",
    physiology:"Blockerad ledning i höger skänkel gör att höger kammare måste depolariseras sent, via långsam cell-till-cell-spridning från vänster kammare i stället för via det snabba retledningssystemet. Det ger ett sent, brett andra R-utslag i de högerorienterade avledningarna V1–V2 (rSR'-mönstret).",
    delta:{qrsWide:1.6, rsrPrime:{V1:0.7,V2:0.35}, st:{V1:-0.08,V2:-0.06}}},
  {id:"lbbb", label:"Vänster grenblock (LBBB)", group:"conduction",
    desc:"Brett QRS, diskordanta ST-T-förändringar — ST-höjning i V1–V2, ST-sänkning och negativa T-vågor lateralt (I, aVL, V5, V6).",
    physiology:"Blockerad vänster skänkel tvingar vänster kammare att depolariseras sent och långsamt från höger, vilket breddar QRS kraftigt. Eftersom depolarisationsriktningen är onormal blir repolarisationen (T-vågen) sekundärt också onormal och riktad diskordant mot QRS — inte ett tecken på samtidig ischemi i sig.",
    delta:{qrsWide:2.1, st:{V1:0.15,V2:0.1,V5:-0.15,V6:-0.12,I:-0.08,aVL:-0.06}, tInvMap:{I:0.5,aVL:0.4,V5:0.6,V6:0.6}}},
  {id:"brugada", label:"Brugada syndrom", group:"conduction",
    desc:"Coved ST-höjning med pseudo-rSR' i V1–V2.",
    physiology:"En natriumkanalopati (ofta SCN5A-mutation) ger obalanserad jonström i höger kammares utflödestrakt under tidig repolarisation, vilket skapar den karakteristiska 'coved' ST-höjningen i V1–V2 och predisponerar för livshotande polymorf VT/VF.",
    delta:{rsrPrime:{V1:0.55,V2:0.4}, st:{V1:0.25,V2:0.2}}},

  // ---- Fascikelblock (ömsesidigt uteslutande) ----
  {id:"lafb", label:"Vänster anterior fascikelblock", group:"fascicular",
    desc:"Uttalad vänsterställd axel.",
    physiology:"Blockerad ledning i vänster anteriora fascikeln tvingar den inferolaterala kammarväggen att depolariseras först, via den kvarvarande posteriora fascikeln, innan resten av vänster kammare nås. Den sena aktiveringsvektorn pekar uppåt-vänster, vilket ger en uttalad vänsterställd axel.",
    delta:{axis:-55, qrsWide:0.15}},
  {id:"lpfb", label:"Vänster posterior fascikelblock", group:"fascicular",
    desc:"Högerställd axel (efter uteslutande av andra orsaker).",
    physiology:"Blockerad ledning i den (mer robusta, sällan isolerat drabbade) posteriora fascikeln gör att den anterolaterala väggen aktiveras först via anteriora fascikeln. Den sena vektorn pekar nedåt-höger, vilket ger en högerställd axel — en diagnos som kräver att andra vanligare orsaker till högerställd axel uteslutits.",
    delta:{axis:110, qrsWide:0.15}},

  // ---- Läkemedel/intox (ömsesidigt uteslutande) ----
  {id:"tca", label:"TCA-intoxikation", group:"toxicology", spectrum:true,
    desc:"Brett QRS och terminal R-våg i aVR (natriumkanalblockad), förlängd QT. Dra i svårighetsgradsreglaget för att se allt från lindrig till uttalad natriumkanalblockad.",
    physiology:"Tricykliska antidepressiva blockerar hjärtats snabba natriumkanaler (kinidinliknande effekt), vilket saktar ner depolarisationen (fas 0) och breddar QRS. Samma läkemedel blockerar även repolariserande kaliumkanaler, vilket förlänger QT. Den terminala R-vågen i aVR uppstår för att den sena, långsamma depolarisationsvektorn pekar mot höger axel/aVR.",
    delta:{qrsWide:1.8, rsrPrime:{aVR:0.6}, qt:1.25}},
  {id:"digitalis", label:"Digitalisintoxikation", group:"toxicology", spectrum:true,
    desc:"Nedåtsluttande, skopformad (\"hängmatta\") ST-sänkning och kort QT. Dra i svårighetsgradsreglaget.",
    physiology:"Digoxin hämmar Na+/K+-ATPas i cellmembranet, vilket förändrar jonbalansen och förkortar aktionspotentialens platåfas — därav den korta QT-tiden. Samma mekanism ger den karakteristiska, nedåtsluttande 'digitalis-effekten' på ST-sträckan, som kan ses redan vid terapeutisk dos och är skild från digitalisTOXICITET (arytmier vid överdos).",
    delta:{st:{V4:-0.08,V5:-0.1,V6:-0.08,II:-0.06}, sag:1, qt:0.8}},

  // ---- Pacemaker (ömsesidigt uteslutande) ----
  {id:"pacemaker", label:"Pacemaker (paced rytm)", group:"pacemaker",
    desc:"Pacemakerspik följt av brett QRS (LBBB-liknande) med förväntade diskordanta ST-T-förändringar — inga tecken till samtidig infarkt.",
    physiology:"En elektrod i höger kammarapex depolariserar myokardiet via samma långsamma cell-till-cell-spridning som vid vänster grenblock, eftersom pacemakerimpulsen inte startar i det normala retledningssystemet. Det ger ett brett QRS med förväntad diskordant (motriktad) ST-T-riktning.",
    delta:{pacerSpike:1, qrsWide:2.0, st:{V1:0.15,V2:0.1,V5:-0.15,V6:-0.12,I:-0.08}}},
  {id:"pacemaker_sgarbossa", label:"Pacemaker + Sgarbossakriterier", group:"pacemaker",
    desc:"Paced rytm med KONKORDANT ST-höjning (samma riktning som QRS) i stället för väntad diskordans — uppfyller (modifierade) Sgarbossakriterier, talar för samtidig infarkt.",
    physiology:"Samma pacade, breda QRS som vanligt — men när ST-sträckan går i SAMMA riktning som QRS (konkordant) i stället för den förväntade diskordanta riktningen kan det inte förklaras av den pacade depolarisationsvektorn ensam, utan talar för en samtidig, verklig skadeström (infarkt) ovanpå den pacade rytmen.",
    delta:{pacerSpike:1, qrsWide:2.0, st:{V1:0.15,V2:0.1,V5:0.18,V6:0.15,I:0.1,II:0.15}}},

  // ---- AV-block (ömsesidigt uteslutande) ----
  // Dessa fyra använder en egen renderingsväg med separata tidslinjer för P-vågor och
  // QRS (se buildAVBlockBeats/ecgSampleAVBlock i ecg-model.js) — de andra 28 tillstånden
  // delar en enda fas per slag, vilket räcker för allt utom just AV-block.
  {id:"avblock1", label:"AV-block I", group:"avblock",
    desc:"Konstant förlängd PR-tid (>200 ms). Varje P-våg leder till en QRS — inga bortfall.",
    physiology:"Fördröjd men fullständig ledning genom AV-noden (ofta pga ökad vagal tonus, AV-nodal ischemi eller AV-nodsbromsande läkemedel) förlänger tiden mellan förmaks- och kammardepolarisation utan att någon impuls går förlorad.",
    delta:{avBlock:"first", prInterval:0.28, atrialHr:70, hr:70}},
  {id:"wenckebach", label:"AV-block II, typ I (Wenckebach)", group:"avblock",
    desc:"Successivt förlängd PR-tid till en P-våg inte leder, sedan börjar cykeln om (\"grupperad\" rytm).",
    physiology:"Progressiv 'utmattning' av AV-nodens ledningsförmåga (Wenckebach-fysiologi, oftast på nodnivå) gör att varje impuls leds allt långsammare tills en helt blockeras. AV-noden återhämtar sig sedan under pausen och cykeln börjar om — vanligen godartat och ofta reversibelt.",
    delta:{avBlock:"wenckebach", wenckebachRatio:4, prInterval:0.16, atrialHr:75, hr:56}},
  {id:"mobitz2", label:"AV-block II, typ II (Mobitz)", group:"avblock",
    desc:"Konstant PR-tid, men var N:e P-våg leder helt plötsligt inte — utan föregående förlängning.",
    physiology:"Blocket sitter oftast INFRANODALT (i His-bunten eller skänklarna, inte i själva AV-noden), där cellerna saknar Wenckebach-fysiologins gradvisa fördröjning — ledningen är antingen normal eller helt utebliven, utan förvarning. Detta representerar strukturell sjukdom i retledningssystemet och progredierar ofta till totalblock.",
    delta:{avBlock:"mobitz2", mobitzRatio:3, prInterval:0.16, atrialHr:90, hr:30}},
  {id:"chb", label:"AV-block III (totalt/komplett)", group:"avblock",
    desc:"Fullständig AV-dissociation — P-vågor och QRS helt oberoende av varandra. QRS på en långsam, ofta bred, oberoende ersättningsrytm.",
    physiology:"Fullständigt avbrott i ledningen mellan förmak och kammare (var som helst i AV-noden eller His-Purkinje-systemet) gör att förmak och kammare styrs av två helt oberoende pacemakerceller — sinusknutan respektive en ersättningsrytm längre ner, som är långsammare och (om den sitter lågt i retledningssystemet) breddökad.",
    delta:{avBlock:"chb", atrialHr:85, escapeHr:34, hr:34, qrsWide:1.8}},

  // ---- Övrigt (fritt kombinerbara, ingen grupp) ----
  {id:"pe", label:"Lungemboli (högerbelastning)", group:"other",
    desc:"S1Q3T3-mönster och T-inversion V1–V3 av akut högerbelastning.",
    physiology:"En stor lungemboli ger akut tryckbelastning av höger kammare, som dilaterar och roterar hjärtats elektriska axel åt höger (S1Q3T3 speglar denna akuta axelrotation). Den samtidiga högerkammarischemin/-belastningen ger T-inversion i de högerorienterade bröstavledningarna V1–V3.",
    delta:{st:{III:0.06,V1:0.05,V2:-0.1,V3:-0.12,V4:-0.06}, tInvMap:{V1:0.5,V2:0.5,V3:0.4,III:0.4}}},
  {id:"tamponade", label:"Perikardtamponad", group:"other",
    desc:"Lågvoltage och elektrisk alternans.",
    physiology:"Vätska i perikardsäcken dämpar (lågvoltage) den elektriska signalen på väg ut till huden, och gör att hjärtat kan svänga fritt (pendla) i vätskan slag för slag. Denna fysiska rörelse ändrar avståndet/vinkeln till EKG-elektroderna varannan slag, vilket ger den karakteristiska elektriska alternansen.",
    delta:{lowVolt:0.42, alternans:0.22}},
  {id:"cardiac_memory", label:"Cardiac memory (T-vågsminne)", group:"other",
    desc:"Uttalade T-vågsinversioner i nedre/laterala avledningar som kvarstår efter avslutad pacing/breddökad rytm, trots normalt QRS — godartat men kan likna ischemi.",
    physiology:"Efter en period med onormal depolarisationsriktning (pacing, breddökad rytm, WPW) 'minns' myokardiets repolarisation den onormala aktiveringssekvensen, troligen via förändrad kaliumkanalsuttryck i cellmembranet. Även efter att QRS normaliserats kvarstår T-vågsinversionerna i timmar till veckor — ett godartat men lätt förväxlat fynd.",
    delta:{tInvMap:{II:0.8,III:0.8,aVF:0.7,V4:0.7,V5:0.8,V6:0.8}}},
  {id:"hypothermia", label:"Hypotermi", group:"other",
    desc:"Osborn-vågor (J-vågor) vid QRS-slutet, bradykardi och förlängd QT.",
    physiology:"Vid kroppstemperatur under ~32 °C saktar jonkanalernas kinetik ner generellt. Osborn-vågen (J-vågen) uppstår av en tidig, kraftig repolarisationsskillnad mellan epikardium och endokardium i slutet av QRS, medan den generella nedsaktningen av retledningssystemet ger bradykardi och förlängd QT.",
    delta:{osborn:1, hr:45, qt:1.2}}
];

const ECG_BASE_PROFILE = {hr:72, axis:60, qt:1, pWave:1, qrsWide:0, tScale:1, delta:0, irregular:0, lowVolt:1, alternans:0, prDepress:0, uWave:0, sag:0, pacerSpike:0, flutterRatio:0, qrsOverride:0, fibWave:0, torsades:0, osborn:0, avBlock:null, prInterval:0.16, atrialHr:72, escapeHr:35, wenckebachRatio:4, mobitzRatio:3};
const ECG_SCALAR_KEYS = ["hr","axis","qt","tScale","delta","irregular","lowVolt","alternans","prDepress","uWave","qrsWide","sag","pacerSpike","flutterRatio","qrsOverride","fibWave","torsades","osborn","prInterval","atrialHr","escapeHr","wenckebachRatio","mobitzRatio"];

/* ---------- Två generella mekanismer ovanpå den vanliga fasta delta-modellen ----------
   1) spectrum:true — svårighetsgraden är ett reglage (0–100%, "lvl") i stället för på/av.
      c.delta beskriver 100%-läget (det mest uttalade fyndet); scaleDeltaBySeverity skalar
      varje fält mot sin "neutrala" baslinje (0 för additiva fält, 1 för multiplikativa som
      qt/tScale, 1 för pWave som går mot avsaknad av P-våg).
   2) stages:[{label,delta}, ...] — ett tidsförloppsreglage: interpolerar mjukt mellan två
      på varandra följande stadiers delta-objekt (lerpDelta), så man kan bläddra genom hela
      det naturliga förloppet (t.ex. STEMI hyperakut → etablerad → evolverande → gammal).
   Båda mekanismerna delar samma lagringsplats (Simulator.severities, ett tal 0..1 per id) —
   main.js tolkar reglaget olika beroende på om tillståndet har spectrum eller stages satt. */
// hr/axis/atrialHr/escapeHr tillkom för EKG-löparens gradvisa svårighetsgrad (scaleDeltaBySeverity
// på hela villkorets delta, inte bara spectrum-fält) — dessa är ABSOLUTA värden, inte deltan-från-noll,
// så de måste blanda från sin fysiologiska baslinje (ECG_BASE_PROFILE) precis som qt/tScale/pWave,
// annars skalas t.ex. VT:s hr:188 mot 0 i stället för mot normal vilopuls vid låg svårighetsgrad.
const NEUTRAL_MULT = {qt:1, tScale:1, lowVolt:1, pWave:1, hr:72, axis:60, atrialHr:72, escapeHr:35};
function _neutralFor(key){ return NEUTRAL_MULT[key]!=null ? NEUTRAL_MULT[key] : 0; }
function _lerp(a,b,t){ return a + (b-a)*t; }

function scaleDeltaBySeverity(delta, f){
  const out = {};
  for(const k in delta){
    const v = delta[k];
    if(NEUTRAL_MULT[k]!=null){ out[k] = _neutralFor(k) + (v - _neutralFor(k))*f; }
    else if(typeof v === "object"){ const m={}; for(const lead in v) m[lead]=v[lead]*f; out[k]=m; }
    else if(typeof v === "number"){ out[k] = v*f; }
    else out[k] = v;
  }
  return out;
}
function lerpDelta(a, b, t){
  const keys = new Set([...Object.keys(a||{}), ...Object.keys(b||{})]);
  const out = {};
  keys.forEach(k => {
    const av = a[k], bv = b[k];
    if(typeof av === "object" || typeof bv === "object"){
      const leadKeys = new Set([...Object.keys(av||{}), ...Object.keys(bv||{})]);
      const m = {};
      leadKeys.forEach(lead => { m[lead] = _lerp((av||{})[lead]||0, (bv||{})[lead]||0, t); });
      out[k] = m;
    } else if(typeof av === "number" || typeof bv === "number"){
      const n = _neutralFor(k);
      out[k] = _lerp(av!=null?av:n, bv!=null?bv:n, t);
    } else out[k] = t<0.5 ? av : bv;
  });
  return out;
}
function defaultLevel(c){
  if(c.stages) return (c.defaultStageIndex||0)/(c.stages.length-1);
  if(c.spectrum) return 0.5;
  return null;
}
function resolveConditionDelta(c, lvl){
  if(c.spectrum){
    const f = lvl!=null ? lvl : defaultLevel(c);
    return scaleDeltaBySeverity(c.delta, f);
  }
  if(c.stages){
    const f = lvl!=null ? lvl : defaultLevel(c);
    const n = c.stages.length, pos = Math.max(0, Math.min(n-1, f*(n-1)));
    const i0 = Math.floor(pos), i1 = Math.min(n-1, i0+1), frac = pos - i0;
    return lerpDelta(c.stages[i0].delta, c.stages[i1].delta, frac);
  }
  return c.delta;
}

// Slår ihop en LISTA av redan upplösta delta-objekt till en full profil. Utbruten ur
// composeProfile så att EKG-löparen kan bygga en profil per SLAG (med sin egen tidsstyrda
// svårighetsgrad per tillstånd) genom samma sammansättningsregler, utan att duplicera dem.
function mergeDeltas(deltas){
  const p = {...ECG_BASE_PROFILE, st:{}, tInvMap:{}, rsrPrime:{}, biphasicMap:{}, tAmpMap:{}, rAmpMap:{}, qAmpMap:{}};
  let qtMult = 1;
  deltas.forEach(d => {
    if(!d) return;
    if(d.st) for(const lead in d.st) p.st[lead] = (p.st[lead]||0) + d.st[lead];
    if(d.tInvMap) for(const lead in d.tInvMap) p.tInvMap[lead] = Math.max(p.tInvMap[lead]||0, d.tInvMap[lead]);
    if(d.rsrPrime) for(const lead in d.rsrPrime) p.rsrPrime[lead] = Math.max(p.rsrPrime[lead]||0, d.rsrPrime[lead]);
    if(d.biphasicMap) for(const lead in d.biphasicMap) p.biphasicMap[lead] = Math.max(p.biphasicMap[lead]||0, d.biphasicMap[lead]);
    if(d.tAmpMap) for(const lead in d.tAmpMap) p.tAmpMap[lead] = (p.tAmpMap[lead]||0) + d.tAmpMap[lead];
    if(d.rAmpMap) for(const lead in d.rAmpMap) p.rAmpMap[lead] = (p.rAmpMap[lead]||0) + d.rAmpMap[lead];
    if(d.qAmpMap) for(const lead in d.qAmpMap) p.qAmpMap[lead] = (p.qAmpMap[lead]||0) + d.qAmpMap[lead];
    if(d.qrsWide!=null) p.qrsWide += d.qrsWide;
    if(d.qt!=null) qtMult *= d.qt;
    if(d.axis!=null) p.axis = d.axis;
    if(d.tScale!=null) p.tScale = d.tScale;
    if(d.lowVolt!=null) p.lowVolt = d.lowVolt;
    if(d.alternans!=null) p.alternans = d.alternans;
    if(d.prDepress!=null) p.prDepress += d.prDepress;
    if(d.delta!=null) p.delta = d.delta;
    if(d.uWave!=null) p.uWave = d.uWave;
    if(d.sag!=null) p.sag = d.sag;
    if(d.pacerSpike!=null) p.pacerSpike = d.pacerSpike;
    if(d.flutterRatio!=null) p.flutterRatio = d.flutterRatio;
    if(d.qrsOverride!=null) p.qrsOverride = d.qrsOverride;
    if(d.fibWave!=null) p.fibWave = d.fibWave;
    if(d.torsades!=null) p.torsades = d.torsades;
    if(d.osborn!=null) p.osborn = d.osborn;
    if(d.avBlock!=null) p.avBlock = d.avBlock;
    if(d.prInterval!=null) p.prInterval = d.prInterval;
    if(d.atrialHr!=null) p.atrialHr = d.atrialHr;
    if(d.escapeHr!=null) p.escapeHr = d.escapeHr;
    if(d.wenckebachRatio!=null) p.wenckebachRatio = d.wenckebachRatio;
    if(d.mobitzRatio!=null) p.mobitzRatio = d.mobitzRatio;
    if(d.hr!=null) p.hr = d.hr;
    if(d.irregular!=null) p.irregular = d.irregular;
    if(d.pWave!=null) p.pWave = Math.min(p.pWave, d.pWave);
  });
  p.qt = qtMult;
  return p;
}
function composeProfile(activeIds, severities){
  severities = severities || {};
  const deltas = activeIds.map(id => {
    const c = ECG_CONDITIONS.find(x => x.id === id);
    return c ? resolveConditionDelta(c, severities[id]) : null;
  });
  return mergeDeltas(deltas);
}
