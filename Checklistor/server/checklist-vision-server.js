// server/checklist-vision-server.js
//
// LOCAL, OFFLINE helper that turns a PHOTO, PDF, or Word (.docx) copy of a
// printed procedure checklist (e.g. a LUCEM-style training sheet with
// "STEG 1/2/3", checkboxes, dosing footnotes) into structured JSON that
// pre-fills the Checklistor custom-checklist editor. Runs a vision model on
// YOUR OWN MACHINE via Ollama, so nothing leaves your network. Mirrors
// Blodgas's server/ocr-server-local.js almost exactly — same idea, different
// prompt and output shape.
//
// Two endpoints, one shared result shape:
//   POST /vision/checklist       { imageBase64 } or { images: [...] } — one photo,
//                                or several PDF pages rendered to images client-side
//                                (js/checklist-vision.js) when a PDF has no real text layer.
//   POST /vision/checklist-text  { text } — raw text already extracted client-side from
//                                a real-text PDF (pdf.js) or a Word doc (mammoth.js).
//                                Same model, just skips the "images" field.
//
// Deliberate safety choice: this ONLY extracts the checklist name/description/
// phases+items. It does NOT try to auto-fill the dosing calculator fields
// (doseLow/doseHigh/conc), even when a dose is visible in the photo (e.g.
// "Carbocain 10 mg/ml, max 5 ml") — getting a weight-based-vs-fixed-dose
// distinction wrong from OCR'd text is exactly the kind of silent error that's
// dangerous in a dosing calculator. Any dosing text in the photo is kept as
// plain checklist-item text instead; add it to the dosing calculator by hand
// in the editor afterwards if you want a working calculation for it.
//
// SETUP (one time, same as Blodgas's local OCR server):
//   1. Install Ollama: https://ollama.com/download
//   2. Pull a vision model, e.g.:  ollama pull qwen2.5vl:7b
//   3. Make sure Ollama is running (serves on http://localhost:11434).
//   4. cd server && npm install
//   5. node checklist-vision-server.js     (listens on :8788 by default —
//      a different port than Blodgas's 8787 so both can run at once)
//
// Then point the Checklistor editor at it: it already defaults to
// http://localhost:8788/vision/checklist (see js/checklist-vision.js).
//
// CONFIG (env vars, all optional):
//   PORT          port to listen on                 (default 8788)
//   OLLAMA_URL    base URL of your Ollama server     (default http://localhost:11434)
//   VISION_MODEL  model tag you pulled above         (default qwen2.5vl:7b)
//   ALLOWED_ORIGIN  CORS origin for the website      (default * — lock down in prod)

import express from 'express';
import cors from 'cors';
import { createLogger } from './logger.js';

const log = createLogger('checklist-vision');

const PORT = process.env.PORT || 8788;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.VISION_MODEL || 'qwen2.5vl:7b';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const KEEP_ALIVE_RAW = process.env.VISION_KEEP_ALIVE || '-1';
const KEEP_ALIVE = /^-?\d+$/.test(KEEP_ALIVE_RAW) ? Number(KEEP_ALIVE_RAW) : KEEP_ALIVE_RAW;
const WARMUP = process.env.VISION_WARMUP !== '0';

