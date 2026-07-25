#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2];
const outputDirectory = process.argv[3];

if (!sourcePath || !outputDirectory) {
  console.error('Användning: node tools/build_bp3d_catalog.js <source.json> <output-directory>');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const records = source.records;

if (!Array.isArray(records) || records.length !== 8129 || source.total !== 8129) {
  throw new Error(`Förväntade 8129 poster, fick ${records?.length ?? 'ingen lista'} (total ${source.total})`);
}

const fmaIds = new Set(records.map(record => record.f_id));
const bpIds = new Set(records.map(record => record.b_id));
if (fmaIds.size !== 8129 || bpIds.size !== 8129) {
  throw new Error(`ID-validering misslyckades: ${fmaIds.size} FMA-ID och ${bpIds.size} BP-ID`);
}

const columns = [
  ['bp_id', 'b_id'],
  ['fma_id', 'f_id'],
  ['name_en', 'name_e'],
  ['name_la', 'name_l'],
  ['name_ja', 'name_j'],
  ['synonyms_en', 'syn_e'],
  ['ta_id', 'taid'],
  ['primitive', 'primitive'],
  ['volume_cm3', 'volume'],
  ['xmin_mm', 'xmin'],
  ['xmax_mm', 'xmax'],
  ['ymin_mm', 'ymin'],
  ['ymax_mm', 'ymax'],
  ['zmin_mm', 'zmin'],
  ['zmax_mm', 'zmax']
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvLines = [
  columns.map(([heading]) => heading).join(','),
  ...records.map(record => columns.map(([, key]) => csvCell(record[key])).join(','))
];

const browserRecords = records.map(record => [
  record.b_id,
  record.f_id,
  record.name_e,
  record.name_l,
  record.name_j,
  record.syn_e,
  record.taid,
  record.primitive,
  record.volume,
  record.xmin,
  record.xmax,
  record.ymin,
  record.ymax,
  record.zmin,
  record.zmax
]);

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, '20181210i412-objects.csv'),
  `${csvLines.join('\n')}\n`
);
fs.writeFileSync(
  path.join(outputDirectory, 'catalog-data.js'),
  [
    '// Genererad från BodyParts3D 20181210i412; ändra inte manuellt.',
    'window.BP3D_CATALOG = {',
    '  version: "20181210i412",',
    `  columns: ${JSON.stringify(columns.map(([heading]) => heading))},`,
    `  records: ${JSON.stringify(browserRecords)}`,
    '};',
    ''
  ].join('\n')
);

console.log(`Skrev ${records.length} poster till ${outputDirectory}`);
