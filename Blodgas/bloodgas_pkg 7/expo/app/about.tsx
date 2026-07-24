import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Image } from 'react-native';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';

const photo = require('@/assets/pontus.jpg');

export default function About() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View style={s.hero}>
        <Image source={photo} style={s.avatar} />
        <Text style={s.name}>Pontus Olsson</Text>
        <Text style={s.role}>Läkare · skapare av detta verktyg</Text>
      </View>

      <Section title="Varför jag gjorde detta">
        <Text style={s.p}>
          Att tolka en arteriell eller venös blodgas under tidspress innebär att jonglera
          ett dussin formler och referensintervall samtidigt. Jag byggde detta verktyg så att
          räknandet sker omedelbart och tillförlitligt, så att läkaren kan fokusera
          på patienten i stället för på räknaren.
        </Text>
        <Text style={s.p}>
          Det började som en Android-app för flera år sedan. Detta är en ombyggnad från grunden
          som körs på webben och som inbyggda iOS- och Android-appar, med samma beräkningar som jag
          ursprungligen arbetade fram, nu öppet dokumenterade så att vem som helst kan kontrollera dem.
        </Text>
      </Section>

      <Section title="Metoden bakom">
        <Text style={s.p}>
          Tolkningssättet följer den stegvisa basöverskottsmetod som jag lade fram
          tillsammans med mina medförfattare i Läkartidningens serie "Medicinens ABC":
          Syra–bastolkning på akuten, Läkartidningen 2021;118:21087, skriven med
          Erik Lindeman och Eric Dryver. Den går igenom fyra steg: identifiera den
          dominerande rubbningen, kontrollera kompensationen, beräkna anjongapet och
          delta–delta, och därefter överväga diagnoser, vilket är exakt den logik som
          Analys- och Metodflikarna använder. Differentialdiagnostiska minnesreglerna,
          inklusive MUDPILERS och LACTATES, kommer från det arbetet.
        </Text>
      </Section>

      <Section title="Vad den gör">
        <Text style={s.p}>
          Mata in värdena från en blodgas så härleder verktyget hela syra-basbilden:
          bikarbonat och basöverskott, anjongapet och dess korrektioner, Stewarts
          starka jon-variabler, osmolala gapet, syresättning samt vätske- och
          elektrolytbrister. Den identifierar sedan den primära rubbningen, klassificerar
          en eventuell metabol acidos efter anjongap och kontrollerar om kompensationen är adekvat.
        </Text>
        <Text style={s.p}>
          Överväg-fliken är en inbyggd differentialdiagnostik, MUDPILERS, USEDCRAP och de övriga,
          med en kort klinisk notis om varje orsak.
        </Text>
      </Section>

      <Section title="Om tillit">
        <Text style={s.p}>
          Inget resultat här är en svart låda. Varje formel står utskriven i Metod-fliken så att
          du kan reproducera vilket värde som helst för hand. Om ett värde någonsin ser fel ut,
          kontrollera det mot källekvationen, och hör av dig så att jag kan rätta det.
        </Text>
        <Pressable style={s.linkBtn} onPress={() => router.push('/method')}>
          <Text style={s.linkBtnText}>Läs hela metoden →</Text>
        </Pressable>
      </Section>

      <Section title="Friskrivning">
        <Text style={s.pSmall}>
          Detta verktyg är avsett för utbildning och beslutsstöd för legitimerad vårdpersonal. Det
          ersätter inte klinisk bedömning, och du är fortsatt ansvarig för varje beslut som fattas
          med hjälp av det. Korrelera alltid med hela den kliniska bilden.
        </Text>
      </Section>

      <Pressable onPress={() => Linking.openURL('mailto:pontus.olsson86@gmail.com?subject=Blodgasanalys')}>
        <Text style={s.contact}>Feedback: pontus.olsson86@gmail.com</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  hero: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.red, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: theme.ink },
  role: { fontSize: 13.5, color: theme.muted, marginTop: 2 },
  section: { marginBottom: 22 },
  h2: { fontSize: 11, letterSpacing: 1, color: theme.redDark, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  p: { fontSize: 14.5, color: theme.inkSoft, lineHeight: 22, marginBottom: 10 },
  pSmall: { fontSize: 12.5, color: theme.muted, lineHeight: 19 },
  linkBtn: { marginTop: 4 },
  linkBtnText: { color: theme.red, fontWeight: '700', fontSize: 14 },
  contact: { textAlign: 'center', color: theme.red, fontSize: 13, marginTop: 8 },
});