function ollamaHeaders(){
  const h = { 'Content-Type': 'application/json' };
  if (OLLAMA_API_KEY) h['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
  return h;
}

// Ask for checklist STRUCTURE only — explicitly told not to populate dosing.
// Delad mellan bild- och textvägen: samma JSON-form och samma regler oavsett om källan
// var ett foto, en PDF-sida (bild eller textlager) eller ett Word-dokument.
const EXTRACTION_RULES = `Strukturera det som JSON med denna EXAKTA form:
{"name":"...", "shortDesc":"...", "checklist":[{"phase":"...", "items":["...", "..."]}]}

Regler:
- "name": ett kort proceduramn (t.ex. "Intraosseös nål").
- "shortDesc": en mening som sammanfattar proceduren.
- Varje huvudsteg/fas i dokumentet (t.ex. "STEG 1: HITTA AKTUELL UTRUSTNING") blir ett objekt i "checklist" med "phase" = en kort svensk rubrik och "items" = en lista med de konkreta punkterna/kryssrutorna under den fasen.
- Om ett steg har numrerade underrubriker (t.ex. "1-Identifiera insticksställe") med egna kryssrutor, slå ihop dem till EN items-lista i samma fas, och inkludera underrubriken i punktens text, t.ex. "Identifiera insticksställe: proximal tibia eller caput humeri".
- Hoppa över administrativa steg utan konkreta understeg (t.ex. en fas som bara säger "Fyll i logdokument" utan kryssrutor) — men om det finns även en kort instruktion, behåll fasen med en enda item-text.
- VIKTIGT: extrahera INTE läkemedelsdosering till ett separat fält — om en dos nämns i texten (t.ex. "Carbocain 10 mg/ml, max 5 ml"), skriv bara med det som en del av den relevanta punktens text, som vanlig text.
- Hitta inte på punkter som inte syns i källan. Skriv allt på svenska.
- Svara ENDAST med giltig JSON, ingen extra text, inga kommentarer, inga \`\`\`-block.`;
const EXTRACTION_PROMPT = `Du tolkar ett foto/scan av en tryckt procedurchecklista från svensk sjukvårdsutbildning (t.ex. ett LUCEM-liknande övningsblad med "STEG 1/2/3", kryssrutor och numrerade punkter), eventuellt över flera sidor.

Läs texten i bilden/bilderna och ${EXTRACTION_RULES}`;
const TEXT_EXTRACTION_PROMPT = (text) => `Du tolkar råtext extraherad ur ett uppladdat dokument (PDF eller Word) som innehåller en procedurchecklista från svensk sjukvårdsutbildning (t.ex. ett LUCEM-liknande övningsblad med "STEG 1/2/3", kryssrutor och numrerade punkter). Extraktionen kan innehålla mindre radbrytnings-/formateringsartefakter, tolka innehållet ändå så gott det går.

TEXT ATT TOLKA:
"""
${text}
"""

${EXTRACTION_RULES}`;

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '40mb' }));   // några PDF-sidor rendrade som bilder väger mer än ett enda foto

