// parseGas.ts
// Converts recognized text from a blood gas report (LIMS table or Radiometer
// printout, Swedish or English) into structured app inputs.
//
// This is the deterministic, unit-tested core of the OCR feature. It is
// independent of HOW the text/values were recognized — a vision-model API
// (recommended, see ocr.vision.ts) or a classic OCR engine both feed into here.
//
// Design: each target field has a list of label patterns (Swedish + English +
// analyser variants). For each line of text we find "label : value" or
// "label value" and map it. Values may use comma or dot decimals and may carry
// a leading "*" (out-of-range flag) which we strip but record.

export type SampleType = 'arterial' | 'venous';

export interface ParsedField {
  key: string;          // app input key (pH, pCO2, Na, ...)
  value: number;
  flagged: boolean;     // source marked it out of range ("*")
  rawLabel: string;     // the label text we matched
  rawValue: string;     // the value text we matched
}

export interface ParsedGas {
  type: SampleType | null;
  fields: Record<string, ParsedField>;
  // Convenience: plain key->number for feeding the calculator/inputs.
  values: Record<string, number>;
  // Anything we saw but couldn't confidently map (for debugging/telemetry).
  unmatched: string[];
  // Values present in source but invalid/uncomputable (KOMM, Ogiltigt, >range).
  invalid: string[];
}

// Tokens that mean "no numeric value" in Swedish lab systems.
const INVALID_TOKENS = /\b(KOMM|Ogiltigt?|saknas|över\s*mätområde|under\s*mätområde)\b/i;

// Field definitions. Order matters: more specific labels first so e.g.
// "St.Bikarbonat" matches stdBicarb before a looser "Bikarbonat".
interface FieldDef {
  key: string;
  // Each pattern must capture the value in group 1 when used with valueAfter().
  labels: RegExp[];
}

const NUM = String.raw`\*?\s*(-?\d+(?:[.,]\d+)?)`;

// A label may be followed by junk like "(37°C)", "(37 C)", "(PNA)", "(Blodgas)",
// "(enz)", units, or reference text before the value. Skip parenthetical groups
// and short non-numeric runs, but DON'T cross a "<" or ">" (means non-numeric).
const GAP = String.raw`(?:\s*\([^)]*\))*[^\d<>\-\n]{0,14}`;

function L(...parts: string[]): RegExp[] {
  return parts.map((p) => new RegExp(p + GAP + NUM, 'i'));
}

const FIELDS: FieldDef[] = [
  // Acid–base core
  { key: 'pH', labels: L(String.raw`\bpH\b`) },
  { key: 'pCO2', labels: L(String.raw`pCO2`, String.raw`pCO₂`) },
  { key: 'O2', labels: L(String.raw`pO2`, String.raw`pO₂`) },
  // Base excess: Basöverskott / cBase(Ecf) / ABE / Basöverskott
  { key: 'BE', labels: L(String.raw`Bas[öo]verskott`, String.raw`cBase\s*\(?Ecf\)?`, String.raw`\bABE\b`, String.raw`\bBE\b`) },
  // Standard bicarbonate
  { key: 'stdBicarb', labels: L(String.raw`Standardbikarbonat`, String.raw`St\.?\s*Bikarb`, String.raw`cHCO3.?\(?P,?st\)?`, String.raw`Std\s*bikarbonat`) },
  // Actual bicarbonate (distinct from standard)
  { key: 'actualBicarb', labels: L(String.raw`HCO3\s*akt`, String.raw`HCO3\s*\(akt\)`) },
  // Oximetry
  { key: 'O2sat', labels: L(String.raw`Oxygenm[äa]ttnad`, String.raw`sO2`, String.raw`sO₂`, String.raw`s-?O2`) },
  { key: 'Hb', labels: L(String.raw`Hemoglobin`, String.raw`ctHb`, String.raw`\baB-Hb\b`, String.raw`\bB-Hb\b`, String.raw`\bHb\b`) },
  { key: 'MetHb', labels: L(String.raw`Methemoglobin`, String.raw`MetHb`, String.raw`FMetHb`) },
  { key: 'COHb', labels: L(String.raw`CO\s*Hb`, String.raw`COHb`, String.raw`FCOHb`) },
  // Electrolytes
  { key: 'Na', labels: L(String.raw`Natrium`, String.raw`\bcNa`, String.raw`\bNa\b`) },
  { key: 'K', labels: L(String.raw`Kalium`, String.raw`\bcK\b`, String.raw`\bK\b`) },
  { key: 'Cl', labels: L(String.raw`Klorid`, String.raw`cCl-?`, String.raw`\bCl-`, String.raw`\bCl\b`) },
  { key: 'Ca', labels: L(String.raw`Calciumjon`, String.raw`CaJon\s*fri`, String.raw`CaJon`, String.raw`cCa2?\+?`, String.raw`\bCa2\+`) },
  // Metabolites
  { key: 'Glu', labels: L(String.raw`Glukos`, String.raw`cGlu`, String.raw`\bGlu\b`, String.raw`Glucose`) },
  { key: 'Lac', labels: L(String.raw`Laktat`, String.raw`cLac`, String.raw`\bLac\b`, String.raw`Lactate`) },
  { key: 'Crea', labels: L(String.raw`Kreatinin`, String.raw`cCrea`, String.raw`\bCrea\b`, String.raw`Creatinine`) },
  // Anion gap (two conventions)
  { key: 'anionGapInclK', labels: L(String.raw`An\s*gap\s*K\+`, String.raw`Anjongap\s*\(?inkl`, String.raw`Anion\s*Gap\s*K`) },
  { key: 'anionGap', labels: L(String.raw`Anjongap\s*\(?exkl\s*K\+?\)?`, String.raw`Anjongap`, String.raw`Anion\s*Gap`) },
  // Osmolality + supplemental O2
  { key: 'osmolality', labels: L(String.raw`mOsm`, String.raw`Osmolalitet`) },
  { key: 'lo2', labels: [
    new RegExp(String.raw`Pt-?Oxygen\s*\(adm\)` + GAP + NUM, 'i'),
    new RegExp(String.raw`O2\s*adm` + GAP + NUM, 'i'),
    new RegExp(String.raw`(?:^|\s)O2\s+` + NUM + String.raw`\s*L/min`, 'im'),
  ] },
];

