// summary.test.ts
// Validates the copyable clinician summary. Run: npx tsx core/__tests__/summary.test.ts

import { calculate, BloodGasInput } from '../calculate';
import { interpret } from '../interpret';
import { summaryText } from '../summary';

let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, extra = '') {
  if (cond) pass++; else { fail++; fails.push(name + (extra ? ` — ${extra}` : '')); }
}
function summ(i: BloodGasInput): string {
  const r = calculate(i); const it = interpret(i, r);
  return summaryText(i, r, it.flags);
}

// HAGMA case
{
  const s = summ({ type: 'venous', pH: 7.20, pCO2: 3.4, HCO3: 12, BE: -15, Na: 140, K: 5.6, Cl: 106, Lac: 8, Glu: 12.4 });
  check('starts with lead-in', s.startsWith('Blodgas visar:'), s.slice(0, 20));
  check('names high anion gap metabolic acidosis', /metabol acidos med högt anjongap/.test(s));
  check('includes pH', /pH 7\.20/.test(s));
  check('includes AG', /AG \d/.test(s));
  check('flags raised potassium', /förhöjt kalium \(5\.6\)/.test(s));
  check('flags raised lactate', /förhöjt laktat \(8\.0\)/.test(s));
  check('states sample type', /Venöst prov\.$/.test(s));
}

// NAGMA case
{
  const s = summ({ type: 'arterial', pH: 7.30, pCO2: 4.6, HCO3: 16, BE: -8, Na: 140, K: 4.0, Cl: 115 });
  check('names normal anion gap metabolic acidosis', /metabol acidos med normalt anjongap \(hyperkloremisk\)/.test(s), s);
}

// Low AG (salicylate-like)
{
  const s = summ({ type: 'arterial', pH: 7.399, pCO2: 2.90, HCO3: 17, BE: -10.8, Na: 137, K: 3.5, Cl: 121, Lac: 1.0 });
  check('low gap reads as normal-gap (NAGMA)', /normalt anjongap/.test(s), s);
  check('names respiratory alkalosis', /respiratorisk alkalos/.test(s), s);
}

// Respiratory acidosis, no spurious electrolytes
{
  const s = summ({ type: 'arterial', pH: 7.315, pCO2: 9.32, HCO3: 29.4, BE: 8.4, Na: 145, K: 4.5, Cl: 98 });
  check('names respiratory acidosis', /respiratorisk acidos/.test(s), s);
  check('does NOT flag K 4.5 as raised', !/förhöjt kalium/.test(s), s);
  check('does NOT flag Na 145 as raised', !/förhöjt natrium/.test(s), s);
}

// Normal gas
{
  const s = summ({ type: 'arterial', pH: 7.40, pCO2: 5.3, HCO3: 24, BE: 0, Na: 140, K: 4.0, Cl: 104 });
  check('normal gas -> no significant disturbance', /ingen signifikant syra-basrubbning/.test(s), s);
}

// pH missing -> empty
{
  const r = calculate({ type: 'arterial', pCO2: 5 } as BloodGasInput);
  const it = interpret({ type: 'arterial', pCO2: 5 } as BloodGasInput, r);
  check('empty when pH missing', summaryText({ type: 'arterial', pCO2: 5 } as BloodGasInput, r, it.flags) === '');
}

// custom lead-in
{
  const r = calculate({ type: 'arterial', pH: 7.40, pCO2: 5.3, HCO3: 24, BE: 0 } as BloodGasInput);
  const it = interpret({ type: 'arterial', pH: 7.40, pCO2: 5.3, HCO3: 24, BE: 0 } as BloodGasInput, r);
  const s = summaryText({ type: 'arterial', pH: 7.40, pCO2: 5.3, HCO3: 24, BE: 0 } as BloodGasInput, r, it.flags, { lead: 'ABG:' });
  check('honours custom lead-in', s.startsWith('ABG:'), s.slice(0, 10));
}

console.log(`========== summary: ${pass} passed, ${fail} failed ==========`);
if (fails.length) fails.forEach((f) => console.log('  - ' + f));
process.exit(fail === 0 ? 0 : 1);
