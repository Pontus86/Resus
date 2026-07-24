// interpret.ts
// Acid–base interpretation engine.
// Originally ported from the Android app's ResultTextFragment.java, now with two
// deliberate corrections to long-standing bugs in the original (see CHANGES).
//
// Display strings match the app's strings.xml exactly.
//
// CHANGES vs original Java:
//  [FIX 1] Compensation method is now a real, selectable option. In the Java,
//          `BEtolkningsmetod` was set via `=` (assignment) inside an `if`, so the
//          Base-Excess branch always ran and the pCO2/HCO3 branch was dead code.
//          Here `method` is an explicit parameter; both branches are reachable.
//          Default is 'be' to preserve the app's de-facto behaviour.
//  [FIX 2] Disturbance flags no longer latch on compensatory values. The original
//          checkConditions() set metabolic_alkalosis/acidosis and the anion-gap
//          flags purely on threshold crossings, so a compensating HCO3/CO2 tripped
//          a "second disorder" flag. Now the primary direction is set by pH, and
//          the opposite metabolic flag is only set for a genuine mixed disorder.

import {
  PH, PCO2, HCO3 as HCO3_REF, BE as BE_REF, ANION_GAP, SampleType,
} from './reference';
import { BloodGasInput, BloodGasResults } from './calculate';

export type CompensationMethod = 'be' | 'pco2hco3';

export interface Flags {
  acidaemia: boolean;
  alkalaemia: boolean;
  respiratory_acidosis: boolean;
  respiratory_alkalosis: boolean;
  metabolic_acidosis: boolean;
  metabolic_alkalosis: boolean;
  HAGMA: boolean;
  NAGMA: boolean;
  LOWAG: boolean;
  HIGHDELTA: boolean;
  LOWDELTA: boolean;
}

export type LineKind =
  | 'primaryHeader' | 'compensationHeader'
  | 'disorder' | 'compensation' | 'none' | 'unclear' | 'note';

export interface InterpretationLine {
  kind: LineKind;
  label: string;
  detail: string;
  mnemonic?: 'hagma' | 'nagma' | 'lowag' | 'metalk' | 'respaci' | 'respalk_hypoxic' | 'lactate';
}

export interface Interpretation {
  flags: Flags;
  headline: string;
  headlineDetail: string;
  lines: InterpretationLine[];
}

// Exact strings from the app's strings.xml
const STR = {
  acidaemia: 'Acidemi',
  alkalaemia: 'Alkalemi',
  normalPh: 'pH normalt',
  primaryDisturbances: 'Primära rubbningar',
  compensations: 'Kompensation',
  respAcidosis: 'Respiratorisk acidos',
  respAlkalosis: 'Respiratorisk alkalos',
  metAcidosis: 'Metabol acidos',
  metAlkalosis: 'Metabol alkalos',
  noPrimaryDisturbance: 'Ingen primär rubbning',
  och: 'och',
  normal: 'normalt',
  possible: 'Möjlig',
  expected: 'Förväntat',
  adequateComp: 'Adekvat kompensation',
  notRelevant: 'Ej relevant',
  severalDisturbances: 'Det finns flera primära rubbningar',
  noDisturbances: 'Det finns inga primära rubbningar',
  unclear: 'Oklar primär rubbning',
  chooseIssue: 'Välj huvudproblem nedan',
  seeCalculations: 'Se beräkningar nedan',
  coexisting: 'Samtidig motverkande rubbning',
  insuffComp: 'Kompensation otillräcklig',
  overComp: 'Kompensation överdriven',
  highAnionGap: 'Högt anjongap',
  negAnionGap: 'Lågt anjongap',
  normAnionGap: 'Normalt anjongap',
  albuminNote: 'Lågt albumin kan maskera ett högt anjongap',
  albCorrAG: 'Albuminkorrigerat AG',
  CO2: 'pCO\u2082',
  HCO3: 'HCO\u2083\u207B',
};

const round = (x: number) => Math.round(x);

