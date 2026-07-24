// server/logger.js
//
// Tiny dependency-free logger shared by all OCR servers. Writes failures (and
// optionally info) to a logfile in the server folder so problems like
// "fetch failed" can be diagnosed after the fact, with full detail.
//
// Each entry is a single JSON line (JSONL) — easy to read by eye and easy to
// grep/parse. Sensitive data (the actual image, API keys) is never logged.
//
// Usage:
//   import { createLogger } from './logger.js';
//   const log = createLogger('local');         // -> server/logs/ocr-local.log
//   log.error('ollama_unreachable', { url, status }, err);
//   log.info('startup', { model });
//
// Config (env):
//   OCR_LOG_DIR    folder for logfiles     (default: <server>/logs)
//   OCR_LOG_LEVEL  'error' | 'info'         (default: 'info')
//   OCR_LOG_CONSOLE '0' to silence console mirroring (default: on)
//
// DATA CAPTURE (opt-in; off by default because this is PATIENT DATA):
//   OCR_CAPTURE    'off' | 'text' | 'image'  (default: 'off')
//                  'text'  also saves the transcribed text + parsed fields
//                  'image' additionally saves the submitted image
//                  Captured records go in <OCR_LOG_DIR>/captures/ as JSON (+ image
//                  files for 'image'). Enabling this stores patient data on disk;
//                  you are responsible for securing and deleting it under
//                  GDPR / patientdatalagen.

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.OCR_LOG_DIR || join(__dirname, 'logs');
const LEVEL = (process.env.OCR_LOG_LEVEL || 'info').toLowerCase();
const CONSOLE = process.env.OCR_LOG_CONSOLE !== '0';
const CAPTURE = (process.env.OCR_CAPTURE || 'off').toLowerCase(); // off | text | image

const LEVELS = { error: 0, warn: 1, info: 2 };

// Pull every useful field off an Error (including the cause chain that Node's
// fetch uses — that's where ECONNREFUSED / ENOTFOUND actually live).
function serializeError(err) {
  if (!err) return undefined;
  if (typeof err === 'string') return { message: err };
  const out = {
    name: err.name,
    message: err.message,
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    address: err.address,
    port: err.port,
  };
  // Node's global fetch wraps the real network error in err.cause.
  if (err.cause) {
    out.cause = {
      name: err.cause.name,
      message: err.cause.message,
      code: err.cause.code,
      errno: err.cause.errno,
      syscall: err.cause.syscall,
      address: err.cause.address,
      port: err.cause.port,
    };
  }
  // Keep a trimmed stack for context without flooding the file.
  if (err.stack) out.stack = String(err.stack).split('\n').slice(0, 6).join('\n');
  // Drop undefined keys for tidiness.
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  if (out.cause) for (const k of Object.keys(out.cause)) if (out.cause[k] === undefined) delete out.cause[k];
  return out;
}

export function createLogger(serverName) {
  const file = join(LOG_DIR, `ocr-${serverName}.log`);
  let dirReady = null;
  const ensureDir = () => (dirReady ??= mkdir(LOG_DIR, { recursive: true }).catch(() => {}));

  async function write(level, event, details, err) {
    if (LEVELS[level] > (LEVELS[LEVEL] ?? 2)) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      server: serverName,
      event,
      ...(details && Object.keys(details).length ? { details } : {}),
      ...(err ? { error: serializeError(err) } : {}),
    };
    const line = JSON.stringify(entry) + '\n';
    if (CONSOLE) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`[${entry.ts}] ${level.toUpperCase()} ${event}`, details || '', err ? `(${err.message || err})` : '');
    }
    try {
      await ensureDir();
      await appendFile(file, line, 'utf8');
    } catch {
      // Never let logging crash the request path.
    }
  }

  // Opt-in capture of a completed analysis. Respects OCR_CAPTURE:
  //   'off'   -> does nothing (default)
  //   'text'  -> saves a JSON record (timing, fields, transcribed text)
  //   'image' -> additionally writes the submitted image alongside it
  // record: { ms, engines?, fields?, text?, type?, meta? }
  // imageBase64/mediaType: only written when OCR_CAPTURE='image'
  async function capture(record, imageBase64, mediaType) {
    if (CAPTURE === 'off') return null;
    try {
      const dir = join(LOG_DIR, 'captures');
      await mkdir(dir, { recursive: true });
      const id = `${serverName}-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
      const json = { ts: new Date().toISOString(), server: serverName, id, ...record };
      if (CAPTURE === 'image' && imageBase64) {
        const ext = (mediaType && mediaType.split('/')[1]) || 'png';
        const imgName = `${id}.${ext.replace(/[^a-z0-9]/gi, '') || 'png'}`;
        const comma = imageBase64.indexOf(',');
        const raw = imageBase64.startsWith('data:') && comma !== -1 ? imageBase64.slice(comma + 1) : imageBase64;
        await writeFile(join(dir, imgName), Buffer.from(raw, 'base64'));
        json.image = imgName;
      }
      await writeFile(join(dir, `${id}.json`), JSON.stringify(json, null, 2), 'utf8');
      return id;
    } catch {
      return null; // never let capture break a request
    }
  }

  return {
    file,
    captureLevel: CAPTURE,
    error: (event, details, err) => write('error', event, details, err),
    warn: (event, details, err) => write('warn', event, details, err),
    info: (event, details) => write('info', event, details),
    capture,
  };
}
