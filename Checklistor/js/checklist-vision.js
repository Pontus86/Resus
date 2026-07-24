/* ---------- Dokumenttolkning: foto/PDF/Word av en tryckt checklista -> strukturerat förslag ---------- */
/* Kräver en lokal server (server/checklist-vision-server.js) som pratar med Ollama —
   se den filens header för uppstart. Ren "best effort": om servern inte svarar visas
   ett tydligt felmeddelande och man kan alltid fylla i formuläret för hand istället.
   OBS: extraherar bara namn/beskrivning/checklista, ALDRIG dosberäkningsfält — se
   server-filens kommentar för varför.

   Tre källformat, tre vägar in till samma server-JSON-form ({name, shortDesc, checklist}):
   - Bild (foto/skärmdump): bas64 rakt till vision-modellen, som förut.
   - Word (.docx): ingen bild att tolka — texten extraheras lokalt med mammoth.js och
     skickas som RÅTEXT till en textprompt (samma modell, ingen bildanalys behövs).
   - PDF: kan vara ENTINGEN ett riktigt textdokument ELLER en inskannad bild sparad som
     PDF (t.ex. ett fotograferat pappersark) — det syns inte utifrån på filändelsen.
     Vi provar därför textlagret först (pdf.js); ser det ut som verklig text (mer än en
     handfull tecken per sida) skickas den vägen. Är textlagret tomt/nästan tomt (typiskt
     för en skannad bild) renderas sidorna i stället till bilder och skickas genom samma
     vision-väg som ett foto — image.js/mammoth kan inte "läsa" en bild, men vision-modellen kan. */
const CHECKLIST_VISION_ENDPOINT = "http://localhost:8788/vision/checklist";
const CHECKLIST_VISION_TEXT_ENDPOINT = "http://localhost:8788/vision/checklist-text";
const PDF_MAX_PAGES = 6;              // tak för både textextraktion och bildrendering (lugnt för en checklista)
const PDF_TEXT_MIN_CHARS_PER_PAGE = 25; // under detta snitt räknas PDF:en som "ingen riktig text", falla tillbaka till bilder

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const comma = result.indexOf(",");
      resolve(comma !== -1 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileKind(file){
  const name = (file.name || "").toLowerCase();
  if(file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if(name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if((file.type || "").startsWith("image/")) return "image";
  throw new Error("Filtyp stöds inte — välj en bild, PDF eller .docx-fil.");
}

async function analyzeChecklistImage(file){
  const imageBase64 = await fileToBase64(file);
  const resp = await fetch(CHECKLIST_VISION_ENDPOINT, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({imageBase64, mediaType: file.type || "image/jpeg"})
  });
  if(!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

async function analyzeChecklistImages(imagesBase64, mediaType){
  const resp = await fetch(CHECKLIST_VISION_ENDPOINT, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({images: imagesBase64, mediaType: mediaType || "image/png"})
  });
  if(!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

async function analyzeChecklistText(text){
  const resp = await fetch(CHECKLIST_VISION_TEXT_ENDPOINT, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({text})
  });
  if(!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

async function extractDocxText(file){
  if(!window.mammoth) throw new Error("mammoth.js kunde inte laddas.");
  const arrayBuffer = await file.arrayBuffer();
  const {value} = await window.mammoth.extractRawText({arrayBuffer});
  return (value || "").trim();
}

async function loadPdf(file){
  if(!window.pdfjsLib) throw new Error("pdf.js kunde inte laddas.");
  const arrayBuffer = await file.arrayBuffer();
  return window.pdfjsLib.getDocument({data: arrayBuffer}).promise;
}

async function extractPdfText(pdf){
  const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
  const parts = [];
  for(let i = 1; i <= pages; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map(it => it.str).join(" "));
  }
  return parts.join("\n\n").trim();
}

async function renderPdfPagesToImages(pdf){
  const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
  const images = [];
  for(let i = 1; i <= pages; i++){
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({scale: 2});
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({canvasContext: canvas.getContext("2d"), viewport}).promise;
    images.push(canvas.toDataURL("image/png").split(",")[1]);
  }
  return images;
}

/* Enda ingången editorn behöver — döljer vilken av de tre vägarna som faktiskt användes. */
async function analyzeChecklistDocument(file, onStatus){
  const kind = fileKind(file);
  if(kind === "image"){
    onStatus && onStatus("Analyserar bild…");
    return analyzeChecklistImage(file);
  }
  if(kind === "docx"){
    onStatus && onStatus("Läser Word-dokumentet…");
    const text = await extractDocxText(file);
    if(!text) throw new Error("Kunde inte hitta någon text i Word-dokumentet.");
    onStatus && onStatus("Analyserar text…");
    return analyzeChecklistText(text);
  }
  // kind === "pdf": prova textlagret först, falla tillbaka till bildrendering av sidorna.
  onStatus && onStatus("Läser PDF:en…");
  const pdf = await loadPdf(file);
  const text = await extractPdfText(pdf);
  const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
  if(text.length >= pages * PDF_TEXT_MIN_CHARS_PER_PAGE){
    onStatus && onStatus("Analyserar text…");
    return analyzeChecklistText(text);
  }
  onStatus && onStatus("Ingen riktig text hittad (troligen ett inskannat foto) — tolkar sidorna som bilder…");
  const images = await renderPdfPagesToImages(pdf);
  return analyzeChecklistImages(images, "image/png");
}