export const compFormulas = {
  respCompAcid: (pHCO3: number) => 5.3 + 0.17 * (pHCO3 - 24),
  metCompAcidAcute: (pCO2: number) => 24 + 0.75 * (pCO2 - 5.3),
  metCompAcid: (pCO2: number) => 24 + 2.62 * (pCO2 - 5.3),
  respCompAlka: (pHCO3: number) => 5.3 + 0.08 * (pHCO3 - 24),
  metCompAlkaAcute: (pCO2: number) => 24 + 1.5 * (pCO2 - 5.3),
  metCompAlka: (pCO2: number) => 24 + 3.0 * (pCO2 - 5.3),
  beRespComp: (pCO2: number) => 3 * (pCO2 - 5.3),
  beMetCompAcid: (stBE: number) => 5.3 + 0.13 * stBE,
  beMetCompAlka: (stBE: number) => 5.3 + 0.08 * stBE,
};

interface Thresholds {
  pHmin: number; pHmax: number;
  pCO2min: number; pCO2max: number;
  anionGapNormal: number;
  pHCO3min: number; pHCO3max: number;
  BEmin: number; BEmax: number;
}

function thresholdsFor(type: SampleType): Thresholds {
  return {
    pHmin: PH[type].min, pHmax: PH[type].max,
    pCO2min: PCO2[type].min, pCO2max: PCO2[type].max,
    anionGapNormal: ANION_GAP.max,
    pHCO3min: HCO3_REF.min, pHCO3max: HCO3_REF.max,
    BEmin: BE_REF.min, BEmax: BE_REF.max,
  };
}

// [FIX 2] Flag logic that distinguishes primary disorders from compensation.
function checkConditions(
  input: BloodGasInput, res: BloodGasResults, t: Thresholds
): Flags {
  const f: Flags = {
    acidaemia: false, alkalaemia: false,
    respiratory_acidosis: false, respiratory_alkalosis: false,
    metabolic_acidosis: false, metabolic_alkalosis: false,
    HAGMA: false, NAGMA: false, LOWAG: false,
    HIGHDELTA: false, LOWDELTA: false,
  };

  const anionGap = res.anionGap ?? 0;
  const extraImbalance = res.extraImbalance ?? 0;
  const pH = input.pH ?? 0;
  const pCO2 = input.pCO2 ?? 0;
  const pstHCO3 = input.HCO3 ?? 0;
  const stBE = input.BE ?? 0;

  if (pH < t.pHmin) f.acidaemia = true;
  if (pH > t.pHmax) f.alkalaemia = true;

  const respAcidByCO2 = pCO2 > t.pCO2max;
  const respAlkByCO2 = pCO2 < t.pCO2min;
  const metAcidByLab = pstHCO3 < t.pHCO3min || stBE < t.BEmin;
  const metAlkByLab = pstHCO3 > t.pHCO3max || stBE > t.BEmax;

  if (f.acidaemia) {
    f.respiratory_acidosis = respAcidByCO2;
    f.metabolic_acidosis = metAcidByLab;
    f.metabolic_alkalosis = metAlkByLab && !respAcidByCO2;
  } else if (f.alkalaemia) {
    f.respiratory_alkalosis = respAlkByCO2;
    f.metabolic_alkalosis = metAlkByLab;
    f.metabolic_acidosis = metAcidByLab && !respAlkByCO2;
  } else {
    f.respiratory_acidosis = respAcidByCO2;
    f.respiratory_alkalosis = respAlkByCO2;
    f.metabolic_acidosis = metAcidByLab;
    f.metabolic_alkalosis = metAlkByLab;
  }

  // The anion gap is evaluated on its own merits. A raised anion gap is itself
  // evidence of a metabolic acidosis with unmeasured anions, EVEN when HCO3/BE
  // look normal: a coexisting respiratory or metabolic alkalosis can prop the
  // bicarbonate back up while the gap still betrays the acidosis. So we do not
  // gate the gap classification behind metAcidByLab.
  if (anionGap > t.anionGapNormal) {
    f.HAGMA = true;
    f.metabolic_acidosis = true; // a high gap means a metabolic acidosis is present
  } else if (f.metabolic_acidosis) {
    // A low or normal gap with a metabolic acidosis is classified as NAGMA. A LOW
    // gap is not its own acid-base disorder: it mostly reflects low albumin and
    // its real significance is that it can MASK a high-gap acidosis, so we surface
    // an albumin-correction note (below) rather than a separate "low gap" type.
    f.NAGMA = true;
    if (anionGap < t.anionGapNormal - 6) f.LOWAG = true; // kept only to drive the note
  }

  // Delta-delta (classic, secondary method). Article thresholds, baseline AG−12:
  //   ΔAG + HCO₃⁻ > 26 → coexisting metabolic alkalosis (or chronic resp. acidosis)
  //   ΔAG + HCO₃⁻ < 22 → coexisting hyperchloraemic (NAGMA) acidosis
  // The primary bedside detector is now the Na–Cl gap (Stewart/SWESEM).
  if (extraImbalance < 22) f.LOWDELTA = true;
  if (extraImbalance > 26) f.HIGHDELTA = true;

  return f;
}

