/* ---------- Nervbanor genom CNS: datamodell ---------- */
/* Fem system, samma vertikala hjärna+ryggmärgs-schema (se tracts.js för SVG-uppbyggnaden).
   VARJE bana beskrivs som en punktlista (waypoints) som ritas som EN sammanhängande linje —
   bara vänster KROPPSHALVA/vänster ursprung spåras (inte båda sidor samtidigt), eftersom
   poängen är att visa VAR banan korsar (eller INTE korsar), inte att duplicera allt speglat.
   decussate:true på en punkt betyder "linjen hoppar till högersidans x-koordinat HÄR" —
   det är den kliniskt viktiga detaljen (vilken nivå avgör om ett fynd blir kontra- eller
   ipsilateralt skadan). Punkter med info=null är bara geometriska genomgångspunkter
   (ritas inte som hovrbara noder), punkter MED info är de markerade strukturerna. */
const TRACT_SYSTEMS = {
  corticospinal:{
    name:"Motorisk bana (kortikospinala banan)", short:"Motorik", color:"#F44336",
    summary:"Övre motorneuron från cortex till ryggmärgens framhorn. Korsar i FÖRLÄNGDA MÄRGEN (pyramidbanans korsning) — en skada OVANFÖR korsningen ger kontralateral svaghet, en skada NEDANFÖR (i ryggmärgen) ger ipsilateral svaghet.",
    points:[
      {x:100,y:46,info:{name:"Motorisk cortex (gyrus precentralis, M1)",
        role:"Startpunkt — övre motorneuronet. Varje kroppsdel har sin egen karta här (den motoriska homunkulusen).",
        other:"Direkt skada (t.ex. ischemisk stroke i ACM-territoriet) ger kontralateral svaghet redan HÄR, innan banan ens korsat — det är kortikala lesioner som klassiskt ger svaghet i endast ansikte+arm ELLER endast ben, beroende på var på homunkulusen skadan sitter."}},
      {x:112,y:112,info:{name:"Capsula interna (bakre skänkeln)",
        role:"Alla motoriska fibrer från hela cortex trängs samman till ett smalt band här innan de fortsätter ner i hjärnstammen.",
        other:"Sensoriska talamokortikala fibrer passerar också genom capsula interna, tätt intill — en enda liten lakunär infarkt här (vanligen från hypertoni) kan därför ge BÅDE motorisk och sensorisk kontralateral bortfall, oproportionerligt stort för lesionens storlek."}},
      {x:130,y:175,info:null},
      {x:142,y:222,info:null},
      {x:146,y:255,info:{name:"Pyramidbanans korsning (decussatio pyramidum)",
        role:"HÄR korsar ~85–90 % av fibrerna om till motsatt sida — den avgörande nivån för om en ryggmärgsskada ger kontra- eller ipsilateral svaghet.",
        other:"De ~10–15 % som INTE korsar fortsätter som den mindre främre kortikospinala banan, ojämnt fördelad och kliniskt mindre betydelsefull."}, decussate:true},
      {x:182,y:295,info:null},
      {x:186,y:420,info:null},
      {x:184,y:600,info:null},
      {x:181,y:648,info:{name:"Framhornscell (nedre motorneuron)",
        role:"Sista stationen — här synapsar den kortikospinala banan om till det nedre motorneuronet som faktiskt lämnar ryggmärgen.",
        other:"En skada HÄR (t.ex. ALS, polio) ger ett HELT ANNAT kliniskt mönster än en skada i själva banan ovanför — slapp pares, atrofi och fascikulationer i stället för spasticitet, eftersom det är den sista gemensamma vägen ut till muskeln som slås ut."}},
      {x:198,y:658,info:null}
    ]
  },
  dcml:{
    name:"Beröring/proprioception (bakstranssystemet, DCML)", short:"Känsel", color:"#2196F3",
    summary:"Fin beröring, vibration och proprioception. Går IPSILATERALT hela vägen upp genom ryggmärgen och korsar först i FÖRLÄNGDA MÄRGEN — en helt annan nivå än smärtbanan, vilket är kärnan i dissocierat känselbortfall.",
    points:[
      {x:141,y:695,info:{name:"Sensorisk receptor, vänster ben",
        role:"Beröring/vibration/proprioception från huden, lederna och musklerna i vänster ben.",
        other:"Samma receptortyper (muskelspolar, Pacini-kroppar, Meissner-kroppar) ger dessutom information som ALDRIG når medvetandet — mycket proprioception används lokalt i ryggmärgsreflexer (t.ex. sträckreflexen) utan att alls passera denna bana upp till cortex."}},
      {x:138,y:500,info:null},
      {x:135,y:300,info:null},
      {x:132,y:248,info:{name:"Nucleus gracilis/cuneatus (förlängda märgen)",
        role:"Första synapsen för HELA bakstranssystemet — och samtidigt platsen där de korsande \"inre bågfibrerna\" (fibrae arcuatae internae) skickar informationen till motsatt sida.",
        other:"Gracilis (ben, mediala delen) och cuneatus (arm, laterala delen) är somatotopiskt organiserade — en punktskada här kan därför drabba benets känsel men skona armens, eller tvärtom."}, decussate:true},
      {x:192,y:258,info:null},
      {x:198,y:180,info:null},
      {x:208,y:118,info:null},
      {x:213,y:88,info:{name:"Thalamus, VPL",
        role:"Sista reläet innan cortex — nucleus ventralis posterolateralis tar emot ALL kroppssensorik (utom ansikte) på väg till gyrus postcentralis.",
        other:"VPL är bara EN av talamus många kärnor — andra kärnor reläar syn (corpus geniculatum laterale), hörsel (mediale) och motorik (VL/VA, från basala ganglierna/cerebellum) till helt andra delar av cortex. En thalamusskada kan därför ge mycket olikartade bortfall beroende på exakt vilken kärna som drabbas."}},
      {x:220,y:66,info:{name:"Sensoriska cortex (gyrus postcentralis)",
        role:"Slutstation — kroppens känsel representeras här enligt samma \"homunkulus\"-princip som motoriska cortex, fast för känsel.",
        other:"Ligger direkt bakom (och är rikt sammankopplad med) motoriska cortex — en tillräckligt stor kortikal lesion (t.ex. stroke) ger därför ofta BÅDE motorisk och sensorisk kontralateral påverkan samtidigt."}}
    ]
  },
  spinothalamic:{
    name:"Smärta/temperatur (spinothalamiska banan)", short:"Smärta", color:"#9C27B0",
    summary:"Smärta och temperatur. Synapsar och korsar REDAN i ryggmärgen, bara 1–2 segment ovanför inträdet — motsatt ände av spektrumet jämfört med DCML, vilket är precis vad som gör syringomyeli och Brown-Séquard-syndrom begripliga.",
    points:[
      {x:148,y:693,info:{name:"Smärt-/temperaturreceptor, vänster ben",
        role:"Fri nervändslut för smärta och temperatur, samma ungefärliga inträdesnivå som känselexemplet ovan — för att göra de två banornas OLIKA vägar jämförbara.",
        other:"Till skillnad från beröring/proprioception (tjocka, snabbt ledande A-beta-fibrer) förs smärta/temperatur av tunna, långsammare A-delta- och C-fibrer — en del av varför smärta känns \"diffusare\" lokaliserad än beröring."}},
      {x:155,y:686,info:{name:"Bakhornet (dorsalhornet)",
        role:"Synaps OCH korsning sker redan här, inom 1–2 ryggmärgssegment — jämför med DCML som inte korsar förrän i förlängda märgen, en skillnad på nästan hela ryggmärgens längd.",
        other:"Det är EXAKT den här nivåskillnaden som förklarar klassiska fynd: vid syringomyeli (central kanalvidgning) drabbas de korsande fibrerna tidigt → \"cape\"-format bortfall av smärta/temp med bevarad beröring; vid Brown-Séquard (halvskada) blir smärta/temp-bortfallet KONTRALATERALT medan svaghet/DCML-bortfall blir IPSILATERALT."}, decussate:true},
      {x:178,y:676,info:null},
      {x:182,y:500,info:null},
      {x:187,y:300,info:null},
      {x:193,y:225,info:null},
      {x:219,y:94,info:{name:"Thalamus, VPL (samma kärna som DCML)",
        role:"Smärt-/temperaturbanan reläas i SAMMA VPL-kärna som beröring/proprioception — de två banorna, som tagit helt olika vägar genom ryggmärgen, möts alltså igen precis innan cortex.",
        other:"Detta är en del av varför en enda liten talamusinfarkt (t.ex. i thalamusperforanter) kan ge ett \"talamiskt syndrom\" med bortfall av ALLA sensoriska modaliteter på motsatt kroppshalva, ibland följt av en svårbehandlad central smärta (talamussmärta/Dejerine-Roussy)."}},
      {x:226,y:72,info:{name:"Sensoriska cortex (samma område)",
        role:"Slutstation, samma gyrus postcentralis som DCML — men signalen når hit via en helt annan väg.",
        other:"Just för att banorna konvergerar igen redan i thalamus, är kortikala skador (till skillnad från ryggmärgsskador) sällan användbara för att skilja de två sensoriska systemen åt kliniskt."}}
    ]
  },
  sympathetic:{
    name:"Sympatisk bana (t.ex. till ögat)", short:"Sympatisk", color:"#FF9800",
    summary:"Tre neuron, HELT okorsad (ipsilateral) hela vägen — vilket är varför ett sympatiskt bortfall (Horner-syndrom) alltid sitter på SAMMA sida som skadan, oavsett var utmed den långa vägen skadan finns.",
    points:[
      {x:122,y:62,info:{name:"Hypothalamus",
        role:"Första (centrala) neuronet i den sympatiska kedjan till ögat — startar en okorsad bana som löper hela vägen genom hjärnstam och ner till bröstryggmärgen.",
        other:"Hypothalamus är den centrala autonoma \"dirigenten\" överlag — reglerar även kroppstemperatur, hunger/mättnad, dygnsrytm och hypofysens hormonutsöndring, helt utanför den här enskilda banan."}},
      {x:127,y:150,info:null},
      {x:131,y:250,info:null},
      {x:134,y:400,info:null},
      {x:137,y:430,info:{name:"Intermediolaterala cellkolonnen (IML), Th1",
        role:"Andra neuronet (preganglionärt) — cellkropparna sitter i sidohornet mellan Th1 och L2, lämnar ryggmärgen via den ventrala roten.",
        other:"Det är den ENDA sympatiska \"på-rampen\" till ögat — en skada var som helst OVANFÖR Th1 (hjärnstam, halsryggmärg) ELLER i själva IML kan ge Horner, vilket gör Horner-syndrom till ett notoriskt ospecifikt men alltid ipsilateralt lokaliserande fynd."}},
      {x:112,y:436,info:null},
      {x:106,y:300,info:null},
      {x:100,y:150,info:null},
      {x:97,y:118,info:{name:"Ganglion cervicale superius",
        role:"Tredje neuronet (postganglionärt) — sista synapsen innan fibrerna följer med halspulsådern upp till ansiktet/ögat.",
        other:"Ligger ytligt på halsen nära karotiskärlen — en karotisdissektion kan klämma av dessa fibrer och orsaka ett SMÄRTSAMT Horner-syndrom, ett viktigt \"får inte missas\"-observandum hos en yngre patient med ny huvudvärk/halssmärta plus ptos/mios."}},
      {x:94,y:76,info:{name:"Ögat (pupilldilatator, Müllers muskel)",
        role:"Slutorgan — bortfall ger den klassiska Horner-triaden: mios (oemotstådd parasympatisk konstriktion), lätt ptos (förlorat sympatiskt bidrag till ögonlocket) och anhidros i ansiktet.",
        other:"Jämför med en isolerad tredjenervspares (parasympatisk skada, se den banan) som ger MOTSATT pupillfynd — DILATERAD, \"utslagen\" pupill i stället för mios. Att kunna skilja dessa åt kliniskt är precis poängen med att se banorna sida vid sida."}}
    ]
  },
  parasympathetic:{
    name:"Sakral parasympatisk bana (bäckenorgan)", short:"Parasympatisk", color:"#4CAF50",
    summary:"Kort, lokal och okorsad — S2–S4 (\"keep the feet, legs and butt off the floor\" är minnesregeln för S2-S3-S4) styr blåsa, tarm och sexualfunktion. Skadenivå avgör om det blir en spastisk ELLER en slapp blåsa/tarm.",
    points:[
      {x:188,y:748,info:{name:"Sakrala parasympatiska kärnan (S2–S4)",
        role:"Preganglionära nervcellskroppar för bäckenorganen — analogt med hjärnstammens kranialnervskärnor (som styr parasympatisk innervation ovanför halsen) fast för nedre delen av kroppen.",
        other:"En skada OVANFÖR denna nivå (t.ex. ryggmärgsskada i halsryggen) lämnar kärnan själv intakt men bryter den viljestyrda kontrollen → en SPASTISK (reflexstyrd, ej viljemässigt kontrollerad) blåsa. En skada AV/UNDER denna nivå (cauda equina-syndrom) ger i stället en SLAPP, atonisk blåsa — samma symtom (urinretention/inkontinens) men helt olika mekanism och prognos."}},
      {x:206,y:752,info:null},
      {x:222,y:762,info:{name:"Bäckenorgan (blåsa, tarm, genitalia)",
        role:"Slutorgan — parasympatisk aktivering ger blåstömning (detrusorkontraktion) och tarmmotilitet; sympatisk aktivering (separat bana, ej ritad här) gör motsatsen och styr utlösning.",
        other:"Ridbyxeanestesi (bortfall av känsel i sadelregionen) plus blås-/tarmpåverkan är de klassiska \"får inte missas\"-varningstecknen för cauda equina-syndrom — en akut kirurgisk diagnos."}}
    ]
  }
};
const TRACT_ORDER=["corticospinal","dcml","spinothalamic","sympathetic","parasympathetic"];

// Basala ganglierna: medvetet INTE en del av någon ritad bana — ett eget hovrbart
// "kontrastexempel" (alltid synligt, oavsett vilket system som är valt) som visar att
// motorik INTE bara är kortikospinalbanan.
const TRACT_BONUS_NODE={
  x:68,y:118,
  name:"Basala ganglierna (striatum/pallidum)",
  role:"INTE en del av den direkta kortikospinala banan — en parallell loop (cortex → striatum → pallidum → thalamus → cortex) som MODULERAR rörelse snarare än att utlösa den.",
  other:"Det är därför en basalgangliesjukdom (Parkinson, Huntington) ger ett HELT ANNAT rörelsemönster än en kortikospinal skada — rigiditet/bradykinesi eller ofrivilliga rörelser i stället för ren svaghet/spasticitet, eftersom det är den modulerande loopen, inte den direkta \"kraftledningen\", som är drabbad."
};
