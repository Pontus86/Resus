// stewart.test.ts
// Validates the Stewart module: SIDa/SIDe/SIG math, assumed-normals handling,
// and the plain-language lines. Run: npx tsx core/__tests__/stewart.test.ts

import { calculate } from '../calculate';
import { computeStewart, stewartLines, STEWART_NORMALS } from '../stewart';
import { BloodGasInput } from '../calculate';

let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; fails.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}
const approx = (a: number, b: number, tol = 0.15) => Math.abs(a - b) < tol;

// --- Case 1: full set entered, nothing assumed ---
{
  const i: BloodGasInput = { type: 'arterial', pH: 7.2, pCO2: 3.4, HCO3: 12, BE: -17, Na: 140, K: 4.5, Cl: 100, Ca: 1.2, Mg: 0.85, Alb: 40, PO4: 1.1, Lac: 8 };
  const r = calculate(i);
  const s = computeStewart(i, r)!;
  check('case1: computes (all entered)', s !== null);
  check('case1: nothing assumed', s.assumed.length === 0, `assumed=[${s.assumed}]`);
  // SIDa = Na + K + 2Mg + 2Ca - Cl = 140 + 4.5 + 1.7 + 2.4 - 100 = 48.6
  check('case1: SIDa ~ 48.6', approx(s.SIDa, 48.6), `got ${s.SIDa.toFixed(2)}`);
  check('case1: SIG raised (>6) with lactate 8', s.SIG > 6, `SIG=${s.SIG.toFixed(2)}`);
}

// --- Case 2: albumin/phosphate/Mg/Ca missing -> assumed normals ---
{
  const i: BloodGasInput = { type: 'arterial', pH: 7.2, pCO2: 3.4, HCO3: 12, BE: -17, Na: 140, K: 4.5, Cl: 100, Lac: 8 };
  const r = calculate(i);
  const s = computeStewart(i, r)!;
  check('case2: Mg assumed', s.assumed.includes('Mg'));
  check('case2: Ca assumed', s.assumed.includes('Ca'));
  check('case2: Alb assumed', s.assumed.includes('Alb'));
  check('case2: PO4 assumed', s.assumed.includes('PO4'));
  check('case2: K NOT assumed (entered)', !s.assumed.includes('K'));
  check('case2: Lac NOT assumed (entered)', !s.assumed.includes('Lac'));
  check('case2: used.Alb == normal', s.used.Alb === STEWART_NORMALS.Alb);
  // SIDa identical to case1 since K entered and Mg/Ca assumed to the same normals used there
  check('case2: SIDa ~ 48.6', approx(s.SIDa, 48.6), `got ${s.SIDa.toFixed(2)}`);
}

// --- Case 3: minimum inputs missing -> null ---
{
  const i: BloodGasInput = { type: 'arterial', pH: 7.2, pCO2: 3.4, BE: -17 }; // no Na/Cl
  const r = calculate(i);
  const s = computeStewart(i, r);
  check('case3: returns null without Na/Cl', s === null);
}

// --- Case 4: hypoalbuminaemia surfaces a line ---
{
  const i: BloodGasInput = { type: 'arterial', pH: 7.35, pCO2: 5.0, HCO3: 20, BE: -4, Na: 140, K: 4, Cl: 105, Alb: 18, Lac: 1 };
  const r = calculate(i);
  const s = computeStewart(i, r)!;
  const lines = stewartLines(s);
  check('case4: hypoalbuminaemia line present', lines.some((l) => /Hypoalbumin/i.test(l.label)));
}

// --- Case 5: balanced gas -> SIG normal, no major abnormality ---
{
  const i: BloodGasInput = { type: 'arterial', pH: 7.40, pCO2: 5.3, HCO3: 24, BE: 0, Na: 140, K: 4.2, Cl: 106, Alb: 42, PO4: 1.1, Ca: 1.2, Mg: 0.85, Lac: 1 };
  const r = calculate(i);
  const s = computeStewart(i, r)!;
  check('case5: SIG not clearly raised (<=6)', s.SIG <= 6, `SIG=${s.SIG.toFixed(2)}`);
  const lines = stewartLines(s);
  check('case5: no disorder line', !lines.some((l) => l.kind === 'disorder'), `lines=${lines.map(l => l.label).join('|')}`);
}

console.log(`\n========== stewart: ${pass} passed, ${fail} failed ==========`);
if (fails.length) { fails.forEach((f) => console.log('  - ' + f)); }
process.exit(fail === 0 ? 0 : 1);