function metabolicAcidosisLine(input: BloodGasInput, f: Flags, t: Thresholds): InterpretationLine {
  const pstHCO3 = input.HCO3 ?? 0;
  const stBE = input.BE ?? 0;
  // Low or normal gap -> NAGMA. A low gap is not a separate disorder type.
  const qualifier = f.HAGMA ? STR.highAnionGap : STR.normAnionGap;
  const label = `${STR.metAcidosis}, ${qualifier.toLowerCase()}`;
  const detail = pstHCO3 < t.pHCO3min
    ? `${STR.HCO3} ${round(pstHCO3)} mmol/L`
    : `BE ${stBE} mEq/L`;
  const mnemonic = f.HAGMA ? 'hagma' : 'nagma';
  return { kind: 'disorder', label, detail, mnemonic };
}

function metabolicAlkalosisLine(input: BloodGasInput, t: Thresholds): InterpretationLine {
  const pstHCO3 = input.HCO3 ?? 0;
  const stBE = input.BE ?? 0;
  const detail = pstHCO3 > t.pHCO3max
    ? `${STR.HCO3} ${round(pstHCO3)} mmol/L`
    : `BE ${stBE} mEq/L`;
  return { kind: 'disorder', label: STR.metAlkalosis, detail, mnemonic: 'metalk' };
}

