import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { theme } from '@/constants/theme';
import { calculate, BloodGasInput } from '@/core/calculate';
import { interpret } from '@/core/interpret';
import { computeStewart, stewartLines, stewartSummary, STEWART_LABELS } from '@/core/stewart';
import { summaryText } from '@/core/summary';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { encodeTransfer, formatTransfer } from '@/core/transfer';
import { PH, PCO2, O2 as O2REF, SEX_SPECIFIC, rangeForSex } from '@/core/reference';

type FieldDef = { k: keyof BloodGasInput | string; label: string; unit: string; req?: boolean };

const CORE: FieldDef[] = [
  { k: 'pH', label: 'pH', unit: '', req: true },
  { k: 'pCO2', label: 'pCO₂', unit: 'kPa', req: true },
  { k: 'HCO3', label: 'HCO₃⁻', unit: 'mmol/L', req: true },
  { k: 'BE', label: 'BE', unit: 'mmol/L', req: true },
  { k: 'Na', label: 'Na⁺', unit: 'mmol/L', req: true },
  { k: 'Cl', label: 'Cl⁻', unit: 'mmol/L', req: true },
  { k: 'K', label: 'K⁺', unit: 'mmol/L' },
  { k: 'Lac', label: 'Laktat', unit: 'mmol/L' },
  { k: 'O2', label: 'pO₂', unit: 'kPa' },
  { k: 'Glu', label: 'Glukos', unit: 'mmol/L' },
];
const EXTRA: FieldDef[] = [
  { k: 'Alb', label: 'Albumin', unit: 'g/L' },
  { k: 'PO4', label: 'Fosfat', unit: 'mmol/L' },
  { k: 'Ca', label: 'Ca²⁺', unit: 'mmol/L' },
  { k: 'Mg', label: 'Mg²⁺', unit: 'mmol/L' },
  { k: 'Osm', label: 'Osmolalitet', unit: 'mosm/kg' },
  { k: 'Urea', label: 'Urea', unit: 'mmol/L' },
  { k: 'Eth', label: 'Etanol', unit: 'mmol/L' },
  { k: 'Hb', label: 'Hb', unit: 'g/L' },
  { k: 'Krea', label: 'Kreatinin', unit: 'µmol/L' },
  { k: 'COHb', label: 'CO-Hb', unit: '%' },
  { k: 'MetHb', label: 'Met-Hb', unit: '%' },
  { k: 'FiO2input', label: 'FiO₂', unit: '%' },
  { k: 'O2sat', label: 'sO₂', unit: '%' },
  { k: 'lo2', label: 'O₂-tillägg', unit: 'L/min' },
  { k: 'weight', label: 'Vikt', unit: 'kg' },
];

const fmt = (x: number | undefined, d = 1) =>
  x === undefined || Number.isNaN(x) ? '-' : (Math.round(x * 10 ** d) / 10 ** d).toString();

