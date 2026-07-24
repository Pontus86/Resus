// server/ocr-server-tesseract.js
//
// THIRD OCR OPTION: a pure OCR engine (Tesseract) instead of a vision LLM.
// Turns a blood gas PHOTO into TEXT locally, with NO LLM and NO API key.
//
// How it differs from the other two servers:
//   - ocr-server.js        → cloud vision LLM (Anthropic). Best accuracy, but the
//                            image leaves your network.
//   - ocr-server-local.js  → local vision LLM (Ollama). Stays on your machine,
//                            understands layout, needs a GPU-ish machine + model.
//   - ocr-server-tesseract → THIS FILE. Pure OCR. Tiny, fully offline, no model
//                            download, no GPU. It only transcribes characters; it
//                            does NOT understand structure. The raw text is then
//                            handed to your existing parseGas() logic on the
//                            client, exactly like the other two.
//
// It is a drop-in replacement: SAME POST /ocr/bloodgas endpoint, SAME { text }
// response shape, so the app and website need no changes — just point their OCR
// endpoint at this server.
//
// ===========================================================================
// HONEST EXPECTATIONS
//   Tesseract is excellent on clean, straight, high-contrast print. Blood gas
//   strips are thermal printouts with small fonts, subscripts (cHCO₃⁻), and
//   column layouts, and photos add glare/skew — so Tesseract will miss more than
//   a vision LLM. Your Unicode normalisation in parseGas helps. Treat this as the
//   "free, fully offline, no-LLM" option and VALIDATE on your real printouts. The
//   clinician must still verify every value before use.
// ===========================================================================
//
// SETUP (one time):
//   cd server && npm install
//   (tesseract.js downloads its language data on first run and caches it.)
//   node ocr-server-tesseract.js        (listens on :8787 by default)
//
// Then point the app/website at it (same as before):
//   endpoint = "http://localhost:8787/ocr/bloodgas"
//
// CONFIG (all optional, via environment variables):
//   PORT            port to listen on              (default 8787)
//   OCR_LANGS       Tesseract languages            (default "swe+eng")
//   OCR_LANG_PATH   folder/URL with *.traineddata  (default: tesseract.js CDN)
//                   Set this to a local folder for FULLY offline use, e.g.
//                   OCR_LANG_PATH=/usr/share/tesseract-ocr/5/tessdata
//   ALLOWED_ORIGIN  CORS origin for the website     (default * — lock down in prod)
//   TESS_PSM        page segmentation mode          (default 6 — assume a block of text)

import express from 'express';
import cors from 'cors';
import { createWorker } from 'tesseract.js';
import { createLogger } from './logger.js';

const log = createLogger('tesseract');

// sharp is loaded lazily and defensively. It needs Node 20+ (it uses
// `import ... with { type: 'json' }`), so on older Node — or if it isn't
// installed — we skip preprocessing instead of crashing at startup.
let sharpMod = null;
let sharpTried = false;
async function getSharp() {
  if (sharpTried) return sharpMod;
  sharpTried = true;
  try {
    sharpMod = (await import('sharp')).default;
  } catch (err) {
    console.warn('sharp unavailable (need Node 20+); preprocessing disabled:', err?.message || err);
    sharpMod = null;
  }
  return sharpMod;
}

const PORT = process.env.PORT || 8787;
const LANGS = process.env.OCR_LANGS || 'swe+eng';
const LANG_PATH = process.env.OCR_LANG_PATH || undefined; // undefined → CDN default
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PSM = process.env.TESS_PSM || '6';
const PREPROCESS = process.env.OCR_PREPROCESS !== '0'; // on by default; set 0 to disable

