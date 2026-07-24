# Blood Gas OCR server

Turns a blood gas **photo** into **text** so the app and website can fill the
input fields automatically. The client sends a base64 image to this server; the
server runs a vision model that transcribes the printout and returns the text,
which the client then feeds to `parseGas()` and shows in a review modal for the
clinician to confirm.

```
photo → app/website → THIS SERVER → vision model → text
      → client parseGas() → review modal → input fields
```

A vision model is used (not Tesseract) because a blood gas printout needs
*context*: Swedish labels, "KOMM" meaning "no value", out-of-range "*" markers,
and misaligned columns. A model that understands the document handles these; a
character-by-character engine does not.

---

## Three versions — pick one

There are **three interchangeable servers**. All expose the exact same endpoint
(`POST /ocr/bloodgas`) and return the same `{ "text": "..." }`, so the app and
website work with **any one without any code change** — you only choose which to
run.

| | **Cloud** (`ocr-server.js`) | **Local LLM** (`ocr-server-local.js`) | **Tesseract** (`ocr-server-tesseract.js`) |
|---|---|---|---|
| Engine | Claude vision, via Anthropic API | A vision model on **your** machine, via Ollama | Tesseract — pure OCR, **no LLM** |
| Understands layout? | Yes | Yes | No — transcribes characters only |
| Image leaves your network? | Yes — sent to Anthropic | **No** | **No** |
| Needs an API key? | Yes | No | No |
| Needs a GPU? | No | Recommended | No — light, CPU-only |
| Model download | — | Several GB | ~15 MB language data |
| Accuracy on photographed strips | Very high | Good | Lower; best on clean, straight print |
| Cost | Per API call | Free after download | Free |
| Best for | Prototyping, demos, no patient identifiers | **Real patient data, privacy-critical** | **Fully offline, no-LLM, low-resource** |

**For real patient data, use the local LLM, Tesseract, or Ensemble version** —
keeping the image on hardware you control is far easier to defend under GDPR /
patientdatalagen. **Tesseract** is the lightest (no model, no GPU, no LLM). The
**Ensemble** option (Version D below) runs several pure-OCR engines and votes per
field for extra robustness, at higher resource cost. In **all** versions the
clinician must still verify every value in the review step before using it.

How they relate to your parser: all three just produce **text**. The app/website
then runs that text through the same `parseGas()` logic (including the Unicode
subscript normalisation), so a value like `cHCO₃⁻(P,st)c` is handled identically
no matter which server produced the text.

---

## Common setup (all versions)

You need **Node.js 20 or newer**. (The image-preprocessing dependency `sharp`
uses JSON import attributes that require Node 20+; on Node 18 the server will
fail to start with a `SyntaxError: Unexpected token 'with'`.) Check with
`node --version`. If you're on an older Node, upgrade — e.g. `nvm install 20`
— or, as a stopgap, the Tesseract/Ensemble servers still start without `sharp`
and just skip preprocessing.

```bash
cd server
npm install
```

That installs `express` and `cors` (and the Anthropic SDK, used only by the
cloud version). Nothing else is required for the local version.

### Logging (all servers)

Every server writes failures to a logfile in `server/logs/`, one per server:
`ocr-cloud.log`, `ocr-local.log`, `ocr-tesseract.log`, `ocr-ensemble.log`.
Each line is a JSON record with a timestamp, the event, relevant details (URL,
model, status), and the **full error chain** — including the underlying network
cause that Node's `fetch failed` normally hides (e.g. `ECONNREFUSED`,
`ENOTFOUND`). The actual image and any API key are never logged.

Tail a log while testing:
```bash
tail -f server/logs/ocr-local.log
```

A "failed fetch" from the local server almost always shows up here as
`ECONNREFUSED ...:11434`, which means **Ollama isn't running / not reachable** —
start Ollama and `ollama pull` your model.

Config (env): `OCR_LOG_DIR` (default `server/logs`), `OCR_LOG_LEVEL`
(`error`|`info`, default `info`), `OCR_LOG_CONSOLE=0` to stop mirroring to the
console.

### Timing (always on, no patient data)

Every successful analysis writes an `ocr_ok` line with how long it took. This is
the easiest way to see if the local model is slow:
```
{"ts":"…","level":"info","event":"ocr_ok","details":{"model":"qwen2.5vl:7b","ms":4148,"chars":165}}
```
The ensemble server additionally records **per-engine** timings
(`engineMs`), preprocessing time, and how many fields landed at each agreement
level — handy for comparing engines. No image or values are in these lines.

### Capturing the actual data (opt-in — this is patient data)

Off by default. To save the analysed data for debugging or validation, set
`OCR_CAPTURE`:

