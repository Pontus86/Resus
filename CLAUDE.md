# Resus

Svensk akutsjukvårdsplattform: fristående, fria träningsmoduler för akutsjukvårdspersonal.
Byggd och underhållen av Pontus Olsson (läkare). Se `about.html` för fullständig bakgrund,
per-modul-motivering och datakällekrediteringar — läs den innan du skriver om syftet med
någon modul.

## Arkitektur — läs detta innan du ändrar något

- **Ingen build-process, inget bundlingsteg.** Rena `.html`/`.js`/`.css`-filer, öppnade direkt
  som `file://` i webbläsaren. Inget npm/webpack/vite i produktionsvägen.
- **Global scope, `<script src>`-ordning spelar roll.** Varje modul laddar sina JS-filer som
  vanliga globala `<script>`-taggar i en specifik ordning (data-filer före logik-filer före
  `main.js`). Att lägga till en ny fil kräver en ny `<script src>`-rad i modulens `index.html`
  — det finns inga ES-moduler/imports.
- **`file://` begränsar vad som funkar.** Ingen `fetch()` mot lokala filer (blockeras av
  webbläsarens same-origin-policy för `file://`), ingen ES-modul-baserad `pdf.js`, inga
  klickbara magic-link-mail (webbläsaren vägrar navigera toppfönstret från en https-sida
  till en `file://`-URL). Lösningen genomgående: bädda in data direkt som JS
  (`window.NÅGOT_OBJ = "..."`) i stället för att hämta den, och kod-baserad (inte länk-baserad)
  e-postverifiering för inlogg.
- **Delad infrastruktur i roten**, inkluderad relativt (`../` eller `../../../` beroende på
  djup) från varje modul:
  - `css/theme.css` — delat designsystem (färger, `.card`, `.rs-btn`, `.rs-nav` osv.).
    Modul-specifik CSS går i modulens egen `css/styles.css`, ovanpå detta.
  - `nav.js` — den fällbara vänster-sidopanelen som listar alla moduler. Har sin EGEN
    hårdkodade `MODULES`-array — glöm inte lägga till nya moduler här OCKSÅ (utöver
    root-`index.html`:s kortgrid), annars saknas de i sidopanelen på alla andra sidor.
  - `auth.js` + `lib/supabase.js` + `sql/membership.sql` — delat Supabase-inlogg (kod i
    mail, inte länk, se ovan). Exponerar globalt `Auth`-objekt. Använd DETTA (inte
    hand-rullade `fetch()`-anrop bara med anon-nyckeln) när en modul ska skriva/läsa mot
    Supabase under Row-Level-Security — annars ser RLS ingen inloggad användare.
  - `stats.js`/`stats.html` — kontobunden historik, läser (skriver aldrig) från HLR/EKG-spelet/
    Checklistors Supabase-tabeller.
  - `about.html` — sitewide om-sida: bio, per-modul-motivering, datakällekrediteringar.
    Uppdatera denna när en modul får en ny extern datakälla eller ändrar syfte väsentligt.

## Moduler

| Modul | Entry | Vad |
|---|---|---|
| HLR | `HLR/ahlr.html` | A-HLR-simulator, ERC 2025-algoritm |
| Blodgas | `Blodgas/bloodgas_pkg/web/index.html` | Blodgastolkning, egen "Om"-sida med metodreferens |
| EKG | `EKG/index.html` | STEMI-tränare + matchningsspel (se nedan) |
| Neuro | `Neuro/index.html` | NIHSS-lokalisation + Simulator (3D hjärna/ryggmärg/nervbanor/reflexer/kärnor) |
| Kropps-atlas | `Kroppsatlas/index.html` | Full 3D-kropp: skelett/muskler/nerver/kärl/organ/hud |
| Checklistor | `Checklistor/index.html` | Procedurchecklistor + dosberäkning + journalförslag |
| Toxidrom | `Toxidrom/index.html` | Toxidrom-differentialdiagnos |
| Loggbok | `Loggbok/index.html` | Procedurloggning, CSV-export/import |

## Neuro & Kropps-atlas: 3D-specifikt

Båda delar THREE.js r149 (UMD, `lib/three.min.js` + `lib/OBJLoader.js`, ingen CDN) och samma
grundteknik: geometri bäddas in som stora JS-strängar (`window.BRAIN3D_OBJ[kategori]` /
`window.BODY3D_OBJ[system]`), parsas med `OBJLoader.parse()` vid sidladdning eftersom
`fetch()` inte funkar över `file://`.

