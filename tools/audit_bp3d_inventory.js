#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = process.argv[2];
const catalogPath = process.argv[3];
const objectMapPath = process.argv[4];
const outputPath = process.argv[5];

if (!repoRoot || !catalogPath || !objectMapPath || !outputPath) {
  console.error(
    'Användning: node tools/audit_bp3d_inventory.js <repo-root> <catalog.json> <obj-map.html> <output.json>'
  );
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).records;
const objectMapHtml = fs.readFileSync(objectMapPath, 'utf8');
const catalogByFma = new Map(catalog.map(record => [record.f_id, record]));
const catalogByName = new Map();

function normalizedName(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\.(?:l|r)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

catalog.forEach(record => {
  const key = normalizedName(record.name_e);
  if (!key) return;
  if (!catalogByName.has(key)) catalogByName.set(key, []);
  catalogByName.get(key).push(record);
});

function cell(row, className) {
  const match = row.match(new RegExp(`<td class="${className}">([\\s\\S]*?)<\\/td>`));
  return match
    ? match[1]
      .replace(/<br\s*\/?>/gi, ';')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .trim()
    : '';
}

const sourceIdToFma = new Map();
for (const row of objectMapHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  const sourceId = cell(row[1], 'art_id');
  const fmaId = cell(row[1], 'cdi_name');
  if (!sourceId || !fmaId) continue;
  if (!sourceIdToFma.has(sourceId)) sourceIdToFma.set(sourceId, new Set());
  sourceIdToFma.get(sourceId).add(fmaId);
}

const evidence = new Map();

function recordEvidence(fmaId, moduleName, version, basis, fileName) {
  if (!catalogByFma.has(fmaId)) return;
  if (!evidence.has(fmaId)) {
    evidence.set(fmaId, {
      modules: new Set(),
      versions: new Set(),
      matchBasis: new Set(),
      evidenceFiles: new Set()
    });
  }
  const item = evidence.get(fmaId);
  item.modules.add(moduleName);
  item.versions.add(version);
  item.matchBasis.add(basis);
  item.evidenceFiles.add(fileName);
}

function versionFor(fileName, content) {
  if (/BodyParts3D 4\.0/i.test(content)) return 'BodyParts3D 4.0';
  if (/20181210i412|Compatibility version\s*:\s*20181210i412/i.test(content)) {
    return '20181210i412';
  }
  if (fileName.endsWith('peripheral_nerves.js')) return 'blandad/deriverad BodyParts3D';
  return '20181210i412';
}

function moduleFor(fileName) {
  if (fileName.startsWith('Neuro/')) return 'Neuro';
  return 'Kropps-atlas';
}

const scannedFiles = [
  ...fs.readdirSync(path.join(repoRoot, 'Neuro/models/brain'))
    .filter(name => name.endsWith('.js'))
    .map(name => `Neuro/models/brain/${name}`),
  ...fs.readdirSync(path.join(repoRoot, 'Neuro/models/nuclei'))
    .filter(name => name.endsWith('.js') && name !== 'manifest.js')
    .map(name => `Neuro/models/nuclei/${name}`),
  ...fs.readdirSync(path.join(repoRoot, 'Kroppsatlas/models/body/brain'))
    .filter(name => name.endsWith('.js'))
    .map(name => `Kroppsatlas/models/body/brain/${name}`),
  'Kroppsatlas/models/body/organ.js',
  'Kroppsatlas/models/body/skin.js'
];

scannedFiles.forEach(fileName => {
  const content = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
  const moduleName = moduleFor(fileName);
  const version = versionFor(fileName, content);

  for (const fmaId of new Set(content.match(/(?<![A-Z0-9])FMA\d+(?!\d)/g) || [])) {
    recordEvidence(fmaId, moduleName, version, 'FMA-ID i modellkälla', fileName);
  }

  for (
    const sourceId of new Set(
      content.match(/(?<![A-Z0-9])(?:FJ|MM|CX)\d+M?(?![A-Z0-9])/g) || []
    )
  ) {
    const mappedFmaIds = sourceIdToFma.get(sourceId);
    if (!mappedFmaIds) continue;
    mappedFmaIds.forEach(fmaId => {
      recordEvidence(fmaId, moduleName, version, 'fil-ID i 20181210i412-export', fileName);
    });
  }

  if (!/models\/body\/(?:organ|skin)\.js$/.test(fileName)) return;
  for (const objectMatch of content.matchAll(/\\no ([^\\]+)\\n/g)) {
    const matches = catalogByName.get(normalizedName(objectMatch[1])) || [];
    if (matches.length !== 1) continue;
    recordEvidence(
      matches[0].f_id,
      moduleName,
      'BodyParts3D 4.0',
      'exakt namn i uttrycklig BodyParts3D-fil',
      fileName
    );
  }
});

const repairScript = fs.readFileSync(path.join(repoRoot, 'tools/repair_3d_models.js'), 'utf8');
for (const fmaId of new Set(repairScript.match(/(?<![A-Z0-9])FMA\d+(?!\d)/g) || [])) {
  recordEvidence(
    fmaId,
    'Kropps-atlas',
    '20181210i412',
    'FMA-ID i reproducerbar modellpipeline',
    'tools/repair_3d_models.js'
  );
}

const entries = [...evidence.entries()]
  .sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))
  .map(([fmaId, item]) => ({
    fma_id: fmaId,
    bp_id: catalogByFma.get(fmaId).b_id,
    modules: [...item.modules].sort(),
    versions: [...item.versions].sort(),
    match_basis: [...item.matchBasis].sort(),
    evidence_files: [...item.evidenceFiles].sort()
  }));

const result = {
  catalog_version: '20181210i412',
  audited_at: '2026-07-25',
  methodology: 'Konservativ ID-matchning samt entydig exakt namnmatch i uttryckliga BodyParts3D-filer.',
  present: entries.length,
  needs_download: catalog.length - entries.length,
  entries
};

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ present: result.present, needsDownload: result.needs_download }));
