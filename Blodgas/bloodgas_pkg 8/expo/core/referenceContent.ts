// referenceContent.ts
// Differential-diagnosis reference for the "Consider" tab.
// Body text is from the original app (strings.xml CDATA blocks), with translation
// artifacts cleaned up and clinical language tightened. Light HTML (<b>, <br>).

export interface MnemonicItem { letter: string; title: string; body: string; sources?: string; }
export interface MnemonicGroup { id: string; category: string; mnemonic: string; subtitle?: string; items: MnemonicItem[]; }

export const referenceGroups: MnemonicGroup[] = [
  {
    id: "hagma", category: "Metabol acidos", mnemonic: "MUDPILERS", subtitle: "Metabol acidos med högt anjongap",
    items: [
      { letter: "M", title: "Methanol",
        body: `<b>Allmänt:</b> <br> Metanol metaboliseras till formaldehyd och därefter myrsyra, som är neurotoxisk.
Myrsyra är negativt laddad och bidrar till anjongapet.
<br>
<b>Symtom:</b> <br> Somnolens, koma, synpåverkan. Anamnes på intag av spolarvätska eller sprit av oklart ursprung stärker misstanken.
<br>
<b>Utredning:</b> <br>
Beräkna det osmolala gapet.
Tidigt gör metanol att det osmolala gapet stiger.
Senare normaliseras det osmolala gapet när metanol omvandlas till myrsyra, som i stället höjer anjongapet.
<br>
<b>Behandling:</b> <br>
Etanol och fomepizol hämmar omvandlingen till de toxiska metaboliterna, och metaboliterna kan avlägsnas med hemodialys. Halveringstiden är lång, så handläggningen kan behöva pågå över tid. Kontakta Giftinformationscentralen tidigt för dosering.` },
      { letter: "U", title: "Uraemia",
        body: `<b>Allmänt:</b> <br>
Njursvikt orsakar ansamling av fosfat, sulfat och urat. Resultatet är ett ökat anjongap.
Prerenala, renala och postrenala orsaker bör eftersökas.
<br>
<b>Symtom:</b> <br>
Illamående, kräkningar, minskad urinproduktion.
<br>
<b>Utredning:</b> <br>
Behandla hyperkalemi.
Mät kreatinin och GFR. Bladderscan och ultraljud av njurar för bedömning av hydronefros och postrenal komponent. Överväg rabdomyolys som orsak till akut njursvikt.
<br>
<b>Behandling:</b> <br>
Vätskebolus för att häva en prerenal komponent. Kateter för att avlasta ett postrenalt hinder och för att mäta urinproduktion. Dialys kan behövas vid svår njursvikt.`,
        sources: `Medicinsk Kompendium bind 2 <br> 17 edition <br> pp. 1956 <br> Ove B. Schaffalitzky de Muckadell et al` },
      { letter: "D", title: "Diabetic Ketoacidosis",
        body: `<b>Allmänt:</b> <br>
Diabetisk ketoacidos är slutresultatet av insulinbrist. När glukos i praktiken stängs ute från cellerna stiger blodglukoset. Kroppen ställer om till oxidation av fettsyror för energi.
Detta leder till produktion av ketoner: aceton, hydroxibutyrat och acetoacetat. Det är dessa ketoner som höjer anjongapet.
<br>
<b>Symtom:</b> <br>
Dehydrering, takykardi, buksmärta, kräkningar, somnolens, acetondoft.
<br>
<b>Utredning:</b> <br>
Urin-/blodprov för att mäta ketonhalt.
Misstänk underliggande sjukdom, t.ex. infektion, pankreatit eller hjärtinfarkt.
<br>
<b>Behandling:</b> <br>
Vätska är central eftersom patienterna ofta förlorat flera liter genom osmotisk diures. Insulin och korrigering av elektrolyter (särskilt kalium, som faller när insulin ges) styrs enligt lokalt vårdprogram. Dessa patienter behöver ofta intensivvård, och underliggande utlösande orsak bör eftersökas.`,
        sources: `ABC om Ketoacidos vid diabetes hos vuxna <br> Katarina Fagher, Anders Nilsson, Magnus Löndahl <br> Läkartidningen. 2013. 110: CHDI` },
      { letter: "P", title: "Paracetamol",
        body: `<b>Allmänt:</b> <br>
Paracetamol metaboliseras till 5-oxoprolin, vilket kan öka anjongapet.
Detta ses främst vid kroniskt paracetamolbruk.
Patienter med paracetamolöverdos har ofta normalt anjongap.
<br>
<b>Symtom:</b> <br>
Illamående, buksmärta, ikterus
<br>
<b>Utredning:</b> <br>
s-paracetamol och leverenzymer.
<br>
<b>Behandling:</b> <br>
Intravenöst acetylcystein kan behöva ges under längre tid för att förhindra
ytterligare omvandling av paracetamol till toxiska metaboliter.`,
        sources: `Swedish Poison Control Centre <br> https://giftinformation.se/lakare/substanser/paracetamol <br> Acetaminophen-induced anion gap metabolic acidosis and 5-oxoprolinuria (pyroglutamic aciduria) acquired in hospital. <br> Humphreys BD et al <br> Am J Kidney Dis. 2005 Jul; 46 (1): 143-6` },
      { letter: "I", title: "Isoniazid",
        body: `<b>Allmänt:</b> <br>
Isoniazid är ett antibiotikum som används vid behandling av tuberkulos.
Vid akut överdos förbrukas kroppens depåer av pyridoxin (vitamin B6).
GABA, den viktigaste hämmande signalsubstansen, kräver B6 för att bildas. Brist på GABA leder till svåra kramper.
Det ökade anjongapet uppstår sekundärt till laktatet som bildas av kramperna.
<br>
<b>Symtom:</b> <br>
Sänkt medvetande och svåra kramper. Anamnesen med känd tuberkulosbehandling är ofta avgörande för misstanken.
<br>
<b>Utredning:</b> <br>
Diagnosen bygger främst på anamnesen. Det förhöjda laktatet speglar kramperna snarare än en separat förgiftning.
<br>
<b>Behandling:</b> <br>
Tillståndet har en specifik antidot (pyridoxin), och kramperna är ofta refraktära mot sedvanlig krampbehandling. Kontakta Giftinformationscentralen tidigt för dosering och handläggning.`,
        sources: `Swedish Poison Control Centre <br> https://giftinformation.se/lakare/substanser/isoniazid/` },
      { letter: "L", title: "Lactate",
        body: `<b>Allmänt:</b> <br>
Förhöjt laktat är den vanligaste orsaken till ökat anjongap.
Förhöjt laktat ses ofta vid sepsis och kramper. Leversvikt, överdoser och vaskulära katastrofer. Se specifik information om laktat i dess egen flik.
<br>
<b>Symtom:</b> <br>
Beror på orsaken till laktatförhöjningen.
<br>
<b>Utredning:</b> <br>
S-laktat kan vara värdefullt i fall där falskt förhöjt laktat ses på blodgasen.
Detta ses vid etylenglykolförgiftning.
<br>
<b>Behandling:</b> <br>
Beror på underliggande orsak.` },
      { letter: "E", title: "Ethylene Glycol",
        body: `<b>Allmänt:</b> <br>
Etylenglykol metaboliseras till glykolat och oxalat inom 4–12 h.
Dessa metaboliter höjer anjongapet och leder till svår acidos, hypokalcemi och njursvikt.
<br>
<b>Symtom:</b> <br>
Liknar andra alkoholförgiftningar. Agitation är det första symtomet. Senare ses sänkt medvetande och koma.
<br>
<b>Utredning:</b> <br>
s-etylenglykol.
Beräkna det osmolala gapet.
Tidigt stiger det osmolala gapet på grund av etylenglykol.
Senare normaliseras det osmolala gapet när etylenglykol omvandlas till glykolat och oxalat, som i stället höjer anjongapet.
Laktat kan vara falskt förhöjt. Det beror på att glykolat liknar laktat,
och vissa blodgasapparater rapporterar därför ett kraftigt förhöjt laktat.
Vid misstanke, mät s-laktat och jämför de två.
<br>
<b>Behandling:</b> <br>
Liknar behandlingen av metanolförgiftning.
Hemodialys filtrerar effektivt bort metaboliterna.
Etanol och fomepizol hämmar omvandlingen av etylenglykol till dess metaboliter.`,
        sources: `Swedish Poison Control Centre <br> https://giftinformation.se/lakare/substanser/etylenglykol` },
      { letter: "R", title: "Rhabdomyolysis",
        body: `<b>Allmänt:</b> <br>
Rabdomyolys är ett tecken på vävnadsskada. Missbrukare och äldre som legat länge på ett hårt underlag utvecklar ofta rabdomyolys.
Detta leder ofta till njursvikt, även om den exakta mekanismen inte är helt klarlagd. Direkt nefrotoxicitet och tilltäppning av njurtubuli är tilltalande hypoteser.
Prerenal svikt på grund av ödembildning kring skadade muskler är en annan teori.
<br>
Det förhöjda anjongapet orsakas av njursvikt och negativt laddat myoglobin.
<br>
<b>Symtom:</b> <br>
Beror på orsaken. Muskelsmärta på grund av nekros. Sjunkande urinmängd.
<br>
<b>Utredning:</b>
<br>
s-myoglobin och kreatinkinas (CK).
<br>
Kontrollera kreatinin regelbundet.
<br>
<b>Behandling:</b>
<br>
Stora mängder vätska krävs för att upprätthålla diures, vilket häver den
prerenala komponenten. Myoglobin utsöndras snabbare, vilket förbättrar njurfunktionen.`,
        sources: `Rhabdomyolysis and acute kidney injury <br> Xavier Bosch et al <br> N Engl J With 2009; 361: 62-72` },
      { letter: "S", title: "Salicylates",
        body: `<b>Allmänt:</b> <br>
Acetylsalicylsyra används både som smärtstillande och trombocythämmande behandling.
Förgiftning ger hos vuxna ett ökat anjongap på grund av salicylatjoner och en respiratorisk alkalos på grund av effekten på andningscentra i hjärnstammen.
<br>
<b>Symtom:</b> <br>
Takypné, tinnitus, feber, kramper, koma, ARDS.
<br>
<b>Utredning:</b> <br>
s-salicylat
<br>
<b>Behandling:</b> <br>
Upprepade doser aktivt kol.
Generös intravenös vätska.
Alkalinisering ökar den renala utsöndringen och håller salicylat i oladdad form. Det hindrar substansen från att nå centrala nervsystemet.
Hemodialys kan övervägas i svåra fall.`,
        sources: `Swedish Poison Control Centre <br> https://giftinformation.se/lakare/substanser/salicylat/` },
    ],
  },
  {
    id: "nagma", category: "Metabol acidos", mnemonic: "USEDCRAP", subtitle: "Metabol acidos med normalt anjongap (hyperkloremisk)",
    items: [
      { letter: "U", title: "Ureterostomy",
        body: `<b>Allmänt:</b> <br> Urin innehåller höga koncentrationer av klorid.
När urinen leds om till tarmen sker ett komplext jonutbyte som resulterar i en relativ eller absolut hyperkloremisk acidos.
Beroende på vilket tarmsegment som används kan även hyponatremi, hypokalemi, hyperkalcemi och hypokalcemi ses.
I vissa fall ses faktiskt hypokloremi, och då är det viktigt att hålla i minnet att en ännu uttalad hyponatremi
leder till relativ hyperkloremisk acidos.
<br><br>
<b>Symtom:</b> <br> Trötthet, muskelsvaghet, kramper, diarré.
<br><br>
<b>Utredning:</b> <br> Anjongap i urin eller osmolalt gap i urin kan avgöra om den hyperkloremiska
acidosen orsakas av gastrointestinal eller renal sjukdom.
<br><br>
<b>Behandling:</b> <br>
Långtidsbehandling med peroralt natriumbikarbonat kan behövas för att motverka acidosen.
Kolestyramin kan användas mot diarré.
Urologisk och nefrologisk konsultation kan behövas.`,
        sources: `Metabolic complications of urinary intestinal diversion. <br> Vasdev N, Moon A, Thorpe AC. <br> Indian Journal of Urology : IJU : Journal of the Urological Society of India. 2013. 29 (4): 310-315. doi: 10.4103 / 0970-1591.120112.` },
      { letter: "S", title: "Small Bowel Fistula",
        body: `<b>Allmänt:</b> <br> Normalt utsöndras större mängder basisk vätska från Brunners körtlar i duodenum.
Syftet är att neutralisera den sura magsaften och skapa en optimal miljö för pankreasenzymerna.
Vid fistelbildning kan denna vätska inte återresorberas, vilket leder till förlust av baser från blodbanan.
<br><br>
<b>Symtom:</b> <br>
Buksmärta, illamående, viktnedgång.
<br><br>
<b>Utredning:</b> <br>
DT buk med kontrast kan ofta visualisera fistlarna.
<br><br>
<b>Behandling:</b> <br>
Bör diskuteras med kirurg för eventuell operativ åtgärd.`,
        sources: `Fluid and electrolyte disturbances in patients with long established ileostomies <br><br>ND Gallagher,DD Harrison, AP Skyring <br><br>Gut 1962; 3: 219-223` },
      { letter: "E", title: "Extra Chloride",
        body: `<b>Allmänt:</b> <br> Intravenös natriumklorid innehåller högre kloridhalt än vad som ses i blodbanan.
Stora mängder intravenös NaCl ökar därför kloridkoncentrationen i blodet, vilket ger hyperkloremisk acidos.
Även ökat peroralt intag av klorid ger acidos. <br><br> <b>Symtom:</b> <br> Beror på sammanhanget där det höga intaget skett.
<br><br> <b>Utredning:</b> <br> Vanligtvis krävs ingen specifik utredning utöver att identifiera källan. <br><br> <b>Behandling:</b> <br>Förhindra fortsatt kloridintag.
Vid ökat vätskebehov, ge balanserade vätskor med lägre kloridhalt, t.ex. Ringer-acetat.` },
      { letter: "D", title: "Diarrhea",
        body: `<b>Allmänt:</b> <br> Kraftig diarré leder vanligen till metabol acidos på grund av relativt stora förluster av natrium och kalium. Samtidig dehydrering, med åtföljande metabol alkalos, kan dock motverka utvecklingen av acidos. Acidos ses därför ofta hos patienter som ersatt vätskeförlusten men inte saltförlusten. <br><br> <b>Symtom:</b> <br> Dehydrering. Feber och buksmärta vid infektiösa orsaker. Hypovolemisk chock och sänkt medvetande vid uttalad vätskeförlust.<br><br> <b>Utredning:</b> <br>
Infektioner, faecesodlingar.
<br><br>
<b>Behandling:</b> <br>
Rehydrering med balanserade vätskor, till exempel Ringer-acetat. Målet är att ersätta vätske- och saltförlusterna.`,
        sources: `Acid-Base Disturbances in Gastrointestinal Disease <br><br>John Gennari and Wolfgang J. Weise <br><br>Clin J Am Soc Nephrol 3: 1861-1868, 2008. doi: 10.2215 / CJN. 02450508` },
      { letter: "C", title: "Carbonic Anhydrase Inhibitors",
        body: `<b>Allmänt:</b> <br>Karbanhydrashämmare som acetazolamid hindrar omvandlingen av koldioxid och vatten till bikarbonat.
Dessa läkemedel används till exempel mot epilepsi, höjdsjuka och som glaukomläkemedel. Tidigare användes de som diuretika,
men idag har de ersatts av tiazider och loopdiuretika.
Metabol acidos orsakas av minskad återresorption av bikarbonat och sekundärt av relativt ökat återupptag av klorid.
<br><br>
<b>Symtom:</b> <br>
Dåsighet, parestesi, ataxi, diplopi, dimsyn, illamående, kräkningar, polyuri, törst.
<br><br>
<b>Utredning:</b> <br> Anjongap i urin eller osmolalt gap i urin kan avgöra om den hyperkloremiska
acidosen orsakas av gastrointestinal eller renal sjukdom.
<br><br>
<b>Behandling:</b> <br>
Utsättning av utlösande läkemedel leder till spontan återgång av acidosen.`,
        sources: `Significant Metabolic Acidosis Induced by Acetazolamide <br><br>Israel Heller, MD; Jonathan Halevy, MD; Shimon Cohen, MD; et al <br><br>Arch Internal Med. 1985; 145 (10): 1815-1817` },
      { letter: "R", title: "Renal Tubular Acidosis",
        body: `<b>Allmänt:</b> <br> Renal tubulär acidos omfattar ett antal sjukdomar i njurtubuli.
De delas in i grupper beroende på var tubuliproblemet sitter. <br> Typ 1: Distal RTA <br> Alfa-IC-celler i samlingsrören utsöndrar normalt H i utbyte mot K.
Vid distal RTA slås dessa ut, vilket leder till metabol acidos och hypokalemi.
Sekundärt ses osteomalaci och ökad bildning av njursten.
<br>
Typ 2: Proximal RTA
<br>
Vid detta tillstånd hämmas återresorptionen av bikarbonat från de proximala tubuli.
<br>
Typ 3: Proximal och distal RTA.
<br>
Detta tillstånd är ovanligt. Diskutera med njurspecialist vid misstanke.
<br>
Typ 4: Sekundär RTA
<br>
Se Addisons sjukdom. Associerat med hyperkalemi.
<br><br>
<b>Symtom:</b> <br>
Illamående, buksmärta (vid njursten), tillväxthämning, njursvikt
<br><br>
<b>Utredning:</b> <br>
Anjongap i urin eller osmolalt gap i urin kan avgöra om den hyperkloremiska
acidosen orsakas av gastrointestinal eller renal sjukdom.
Mät s-kalium.
<br><br>
<b>Behandling:</b> <br>
Gå igenom patientens läkemedel med tanke på preparat som kan bidra. Acidosen kan behöva korrigeras med bassubstitution, och handläggningen sker lämpligen i samråd med njurspecialist.`,
        sources: `Review of the Diagnostic Evaluation of Renal Tubular Acidosis <br><br>Julian Yaxley, MBBS, Christine Pirrone, MBBS <br><br>Ochsner Journal 16: 525-530, 2016 <br><br>A fysiologie-gebaseerde aanpak bij een patiënt met hypercalemische renale tubulaire acidose <br><br>Menegussi J, Tatagiba LS, Vianna JGP, Seguro AC, Luchi WM. <br><br>J Bras Nefrol. 2018 July 23. pii: S0101-28002018005021101. <br><br>Mechanism of Hypercalemia-Induced Metabolic Acidosis <br><br>Autumn N. Harris et al. <br> JASN May 2018 Vol. 29 no. 5 1411-1425` },
      { letter: "A", title: "Addison's Disease",
        body: `<b>Allmänt:</b> <br> Primär och sekundär binjurebarksvikt leder till otillräcklig produktion av kortisol och aldosteron.
I njurens samlingsrör styr aldosteron utbytet av natrium och kalium. Vid otillräcklig aldosteronproduktion
ses därför hyperkalemi och metabol acidos.
En nydiagnostiserad binjurebarksvikt ses ofta samtidigt med en pågående infektion.
Vid pågående steroidbehandling kan en relativ svikt ses vid svår infektion.
<br><br>
<b>Symtom:</b> <br>
Trötthet. Uttalad dehydrering och hypovolemisk chock.
<br> Hyperkalemi.
<br><br>
<b>Utredning:</b> <br>
p-kortisol, ACTH.
Infektionsprover.
<br><br>
<b>Behandling:</b> <br>
Tillståndet är potentiellt livshotande och kräver skyndsam substitution med kortison (hydrokortison) samt vätska. Eftersom en infektion ofta är utlösande bör den eftersökas och behandlas. Följ lokalt vårdprogram för akut binjurebarksvikt.`,
        sources: `A physiology-based approach to a patient with hypercalemic renal tubular acidosis <br><br>Menegussi J, Tatagiba LS, Vianna JGP, Seguro AC, Luchi WM. <br><br>J Bras Nefrol. 2018 July 23. pii: S0101-28002018005021101. <br><br>Mechanism of Hypercalemia-Induced Metabolic Acidosis <br><br>Autumn N. Harris et al. <br> JASN May 2018 Vol. 29 no. 5 1411-1425` },
      { letter: "P", title: "Pancreatic Fistula",
        body: `<b>Allmänt:</b> <br> Bukspottkörteln producerar normalt stora mängder enzymer för matsmältningen.
Eftersom enzymerna kräver en basisk miljö för att fungera innehåller pankreassekretet stora mängder bikarbonat. <br>
En pankreasfistel leder till förlust av denna basiska vätska.
Tillståndet ses oftast vid kronisk pankreatit.
<br><br>
<b>Symtom:</b> <br> Viktnedgång, buksmärta, feber. Ofta känd kronisk pankreatit.
<br><br>
<b>Utredning:</b> <br>
Leverenzymer och pankreasamylas.
Infektionsparametrar.
DT buk med kontrast kan visualisera fisteln, och eventuellt ascites relaterad till sekretet.
<br><br>
<b>Behandling:</b> <br>
Bör diskuteras med kirurg. Kan bli aktuellt för korrigerande kirurgi.`,
        sources: `Non-Anion Gap Metabolic Acidosis in a Patient With a Pancreaticopleural Fistula <br><br>Benjamin Eovaldi <br><br>The Journal of the American Osteopathic Association, May 2011, Vol. 111, 344-345` },
    ],
  },
  {
    id: "lowag", category: "Metabol acidos", mnemonic: "LIMB", subtitle: "Lågt/negativt anjongap",
    items: [
      { letter: "L", title: "Low Albumin / Lithium",
        body: `<b>Allmänt:</b> <br> Albumin är en negativt laddad syra. Låga albuminnivåer ger därför minskat anjongap och metabol alkalos.
Minskad produktion ses vid leversvikt och ökad elimination vid nefrotiskt syndrom. Kan även vara relaterat till svår undernäring. <br><br> <b>Symtom:</b> <br> Central och perifer ödem. <br><br> <b>Utredning:</b> <br> Leverenzymer, kreatinin, urinsticka och s-albumin. <br><br> <b>Behandling:</b> <br>
Fastställ orsaken till hypoalbuminemin. Säkerställ adekvat proteinintag.
Substitution med iv-albumin är sällan hållbart på lång sikt.`,
        sources: `Acid-base disorders in liver disease <br> Bernhard Scheiner et al. <br> J Hepatol. 2017 Nov; 67 (5): 1062-1073. doi: 10.1016 / j.jhep.2017.06.023. Epub 2017 Christmas 3. <br><br>http://www.journal-of-hepatology.eu/article/S0168-8278 (17)32131-1/pdf` },
      { letter: "I", title: "Iodine",
        body: `<b>Allmänt:</b> <br> Tidigare var jodförgiftning ofta kopplad till suicidförsök.
Dessa var sällan effektiva eftersom jodid framkallar kräkningar genom magirritation.
Kan vara kopplat till metamfetaminframställning när det används vid tillverkning av drogen. <br><br> <b>Symtom:</b> <br> Buksmärta, kräkningar, leverpåverkan. <br><br> <b>Utredning:</b> <br>
Falskt förhöjt klorid och negativt anjongap i urin. Varje mmol jod misstolkas som 3 mmol klorid.
<br><br> <b>Behandling:</b> <br> Rehydrering, överväg dialys.`,
        sources: `Acute Iodine Toxicity From a Suspected Oral Methamphetamine Ingestion <br> Marilyn N Bulloch <br> Clin With Insights Case Rep. 2014; 7: 127-129.` },
      { letter: "M", title: "Myeloma",
        body: `<b>Allmänt:</b> <br> Positivt laddade paraproteiner (M-komponent) leder till ett minskat anjongap.
Ofta ses en samtidig hypoalbuminemi. <br><br> <b>Symtom:</b> <br> Ryggsmärta, anemi, trötthet, polyneuropati, törst, förvirring.
<br><br> <b>Utredning:</b> <br> SR, Hb, leukocyter, trombocyter, kreatinin, albumin, serum- och urinelektrofores. <br><b>Behandling:</b> <br> Vid misstanke om myelom krävs hematologisk utredning och uppföljning. Det låga anjongapet i sig behöver ingen akut åtgärd utan är en ledtråd till diagnosen.` },
      { letter: "B", title: "Bromide",
        body: `<b>Allmänt:</b> <br>
Bromidförgiftning sker vanligen genom oavsiktligt intag. <br><br> <b>Symtom:</b> <br> Förvirring, svaghet, ataxi, tremor, akut psykos <br><br> <b>Utredning:</b> <br> Falskt förhöjt klorid och negativt anjongap i urin. Varje mmol bromid misstolkas som 3 mmol klorid. <br><br> <b>Behandling:</b> <br> Rehydrering och diuretika`,
        sources: `Spurious Hyperchloremia and Negative Anion Gap in a Child with Refractory Epilepsy <br> Madhuradhar Chegondi and Balagangadhar R. Totapally <br> Case Reports in Critical Care Volume 2016 (2016), Article ID 7015463, 3 pages` },
    ],
  },
  {
    id: "metalk", category: "Metabol alkalos", mnemonic: "CLEVER PD", subtitle: "Orsaker till metabol alkalos",
    items: [
      { letter: "C", title: "Contraction (dehydrering)",
        body: `<b>Allmänt:</b> <br>
Vid dehydrering och kontraktion av extracellulärvolymen ökar koncentrationen av lösta molekyler. Både s-Na, s-K och s-Cl stiger i motsvarande grad, men eftersom s-Na stiger mer än s-Cl uppstår en relativ hypokloremi och en kontraktionsalkalos. Förlust av kloridrik vätska (svett, diuretika, kräkningar) förstärker effekten.
<br>
<b>Symtom:</b> <br>
Huvudvärk, förvirring, minskande urinproduktion. Nedsatt hudturgor.
<br>
<b>Utredning:</b> <br>
Mät s-kreatinin och beräkna vätskeunderskott. U-klorid är lågt vid kloridkänslig alkalos. Finn den underliggande orsaken.
<br>
<b>Behandling:</b> <br>
Ersätt de förlorade vätskorna; kloridkänslig alkalos svarar på kloridrik vätska. Var försiktig med korrigeringstakten av natrium vid uttalad dehydrering, och följ lokala riktlinjer.`,
        sources: `Medicinsk Kompendium 1 <br> 17 edition <br> pp. 232-236 <br> Ove B. Schaffalitzky de Muckadell et al` },
      { letter: "L", title: "Liquorice (lakrits)",
        body: `<b>Allmänt:</b> <br>
Glycyrrhetinsyra, den aktiva metaboliten i lakrits, hämmar enzymet 11-beta-hydroxysteroiddehydrogenas typ 2 (11-β-HSD2). Det leder till en kortisolinducerad mineralkortikoid effekt, dvs. en pseudoaldosteronism med natriumretention, kaliumförlust, hypertoni och metabol alkalos. Samma mekanism ses vid överdrivet intag av lakritsgodis eller lakritste, och vid laxermedels- eller diuretikamissbruk.
<br>
<b>Symtom:</b> <br>
Hypertoni, muskelsvaghet och kramper till följd av hypokalemi.
<br>
<b>Utredning:</b> <br>
Lågt s-kalium, låg plasmarenin och lågt plasmaaldosteron (till skillnad från primär hyperaldosteronism). Anamnes på lakrits- eller laxermedelsintag.
<br>
<b>Behandling:</b> <br>
Avbryt intaget. Ersätt kalium. Tillståndet går långsamt i regress när substansen satts ut.`,
        sources: `Severe Hypokalemia and Metabolic Alkalosis Caused by Licorice <br><br>Cureus / PMC9236722` },
      { letter: "E", title: "Endocrine (Conn, Cushing, Bartter)",
        body: `<b>Allmänt:</b> <br>
Hyperaldosteronism kan orsakas av binjurebarkshyperplasi (Conns syndrom), Bartters och Gitelmans syndrom samt sekundärt av Cushings syndrom, exogent kortison eller en ACTH-producerande neuroendokrin tumör. Aldosteron stimulerar natriumupptaget i njurarna via Na/K-ATPaset och epiteliala natriumkanaler (ENaC), samt den tiazidkänsliga natriumkloridtransporten i distala tubuli. Ökat natriumupptag leder sekundärt till ökad kaliumutsöndring, vilket ger en hypokloremisk alkalos med lågt kalium.
<br>
<b>Symtom:</b> <br>
Hypertoni, huvudvärk, svaghet. Svår hypokalemi kan ge arytmier.
<br>
<b>Utredning:</b> <br>
Kvoten plasma-aldosteron/renin, ACTH, p-kortisol. u-kalium och u-kortisol. Överväg DT buk för visualisering av binjurebarken.
<br>
<b>Behandling:</b> <br>
Kaliumsparande diuretika. Intravenöst kalium vid svår hypokalemi. Vidare utredning och behandling beror på orsaken.`,
        sources: `Primär aldosteronism är en under­diagnostiserad orsak till hypertoni <br><br>Oskar Ragnarsson, Andreas Muth, Gudmundur Johannsson, Bo Wängberg <br><br>Läkartidningen. 2015; 112:DRFR` },
      { letter: "V", title: "Vomiting (kräkningar/ventrikelsug)",
        body: `<b>Allmänt:</b> <br>
Magsaft innehåller stora mängder saltsyra, HCl. Normalt återresorberas denna syra i tunntarmen. Kräkningar och ventrikelsug avlägsnar stora mängder syra, vilket ger en hypokloremisk metabol alkalos. Typiskt är s-Cl lågt.
<br>
<b>Symtom:</b> <br>
Illamående, kräkningar, tecken på hypovolemi.
<br>
<b>Utredning:</b> <br>
Det finns många möjliga tillstånd bakom rikliga kräkningar. Överväg bland annat läkemedelsbiverkningar, vestibulärt syndrom, högt intrakraniellt tryck, bulimi, intoxikation och gastrointestinal sjukdom. U-klorid är lågt.
<br>
<b>Behandling:</b> <br>
Antiemetika och rehydrering med kloridrik vätska är förstahandsbehandling. Finn den utlösande orsaken. Protonpumpshämmare minskar alkalosen genom att hämma K/H-antiportern och normalisera pH i magsäcken.`,
        sources: `Acid-Base Disorders in Gastrointestinal Disease <br><br>F. John Gennari, and Wolfgang J. Weise <br><br>Clin J Am Soc Nephrol 3: 1861-1868, 2008. doi: 10.2215 / CJN.02450508` },
      { letter: "E", title: "Excess alkali (mjölk-alkali/antacida)",
        body: `<b>Allmänt:</b> <br>
Tillförsel av alkali utöver vad njurarna kan utsöndra ger metabol alkalos. Mjölk-alkali-syndrom (MAS) består av hyperkalcemi, njursvikt och metabol alkalos, vanligen efter överdrivet kalcium- eller antacidaintag. Iatrogent eller oavsiktligt intag av alkaliska substanser, eller aggressiv behandling av en akut metabol acidos med natriumbikarbonat, ger samma bild; typfallet är laktacidos efter kramper som klingar av spontant medan tillfört bikarbonat kvarstår tills njurarna eliminerar det.
<br>
<b>Symtom:</b> <br>
Yrsel, huvudvärk, irritabilitet. Vid bikarbonatöverdos även förvirring och tremor.
<br>
<b>Utredning:</b> <br>
s-Ca kan vara mycket högt (MAS); mät PTH. Gå igenom tidigare läkemedel och intag.
<br>
<b>Behandling:</b> <br>
Avbryt alkali- eller kalciumintaget och korrigera vätskebalansen. Svår alkalos kan i sällsynta fall kräva korrigering med intravenös saltsyra (HCl), vilket då sker på intensivvårdsnivå.`,
        sources: `Milk-Alkali Syndrome <br><br>Boris I. Medarov, MD <br><br>Mayo Clin Proc. 2009 Mar; 84 (3): 261-267` },
      { letter: "R", title: "Renal (Bartter/Gitelman, K-brist)",
        body: `<b>Allmänt:</b> <br>
Renala tubulära defekter kan ge en kloridresistent metabol alkalos. Bartters syndrom (defekt i den uppåtstigande Henles slynga, liknar loopdiuretika) och Gitelmans syndrom (defekt i distala tubuli, liknar tiazider) ger båda saltförlust, hypokalemi och alkalos. Svår kaliumbrist i sig upprätthåller en alkalos genom intracellulär H/K-förskjutning och ökad renal bikarbonatåterresorption.
<br>
<b>Symtom:</b> <br>
Muskelsvaghet, trötthet, polyuri. Normalt eller lågt blodtryck (till skillnad från hyperaldosteronism).
<br>
<b>Utredning:</b> <br>
s-kalium, s-magnesium, u-klorid (högt vid kloridresistent alkalos). Plasmarenin och aldosteron för att skilja från endokrina orsaker.
<br>
<b>Behandling:</b> <br>
Ersätt kalium och magnesium. Kaliumsparande diuretika kan behövas. Behandla underliggande orsak.`,
        sources: `Acid-base, electrolyte, and metabolic abnormalities, Bartter and Gitelman syndromes review` },
      { letter: "P", title: "Post-hypercapnia",
        body: `<b>Allmänt:</b> <br>
Vid kronisk respiratorisk acidos kompenserar njurarna genom att retinera bikarbonat. Om hyperkapnin sedan korrigeras snabbt (t.ex. vid intubation och ventilation av en KOL-patient) hinner njurarna inte göra sig av med det extra bikarbonatet, och en posthyperkapnisk metabol alkalos kvarstår tills detta sker.
<br>
<b>Symtom:</b> <br>
Ofta få symtom från själva alkalosen; bilden domineras av grundsjukdomen.
<br>
<b>Utredning:</b> <br>
Anamnes på nyligen korrigerad kronisk hyperkapni. Förhöjt bikarbonat med nu normalt eller lågt pCO₂.
<br>
<b>Behandling:</b> <br>
Vanligen självbegränsande när njurarna utsöndrat överskottet. Säkerställ adekvat klorid- och kaliumtillförsel så att njuren kan korrigera.`,
        sources: `Emergucate: Causes of Acid-Base Disorders (CLEVER PD)` },
      { letter: "D", title: "Diuretics (loop/tiazid)",
        body: `<b>Allmänt:</b> <br>
Loop- och tiaziddiuretika är bland de vanligaste orsakerna till metabol alkalos. De ökar natrium- och kloridförlusten, framkallar en kontraktion av extracellulärvolymen och ökar den distala natriumtillförseln, vilket driver kaliumutsöndring och bikarbonatåterresorption. Resultatet är en hypokloremisk, hypokalem metabol alkalos.
<br>
<b>Symtom:</b> <br>
Muskelsvaghet och kramper vid hypokalemi; tecken på hypovolemi.
<br>
<b>Utredning:</b> <br>
Läkemedelsanamnes. Lågt s-kalium och s-klorid. U-klorid kan vara högt under pågående diuretikaeffekt men lågt däremellan.
<br>
<b>Behandling:</b> <br>
Se över diuretikadosen. Ersätt kalium och klorid. Kaliumsparande diuretika kan motverka alkalosen.`,
        sources: `Diuretic-induced metabolic alkalosis, standard nephrology references` },
    ],
  },
  {
    id: "respaci", category: "Respiratorisk acidos", mnemonic: "DEPRESS", subtitle: "Orsaker till respiratorisk acidos (hypoventilation)",
    items: [
      { letter: "D", title: "Drugs (opiater/sedativa)",
        body: `<b>Allmänt:</b> <br>
Opiater och andra sedativa (bensodiazepiner, propofol, alkohol) minskar andningsdriven, vilket ger långsam, otillräcklig andning. Hypoventilation leder till koldioxidretention och respiratorisk acidos. Vid snabb intravenös tillförsel av stora mängder opiater kan kroppen inte kompensera, och apné kan snabbt leda till hjärtstopp.
<br>
<b>Symtom:</b> <br>
Små pupiller vid opiatintox. Mycket långsam andning. Kan ha låg puls och lågt blodtryck.
<br>
<b>Utredning:</b> <br>
Drogscreening i urin. Anamnes och klinisk bild.
<br>
<b>Behandling:</b> <br>
Säkerställ andning och ventilation. Vid opiatutlöst andningsdepression finns en specifik antidot (naloxon); var medveten om att den kan utlösa abstinens. Följ lokala rutiner för dosering och övervakning.`,
        sources: `Opioid overdose, respiratory depression and naloxone, standard toxicology references` },
      { letter: "E", title: "Edema (lungödem)",
        body: `<b>Allmänt:</b> <br>
Pulmonellt lungödem, kardiogent eller icke-kardiogent (ARDS), fyller alveolerna med vätska och försämrar gasutbytet. Initialt ses ofta hypoxi med hyperventilation, men vid uttröttning eller svår sjukdom övergår bilden i hypoventilation och respiratorisk acidos.
<br>
<b>Symtom:</b> <br>
Dyspné, rosslande andning, rosa fradga, ortopné. Cyanos vid svår hypoxi.
<br>
<b>Utredning:</b> <br>
Lungröntgen, pro-BNP, ekokardiografi vid kardiell misstanke. Arteriell blodgas följer förloppet.
<br>
<b>Behandling:</b> <br>
Syrgas och CPAP/NIV. Diuretika och nitrater vid kardiogent ödem. Behandla underliggande orsak; intubation vid hotande andningssvikt.`,
        sources: `Acute cardiogenic pulmonary oedema and ARDS, standard references` },
      { letter: "P", title: "Pneumoni",
        body: `<b>Allmänt:</b> <br>
Pneumoni fyller alveolerna med pus och inflammatoriskt exsudat, vilket försämrar gasutbytet. Vid utbredd pneumoni eller uttröttning leder detta till hypoventilation och respiratorisk acidos.
<br>
<b>Symtom:</b> <br>
Feber, hosta, purulent sputum, dyspné, andningskorrelerad bröstsmärta.
<br>
<b>Utredning:</b> <br>
CRP, leukocyter, lungröntgen, blod- och sputumodling. Arteriell blodgas för att bedöma andningssvikt.
<br>
<b>Behandling:</b> <br>
Antibiotika riktat mot trolig patogen. Syrgas, vätska, och ventilationsstöd vid behov.`,
        sources: `Community-acquired pneumonia, standard infectious disease references` },
      { letter: "R", title: "Respiratory centre (hjärnstam/centralt)",
        body: `<b>Allmänt:</b> <br>
Allt som påverkar hjärnstammens andningscentrum kan ge hypoventilation: tumörer, ischemi (stroke), blödning och infektioner. Beroende på vilka strukturer som drabbas kan både hypo- och hyperventilation ses.
<br>
<b>Symtom:</b> <br>
Hypoventilation, oftast förenat med andra neurologiska symtom som hemipares, dysartri, medvetslöshet och pares av ögonmusklerna.
<br>
<b>Utredning:</b> <br>
Elektrolyter, CRP, leukocyter. DT och angiografi av cerebrala och cervikala kärl; MR bör övervägas.
<br>
<b>Behandling:</b> <br>
Antibiotika/antivirala medel vid misstänkt infektion. Neurokirurgisk konsultation om DT visar blödning eller tumör.`,
        sources: `The respiratory control mechanisms in the brainstem and spinal cord <br><br>Keiko Ikeda et al. <br><br>J Physiol Sci (2017) 67: 45-62` },
      { letter: "E", title: "nEuromuskulär sjukdom",
        body: `<b>Allmänt:</b> <br>
Sjukdomar som drabbar nervförsörjningen till eller funktionen i andningsmusklerna ger hypoventilation och respiratorisk acidos. Hit hör <b>Guillain-Barré</b> (autoimmunt angrepp på perifera nerver, ofta efter infektion), <b>ALS</b> (progressiv motorneuronsjukdom), <b>myastenia gravis</b> (antikroppar mot acetylkolinreceptorer, snabb uttröttbarhet), <b>hög cervikal ryggmärgsskada</b> (skada på n. phrenicus, C3–C5, kan ge akut andningsstopp) samt <b>myosit</b> (svaga andningsmuskler, höga CK-nivåer).
<br>
<b>Symtom:</b> <br>
Tilltagande muskelsvaghet, bilateral slapp pares, dysfagi, nasalt tal, nacksvaghet. Vid ryggmärgsskada nacksmärta och tetrapares.
<br>
<b>Utredning:</b> <br>
Elektromyografi. Lumbalpunktion och proteinelektrofores (Guillain-Barré). Acetylkolinreceptorantikroppar och edrofontest (myastenia). CK och muskelbiopsi (myosit). DT halsrygg vid traumamisstanke.
<br>
<b>Behandling:</b> <br>
Behandlingen är specifik för respektive diagnos och sker i samråd med neurolog: t.ex. plasmaferes eller IVIG vid Guillain-Barré och myasten kris, kolinesterashämmare vid myastenia gravis. Det viktigaste i akutskedet är att övervaka andningsfunktionen, eftersom respiratorvård kan krävas vid tilltagande hypoventilation.`,
        sources: `Guillain-Barré syndrome, myasthenia gravis and neuromuscular respiratory failure, standard neurology references <br><br>Myasthenia Gravis <br> Pirskanen-Matell R et al <br> Läkartidningen 2000; 97: 4594-4598` },
      { letter: "S", title: "Sac elasticity (obstruktiv lungsjukdom/KOL)",
        body: `<b>Allmänt:</b> <br>
Obstruktiva lungsjukdomar som astma och KOL ger förträngning av de minsta luftvägarna och, vid KOL, förlust av alveolernas elasticitet. Detta ger ökat andningsmotstånd, gasutbytesproblem och, vid uttröttning, hypoventilation med respiratorisk acidos.
<br>
<b>Symtom:</b> <br>
Hosta med obstruktiva andningsljud och förlängt expirium. Trespunktsställning underlättar andningsarbetet. Terminal KOL ger ofta kakexi då andningsarbetet kostar mycket energi.
<br>
<b>Utredning:</b> <br>
Klinik och anamnes räcker oftast. PEF kan användas vid lindriga astmaanfall men kan utlösa bronkospasm och bör undvikas i svåra fall. Hyperkapni hos en astmatiker är ett mycket illavarslande tecken.
<br>
<b>Behandling:</b> <br>
Bronkdilaterande inhalationer. Intravenösa/perorala kortikosteroider. Ventilationsstöd och intubation vid svår acidos. Antibiotika vid tecken på samtidig bakteriell infektion.`,
        sources: `Diagnosis and Management of Asthma in Adults <br> McCracken JL et al <br> JAMA. 2017; 318 (3): 279-290 <br> COPD exacerbations <br> Qureshi H, Sharafkhaneh A, Hanania NA <br> Ther Adv Chronic Dis 2014; 5 (5): 212-227` },
      { letter: "S", title: "Strukturellt (bröstkorg/luftväg)",
        body: `<b>Allmänt:</b> <br>
Mekaniska hinder för ventilationen. <b>Flail chest</b>: multipla revbensfrakturer ger en instabil bröstkorg med paradoxala andningsrörelser och ofta lungkontusion. <b>Övre luftvägsobstruktion</b>: främmande kropp, epiglottit eller tumör. <b>Pneumotorax/pleuravätska</b>: lungkollaps och restriktiv funktionsnedsättning; tryckpneumotorax ger obstruktiv chock.
<br>
<b>Symtom:</b> <br>
Flail chest: trauma, bröstsmärta, synligt instabil bröstkorg. Luftvägsobstruktion: stridor, accessoriska andningsmuskler. Pneumotorax: andningskorrelerad bröstsmärta, nedsatt andningsljud, trakealdeviation och halsvenstas.
<br>
<b>Utredning:</b> <br>
Ultraljud/lungröntgen, vid behov DT thorax. Vid pleuravätska bedöm transudat vs exsudat (exsudat > 30 g protein/L); pleuratappning med odling, cytologi, pH, glukos, celler, LD, albumin och triglycerider.
<br>
<b>Behandling:</b> <br>
Riktas mot det mekaniska hindret och kan vara tidskritisk. Flail chest kräver god smärtlindring och ibland ventilationsstöd. En obstruerad övre luftväg kan kräva åtgärder från Heimlichmanöver till konikotomi, och en tryckpneumotorax kräver akut dekompression och thoraxdrän utan fördröjning. Säkerställ tidigt rätt kompetens på plats.`,
        sources: `The management of flail chest <br> Pettiford BL et al <br> Thorac Surg Clin. 2007; 17 (1): 25-33 <br> Pneumothorax: an update <br> Currie GP et al <br> Postgrad Med J 2007; 83: 461-465` },
    ],
  },
  {
    id: "respalk_hypoxic", category: "Respiratorisk alkalos", mnemonic: "APA", subtitle: "Hypoxidriven hyperventilation",
    items: [
      { letter: "A", title: "Altitude (hög höjd)",
        body: `<b>Allmänt:</b> <br>
På hög höjd (över 2500 m) minskar den totala syrehalten i luften. Detta innebär att relativt mindre syre når blodbanan,
vilket ger kompensatorisk hyperventilation. Lungödem och hjärnödem kan också ses vid svår höjdsjuka.
<br>
<b>Symtom:</b> <br>
Hjärnödem ger huvudvärk, yrsel, trötthet och sömnstörning. <br>
Lungödem ger hjärtklappning och dyspné.
<br>
<b>Utredning:</b> <br>
Misstänks främst om patienten befinner sig på hög höjd med ovan nämnda symtom.
<br>
<b>Behandling:</b> <br>
Den viktigaste åtgärden är nedstigning till lägre höjd, tillsammans med syrgas. Vid svår höjdsjuka används acetazolamid, och steroider vid ödem; följ etablerade rekommendationer för höjdsjuka.`,
        sources: `Altitude sickness <br><br>David Murdoch <br><br>BMJ Clin Evid. 2010: 1209` },
      { letter: "P", title: "Pulmonary Embolus",
        body: `<b>Allmänt:</b> <br>
Obstruktion av lungartärer skapar dead space-ventilation där stora delar av lungan ventileras men inte perfunderas, och en del blod leds till dåligt ventilerade lungavsnitt.
Detta ger försämrat gasutbyte, som initialt främst yttrar sig som hypoxi med kompensatorisk hyperventilation.
<br>
<b>Symtom:</b> <br>
Bröstsmärta särskilt vid djupandning, dyspné, yrsel, synkope.
Stora lungembolier leder till obstruktiv chock, halsvenstas, cirkulatorisk kollaps och hjärtstopp.
<br>
<b>Utredning:</b> <br>
Graderas enligt Wells score i låg och hög sannolikhet. <br>
Vid låg sannolikhet beställs D-dimer. <br>
PERC-regeln kan också användas tillsammans med lågt Wells score för att utesluta lungemboli. <br>
Vid stark misstanke beställs DT-angiografi eller lungscintigrafi. <br>
Ultraljud av hjärtat kan visa tecken på högerkammarbelastning. <br>
EKG visar ofta tecken på högerkammarbelastning såsom högergrenblock eller negativa T-vågor i avledning V1–V3.
<br>
<b>Behandling:</b> <br>
Syrgas och cirkulatoriskt stöd vid behov. Grundbehandlingen är antikoagulation (t.ex. lågmolekylärt heparin, DOAK eller warfarin), och vid massiv, livshotande lungemboli kan trombolys bli aktuell. Val och tidpunkt styrs av lokala riktlinjer och klinisk stabilitet.`,
        sources: `Pulmonary embolism <br><br>Abigail K. Tarbox & Mamta Swaroop <br><br>Int J Crit Illn Inj Sci. 2013 Jan-Mar; 3 (1): 69-72.` },
      { letter: "A", title: "Anaemia",
        body: `<b>Allmänt:</b> <br>
Anemi leder till relativ syrebrist i kroppen, vilket ger kompensatorisk hyperventilation.
Fokus bör ligga på att finna den utlösande orsaken, och provtagning bör om möjligt ske före transfusion.
<br>
<b>Symtom:</b> <br>
Huvudvärk, hjärtklappning, dyspné, bröstsmärta, trötthet, blekhet.
<br>
<b>Utredning:</b> <br>
Blödnings- och malignitetsanamnes. <br>
Retikulocyter, trombocyter, PK, MCV och MCH. <br>
Låga retikulocyter talar för hämmad benmärgsproduktion
medan höga nivåer talar för ökad blodförlust och kompensatorisk överproduktion. <br>
Bristanemier utreds med järn, ferritin, transferrinmättnad, B12 och folat. <br>
Vid järnbrist och sekundär anemi ses lågt MCV, medan folat- och B12-brist ger högt MCV. <br>
Vid misstänkt GI-blödning kan F-Hb övervägas. <br>
Hemolysprover inkluderar laktatdehydrogenas, haptoglobin, okonjugerat bilirubin, blodutstryk och DAT-test. <br> <br>
Ett positivt DAT-test talar för autoimmun hemolys. <br>
Blodutstryk används för att bedöma bland annat sfärocytos, schistocyter och sickleceller.
<br>
<b>Behandling:</b> <br>
Finn ett möjligt blödningsfokus och åtgärda detta. <br>
Överväg koloskopi och gastroskopi. <br>
Ersätt järn- och vitaminbrister. <br>
Koppla in hematolog tidigt vid misstänkt hemolys. <br>
Blodtransfusion kan bli nödvändig.`,
        sources: `Anemia: Diagnosis and Management <br><br>Sharon M. Coyer, PhD <br><br>J Pediatric Health Care. (2005) 19, 380-385 <br> Hemolytic Anemia <br><br>Gurpreet Dhaliwal, MD, Patricia A. Cornett, MD, Lawrence M. Tierney MD <br><br>Diagnosis and management of iron deficiency anemia in the 21st century <br><br>Terri D. Johnson-Wimbley & David Y. Graham <br><br>Ther Adv Gastroenterology (2011) 4 (3) 177184` },
    ],
  },
  {
    id: "respalk_other", category: "Respiratorisk alkalos", mnemonic: "STAPLES", subtitle: "Icke-hypoxisk hyperventilation",
    items: [
      { letter: "S", title: "Sepsis",
        body: `<b>Allmänt:</b> <br>
Det finns flera teorier om varför sepsis leder till hyperventilation. Dels ger laktacidos kompensatorisk hyperventilation,
och endotoxiner kan direkt påverka vagala C-fibrer; dels kan lokal laktatproduktion i cerebrospinalvätskan vid t.ex. meningit ge kompensatorisk hyperventilation.
<br> <br>
<b>Symtom:</b> <br>
Hypovolemi, takykardi och feber.
<br> <br>
<b>Utredning:</b> <br>
Sök efter ett infektionsfokus. Glöm inte infekterade fotsår under förband.
Fenotypa patienten. Infektionsprover.
<br> <br>
<b>Behandling:</b> <br>
Antibiotika och intravenös vätska. Kan kräva inotropt stöd.` },
      { letter: "T", title: "Toxins",
        body: `<b>Allmänt:</b> <br>
Acetylsalicylsyra, koffein och nikotin kan alla öka ventilationen genom att verka direkt på andningscentra.
För acetylsalicylsyra, se salicylat under metabol acidos med högt anjongap.
<br> <br>
<b>Symtom:</b> <br> Koffeinförgiftning
ger delirium, kramper, maligna arytmier och feber.
Nikotinförgiftning har ett bifasiskt förlopp där den första fasen ger takykardi, kräkningar och takypné,
medan den andra fasen ger CNS-depression, bradykardi och lågt blodtryck.
<br> <br>
<b>Utredning:</b> <br>
s-salicylat, elektrolyter, EKG.
<br> <br>
<b>Behandling:</b> <br>
I huvudsak symtomatisk och beror på ämnet. Vid koffeinförgiftning kan betablockad dämpa takykardin, och aktivt kol kan övervägas. Kontakta Giftinformationscentralen för substansspecifik handläggning.` },
      { letter: "A", title: "Anxiety",
        body: `<b>Allmänt:</b> <br> Panikattacker är vanligen förenade med snabb, ytlig andning.
Orsaken till hyperventilationen är omdebatterad och sannolikt multifaktoriell.
En hypotes är att en falsk kvävningskänsla orsakas av CO2-överkänslighet, vilket provocerar hyperventilation och panikupplevelser.
Flera studier har också visat förhöjda koldioxidnivåer i utandningsluften hos patienter före en panikattack.
Tilltagande alkalos gör att fritt kalcium binds till albumin, vilket anses ge stickningar i händer och fötter.
<br> <br>
<b>Symtom:</b> <br>
Panikkänsla och snabb andning. Huvudvärk, yrsel, skakningar, stickningar kring munnen, fingrar och tår.
<br> <br>
<b>Utredning:</b> <br>
Uteslut andra orsaker till respiratorisk alkalos.
Ofta känd paniksyndrom och tydlig klinik.
<br> <br>
<b>Behandling:</b> <br>
Vanligen ombeds patienter att andas i en påse för att behålla koldioxiden. Detta rekommenderas inte längre på grund av låg syrehalt i återandad luft.
Ge i stället information om tillståndet och skapa en lugn miljö.` },
      { letter: "P", title: "Pregnancy",
        body: `<b>Allmänt:</b> <br>
Flera faktorer hos den gravida kvinnan ger respiratorisk alkalos. Dels vidgas thorax, vilket ger ökad tidalvolym,
dels leder högre progesteronnivåer till förändrad andningskänslighet för koldioxid.
<br> <br>
<b>Behandling:</b> <br>
Respiratorisk alkalos sekundärt till graviditet kräver ingen behandling.`,
        sources: `Respiratory Physiology of pregnancy <br> Antonella LoMauro, Andrea Aliverti <br> Breathe (Sheff). 2015 Dec; 11 (4): 297-301. doi: 10.1183 / 20734735.008615` },
      { letter: "L", title: "Liver Failure",
        body: `<b>Allmänt:</b> <br>
Minskad omsättning av progesteron, hyperammonemi, portopulmonell hypertension, hydrotorax och ascitesrelaterad hypoxi samverkar
till att ge respiratorisk alkalos hos leverpatienten.
<br> <br>
<b>Symtom:</b> <br>
Ikterus, förvirring, hepatomegali, eventuellt högt alkoholintag.
<br> <br>
<b>Utredning:</b> <br>
Leverenzymer, albumin.
<br> <br>
<b>Behandling:</b> <br>
Beror på utlösande orsak. Behandling av ascites och encefalopati kan lindra tillståndet.` },
      { letter: "E", title: "Endocrine",
        body: `<b>Allmänt:</b> <br>
Höga nivåer av sköldkörtelhormoner stimulerar centrala och perifera kemoreceptorer, vilket ger
ökad andning och sekundärt respiratorisk alkalos.
<br> <br>
<b>Symtom:</b> <br>
Takykardi, viktnedgång, nervositet, tremor, sömnstörning, håravfall.
<br> <br>
<b>Utredning:</b> <br>
Palpation av sköldkörteln, TSH, T3, T4.
Specifik utredning vid patologiska prover.
<br> <br>
<b>Behandling:</b> <br>
Riktas mot den bakomliggande sköldkörtelrubbningen och sker i samråd med endokrinolog. Den respiratoriska alkalosen i sig kräver ingen specifik åtgärd.`,
        sources: `Regulation of breathing in hyperthyroidism <br> JM Pino-García et al. <br> Eur Respir J 1998; 12: 400-407 DOI: 10.1183 / 09031936.98.12020400` },
      { letter: "S", title: "Stroke",
        body: `<b>Allmänt:</b> <br> All påverkan på hjärnan kan skada andningscentrum. Detta kan ge både hypo- och hyperventilation beroende på vilka strukturer som drabbas. Tumörer, ischemi, blödning och infektioner är de huvudsakliga orsakerna till central andningsstörning. <br> <br> <b>Symtom:</b> <br>
Hyperventilation. Oftast förenat med andra neurologiska symtom som hemipares, dysartri, sänkt medvetande och pares av ögonmusklerna.
<br> <br>
<b>Utredning:</b> <br>
DT skalle och angiografi av huvudets och halsens kärl. MR vid icke-konklusiv DT och kvarstående misstanke.
<br> <br>
<b>Behandling:</b> <br>
Riktad mot utlösande orsak.` },
    ],
  },
  {
    id: "lactate", category: "Laktacidos", mnemonic: "LACTATES", subtitle: "Metabola orsaker till förhöjt laktat",
    items: [
      { letter: 'L', title: 'Liver & Lung Disease',
        body: `<b>Allmänt:</b> <br>
Leversvikt minskar laktatclearance: laktat som produceras av perifera vävnader elimineras normalt av levern genom glukoneogenes, och när levern sviktar avbryts denna process och laktat ackumuleras. Svår lungsvikt kan ge hypoxemi och i sin tur anaerob metabolism och stigande laktat.
<br> <br>
<b>Symtom:</b> <br>
Ikterus, trötthet, ascites och tecken på undernäring vid leversvikt; dyspné, cyanos och andnöd vid svår lungsjukdom.
<br> <br>
<b>Utredning:</b> <br>
Leverenzymer och syntesfunktion, p-etanol, samt specifik utredning av orsaken till leversvikten. Lungröntgen och arteriell syresättning vid pulmonella orsaker.
<br> <br>
<b>Behandling:</b> <br>
Behandla den underliggande lever- eller lungsjukdomen; återställ syresättningen.`,
        sources: `Berend K, de Vries AP, Gans RO. Physiological approach to assessment of acid-base disturbances. <br> N Engl J Med. 2014;371(15):1434-45. <br><br> Olsson de Capretz P, Lindeman E, Dryver E. Syra–bastolkning på akuten. <br> Läkartidningen. 2021;118:21087.` },
      { letter: 'A', title: 'Accelerated Glycolysis',
        body: `<b>Allmänt:</b> <br>
Laktat kan stiga när glykolysen drivs snabbare än pyruvat kan tas om hand, även utan vävnadshypoxi. Detta sker vid β2-adrenerg stimulering, endogen (sepsis, stress, kramper, frossa, kraftig ansträngning, feokromocytom) eller exogen (adrenalin givet vid anafylaxi eller HLR, samt intoxikation med β2-agonist, koffein eller teofyllin), och vid accelererad glykolys vid vissa maligniteter (lymfom, leukemi, solida tumörer).
<br> <br>
<b>Symtom:</b> <br>
Beror på utlösaren: tremor, takykardi och agitation vid katekolaminöverskott; i övrigt den kliniska bilden av den underliggande stressorn.
<br> <br>
<b>Utredning:</b> <br>
Gå igenom läkemedel och exponeringar. Överväg den underliggande stressorn; vid oförklarade fall, överväg feokromocytom eller malignitet.
<br> <br>
<b>Behandling:</b> <br>
Åtgärda utlösaren; laktatet i sig behöver vanligen ingen specifik behandling.`,
        sources: `Olsson de Capretz P, Lindeman E, Dryver E. Syra–bastolkning på akuten. <br> Läkartidningen. 2021;118:21087.` },
      { letter: 'C', title: 'Congenital & Shock',
        body: `<b>Allmänt:</b> <br>
Två skilda grupper ryms under C. Medfödda sjukdomar, medfödda metabola rubbningar såsom mitokondriella enzymdefekter och glykogeninlagringssjukdomar, försämrar den oxidativa metabolismen och höjer laktat, och debuterar typiskt tidigare i livet. Chock av alla slag (hypovolemisk, kardiogen, distributiv, obstruktiv) minskar syretillförseln till vävnaderna, framtvingar anaerob metabolism och en snabb laktatstegring; detta är den vanligaste allvarliga orsaken som ses akut.
<br> <br>
<b>Symtom:</b> <br>
Chock: hypotoni, takykardi, kalla eller marmorerade extremiteter, svaga pulsar, påverkat medvetande. Överväg alltid tarmischemi och aortadissektion eller -ruptur vid oförklarad laktatstegring med bröst- eller buksmärta.
<br> <br>
<b>Utredning:</b> <br>
Bedöm perfusionen och identifiera typen av chock. Laktatclearance är en användbar markör för återupplivningen. Hos barn eller vid atypisk bild, överväg en medfödd metabol sjukdom.
<br> <br>
<b>Behandling:</b> <br>
Återställ cirkulerande volym och perfusion; behandla den specifika orsaken till chocken.`,
        sources: `Olsson de Capretz P, Lindeman E, Dryver E. Syra–bastolkning på akuten. <br> Läkartidningen. 2021;118:21087.` },
      { letter: 'T', title: 'Thiamine Deficiency',
        body: `<b>Allmänt:</b> <br>
Tiamin (vitamin B1) är en kofaktor för pyruvatdehydrogenas, enzymet som för in pyruvat i citronsyracykeln. Utan det shuntas pyruvat till laktat. Tiaminbrist kan därför ge laktacidos även utan manifest leversvikt, klassiskt vid undernäring, alkoholberoende och långvarig parenteral nutrition utan tillskott.
<br> <br>
<b>Symtom:</b> <br>
Kan vara subtilt; överväg hos undernärda eller alkoholberoende patienter, och där Wernicke-tecken (förvirring, oftalmoplegi, ataxi) föreligger.
<br> <br>
<b>Utredning:</b> <br>
Till stor del klinisk. En laktacidos som snabbt går i regress efter tiamin är i sig vägledande.
<br> <br>
<b>Behandling:</b> <br>
Intravenöst tiamin; svår laktacidos kan gå tillbaka inom 24 timmar.`,
        sources: `Amrein K, Ribitsch W, Stauber R, et al. Severe lactic acidosis reversed by thiamine within 24 hours. <br> Crit Care. 2011;15(6):457.` },
      { letter: 'A', title: 'Anaerobic Metabolism',
        body: `<b>Allmänt:</b> <br>
Kärnmekanismen bakom de flesta laktacidoser: när syretillförseln inte kan möta behovet växlar cellerna till anaerob glykolys och bildar laktat. Vävnadshypoperfusion, ischemi och syreskuld är drivkrafterna. Svår hypoxemi, uttalad anemi (Hb < 50 g/L) och svår methemoglobinemi minskar alla syretillförseln; lokal ischemi (extremitet, tarm, myokard) gör det regionalt.
<br> <br>
<b>Symtom:</b> <br>
De som hör till den underliggande hypoperfusionen eller hypoxin: smärta och pulslöshet vid regional ischemi; andnöd och cyanos vid hypoxemi.
<br> <br>
<b>Utredning:</b> <br>
Bedöm syresättning, hemoglobin och perfusion. Bilddiagnostik av det misstänkta ischemiska området (t.ex. DT-angiografi).
<br> <br>
<b>Behandling:</b> <br>
Återställ syretillförseln: syrgas, transfusion, reperfusion av ischemisk vävnad.`,
        sources: `Berend K, de Vries AP, Gans RO. Physiological approach to assessment of acid-base disturbances. <br> N Engl J Med. 2014;371(15):1434-45.` },
      { letter: 'T', title: 'Toxins & Drugs',
        body: `<b>Allmänt:</b> <br>
Många substanser ger laktacidos; denna lista är inte uttömmande. Cyanid hämmar den aeroba metabolismen genom att blockera elektronöverföringen till syre, vilket framtvingar anaerob metabolism; ses vid rökgasinhalation och vissa födoämnen. Kolmonoxid binder hemoglobin med ungefär 200 gånger syrets affinitet, vilket ger cellulär syrebrist; pulsoximetri är falskt lugnande eftersom den inte tar hänsyn till karboxihemoglobin. Metformin hämmar leverns laktatclearance och ackumuleras vid njursvikt. Andra orsaker är nukleosidanaloger (NRTI), propofol (långvarig högdosinfusion), linezolid, järn och isoniazid (via kramper).
<br> <br>
<b>Symtom:</b> <br>
Brand i ett slutet utrymme bör väcka tanke på cyanid och kolmonoxid; leta efter sot i munnen och andnöd; rökare har lätt förhöjda CO-nivåer. Metforminförgiftning ger illamående, kräkningar, buksmärta och diarré, och i svåra fall förvirring, somnolens, koma och kramper. Järn ger hypovolemi, kramper, leverpåverkan och magbesvär.
<br> <br>
<b>Utredning:</b> <br>
COHb, p-järn, kreatinin; läkemedels- och exponeringsanamnes.
<br> <br>
<b>Behandling:</b> <br>
Flera av dessa förgiftningar har specifika antidoter och åtgärder: hydroxokobalamin och syrgas vid cyanid, högflödessyrgas vid kolmonoxid, hemodialys vid metformin, pyridoxin vid isoniazid och deferoxamin vid järn. Identifiera det troliga ämnet och kontakta Giftinformationscentralen tidigt för dosering och handläggning.`,
        sources: `Kraut JA, Madias NE. Lactic acidosis. <br> N Engl J Med. 2014;371(24):2309-19. <br><br> Jagia M, Taqi S, Hanafi M. Metformin poisoning: a complex presentation. <br> Indian J Anaesth. 2011;55(2):190-192.` },
      { letter: 'E', title: 'Extracellular Shift (Alkalosis)',
        body: `<b>Allmänt:</b> <br>
Alkalos, respiratorisk eller metabol, stimulerar glykolysen (genom att aktivera fosfofruktokinas) och ökar laktatproduktionen. Stegringen är vanligen måttlig, men den förklarar ett lätt förhöjt laktat hos en hyperventilerande eller alkalotisk patient utan vävnadshypoxi.
<br> <br>
<b>Symtom:</b> <br>
De som hör till den underliggande alkalosen; laktatstegringen är typiskt ett accidentellt, lindrigt fynd.
<br> <br>
<b>Utredning:</b> <br>
Tolka laktatet i ljuset av syra-basbilden; en lindrig stegring vid alkalos behöver sällan separat utredning.
<br> <br>
<b>Behandling:</b> <br>
Åtgärda orsaken till alkalosen; ingen specifik behandling av laktatet krävs.`,
        sources: `Olsson de Capretz P, Lindeman E, Dryver E. Syra–bastolkning på akuten. <br> Läkartidningen. 2021;118:21087.` },
      { letter: 'S', title: 'Sepsis',
        body: `<b>Allmänt:</b> <br>
Sepsis höjer laktat genom flera mekanismer utöver enkel vävnadshypoxi: mikrocirkulatorisk dysfunktion, β2-medierad accelererad glykolys, mitokondriell påverkan och minskad leverclearance. Laktat kan därför vara förhöjt även när den globala syretillförseln ser adekvat ut, och det är en central markör för svårighetsgrad och återupplivning vid sepsis.
<br> <br>
<b>Symtom:</b> <br>
Feber eller hypotermi, takykardi, hypotoni och tecken på infektionskällan. Glöm inte dolda källor som infekterade fotsår under förband.
<br> <br>
<b>Utredning:</b> <br>
Sök efter ett infektionsfokus; odlingar och fokusriktad bilddiagnostik. Upprepat laktat för att följa svaret.
<br> <br>
<b>Behandling:</b> <br>
Källkontroll, antimikrobiell behandling och återupplivning; följ laktatclearance.`,
        sources: `Olsson de Capretz P, Lindeman E, Dryver E. Syra–bastolkning på akuten. <br> Läkartidningen. 2021;118:21087.` },
    ],
  },
];