function extractJson(raw){
  const trimmed = (raw || '').trim().replace(/^```json\s*|^```\s*|```$/g, '');
  return JSON.parse(trimmed);
}

// Delad av bild- och textvägen: pratar med Ollama, tolkar JSON-svaret och klipper till
// samma resultatform. `images` är valfri (utelämnas helt för den rena textvägen — annars
// försöker en del modeller "läsa" en tom bildlista som en faktisk bild).
async function runExtraction(prompt, images, t0){
  const message = { role: 'user', content: prompt };
  if (images && images.length) message.images = images;
  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: ollamaHeaders(),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: KEEP_ALIVE,
      format: 'json',
      options: { temperature: 0 },
      messages: [message],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    log.error('ollama_http_error', { url: `${OLLAMA_URL}/api/chat`, model: MODEL, status: resp.status, detail: detail.slice(0, 500), ms: Date.now() - t0 });
    return { error: { status: 502, body: { error: 'vision_failed', status: resp.status } } };
  }

  const data = await resp.json();
  const raw = (data?.message?.content || '').trim();
  let parsed;
  try { parsed = extractJson(raw); }
  catch (parseErr) {
    log.error('json_parse_failed', { model: MODEL, rawSnippet: raw.slice(0, 300) }, parseErr);
    return { error: { status: 502, body: { error: 'json_parse_failed', raw: raw.slice(0, 2000) } } };
  }

  const result = {
    name: String(parsed.name || '').slice(0, 200),
    shortDesc: String(parsed.shortDesc || '').slice(0, 500),
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist
      .filter(g => g && typeof g.phase === 'string')
      .map(g => ({ phase: g.phase.slice(0, 100), items: Array.isArray(g.items) ? g.items.filter(i => typeof i === 'string').map(i => i.slice(0, 500)) : [] }))
      : [],
  };
  log.info('vision_ok', { model: MODEL, ms: Date.now() - t0, phases: result.checklist.length });
  return { result };
}

app.post('/vision/checklist', async (req, res) => {
  const t0 = Date.now();
  try {
    // `images` (array, flera PDF-sidor) eller `imageBase64` (en enda bild/foto, bakåtkompatibelt).
    const { imageBase64, images } = req.body || {};
    const imageList = Array.isArray(images) && images.length ? images : (imageBase64 ? [imageBase64] : null);
    if (!imageList) return res.status(400).json({ error: 'imageBase64 or images required' });

    const { result, error } = await runExtraction(EXTRACTION_PROMPT, imageList, t0);
    if (error) return res.status(error.status).json(error.body);
    res.json(result);
  } catch (err) {
    const msg = err?.message || String(err);
    log.error('vision_request_failed', { url: `${OLLAMA_URL}/api/chat`, model: MODEL, ms: Date.now() - t0 }, err);
    const hint = /ECONNREFUSED|fetch failed/i.test(msg)
      ? 'Cannot reach Ollama. Is it running on ' + OLLAMA_URL + ' ? Start Ollama and `ollama pull ' + MODEL + '`.'
      : undefined;
    res.status(502).json({ error: 'vision_failed', hint });
  }
});

// PDF-med-textlager eller Word (.docx) — texten extraheras lokalt i webbläsaren
// (pdf.js / mammoth.js) och skickas hit som ren text, ingen bildanalys behövs.
app.post('/vision/checklist-text', async (req, res) => {
  const t0 = Date.now();
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });

    const { result, error } = await runExtraction(TEXT_EXTRACTION_PROMPT(String(text).slice(0, 20000)), null, t0);
    if (error) return res.status(error.status).json(error.body);
    res.json(result);
  } catch (err) {
    const msg = err?.message || String(err);
    log.error('vision_request_failed', { url: `${OLLAMA_URL}/api/chat`, model: MODEL, ms: Date.now() - t0 }, err);
    const hint = /ECONNREFUSED|fetch failed/i.test(msg)
      ? 'Cannot reach Ollama. Is it running on ' + OLLAMA_URL + ' ? Start Ollama and `ollama pull ' + MODEL + '`.'
      : undefined;
    res.status(502).json({ error: 'vision_failed', hint });
  }
});

app.get('/health', async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { headers: ollamaHeaders() });
    if (!r.ok) throw new Error('tags ' + r.status);
    const { models = [] } = await r.json();
    const names = models.map((m) => m.name || m.model);
    const hasModel = names.some((n) => n === MODEL || n?.startsWith(MODEL.split(':')[0]));
    res.json({ ok: true, ollama: OLLAMA_URL, model: MODEL, modelAvailable: hasModel, installed: names });
  } catch (err) {
    log.error('health_ollama_unreachable', { url: `${OLLAMA_URL}/api/tags` }, err);
    res.status(503).json({ ok: false, ollama: OLLAMA_URL, error: 'ollama_unreachable' });
  }
});

async function warmUp(){
  if (!WARMUP) return;
  process.stdout.write(`  → Warming up "${MODEL}" (loading into memory)… `);
  const t0 = Date.now();
  try {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({ model: MODEL, keep_alive: KEEP_ALIVE }),
    });
    if (r.ok) console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
    else {
      const detail = await r.text().catch(() => '');
      console.log(`skipped (Ollama returned ${r.status}: ${detail.slice(0, 200)})`);
    }
  } catch (err) {
    console.log(`skipped (couldn't reach Ollama at ${OLLAMA_URL}). It will load on first analysis.`);
  }
}

app.listen(PORT, () => {
  console.log(`Checklistor vision server on :${PORT}`);
  console.log(`  → Ollama at ${OLLAMA_URL}, model "${MODEL}" (keep_alive ${KEEP_ALIVE})`);
  console.log(`  → Health: http://localhost:${PORT}/health`);
  log.info('startup', { port: String(PORT), ollama: OLLAMA_URL, model: MODEL });
  warmUp();
});
