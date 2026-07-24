// parseGas.test.ts
// Validates parseGas() against the 14 user-verified example reports.
//
// Run:  npx tsx core/__tests__/parseGas.test.ts
//
// Each OCR-text fixture (fixtures/ocr_text/blodgasN.txt) represents the text a
// recognizer produces for image N. We parse it and assert the extracted values
// and sample type match the verified ground truth in fixtures/expected.ts.

import * as fs from 'fs';
import * as path from 'path';
import { parseGas } from '../parseGas';
import { expectedGases } from './fixtures/expected';

const OCR_DIR = path.join(__dirname, 'fixtures', 'ocr_text');

// Keys we compare (the ones the parser is responsible for).
const COMPARE_KEYS = [
  'pH', 'pCO2', 'O2', 'BE', 'Na', 'K', 'Cl', 'Ca', 'Glu', 'Lac', 'lo2',
  'Hb', 'MetHb', 'COHb', 'O2sat', 'stdBicarb', 'actualBicarb', 'anionGap',
  'anionGapInclK', 'Crea', 'osmolality',
];

interface Mismatch { image: string; key: string; expected: any; got: any; }

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function run() {
  let pass = 0, fail = 0;
  const mismatches: Mismatch[] = [];
  const typeErrors: string[] = [];

  for (const exp of expectedGases) {
    const fixturePath = path.join(OCR_DIR, exp.image.replace('.jpg', '.txt'));
    if (!fs.existsSync(fixturePath)) {
      console.log(`  ⚠️  missing fixture for ${exp.image}`);
      continue;
    }
    const text = fs.readFileSync(fixturePath, 'utf8');
    const parsed = parseGas(text);

    // Sample type
    if (parsed.type !== exp.type) {
      typeErrors.push(`${exp.image}: type expected ${exp.type}, got ${parsed.type}`);
    }

    // Values
    for (const key of COMPARE_KEYS) {
      const want = (exp.values as any)[key];
      const got = parsed.values[key];
      if (want === undefined && got === undefined) continue;
      if (want === undefined && got !== undefined) {
        mismatches.push({ image: exp.image, key, expected: '(none)', got });
        fail++;
        continue;
      }
      if (got === undefined) {
        mismatches.push({ image: exp.image, key, expected: want, got: '(missing)' });
        fail++;
        continue;
      }
      if (approxEqual(want, got)) pass++;
      else { mismatches.push({ image: exp.image, key, expected: want, got }); fail++; }
    }
  }

  console.log('\n========== parseGas test results ==========');
  console.log(`Value assertions: ${pass} passed, ${fail} failed`);
  console.log(`Sample-type errors: ${typeErrors.length}`);
  if (typeErrors.length) typeErrors.forEach((t) => console.log('  ✗ ' + t));
  if (mismatches.length) {
    console.log('\nValue mismatches:');
    for (const m of mismatches) {
      console.log(`  ✗ ${m.image} ${m.key}: expected ${m.expected}, got ${m.got}`);
    }
  }
  const ok = fail === 0 && typeErrors.length === 0;
  console.log('\n' + (ok ? '✅ ALL TESTS PASSED' : `❌ ${fail + typeErrors.length} FAILURES`));
  console.log('===========================================\n');
  return ok;
}

const ok = run();
process.exit(ok ? 0 : 1);

// Regression: vision models transcribe formulae with Unicode sub/superscripts.
{
  const r = parseGas('cHCO₃⁻(P,st)c 26,1 mmol/L\npCO₂ 3,28 kPa\ncNa⁺ 129\ncK⁺ 2,1\ncCl⁻ 83');
  const ok = r.values.stdBicarb === 26.1 && r.values.pCO2 === 3.28 && r.values.Na === 129 && r.values.K === 2.1 && r.values.Cl === 83;
  console.log(ok ? '  ok subscript/superscript formulae parse' : '  FAIL subscripts: ' + JSON.stringify(r.values));
  if(!ok) process.exitCode = 1;
}
