// methodology.ts
// Fullständig beskrivning av varje procedur och formel som analysverktyget
// använder, så att en läsare kan reproducera alla resultat för hand. Delas av
// webbens metodsida och appens metodflik. Enheter följer appen (pCO2/pO2 i kPa).

export interface Formula {
  name: string;
  expr: string;      // formeln, klartext
  note?: string;     // när/varför, samt referensintervall
}

export interface MethodSection {
  id: string;
  title: string;
  intro: string;
  formulas: Formula[];
}

export const methodIntro =
  `Varje värde som analysverktyget visar härleds från de siffror du matar in, ` +
  `med formlerna nedan. Inget är dolt eller justerat. Tolkningen följer sedan en ` +
  `fast beslutsgång (beskriven sist). Om du någonsin tvivlar på ett resultat kan ` +
  `du reproducera det för hand utifrån dessa ekvationer.`;

export const methodSections: MethodSection[] = [
  {
    id: 'core',
    title: 'Syra-bas, grund (Henderson-Hasselbalch)',
    intro:
      `Vätejonaktiviteten och bikarbonatet härleds från pH och pCO₂. ` +
      `pCO₂ anges i kPa; faktorn 0,23 omvandlar kPa till den CO₂-löslighetsterm ` +
      `som används i Henderson-Hasselbalchs ekvation.`,
    formulas: [
      { name: 'Vätejonkoncentration', expr: 'H⁺ = 10⁹ × 10^(−pH)', note: 'Resultat i nmol/L. Referens 35–45. Vid pH 7,40 är H⁺ ≈ 40.' },
      { name: 'Bikarbonat (beräknat)', expr: 'HCO₃⁻ = 0.23 × pCO₂ × 10^(pH − 6.1)', note: 'pCO₂ i kPa. Referens 22–27 mmol/L.' },
      { name: 'Basöverskott (beräknat)', expr: 'BE = 0.02786 × (pCO₂ × 7.547) × 10^(pH − 6.1) + 13.77 × pH − 124.58', note: 'pCO₂ omvandlat kPa→mmHg med 7,547. Referens −3 till +3 mmol/L.' },
      { name: 'Albumin-/fosfatkorrigerat standard-BE', expr: 'stBEc = HCO₃⁻ − 24.4 + (8.3 × Alb × 0.15 + 0.29 × PO₄ × 0.32) × (pH − 7.4)', note: 'Albumin i g/L, fosfat i mmol/L.' },
    ],
  },
  {
    id: 'aniongap',
    title: 'Anjongap och dess korrektioner',
    intro:
      `Anjongapet uppskattar omätta anjoner. Det korrigeras för albumin (en viktig ` +
      `omätt anjon) och används, i delta-formerna, för att upptäcka en samtidig ` +
      `metabol rubbning.`,
    formulas: [
      { name: 'Anjongap', expr: 'AG = Na⁺ − Cl⁻ − HCO₃⁻', note: 'Referens 6–12 mmol/L.' },
      { name: 'Anjongap inklusive kalium', expr: 'AG₍K₎ = Na⁺ + K⁺ − Cl⁻ − HCO₃⁻' },
      { name: 'Albuminkorrigerat anjongap', expr: 'AGalb = AG + 0.25 × (44 − Alb)', note: 'Lägger till ca 2,5 mmol/L per 10 g/L som albumin sjunker från 44.' },
      { name: 'Korrigerat anjongap (fullt)', expr: 'AGc = AG + 0.5 × PO₄ − Lac − 2 × Alb' },
      { name: 'Delta-anjongap', expr: 'ΔAG = AG − 12' },
      { name: 'Extra obalans (delta-delta)', expr: 'ΔΔ = ΔAG + HCO₃⁻', note: 'Sekundär (klassisk) metod. > 26 talar för samtidig metabol alkalos, < 22 för hyperkloremisk (NAGMA) acidos.' },
      { name: 'Na–Cl-gap (SWESEM steg 3)', expr: 'Δ(Na−Cl) = (Na⁺ − Cl⁻) − 33', note: 'Stewart-härledd bedside-metod. Ett högt värde talar för metabol alkalos (eller kompenserad respiratorisk acidos), ett lågt för normalt anjongap-acidos (NAGMA), oberoende av anjongapet.' },
      { name: 'Anjongap i urin', expr: 'UAG = u-Na⁺ + u-K⁺ − u-Cl⁻', note: 'Negativt vid gastrointestinal bikarbonatförlust; positivt vid renala orsaker.' },
    ],
  },
  {
    id: 'corrections',
    title: 'Koncentrationskorrektioner',
    intro: `Natrium och klorid korrigeras för de störande effekterna av hyperglykemi och fritt vatten-förskjutningar.`,
    formulas: [
      { name: 'Glukoskorrigerat natrium', expr: 'Na⁺(korr) = Na⁺ + 2.4 × ((Glu − 5.5) / 5.5)', note: 'Glukos i mmol/L.' },
      { name: 'Korrigerat klorid', expr: 'Cl⁻(korr) = Cl⁻ × (140 / Na⁺)' },
    ],
  },
  {
    id: 'respiratory',
    title: 'Syresättning',
    intro: `Inandad syrgasfraktion, alveolo-arteriell differens, syresättningsindex, syreinnehåll och hemoglobinets syreaffinitet.`,
    formulas: [
      { name: 'FiO₂ från syrgastillförsel', expr: 'FiO₂ = 21 + 4 × (L/min O₂)', note: 'Används om inte FiO₂ matas in direkt. Maximeras till 101,3 vid flöden över 19 L/min.' },
      { name: 'Alveolo-arteriell differens', expr: 'A–a = FiO₂ × 0.95 − pCO₂ / 0.8 − pO₂', note: 'kPa. Referens upp till ca 2,7, stiger med åldern.' },
      { name: 'P/F-kvot (Horowitz)', expr: 'P/F = pO₂ / (FiO₂ / 100)', note: 'pO₂ i kPa. Mått på syresättningssvikt; används för ARDS-gradering. Berlin (kPa): mild ≤ 40, måttlig ≤ 27, svår ≤ 13. Kräver arteriellt prov och FiO₂ över 21 %.' },
      { name: 'Arteriellt syreinnehåll (CaO₂)', expr: 'CaO₂ = 1.34 × Hb × SaO₂ + 0.023 × pO₂', note: 'Hb i g/dL (g/L delas med 10), SaO₂ som andel, pO₂ i kPa. Referens ca 16–20 mL O₂/dL. Visar att syreleverans framför allt beror på hemoglobin, inte på pO₂.' },
      { name: 'P50 (Severinghaus, uppskattad)', expr: 'P50 = 26.7 mmHg × (pO₂ / pO₂_standard vid uppmätt SaO₂)', note: 'Det pO₂ där hemoglobinet är 50 % mättat; mått på syreaffinitet. Normalt ca 3,5 kPa (26–27 mmHg). Högt P50 (högerförskjutning: acidos, feber, högt 2,3-DPG) = syret släpps lättare i vävnaden. Lågt P50 (vänsterförskjutning: alkalos, hypotermi, CO, fetalt Hb) = syret hålls hårdare. Uppskattas från uppmätt pO₂/SaO₂ och är känslig nära normala mättnader.' },
    ],
  },
  {
    id: 'stewart',
    title: 'Stewarts fysikalisk-kemiska modell',
    intro:
      `Den starka jondifferensen (skenbar och effektiv) och strong ion gap ` +
      `ger en alternativ, kvantitativ bild av den metabola syra-basbalansen.`,
    formulas: [
      { name: 'Skenbar stark jondifferens', expr: 'SIDa = Na⁺ + K⁺ + 2×Mg²⁺ + 2×Ca²⁺ − Cl⁻', note: 'Referens 38–42 mmol/L.' },
      { name: 'Effektiv stark jondifferens', expr: 'SIDe = HCO₃⁻ + Alb × (0.123 × pH − 0.631) + PO₄ × (0.309 × pH − 0.469)' },
      { name: 'Strong ion gap', expr: 'SIG = SIDa − SIDe', note: 'Referens 0–2 mmol/L; förhöjt av omätta anjoner.' },
    ],
  },
  {
    id: 'osmol',
    title: 'Osmolalitet',
    intro: `Osmolalt gap screenar för omätta osmoler som toxiska alkoholer.`,
    formulas: [
      { name: 'Beräknad osmolalitet', expr: 'Osm(ber) = 2 × Na⁺ + Urea + Glu + 1.25 × Etanol' },
      { name: 'Osmolalt gap', expr: 'Osm-gap = Osm(uppmätt) − Osm(ber)', note: 'Referens 0–10 mosm/kg.' },
      { name: 'Osmolalt gap i urin', expr: 'u-Osm-gap = u-Osm − (2 × Na⁺ + Urea + Glu)' },
    ],
  },
  {
    id: 'deficits',
    title: 'Vätske- och elektrolytbrister',
    intro:
      `Brister utgår från totalt kroppsvatten, uppskattat från vikt och en ` +
      `könskonstant (0,6 för män, 0,5 för kvinnor).`,
    formulas: [
      { name: 'Fritt vattenunderskott (när Na⁺ > 140)', expr: 'H₂O-brist = 1000 × k × vikt × (Na⁺/140 − 1)', note: 'k = 0,6 (man) eller 0,5 (kvinna); resultat i mL.' },
      { name: 'Natriumbrist (när Na⁺ < 140)', expr: 'Na-brist = k × vikt × (140 − Na⁺)' },
      { name: 'Kaliumbrist (när K⁺ < 4)', expr: 'K-brist = 0.4 × vikt × (4 − K⁺)' },
    ],
  },
  {
    id: 'compensation',
    title: 'Förväntad kompensation',
    intro:
      `När en primär rubbning identifierats beräknas det förväntade ` +
      `kompensatoriska svaret. Standardmetoden använder basöverskott; en metod ` +
      `baserad på pCO₂/HCO₃ finns också. 5,3 kPa och 24 mmol/L är normalt pCO₂ och HCO₃⁻.`,
    formulas: [
      { name: 'BE, respiratorisk kompensation', expr: 'Förväntat ΔBE = 3 × (pCO₂ − 5.3)' },
      { name: 'BE, metabol acidos → förväntat pCO₂', expr: 'Förväntat pCO₂ = 5.3 + 0.13 × BE' },
      { name: 'BE, metabol alkalos → förväntat pCO₂', expr: 'Förväntat pCO₂ = 5.3 + 0.08 × BE' },
      { name: 'pCO₂/HCO₃, resp. acidos → förväntat HCO₃⁻', expr: 'Akut: 24 + 0.75×(pCO₂−5.3); Kronisk: 24 + 2.62×(pCO₂−5.3)' },
      { name: 'pCO₂/HCO₃, resp. alkalos → förväntat HCO₃⁻', expr: 'Akut: 24 + 1.5×(pCO₂−5.3); Kronisk: 24 + 3.0×(pCO₂−5.3)' },
      { name: 'pCO₂/HCO₃, metabol acidos → förväntat pCO₂', expr: 'Förväntat pCO₂ = 5.3 + 0.17 × (HCO₃⁻ − 24)' },
      { name: 'pCO₂/HCO₃, metabol alkalos → förväntat pCO₂', expr: 'Förväntat pCO₂ = 5.3 + 0.08 × (HCO₃⁻ − 24)' },
    ],
  },
];

