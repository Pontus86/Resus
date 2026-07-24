// server/ocr-server-local.js
//
// LOCAL, OFFLINE alternative to ocr-server.js. Turns a blood gas PHOTO into TEXT
// using a vision model that runs ON YOUR OWN MACHINE via Ollama, so the image
// NEVER leaves your network. No third-party API, no API key, no cloud.
//
// It is a drop-in replacement: it exposes the SAME POST /ocr/bloodgas endpoint
// and returns the SAME { text } shape, so the app and website need no changes,
// just point their OCR endpoint at this server.
//
// ===========================================================================
// WHY LOCAL?
//   Blood gas photos can contain patient identifiers. Sending them to a cloud
//   model is a data-processing event you must justify under GDPR /
//   patientdatalagen. Running the model locally keeps the image on hardware you
//   control, which is far easier to defend. The trade-off: accuracy and uptime
//   are now YOUR responsibility, so validate the model on your real printouts
//   before trusting it, and keep the clinician verify-before-use step.
// ===========================================================================
//
// SETUP (one time):
//   1. Install Ollama (macOS/Windows/Linux):   https://ollama.com/download
//   2. Pull a vision model. Recommended default (good OCR, ~6 GB, runs on a
//      modern laptop GPU or a clinic workstation):
//         ollama pull qwen2.5vl:7b
//      Lighter alternatives if you are short on memory/GPU:
//         ollama pull minicpm-v        (≈ 8B, also strong OCR, mobile-capable)
//         ollama pull llama3.2-vision  (11B, needs more memory)
//      Heavier/more accurate if you have a big GPU:
//         ollama pull qwen2.5vl:32b
//   3. Make sure Ollama is running (it serves on http://localhost:11434).
//   4. cd server && npm install
//   5. node ocr-server-local.js        (listens on :8787 by default)
//
// Then point the app/website at it (same as before):
//   endpoint = "http://localhost:8787/ocr/bloodgas"
//
// CONFIG (all optional, via environment variables):
//   PORT          port to listen on                 (default 8787)
//   OLLAMA_URL    base URL of your Ollama server     (default http://localhost:11434)
//   OCR_MODEL     model tag you pulled above         (default qwen2.5vl:7b)
//   ALLOWED_ORIGIN  CORS origin for the website      (default * — lock down in prod)

import express from 'express';
import cors from 'cors';
import { createLogger } from './logger.js';

const log = createLogger('local');

const PORT = process.env.PORT || 8787;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
//const MODEL = process.env.OCR_MODEL || 'qwen2.5vl:7b';
const MODEL = process.env.OCR_MODEL || 'gemma3:4b';
// Optional API key for Ollama Cloud (https://ollama.com). When set, it is sent
// as a Bearer token so the SAME server can talk to either a LOCAL Ollama
// (no key) or the CLOUD (key required) — see README "Using Ollama Cloud".
// Local Ollama needs NO key; only set this when OLLAMA_URL points at the cloud.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
// Build request headers, adding the Authorization header only when a key is set.
function ollamaHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (OLLAMA_API_KEY) h['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
  return h;
}
// How long Ollama keeps the model in memory after a request. "-1" = never
// unload (snappiest, holds the RAM/VRAM); "30m" etc. also work; "0" unloads
// immediately. Default here: keep it loaded so analyses stay fast.
const KEEP_ALIVE_RAW = process.env.OCR_KEEP_ALIVE || '-1';
// Ollama wants a NUMBER for second/-1 values and a STRING for durations like
// "30m". Passing the string "-1" can trigger a 400, so coerce numerics.
const KEEP_ALIVE = /^-?\d+$/.test(KEEP_ALIVE_RAW) ? Number(KEEP_ALIVE_RAW) : KEEP_ALIVE_RAW;
// Warm the model into memory at startup so the FIRST real analysis isn't the one
// that pays the multi-second/minute load. Set OCR_WARMUP=0 to disable.
const WARMUP = process.env.OCR_WARMUP !== '0';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// SAME transcription prompt as core/ocr.vision.ts and ocr-server.js — keep in sync.
const TRANSCRIPTION_PROMPT = `You are transcribing a blood gas report from a photo. Output ONLY the text you can read, one analyte per line, in the format "Label Value Unit". Rules:
- Preserve the original labels exactly (Swedish or English), including prefixes like vB-, aB-, P(aB)-, cNa+, etc.
- Preserve decimal commas or dots exactly as printed.
- Keep any leading "*" that marks an out-of-range value.
- If a value is shown as KOMM, Ogiltigt, "< X", "> X", or is blank/uncomputable, write the label followed by that marker verbatim, do NOT invent a number.
- Include the "Provtyp" line (Arteriell/Venös) and any "O2 ... L/min" or "Pt-Oxygen (adm)" line.
- Do not add commentary, headings you can't see, or reference ranges unless printed.`;

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '12mb' })); // base64 images are large

