#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repo = path.resolve(__dirname, "..");
const sourceRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(repo, "../Resus/Models/BodyParts3D_20181210i412_full");

const cranialNerves = [
  part("Olfactory_nerve.r", "Höger luktnerv (I)", "r", ["CX116"]),
  part("Olfactory_nerve.l", "Vänster luktnerv (I)", "l", ["CX117"]),
  part("Optic_nerve.r", "Höger synnerv (II)", "r", ["MM2242M", "MM2243M", "MM2244M", "MM2245M"]),
  part("Optic_nerve.l", "Vänster synnerv (II)", "l", ["MM2242", "MM2243", "MM2244", "MM2245"]),
  part("Oculomotor_nerve.r", "Höger ögonmotoriknerv (III)", "r", ["CX136"]),
  part("Oculomotor_nerve.l", "Vänster ögonmotoriknerv (III)", "l", ["FJ3968"]),
  part("Trochlear_nerve.r", "Höger trochlearisnerv (IV)", "r", ["MM2726M"]),
  part("Trochlear_nerve.l", "Vänster trochlearisnerv (IV)", "l", ["MM2726"]),
  part("Trigeminal_nerve.r", "Höger trillingnerv (V)", "r", ["FJ4038"]),
  part("Trigeminal_nerve.l", "Vänster trillingnerv (V)", "l", ["FJ3980"]),
  part("Abducens_nerve.r", "Höger abducensnerv (VI)", "r", ["FJ3891"]),
  part("Abducens_nerve.l", "Vänster abducensnerv (VI)", "l", ["FJ3927"]),
  part("Facial_nerve.r", "Höger ansiktsnerv (VII)", "r", ["MM1025M"]),
  part("Facial_nerve.l", "Vänster ansiktsnerv (VII)", "l", ["MM1025"]),
  part("Vestibulocochlear_nerve.r", "Höger hörsel- och balansnerv (VIII)", "r", ["MM2609M", "MM2619M"]),
  part("Vestibulocochlear_nerve.l", "Vänster hörsel- och balansnerv (VIII)", "l", ["MM2609", "MM2619"]),
  part("Glossopharyngeal_nerve.r", "Höger tung-svalgnerv (IX)", "r", ["MM2641M"]),
  part("Glossopharyngeal_nerve.l", "Vänster tung-svalgnerv (IX)", "l", ["MM2641"]),
  part("Vagus_nerve.r", "Höger vagusnerv (X), kranial del", "r", ["MM2634M"]),
  part("Vagus_nerve.l", "Vänster vagusnerv (X), kranial del", "l", ["MM2634"]),
  part("Accessory_nerve.r", "Höger accessorisk nerv (XI)", "r", ["FJ4025"]),
  part("Accessory_nerve.l", "Vänster accessorisk nerv (XI)", "l", ["FJ3928"]),
  part("Hypoglossal_nerve.r", "Höger tungnerv (XII)", "r", ["FJ4027"]),
  part("Hypoglossal_nerve.l", "Vänster tungnerv (XII)", "l", ["FJ3941"])
];

const cranialRoots = [
  part("Trigeminal_nerve_roots.r", "Höger trigeminusrot", "r", ["MM2675M", "MM2695M"]),
  part("Trigeminal_nerve_roots.l", "Vänster trigeminusrot", "l", ["MM2675", "MM2695"]),
  part("Facial_nerve_roots.r", "Höger facialisrot", "r", ["MM2607M", "MM2608M"]),
  part("Facial_nerve_roots.l", "Vänster facialisrot", "l", ["MM2607", "MM2608"]),
  part("Vestibular_ganglion.r", "Höger vestibularisganglion", "r", ["MM2597M", "MM2598M"]),
  part("Vestibular_ganglion.l", "Vänster vestibularisganglion", "l", ["MM2597", "MM2598"]),
  part("Glossopharyngeal_ganglia.r", "Höger glossopharyngeusganglier", "r", ["MM2599M", "MM2600M"]),
  part("Glossopharyngeal_ganglia.l", "Vänster glossopharyngeusganglier", "l", ["MM2599", "MM2600"]),
  part("Vagus_ganglia.r", "Höger vagusganglier", "r", ["MM2601M", "MM2602M"]),
  part("Vagus_ganglia.l", "Vänster vagusganglier", "l", ["MM2601", "MM2602"])
];

const cardiacDetails = [
  part("Tricuspid_valve", "Trikuspidalklaff", "mid", ["CX224", "CX225", "CX226"], "organ"),
  part("Mitral_valve", "Mitralisklaff", "mid", ["CX227", "CX228"], "organ"),
  part("Aortic_valve", "Aortaklaff", "mid", ["MM519", "MM521", "MM524"], "organ"),
  part("Pulmonary_valve", "Pulmonalisklaff", "mid", ["MM604", "MM605", "MM606"], "organ"),
  part("Left_coronary_artery", "Vänster kranskärl", "l", ["MM557", "CX238", "CX319"], "vascular"),
  part("Right_coronary_artery", "Höger kranskärl", "r", ["CX320"], "vascular"),
  part("Cardiac_veins", "Hjärtats större vener", "mid", ["MM447", "MM449", "MM452"], "vascular"),
  part("Papillary_muscles_left_ventricle", "Papillarmuskler i vänster kammare", "mid", ["MM636", "MM637"], "organ"),
  part("Papillary_muscles_right_ventricle", "Papillarmuskler i höger kammare", "mid", ["MM537", "MM550", "MM551"], "organ")
];

