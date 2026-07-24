import { encodeTransfer, decodeTransfer, looksLikeTransferCode } from '../transfer';

let pass=0, fail=0;
function check(name:string, cond:boolean, extra=''){ if(cond){pass++;} else {fail++; console.log('  FAIL:', name, extra);} }

// round-trip all seven
const a = { pH:7.20, pCO2:3.4, HCO3:12, BE:-15, Na:140, K:5.6, Cl:100 };
const ca = encodeTransfer(a);
const da = decodeTransfer(ca);
console.log('seven vals ->', ca, '(', ca.length, 'chars )', JSON.stringify(da.fields));
check('pH', da.fields.pH===7.20, String(da.fields.pH));
check('pCO2', da.fields.pCO2===3.4, String(da.fields.pCO2));
check('HCO3', da.fields.HCO3===12, String(da.fields.HCO3));
check('BE', da.fields.BE===-15, String(da.fields.BE));
check('Na', da.fields.Na===140, String(da.fields.Na));
check('K', da.fields.K===5.6, String(da.fields.K));
check('Cl', da.fields.Cl===100, String(da.fields.Cl));
check('no outOfRange', da.outOfRange.length===0);
check('length <= 11', ca.length<=11, String(ca.length));

// partial (three values)
const b = { pH:7.40, pCO2:5.3, K:4.1 };
const db = decodeTransfer(encodeTransfer(b));
console.log('three vals ->', encodeTransfer(b), '(', encodeTransfer(b).length, 'chars )', JSON.stringify(db.fields));
check('partial pH', db.fields.pH===7.40);
check('partial K', db.fields.K===4.1);
check('partial no HCO3', db.fields.HCO3===undefined);

// out-of-range sentinel: pH 8.2 is above max 7.9
const c = { pH:8.2, pCO2:3.4, Na:140 };
const dc = decodeTransfer(encodeTransfer(c));
console.log('OOR pH ->', JSON.stringify(dc));
check('pH flagged out of range', dc.outOfRange.includes('pH'));
check('pH not in fields', dc.fields.pH===undefined);
check('pCO2 still decoded', dc.fields.pCO2===3.4);
check('Na still decoded', dc.fields.Na===140);

// extreme low: K 1.0 below min 1.5
const e = { K:1.0, pH:7.0 };
const de = decodeTransfer(encodeTransfer(e));
check('K flagged out of range', de.outOfRange.includes('K'));
check('pH 7.0 decoded', de.fields.pH===7.0);

// looksLike
check('looksLike true', looksLikeTransferCode(ca));
check('looksLike false (sentence)', !looksLikeTransferCode('pH 7.4 pCO2 5.3'));
check('looksLike false (no prefix)', !looksLikeTransferCode('3kf9Qa2x'));

// empty
check('empty -> empty string', encodeTransfer({})==='');

console.log(`\n========== transfer: ${pass} passed, ${fail} failed ==========`);
if(fail>0) process.exit(1);

// formatting + spaced decode
import { formatTransfer } from '../transfer';
const code = encodeTransfer({ pH:7.20, pCO2:3.4, HCO3:12, BE:-15, Na:140, K:5.6, Cl:100 });
const spaced = formatTransfer(code);
console.log('formatted:', JSON.stringify(spaced));
const checkF=(n:string,c:boolean)=>{ if(c){console.log('  ok',n);} else {console.log('  FAIL',n); process.exit(1);} };
checkF('has one space', (spaced.match(/ /g)||[]).length===1);
checkF('spaced decodes same', JSON.stringify(decodeTransfer(spaced).fields)===JSON.stringify(decodeTransfer(code).fields));
checkF('looksLike spaced', looksLikeTransferCode(spaced));
