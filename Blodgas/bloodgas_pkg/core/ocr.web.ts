// ocr.web.ts — Web has no OCR (per spec). This stub reports unavailability.
export const ocrAvailable = false;

export async function scanBloodGas(): Promise<Record<string, number>> {
  throw new Error('OCR is not available on the web build.');
}
