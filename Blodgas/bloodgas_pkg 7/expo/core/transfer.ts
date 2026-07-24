// transfer.ts
// Kompakt överföringskod för en blodgas. Packar de sju kärnvärdena (pH, pCO₂,
// HCO₃⁻, BE, Na⁺, K⁺, Cl⁻) till en kort base62-sträng (bokstäver a-z, A-Z och
// siffror 0-9), så att en analys gjord på telefonen snabbt kan flyttas till en
// dator genom att skriva av eller klistra in koden.
//
// Designval:
//  - Sju kärnvärden tas med.
//  - Varje värde lagras som ett heltal = round((värde − min) × skala), inom ett
//    snävt men kliniskt rimligt spann, så att koden blir så kort som möjligt
//    (typiskt 10 tecken för alla sju värden).
//  - Varje fält har en extra "utanför intervall"-plats (sentinel). Ett värde som
//    ligger utanför spannet kodas som sentinel i stället för att tyst klampas;
//    vid avkodning utelämnas då fältet helt, så att ingen vilseleds av ett
//    falskt tal. Värdet markeras i stället i `outOfRange`.
//  - En 7-bitars "present"-mask anger vilka fält som finns med, så att en kod
//    med färre värden blir kortare.
//  - En inledande versal 'B' (Blodgas) gör koden lätt att känna igen.

export interface TransferFields {
  pH?: number;
  pCO2?: number;
  HCO3?: number;
  BE?: number;
  Na?: number;
  K?: number;
  Cl?: number;
}

export interface TransferResult {
  fields: TransferFields;     // värden som rymdes i koden
  outOfRange: (keyof TransferFields)[]; // fält som fanns med men låg utanför spannet
}

// key, min, max, scale (decimals retained). Order is FIXED; never change it once
// codes exist, or old codes would decode wrongly.
const SPEC: { key: keyof TransferFields; min: number; max: number; scale: number }[] = [
  { key: 'pH', min: 6.5, max: 7.9, scale: 100 },
  { key: 'pCO2', min: 1.0, max: 15.0, scale: 10 },
  { key: 'HCO3', min: 2, max: 45, scale: 10 },
  { key: 'BE', min: -35, max: 30, scale: 10 },
  { key: 'Na', min: 100, max: 180, scale: 1 },
  { key: 'K', min: 1.5, max: 9.0, scale: 10 },
  { key: 'Cl', min: 70, max: 140, scale: 1 },
];

const PREFIX = 'B';
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'; // base62

// Number of in-range integer values for a field. The encoded value 0..(inRange-1)
// is a real value; the extra value `inRange` is the out-of-range sentinel, so the
// field's total alphabet size is inRange + 1.
function inRangeCount(s: { min: number; max: number; scale: number }): number {
  return Math.round((s.max - s.min) * s.scale) + 1;
}
function slotCount(s: { min: number; max: number; scale: number }): number {
  return inRangeCount(s) + 1; // +1 for the OOR sentinel
}

function toBase62(n: bigint): string {
  if (n === 0n) return '0';
  let out = '';
  const base = 62n;
  while (n > 0n) {
    out = ALPHABET[Number(n % base)] + out;
    n = n / base;
  }
  return out;
}

function fromBase62(str: string): bigint {
  let n = 0n;
  const base = 62n;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Ogiltigt tecken i koden: ' + ch);
    n = n * base + BigInt(idx);
  }
  return n;
}

/**
 * Encode the seven core values into a compact transfer code.
 * Values outside their range are stored as a sentinel (decoded back as
 * out-of-range, with no number), rather than being silently clamped.
 * Returns '' if nothing encodable was supplied.
 */
export function encodeTransfer(f: TransferFields): string {
  let mask = 0;
  const present: { spec: typeof SPEC[number]; slot: number }[] = [];

  SPEC.forEach((s, i) => {
    const v = f[s.key];
    if (v === undefined || v === null || Number.isNaN(v)) return;
    mask |= 1 << i;
    let slot: number;
    if (v < s.min || v > s.max) {
      slot = inRangeCount(s); // sentinel
    } else {
      slot = Math.round((v - s.min) * s.scale);
    }
    present.push({ spec: s, slot });
  });

  if (present.length === 0) return '';

  let acc = 0n;
  for (const { spec, slot } of present) {
    acc = acc * BigInt(slotCount(spec)) + BigInt(slot);
  }
  acc = acc * 128n + BigInt(mask); // 7-bit mask

  return PREFIX + toBase62(acc);
}

/**
 * Decode a transfer code. Throws on malformed input. Fields whose encoded slot
 * was the out-of-range sentinel are returned in `outOfRange` and omitted from
 * `fields`.
 */
export function decodeTransfer(code: string): TransferResult {
  const trimmed = code.replace(/\s+/g, '').trim();
  if (!trimmed) throw new Error('Tom kod.');
  const body = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
  if (!body) throw new Error('Koden saknar innehåll.');

  let acc = fromBase62(body);

  const mask = Number(acc % 128n);
  acc = acc / 128n;
  if (mask === 0) throw new Error('Koden innehåller inga värden.');

  const presentIdx: number[] = [];
  SPEC.forEach((_, i) => { if (mask & (1 << i)) presentIdx.push(i); });

  const fields: TransferFields = {};
  const outOfRange: (keyof TransferFields)[] = [];

  // Values were packed MSB-first in SPEC order, so unpack LSB-first (reverse).
  for (let j = presentIdx.length - 1; j >= 0; j--) {
    const s = SPEC[presentIdx[j]];
    const sc = BigInt(slotCount(s));
    const slot = Number(acc % sc);
    acc = acc / sc;
    if (slot === inRangeCount(s)) {
      outOfRange.unshift(s.key); // sentinel: value was out of range
      continue;
    }
    const value = s.min + slot / s.scale;
    const decimals = s.scale === 100 ? 2 : s.scale === 10 ? 1 : 0;
    fields[s.key] = Number(value.toFixed(decimals));
  }
  return { fields, outOfRange };
}

/** True if a string looks like a transfer code (cheap pre-check for inputs). */
export function looksLikeTransferCode(s: string): boolean {
  const t = s.replace(/\s+/g, '').trim();
  if (t.length < 2 || t.length > 16) return false;
  if (!t.startsWith(PREFIX)) return false;
  const body = t.slice(1);
  return /^[0-9a-zA-Z]+$/.test(body);
}

/**
 * Insert a single space near the middle so the code is easier to copy by hand
 * (e.g. "Bc3YCFCmcpN" -> "Bc3YC FCmcpN"). Purely cosmetic; decodeTransfer
 * ignores whitespace, so a spaced or unspaced code both decode the same.
 */
export function formatTransfer(code: string): string {
  const t = code.replace(/\s+/g, '');
  if (t.length < 8) return t; // short codes stay as-is
  const mid = Math.ceil(t.length / 2);
  return t.slice(0, mid) + ' ' + t.slice(mid);
}