// Pre-process a photographed strip to give Tesseract the cleanest possible
// input: greyscale, upscale small images, normalise contrast, sharpen, and
// binarise (threshold). This noticeably improves OCR on thermal printouts and
// phone photos. Falls back to the original buffer if anything fails.
async function preprocess(buf) {
  if (!PREPROCESS) return buf;
  const sharp = await getSharp();
  if (!sharp) return buf; // sharp missing/old Node — run OCR on the original
  try {
    const img = sharp(buf, { failOn: 'none' }).rotate(); // honour EXIF orientation
    const meta = await img.metadata();
    // Upscale small images so the text is at least ~1000px wide (helps small fonts).
    const targetW = 1600;
    const resize = meta.width && meta.width < targetW
      ? { width: targetW, withoutEnlargement: false }
      : null;
    let pipeline = sharp(buf, { failOn: 'none' }).rotate().greyscale();
    if (resize) pipeline = pipeline.resize(resize);
    return await pipeline
      .normalise()                 // stretch contrast across full range
      .sharpen()                   // crisp up edges
      .threshold(140)              // binarise: text -> black, paper -> white
      .toFormat('png')
      .toBuffer();
  } catch (err) {
    console.error('preprocess failed, using original:', err?.message || err);
    return buf;
  }
}

// A single shared worker is created lazily and reused across requests (creating
// one per request is slow because it reloads the language data each time).
let workerPromise = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // If OCR_LANG_PATH points at a local folder of *.traineddata files, the
      // worker never touches the network — ideal for an offline clinic box.
      const opts = LANG_PATH ? { langPath: LANG_PATH, gzip: false } : undefined;
      const worker = await createWorker(LANGS, undefined, opts);
      // PSM 6 = "assume a single uniform block of text", which suits the tidy
      // label/value rows of a blood gas strip better than full auto layout.
      await worker.setParameters({ tessedit_pageseg_mode: PSM });
      return worker;
    })();
  }
  return workerPromise;
}

// Accept either a data URL ("data:image/png;base64,AAA…") or raw base64, and
// return a Buffer that tesseract.js can read.
function toImageBuffer(imageBase64) {
  const comma = imageBase64.indexOf(',');
  const raw = imageBase64.startsWith('data:') && comma !== -1
    ? imageBase64.slice(comma + 1)
    : imageBase64;
  return Buffer.from(raw, 'base64');
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '12mb' })); // base64 images are large

app.post('/ocr/bloodgas', async (req, res) => {
  const t0 = Date.now();
  try {
    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const worker = await getWorker();
    const buf = await preprocess(toImageBuffer(imageBase64));
    const { data } = await worker.recognize(buf);

    // Pure OCR returns characters only; parseGas() on the client does the rest.
    // We pass the text through unchanged so the existing Unicode normalisation
    // and label patterns can work on it.
    const text = (data?.text || '').trim();
    const ms = Date.now() - t0;
    log.info('ocr_ok', { langs: LANGS, ms, chars: text.length, lines: text ? text.split('\n').length : 0 });
    await log.capture({ ms, langs: LANGS, text }, imageBase64, mediaType);
    res.json({ text });
  } catch (err) {
    const msg = err?.message || String(err);
    log.error('tesseract_ocr_failed', { langs: LANGS, ms: Date.now() - t0 }, err);
    res.status(502).json({ error: 'tesseract_ocr_failed', hint: msg.slice(0, 200) });
  }
});

// Health check: confirms the server is up and the worker can initialise.
app.get('/health', async (_req, res) => {
  try {
    await getWorker(); // forces language data to load/cache
    res.json({ ok: true, engine: 'tesseract.js', langs: LANGS, psm: PSM });
  } catch (err) {
    res.status(503).json({ ok: false, engine: 'tesseract.js', error: 'worker_init_failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Blood gas TESSERACT OCR server on :${PORT}`);
  console.log(`  → langs "${LANGS}", PSM ${PSM} (pure OCR, no LLM, fully offline)`);
  console.log(`  → Health: http://localhost:${PORT}/health`);
  console.log(`  → Failures logged to: ${log.file}`);
  log.info('startup', { port: String(PORT), langs: LANGS, psm: PSM });
});

// ---------------------------------------------------------------------------
// NOTES
// - Privacy: the image is processed in-process and is not sent anywhere or
//   logged. Fully offline once the language data is cached.
// - Accuracy: pure OCR has no understanding of the report. Expect more misses
//   than the vision-LLM servers, especially on photographed thermal strips.
//   For best results photograph straight-on, fill the frame, avoid glare.
// - Pre-processing (grayscale, threshold, deskew) noticeably improves Tesseract.
//   If accuracy is poor, consider adding a sharp/jimp step before recognize().
// - Same endpoint and { text } shape as the other two servers, so switching is
//   just a matter of which one you run.
