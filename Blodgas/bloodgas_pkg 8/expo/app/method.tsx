import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { methodIntro, methodSections, algorithmSteps, workedExample } from '@/core/methodology';
import { FLOWCHART_SVG } from '@/core/flowchart';

function FormulaGroup({ sec, defaultOpen }: { sec: typeof methodSections[number]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={s.fgroup}>
      <Pressable style={s.fsummary} onPress={() => setOpen((o) => !o)}>
        <Text style={[s.fchev, open && s.fchevOpen]}>▸</Text>
        <Text style={s.fsummaryText}>{sec.title}</Text>
      </Pressable>
      {open && (
        <View style={s.fbody}>
          <Text style={s.secIntro}>{sec.intro}</Text>
          {sec.formulas.map((f, i) => (
            <View key={i} style={s.formula}>
              <Text style={s.fName}>{f.name}</Text>
              <Text style={s.fExpr}>{f.expr}</Text>
              {!!f.note && <Text style={s.fNote}>{f.note}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Method() {
  const { width } = useWindowDimensions();
  const [exampleOpen, setExampleOpen] = useState(false);
  const fcW = Math.min(width, 520) - 40 - 32; // screen + card padding
  const fcH = fcW * (1020 / 680); // preserve viewBox aspect ratio
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={s.intro}>{methodIntro}</Text>

      <View style={s.methodSection}>
        <Text style={s.methodH2}>Tolkningsalgoritm</Text>
        <View style={s.flowchart}>
          <SvgXml xml={FLOWCHART_SVG} width={fcW} height={fcH} />
        </View>
        <Text style={s.flowchartCap}>Fyrastegsmetoden i översikt. De numrerade stegen nedan säger samma sak i ord.</Text>
        {algorithmSteps.map((step, i) => (
          <View key={i} style={s.step}>
            <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={s.methodSection}>
        <Pressable style={s.exampleSummary} onPress={() => setExampleOpen((o) => !o)}>
          <Text style={[s.fchev, exampleOpen && s.fchevOpen]}>▸</Text>
          <Text style={s.methodH2Inline}>Räkneexempel</Text>
        </Pressable>
        {exampleOpen && (
          <View style={s.exampleBody}>
            <Text style={s.scenario}>{workedExample.scenario}</Text>
            <View style={s.inputsBox}>
              {workedExample.inputs.map((inp, i) => (
                <View key={i} style={s.inputChip}>
                  <Text style={s.inputLabel}>{inp.label}</Text>
                  <Text style={s.inputValue}>{inp.value}</Text>
                </View>
              ))}
            </View>
            {workedExample.steps.map((st) => (
              <View key={st.n} style={s.wstep}>
                <View style={s.wstepHead}>
                  <View style={s.num}><Text style={s.numText}>{st.n}</Text></View>
                  <Text style={s.wstepTitle}>{st.title}</Text>
                </View>
                <Text style={s.wstepWork}>{st.work}</Text>
                <Text style={s.wstepResult}>{st.result}</Text>
              </View>
            ))}
            <View style={s.conclusion}>
              <Text style={s.conclusionText}>{workedExample.conclusion}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={s.methodSection}>
        <Text style={s.methodH2}>Formler</Text>
        <Text style={s.formulaIntro}>De exakta uttrycken bakom varje härlett värde, för referens. Tryck på en grupp för att expandera.</Text>
        {methodSections.map((sec, i) => (
          <FormulaGroup key={sec.id} sec={sec} defaultOpen={i === 0} />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  intro: { fontSize: 14.5, color: theme.inkSoft, lineHeight: 22, marginBottom: 22 },
  flowchart: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 6 },
  flowchartCap: { fontSize: 12.5, color: theme.muted, textAlign: 'center', fontStyle: 'italic', marginBottom: 18 },
  h1: { fontSize: 16, fontWeight: '800', color: theme.ink, marginBottom: 12 },
  step: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.red, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  numText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: theme.inkSoft, lineHeight: 21 },
  section: { marginBottom: 20 },
  h2: { fontSize: 11, letterSpacing: 0.8, color: theme.redDark, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  secIntro: { fontSize: 13.5, color: theme.muted, lineHeight: 20, marginBottom: 12 },
  formula: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 12, marginBottom: 8 },
  fName: { fontSize: 13.5, fontWeight: '700', color: theme.ink, marginBottom: 4 },
  fExpr: { fontSize: 13.5, color: theme.redDeep, fontFamily: 'monospace', lineHeight: 19 },
  fNote: { fontSize: 12, color: theme.muted, marginTop: 5, lineHeight: 17 },
  scenario: { fontSize: 14, color: theme.inkSoft, lineHeight: 21, marginBottom: 14, fontStyle: 'italic' },
  inputsBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  inputChip: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  inputLabel: { fontSize: 10, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  inputValue: { fontSize: 13.5, color: theme.ink, fontWeight: '700' },
  wstep: { marginBottom: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 14 },
  wstepHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  wstepTitle: { fontSize: 14.5, fontWeight: '700', color: theme.ink, flex: 1 },
  wstepWork: { fontSize: 13.5, color: theme.redDeep, fontFamily: 'monospace', lineHeight: 20, marginBottom: 6 },
  wstepResult: { fontSize: 13.5, color: theme.inkSoft, lineHeight: 20 },
  conclusion: { backgroundColor: theme.redTint, borderRadius: 10, padding: 16, marginTop: 4 },
  conclusionText: { fontSize: 14, color: theme.redDark, lineHeight: 21, fontWeight: '600' },
  methodSection: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, borderRadius: 16, padding: 18, marginBottom: 18 },
  methodH2: { fontSize: 18, fontWeight: '800', color: theme.ink, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: theme.redTint },
  methodH2Inline: { fontSize: 18, fontWeight: '800', color: theme.ink },
  exampleSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleBody: { marginTop: 14, paddingTop: 10, borderTopWidth: 2, borderTopColor: theme.redTint },
  formulaIntro: { fontSize: 13, color: theme.muted, marginBottom: 14, lineHeight: 19 },
  fgroup: { borderWidth: 1, borderColor: theme.line, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  fsummary: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, backgroundColor: theme.bg },
  fsummaryText: { fontSize: 14, fontWeight: '700', color: theme.ink, flex: 1 },
  fchev: { color: theme.redDark, fontWeight: '800', fontSize: 13 },
  fchevOpen: { transform: [{ rotate: '90deg' }] },
  fbody: { padding: 12, paddingTop: 4 },
});
