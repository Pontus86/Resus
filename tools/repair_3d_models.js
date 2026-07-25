#!/usr/bin/env node
"use strict";

// Reproducerbar reparation av två stora, inbäddade OBJ-filer. Källbiblioteket är avsiktligt
// gitignorerat, så sökvägen anges explicit i stället för att rådata kopieras in i repot.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repo = path.resolve(__dirname, "..");
const sourceRootArg = process.argv.indexOf("--source-root");
if(sourceRootArg < 0 || !process.argv[sourceRootArg+1]){
  throw new Error("Ange --source-root <sökväg till Models>");
}
const sourceRoot = path.resolve(process.argv[sourceRootArg+1]);

function readEmbedded(file, globalName, key){
  const context = {window:{}};
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, {filename:file});
  return context.window[globalName][key];
}

function writeEmbedded(file, globalName, key, obj){
  const text = `window.${globalName} = window.${globalName} || {};\n` +
    `window.${globalName}[${JSON.stringify(key)}] = ${JSON.stringify(obj)};\n`;
  fs.writeFileSync(file, text);
}

function parseMergedObjects(obj){
  const objects = [];
  let current = null;
  let globalVertexCount = 0;
  for(const line of obj.split("\n")){
    if(line.startsWith("o ")){
      current = {name:line.slice(2), vertices:[], faces:[], firstGlobalVertex:globalVertexCount+1};
      objects.push(current);
    } else if(line.startsWith("v ") && current){
      current.vertices.push(line);
      globalVertexCount++;
    } else if(line.startsWith("f ") && current){
      current.faces.push(line.replace(/-?\d+/g, token=>{
        const index = Number(token);
        if(index < 0) throw new Error(`Negativt OBJ-index stöds inte i ${current.name}`);
        return String(index-current.firstGlobalVertex+1);
      }));
    }
  }
  return objects;
}

function parseSourceObject(file, name){
  const vertices = [], faces = [];
  for(const line of fs.readFileSync(file, "utf8").split(/\r?\n/)){
    if(line.startsWith("v ")) vertices.push(line);
    else if(line.startsWith("f ")){
      // Råfilerna har v//vn-index, men den sammanslagna produktionsfilen bäddar bara in
      // positioner. Släpp normalindexen så OBJLoader räknar nya normaler från trianglarna.
      faces.push("f "+line.slice(2).trim().split(/\s+/).map(token=>token.split("/")[0]).join(" "));
    }
  }
  if(!vertices.length || !faces.length) throw new Error(`Tom OBJ-källa: ${file}`);
  return {name, vertices, faces};
}

function serializeObjects(objects, header){
  const out = [header];
  let vertexOffset = 0;
  for(const object of objects){
    out.push(`o ${object.name}`, ...object.vertices);
    for(const face of object.faces){
      out.push(face.replace(/-?\d+/g, token=>String(Number(token)+vertexOffset)));
    }
    vertexOffset += object.vertices.length;
  }
  return out.join("\n")+"\n";
}

function repairCalvarium(){
  const file = path.join(repo, "Kroppsatlas/models/body/skeletal.js");
  const objects = parseMergedObjects(readEmbedded(file, "BODY3D_OBJ", "skeletal"));
  const bodyParts = path.join(sourceRoot, "Body/Body");
  const replacements = new Map([
    ["Frontal_bone", "FJ6310_BP50323_FMA52734_Frontal bone.obj"],
    ["Parietal_bone.l", "FJ6385_BP47888_FMA52789_Left parietal bone.obj"],
    ["Parietal_bone.r", "FJ6472_BP50417_FMA52788_Right parietal bone.obj"],
    ["Occipital_bone", "FJ6411_BP48085_FMA52735_Occipital bone.obj"]
  ]);
  let replaced = 0;
  const repaired = objects.map(object=>{
    const source = replacements.get(object.name);
    if(!source) return object;
    replaced++;
    return parseSourceObject(path.join(bodyParts, source), object.name);
  });
  if(replaced !== replacements.size){
    throw new Error(`Hittade bara ${replaced}/${replacements.size} kalvarieobjekt`);
  }
  writeEmbedded(file, "BODY3D_OBJ", "skeletal",
    serializeObjects(repaired, "# Kroppsatlas merged system: skeletal (386 parts; full BodyParts3D calvarium)"));
}

function repairPeripheralNerves(){
  const file = path.join(repo, "Neuro/models/brain/peripheral_nerves.js");
  const source = readEmbedded(file, "BRAIN3D_OBJ", "peripheral_nerves");
  const alreadyRepaired = source.startsWith("# Merged: peripheral nerves; legacy");
  const duplicateArm = /(?:^|[^a-z])(radial|ulnar|median|axillary|musculocutaneous)(?:[^a-z]|$)/i;
  let skipFaces = false, removedSources = 0;
  const out = [];
  for(const line of source.split("\n")){
    if(line.startsWith("# Source:")){
      const modernArm = line.includes("upper-limb/hand");
      const lowerLimb = line.includes("lower-limb.obj");
      skipFaces = !modernArm && !lowerLimb && duplicateArm.test(line);
      if(skipFaces) removedSources++;
      else out.push(line);
    } else if(skipFaces && line.startsWith("f ")){
      // Vertexraderna behålls så alla efterföljande globala OBJ-index förblir giltiga.
    } else {
      out.push(line);
    }
  }
  if(!alreadyRepaired && removedSources < 10){
    throw new Error(`Oväntat få dubblerade armkällor: ${removedSources}`);
  }
  out[0] = "# Merged: peripheral nerves; legacy median/radial/ulnar/axillary arm surfaces removed in favor of calibrated Open3DModel upper-limb/hand";
  writeEmbedded(file, "BRAIN3D_OBJ", "peripheral_nerves", out.join("\n"));
  console.log(removedSources
    ? `Tog bort ytor från ${removedSources} överlappande äldre armkällor.`
    : "Nervmodellen var redan deduplicerad.");
}

repairPeripheralNerves();
repairCalvarium();