function compensationLines(
  input: BloodGasInput, res: BloodGasResults, f: Flags, method: CompensationMethod
): InterpretationLine[] {
  const out: InterpretationLine[] = [];
  const pCO2 = input.pCO2 ?? 0;
  const stBE = input.BE ?? 0;
  const pHCO3 = res.pHCO3 ?? 0;

  const possible = (what: string, detail: string): InterpretationLine =>
    ({ kind: 'compensation', label: `${STR.possible} ${what}`, detail });
  const adequate = (detail: string): InterpretationLine =>
    ({ kind: 'compensation', label: STR.adequateComp, detail });

  const bothSame =
    (f.respiratory_acidosis && f.metabolic_acidosis) ||
    (f.respiratory_alkalosis && f.metabolic_alkalosis);
  const hasAnyDisorder =
    f.respiratory_acidosis || f.respiratory_alkalosis ||
    f.metabolic_acidosis || f.metabolic_alkalosis;

  if ((f.acidaemia || f.alkalaemia) && bothSame) {
    out.push({ kind: 'none', label: STR.notRelevant, detail: STR.severalDisturbances });
    return out;
  }
  if (!hasAnyDisorder) {
    out.push({ kind: 'none', label: STR.notRelevant, detail: STR.noDisturbances });
    return out;
  }
  // Opposing disorders (one acidosis + one alkalosis). The PRIMARY disorder is
  // the one pulling pH in the direction it actually moved; the other is a
  // coexisting opposing disturbance. Only when pH is normal (they cancel) is the
  // primary genuinely unclear.
  if ((f.respiratory_acidosis && f.metabolic_alkalosis) ||
      (f.respiratory_alkalosis && f.metabolic_acidosis)) {
    if (!f.acidaemia && !f.alkalaemia) {
      out.push({ kind: 'unclear', label: STR.unclear, detail: STR.seeCalculations });
      return out;
    }
    // pH abnormal: name the coexisting opposing disorder, then compute expected
    // compensation for the PRIMARY (pH-matching) disorder only.
    if (f.acidaemia) {
      out.push({ kind: 'disorder', label: STR.coexisting,
        detail: f.metabolic_alkalosis ? STR.metAlkalosis : STR.respAlkalosis });
      f = { ...f, metabolic_alkalosis: false, respiratory_alkalosis: false };
    } else {
      out.push({ kind: 'disorder', label: STR.coexisting,
        detail: f.metabolic_acidosis ? STR.metAcidosis : STR.respAcidosis });
      f = { ...f, metabolic_acidosis: false, respiratory_acidosis: false };
    }
  }

  if (method === 'be') {
    const beResp = round(compFormulas.beRespComp(pCO2));
    const beAcid = round(compFormulas.beMetCompAcid(stBE));
    const beAlka = round(compFormulas.beMetCompAlka(stBE));

    if (f.respiratory_acidosis) {
      const r = `${STR.expected} BE 0 - ${beResp} mmol/L`;
      if (stBE > beResp) out.push(possible(STR.metAlkalosis, r));
      else if (stBE < 0) out.push(possible(STR.metAcidosis, r));
      else out.push(adequate(r));
    } else if (f.metabolic_acidosis) {
      const e = `${STR.expected} ${STR.CO2} ${beAcid} kPa`;
      if (round(pCO2) < beAcid) out.push(possible(STR.respAlkalosis, e));
      else if (round(pCO2) > round(compFormulas.respCompAcid(pHCO3))) out.push(possible(STR.respAcidosis, e));
      else out.push(adequate(e));
    } else if (f.respiratory_alkalosis) {
      const r = `${STR.expected} BE ${beResp} - 0 mmol/L`;
      if (stBE > 0) out.push(possible(STR.metAlkalosis, r));
      else if (stBE < beResp) out.push(possible(STR.metAcidosis, r));
      else out.push(adequate(r));
    } else if (f.metabolic_alkalosis) {
      const e = `${STR.expected} ${STR.CO2} ${beAlka} kPa`;
      if (round(pCO2) < beAlka) out.push(possible(STR.respAlkalosis, e));
      else if (round(pCO2) > beAlka) out.push(possible(STR.respAcidosis, e));
      else out.push(adequate(e));
    }
  } else {
    const cAcidAcute = round(compFormulas.metCompAcidAcute(pCO2));
    const cAcid = round(compFormulas.metCompAcid(pCO2));
    const cAlkaAcute = round(compFormulas.metCompAlkaAcute(pCO2));
    const cAlka = round(compFormulas.metCompAlka(pCO2));
    const rAcid = round(compFormulas.respCompAcid(pHCO3));
    const rAlka = round(compFormulas.respCompAlka(pHCO3));

    if (f.respiratory_acidosis) {
      const r = `${STR.expected} ${STR.HCO3} ${cAcidAcute} - ${cAcid} mmol/L`;
      if (round(pHCO3) > cAcid) out.push(possible(STR.metAlkalosis, r));
      else if (round(pHCO3) < cAcidAcute) out.push(possible(STR.metAcidosis, r));
      else out.push(adequate(r));
    } else if (f.metabolic_acidosis) {
      const e = `${STR.expected} ${STR.CO2} ${rAcid} kPa`;
      if (round(pCO2) < rAcid) out.push(possible(STR.respAlkalosis, e));
      else if (round(pCO2) > rAcid) out.push(possible(STR.respAcidosis, e));
      else out.push(adequate(e));
    } else if (f.respiratory_alkalosis) {
      const r = `${STR.expected} ${STR.HCO3} ${cAlka} - ${cAlkaAcute} mmol/L`;
      if (round(pHCO3) > cAlka) out.push(possible(STR.metAlkalosis, r));
      else if (round(pHCO3) < cAlkaAcute) out.push(possible(STR.metAcidosis, r));
      else out.push(adequate(r));
    } else if (f.metabolic_alkalosis) {
      const e = `${STR.expected} ${STR.CO2} ${rAlka} kPa`;
      if (round(pCO2) < rAlka) out.push(possible(STR.respAlkalosis, e));
      else if (round(pCO2) > rAlka) out.push(possible(STR.respAcidosis, e));
      else out.push(adequate(e));
    }
  }
  return out;
}

