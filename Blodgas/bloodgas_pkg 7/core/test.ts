import { calculate } from './calculate';
import { interpret } from './interpret';

function show(name:string, input:any){
  const res = calculate(input);
  const it = interpret(input, res);
  console.log('\n=== '+name+' ===');
  console.log(it.headline, '('+it.headlineDetail+')');
  for(const l of it.lines){
    if(l.kind==='primaryHeader'||l.kind==='compensationHeader') console.log('  --- '+l.detail+' ---');
    else console.log('   • '+l.label+(l.detail?('  ['+l.detail+']'):''));
  }
  console.log('   flags:', Object.entries(it.flags).filter(([k,v])=>v).map(([k])=>k).join(', ')||'none');
}

// 1. HAGMA (DKA): low pH, low HCO3, high AG, resp compensation
show('DKA — HAGMA with resp compensation', {
  type:'arterial', pH:7.20, pCO2:3.0, HCO3:10, BE:-15, Na:140, Cl:100, K:5, Lac:2,
});

// 2. NAGMA (diarrhoea): low pH, low HCO3, normal AG
show('NAGMA — normal anion gap acidosis', {
  type:'arterial', pH:7.30, pCO2:4.6, HCO3:16, BE:-8, Na:140, Cl:115, K:3.5,
});

// 3. Respiratory acidosis (COPD): low pH, high CO2, compensated
show('Respiratory acidosis (chronic)', {
  type:'arterial', pH:7.33, pCO2:8.5, HCO3:33, BE:6, Na:140, Cl:100,
});

// 4. Respiratory alkalosis (hyperventilation)
show('Respiratory alkalosis', {
  type:'arterial', pH:7.52, pCO2:3.2, HCO3:22, BE:0, Na:140, Cl:104,
});

// 5. Metabolic alkalosis (vomiting)
show('Metabolic alkalosis', {
  type:'arterial', pH:7.52, pCO2:6.0, HCO3:38, BE:12, Na:140, Cl:90, K:3.0,
});

// 6. Normal
show('Normal arterial gas', {
  type:'arterial', pH:7.40, pCO2:5.3, HCO3:24, BE:0, Na:140, Cl:104,
});
