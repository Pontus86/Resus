import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import {
  TREND_DEMO, TrendPoint, TrendKey, TREND_RANGES, TREND_UNITS, TREND_COLORS,
  TREND_LABELS, GAS_VARS, ELYTE_VARS, normVal, isOOR, lactateClearance,
} from '@/core/trend';

type Scale = 'norm' | 'raw';
type Source = 'demo' | 'upload' | 'manual';

interface Selected { key: TrendKey; i: number; }

export default function Trend() {
  const [scale, setScale] = useState<Scale>('norm');
  const [source, setSource] = useState<Source>('demo');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [hidden, setHidden] = useState<Set<TrendKey>>(new Set());
  const toggleVar = (k: TrendKey) =>
    setHidden((prev) => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  const series = TREND_DEMO; // demo until upload/manual wired
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 520) - 32 - 32; // screen padding + card padding

  const hint =
    source === 'demo' ? 'Visar en demoserie från exempelblodgaser. Ladda upp foton eller mata in värden för att använda dina egna.'
    : source === 'upload' ? 'Ladda upp en serie blodgasfoton (eller ett foto med flera blodgaser). Anslut visionsmodellens endpoint för att aktivera detta.'
    : 'Manuell inmatning: en liten redigerbar tabell låter dig lägga till tidpunkter (kommer härnäst).';

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.sub}>
        Följ nyckelvärden över upprepade blodgaser. Varje variabel skalas mot sitt referensintervall så
        att olika enheter ryms i samma diagram; det skuggade bandet är normalt. Tryck på en punkt för dess värde, tryck
        igen för att öppna den blodgasen i Analys.
      </Text>

      <View style={s.sources}>
        {(['upload', 'manual', 'demo'] as Source[]).map((sname) => (
          <Pressable key={sname} style={[s.srcBtn, source === sname && s.srcBtnActive]} onPress={() => setSource(sname)}>
            <Text style={[s.srcText, source === sname && s.srcTextActive]}>
              {sname === 'upload' ? 'Ladda upp foton' : sname === 'manual' ? 'Mata in manuellt' : 'Demoserie'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.hint}>{hint}</Text>

      <View style={s.scaleToggle}>
        <Pressable style={[s.scaleBtn, scale === 'norm' && s.scaleBtnActive]} onPress={() => setScale('norm')}>
          <Text style={[s.scaleText, scale === 'norm' && s.scaleTextActive]}>Normaliserat</Text>
        </Pressable>
        <Pressable style={[s.scaleBtn, scale === 'raw' && s.scaleBtnActive]} onPress={() => setScale('raw')}>
          <Text style={[s.scaleText, scale === 'raw' && s.scaleTextActive]}>Råvärden</Text>
        </Pressable>
      </View>

      <ChartCard
        title="Blodgas" vars={GAS_VARS} series={series} scale={scale} width={chartW}
        selected={selected} onSelect={setSelected} hidden={hidden} onToggle={toggleVar}
      />
      <ChartCard
        title="Elektrolyter och metaboliter" vars={ELYTE_VARS} series={series} scale={scale} width={chartW}
        selected={selected} onSelect={setSelected} hidden={hidden} onToggle={toggleVar}
      />
      <LactateCard series={series} width={chartW} />
    </ScrollView>
  );
}

function VarChips({ vars, hidden, onToggle }: { vars: TrendKey[]; hidden: Set<TrendKey>; onToggle: (k: TrendKey) => void }) {
  return (
    <View style={s.chips}>
      {vars.map((k) => {
        const off = hidden.has(k);
        return (
          <Pressable
            key={k}
            onPress={() => onToggle(k)}
            style={[s.chip, { borderColor: off ? theme.line : TREND_COLORS[k] }, off && s.chipOff]}>
            <Text style={[s.chipText, { color: off ? theme.muted : TREND_COLORS[k] }, off && s.chipTextOff]}>
              {TREND_LABELS[k]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChartCard({ title, vars, series, scale, width, selected, onSelect, hidden, onToggle }: {
  title: string; vars: TrendKey[]; series: TrendPoint[]; scale: Scale; width: number;
  selected: Selected | null; onSelect: (s: Selected | null) => void;
  hidden: Set<TrendKey>; onToggle: (k: TrendKey) => void;
}) {
  const drawVars = vars.filter((k) => !hidden.has(k)); // lines actually plotted
  const H = 230, padL = 34, padR = 10, padT = 14, padB = 28;
  const n = series.length;
  const xAt = (i: number) => padL + (width - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));

  let yMin: number, yMax: number;
  if (scale === 'norm') {
    const vals: number[] = [];
    drawVars.forEach((k) => series.forEach((p) => { const x = p.v[k]; if (x !== undefined) vals.push(normVal(k, x)); }));
    yMin = Math.min(-0.3, ...vals) - 0.1; yMax = Math.max(1.3, ...vals) + 0.1;
  } else {
    const vals: number[] = [];
    drawVars.forEach((k) => series.forEach((p) => { const x = p.v[k]; if (x !== undefined) vals.push(x); }));
    yMin = Math.min(...vals); yMax = Math.max(...vals);
    const pad = (yMax - yMin) * 0.12 || 1; yMin -= pad; yMax += pad;
  }
  const yAt = (v: number) => padT + (H - padT - padB) * (1 - (v - yMin) / (yMax - yMin));

  const sel = selected && vars.includes(selected.key) ? selected : null;
  const selPoint = sel ? series[sel.i] : null;
  const selVal = sel && selPoint ? selPoint.v[sel.key] : undefined;

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{title}</Text>
        <VarChips vars={vars} hidden={hidden} onToggle={onToggle} />
      </View>

      <Svg width={width} height={H}>
        {scale === 'norm' ? (
          <>
            <Rect x={padL} y={yAt(1)} width={width - padL - padR} height={yAt(0) - yAt(1)} fill={theme.ok} opacity={0.08} />
            <Line x1={padL} y1={yAt(1)} x2={width - padR} y2={yAt(1)} stroke={theme.ok} strokeDasharray="3 3" opacity={0.5} />
            <Line x1={padL} y1={yAt(0)} x2={width - padR} y2={yAt(0)} stroke={theme.ok} strokeDasharray="3 3" opacity={0.5} />
            <SvgText x={padL - 5} y={yAt(1) + 4} fontSize={10} fill={theme.muted} textAnchor="end">högt</SvgText>
            <SvgText x={padL - 5} y={yAt(0) + 4} fontSize={10} fill={theme.muted} textAnchor="end">lågt</SvgText>
          </>
        ) : (
          [0, 1, 2, 3, 4].map((g) => {
            const v = yMin + (yMax - yMin) * g / 4;
            return (
              <G key={g}>
                <Line x1={padL} y1={yAt(v)} x2={width - padR} y2={yAt(v)} stroke="#eee" />
                <SvgText x={padL - 5} y={yAt(v) + 4} fontSize={10} fill={theme.muted} textAnchor="end">{v.toFixed(1)}</SvgText>
              </G>
            );
          })
        )}

        {series.map((p, i) => (
          <SvgText key={i} x={xAt(i)} y={H - 10} fontSize={10} fill={theme.muted} textAnchor="middle">{p.label}</SvgText>
        ))}

        {drawVars.map((k) => {
          const pts = series.map((p, i) => p.v[k] !== undefined ? [xAt(i), yAt(scale === 'norm' ? normVal(k, p.v[k]!) : p.v[k]!)] : null).filter(Boolean) as number[][];
          if (!pts.length) return null;
          const d = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]).join(' ');
          return (
            <G key={k}>
              <Path d={d} fill="none" stroke={TREND_COLORS[k]} strokeWidth={2.2} />
              {series.map((p, i) => {
                if (p.v[k] === undefined) return null;
                const x = xAt(i), y = yAt(scale === 'norm' ? normVal(k, p.v[k]!) : p.v[k]!);
                const isSel = sel && sel.key === k && sel.i === i;
                return (
                  <Circle key={i} cx={x} cy={y} r={isSel ? 6.5 : 4.5} fill="#fff"
                    stroke={TREND_COLORS[k]} strokeWidth={isSel ? 3 : 2}
                    onPress={() => {
                      if (sel && sel.key === k && sel.i === i) { router.push({ pathname: '/', params: { trendPoint: JSON.stringify(p) } }); }
                      else onSelect({ key: k, i });
                    }} />
                );
              })}
            </G>
          );
        })}
      </Svg>

      {sel && selPoint && selVal !== undefined && (
        <Pressable
          style={s.detail}
          onPress={() => router.push({ pathname: '/', params: { trendPoint: JSON.stringify(selPoint) } })}>
          <View style={[s.detailDot, { backgroundColor: TREND_COLORS[sel.key] }]} />
          <Text style={s.detailLabel}>{TREND_LABELS[sel.key]} · {selPoint.label}</Text>
          <Text style={s.detailVal}>{selVal}{TREND_UNITS[sel.key] ? ` ${TREND_UNITS[sel.key]}` : ''}</Text>
          {isOOR(sel.key, selVal) && <Text style={s.detailOOR}>out of range</Text>}
          {(() => {
            if (sel.i === 0) return null;
            const prev = series[sel.i - 1].v[sel.key];
            if (prev === undefined) return null;
            const dv = selVal - prev;
            return <Text style={[s.detailDelta, dv > 0 ? s.deltaUp : dv < 0 ? s.deltaDown : null]}>{dv > 0 ? '▲ +' : dv < 0 ? '▼ ' : ''}{dv.toFixed(2)}</Text>;
          })()}
          <Text style={s.detailCta}>open →</Text>
        </Pressable>
      )}
    </View>
  );
}

function LactateCard({ series, width }: { series: TrendPoint[]; width: number }) {
  const H = 150, padL = 34, padR = 10, padT = 14, padB = 28;
  const n = series.length;
  const lacs = series.map((p) => p.v.Lac ?? 0);
  const xAt = (i: number) => padL + (width - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
  const yMax = Math.max(...lacs) * 1.15, yMin = 0;
  const yAt = (v: number) => padT + (H - padT - padB) * (1 - (v - yMin) / (yMax - yMin));
  const clr = lactateClearance(series);
  const pts = series.map((p, i) => [xAt(i), yAt(p.v.Lac ?? 0)]);
  const d = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]).join(' ');
  const area = `${d} L ${pts[pts.length - 1][0]} ${yAt(0)} L ${pts[0][0]} ${yAt(0)} Z`;

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Laktatclearance</Text>
      <Svg width={width} height={H} style={{ marginTop: 8 }}>
        <Rect x={padL} y={yAt(2.2)} width={width - padL - padR} height={yAt(0) - yAt(2.2)} fill={theme.ok} opacity={0.08} />
        <Line x1={padL} y1={yAt(2.2)} x2={width - padR} y2={yAt(2.2)} stroke={theme.ok} strokeDasharray="3 3" opacity={0.5} />
        <SvgText x={padL - 5} y={yAt(2.2) + 4} fontSize={10} fill={theme.muted} textAnchor="end">2.2</SvgText>
        <Path d={area} fill={theme.red} opacity={0.07} />
        <Path d={d} fill="none" stroke={theme.red} strokeWidth={2.4} />
        {series.map((p, i) => (
          <G key={i}>
            <Circle cx={xAt(i)} cy={yAt(p.v.Lac ?? 0)} r={4} fill="#fff" stroke={theme.red} strokeWidth={2} />
            <SvgText x={xAt(i)} y={H - 10} fontSize={10} fill={theme.muted} textAnchor="middle">{p.label}</SvgText>
          </G>
        ))}
      </Svg>
      {clr && (
        <View style={s.lacReadout}>
          <View style={s.lacStat}><Text style={s.lacNum}>{clr.peak.toFixed(1)}</Text><Text style={s.lacLab}>topp</Text></View>
          <View style={s.lacStat}><Text style={s.lacNum}>{clr.latest.toFixed(1)}</Text><Text style={s.lacLab}>senaste</Text></View>
          <View style={s.lacStat}>
            <Text style={[s.lacNum, clr.clearancePct >= 0 ? s.lacGood : s.lacBad]}>
              {clr.clearancePct >= 0 ? '−' : '+'}{Math.abs(clr.clearancePct).toFixed(0)}%
            </Text>
            <Text style={s.lacLab}>clearance från topp</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  sub: { fontSize: 13, color: theme.muted, lineHeight: 19, marginBottom: 14 },
  sources: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  srcBtn: { borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 },
  srcBtnActive: { backgroundColor: theme.red, borderColor: theme.red },
  srcText: { fontSize: 13, fontWeight: '600', color: theme.ink },
  srcTextActive: { color: '#fff' },
  hint: { fontSize: 12.5, color: theme.muted, lineHeight: 18, marginBottom: 14 },
  scaleToggle: { flexDirection: 'row', alignSelf: 'flex-end', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.line, borderRadius: 9, padding: 3, gap: 2, marginBottom: 12 },
  scaleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 7 },
  scaleBtnActive: { backgroundColor: theme.red },
  scaleText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  scaleTextActive: { color: '#fff' },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHead: { marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: theme.ink, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 9 },
  chipOff: { backgroundColor: theme.surface, opacity: 0.6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipTextOff: { textDecorationLine: 'line-through' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.line },
  detailDot: { width: 10, height: 10, borderRadius: 5 },
  detailLabel: { fontSize: 13, fontWeight: '600', color: theme.ink },
  detailVal: { fontSize: 13, fontWeight: '800', color: theme.ink },
  detailOOR: { fontSize: 10, fontWeight: '700', color: theme.redDark, backgroundColor: theme.redTint, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  detailDelta: { fontSize: 12, fontWeight: '700', color: theme.muted },
  deltaUp: { color: theme.red },
  deltaDown: { color: '#1976d2' },
  detailCta: { fontSize: 11.5, color: theme.red, fontWeight: '700', marginLeft: 'auto' },
  lacReadout: { flexDirection: 'row', gap: 22, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.line },
  lacStat: { },
  lacNum: { fontSize: 19, fontWeight: '800', color: theme.ink },
  lacGood: { color: theme.ok },
  lacBad: { color: theme.redDark },
  lacLab: { fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
});