export function interpret(
  input: BloodGasInput,
  res: BloodGasResults,
  method: CompensationMethod = 'be'
): Interpretation {
  const t = thresholdsFor(input.type);
  const f = checkConditions(input, res, t);
  const lines: InterpretationLine[] = [];

  const pH = input.pH ?? 0;
  const pCO2 = input.pCO2 ?? 0;
  let headline: string, headlineDetail: string;

  if (f.acidaemia) {
    headline = STR.acidaemia; headlineDetail = `pH ${pH}`;
    lines.push({ kind: 'primaryHeader', label: '', detail: STR.primaryDisturbances });
    if (f.respiratory_acidosis)
      lines.push({ kind: 'disorder', label: STR.respAcidosis, detail: `${STR.CO2} ${pCO2} kPa`, mnemonic: 'respaci' });
    if (f.metabolic_acidosis) lines.push(metabolicAcidosisLine(input, f, t));
    if (f.metabolic_alkalosis) lines.push(metabolicAlkalosisLine(input, t));
    if (!f.respiratory_acidosis && !f.metabolic_acidosis && !f.metabolic_alkalosis)
      lines.push({ kind: 'none', label: STR.noPrimaryDisturbance, detail: `${STR.CO2} ${STR.och} ${STR.HCO3} ${STR.normal}` });
  } else if (f.alkalaemia) {
    headline = STR.alkalaemia; headlineDetail = `pH ${pH}`;
    lines.push({ kind: 'primaryHeader', label: '', detail: STR.primaryDisturbances });
    if (f.respiratory_alkalosis)
      lines.push({ kind: 'disorder', label: STR.respAlkalosis, detail: `${STR.CO2} ${pCO2} kPa`, mnemonic: 'respalk_hypoxic' });
    if (f.metabolic_alkalosis) lines.push(metabolicAlkalosisLine(input, t));
    // A coexisting (often masked) metabolic acidosis, surfaced by a raised gap.
    if (f.metabolic_acidosis) lines.push(metabolicAcidosisLine(input, f, t));
    if (!f.respiratory_alkalosis && !f.metabolic_alkalosis && !f.metabolic_acidosis)
      lines.push({ kind: 'none', label: STR.noPrimaryDisturbance, detail: `${STR.CO2} ${STR.och} ${STR.HCO3} ${STR.normal}` });
  } else {
    headline = STR.normalPh; headlineDetail = `pH ${pH}`;
    lines.push({ kind: 'primaryHeader', label: '', detail: STR.primaryDisturbances });
    // At a normal pH, show every disorder we can detect rather than collapsing to
    // one: opposing disorders (e.g. resp alkalosis + HAGMA) cancel on pH but both
    // matter clinically. Only call it "unclear" when nothing at all was found.
    let any = false;
    if (f.respiratory_acidosis) { lines.push({ kind: 'disorder', label: STR.respAcidosis, detail: `${STR.CO2} ${pCO2} kPa`, mnemonic: 'respaci' }); any = true; }
    if (f.respiratory_alkalosis) { lines.push({ kind: 'disorder', label: STR.respAlkalosis, detail: `${STR.CO2} ${pCO2} kPa`, mnemonic: 'respalk_hypoxic' }); any = true; }
    if (f.metabolic_acidosis) { lines.push(metabolicAcidosisLine(input, f, t)); any = true; }
    if (f.metabolic_alkalosis) { lines.push(metabolicAlkalosisLine(input, t)); any = true; }
    if (!any) lines.push({ kind: 'none', label: STR.noPrimaryDisturbance, detail: `${STR.CO2} ${STR.och} ${STR.HCO3} ${STR.normal}` });
  }

  lines.push({ kind: 'compensationHeader', label: '', detail: STR.compensations });
  lines.push(...compensationLines(input, res, f, method));

  // Albumin-correction note: a low albumin lowers the anion gap and can MASK a
  // high-gap acidosis. Only shown when albumin was actually entered and is low.
  if (input.Alb !== undefined && input.Alb < 34 && res.AGalb !== undefined) {
    lines.push({
      kind: 'note',
      label: STR.albuminNote,
      detail: `${STR.albCorrAG} ${round(res.AGalb)} mmol/L (albumin ${input.Alb} g/L)`,
    });
  }

  // Lactate flag: if a raised lactate was entered, surface the lactic-acidosis differential.
  if (input.Lac !== undefined && input.Lac > 2.3) {
    lines.push({ kind: 'disorder', label: `Förhöjt laktat`, detail: `${input.Lac} mmol/L`, mnemonic: 'lactate' });
  }

  return { flags: f, headline, headlineDetail, lines };
}