export const algorithmSteps: string[] = [
  'Dominerande rubbning: om provet är venöst, lägg till 0,03 på pH och dra bort 0,6 kPa från pCO₂ för att approximera arteriellt. Klassificera utifrån pH: under 7,35 är acidemi, över 7,45 alkalemi, 7,35–7,45 leder vidare till anjongapet. Namnge sedan den primära rubbningen: respiratorisk om pCO₂ driver, metabol om HCO₃⁻/BE gör det.',
  'Kompensation: beräkna det förväntade sekundära svaret för den primära rubbningen. För en metabol rubbning är förväntat ΔpCO₂ = SBE × 0,1 (± 1) kPa. För en respiratorisk är akut SBE ≈ 0 och kronisk SBE ≈ ΔpCO₂ × 3 (± 3). Ett värde utanför det förväntade intervallet betyder en andra, blandad rubbning.',
  'Anjongap: AG = Na⁺ − Cl⁻ − HCO₃⁻. När pCO₂ är under 3,3 eller över 7,3 kPa, använd det faktiska bikarbonatet i stället för standardbikarbonatet. Ett högt gap pekar mot MUDPILERS (kontrollera laktat), ett normalt mot USEDCRAP (hyperkloremiskt), ett lågt/negativt mot LIMB.',
  'Dolda rubbningar: använd i första hand Na–Cl-gapet, Δ(Na−Cl) = (Na⁺ − Cl⁻) − 33 (normalt cirka 33). Det är en Stewart-härledd metod som fångar en samtidig metabol rubbning oberoende av anjongapet: ett ökat gap talar för en metabol alkalos (eller kompensation till en kronisk respiratorisk acidos), ett minskat gap för en hyperkloremisk metabol acidos (NAGMA). Som klassiskt alternativ kan delta-delta användas: ΔAG + HCO₃⁻ över 26 talar för en samtidig metabol alkalos, under 22 för en hyperkloremisk acidos (NAGMA).',
  'Diagnoser: väv in siffrorna i den kliniska bilden, integrera anamnes, status och övriga prover (laktat, glukos, kreatinin). Om ett förhöjt laktat förklarar hela ΔAG är andra omätta anjoner mindre sannolika.',
];

