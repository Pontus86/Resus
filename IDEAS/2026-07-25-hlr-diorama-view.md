# I-003 — Fast dioramavy för A-HLR-simulatorn

- Status: `closed`
- Current baton: `Codex`
- Related tasks: `R-011`, `R-015`

## Fråga

Hur ersätter vi den spretiga sprite-vyn med en visuellt sammanhållen akutrumsvy som gör
teamarbete, utrustning och pågående åtgärder lättare att läsa?

## Beslut

Simulatorn ska använda ett stiliserat kliniskt diorama med fast, lätt upphöjd kameravinkel.
Kameran ska inte kunna roteras. Rummet, personalen och utrustningen ska dela ljusriktning,
material, perspektiv och skuggning. Monitorer, vitalparametrar, knappar och annan precis
information förblir skarpa 2D-element.

Första iterationen byggs som en sammanhängande 2,5D-komposition i Canvas och ersätter
Sprite-läget. Klassisk-vyn behålls som fallback. Lösningen ska inte bero på nätverk, byggsteg
eller nedladdade modeller.

På sikt kan samma visuella system ersättas av riggade lågpolygonmodeller bakom en fast
ortografisk kamera. Canvas-iterationen fungerar då som layout-, tillstånds- och
interaktionsspecifikation.

## Visuella principer

- Något sned vy ovanifrån så huvud, händer och utrustning går att identifiera.
- Lugn grågrön sjukhuspalett, varma hudtoner och tydliga men dämpade rollfärger.
- Mjuka kontakt­skuggor och diskret djup, inte fotorealism eller blank mobilspelsestetik.
- Aktiva roller markeras med fysisk position, händer och verktyg; text är sekundär.
- Diskreta aktivitetsringar och uppgiftsindikatorer används för att visa vem som är upptagen.
- Bestående resultat syns på patienten: plattor, luftväg, infart, slangar, LUCAS och värmetäcke.
- Akuta risker får orange/röd betoning; ROSC och chock behåller tydliga men korta effekter.

## Personer och arbetsankare

En gemensam figurmodell används för läkare, sjuksköterska, undersköterska,
ambulanspersonal, narkosläkare, narkossköterska och kirurg. Rollerna skiljs med färg,
huvudbonad och små tillbehör.

Varje uppgift kopplas till en fysisk arbetsposition runt britsen eller vid en apparat:
huvudända för luftväg, thorax för kompressioner och procedurer, arm/ljumske för infarter,
defibrillatorvagn för laddning och ultraljudsvagn för diagnostik. En person förflyttas eller
riktas mot sitt ankare, håller relevant verktyg och visar uppgiftens förlopp.

## Utrustning

Vyn behöver successivt representera akutbrits och patient, väggmonitor, gasuttag,
defibrillator och plattor, akutvagn, BVM/syrgas/sug, luftvägsutrustning, LUCAS,
infusionsställning och blod/vätska, ultraljud, övervakningsprober, uppvärmning samt
procedurbrickor för invasiva åtgärder.

Slangar och kablar bör vara dynamiska kurvor mellan apparat och patient, inte delar av
statiska bilder.

## Införande

1. Sammanhängande rum, brits, patient, kärnteam och basutrustning.
2. Tydliga tillstånd för kompression, ventilation, defibrillering, infart och ultraljud.
3. Fler verktyg och specialprocedurer.
4. Bedöm läsbarhet och prestanda på desktop och mobil.
5. Ta ställning till om Canvas-formerna ska ersättas av riggad live-3D.

## Begränsningar

- Den första Canvas-versionen är inte slutlig 3D och innehåller inte gånganimationer.
- Medicinsk korrekthet och begriplig interaktion väger tyngre än detaljrikedom.
- Alla runtime-resurser måste fungera via `file://` och under GitHub Pages `/Resus/`.

## Genomförande 2026-07-26

R-015 ersatte den synliga Canvas-dioraman med live-3D enligt steg 5. Rummet, britsen,
patienten, personalen och kärnutrustningen består nu av procedurgenererade Three.js-meshar
bakom en fast ortografisk kamera. Simulatorns tillstånd styr poser, synlighet, slangar,
plattor, LUCAS, luftväg, ultraljud, chock och ROSC. Canvas-versionen ligger kvar som
automatisk fallback om WebGL inte kan starta, och Klassisk-vyn är fortsatt valbar.

Inga externa modeller eller nya datakällor infördes. Framtida detaljarbete kan därför ske
genom att förfina de lokala meshbyggarna utan att ändra simulatorns state- eller
interaktionskontrakt.
