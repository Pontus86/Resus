import { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, TextInput } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from '@/constants/theme';
import { recognizeBloodGas } from '@/core/ocr.vision';
import { parseGas, toAppInputs } from '@/core/parseGas';
import { decodeTransfer, looksLikeTransferCode } from '@/core/transfer';

// Names for the out-of-range note.
const CODE_NAMES: Record<string, string> = { pH: 'pH', pCO2: 'pCO₂', HCO3: 'HCO₃⁻', BE: 'BE', Na: 'Na⁺', K: 'K⁺', Cl: 'Cl⁻' };

// Shared transfer-code entry: paste a code from another device to open the
// analysis here. Routes the decoded values to the Analyzer.
function CodeEntry() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);

  const load = () => {
    const raw = code.trim();
    if (!raw) { setMsg(null); return; }
    try {
      const { fields, outOfRange } = decodeTransfer(raw);
      const keys = Object.keys(fields);
      if (!keys.length && !outOfRange.length) throw new Error('tom');
      let text = `Läste in ${keys.length} värde${keys.length !== 1 ? 'n' : ''}.`;
      if (outOfRange.length) {
        text += ` ${outOfRange.map((k) => CODE_NAMES[k] || k).join(', ')} låg utanför kodbart intervall och utelämnades.`;
      }
      setMsg({ text, err: outOfRange.length > 0 });
      const asStr: Record<string, string> = {};
      keys.forEach((k) => { asStr[k] = String((fields as any)[k]); });
      router.push({ pathname: '/', params: { scanned: JSON.stringify(asStr) } });
    } catch {
      setMsg({ text: 'Ogiltig kod. Kontrollera att du kopierat hela koden.', err: true });
    }
  };

  return (
    <View style={s.codeBox}>
      <Text style={s.codeLabel}>Överföringskod</Text>
      <Text style={s.codeHint}>Har du en kod från en annan enhet? Klistra in den här för att öppna samma analys.</Text>
      <View style={s.codeRow}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={setCode}
          placeholder="t.ex. Bc3YCF CmcpN"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          onSubmitEditing={load}
        />
        <Pressable style={s.codeBtn} onPress={load}>
          <Text style={s.codeBtnText}>Läs in</Text>
        </Pressable>
      </View>
      {msg && <Text style={[s.codeMsg, msg.err && s.codeMsgErr]}>{msg.text}</Text>}
    </View>
  );
}

// Point this at your deployed OCR proxy (see server/ocr-server.js).
const OCR_ENDPOINT = process.env.EXPO_PUBLIC_OCR_ENDPOINT || 'http://localhost:8787/ocr/bloodgas';
export default function Scan() {
  // Web build: no live camera OCR, but allow uploading/snapping a photo from the device.
  if (Platform.OS === 'web') {
    return <WebUpload />;
  }

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={s.center}><Text style={s.body}>Kontrollerar kamera…</Text></View>;

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.bigEmoji}>📷</Text>
        <Text style={s.heading}>Kameraåtkomst krävs</Text>
        <Text style={s.body}>För att skanna en blodgasutskrift och läsa av värden automatiskt.</Text>
        <Pressable style={s.cta} onPress={requestPermission}>
          <Text style={s.ctaText}>Ge behörighet</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      // Send the photo to your OCR proxy (see server/ocr-server.js), which returns
      // transcribed text; parseGas() then maps it to inputs.
      const { parsed } = await recognizeBloodGas(photo.base64 ?? '', {
        endpoint: OCR_ENDPOINT,
      });
      const values = toAppInputs(parsed);
      router.push({
        pathname: '/',
        params: { scanned: JSON.stringify(values), sampleType: parsed.type ?? '' },
      });
    } catch (e) {
      // surface error in real build (e.g. a toast)
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.cameraScreen}>
      <View style={s.cameraWrap}>
        <CameraView ref={cameraRef} style={s.camera} facing="back" />
        <View style={s.overlay}>
          <Text style={s.hint}>Rikta in utskriften och fota</Text>
          <Pressable style={[s.shutter, busy && { opacity: 0.5 }]} onPress={capture} disabled={busy}>
            <View style={s.shutterInner} />
          </Pressable>
        </View>
      </View>
      <CodeEntry />
    </View>
  );
}

// Web: upload a photo from the device (works on phone browsers too — opens camera
// roll or camera). Recognized text is parsed and routed to the Analyzer.
function WebUpload() {
  const [status, setStatus] = useState<string>('');
  const onFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Reading image…');
    try {
      const imageBase64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]); // strip data: prefix
        r.onerror = () => reject(new Error('read failed'));
        r.readAsDataURL(file);
      });
      const { parsed } = await recognizeBloodGas(imageBase64, { endpoint: OCR_ENDPOINT });
      const values = toAppInputs(parsed);
      if (!Object.keys(values).length) {
        setStatus('Inga värden kunde läsas. Försök med ett tydligare, rakt foto.');
        return;
      }
      router.push({
        pathname: '/',
        params: { scanned: JSON.stringify(values), sampleType: parsed.type ?? '' },
      });
    } catch {
      setStatus('Kunde inte läsa bilden. Kontrollera OCR-servern och försök igen.');
    }
  };
  return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>🖼️</Text>
      <Text style={s.heading}>Ladda upp ett blodgasfoto</Text>
      <Text style={s.body}>
        Välj ett foto av utskriften. I en mobilwebbläsare kan detta öppna kameran
        direkt. Värdena läses av och skickas till Analys för att du ska bekräfta dem.
      </Text>
      {/* react-native-web renders this as a real <input type=file> */}
      {/* @ts-ignore - web-only element */}
      <input type="file" accept="image/*" capture="environment" onChange={onFile}
        style={{ marginTop: 8 }} />
      {!!status && <Text style={[s.body, { marginTop: 12 }]}>{status}</Text>}
      <Pressable style={[s.cta, { marginTop: 20 }]} onPress={() => router.push('/')}>
        <Text style={s.ctaText}>Mata in värden manuellt</Text>
      </Pressable>
      <CodeEntry />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bigEmoji: { fontSize: 48, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: theme.ink, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  cta: { backgroundColor: theme.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  ctaText: { color: '#fff', fontWeight: '700' },
  cameraScreen: { flex: 1, backgroundColor: theme.bg },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 36 },
  hint: { color: '#fff', fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.red },
  codeBox: { width: '100%', maxWidth: 420, backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.line, padding: 16, marginTop: 20 },
  codeLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.muted, marginBottom: 6 },
  codeHint: { fontSize: 12.5, color: theme.muted, lineHeight: 18, marginBottom: 10 },
  codeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeInput: { flex: 1, fontSize: 14, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.line, borderRadius: 9, backgroundColor: theme.bg, color: theme.ink },
  codeBtn: { backgroundColor: theme.red, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16 },
  codeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  codeMsg: { fontSize: 12.5, color: theme.ok, marginTop: 8 },
  codeMsgErr: { color: theme.redDark },
});
