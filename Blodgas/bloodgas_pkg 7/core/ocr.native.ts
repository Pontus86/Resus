// ocr.native.ts — Native OCR parsing helpers.
//
// On iOS/Android the recommended path is on-device text recognition. Two common
// options (pick one at integration time):
//   • expo-camera takePictureAsync() + a text-recognition module
//     (e.g. @react-native-ml-kit/text-recognition) — fully on-device, free, offline.
//   • A cloud OCR endpoint if you prefer server-side processing.
//
// This module is library-agnostic: it takes the *recognized text* and maps it to
// blood-gas input keys, replacing the old Tesseract pipeline (TessOCR.java).

export const ocrAvailable = true;

// Maps printout labels → BloodGasInput keys. Extend as needed for your analyser.
const LABEL_PATTERNS: { key: string; re: RegExp }[] = [
  { key: 'pH',   re: /\bpH\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'pCO2', re: /pCO2\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'O2',   re: /pO2\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'HCO3', re: /HCO3\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'BE',   re: /\b(?:BE|base\s*excess)\b\s*:?\s*(-?\d+(?:[.,]\d+)?)/i },
  { key: 'Na',   re: /\bNa\+?\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'K',    re: /\bK\+?\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'Cl',   re: /\bCl-?\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'Lac',  re: /\b(?:Lac|lactate)\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'Glu',  re: /\b(?:Glu|glucose)\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'Ca',   re: /\bCa2?\+?\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
  { key: 'Hb',   re: /\bHb\b\s*:?\s*(\d+(?:[.,]\d+)?)/i },
];

/** Parse a block of recognized OCR text into numeric blood-gas values. */
export function parseRecognizedText(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { key, re } of LABEL_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (!Number.isNaN(v)) out[key] = v;
    }
  }
  return out;
}

/**
 * Placeholder integration point. Wire this to your chosen recognizer:
 *
 *   import TextRecognition from '@react-native-ml-kit/text-recognition';
 *   const result = await TextRecognition.recognize(photoUri);
 *   return parseRecognizedText(result.text);
 */
export async function scanBloodGasFromUri(photoUri: string): Promise<Record<string, number>> {
  throw new Error(
    'Connect a text-recognition library here, then call parseRecognizedText(result.text). photoUri=' + photoUri
  );
}