// Map our extended keys to the actual app BloodGasInput keys.
// (O2sat, MetHb, COHb, stdBicarb, etc. are surfaced separately in the UI.)
export const APP_INPUT_KEYS = new Set([
  'pH', 'pCO2', 'O2', 'BE', 'Na', 'K', 'Cl', 'Ca', 'Glu', 'Lac', 'lo2',
  'Hb', 'Osm',
]);

function detectType(text: string): SampleType | null {
  // Explicit "Provtyp: Arteriell/Venös"
  const m = text.match(/Provtyp[:\s]+(Arteriell|Art[eä]r|Ven[öo]s)/i);
  if (m) return /art/i.test(m[1]) ? 'arterial' : 'venous';
  // Label prefixes: aB- = arterial, vB- = venous, P(aB) = arterial, P(vB)/P(vb) = venous
  if (/\bP?\(?aB\)?[-\s]/.test(text) || /\baB-/.test(text)) return 'arterial';
  if (/\bP?\(?vB\)?[-\s]/.test(text) || /\bvB-/.test(text)) return 'venous';
  return null;
}

// Vision models often transcribe chemical formulae with real Unicode subscripts
// and superscripts (e.g. "cHCO₃⁻", "pCO₂", "cNa⁺"). Our label patterns use plain
// ASCII ("HCO3", "pCO2", "Na+"), so normalise those characters first or the line
// won't match and the value is silently dropped.
const SUB_SUP_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '₊': '+', '₋': '-',
  '\u2212': '-', // Unicode MINUS SIGN -> ASCII hyphen
};
function normalizeFormulae(text: string): string {
  return text.replace(/[₀-₉⁰-⁹⁺⁻₊₋\u2212]/g, (ch) => SUB_SUP_MAP[ch] ?? ch);
}

