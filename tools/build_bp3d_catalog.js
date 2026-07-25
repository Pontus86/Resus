#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2];
const outputDirectory = process.argv[3];
const inventoryPath = process.argv[4];

if (!sourcePath || !outputDirectory) {
  console.error(
    'Användning: node tools/build_bp3d_catalog.js <source.json> <output-directory> [inventory.json]'
  );
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

const inventory = inventoryPath
  ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
  : { entries: [] };
const inventoryByFma = new Map(inventory.entries.map(entry => [entry.fma_id, entry]));

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
  ['zmax_mm', 'zmax'],
  ['in_resus', '_in_resus'],
  ['resus_modules', '_resus_modules'],
  ['resus_source_versions', '_resus_versions'],
  ['inventory_match', '_inventory_match'],
  ['availability_status', '_availability_status'],
  ['needs_download', '_needs_download']
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvLines = [
  columns.map(([heading]) => heading).join(','),
  ...records.map(record => {
    const found = inventoryByFma.get(record.f_id);
    const enriched = {
      ...record,
      _in_resus: found ? 'yes' : 'no',
      _resus_modules: found ? found.modules.join(';') : '',
      _resus_versions: found ? found.versions.join(';') : '',
      _inventory_match: found ? found.match_basis.join(';') : '',
      _availability_status: found ? 'in_resus' : 'available_to_download',
      _needs_download: found ? 'no' : 'yes'
    };
    return columns.map(([, key]) => csvCell(enriched[key])).join(',');
  })
];

const browserRecords = records.map(record => {
  const found = inventoryByFma.get(record.f_id);
  return [
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
    record.zmax,
    Boolean(found),
    found ? found.modules.join(' · ') : '',
    found ? found.versions.join(' · ') : '',
    found ? found.match_basis.join(' · ') : ''
  ];
});

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
    `  inventory: ${JSON.stringify({
      present: inventory.entries.length,
      needsDownload: records.length - inventory.entries.length
    })},`,
    `  columns: ${JSON.stringify(columns.map(([heading]) => heading))},`,
    `  records: ${JSON.stringify(browserRecords)}`,
    '};',
    ''
  ].join('\n')
);

console.log(`Skrev ${records.length} poster till ${outputDirectory}`);
