# HLR-rummet i Blender

`hlr-room.blend` är den visuella layoutkällan för HLR-simulatorns 3D-rum. Du kan flytta,
rotera och skala de namngivna rotobjekten och spotlightsen utan att redigera JavaScript-
koordinater.

## Säker arbetsgång

1. Öppna `hlr-room.blend` i Blender 4.3 eller senare.
2. I Outliner: öppna samlingen **LAYOUT_CONTROLS**.
3. Markera ett orange kontrollobjekt med namn som `doctor`, `bed`, `defib` eller
   `ultrasound`. Flytta, rotera eller skala kontrollen med **G**, **R** och **S**. Ändra inte
   dess namn eller `hlr_role`-egenskap.
4. Flytta spotlights och deras mål i samlingen **LIGHTS** om ljussättningen ska ändras.
5. Spara Blender-filen.
6. Kör från reporoten:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  HLR/blender/hlr-room.blend \
  --python HLR/blender/export_hlr_layout.py
```

7. Kontrollera diffen i `HLR/js/room3d-layout-data.js` och testa HLR-sidan.

Exporten är deterministisk och innehåller bara transformdata, kamera och ljusinställningar.
Blender-modellerna är visuella proxyer för komposition. Simulatorns animerade geometri,
raycasting, spelregler, bloom och tillstånd ligger fortfarande i `HLR/js/room3d.js`.

## Återskapa källscenen

`create_hlr_room.py` bygger om standardscenen från grunden. Det kommandot skriver över
`hlr-room.blend` och ska därför bara användas när en avsiktlig återställning önskas:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python HLR/blender/create_hlr_room.py
```

Vanliga layoutändringar ska göras direkt i `.blend`-filen, inte genom att ändra generatorn.

## Riggad personalmodell

`hlr-staff-rig.blend` innehåller den gemensamma kliniska personmodellen och armaturen
`HLR_STAFF_RIG`. Benen kan provas i Pose Mode. Bennamn, mesharnas `hlr_bone` och
`hlr_material` är exportkontrakt och får inte ändras utan motsvarande runtime-migrering.

Efter en avsiktlig modelländring:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  HLR/blender/hlr-staff-rig.blend \
  --python HLR/blender/export_hlr_staff_rig.py
```

Exporten bäddar in restarmatur och lågpolymeshar i
`HLR/js/room3d-staff-rig-data.js`. Inga Blender-filer laddas av webbsidan.

Action Editor innehåller `HLR_Compression` och `HLR_Ventilation`. Deras namngivna
kurvor styr framåtlutning, kontaktfas och blåskompression i webben. Samlingen
`CONTACT_POINTS` markerar handflatornas verkliga kontaktpunkt; runtime använder
tvåbens-IK så dessa möter patientens motsvarande ankare utan att händerna går
igenom thorax, mask eller blåsa.

## Riggad patient och kliniska ankare

`hlr-patient-rig.blend` innehåller den liggande patienten. Samlingen
`CLINICAL_ANCHORS` äger fästpunkterna för sternum, kompressionshänder, masktätning,
ventilationsblåsa, defibrillatorplattor, infart och ultraljud. Ändra inte benens
eller ankarnas namn.

Kroppsformen kommer från Kropps-atlasens BodyParts3D-hud. Generatorn läser den
spårade `Kroppsatlas/models/body/skin.js`, lägger modellen i ryggläge, reducerar
den till en webbanpassad yta och skapar riggvikter samt en separat patientskjorta
och ett redigerbart hårskal. Sclera, iris, cornea och ögonbryn hämtas vid
återskapande från den ignorerade, uppackade 2018-samlingen. Om den inte finns i
projektets `Models/` kan `RESUS_BODY_PARTS_ROOT` peka på mappen
`BodyParts3D_20181210i412_full`. De tunga Atlas-ytorna exporteras alltså aldrig
oförändrade till HLR-sidan.

Patientkläderna är separata lågpolymeshar: axelok, korta ärmar, två öppna
sidopaneler, en mittpanel, byxor och ett lakan över bäcken/ben. Mittpanelen visas
vid ankomst men döljs när kompressioner, defibrillatorplattor eller LUCAS
påbörjas. Axelok och ärmar ligger kvar, medan thorax exponeras och byxorna
fortsätter täcka patienten under lakanet.

Generatorn projicerar klädernas synliga ytor mot den ryggliggande Atlas-huden och
lägger dem med ett positivt säkerhetsavstånd. Vid återskapande provas samtliga
vertices samt kanternas mittpunkter och polygonernas centrum. Genereringen avbryts
om någon provpunkt ligger i eller för nära kroppen; byxorna byggs tätare och med
större tygmån eftersom de ska ligga löst under lakanet.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  HLR/blender/hlr-patient-rig.blend \
  --python HLR/blender/export_hlr_patient_rig.py
```

Exporten skriver `HLR/js/room3d-patient-rig-data.js`. Bröstbenets rörelse och all
ansluten utrustning kan därmed använda samma anatomiska referenspunkter.

## Apparatdetaljer

`hlr-equipment-details.blend` innehåller separata rotobjekt för defibrillator,
ultraljud, ventilator och LUCAS. Detaljerna läggs ovanpå apparaternas befintliga
state-styrda runtimegeometri, så skärmar, lampor, kablar, kolv och raycastytor
fortsätter att följa spelet.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  HLR/blender/hlr-equipment-details.blend \
  --python HLR/blender/export_hlr_equipment_details.py
```

Exporten skriver `HLR/js/room3d-equipment-detail-data.js`. Ändra inte
`hlr_equipment_role` eller `hlr_part` utan en motsvarande runtimeändring.
