// stewart.ts
// Stewart (physicochemical) analysis, surfaced as an alternative interpretation.
// Computes SIDa / SIDe / SIG, assuming normal values for any weak-acid/strong-ion
// input that wasn't entered — each assumption is flagged so the user knows which
// numbers are real. Shared by the web "Stewart" toggle and the app's.

import { BloodGasInput, BloodGasResults } from './calculate';

export const STEWART_NORMALS: Record<string, number> = {
  K: 4.2, Mg: 0.85, Ca: 1.2, Alb: 42, PO4: 1.1, Lac: 1.0,
};

export interface StewartResult {
  SIDa: number;
  SIDe: number;
  SIG: number;
  assumed: string[];                 // keys filled with normals
  used: Record<string, number>;      // every value used (entered or assumed)
}

export interface StewartLine {
  kind: 'disorder' | 'compensation' | 'none';
  label: string;
  detail: string;
}

/**
 * Returns null if the minimum real inputs (pH, Na, Cl, and a calculated HCO3)
 * aren't available. Otherwise computes the strong-ion picture, assuming normals
 * for K/Mg/Ca/Alb/PO4/Lac where missing.
 */
export function computeStewart(i: BloodGasInput, r: BloodGasResults): StewartResult | null {
  if (i.pH === undefined || i.Na === undefined || i.Cl === undefined || r.pHCO3 === undefined) {
    return null;
  }
  const assumed: string[] = [];
  const v = (k: string, entered: number | undefined): number => {
    if (entered !== undefined && !Number.isNaN(entered)) return entered;
    assumed.push(k);
    return STEWART_NORMALS[k];
  };
  const K = v('K', i.K), Mg = v('Mg', i.Mg), Ca = v('Ca', i.Ca);
  const Alb = v('Alb', i.Alb), PO4 = v('PO4', i.PO4), Lac = v('Lac', i.Lac);
  const pH = i.pH, HCO3 = r.pHCO3;

  const SIDa = i.Na + K + 2 * Mg + 2 * Ca - i.Cl;
  const SIDe = HCO3 + Alb * (0.123 * pH - 0.631) + PO4 * (0.309 * pH - 0.469);
  const SIG = SIDa - SIDe;

  return {
    SIDa, SIDe, SIG, assumed,
    used: { Na: i.Na, Cl: i.Cl, K, Mg, Ca, Alb, PO4, Lac, HCO3, pH },
  };
}

/** Plain-language reading of the strong-ion picture. */
export function stewartLines(s: StewartResult): StewartLine[] {
  const lines: StewartLine[] = [];
  if (s.SIDa < 36) lines.push({ kind: 'disorder', label: 'Lågt SIDa', detail: 'metabol acidos (stark jon, t.ex. hyperkloremi eller natriumbrist)' });
  else if (s.SIDa > 46) lines.push({ kind: 'disorder', label: 'Högt SIDa', detail: 'metabol alkalos (stark jon)' });

  // SIG:s absolutvärde är kalibreringsberoende (koefficienterna förskjuter
  // baslinjen), så flagga tydligt förhöjda värden i stället för att överlarma på
  // nära normala blodgaser. >6 mmol/L är en försvarbar gräns för omätta anjoner.
  if (s.SIG > 6) lines.push({ kind: 'disorder', label: 'Förhöjt strong ion gap', detail: `omätta anjoner sannolikt (laktat, ketoner, toxiner), ${s.SIG.toFixed(1)} mmol/L` });
  else lines.push({ kind: 'none', label: 'Strong ion gap ej tydligt förhöjt', detail: `${s.SIG.toFixed(1)} mmol/L (tolka mot uppmätt laktat; SIG-baslinjen är kalibreringsberoende)` });

  if (s.used.Alb < 34) lines.push({ kind: 'compensation', label: 'Hypoalbuminemi', detail: 'lågt albumin verkar alkaliserande och maskerar acidos på anjongapet; Stewart är särskilt användbart här' });
  if (s.used.Lac > 2.3) lines.push({ kind: 'disorder', label: 'Laktat bidrar', detail: 'förhöjt laktat är en del av strong ion gap' });

  if (!lines.some((l) => l.kind === 'disorder')) {
    lines.unshift({ kind: 'none', label: 'Ingen större Stewart-avvikelse', detail: 'starka joner och svaga syror i stort sett i balans' });
  }
  return lines;
}

/** Läsvänliga namn för noten om antagna värden. */
export const STEWART_LABELS: Record<string, string> = {
  K: 'K⁺', Mg: 'Mg²⁺', Ca: 'Ca²⁺', Alb: 'albumin', PO4: 'fosfat', Lac: 'laktat',
};

/**
 * Kort, kopieringsbar journaltext för Stewart-bilden. Returnerar '' om Stewart
 * inte kunde beräknas. Avsedd att klistras in i journalen, parallellt med den
 * vanliga journaltexten.
 */
export function stewartSummary(s: StewartResult | null): string {
  if (!s) return '';
  const parts: string[] = [];

  // SIDa
  if (s.SIDa < 36) parts.push('lågt SIDa (talar för en stark-jon-acidos, t.ex. hyperkloremi eller natriumbrist)');
  else if (s.SIDa > 46) parts.push('högt SIDa (talar för en stark-jon-alkalos)');

  // SIG
  if (s.SIG > 6) parts.push('förhöjt strong ion gap som talar för omätta anjoner (laktat, ketoner eller toxiner)');

  // Albumin
  if (s.used.Alb < 34) parts.push('hypoalbuminemi som verkar alkaliserande och kan maskera en acidos på anjongapet');

  const numbers = ` (SIDa ${s.SIDa.toFixed(0)}, SIDe ${s.SIDe.toFixed(0)}, SIG ${s.SIG.toFixed(1)})`;

  let body: string;
  if (parts.length === 0) {
    body = 'ingen större avvikelse, starka joner och svaga syror i stort sett i balans';
  } else if (parts.length === 1) {
    body = parts[0];
  } else {
    body = parts.slice(0, -1).join(', ') + ' och ' + parts[parts.length - 1];
  }

  let out = `Stewart-analys: ${body}${numbers}.`;

  if (s.assumed.length > 0) {
    const names = s.assumed.map((k) => STEWART_LABELS[k] || k).join(', ');
    out += ` Antagna normalvärden för ${names} (ej inmatade).`;
  }
  return out;
}
