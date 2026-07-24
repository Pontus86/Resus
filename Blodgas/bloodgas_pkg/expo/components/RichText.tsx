import { Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Renders the light HTML used in reference bodies: <b>…</b> and <br>.
export function RichText({ html, style }: { html: string; style?: any }) {
  // Split into <br> lines, then parse <b> within each.
  const lines = html.split(/<br\s*\/?>/i);
  return (
    <Text style={[s.base, style]}>
      {lines.map((line, li) => {
        const parts = line.split(/(<b>.*?<\/b>)/gi).filter(Boolean);
        return (
          <Text key={li}>
            {parts.map((p, pi) => {
              const m = p.match(/^<b>(.*?)<\/b>$/i);
              if (m) return <Text key={pi} style={s.bold}>{m[1].trim()} </Text>;
              return <Text key={pi}>{p.replace(/\s+/g, ' ')}</Text>;
            })}
            {li < lines.length - 1 ? '\n' : ''}
          </Text>
        );
      })}
    </Text>
  );
}

const s = StyleSheet.create({
  base: { color: theme.inkSoft, fontSize: 13.5, lineHeight: 20 },
  bold: { fontWeight: '700', color: theme.ink },
});
