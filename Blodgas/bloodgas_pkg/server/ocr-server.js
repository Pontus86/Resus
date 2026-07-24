// server/ocr-server.js
//
// Minimal, production-shaped proxy that turns a blood gas PHOTO into TEXT using
// Claude's vision API. The app/website POSTs a base64 image here; this server
// holds the API key (never the client) and returns the transcribed text, which
// the client then feeds to parseGas().
//
// WHY A SERVER AT ALL:
//   An API key embedded in an Expo app or a web page can be extracted from the
//   bundle by anyone and used to run up your bill. The key must live server-side.
//
// SETUP:
//   1. cd server && npm install
//   2. Get an API key from https://console.anthropic.com  → Settings → API Keys
//   3. Put it in an environment variable (do NOT hard-code it):
//        export ANTHROPIC_API_KEY=sk-ant-...
//   4. node ocr-server.js          (listens on :8787 by default)
//
// Then point the app/website at it:  endpoint = "http://localhost:8787/ocr/bloodgas"
// (use your real https URL once deployed — see DEPLOY notes at the bottom).

import express from 'express';
import { createLogger } from './logger.js';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.OCR_MODEL || 'claude-opus-4-8'; // strong vision model
const log = createLogger('cloud');

// The key is read from the environment by the SDK automatically.
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable. Set it before starting.');
  process.exit(1);
}
const anthropic = new Anthropic();

// This is the SAME transcription prompt as core/ocr.vision.ts — keep them in sync.
const TRANSCRIPTION_PROMPT = `You are transcribing a blood gas report from a photo. Output ONLY the text you can read, one analyte per line, in the format "Label Value Unit". Rules:
- Preserve the original labels exactly (Swedish or English), including prefixes like vB-, aB-, P(aB)-, cNa+, etc.
- Preserve decimal commas or dots exactly as printed.
- Keep any leading "*" that marks an out-of-range value.
- If a value is shown as KOMM, Ogiltigt, "< X", "> X", or is blank/uncomputable, write the label followed by that marker verbatim — do NOT invent a number.
- Include the "Provtyp" line (Arteriell/Venös) and any "O2 ... L/min" or "Pt-Oxygen (adm)" line.
- Do not add commentary, headings you can't see, or reference ranges unless printed.`;

const app = express();
app.use(cors());                          // lock this down in production (see notes)
app.use(express.json({ limit: '12mb' })); // base64 images are large

app.post('/ocr/bloodgas', async (req, res) => {
  const t0 = Date.now();
  try {
    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg', // png/jpeg/gif/webp
                data: imageBase64,                      // RAW base64, no data: prefix
              },
            },
            { type: 'text', text: TRANSCRIPTION_PROMPT },
          ],
        },
      ],
    });

    // content is an array of blocks; concatenate the text blocks.
    const text = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    const ms = Date.now() - t0;
    const usage = message.usage || {};
    log.info('ocr_ok', { model: MODEL, ms, chars: text.length, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens });
    await log.capture({ ms, model: MODEL, text, usage }, imageBase64, mediaType);

    res.json({ text });
  } catch (err) {
    log.error('vision_ocr_failed', { model: MODEL, ms: Date.now() - t0 }, err);
    res.status(502).json({ error: 'vision_ocr_failed' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL }));

app.listen(PORT, () => {
  console.log(`Blood gas OCR proxy listening on :${PORT} (model: ${MODEL})`);
  console.log(`  → Failures logged to: ${log.file}`);
  log.info('startup', { port: String(PORT), model: MODEL });
});

// ---------------------------------------------------------------------------
// DEPLOY NOTES
// - Hosting: any Node host works (Render, Railway, Fly.io, a small VPS, AWS
//   Lambda behind API Gateway, Cloudflare Workers with the fetch version, etc.).
// - Set ANTHROPIC_API_KEY as a secret/env var in the host's dashboard — never in
//   the repo.
// - CORS: replace cors() with cors({ origin: 'https://your-site.com' }) so only
//   your site can call it. For the mobile app, CORS doesn't apply, but you should
//   still add your own auth (see below).
// - Abuse protection: add a rate limiter (e.g. express-rate-limit) and ideally a
//   lightweight app token/JWT check, so the endpoint isn't an open, billable
//   proxy to your Anthropic account.
// - Privacy: blood gas photos may contain patient identifiers. Don't log image
//   bytes; consider stripping/asking users to cover identifiers; review your
//   data-processing obligations (GDPR/patientdatalagen) before going live.
// ---------------------------------------------------------------------------
