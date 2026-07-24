// trend.ts
// Shared data + helpers for the Trend tab (app and web). A "series" is a list of
// timepoints, each with a timestamp, sample type, and a set of values. Variables
// are normalized to their reference interval (0 = lower limit, 1 = upper limit;
// values may fall outside) so disparate units can share one chart.

import { BloodGasInput } from './calculate';

export interface TrendPoint {
  t: string;          // sort key / time
  label: string;      // x-axis label
  type: 'arterial' | 'venous';
  v: Partial<Record<TrendKey, number>>;
}

export type TrendKey = 'pH' | 'pCO2' | 'HCO3' | 'BE' | 'Na' | 'K' | 'Cl' | 'Lac' | 'Glu';

export const TREND_RANGES: Record<TrendKey, [number, number]> = {
  pH: [7.35, 7.45], pCO2: [4.6, 6.0], HCO3: [22, 27], BE: [-3, 3],
  Na: [137, 145], K: [3.5, 4.4], Cl: [98, 110], Lac: [0.5, 2.2], Glu: [4, 6],
};

export const TREND_UNITS: Record<TrendKey, string> = {
  pH: '', pCO2: 'kPa', HCO3: 'mmol/L', BE: 'mmol/L',
  Na: 'mmol/L', K: 'mmol/L', Cl: 'mmol/L', Lac: 'mmol/L', Glu: 'mmol/L',
};

export const TREND_COLORS: Record<TrendKey, string> = {
  pH: '#d32f2f', pCO2: '#1976d2', HCO3: '#388e3c', BE: '#f57c00',
  Na: '#7b1fa2', K: '#c2185b', Cl: '#0097a7', Lac: '#d32f2f', Glu: '#5d4037',
};

export const TREND_LABELS: Record<TrendKey, string> = {
  pH: 'pH', pCO2: 'pCO₂', HCO3: 'HCO₃⁻', BE: 'BE',
  Na: 'Na⁺', K: 'K⁺', Cl: 'Cl⁻', Lac: 'Laktat', Glu: 'Glukos',
};

export const GAS_VARS: TrendKey[] = ['pH', 'pCO2', 'HCO3', 'BE'];
export const ELYTE_VARS: TrendKey[] = ['Na', 'K', 'Cl', 'Glu'];

/** Normalize to fraction of reference interval (0 = lower, 1 = upper; may exceed). */
export function normVal(key: TrendKey, val: number): number {
  const rg = TREND_RANGES[key];
  return (val - rg[0]) / (rg[1] - rg[0]);
}

/** Is the value outside its reference range? */
export function isOOR(key: TrendKey, val: number): boolean {
  const rg = TREND_RANGES[key];
  return val < rg[0] || val > rg[1];
}

/** Lactate clearance from the series (peak/latest/percent cleared from peak). */
export function lactateClearance(series: TrendPoint[]): { peak: number; latest: number; clearancePct: number } | null {
  const lacs = series.map((s) => s.v.Lac).filter((x): x is number => x !== undefined);
  if (lacs.length < 1) return null;
  const peak = Math.max(...lacs);
  const latest = lacs[lacs.length - 1];
  const clearancePct = peak > 0 ? ((peak - latest) / peak) * 100 : 0;
  return { peak, latest, clearancePct };
}

/** Map a trend point to Analyzer inputs. */
export function pointToInput(p: TrendPoint): BloodGasInput {
  return { type: p.type, ...p.v } as BloodGasInput;
}

// Demo series: a deteriorating-then-recovering admission built from example-gas
// values, used until the user supplies their own (photos or manual entry).
export const TREND_DEMO: TrendPoint[] = [
  { t: '08:00', label: '08:00', type: 'venous',   v: { pH: 7.30, pCO2: 4.6, HCO3: 18, BE: -6,  Na: 138, K: 4.8, Cl: 104, Lac: 4.2, Glu: 9.1 } },
  { t: '10:30', label: '10:30', type: 'venous',   v: { pH: 7.20, pCO2: 3.4, HCO3: 12, BE: -15, Na: 140, K: 5.1, Cl: 106, Lac: 8.0, Glu: 12.4 } },
  { t: '13:00', label: '13:00', type: 'arterial', v: { pH: 7.10, pCO2: 3.0, HCO3: 9,  BE: -21, Na: 142, K: 5.6, Cl: 108, Lac: 14.0, Glu: 15.0 } },
  { t: '16:00', label: '16:00', type: 'arterial', v: { pH: 7.22, pCO2: 3.6, HCO3: 13, BE: -13, Na: 141, K: 4.9, Cl: 107, Lac: 7.1, Glu: 10.2 } },
  { t: '20:00', label: '20:00', type: 'venous',   v: { pH: 7.34, pCO2: 4.8, HCO3: 19, BE: -5,  Na: 139, K: 4.3, Cl: 105, Lac: 3.0, Glu: 7.4 } },
  { t: '00:00', label: '00:00', type: 'venous',   v: { pH: 7.39, pCO2: 5.2, HCO3: 23, BE: -1,  Na: 138, K: 4.1, Cl: 103, Lac: 1.6, Glu: 6.1 } },
];