export function parseGas(text: string): ParsedGas {
  text = normalizeFormulae(text);
  const type = detectType(text);
  const fields: Record<string, ParsedField> = {};
  const invalid: string[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    // Record invalid markers against whichever known label is on the line.
    const isInvalid = INVALID_TOKENS.test(line);

    for (const def of FIELDS) {
      if (fields[def.key]) continue; // first match wins
      for (const re of def.labels) {
        const m = line.match(re);
        if (m) {
          if (isInvalid) { invalid.push(def.key); break; }
          const raw = m[1];
          const value = parseFloat(raw.replace(',', '.'));
          if (Number.isNaN(value)) break;
          fields[def.key] = {
            key: def.key, value,
            flagged: /\*/.test(m[0]),
            rawLabel: def.labels[0].source,
            rawValue: raw,
          };
          break;
        }
      }
    }
  }

  // Build plain values map. Prefer exkl-K+ anion gap; if only inclK present, keep it tagged.
  const values: Record<string, number> = {};
  for (const k of Object.keys(fields)) values[k] = fields[k].value;

  // unmatched lines that look like they had a numeric value but matched nothing
  const matchedLabels = new Set(Object.values(fields).map((f) => f.rawValue));
  const unmatched = lines
    .filter((l) => /\d/.test(l) && !INVALID_TOKENS.test(l))
    .filter((l) => !Object.values(fields).some((f) => l.includes(f.rawValue)))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return { type, fields, values, unmatched, invalid };
}

// Convenience: produce the keys the app/website use for inputs and derived
// flagging. Everything the parser recognised is carried over (so nothing read
// from the gas is silently dropped); bicarbonate and osmolality are mapped to
// the app's field names.
// Plausible physiological ranges for each app input. These are deliberately WIDE
// — they exist to reject OCR/LLM garbage (a pH of -27, a sodium of 9000), not to
// flag clinically abnormal values. Anything outside the range is dropped during
// import so a transcription error never silently enters the analysis. A dropped
// value simply isn't filled in; the clinician can type it manually.
export const PLAUSIBLE: Record<string, [number, number]> = {
  pH: [6.5, 8.0],
  pCO2: [1, 30],        // kPa
  O2: [1, 90],          // kPa
  HCO3: [2, 60],        // mmol/L
  BE: [-40, 40],        // mmol/L
  Na: [90, 200], K: [1, 12], Cl: [50, 160], Ca: [0.3, 5],
  Glu: [0.5, 100], Lac: [0, 40], lo2: [0, 60],
  Hb: [10, 300],        // g/L
  MetHb: [0, 100], COHb: [0, 100], O2sat: [0, 100],
  Krea: [5, 3000],      // µmol/L
  Mg: [0.1, 5], Alb: [5, 70], PO4: [0.1, 6], Urea: [0.3, 100],
  Eth: [0, 200], Osm: [150, 500], FiO2input: [21, 100],
};

/** True if v is within the (wide) plausible range for that field, or if the
 *  field has no defined range (then we don't second-guess it). */
export function isPlausible(key: string, v: number): boolean {
  if (v === undefined || v === null || Number.isNaN(v)) return false;
  const r = PLAUSIBLE[key];
  return r ? v >= r[0] && v <= r[1] : true;
}

export function toAppInputs(parsed: ParsedGas): Record<string, number> {
  const v = parsed.values;
  const out: Record<string, number> = {};
  const copy = (from: string, to: string) => {
    // Only carry a value through if it is physiologically plausible — this is
    // the guard that stops an LLM misread (e.g. pH -27) from being accepted.
    if (v[from] !== undefined && isPlausible(to, v[from] as number)) out[to] = v[from];
  };
  // Blood gas + electrolytes + metabolites
  copy('pH', 'pH'); copy('pCO2', 'pCO2'); copy('O2', 'O2'); copy('BE', 'BE');
  copy('Na', 'Na'); copy('K', 'K'); copy('Cl', 'Cl'); copy('Ca', 'Ca');
  copy('Glu', 'Glu'); copy('Lac', 'Lac'); copy('lo2', 'lo2');
  // Haematology / co-oximetry / renal — previously dropped, now carried through
  copy('Hb', 'Hb'); copy('MetHb', 'MetHb'); copy('COHb', 'COHb');
  copy('O2sat', 'O2sat'); copy('Crea', 'Krea');
  copy('Mg', 'Mg'); copy('Alb', 'Alb'); copy('PO4', 'PO4'); copy('Urea', 'Urea');
  copy('Eth', 'Eth');
  // Bicarbonate: prefer standard bicarbonate for the HCO3 input.
  if (v.stdBicarb !== undefined && isPlausible('HCO3', v.stdBicarb)) out.HCO3 = v.stdBicarb;
  else if (v.actualBicarb !== undefined && isPlausible('HCO3', v.actualBicarb)) out.HCO3 = v.actualBicarb;
  if (v.osmolality !== undefined && isPlausible('Osm', v.osmolality)) out.Osm = v.osmolality;
  return out;
}