app.post('/ocr/bloodgas', async (req, res) => {
  const t0 = Date.now();
  try {
    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    // Ollama's native /api/chat accepts images as an array of RAW base64 strings
    // (no data: prefix) on the message. We use it directly — it is the simplest,
    // most stable local path and needs no extra SDK.
    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        // Keep the model resident in memory between requests so only the FIRST
        // load is slow. Default Ollama unloads after 5 min idle; KEEP_ALIVE
        // ("-1" = never unload) avoids paying the reload cost on later analyses.
        keep_alive: KEEP_ALIVE,
        // Deterministic output is better for OCR: drop the temperature.
        options: { temperature: 0 },
        messages: [
          {
            role: 'user',
            content: TRANSCRIPTION_PROMPT,
            images: [imageBase64], // RAW base64, no "data:image/..;base64," prefix
          },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      log.error('ollama_http_error', { url: `${OLLAMA_URL}/api/chat`, model: MODEL, status: resp.status, detail: detail.slice(0, 500), ms: Date.now() - t0 });
      // 503 if the model isn't pulled / Ollama not running, so the client can hint.
      return res.status(502).json({ error: 'local_ocr_failed', status: resp.status });
    }

    const data = await resp.json();
    const text = (data?.message?.content || '').trim();
    const ms = Date.now() - t0;

    // Always-on, no-patient-data timing log: how long the model took and how
    // much text it produced. This is what tells you if the local model is slow.
    log.info('ocr_ok', { model: MODEL, ms, chars: text.length, lines: text ? text.split('\n').length : 0 });
    // Opt-in capture of the actual data (off by default — see OCR_CAPTURE).
    await log.capture({ ms, model: MODEL, text }, imageBase64, mediaType);

    res.json({ text });
  } catch (err) {
    // ECONNREFUSED here almost always means Ollama isn't running.
    const msg = err?.message || String(err);
    log.error('ocr_request_failed', { url: `${OLLAMA_URL}/api/chat`, model: MODEL, ms: Date.now() - t0 }, err);
    const hint = /ECONNREFUSED|fetch failed/i.test(msg)
      ? 'Cannot reach Ollama. Is it running on ' + OLLAMA_URL + ' ? Start Ollama and `ollama pull ' + MODEL + '`.'
      : undefined;
    res.status(502).json({ error: 'local_ocr_failed', hint });
  }
});

// Health check also reports whether the chosen model is actually available,
// so you can tell "server up but model missing" from "server down".
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

// Preload the model into memory so the first analysis is fast. Ollama loads a
// model when it first receives a request for it; sending an empty prompt with
// keep_alive forces that load now, at startup, instead of on the first photo.
async function warmUp() {
  if (!WARMUP) return;
  process.stdout.write(`  → Warming up "${MODEL}" (loading into memory)… `);
  const t0 = Date.now();
  try {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: ollamaHeaders(),
      // The documented way to preload a model is an EMPTY request: just the
      // model name (and keep_alive), with NO "prompt" key. Sending prompt:""
      // makes some models/Ollama versions reject the call with 400.
      body: JSON.stringify({ model: MODEL, keep_alive: KEEP_ALIVE }),
    });
    if (r.ok) console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s. Analyses will be fast now.`);
    else {
      // Read Ollama's error body — it explains WHY (e.g. unsupported field).
      const detail = await r.text().catch(() => '');
      console.log(`skipped (Ollama returned ${r.status}: ${detail.slice(0, 200)})`);
      log.warn('warmup_http_error', { url: `${OLLAMA_URL}/api/generate`, model: MODEL, status: r.status, detail: detail.slice(0, 500) });
    }
  } catch (err) {
    console.log(`skipped (couldn't reach Ollama at ${OLLAMA_URL}). It will load on first analysis.`);
    log.warn('warmup_unreachable', { url: `${OLLAMA_URL}/api/generate`, model: MODEL }, err);
  }
}

app.listen(PORT, () => {
  console.log(`Blood gas LOCAL OCR server on :${PORT}`);
  console.log(`  → Ollama at ${OLLAMA_URL}, model "${MODEL}" (keep_alive ${KEEP_ALIVE})`);
  console.log(`  → Health: http://localhost:${PORT}/health`);
  console.log(`  → Failures logged to: ${log.file}`);
  log.info('startup', { port: String(PORT), ollama: OLLAMA_URL, model: MODEL, keepAlive: KEEP_ALIVE });
  warmUp(); // fire-and-forget; the server is already accepting connections
});

// ---------------------------------------------------------------------------
// NOTES
// - Privacy: the image is sent only to your local Ollama and is not logged here.
//   This is the whole point — nothing leaves your machine/network.
// - Accuracy: a blood gas printout is clean, structured text, the easiest OCR
//   target, but you OWN accuracy now. Validate on your real printouts; the
//   clinician must still verify every value in the scan-review step before use.
// - Choosing a model: qwen2.5vl:7b is a solid default. If transcription is
//   weak on your printouts, try qwen2.5vl:32b (needs a bigger GPU) or
//   minicpm-v. If you are CPU-only, expect several seconds per image; a small
//   GPU makes it near-instant.
// - Network: to use from another device on the clinic LAN, run this server on a
//   machine with a GPU and set the app/website endpoint to that machine's
//   address. Keep it on the internal network, behind the hospital firewall.
// - Locking down: set ALLOWED_ORIGIN to your site's URL in production, and add a
//   rate limiter / simple token check if the endpoint is reachable by others.
// ---------------------------------------------------------------------------
