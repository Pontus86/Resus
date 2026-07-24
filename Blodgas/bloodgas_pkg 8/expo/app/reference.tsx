import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { theme } from '@/constants/theme';
import { referenceGroups, MnemonicGroup } from '@/core/referenceContent';
import { RichText } from '@/components/RichText';

export default function Reference() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  // Which mnemonic group is open. Default: first group. Deep-link: the focused group.
  const [openGroup, setOpenGroup] = useState<string>(
    focus && referenceGroups.some((g) => g.id === focus) ? focus : referenceGroups[0]?.id
  );

  useEffect(() => {
    if (focus && referenceGroups.some((g) => g.id === focus)) {
      setOpenGroup(focus);
      if (offsets.current[focus] !== undefined) {
        const t = setTimeout(() => {
          scrollRef.current?.scrollTo({ y: Math.max(0, offsets.current[focus] - 8), animated: true });
        }, 160);
        return () => clearTimeout(t);
      }
    }
  }, [focus]);

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.intro}>
        Tryck på en minnesregel för att fälla ut den, och tryck sedan på en orsak för att läsa informationen.
      </Text>
      {referenceGroups.map((g) => (
        <View key={g.id} onLayout={(e) => { offsets.current[g.id] = e.nativeEvent.layout.y; }}>
          <Group
            group={g}
            expanded={openGroup === g.id}
            highlight={focus === g.id}
            onToggle={() => setOpenGroup((cur) => (cur === g.id ? '' : g.id))}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function Group({ group, expanded, highlight, onToggle }:
  { group: MnemonicGroup; expanded: boolean; highlight?: boolean; onToggle: () => void }) {
  return (
    <View style={[s.group, highlight && s.groupHighlight]}>
      <Pressable style={s.groupHead} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={s.category}>{group.category}</Text>
          <Text style={s.mnemonic}>{group.mnemonic}</Text>
          {!!group.subtitle && <Text style={s.subtitle}>{group.subtitle}</Text>}
        </View>
        <Text style={s.groupChev}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && group.items.map((it, i) => (
        <Item key={i} letter={it.letter} title={it.title} body={it.body} sources={it.sources} />
      ))}
    </View>
  );
}

function Item({ letter, title, body, sources }: { letter: string; title: string; body: string; sources?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={s.item}>
      <View style={s.itemRow}>
        <View style={s.letterChip}><Text style={s.letterText}>{letter}</Text></View>
        <Text style={s.itemTitle}>{title}</Text>
        <Text style={s.chev}>{open ? '▾' : '▸'}</Text>
      </View>
      {open && (
        <View style={s.itemBodyWrap}>
          <RichText html={body} />
          {!!sources && (
            <View style={s.sourcesWrap}>
              <Text style={s.sourcesLabel}>Källor</Text>
              <RichText html={sources} style={s.sourcesText} />
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  intro: { color: theme.muted, fontSize: 13.5, marginBottom: 16, lineHeight: 19 },
  group: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.line, marginBottom: 16, overflow: 'hidden' },
  groupHighlight: { borderColor: theme.red, borderWidth: 2 },
  groupHead: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.redTint },
  groupChev: { color: theme.redDark, fontSize: 16, fontWeight: '700', marginLeft: 10 },
  category: { fontSize: 10.5, letterSpacing: 0.6, color: theme.redDark, fontWeight: '700', textTransform: 'uppercase' },
  mnemonic: { fontSize: 22, fontWeight: '800', color: theme.ink, letterSpacing: 1, marginTop: 2 },
  subtitle: { fontSize: 13, color: theme.muted, marginTop: 2 },
  item: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.line },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  letterChip: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.red, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  letterText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: theme.ink, flex: 1 },
  chev: { color: theme.muted, fontSize: 14 },
  itemBodyWrap: { marginTop: 10, marginLeft: 38 },
  sourcesWrap: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.line },
  sourcesLabel: { fontSize: 10, letterSpacing: 0.6, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  sourcesText: { fontSize: 12, color: theme.muted, fontStyle: 'italic', lineHeight: 17 },
});