// ---- Räkneexempel ----
// Ett komplett fall genomräknat steg för steg så att läsaren kan följa varje
// steg för hand. Siffrorna är de exakta utdata från motorn för indata nedan.

export interface WorkedStep {
  n: number;
  title: string;
  work: string;   // beräkningen med insatta siffror
  result: string; // svaret samt hur det ska läsas
}

export interface WorkedExample {
  scenario: string;
  inputs: { label: string; value: string }[];
  steps: WorkedStep[];
  conclusion: string;
}

export const workedExample: WorkedExample = {
  scenario:
    'En 24-åring med kräkningar, djup snabb andning och ett glukos på 28 mmol/L. ' +
    'Den arteriella blodgasen nedan matas in. Vi räknar igenom den för hand.',
  inputs: [
    { label: 'Provtyp', value: 'Arteriellt' },
    { label: 'pH', value: '7.21' },
    { label: 'pCO₂', value: '3.0 kPa' },
    { label: 'HCO₃⁻', value: '9 mmol/L' },
    { label: 'BE', value: '−16 mmol/L' },
    { label: 'Na⁺', value: '138 mmol/L' },
    { label: 'Cl⁻', value: '100 mmol/L' },
    { label: 'K⁺', value: '5.4 mmol/L' },
    { label: 'Glukos', value: '28 mmol/L' },
    { label: 'Albumin', value: '40 g/L' },
  ],
  steps: [
    {
      n: 1,
      title: 'Dominerande rubbning',
      work: 'Arteriellt prov, så ingen venös korrektion. Arteriellt pH-referens är 7,35–7,45; uppmätt pH = 7,21 ger acidemi. pCO₂ = 3,0 kPa (ref 4,6–6,0) är lågt och HCO₃⁻ = 9 (ref 22–27) är lågt. Vid en acidemi är det låga HCO₃⁻ acidosen; det låga pCO₂ är lungorna som vädrar ut CO₂.',
      result: 'Primär rubbning: en metabol acidos. Det låga pCO₂ är den respiratoriska kompensationen, inte en andra primär rubbning. (Kontroll: H⁺ ≈ 62 nmol/L, förhöjt; beräknat HCO₃⁻ från Henderson-Hasselbalch ≈ 8,9, vilket bekräftar det låga bikarbonatet.)',
    },
    {
      n: 2,
      title: 'Kompensation',
      work: 'Förväntat pCO₂ för en metabol acidos (basöverskottsmetoden) = 5,3 + 0,13 × BE = 5,3 + 0,13 × (−16) = 5,3 − 2,08.',
      result: 'Förväntat pCO₂ ≈ 3,2 kPa; uppmätt är 3,0 kPa. De två stämmer överens, så den respiratoriska kompensationen är adekvat, ingen ytterligare respiratorisk rubbning.',
    },
    {
      n: 3,
      title: 'Anjongap',
      work: 'AG = Na⁺ − Cl⁻ − HCO₃⁻ = 138 − 100 − 8,9 ≈ 29 (ref 6–12). Albumin är normalt (40 g/L), så det albuminkorrigerade gapet (≈ 30) är i stort sett detsamma.',
      result: 'En metabol acidos med högt anjongap (tänk MUDPILERS, här ketosyror och laktat). Korrigering av natrium för det höga glukoset ger Na⁺(korr) ≈ 148, dvs. det sanna natriumet är högre än uppmätt.',
    },
    {
      n: 4,
      title: 'Dolda rubbningar',
      work: 'Na–Cl-gap = Na⁺ − Cl⁻ − 33 = 138 − 100 − 33 = +5 (normalt cirka 0). Ett ökat Na–Cl-gap talar för en samtidig metabol alkalos. Som klassisk kontroll: delta-delta = ΔAG + HCO₃⁻ = (29 − 12) + 8,9 ≈ 25,9.',
      result: 'Na–Cl-gapet pekar på en dold metabol alkalos, rimligen från kräkningarna, ovanpå ketoacidosen. Delta-delta ligger nätt och jämnt inom 22–26 och missar den nästan; det illustrerar varför Na–Cl-gapet kan vara känsligare för en samtidig alkalos.',
    },
    {
      n: 5,
      title: 'Diagnoser',
      work: 'Ung patient, kräkningar, djup snabb (Kussmaul-) andning, glukos 28 mmol/L, en metabol acidos med högt anjongap, adekvat kompensation och tecken på en samtidig metabol alkalos.',
      result: 'Bilden stämmer med diabetisk ketoacidos med en samtidig kräkningsutlöst metabol alkalos. Kontrollera ketoner och behandla därefter; ketosyror (och eventuellt laktat) förklarar det förhöjda gapet, medan kräkningarna förklarar det ökade Na–Cl-gapet.',
    },
  ],
  conclusion:
    'Sammantaget: en metabol acidos med högt anjongap och adekvat respiratorisk ' +
    'kompensation, hos en hyperglykem patient, bilden av diabetisk ketoacidos. ' +
    'Varje siffra ovan kom direkt från formlerna, så du kan reproducera ' +
    'analysverktygets utdata för hand och bekräfta den själv.',
};

