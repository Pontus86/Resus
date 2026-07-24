// reference.ts
// Reference ranges transcribed verbatim from the original Android app (Options.java).
// Units follow the original app: pCO2 / pO2 in kPa, electrolytes in mmol/L,
// albumin in g/L, etc. kPa<->mmHg ratio is kept identical to the source.

export const KPA_MMHG_RATIO = 7.547;
export const NULL_NUMBER = -1000;

export type SampleType = 'arterial' | 'venous';

export interface Range {
  min: number;
  max: number;
}

// --- Type-specific ranges (arterial vs venous) ---
export const PH: Record<SampleType, Range> = {
  arterial: { min: 7.35, max: 7.45 },
  venous: { min: 7.32, max: 7.42 },
};

// pCO2 in kPa
export const PCO2: Record<SampleType, Range> = {
  arterial: { min: 4.6, max: 6.0 },
  venous: { min: 5.1, max: 6.5 },
};

// pO2 in kPa (venous has no defined range in the original)
export const O2: Record<SampleType, Range | null> = {
  arterial: { min: 10, max: 13 },
  venous: null,
};

export const ANION_GAP_NORMAL: Record<SampleType, number> = {
  arterial: 12.0,
  venous: 12.0,
};

// --- Ranges shared by both arterial and venous ---
export const HCO3: Range = { min: 22, max: 27 };
export const BE: Range = { min: -3, max: 3 };
export const LAC_MAX = 2.3;
export const H: Range = { min: 35, max: 45 }; // nmol/L
export const ANION_GAP: Range = { min: 6, max: 12 };
export const NA: Range = { min: 137, max: 145 };
export const K: Range = { min: 3.5, max: 4.4 };
export const CL: Range = { min: 98, max: 110 };
export const CA: Range = { min: 2.15, max: 2.5 };
export const CA_ION: Range = { min: 1.15, max: 1.33 };
export const MG: Range = { min: 0.7, max: 0.95 };
export const ALB: Range = { min: 34, max: 45 };
export const PO4: Range = { min: 0.7, max: 1.6 };
export const SIDA: Range = { min: 38, max: 42 };
export const SIDE: Range = { min: 38, max: 42 };
export const SIG: Range = { min: 0, max: 2 };
export const FIO2: Range = { min: 21, max: 21 };
export const OSM: Range = { min: 275, max: 300 };
export const GLU: Range = { min: 4, max: 7 };
export const UREA: Range = { min: 3.2, max: 8.1 };
export const ETH: Range = { min: 0, max: 0 };
export const OSMOLAR_GAP: Range = { min: 0, max: 10 };
export const A_A_DIFF: Range = { min: 0, max: 2.7 }; // kPa
export const HB: Range = { min: 134, max: 170 };
export const COHB: Range = { min: 0, max: 1 };
export const METHB: Range = { min: 0, max: 2 };
export const KREATININ: Range = { min: 60, max: 105 };
export const URINE_AG: Range = { min: 20, max: 90 };
export const URINE_OSM: Range = { min: 750, max: 1000 };

// --- Sex-specific reference ranges ---
// Analytes with a clinically meaningful difference between men and women.
// 'unknown' falls back to a combined range that spans both, so an un-sexed
// patient is never wrongly flagged. Values follow common Swedish lab references
// (e.g. Karolinska/NPU); adjust to your local lab if it differs.
export type Sex = 'unknown' | 'male' | 'female';

export interface SexRanges {
  male: Range;
  female: Range;
  unknown: Range; // widened span covering both, for un-sexed patients
}

export const HB_BY_SEX: SexRanges = {
  male: { min: 134, max: 170 },
  female: { min: 117, max: 153 },
  unknown: { min: 117, max: 170 },
};

export const KREATININ_BY_SEX: SexRanges = {
  male: { min: 60, max: 105 },
  female: { min: 45, max: 90 },
  unknown: { min: 45, max: 105 },
};

// Urate / uric acid (mmol/L)
export const URATE_BY_SEX: SexRanges = {
  male: { min: 0.23, max: 0.48 },
  female: { min: 0.16, max: 0.41 },
  unknown: { min: 0.16, max: 0.48 },
};

// Haematocrit / EVF (fraction)
export const HCT_BY_SEX: SexRanges = {
  male: { min: 0.39, max: 0.50 },
  female: { min: 0.35, max: 0.46 },
  unknown: { min: 0.35, max: 0.50 },
};

// Iron (µmol/L)
export const IRON_BY_SEX: SexRanges = {
  male: { min: 9, max: 34 },
  female: { min: 7, max: 29 },
  unknown: { min: 7, max: 34 },
};

/** Pick the reference range for a sex-dependent analyte. */
export function rangeForSex(r: SexRanges, sex: Sex | undefined): Range {
  return r[sex ?? 'unknown'];
}

/** Map of analyte key -> sex-specific ranges, for generic lookups. */
export const SEX_SPECIFIC: Record<string, SexRanges> = {
  Hb: HB_BY_SEX,
  Krea: KREATININ_BY_SEX,
  Kreatinin: KREATININ_BY_SEX,
  Urate: URATE_BY_SEX,
  Urat: URATE_BY_SEX,
  Hct: HCT_BY_SEX,
  EVF: HCT_BY_SEX,
  Iron: IRON_BY_SEX,
  Fe: IRON_BY_SEX,
};

// Compensation / extra-imbalance constants (arterial baseline in source)
export const PCO2_NORM: Record<SampleType, number> = { arterial: 5.3, venous: 5.3 };
export const HCO3_NORM: Record<SampleType, number> = { arterial: 24, venous: 24 };
export const DELTA_RANGE: Record<SampleType, number> = { arterial: 0.5, venous: 0.5 };
export const ACID_MET_C: Record<SampleType, number> = { arterial: 0.17, venous: 0.17 };
export const ALKA_MET_C: Record<SampleType, number> = { arterial: 0.08, venous: 0.08 };
