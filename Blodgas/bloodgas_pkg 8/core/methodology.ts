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
      { name: 'Anjongap', expr: 'AG = Na⁺ − Cl⁻ − HCO₃⁻', note: 'Referens 0–12 mmol/L.' },
      { name: 'Anjongap inklusive kalium', expr: 'AG₍K₎ = Na⁺ + K⁺ − Cl⁻ − HCO₃⁻' },
      { name: 'Albuminkorrigerat anjongap', expr: 'AGalb = AG + 0.25 × (44 − Alb)', note: 'Lägger till ca 2,5 mmol/L per 10 g/L som albumin sjunker från 44.' },
      { name: 'Korrigerat anjongap (fullt)', expr: 'AGc = AG + 0.5 × PO₄ − Lac − 2 × Alb' },
      { name: 'Delta-anjongap', expr: 'ΔAG = AG − 12' },
      { name: 'Extra obalans (delta-delta)', expr: 'ΔΔ = ΔAG + HCO₃⁻', note: 'Jämförs mot 21–27 för att flagga en dold andra metabol process.' },
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
  'Dominerande rubbning: om provet är venöst, lägg till 0,03 på pH och dra bort 0,6 kPa från pCO₂ för att approximera arteriellt. Klassificera utifrån pH: under 7,38 är acidemi, över 7,42 alkalemi, 7,38–7,42 leder vidare till anjongapet. Namnge sedan den primära rubbningen: respiratorisk om pCO₂ driver, metabol om HCO₃⁻/BE gör det.',
  'Kompensation: beräkna det förväntade sekundära svaret för den primära rubbningen. För en metabol rubbning är förväntat ΔpCO₂ = SBE × 0,1 (± 1) kPa. För en respiratorisk är akut SBE ≈ 0 och kronisk SBE ≈ ΔpCO₂ × 3 (± 3). Ett värde utanför det förväntade intervallet betyder en andra, blandad rubbning.',
  'Anjongap: AG = Na⁺ − Cl⁻ − HCO₃⁻. När pCO₂ är under 3,3 eller över 7,3 kPa, använd det faktiska bikarbonatet i stället för standardbikarbonatet. Ett högt gap pekar mot MUDPILERS (kontrollera laktat), ett normalt mot USEDCRAP (hyperkloremiskt), ett lågt/negativt mot LIMB. Sedan avslöjar ΔAG + HCO₃⁻ en dold samtidig metabol rubbning.',
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
      work: 'AG = Na⁺ − Cl⁻ − HCO₃⁻ = 138 − 100 − 8,9 ≈ 29 (ref 0–12). Albumin är normalt (40 g/L), så det albuminkorrigerade gapet (≈ 30) är i stort sett detsamma.',
      result: 'En metabol acidos med högt anjongap (tänk MUDPILERS, här ketosyror och laktat). Korrigering av natrium för det höga glukoset ger Na⁺(korr) ≈ 148, dvs. det sanna natriumet är högre än uppmätt.',
    },
    {
      n: 4,
      title: 'Diagnoser',
      work: 'Ung patient, kräkningar, djup snabb (Kussmaul-) andning, glukos 28 mmol/L, en metabol acidos med högt anjongap och adekvat kompensation.',
      result: 'Bilden stämmer med diabetisk ketoacidos. Kontrollera ketoner och behandla därefter; det förhöjda laktatet och ketosyrorna förklarar tillsammans det förhöjda gapet.',
    },
  ],
  conclusion:
    'Sammantaget: en metabol acidos med högt anjongap och adekvat respiratorisk ' +
    'kompensation, hos en hyperglykem patient, bilden av diabetisk ketoacidos. ' +
    'Varje siffra ovan kom direkt från formlerna, så du kan reproducera ' +
    'analysverktygets utdata för hand och bekräfta den själv.',
};