// --- Educational primer (rendered above "Så beräknas resultaten") ---
export interface EduSection { heading: string; paragraphs: string[]; }

export const eduSections: EduSection[] = [
  {
    heading: 'pH och varför kroppen vaktar det så hårt',
    paragraphs: [
      'pH är ett mått på koncentrationen av vätejoner. Skalan är logaritmisk, så en liten förändring i siffra är en stor förändring i vätejonkoncentration. Normalt arteriellt pH ligger i ett smalt intervall, 7,35 till 7,45. Anledningen till att kroppen håller det så snävt är att nästan alla enzymer, jonkanaler och proteiner är formade för att fungera vid just denna surhetsgrad. När pH glider iväg ändrar proteinerna form och funktion, och flera organsystem påverkas samtidigt.',
      'Hjärtat är särskilt känsligt. Vid acidemi minskar myokardiets kontraktilitet och kärlen svarar sämre på katekolaminer, vilket kan ge hypotoni som är svår att häva trots vätska och pressorer. Acidemi sänker dessutom tröskeln för allvarliga arytmier och driver kalium ut ur cellerna, så att en hyperkalemi kan tillkomma och ytterligare destabilisera hjärtat. Alkalemi drar i stället kalium in i cellerna och sänker fritt kalcium, vilket kan ge arytmier, parestesier och i uttalade fall kramper.',
      'Surhetsgraden påverkar även syretransport och koagulation. Vid acidos förskjuts hemoglobinets dissociationskurva så att syre lättare lämnar blodet till vävnaden, men vid uttalad acidos hämmas i stället koagulationen: koagulationsenzymerna arbetar långsammare och trombocyterna fungerar sämre, vilket bidrar till den farliga triaden av acidos, hypotermi och koagulopati hos svårt sjuka. Att korrigera grundorsaken till en acidos är därför inte bara en fråga om en siffra, utan om cirkulation, rytm och blödningsbenägenhet på samma gång.',
    ],
  },
  {
    heading: 'Vad en rubbning är',
    paragraphs: [
      'Surhetsgraden bestäms av balansen mellan en sur och en basisk komponent. Den sura komponenten är koldioxid (pCO2), som styrs av andningen och kallas den respiratoriska delen. Den basiska komponenten är bikarbonat (HCO3-) tillsammans med basöverskottet (BE), som styrs av njurar och ämnesomsättning och kallas den metabola delen.',
      'En rubbning innebär att en av dessa komponenter har förändrats primärt. Stiger pCO2 blir blodet surare (respiratorisk acidos); sjunker det blir blodet basiskt (respiratorisk alkalos). Sjunker bikarbonatet blir blodet surare (metabol acidos); stiger det blir det basiskt (metabol alkalos). Den primära rubbningen är den som driver pH i den riktning det faktiskt har rört sig.',
    ],
  },
  {
    heading: 'Hur kroppen kompenserar',
    paragraphs: [
      'Kroppen försöker alltid föra pH tillbaka mot det normala genom att låta den andra komponenten röra sig åt samma håll som den primära. Detta är kompensation, och den normaliserar aldrig pH helt, bara dämpar utslaget. Vid en respiratorisk acidos (högt pCO2, lågt pH) höjer njurarna alltså bikarbonatet; vid en metabol acidos (lågt bikarbonat) ökar andningen och sänker pCO2. Det ger en användbar ledtråd: vid en ren rubbning pekar pCO2 och bikarbonat åt samma håll, och pekar de åt var sitt håll finns det två processer samtidigt.',
      'Vid en metabol rubbning svarar andningen snabbt. Vid en metabol acidos ökar andningen för att vädra ut koldioxid och mildra surheten (Kussmauls andning är det tydligaste exemplet); vid en metabol alkalos sänks andningen något. Detta respiratoriska svar inträder inom minuter till timmar.',
      'Vid en respiratorisk rubbning svarar njurarna i stället, men långsamt. De justerar hur mycket bikarbonat som behålls eller utsöndras, en process som tar ett till flera dygn att bli fullständig. Därför skiljer man på en akut respiratorisk rubbning, där njursvaret ännu inte hunnit komma, och en kronisk, där bikarbonatet hunnit anpassa sig. Att jämföra det uppmätta sekundära svaret med det förväntade visar om kompensationen är adekvat eller om något mer pågår.',
    ],
  },
  {
    heading: 'Anjongapet och elektroneutralitet',
    paragraphs: [
      'Blodet är elektriskt neutralt: summan av alla positiva joner (katjoner) måste vara exakt lika stor som summan av alla negativa joner (anjoner). Vi mäter dock inte alla joner i rutinprov. Anjongapet är skillnaden mellan den största uppmätta katjonen (natrium) och de två största uppmätta anjonerna (klorid och bikarbonat), och det representerar de anjoner vi inte mäter direkt, till exempel albumin, fosfat, sulfat och eventuella patologiska syror.',
      '__FIGURE__',
      'Poängen är klinisk. När en patologisk syra ansamlas, till exempel laktat vid chock eller ketosyror vid diabetes, förbrukas bikarbonat samtidigt som syrans egen anjon läggs till bland de omätta. Bikarbonatpelaren krymper och gapet växer i motsvarande grad. Ett förhöjt anjongap pekar därför direkt mot en grupp av specifika orsaker. Är gapet normalt trots acidos har bikarbonat i stället bytts mot klorid, vilket pekar mot en annan grupp orsaker. Eftersom albumin utgör en stor del av de omätta anjonerna måste gapet korrigeras för lågt albumin, annars kan ett verkligt förhöjt gap maskeras.',
    ],
  },
  {
    heading: 'Dolda rubbningar och varför de förändrar handläggningen',
    paragraphs: [
      'pH och bikarbonat visar bara nettoresultatet. Två rubbningar som drar åt motsatt håll kan delvis dölja varandra och ge ett pH som ser nästan normalt ut, trots att patienten har två allvarliga processer samtidigt. En patient kan till exempel ha både en metabol acidos av laktat och en metabol alkalos av kräkningar; nettot kan bli ett oskyldigt pH som missar båda.',
      'Det är därför delta-delta och Na-Cl-gapet finns. Genom att jämföra hur mycket anjongapet har ökat med hur mycket bikarbonatet har minskat avslöjas en andra, samtidig metabol process som annars göms i nettosiffran. Att hitta den dolda rubbningen ändrar handläggningen i grunden: den pekar mot en andra diagnos som annars förblir obehandlad, och den varnar för att en till synes lugn blodgas i själva verket rymmer två sjukdomsprocesser som var och en kan behöva sin egen åtgärd.',
    ],
  },
];

