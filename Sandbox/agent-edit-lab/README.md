# In-browser agent edit lab

## Fråga

Hur känns det om en besökare beskriver en frustration i en chatt, ser agentens ändring direkt
och skickar ett strukturerat förslag till projektägaren i stället för ett vanligt mejl?

## Körning

Öppna `index.html` direkt via `file://`. Klicka på ett markerbart element i den Resus-liknande
HLR-förhandsvisningen och skriv till exempel:

- `Gör patienten större`
- `Flytta läkaren lite åt vänster`
- `Flytta utrustningen närmare britsen`
- `Gör rummet mörkare`
- `Dölj statusraden`

Ändringar sparas som ett lokalt utkast i `localStorage`. **Håll för original** visar
ursprungsläget. Granskningspaketet kan kopieras eller laddas ner som JSON.

## Medvetet utelämnat

- Ingen språkmodell eller server är ansluten. En liten regelmotor ger en säker, snabb känsla för
  interaktionen utan att en API-nyckel hamnar i en publik statisk sida.
- Förhandsvisningen efterliknar HLR men laddar inte produktionssidan.
- Ingen skärmbild, Git-diff, issue eller pull request skapas automatiskt.
- Agenten får bara ändra en allowlist av visuella egenskaper. Den kan inte köra godtycklig
  JavaScript, läsa inloggningsdata eller skriva till repot.

## Vad räknas som framgång?

Experimentet är lovande om användaren intuitivt förstår markering → samtal → iteration →
före/efter → granskningspaket, och om paketet ger tillräckligt underlag för att en utvecklare
ska kunna återskapa önskemålet.

Nästa produktionssteg skulle kräva ett separat beslut om autentisering, integritet, kostnad,
serverbaserad modellåtkomst, verklig sidisolering och hur förslag tas emot. Ingen kod härifrån
flyttas till produktion enbart för att experimentet fungerar.