function part(name, label, side, sources, tissue = "nervous"){
  return {name, label, side, sources, tissue};
}

function sourceFilesById(){
  if(!fs.existsSync(sourceRoot)) throw new Error(`Källmappen saknas: ${sourceRoot}`);
  const result = new Map();
  for(const directory of fs.readdirSync(sourceRoot)){
    const fullDirectory = path.join(sourceRoot, directory);
    if(!fs.statSync(fullDirectory).isDirectory()) continue;
    for(const filename of fs.readdirSync(fullDirectory)){
      if(!filename.endsWith(".obj")) continue;
      const id = filename.split("_", 1)[0];
      if(result.has(id)) throw new Error(`Dubbelt käll-ID: ${id}`);
      result.set(id, path.join(fullDirectory, filename));
    }
  }
  return result;
}

function rewriteReference(reference, offsets, localCounts){
  return reference.split("/").map((value, index)=>{
    if(value === "") return "";
    const parsed = Number(value);
    if(!Number.isInteger(parsed) || parsed === 0) throw new Error(`Ogiltigt OBJ-index: ${reference}`);
    const type = ["v", "vt", "vn"][index];
    if(!type) throw new Error(`För många OBJ-indexdelar: ${reference}`);
    return String(parsed > 0 ? offsets[type] + parsed : offsets[type] + localCounts[type] + parsed + 1);
  }).join("/");
}

function mergedObj(parts, files, title){
  const output = [
    `# ${title}`,
    "# Källa: BodyParts3D 20181210i412 (CC BY 2.1 JP), reproducerbart genererad.",
    ""
  ];
  const totals = {v:0, vt:0, vn:0};

  for(const entry of parts){
    output.push(`o ${entry.name}`);
    for(const sourceId of entry.sources){
      const filename = files.get(sourceId);
      if(!filename) throw new Error(`Käll-ID saknas: ${sourceId}`);
      const lines = fs.readFileSync(filename, "utf8").replace(/\r/g, "").split("\n");
      const localCounts = {v:0, vt:0, vn:0};
      for(const line of lines){
        const type = line.split(/\s+/, 1)[0];
        if(type in localCounts) localCounts[type]++;
      }
      const offsets = {...totals};
      output.push(`# Source: ${path.basename(filename)}`);
      for(const line of lines){
        if(line.startsWith("v ") || line.startsWith("vt ") || line.startsWith("vn ")){
          output.push(line.trim());
        }
      }
      for(const line of lines){
        if(!line.startsWith("f ")) continue;
        const references = line.trim().slice(2).split(/\s+/)
          .map(reference=>rewriteReference(reference, offsets, localCounts));
        output.push(`f ${references.join(" ")}`);
      }
      for(const type of Object.keys(totals)) totals[type] += localCounts[type];
    }
    output.push("");
  }
  if(!totals.v) throw new Error(`Ingen geometri byggdes för ${title}`);
  return output.join("\n");
}

function writeEmbedded(relativePath, globalName, key, obj){
  const target = path.join(repo, relativePath);
  const source = [
    `/* Genererad av tools/build_bp3d_clinical_details.js. Ändra inte för hand. */`,
    `window.${globalName} = window.${globalName} || {};`,
    `window.${globalName}[${JSON.stringify(key)}] = ${JSON.stringify(obj)};`,
    ""
  ].join("\n");
  fs.writeFileSync(target, source);
  console.log(`${relativePath}: ${(source.length/1048576).toFixed(2)} MiB`);
}

function metadata(parts, system){
  return parts.map(entry=>({
    name:entry.name,
    label:entry.label,
    system,
    region:"head_neck",
    side:entry.side,
    tissue:entry.tissue
  }));
}

const files = sourceFilesById();
const fullCranialParts = [...cranialNerves, ...cranialRoots];
writeEmbedded(
  "Kroppsatlas/models/body/cranial_nerves.js",
  "BODY3D_OBJ",
  "cranial_nerves",
  mergedObj(fullCranialParts, files, "Kranialnerver, rötter och ganglier")
);
writeEmbedded(
  "Kroppsatlas/models/body/cardiac_detail.js",
  "BODY3D_OBJ",
  "cardiac_detail",
  mergedObj(cardiacDetails, files, "Hjärtklaffar, kranskärl och papillarmuskler")
);
writeEmbedded(
  "Neuro/models/brain/cranial_roots.js",
  "BRAIN3D_OBJ",
  "cranial_roots",
  mergedObj([part("Cranial_roots_and_ganglia", "", "mid",
    cranialRoots.flatMap(entry=>entry.sources))], files, "Intrakraniella nervrötter och ganglier")
);

const metaTarget = path.join(repo, "Kroppsatlas/models/body/bp3d-clinical-detail-meta.js");
const metaSource = [
  "/* Genererad av tools/build_bp3d_clinical_details.js. Ändra inte för hand. */",
  `window.BODY3D_BP3D_CLINICAL_PARTS = ${JSON.stringify([
    ...metadata(fullCranialParts, "cranial_nerves"),
    ...cardiacDetails.map(entry=>({
      name:entry.name, label:entry.label, system:"cardiac_detail", region:"axial",
      side:entry.side, tissue:entry.tissue
    }))
  ], null, 2)};`,
  ""
].join("\n");
fs.writeFileSync(metaTarget, metaSource);
console.log(`Kroppsatlas/models/body/bp3d-clinical-detail-meta.js: ${metaSource.length} bytes`);
