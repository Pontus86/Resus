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