export default function Calculator() {
  const params = useLocalSearchParams<{ scanned?: string; sampleType?: string; trendPoint?: string }>();
  const [type, setType] = useState<'arterial' | 'venous'>('venous');
  const [gender, setGender] = useState<'unknown' | 'male' | 'female'>('unknown');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [showExtra, setShowExtra] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof buildResult> | null>(null);
  const [mode, setMode] = useState<'standard' | 'stewart'>('standard');

  // If navigated here from the Scan or Trend tab with values, prefill.
  useState(() => {
    if (params.scanned) {
      try {
        const parsed = JSON.parse(params.scanned) as Record<string, unknown>;
        const asStr: Record<string, string> = {};
        Object.entries(parsed).forEach(([k, v]) => { if (v !== undefined && v !== null) asStr[k] = String(v); });
        setVals(asStr);
      } catch {}
      if (params.sampleType === 'arterial' || params.sampleType === 'venous') setType(params.sampleType);
    }
    if (params.trendPoint) {
      try {
        const p = JSON.parse(params.trendPoint) as { type?: 'arterial' | 'venous'; v: Record<string, number> };
        const asStr: Record<string, string> = {};
        Object.entries(p.v).forEach(([k, v]) => { asStr[k] = String(v); });
        setVals(asStr);
        if (p.type === 'arterial' || p.type === 'venous') setType(p.type);
      } catch {}
    }
  });

  const setVal = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const run = useCallback(() => {
    const input: BloodGasInput = { type, gender } as BloodGasInput;
    [...CORE, ...EXTRA].forEach((f) => {
      const raw = vals[f.k as string];
      if (raw && raw.trim() !== '') {
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isNaN(n)) (input as any)[f.k] = n;
      }
    });
    if (input.pH === undefined) { setResult(null); return; }
    setResult(buildResult(input));
  }, [type, gender, vals]);

  const reset = () => { setVals({}); setResult(null); };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Card title="Patient och prov">
        <Row>
          <Seg label="Provtyp" value={type} onChange={setType as any}
               options={[['arterial', 'Arteriellt'], ['venous', 'Venöst']]} />
        </Row>
        <Row>
          <Seg label="Kön" value={gender} onChange={setGender as any}
               options={[['unknown', 'Ej angivet'], ['male', 'Man'], ['female', 'Kvinna']]} />
        </Row>

        <Text style={s.sectionLabel}>Värden</Text>
        <Fields defs={CORE} vals={vals} setVal={setVal} type={type} />

        <Pressable onPress={() => setShowExtra((x) => !x)} style={s.moreToggle}>
          <Text style={s.moreText}>{showExtra ? '▾' : '▸'} Fler värden</Text>
        </Pressable>
        {showExtra && <Fields defs={EXTRA} vals={vals} setVal={setVal} type={type} />}

        <View style={s.actions}>
          <Pressable style={[s.btn, s.btnPrimary]} onPress={run}>
            <Text style={s.btnPrimaryText}>Beräkna</Text>
          </Pressable>
          <Pressable style={[s.btn, s.btnGhost]} onPress={reset}>
            <Text style={s.btnGhostText}>Rensa</Text>
          </Pressable>
        </View>
      </Card>

      {result && (
        <Card title="Analys">
          <View style={s.toggle}>
            <Pressable
              style={[s.toggleBtn, mode === 'standard' && s.toggleBtnActive]}
              onPress={() => setMode('standard')}>
              <Text style={[s.toggleText, mode === 'standard' && s.toggleTextActive]}>Standard</Text>
            </Pressable>
            <Pressable
              style={[s.toggleBtn, mode === 'stewart' && s.toggleBtnActive]}
              onPress={() => setMode('stewart')}>
              <Text style={[s.toggleText, mode === 'stewart' && s.toggleTextActive]}>Stewart</Text>
            </Pressable>
          </View>

          {mode === 'standard' ? (
            <>
              <View style={s.interpPanel}>
                <View style={s.v4Row}>
                  <Text style={s.v4Th}>Status</Text>
                  <View style={s.v4Td}>
                    <Text style={[s.v4Val, s.v4Status]}>
                      {result.headline} <Text style={s.v4Ph}>{result.headlineDetail}</Text>
                    </Text>
                  </View>
                </View>
                {result.lines.map((l, i) => {
                  if (l.kind === 'primaryHeader' || l.kind === 'compensationHeader')
                    return <Text key={i} style={s.v4Sec}>{l.detail}</Text>;
                  const MN: Record<string, string> = { hagma: 'MUDPILERS', nagma: 'USEDCRAP', lowag: 'LIMB', metalk: 'CLEVER PD', respaci: 'DEPRESS', respalk_hypoxic: 'APA / STAPLES', lactate: 'LACTATES' };
                  const isNote = l.kind === 'note';
                  // When this line is the metabolic-acidosis disorder, follow it
                  // with dedicated Anjongap and Delta-delta rows so the user sees
                  // the gap and the delta-delta on their own labelled rows.
                  const isMetAcid = l.mnemonic === 'hagma' || l.mnemonic === 'nagma';
                  const ag = result.calc?.anionGap;
                  const dd = result.calc?.extraImbalance; // ΔAG + HCO3
                  const ddNote = dd === undefined ? '' :
                    dd < 21 ? ' – möjlig samtidig NAGMA' :
                    dd > 27 ? ' – möjlig samtidig metabol alkalos/kronisk resp. acidos' : '';
                  return (
                    <React.Fragment key={i}>
                      <View style={s.v4Row}>
                        <Text style={[s.v4Th, isNote && s.v4NoteTh]}>{l.label}</Text>
                        <View style={s.v4Td}>
                          <Text style={[s.v4Val, isNote && s.v4Note]}>{l.detail || '—'}</Text>
                          {l.mnemonic && (
                            <Pressable
                              style={s.v4Mn}
                              onPress={() => router.push({ pathname: '/reference', params: { focus: l.mnemonic } })}>
                              <Text style={s.v4MnText}>{MN[l.mnemonic]} ↗</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      {isMetAcid && ag !== undefined && (
                        <View style={s.v4Row}>
                          <Text style={s.v4Th}>Anjongap</Text>
                          <View style={s.v4Td}><Text style={s.v4Val}>{fmt(ag, 0)} mmol/L</Text></View>
                        </View>
                      )}
                      {isMetAcid && dd !== undefined && (
                        <View style={s.v4Row}>
                          <Text style={s.v4Th}>Delta-delta</Text>
                          <View style={s.v4Td}><Text style={s.v4Val}>{fmt(dd, 1)}{ddNote}</Text></View>
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={s.interpPanel}><StewartView result={result} /></View>
            </>
          )}
        </Card>
      )}

      {result && (!!(mode === 'standard' ? result.summary : result.stewartSummary) || !!result.transferCode) && (
        <Card title="Journal och överföring">
          {mode === 'standard'
            ? !!result.summary && <JournalSummary text={result.summary} />
            : !!result.stewartSummary && <JournalSummary text={result.stewartSummary} />}
          {!!result.transferCode && <CodeExport code={result.transferCode} />}
        </Card>
      )}

      {result && (
        <Card title="Labbvärden">
          <View style={s.valuesHeadRow}>
            <Text style={s.grpHead}>Värden</Text>
            {result.oorCount > 0 && (
              <Text style={s.valuesOorNote}>{result.oorCount} utanför referens</Text>
            )}
          </View>
          {result.values.map((d, i) => {
            const flagged = d.status !== 0;
            const arrow = d.status < 0 ? '↓' : d.status > 0 ? '↑' : '';
            return (
              <View key={i} style={[s.dRow, flagged && s.dRowFlagged]}>
                <Text style={[s.dName, flagged && s.dNameFlagged]}>
                  {flagged ? <Text style={s.dFlag}>{arrow} </Text> : null}{d.name}
                </Text>
                <Text style={[s.dVal, flagged && s.dValFlagged]}>{d.disp}<Text style={s.dUnit}> {d.unit}</Text></Text>
                {!!d.range && <Text style={s.dRef}>{d.range}</Text>}
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

function StewartView({ result }: { result: ReturnType<typeof buildResult> }) {
  const s2 = result.stewart;
  if (!s2) {
    return <Text style={s.lead}>Stewart kräver minst pH, Na⁺ och Cl⁻.</Text>;
  }
  const lines = stewartLines(s2);
  const assumedSet = new Set(s2.assumed);
  const metric = (label: string, val: number, ref: string, hi = false) => (
    <View style={[s.svMetric, hi && s.svMetricHi]}>
      <Text style={s.svMlabel}>{label}</Text>
      <Text style={[s.svMval, hi && s.svMvalHi]}>{val.toFixed(1)}</Text>
      <Text style={s.svMref}>{ref}</Text>
    </View>
  );
  const valRow = (name: string, key: string, val: number, unit: string) => (
    <View style={s.svRow} key={key}>
      <Text style={s.svName}>{name}</Text>
      <Text style={s.svVal}>{val.toFixed(key === 'pH' ? 2 : 1)}<Text style={s.svUnit}> {unit}</Text></Text>
      <View style={[s.svTag, assumedSet.has(key) ? s.svTagAssumed : s.svTagEntered]}>
        <Text style={[s.svTagText, assumedSet.has(key) ? s.svTagTextAssumed : s.svTagTextEntered]}>
          {assumedSet.has(key) ? 'antaget' : 'inmatat'}
        </Text>
      </View>
    </View>
  );
  return (
    <View>
      <Text style={s.lead}>Stewart fysikalisk-kemisk analys</Text>
      <View style={s.svMetrics}>
        {metric('SIDa', s2.SIDa, '38–42')}
        {metric('SIDe', s2.SIDe, '38–42')}
        {metric('SIG', s2.SIG, '0–2', s2.SIG > 6)}
      </View>
      {lines.map((l, i) => {
        const dot = l.kind === 'disorder' ? theme.red : l.kind === 'none' ? theme.ok : theme.warn;
        return (
          <View key={i} style={s.sline}>
            <View style={[s.dot, { backgroundColor: dot, marginTop: 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.slineMain}>{l.label}</Text>
              {!!l.detail && <Text style={s.slineDetail}>{l.detail}</Text>}
            </View>
          </View>
        );
      })}
      {s2.assumed.length > 0 && (
        <View style={s.svNote}>
          <Text style={s.svNoteText}>
            Antar normalt {s2.assumed.map((k) => STEWART_LABELS[k] || k).join(', ')} (ej inmatat).
            Stewart är mest informativt när albumin och fosfat är uppmätta. Mata in dem för ett korrekt strong ion gap.
          </Text>
        </View>
      )}
      <Text style={[s.grpHead, { marginTop: 14 }]}>Använda värden</Text>
      {valRow('Na⁺', 'Na', s2.used.Na, 'mmol/L')}
      {valRow('Cl⁻', 'Cl', s2.used.Cl, 'mmol/L')}
      {valRow('K⁺', 'K', s2.used.K, 'mmol/L')}
      {valRow('Mg²⁺', 'Mg', s2.used.Mg, 'mmol/L')}
      {valRow('Ca²⁺', 'Ca', s2.used.Ca, 'mmol/L')}
      {valRow('Albumin', 'Alb', s2.used.Alb, 'g/L')}
      {valRow('Fosfat', 'PO4', s2.used.PO4, 'mmol/L')}
      {valRow('Laktat', 'Lac', s2.used.Lac, 'mmol/L')}
    </View>
  );
}

function JournalSummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <View style={s.journalBlock}>
      <View style={s.journalLabelRow}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={theme.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 4a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <Path d="M8 7h6M8 11h8M8 15h5" />
        </Svg>
        <Text style={s.journalLabel}>Journal</Text>
      </View>
      <View style={s.jsummary}>
        <Text style={s.jsummaryText}>{text}</Text>
        <Pressable style={[s.jsummaryCopy, copied && s.jsummaryCopied]} onPress={copy}>
          <Text style={[s.jsummaryCopyText, copied && s.jsummaryCopyTextOn]}>{copied ? 'Kopierat' : 'Kopiera'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CodeExport({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code); // copy unspaced; decode ignores spaces anyway
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <View style={s.codeExport}>
      <Text style={s.codeExportLabel}>Överföringskod</Text>
      <View style={s.codeExportRow}>
        <Text style={s.codeExportVal}>{formatTransfer(code)}</Text>
        <Pressable style={[s.codeExportCopy, copied && s.codeExportCopied]} onPress={copy}>
          <Text style={[s.codeExportCopyText, copied && s.codeExportCopyTextOn]}>{copied ? 'Kopierat' : 'Kopiera'}</Text>
        </Pressable>
      </View>
      <Text style={s.codeExportHint}>Skriv av eller kopiera koden för att öppna samma analys på en annan enhet (via Skanna-fliken).</Text>
    </View>
  );
}

// Shared reference ranges for entered values (mirrors web SHARED).
const SHARED_REF: Record<string, [number, number]> = {
  HCO3: [22, 27], BE: [-3, 3], Na: [137, 145], K: [3.5, 4.4], Cl: [98, 110],
  Lac: [0, 2.3], Ca: [2.15, 2.5], Mg: [0.7, 0.95], Alb: [34, 45], PO4: [0.7, 1.6],
  Glu: [4, 7], Urea: [3.2, 8.1], Osm: [275, 300], COHb: [0, 1], MetHb: [0, 2],
};

type ValItem = { name: string; num: number; disp: string; unit: string; range: [number, number] | null };

function refFor(key: string, type: 'arterial' | 'venous', sex: 'unknown' | 'male' | 'female'): [number, number] | null {
  if (key === 'pH') return [PH[type].min, PH[type].max];
  if (key === 'pCO2') return [PCO2[type].min, PCO2[type].max];
  if (key === 'O2') { const o = O2REF[type]; return o ? [o.min, o.max] : null; }
  if (SEX_SPECIFIC[key]) { const r = rangeForSex(SEX_SPECIFIC[key], sex); return [r.min, r.max]; }
  if (SHARED_REF[key]) return SHARED_REF[key];
  return null;
}

function buildResult(input: BloodGasInput) {
  const r = calculate(input);
  const it = interpret(input, r);
  const cls = it.flags.acidaemia ? 'aci' : it.flags.alkalaemia ? 'alk' : '';
  const type = (input.type || 'venous') as 'arterial' | 'venous';
  const sex = ((input as any).gender || 'unknown') as 'unknown' | 'male' | 'female';

  const items: ValItem[] = [];
  const push = (name: string, num: number, disp: string, unit: string, range: [number, number] | null) =>
    items.push({ name, num, disp, unit, range });

  // Entered values (flagged against reference)
  for (const def of [...CORE, ...EXTRA]) {
    const v = (input as any)[def.k];
    if (v === undefined || v === null || Number.isNaN(v)) continue;
    push(def.label, v, String(v), def.unit, refFor(def.k, type, sex));
  }
  // Derived values
  const d = (name: string, num: number | undefined, unit: string, range: [number, number] | null) => {
    if (num !== undefined && !Number.isNaN(num)) push(name, num, fmt(num, 1), unit, range);
  };
  d('Beräknat HCO₃⁻', r.pHCO3, 'mmol/L', [22, 27]);
  d('Beräknat BE', r.calcBE, 'mmol/L', [-3, 3]);
  d('Anjongap', r.anionGap, 'mmol/L', [0, 12]);
  d('Anjongap (inkl. K⁺)', r.anionGap_K, 'mmol/L', null);
  d('Albuminkorrigerat AG', r.AGalb, 'mmol/L', null);
  d('Korrigerat Na⁺', r.corrNa, 'mmol/L', null);
  d('SIDa', r.SIDa, 'mmol/L', [38, 42]);
  d('SIDe', (r as any).SIDe, 'mmol/L', [38, 42]);
  d('Strong ion gap', r.SIG, 'mmol/L', [0, 2]);
  d('Osmolalt gap', r.osmolarGap, 'mosm/kg', [0, 10]);
  if (r.FiO2 !== undefined) push('FiO₂', r.FiO2, fmt(r.FiO2, 0), '%', null);
  d('A–a-differens', r.A_a_diff, 'kPa', [0, 2.7]);
  d('P/F-kvot', r.pfRatio, 'kPa', [40, 999]);
  d('Syreinnehåll CaO₂', r.CaO2, 'mL/dL', [16, 20]);
  d('P50', r.p50, 'kPa', [3.1, 3.9]);

  const status = (it2: ValItem): -1 | 0 | 1 => {
    if (!it2.range) return 0;
    if (it2.num < it2.range[0]) return -1;
    if (it2.num > it2.range[1]) return 1;
    return 0;
  };
  const decorated = items.map((v, idx) => ({ v, idx, st: status(v) }));
  const oor = decorated.filter((x) => x.st !== 0);
  const inr = decorated.filter((x) => x.st === 0);
  const values = [...oor, ...inr].map(({ v, st }) => ({
    name: v.name, disp: v.disp, unit: v.unit,
    range: v.range ? `${v.range[0]}–${v.range[1]}` : '',
    status: st as -1 | 0 | 1,
  }));
  const oorCount = oor.length;

  const stewart = computeStewart(input, r);
  const summary = summaryText(input, r, it.flags);
  const stewartSum = stewartSummary(stewart);
  const transferCode = encodeTransfer({
    pH: input.pH, pCO2: input.pCO2, HCO3: input.HCO3, BE: input.BE,
    Na: input.Na, K: input.K, Cl: input.Cl,
  });
  return { ...it, cls, values, oorCount, stewart, input, calc: r, summary, stewartSummary: stewartSum, transferCode };
}

// ---- small components ----
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ marginBottom: 12 }}>{children}</View>;
}
function Seg<T extends string>({ label, value, onChange, options }:
  { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <View>
      <Text style={s.controlLabel}>{label}</Text>
      <View style={s.seg}>
        {options.map(([v, txt]) => {
          const active = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)}
              style={[s.segBtn, active && s.segBtnActive]}>
              <Text style={[s.segText, active && s.segTextActive]}>{txt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function Fields({ defs, vals, setVal, type }:
  { defs: FieldDef[]; vals: Record<string, string>; setVal: (k: string, v: string) => void; type: 'arterial' | 'venous' }) {
  return (
    <View style={s.fields}>
      {defs.map((f) => {
        const k = f.k as string;
        const raw = vals[k] ?? '';
        const flagged = isFlagged(k, raw, type);
        return (
          <View key={k} style={s.field}>
            <Text style={s.fieldLabel}>
              {f.label}{f.req ? <Text style={s.req}> *</Text> : null}
              {!!f.unit && <Text style={s.fieldUnit}>  {f.unit}</Text>}
            </Text>
            <TextInput
              value={raw}
              onChangeText={(v) => setVal(k, v)}
              keyboardType="numbers-and-punctuation"
              style={[s.input, flagged && s.inputFlag]}
              placeholderTextColor={theme.muted}
            />
          </View>
        );
      })}
    </View>
  );
}
function isFlagged(k: string, raw: string, type: 'arterial' | 'venous') {
  if (!raw) return false;
  const v = parseFloat(raw.replace(',', '.'));
  if (Number.isNaN(v)) return false;
  if (k === 'pH') return v < PH[type].min || v > PH[type].max;
  if (k === 'pCO2') return v < PCO2[type].min || v > PCO2[type].max;
  if (k === 'O2') { const r = O2REF[type]; return r ? v < r.min || v > r.max : false; }
  return false;
}

const s = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  card: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.line, marginBottom: 16, overflow: 'hidden' },
  cardTitle: { fontSize: 11, letterSpacing: 1, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14 },
  cardBody: { padding: 16 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
  controlLabel: { fontSize: 11, letterSpacing: 0.5, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  seg: { flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.line, padding: 3, alignSelf: 'flex-start' },
  segBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 7 },
  segBtnActive: { backgroundColor: theme.red },
  segText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  segTextActive: { color: '#fff' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  field: { width: '48%', marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, color: theme.ink, fontWeight: '600', marginBottom: 4 },
  fieldUnit: { fontSize: 11, color: theme.muted, fontWeight: '400' },
  req: { color: theme.red, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: theme.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 15, color: theme.ink, backgroundColor: '#fff' },
  inputFlag: { borderColor: '#E2B7B3', backgroundColor: '#FFFBFA' },
  moreToggle: { paddingVertical: 10 },
  moreText: { color: theme.red, fontWeight: '700', fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  btnPrimary: { backgroundColor: theme.red },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line },
  btnGhostText: { color: theme.muted, fontWeight: '700', fontSize: 14 },
  lead: { fontSize: 18, fontWeight: '700', color: theme.ink, marginBottom: 4 },
  leadAci: { color: theme.redDark }, leadAlk: { color: theme.warn },
  leadDetail: { fontSize: 14, fontWeight: '400', color: theme.muted },
  grpHead: { fontSize: 10.5, letterSpacing: 0.6, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.line, paddingBottom: 5 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 9 },
  lineMain: { fontWeight: '600', color: theme.ink, fontSize: 14 },
  lineDetail: { marginLeft: 'auto', color: theme.muted, fontSize: 12.5 },
  sline: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 7 },
  slineMain: { fontWeight: '600', color: theme.ink, fontSize: 13.5 },
  slineDetail: { color: theme.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  hintChip: { alignSelf: 'flex-start', backgroundColor: theme.redTint, borderWidth: 1, borderColor: '#F3D2CE', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 11, marginLeft: 16, marginTop: 2, marginBottom: 4 },
  hintText: { color: theme.redDark, fontWeight: '700', fontSize: 12 },
  jsummary: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 11, padding: 13, marginBottom: 14 },
  interpPanel: { padding: 0, marginTop: 4 },
  v4Row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.line },
  v4Th: { flex: 0.42, fontSize: 13.5, fontWeight: '500', color: theme.muted, paddingRight: 10 },
  v4Td: { flex: 0.58, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  v4Val: { fontSize: 15, fontWeight: '600', color: theme.ink },
  v4Flag: { color: theme.redDark },
  v4Status: { fontWeight: '700' },
  v4Note: { color: theme.muted, fontStyle: 'italic', fontWeight: '500', fontSize: 13.5 },
  v4NoteTh: { color: theme.warn },
  v4Ph: { fontSize: 12.5, fontWeight: '600', color: theme.muted },
  v4Sec: { fontSize: 10.5, letterSpacing: 0.6, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 2 },
  v4Mn: { backgroundColor: theme.redTint, borderRadius: 16, paddingVertical: 2, paddingHorizontal: 9 },
  v4MnText: { color: theme.redDark, fontWeight: '700', fontSize: 11.5 },
  journalBlock: { marginTop: 16 },
  journalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  journalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.muted },
  codeExport: { marginTop: 16, padding: 14, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.line, borderRadius: 11 },
  codeExportLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.muted, marginBottom: 8 },
  codeExportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeExportVal: { flex: 1, fontFamily: 'monospace', fontSize: 17, fontWeight: '700', color: theme.redDark, letterSpacing: 1 },
  codeExportCopy: { borderWidth: 1, borderColor: theme.red, backgroundColor: theme.surface, paddingVertical: 6, paddingHorizontal: 13, borderRadius: 8 },
  codeExportCopied: { backgroundColor: theme.ok, borderColor: theme.ok },
  codeExportCopyText: { color: theme.redDark, fontWeight: '700', fontSize: 12.5 },
  codeExportCopyTextOn: { color: '#fff' },
  codeExportHint: { fontSize: 12, color: theme.muted, marginTop: 10, lineHeight: 17 },
  jsummaryText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: theme.ink },
  jsummaryCopy: { borderWidth: 1, borderColor: theme.red, backgroundColor: theme.surface, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  jsummaryCopied: { backgroundColor: theme.ok, borderColor: theme.ok },
  jsummaryCopyText: { fontSize: 12.5, fontWeight: '700', color: theme.redDark },
  jsummaryCopyTextOn: { color: '#fff' },
  toggle: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.line, borderRadius: 9, padding: 3, marginBottom: 14, gap: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 7 },
  toggleBtnActive: { backgroundColor: theme.red },
  toggleText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  toggleTextActive: { color: '#fff' },
  svMetrics: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 14 },
  svMetric: { flex: 1, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  svMetricHi: { borderColor: theme.red, backgroundColor: theme.redTint },
  svMlabel: { fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.muted, fontWeight: '700' },
  svMval: { fontSize: 21, fontWeight: '800', color: theme.ink, marginVertical: 2 },
  svMvalHi: { color: theme.redDark },
  svMref: { fontSize: 11, color: theme.muted },
  svNote: { marginTop: 12, backgroundColor: theme.redTint, borderRadius: 9, padding: 11 },
  svNoteText: { fontSize: 12.5, color: theme.redDark, lineHeight: 18 },
  svRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: theme.line },
  svName: { fontSize: 13, color: theme.ink, flex: 1 },
  svVal: { fontSize: 13, fontWeight: '700', color: theme.ink },
  svUnit: { fontWeight: '500', color: theme.muted, fontSize: 11 },
  svTag: { borderRadius: 9, paddingVertical: 2, paddingHorizontal: 7, minWidth: 62, alignItems: 'center' },
  svTagAssumed: { backgroundColor: theme.redTint },
  svTagEntered: { backgroundColor: '#dcfce7' },
  svTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  svTagTextAssumed: { color: theme.redDark },
  svTagTextEntered: { color: '#15803d' },
  dRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: theme.line },
  dRowFlagged: { backgroundColor: '#fdf3f1' },
  dName: { color: theme.ink, fontWeight: '600', fontSize: 13.5, flex: 1 },
  dNameFlagged: { fontWeight: '700' },
  dFlag: { color: theme.redDark, fontWeight: '800' },
  dVal: { fontWeight: '700', fontSize: 13.5, color: theme.ink },
  dValFlagged: { color: theme.redDark },
  dUnit: { fontWeight: '400', color: theme.muted, fontSize: 12 },
  dRef: { color: theme.muted, fontSize: 12, marginLeft: 14, width: 56, textAlign: 'right' },
  valuesHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valuesOorNote: { color: theme.redDark, fontWeight: '700', fontSize: 11 },
});
