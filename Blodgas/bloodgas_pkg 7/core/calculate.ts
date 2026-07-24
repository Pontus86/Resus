// calculate.ts
// Blood gas derived-value engine.
// Every formula is transcribed verbatim from the original Android app
// (CalculatorNew.getVariables()). Where the Java used 0/empty for "not entered",
// this module uses `undefined` for inputs and only computes a derived value
// when its required inputs are present.

import { KPA_MMHG_RATIO, SampleType } from './reference';

export type Gender = 'unknown' | 'male' | 'female';

export interface BloodGasInput {
  type: SampleType;
  gender?: Gender;
  weight?: number; // kg
  age?: number;
  lo2?: number; // supplemental O2, L/min (drives FiO2)
  FiO2input?: number; // explicit FiO2 in % (e.g. ventilated patient); overrides lo2-derived FiO2
  O2sat?: number; // measured oxygen saturation sO2, %

  pH?: number;
  pCO2?: number; // kPa
  HCO3?: number; // measured std bicarbonate (pstHCO3 in source)
  BE?: number; // measured standard base excess (stBE in source)
  Na?: number;
  K?: number;
  Cl?: number;
  Glu?: number;
  O2?: number; // kPa
  Lac?: number;
  Ca?: number;
  Hb?: number;
  Kreatinin?: number;
  COHb?: number;
  Osm?: number;
  MetHb?: number;
  Mg?: number;
  Alb?: number;
  PO4?: number;
  Eth?: number;
  Urea?: number;

  urinNa?: number;
  urinK?: number;
  urinCl?: number;
  urinOsm?: number;
}

export interface BloodGasResults {
  // Henderson–Hasselbalch
  H?: number; // nmol/L
  pHCO3?: number; // calculated bicarbonate
  calcBE?: number; // calculated base excess (BE in source)
  stBEc?: number; // albumin/phosphate-corrected standard base excess

  // Anion gap family
  anionGap?: number;
  anionGap_K?: number;
  anionGapDelta?: number;
  AGc?: number;
  AGalb?: number;
  urinAG?: number;

  // Corrections
  corrNa?: number;
  corrCl?: number;

  // Delta / compensation helpers
  deltapCO2?: number;
  deltaHCO3?: number;
  extraImbalance?: number;

  // Respiratory
  FiO2?: number;
  A_a_diff?: number;
  pfRatio?: number; // P/F ratio = pO2 / FiO2(fraction), kPa
  CaO2?: number; // arterial oxygen content, mL O2 / dL
  p50?: number; // pO2 at 50% Hb saturation (Severinghaus estimate), kPa

  // Stewart physicochemical
  SIDa?: number;
  SIDe?: number;
  SIG?: number;

  // Osmolality
  osmolarGap?: number;
  urinOsmGap?: number;

  // Deficits
  H2O_deficit?: number;
  Na_deficit?: number;
  K_deficit?: number;

  genderConstant?: number;
}

const has = (...xs: (number | undefined)[]) =>
  xs.every((x) => x !== undefined && !Number.isNaN(x));

