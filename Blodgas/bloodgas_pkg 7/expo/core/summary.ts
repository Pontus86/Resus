// summary.ts
// Genererar en kort, kopieringsbar sammanfattning av syra-bas- och
// elektrolytrubbningar, avsedd att klistras in i patientjournalen. Bygger på
// samma flaggor/värden som tolkningen på skärmen, så de aldrig motsäger varandra.
//
// Exempel:
//   "Blodgas visar: en metabol acidos med högt anjongap (pH 7.20, AG 29,
//    HCO₃⁻ 12). Elektrolyter: förhöjt kalium (5.6) och förhöjt laktat (8.0).
//    Venöst prov."

import { BloodGasInput, BloodGasResults } from './calculate';
import { Flags } from './interpret';

// Referensintervall för att avgöra vad som räknas som "noterbart" för
// elektrolyter. Medvetet något vidare än strikta labbintervall, så att
// journalsammanfattningen bara flaggar kliniskt relevanta avvikelser.
const E_RANGES: Record<string, [number, number]> = {
  Na: [135, 146], K: [3.4, 5.0], Cl: [96, 110], Ca: [1.10, 1.35],
  Lac: [0.5, 2.5], Glu: [3.5, 7.8],
};
const E_NAMES: Record<string, string> = {
  Na: 'natrium', K: 'kalium', Cl: 'klorid', Ca: 'joniserat kalcium',
  Lac: 'laktat', Glu: 'glukos',
};

function num(n: number | undefined, dp = 0): string {
  if (n === undefined || Number.isNaN(n)) return '';
  return dp === 0 ? String(Math.round(n)) : n.toFixed(dp);
}

/** Bygg syra-bas-frasen från flaggorna. */
function acidBasePhrase(f: Flags, r: BloodGasResults, i: BloodGasInput): string {
  const parts: string[] = [];

  // Metabol acidos med anjongap-subtyp
  if (f.metabolic_acidosis) {
    if (f.HAGMA) parts.push('en metabol acidos med högt anjongap');
    else if (f.NAGMA) parts.push('en metabol acidos med normalt anjongap (hyperkloremisk)');
    else parts.push('en metabol acidos');
  }
  if (f.metabolic_alkalosis) parts.push('en metabol alkalos');
  if (f.respiratory_acidosis) parts.push('en respiratorisk acidos');
  if (f.respiratory_alkalosis) parts.push('en respiratorisk alkalos');

  // Ett förhöjt anjongap kan avslöja en metabol acidos även när pH ser normalt ut.
  if (!f.metabolic_acidosis && f.HAGMA) {
    parts.push('ett förhöjt anjongap som talar för en underliggande metabol acidos');
  }

  if (parts.length === 0) {
    // Ingen namngiven rubbning, beskriv pH-läget.
    if (f.acidaemia) return 'en acidemi utan tydligt klassificerad primär rubbning';
    if (f.alkalaemia) return 'en alkalemi utan tydligt klassificerad primär rubbning';
    return 'ingen signifikant syra-basrubbning';
  }

  // Sammanfoga: "A och B", "A, B och C"
  let joined: string;
  if (parts.length === 1) joined = parts[0];
  else if (parts.length === 2) joined = `${parts[0]} och ${parts[1]}`;
  else joined = `${parts.slice(0, -1).join(', ')} och ${parts[parts.length - 1]}`;

  return joined;
}

/** Stödjande siffror inline till syra-bas-frasen. */
function acidBaseNumbers(r: BloodGasResults, i: BloodGasInput, f: Flags): string {
  const bits: string[] = [];
  if (i.pH !== undefined) bits.push(`pH ${num(i.pH, 2)}`);
  if (i.pCO2 !== undefined) bits.push(`pCO₂ ${num(i.pCO2, 1)}`);
  // Föredra inmatat HCO3, annars beräknat
  const hco3 = i.HCO3 !== undefined ? i.HCO3 : r.pHCO3;
  if (hco3 !== undefined) bits.push(`HCO₃⁻ ${num(hco3, 0)}`);
  if (r.anionGap !== undefined && (f.HAGMA || f.NAGMA || f.LOWAG)) bits.push(`AG ${num(r.anionGap, 0)}`);
  return bits.length ? ` (${bits.join(', ')})` : '';
}

/** Noterbara elektrolyt-/metabolitfynd, som en lista av fraser. */
function electrolytePhrases(i: BloodGasInput): string[] {
  const out: string[] = [];
  (['Na', 'K', 'Cl', 'Ca', 'Lac', 'Glu'] as const).forEach((k) => {
    const v = (i as any)[k] as number | undefined;
    if (v === undefined || Number.isNaN(v)) return;
    const [lo, hi] = E_RANGES[k];
    const dp = (k === 'Ca' || k === 'Lac' || k === 'K' || k === 'Glu') ? 1 : 0;
    if (v < lo) out.push(`lågt ${E_NAMES[k]} (${num(v, dp)})`);
    else if (v > hi) out.push(`förhöjt ${E_NAMES[k]} (${num(v, dp)})`);
  });
  return out;
}

export interface SummaryOptions {
  /** Inledande fras; standard "Blodgas visar:" */
  lead?: string;
  /** Inkludera meningen om provtyp. Standard true. */
  includeSampleType?: boolean;
}

/**
 * Skapar den kopieringsbara sammanfattningssträngen. Returnerar '' om det inte
 * finns något att säga (t.ex. om pH saknas).
 */
export function summaryText(
  i: BloodGasInput,
  r: BloodGasResults,
  f: Flags,
  opts: SummaryOptions = {}
): string {
  if (i.pH === undefined) return '';
  const lead = opts.lead ?? 'Blodgas visar:';
  const includeType = opts.includeSampleType ?? true;

  const phrase = acidBasePhrase(f, r, i);
  const numbers = acidBaseNumbers(r, i, f);

  // Vi räknar inte om kompensationsadekvans här; tolkningen på skärmen äger det.
  // Sammanfattningen anger de namngivna rubbningarna och gapet, vilket är vad en
  // journalanteckning behöver. Blandade rubbningar lyfts via delta-delta nedan.
  let s = `${lead} ${phrase}${numbers}.`;

  // Samtidig metabol alkalos avslöjad av delta-delta (steg 3 i metoden).
  if (f.HAGMA && f.HIGHDELTA) s += ' Det korrigerade bikarbonatet talar för en samtidig metabol alkalos.';
  if (f.HAGMA && f.LOWDELTA) s += ' Det korrigerade bikarbonatet talar för en samtidig metabol acidos med normalt anjongap.';

  // Elektrolyter
  const elytes = electrolytePhrases(i);
  if (elytes.length) {
    const joined = elytes.length === 1 ? elytes[0]
      : `${elytes.slice(0, -1).join(', ')} och ${elytes[elytes.length - 1]}`;
    s += ` Elektrolyter: ${joined}.`;
  }

  if (includeType && i.type) {
    s += ` ${i.type === 'arterial' ? 'Arteriellt' : 'Venöst'} prov.`;
  }

  return s;
}
