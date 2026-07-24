// ocr.vision.ts
// Blood gas recognition using a vision-capable LLM (the method that produced the
// high-accuracy extraction during development). This REPLACES the old Tesseract
// pipeline. A vision model reads the photo with context — it understands Swedish
// labels, that "vB" means venous, that a shifted column is misaligned, and that
// "KOMM" means no value — which classic OCR cannot do.
//
// Flow:  photo (base64) ──▶ vision model ──▶ plain text ──▶ parseGas() ──▶ inputs
//
// The model is asked to TRANSCRIBE faithfully (not interpret), so the
// deterministic, unit-tested parseGas() remains the single source of mapping
// logic. This keeps behaviour testable and auditable.

import { parseGas, ParsedGas } from './parseGas';

export const ocrAvailable = true;

// The transcription prompt. Deliberately conservative: transcribe, don't infer.
export const TRANSCRIPTION_PROMPT = `You are transcribing a blood gas report from a photo. Output ONLY the text you can read, one analyte per line, in the format "Label Value Unit". Rules:
- Preserve the original labels exactly (Swedish or English), including prefixes like vB-, aB-, P(aB)-, cNa+, etc.
- Preserve decimal commas or dots exactly as printed.
- Keep any leading "*" that marks an out-of-range value.
- If a value is shown as KOMM, Ogiltigt, "< X", "> X", or is blank/uncomputable, write the label followed by that marker verbatim, do NOT invent a number.
- Include the "Provtyp" line (Arteriell/Venös) and any "O2 ... L/min" or "Pt-Oxygen (adm)" line.
- Do not add commentary, headings you can't see, or reference ranges unless printed.`;

export interface VisionConfig {
  // Endpoint that accepts { imageBase64, prompt } and returns { text }.
  // In production this is your server proxy to a vision model (keeps keys safe).
  endpoint: string;
  // Optional fetch override for testing.
  fetchImpl?: typeof fetch;
}

export interface RecognizeResult {
  rawText: string;
  parsed: ParsedGas;
}

/**
 * Send a photo to the vision model and parse the result.
 * `imageBase64` is the bare base64 string (no data: prefix).
 */
export async function recognizeBloodGas(
  imageBase64: string,
  config: VisionConfig
): Promise<RecognizeResult> {
  const doFetch = config.fetchImpl ?? fetch;
  const res = await doFetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, prompt: TRANSCRIPTION_PROMPT }),
  });
  if (!res.ok) throw new Error(`Vision OCR failed: ${res.status}`);
  const data = await res.json();
  const rawText: string = data.text ?? '';
  return { rawText, parsed: parseGas(rawText) };
}

/**
 * Example server-side handler shape (Node/Express), for reference. Your server
 * holds the API key and calls the Anthropic Messages API with the image.
 *
 *   app.post('/ocr/bloodgas', async (req, res) => {
 *     const { imageBase64, prompt } = req.body;
 *     const r = await anthropic.messages.create({
 *       model: 'claude-...-vision',
 *       max_tokens: 1024,
 *       messages: [{ role: 'user', content: [
 *         { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
 *         { type: 'text', text: prompt },
 *       ]}],
 *     });
 *     res.json({ text: r.content.map(c => c.text ?? '').join('\n') });
 *   });
 */