export function calculate(input: BloodGasInput): BloodGasResults {
  const r: BloodGasResults = {};
  const {
    pH, pCO2, Na, Cl, K, HCO3, Glu, O2, Lac, Ca, Mg, Alb, PO4,
    Eth, Urea, Osm, lo2, Hb, weight, gender, FiO2input, O2sat,
    urinNa, urinK, urinCl, urinOsm,
  } = input;

  // Gender constant (total body water fraction)
  const genderConstant =
    gender === 'male' ? 0.6 : gender === 'female' ? 0.5 : 0;
  r.genderConstant = genderConstant;

  // --- Henderson–Hasselbalch ---
  if (has(pH)) {
    // H = 10^9 * 10^-pH
    r.H = Math.pow(10, 9) * Math.pow(10, -(pH as number));
  }
  if (has(pCO2, pH)) {
    // pHCO3 = 0.23 * pCO2 * 10^(pH - 6.1)
    r.pHCO3 = 0.23 * (pCO2 as number) * Math.pow(10, (pH as number) - 6.1);
    // BE = 0.02786 * (pCO2*ratio) * 10^(pH-6.1) + 13.77*pH - 124.58
    r.calcBE =
      0.02786 * ((pCO2 as number) * KPA_MMHG_RATIO) *
        Math.pow(10, (pH as number) - 6.1) +
      13.77 * (pH as number) -
      124.58;
  }
  if (r.pHCO3 !== undefined && has(pH)) {
    // stBEc = pHCO3 - 24.4 + (8.3*Alb*0.15 + 0.29*PO4*0.32) * (pH - 7.4)
    const alb = Alb ?? 0;
    const po4 = PO4 ?? 0;
    r.stBEc =
      r.pHCO3 - 24.4 +
      (8.3 * alb * 0.15 + 0.29 * po4 * 0.32) * ((pH as number) - 7.4);
  }

  // --- Anion gap ---
  if (has(Na, Cl) && r.pHCO3 !== undefined) {
    r.anionGap = (Na as number) - (Cl as number) - r.pHCO3;
    r.anionGapDelta = r.anionGap - 12;
    if (has(K)) r.anionGap_K = (Na as number) + (K as number) - (Cl as number) - r.pHCO3;
    // AGc = AG + 0.5*PO4 - Lac - 2*Alb
    if (has(PO4, Lac, Alb))
      r.AGc = r.anionGap + 0.5 * (PO4 as number) - (Lac as number) - 2 * (Alb as number);
    // AGalb = AG + 0.25*(44 - Alb)
    if (has(Alb)) r.AGalb = r.anionGap + 0.25 * (44 - (Alb as number));
  }

  if (has(urinNa, urinK, urinCl))
    r.urinAG = (urinNa as number) + (urinK as number) - (urinCl as number);

  // --- Corrections ---
  if (has(Na, Glu)) r.corrNa = (Na as number) + 2.4 * (((Glu as number) - 5.5) / 5.5);
  if (has(Cl, Na)) r.corrCl = (Cl as number) * (140 / (Na as number));

  // --- Delta / extra imbalance ---
  if (has(pCO2)) r.deltapCO2 = 4.6 - (pCO2 as number);
  if (r.pHCO3 !== undefined) r.deltaHCO3 = 24 - r.pHCO3;
  if (r.anionGapDelta !== undefined && r.pHCO3 !== undefined)
    r.extraImbalance = r.anionGapDelta + r.pHCO3;

  // --- Respiratory ---
  // FiO2 (%) comes from an explicit entry if given (e.g. ventilated patient),
  // otherwise it is estimated from supplemental O2 flow in L/min.
  let fio2: number | undefined;
  if (FiO2input !== undefined) {
    fio2 = FiO2input;
  } else if (lo2 !== undefined) {
    fio2 = 21 + 4 * lo2;
    if (lo2 > 19) fio2 = 101.3;
  }
  if (fio2 !== undefined) {
    r.FiO2 = fio2;
    if (has(pCO2, O2))
      r.A_a_diff = fio2 * 0.95 - (pCO2 as number) / 0.8 - (O2 as number);
    // P/F ratio (pO2 / FiO2 fraction), in kPa. Only meaningful with arterial pO2
    // and supplemental/known FiO2 above room air.
    if (O2 !== undefined && fio2 > 21)
      r.pfRatio = (O2 as number) / (fio2 / 100);
  }

  // Arterial oxygen content CaO2 = 1.34*Hb(g/dL)*SaO2 + 0.023*pO2(kPa).
  // Hb is entered in g/L, so convert to g/dL (÷10); SaO2 as a fraction.
  if (has(Hb, O2sat, O2))
    r.CaO2 = 1.34 * ((Hb as number) / 10) * ((O2sat as number) / 100) + 0.023 * (O2 as number);

  // P50 (Severinghaus-based estimate): the pO2 at which THIS patient's blood is
  // 50% saturated, reflecting their actual Hb–O2 affinity at the sampled
  // conditions. We compare the measured (sO2, pO2) point to the standard curve:
  // if it sits to the right of standard (lower sat for a given pO2, e.g. acidosis,
  // fever, high 2,3-DPG) the ratio >1 and P50 rises; to the left, P50 falls.
  if (has(O2, O2sat) && (O2sat as number) > 0 && (O2sat as number) < 99.5) {
    const po2mmHg = (O2 as number) * 7.50062; // kPa -> mmHg
    const s = (O2sat as number) / 100;
    const stdPo2 = (sat: number) => {
      let lo = 1, hi = 800;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const sCalc = 1 / (23400 / (mid * mid * mid + 150 * mid) + 1);
        if (sCalc < sat) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const P50_STD = 26.7; // standard P50, mmHg
    const shift = po2mmHg / stdPo2(s); // >1 = right shift (lower affinity)
    r.p50 = (P50_STD * shift) / 7.50062; // mmHg -> kPa
  }

  // --- Stewart ---
  if (has(Na, K, Mg, Ca, Cl))
    r.SIDa =
      (Na as number) + (K as number) + (Mg as number) * 2 + (Ca as number) * 2 - (Cl as number);
  if (r.pHCO3 !== undefined && has(pH, Alb, PO4))
    r.SIDe =
      r.pHCO3 +
      (Alb as number) * (0.123 * (pH as number) - 0.631) +
      (PO4 as number) * (0.309 * (pH as number) - 0.469);
  if (r.SIDa !== undefined && r.SIDe !== undefined) r.SIG = r.SIDa - r.SIDe;

  // --- Osmolar gap ---
  if (has(Osm, Na, Urea, Glu, Eth))
    r.osmolarGap =
      (Osm as number) -
      ((Na as number) * 2 + (Urea as number) + (Glu as number) + (Eth as number) * 1.25);
  if (has(urinOsm, Na, Urea, Glu))
    r.urinOsmGap =
      (urinOsm as number) - ((Na as number) * 2 + (Urea as number) + (Glu as number));

  // --- Deficits ---
  if (has(Na, weight)) {
    if ((Na as number) > 140)
      r.H2O_deficit = 1000 * genderConstant * (weight as number) * ((Na as number) / 140 - 1);
    if ((Na as number) < 140)
      r.Na_deficit = genderConstant * (weight as number) * (140 - (Na as number));
  }
  if (has(K, weight) && (K as number) < 4)
    r.K_deficit = 0.4 * (weight as number) * (4 - (K as number));

  return r;
}
