// expected.ts
// Ground-truth values for the 14 example blood gases, transcribed from the
// user-verified reference_extraction.txt. These are the canonical inputs the
// OCR layer must produce. Keys match BloodGasInput in core/calculate.ts.
//
// Notes:
//  - "type" is the sample type. null = not stated on the photo crop.
//  - Values that the report marked invalid (KOMM/Ogiltigt) or uncomputable
//    are intentionally omitted (undefined), NOT zero.
//  - anionGapInclK marks reports whose anion gap includes K+ (image 9).

import { BloodGasInput } from '../calculate';

export interface ExpectedGas {
  image: string;
  type: 'arterial' | 'venous' | null;
  // The values the OCR should map into the app inputs:
  values: Partial<BloodGasInput> & {
    O2sat?: number;
    MetHb?: number;
    COHb?: number;
    stdBicarb?: number;
    actualBicarb?: number;
    anionGap?: number;
    anionGapInclK?: number;
    Crea?: number;
    osmolality?: number;
  };
}

export const expectedGases: ExpectedGas[] = [
  {
    image: 'blodgas1.jpg', type: 'venous',
    values: {
      pH: 6.97, pCO2: 2.2, O2: 7.5, BE: -25.8, O2sat: 58, Hb: 32, MetHb: 1.6,
      COHb: 1.6, stdBicarb: 5, Glu: 6.4, Lac: 20.0, Na: 141, K: 5.1, Cl: 108,
      anionGap: 29, Crea: 136, Ca: 1.39, lo2: 5.0,
    },
  },
  {
    image: 'blodgas2.jpg', type: 'venous',
    values: {
      lo2: 0.0, pH: 6.57, pCO2: 2.6, O2: 12.2, Ca: 1.41, Na: 142, K: 4.6,
      Cl: 109, Glu: 7.4, Lac: 21.0, Hb: 121, O2sat: 86, MetHb: 1.0, Crea: 122,
      // BE, stdBicarb, COHb were KOMM/invalid -> omitted
    },
  },
  {
    image: 'blodgas3.jpg', type: null,
    values: {
      pH: 7.572, pCO2: 3.28, O2: 5.25, BE: 0.7, stdBicarb: 26.1, O2sat: 76.1,
      Hb: 162, MetHb: 0.8, COHb: 1.2, Na: 129, K: 2.1, Ca: 0.99, Cl: 83,
      Glu: 7.9, Lac: 4.7, Crea: 67, anionGap: 23.1,
    },
  },
  {
    image: 'blodgas4.jpg', type: 'venous',
    values: {
      pH: 6.78, pCO2: 3.9, O2: 6.2, BE: -27.0, O2sat: 75, Hb: 146, MetHb: 0.8,
      COHb: 0.6, Glu: 56.0, Lac: 3.7, Na: 124, K: 7.0, Cl: 90, anionGap: 30,
      Crea: 290, Ca: 1.27, lo2: 12.0,
    },
  },
  {
    image: 'blodgas5.jpg', type: null,
    values: {
      pH: 6.963, pCO2: 22.9, O2: 8.80, BE: 5.1, stdBicarb: 20.8, O2sat: 77.9,
      Hb: 157, MetHb: 0.9, COHb: 0.8, Na: 146, K: 5.0, Ca: 1.32, Cl: 98,
      Glu: 6.8, Lac: 5.9, Crea: 96, anionGap: 11.0,
    },
  },
  {
    image: 'blodgas6.jpg', type: null,
    values: {
      lo2: 15.0, pH: 6.417, pCO2: 17.9, O2: 1.47, Na: 139, K: 13.8, Ca: 1.27,
      Cl: 106, Glu: 0.6, Hb: 153, COHb: 0.8, MetHb: 0.7, O2sat: 3.5,
      BE: -27.8, stdBicarb: 2.2,
      // Crea uncomputable, Lac over-range -> omitted
    },
  },
  {
    image: 'blodgas7.jpg', type: 'venous',
    values: {
      pH: 6.67, pCO2: 3.0, O2: 11.0, BE: -29.5, O2sat: 86, Hb: 70, MetHb: 0.7,
      COHb: 0.6, Glu: 2.7, Lac: 18.0, Na: 140, K: 9.2, Cl: 113, anionGap: 24,
      Crea: 435, Ca: 1.33, lo2: 5.0,
    },
  },
  {
    image: 'blodgas8.jpg', type: 'venous',
    values: {
      lo2: 0.0, pH: 7.4, pCO2: 5.8, O2: 7.6, Na: 141, K: 3.7, Crea: 50,
      Ca: 1.22, Cl: 102, Glu: 9.1, Lac: 6.5, Hb: 130, COHb: 0.1, MetHb: 0.3,
      O2sat: 90, BE: 2.2, stdBicarb: 26,
    },
  },
  {
    image: 'blodgas9.jpg', type: 'arterial',
    values: {
      pH: 7.42, O2: 13.1, pCO2: 3.5, stdBicarb: 19, actualBicarb: 17, BE: -7.7,
      O2sat: 97.8, Na: 129, K: 4.5, Ca: 1.13, Cl: 93, Glu: 20.2, Lac: 8.2,
      anionGapInclK: 24, Hb: 95, COHb: 0.6,
      // MetHb "< 1.5" -> omitted (non-numeric)
    },
  },
  {
    image: 'blodgas10.jpg', type: 'arterial',
    values: {
      pH: 7.20, pCO2: 3.4, O2: 9.7, BE: -17.2, O2sat: 87, Hb: 167, MetHb: 0.5,
      COHb: 0.4, stdBicarb: 12, Glu: 8.3, Lac: 19.0, Na: 147, K: 4.1, Cl: 105,
      anionGap: 33, Crea: 463, Ca: 1.06, lo2: 15.0,
    },
  },
  {
    image: 'blodgas11.jpg', type: 'arterial',
    values: {
      lo2: 6.0, pH: 7.033, pCO2: 3.85, O2: 9.32, BE: -21.3, stdBicarb: 8.3,
      O2sat: 79.1, Hb: 94, MetHb: 0.5, COHb: 1.0, Na: 131, K: 5.2, Ca: 1.02,
      Cl: 96, Glu: 3.4, Lac: 23, Crea: 168, anionGap: 27.2,
    },
  },
  {
    image: 'blodgas12.jpg', type: null,
    values: {
      pH: 7.508, pCO2: 2.01, O2: 10.7, BE: -10.8, stdBicarb: 17.0, O2sat: 96.0,
      Hb: 112, MetHb: 1.1, COHb: 0.7, Na: 147, K: 3.7, Ca: 1.14, Cl: 111,
      Glu: 16.1, Lac: 1.7, Crea: 138, osmolality: 309.4,
    },
  },
  {
    image: 'blodgas13.jpg', type: 'venous',
    values: {
      lo2: 2.0, pH: 7.55, pCO2: 4.2, O2: 5.6, Ca: 0.54, BE: 4.6, Na: 140,
      K: 2.5, Cl: 95, Glu: 1.4, Lac: 8.4, Hb: 96, stdBicarb: 29, O2sat: 76,
      MetHb: 0.8, COHb: 0.9, Crea: 131,
    },
  },
  {
    image: 'blodgas14.jpg', type: 'venous',
    values: {
      lo2: 3.0, pH: 6.76, pCO2: 4.3, O2: 8.1, Ca: 1.06, BE: -26.9, Na: 139,
      K: 7.1, Glu: 4.8, Lac: 18.0, Hb: 132, O2sat: 71, MetHb: 1.1, COHb: 0.2,
      Crea: 1224,
      // stdBicarb KOMM, no chloride printed -> omitted
    },
  },
];