export const eduCaption =
  'Två pelare av lika höjd, eftersom blodet är neutralt. Natrium dominerar ' +
  'katjonsidan; klorid och bikarbonat den mätbara anjonsidan. Skillnaden upp ' +
  'till natriumnivån är anjongapet, de omätta anjonerna.';

// --- Stewart's approach (collapsible section in the Method tab) ---
export interface StewartExampleStep { label: string; work: string; result: string; }
export interface StewartContent {
  intro: string;
  paragraphs: string[];
  example: {
    scenario: string;
    inputs: { label: string; value: string }[];
    steps: StewartExampleStep[];
    conclusion: string;
  };
}

export const stewartContent: StewartContent = {
  intro:
    'Stewarts metod (the strong ion approach) ser på syra-basbalansen utifrån ' +
    'fysikalisk kemi i stället för bikarbonat. Den förklarar varför pH ändras, ' +
    'medan den traditionella metoden beskriver att det ändras.',
  paragraphs: [
    'Grundtanken är att pH och bikarbonat är beroende variabler. De bestäms av tre oberoende storheter: pCO2, mängden svaga syror (framför allt albumin och fosfat), och differensen mellan starka katjoner och starka anjoner. Starka joner är de som är fullständigt dissocierade i plasma, framför allt natrium, kalium, kalcium, magnesium, klorid och laktat.',
    'Skillnaden mellan summan av de starka katjonerna och de starka anjonerna kallas strong ion difference (SID). Den beräknas på två sätt. SIDa (apparent) summerar de uppmätta starka jonerna: Na + K + 2·Ca + 2·Mg − Cl. SIDe (effektiv) räknas i stället ut från bikarbonat och de svaga syrorna och speglar den laddning som faktiskt balanseras av kända komponenter.',
    'Skillnaden mellan dem, strong ion gap (SIG = SIDa − SIDe), representerar omätta starka anjoner, till exempel ketoner, sulfat eller toxiner. Ett förhöjt SIG betyder att det finns en syra som varken är klorid eller en svag syra, på samma sätt som ett förhöjt anjongap gör, men SIG är mindre känsligt för albumin eftersom albumin redan är inräknat i SIDe.',
    'Det praktiska värdet är störst när albumin är onormalt. Eftersom albumin är en svag syra som bidrar till SIDe, korrigerar Stewart automatiskt för hypoalbuminemi, något som det klassiska anjongapet missar om man inte räknar om det för hand. Hos en kritiskt sjuk patient med lågt albumin kan en betydande metabol acidos döljas på anjongapet men framträda tydligt i Stewart-bilden.',
    'Tolkningen följer tre frågor. Är SIDa lågt? Då talar det för en metabol acidos orsakad av starka joner (hyperkloremi eller natriumbrist). Är SIDa högt? Då en metabol alkalos. Är SIG förhöjt? Då finns omätta anjoner, oavsett vad anjongapet visar. Notera att absolutvärdet för SIG är beroende av vilka koefficienter man använder, så det tolkas bäst tillsammans med uppmätt laktat.',
  ],
  example: {
    scenario:
      'En patient med stor diarré och ett lågt bikarbonat. Vi vill veta om ' +
      'acidosen drivs av starka joner eller av omätta anjoner.',
    inputs: [
      { label: 'pH', value: '7.30' },
      { label: 'HCO₃⁻', value: '17 mmol/L' },
      { label: 'Na⁺', value: '140 mmol/L' },
      { label: 'Cl⁻', value: '115 mmol/L' },
      { label: 'K⁺', value: '4.0 mmol/L' },
      { label: 'Ca²⁺ (jon.)', value: '1.20 mmol/L' },
      { label: 'Mg²⁺', value: '0.85 mmol/L' },
      { label: 'Albumin', value: '40 g/L' },
      { label: 'Fosfat', value: '1.1 mmol/L' },
    ],
    steps: [
      {
        label: 'SIDa (apparent)',
        work: 'SIDa = Na⁺ + K⁺ + 2·Ca²⁺ + 2·Mg²⁺ − Cl⁻ = 140 + 4,0 + 2·1,20 + 2·0,85 − 115.',
        result: 'SIDa ≈ 33 mmol/L. Det är lågt (normalt cirka 40), vilket pekar mot en metabol acidos orsakad av starka joner, här den höga kloridnivån.',
      },
      {
        label: 'SIDe (effektiv)',
        work: 'SIDe = HCO₃⁻ + albumin·(0,123·pH − 0,631) + fosfat·(0,309·pH − 0,469), med pH 7,30.',
        result: 'SIDe ≈ 30 mmol/L. Den speglar den laddning som balanseras av bikarbonat och de svaga syrorna.',
      },
      {
        label: 'SIG (strong ion gap)',
        work: 'SIG = SIDa − SIDe = 33 − 30.',
        result: 'SIG ≈ 3 mmol/L, alltså inte förhöjt. Det betyder att det inte finns några betydande omätta anjoner.',
      },
    ],
    conclusion:
      'Tolkning: en metabol acidos med lågt SIDa men normalt SIG. Acidosen ' +
      'drivs av den höga kloriden (en stark jon), inte av en omätt syra. Det ' +
      'är en hyperkloremisk metabol acidos (NAGMA), helt i linje med en ' +
      'diarréförlust av bikarbonat, och samma slutsats som ett normalt ' +
      'anjongap och ett sänkt Na–Cl-gap skulle ge.',
  },
};