| `OCR_CAPTURE` | What gets saved to `logs/captures/` |
|---|---|
| `off` (default) | nothing |
| `text` | a JSON record per analysis: timing, transcribed text, parsed fields (and, on the ensemble, each engine's raw text) |
| `image` | the above **plus** the submitted image file |

```bash
OCR_CAPTURE=text  npm run start:local     # save transcriptions, not images
OCR_CAPTURE=image npm run start:ensemble  # also save the photos
```

⚠️ **This stores patient data on disk.** Enabling it makes the server a place
where blood gas images/values live, which you must justify, secure, and delete
under GDPR / patientdatalagen. Keep `logs/` on encrypted storage, restrict
access, and gallra (purge) regularly — e.g. a cron job that deletes
`logs/captures/` files older than N days. Captures and logs are git-ignored, but
that does not make them safe to keep indefinitely.

---

## Version A — Cloud (Claude vision)

Runs the recognition through Anthropic's API. Simplest to start; the image is
sent to Anthropic, so use it only when there are no patient identifiers in the
photo (or you have a data-processing agreement that covers it).

### 1. Get an API key
Create one at <https://console.anthropic.com> → **Settings → API Keys**.

### 2. Put the key in your environment
Never hard-code it in a file or commit it.

```bash
# macOS / Linux
export ANTHROPIC_API_KEY=sk-ant-...

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Start the server
```bash
npm start            # = node ocr-server.js, listens on :8787
# or, auto-restart on edits:
npm run dev
```

### 4. Verify
```bash
curl http://localhost:8787/health
# → { "ok": true, "model": "claude-opus-4-8" }
```

### Configuration (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic key. |
| `PORT` | `8787` | Port to listen on. |
| `OCR_MODEL` | `claude-opus-4-8` | Vision model to use. |

---

## Version B — Local (offline, via Ollama)

Runs the recognition on a model on **your own machine**. The image never leaves
your network. No API key, no per-call cost. This is the recommended option for
real patient data.

### 1. Install Ollama
Download for macOS, Windows, or Linux: <https://ollama.com/download>
After installing, Ollama runs in the background and serves on
`http://localhost:11434`.

### 2. Download a vision model
A blood gas printout is clean, structured text — the easiest OCR target — so a
small model is plenty.

```bash
# Recommended default — good OCR, ~6 GB, Apache-2.0, handles Swedish/English:
ollama pull qwen2.5vl:7b

# Lighter (less memory), also strong OCR:
ollama pull minicpm-v

# Heavier / most accurate, needs a larger GPU:
ollama pull qwen2.5vl:32b
```

| Model | Size | Notes |
|---|---|---|
| `qwen2.5vl:7b` | ~6 GB | **Recommended default.** Best balance for this task. |
| `minicpm-v` | ~5–6 GB | Strong OCR, lighter, even mobile-capable. |
| `llama3.2-vision` | ~8 GB | Solid document OCR; needs more memory. |
| `qwen2.5vl:32b` | ~20 GB | Highest accuracy; needs a big GPU. |

### 3. Start the server
```bash
npm run start:local      # = node ocr-server-local.js, listens on :8787
# or, auto-restart on edits:
npm run dev:local
```

### 4. Verify (this also checks the model is installed)
```bash
curl http://localhost:8787/health
# → { "ok": true, "ollama": "http://localhost:11434",
#     "model": "qwen2.5vl:7b", "modelAvailable": true, "installed": [...] }
```
- `modelAvailable: false` → the server is up but the model isn't pulled. Run the
  `ollama pull` from step 2.
- `"ok": false` / `503` → Ollama itself isn't reachable. Make sure it's running.

### Using Ollama Cloud (no local GPU needed)

If your machine isn't powerful enough to run the model, you can keep this exact
server but have **Ollama's cloud GPUs** do the work. Two ways:

**Option 1 — direct to the cloud (no local Ollama daemon).** Best for testing how
good the hosted vision model is without any local install.
1. Create an account and an API key at `ollama.com/settings/keys` (the free tier
   covers light use; Pro is ~$20/month).
2. Pick a **vision** model from the cloud catalog and use its `:cloud`-capable
   tag, e.g. a Qwen-VL cloud model.
3. Start the server pointing at the cloud, with the key:
   ```bash
   OLLAMA_URL=https://ollama.com \
   OLLAMA_API_KEY=your_key_here \
   OCR_MODEL=qwen2.5vl:7b \
   OCR_WARMUP=0 \
   npm run start:local
   ```
   (`OCR_WARMUP=0` because warm-up/keep-alive are for a local resident model;
   the cloud manages its own.) The server adds the `Authorization: Bearer` header
   automatically whenever `OLLAMA_API_KEY` is set.
4. Check it: `curl http://localhost:8787/health` should list cloud models.

**Option 2 — local daemon proxying to cloud (zero config change).** Install
Ollama locally, run `ollama signin`, and use a model tag with a `-cloud` suffix.
Your server keeps talking to `http://localhost:11434` and Ollama transparently
runs it on cloud GPUs. Useful if you already run Ollama for other things.

**Privacy note (important for patient data):** with either option the image
leaves your network — Ollama hosts compute primarily in the US and may route to
Europe/Singapore. They state prompt/response data is never logged, trained on,
or retained, but US routing is still a GDPR / patientdatalagen consideration.
Use Ollama Cloud for **evaluating accuracy**, and keep a fully local Ollama (or
Tesseract) for real patient data unless your hospital signs off on the cloud.

### Configuration (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `OCR_MODEL` | `qwen2.5vl:7b` | Which model to use (match step 2). |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama is — local, a LAN machine, or `https://ollama.com`. |
| `OLLAMA_API_KEY` | (none) | **Only for Ollama Cloud.** Sent as a Bearer token. Leave unset for local. |
| `OCR_KEEP_ALIVE` | `-1` | How long a LOCAL Ollama keeps the model in memory. |
| `OCR_WARMUP` | on | Preload a LOCAL model at startup. Set `0` for cloud. |
| `PORT` | `8787` | Port this server listens on. |
| `ALLOWED_ORIGIN` | `*` | CORS origin for the website (lock down in prod). |

Example — use a bigger model on a custom port:
```bash
OCR_MODEL=qwen2.5vl:32b PORT=9000 npm run start:local
```

### Speed
On a GPU, transcription is seconds. **CPU-only is the usual reason it feels
slow — sometimes minutes per image for a 7B model.** Check which it's using
while an analysis runs:
```bash
ollama ps      # the PROCESSOR column shows GPU vs CPU
```
If it says CPU and you have no GPU, use a smaller model (e.g. `qwen2.5vl:3b`)
and shrink the image before sending.

**First-analysis lag:** the model loads into memory on first use. This server
now **warms it up at startup** (`OCR_WARMUP`) and keeps it resident
(`OCR_KEEP_ALIVE=-1`), so users don't wait for the load on the first photo and
it doesn't unload between analyses. The trade-off of `-1` is that the model
holds its RAM/VRAM continuously; set e.g. `OCR_KEEP_ALIVE=30m` if you'd rather
free memory after a period of inactivity.

### Using it from other clinic devices
Run the local server on a machine with a GPU, then point the app/website OCR
endpoint at **that machine's address** on your network, e.g.
`http://10.0.0.12:8787/ocr/bloodgas`. Keep it on the internal network, behind
the hospital firewall. Set `ALLOWED_ORIGIN` to your site's URL.

---

## Version C — Tesseract (pure OCR, no LLM)

The lightest option: no model download, no GPU, no API key. Tesseract only
transcribes characters; your `parseGas()` does the interpreting. Best when you
want something fully offline and cheap, and your printouts are clean.

### 1. Install dependencies
```
cd server && npm install
```
`tesseract.js` fetches its language data on first run and caches it. For a
**fully offline** box (no internet at all), download the `*.traineddata` files
once and point the server at them with `OCR_LANG_PATH` (see config below).

### 2. Start the server
```
npm run start:tesseract      # = node ocr-server-tesseract.js, listens on :8787
```

### 3. Verify
```
curl http://localhost:8787/health
# { "ok": true, "engine": "tesseract.js", "langs": "swe+eng", "psm": "6" }
```

### Configuration (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `OCR_LANGS` | `swe+eng` | Tesseract languages |
| `OCR_LANG_PATH` | (CDN) | Folder of `*.traineddata` for fully offline use, e.g. `/usr/share/tesseract-ocr/5/tessdata` |
| `ALLOWED_ORIGIN` | `*` | CORS origin — lock down in production |
| `TESS_PSM` | `6` | Page segmentation mode (6 = a uniform block of text) |

### Getting better accuracy
Tesseract is sensitive to image quality. Photograph the strip straight-on, fill
the frame, and avoid glare. If results are poor, a grayscale + threshold +
deskew pre-processing step (e.g. with `sharp`) before recognition usually helps
a lot. Subscripts like `cHCO₃⁻` are handled downstream by the parser's Unicode
normalisation, but very small or smudged print may still be missed.

> The Tesseract server already pre-processes images automatically (greyscale,
> upscale, contrast, sharpen, threshold). Set `OCR_PREPROCESS=0` to turn it off.

---

## Version D — Ensemble (several OCR engines + majority vote)

Runs several **pure OCR engines** on the same image and votes per analyte for
the most reliable value. No LLM, no API key, fully offline. Engines that aren't
installed are silently skipped, so with Tesseract alone it behaves like Version C.

| Engine | How it runs | Install |
|---|---|---|
| Tesseract | in-process (always on) | included |
| EasyOCR | Python helper | `pip install easyocr` |
| PaddleOCR | Python helper | `pip install paddleocr paddlepaddle` |

### How the vote works
1. The image is pre-processed once and handed to every available engine in parallel.
2. Each engine's raw text is parsed with the **same `parseGas()`** the app uses
   (so subscripts etc. are handled identically).
3. Voting happens **per field**:
   - **exact match** counts as the same vote (near-but-not-equal numbers are
     treated as a real disagreement, not smoothed over);
   - the value with the most votes wins (`unanimous` / `majority`);
   - on a **tie** or total disagreement, a silent **preference order** over
     engines decides (default `paddleocr > easyocr > tesseract`), and the field
     is marked `agreement: 'tie'`;
   - a field only one engine found is marked `single`.

Voting protects against **random** per-engine misreads. It does **not** protect
against a **systematic** misread shared by all engines — so the clinician must
still verify every value.

### Start
```
npm run start:ensemble        # listens on :8787
```

### Verify
```
curl http://localhost:8787/health
# {"ok":true,"engines":{"tesseract":true,"easyocr":true,"paddleocr":false},...}
```

### Response (adds structured data; still backward-compatible)
```json
{
  "text": "pH 7.21\nHCO3 12\n...",
  "fields": { "pH": 7.21, "HCO3": 12 },
  "type": "arterial",
  "meta": { "pH": { "agreement": "unanimous", "votes": 3, "sources": ["..."] } },
  "engines": ["tesseract", "easyocr"]
}
```
Existing clients keep using `text`; new clients can read `meta` to show agreement
and flag `tie` fields for review.

### Configuration (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| `OCR_ENGINES` | `tesseract,easyocr,paddleocr` | which engines to try |
| `OCR_PREFERENCE` | `paddleocr,easyocr,tesseract` | tie-break order, most-trusted first |
| `PYTHON` | `python3` | Python executable for the helpers |
| (plus all Tesseract vars above) | | |

### Resource note
Three engines are heavy — EasyOCR/PaddleOCR each pull in large ML runtimes
(PyTorch / PaddlePaddle), and run slower than Tesseract alone. For a blood gas
strip — clean, structured text — Tesseract with preprocessing is often enough.
Add the extra engines when you specifically want the cross-check.

---

## Pointing the app / website at the server

All servers serve the same endpoint, so this is identical whichever you
run. Set the client's OCR endpoint to:

```
http://localhost:8787/ocr/bloodgas
```

- **Website** (`web/index.html`): set the `OCR_ENDPOINT` constant near the top of
  the script to that URL.
- **App** (`expo/core/ocr.vision.ts`): set the endpoint constant there.

Use your real `https://` URL once deployed. To switch between cloud and local,
just stop one server and start the other — the URL stays the same.

---

## The endpoint

### `POST /ocr/bloodgas`
Request body (JSON):
```json
{
  "imageBase64": "<raw base64, no 'data:image/...;base64,' prefix>",
  "mediaType": "image/jpeg"
}
```
Response:
```json
{ "text": "pH 7,20\npCO2 3,4 kPa\nProvtyp Arteriell\n..." }
```
The client passes `text` to `parseGas()`. One transcription prompt is shared by
both servers and `core/ocr.vision.ts` — if you change it, change it in all three.

### `GET /health`
Quick liveness/diagnostics check (the local version also reports whether the
model is installed).

---

## Security & privacy checklist (before real use)

- [ ] **Prefer the local server for patient data** — the image stays on your
      hardware.
- [ ] **Lock down CORS**: set `ALLOWED_ORIGIN` (local) or replace `cors()` with
      `cors({ origin: 'https://your-site.com' })` (cloud) so only your site can
      call it.
- [ ] **Add a rate limiter** (e.g. `express-rate-limit`) and a simple token/JWT
      check so the endpoint isn't an open proxy.
- [ ] **Don't log image bytes.** Neither server logs them; keep it that way.
- [ ] **Cloud only:** keep `ANTHROPIC_API_KEY` in a secret/env var, never in the
      repo; an embedded key can be extracted from a client bundle and abused.
- [ ] **Review your obligations** under GDPR / patientdatalagen, and have
      clinicians cover or avoid patient identifiers in the photo where possible.
- [ ] **Verify-before-use stays on.** OCR can misread; the review modal where the
      clinician confirms each value is the safety net for both versions.

## Deploying the cloud version
Any Node host works (Render, Railway, Fly.io, a small VPS, AWS Lambda behind API
Gateway, etc.). Set `ANTHROPIC_API_KEY` as a secret in the host's dashboard, put
it behind HTTPS, and apply the checklist above. The local version is meant to run
on your own machine/LAN, not a public host.
