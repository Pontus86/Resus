// trend.test.ts
// Validates the trend helpers that drive both the web and app charts.
// Run: npx tsx core/__tests__/trend.test.ts

import {
  TREND_DEMO, normVal, isOOR, lactateClearance, pointToInput, TREND_RANGES,
} from '../trend';

let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; } else { fail++; fails.push(name + (extra ? ` — ${extra}` : '')); }
}
const approx = (a: number, b: number, t = 0.001) => Math.abs(a - b) < t;

// normVal: lower limit -> 0, upper -> 1, midpoint -> 0.5
check('normVal pH lower=0', approx(normVal('pH', 7.35), 0));
check('normVal pH upper=1', approx(normVal('pH', 7.45), 1));
check('normVal Na mid=0.5', approx(normVal('Na', (137 + 145) / 2), 0.5));
check('normVal below range negative', normVal('pH', 7.20) < 0);
check('normVal above range >1', normVal('Lac', 8) > 1);

// isOOR
check('isOOR pH 7.20 true', isOOR('pH', 7.20));
check('isOOR pH 7.40 false', !isOOR('pH', 7.40));
check('isOOR Lac 1.0 false', !isOOR('Lac', 1.0));
check('isOOR Lac 14 true', isOOR('Lac', 14));

// lactate clearance on demo series: peak 14, latest 1.6 -> ~88.6%
{
  const c = lactateClearance(TREND_DEMO)!;
  check('clearance peak 14', approx(c.peak, 14));
  check('clearance latest 1.6', approx(c.latest, 1.6));
  check('clearance ~88.6%', Math.abs(c.clearancePct - 88.57) < 0.5, `got ${c.clearancePct.toFixed(2)}`);
}

// pointToInput maps type + values
{
  const inp = pointToInput(TREND_DEMO[2]); // 13:00 arterial
  check('pointToInput type', inp.type === 'arterial');
  check('pointToInput pH', inp.pH === 7.10);
  check('pointToInput Na', inp.Na === 142);
}

// demo series shape
check('demo has 6 points', TREND_DEMO.length === 6);
check('demo every point has pH', TREND_DEMO.every((p) => p.v.pH !== undefined));
check('demo every point has Lac', TREND_DEMO.every((p) => p.v.Lac !== undefined));

// ranges sane (lower < upper)
check('all ranges lower<upper', (Object.keys(TREND_RANGES) as Array<keyof typeof TREND_RANGES>).every((k) => TREND_RANGES[k][0] < TREND_RANGES[k][1]));

console.log(`========== trend: ${pass} passed, ${fail} failed ==========`);
if (fails.length) fails.forEach((f) => console.log('  - ' + f));
process.exit(fail === 0 ? 0 : 1);