- **Koordinatrymd**: allt utgår från BodyParts3D:s råa mm-koordinater (Neuro:s
  `BRAIN3D_CENTER`/`BRAIN3D_SCALE`/`BRAIN3D_ROTATION`, återanvända rakt av i Kropps-atlas som
  `BODY3D_*`). Data från en ANNAN källa (Open3DModel/anatomytool.org, meter-baserat) måste
  kalibreras in i samma rymd FÖRST — se `SCALE=952.35, OFFSET_X/Y/Z` i merge-scripten
  (skalfaktorn hittades genom att matcha sacrum/L5-kotans bounding box mellan källorna, inte
  gissad).
- **Två renderingsstilar, medvetet valda per användningsfall**: Neuro fuserar vissa kategorier
  till EN sammanhängande yta (t.ex. `peripheral_nerves.js` — inget enskilt namn behövs, bara
  "visa/dölj"), medan Kropps-atlas BEHÅLLER `o `-rader i den sammanslagna OBJ-texten så
  `OBJLoader` delar upp varje del som en egen `Mesh` — nödvändigt där (~2000 individuellt
  sökbara/klickbara delar), överkill i Neuro.
- **Mirroring**: källdata är ofta ensidig (`.r`-suffix, eller i `hand.obj`:s fall INGET suffix
  alls trots att hela bunten bara är höger hand — kolla alltid om ett bibliotek verkligen är
  bilateralt innan du antar att ett namn utan sidsuffix betyder "redan komplett").
- Nya externa 3D-källor: dokumentera licens/attribution i `about.html`, inte bara i kod-
  kommentarer.

## EKG-modulen: två separata lägen

`Simulator` (fri lek, reglage för fynd) och `Game` (matchningsspel: mål-profil, klick-baserad
poäng) är HELT separat state (`Simulator`/`Game`, `js/simulator.js`/`js/game.js`) som råkar
återanvända samma `.cond-btn`-knappar — vilket `toggle()`-anrop en klick routas till avgörs av
`Game.isActive()`. Felklicksstraff, klicklogg och pixel-baserad normalisering
(baseline = träffbild jämfört med "inget valt", inte ett rått pixeltal) hör till `Game`.

## Testning

Ingen testrunner. Verifiering sker via Playwright-skript mot den lokala `file://`-sidan
(installera med `npx playwright install chromium` om cachen saknas — se disknoten nedan).
Kända fallgropar:
- `page.waitForFunction(fn, arg, options)` — andra argumentet är `arg` till funktionen, INTE
  options. Glöm inte `null` som mellanled om du bara vill sätta `timeout`.
- Stora inbäddade 3D-modeller kan ta 30–90 sekunder att parsa vid sidladdning — vänta på ett
  explicit `loaded`-flagg (t.ex. `brain3d.loaded`/`body3d.loaded`), inte en fast timeout.
- Den delade `.bd-head`-panelen kan täcka flikknappar vid vissa fönsterstorlekar — klicka via
  `page.evaluate(() => document.querySelector(sel).click())` i stället för Playwrights egen
  `.click()` när det strular.

## Git

Repot fick sin första commit 2026-07-24 (fanns ingen versionshantering innan dess). `Models/`
(råa källbibliotek, ~1.9GB, regenererbara) och `Blodgas/Blodgas_old_android_app/` (egen separat
git-repo med 299 commits och en egen GitHub-remote, `github.com/Pontus86/Blodgas.git`) är
gitignorade medvetet — se `.gitignore`. Skapa en NY commit efter större ändringar (inte bara
`--amend`), särskilt före riskabla ombyggnader (t.ex. en hel merge-pipeline-omkörning) så det
finns en känd bra punkt att gå tillbaka till.

## Diskutrymme

Det här projektets scratchpad/Playwright-cache/modellnedladdningar har upprepat fyllt disken
till <1 GB fritt under en session (stora `.obj`-bibliotek, `ms-playwright`-cachen på ~550 MB).
Kolla `df -h /` innan du drar igång en stor nedladdning eller ett nytt Playwright-installs, och
städa bort redan uppackade zip-filer/temporära källfiler så snart en merge är klar och verifierad
— inte bara i scratchpad, `Models/`-mappen räknas också.

## Verktygsuppsättning (Claude Code)

- `.claude/settings.json` + `.claude/hooks/check-disk.sh`: varnar (blockerar inte) efter varje
  Bash-anrop om disken har <1GB fritt — se "Diskutrymme" ovan för varför.
- `.mcp.json`: Playwright MCP-server tillagd (`@playwright/mcp`) — kräver ett engångsgodkännande
  (prompt) första gången `claude` körs i denna mapp efter att filen lagts till.
- `/context` (tokenanvändning) och `/tasks` (bakgrundsjobb) är inbyggda kommandon, inget att
  installera.

## Kodstil

- Kommentarer på svenska genomgående, förklarar VARFÖR (dolda antaganden, tidigare buggar,
  medvetna avvägningar) — inte VAD koden gör. Följ detta i nya filer.
- Inga onödiga abstraktioner för engångskod. Tre liknande rader är bättre än en för tidig
  generalisering.
