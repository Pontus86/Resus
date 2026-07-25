#!/usr/bin/env node
"use strict";

// Reproducerbar reparation av två stora, inbäddade OBJ-filer. Källbiblioteket är avsiktligt
// gitignorerat, så sökvägen anges explicit i stället för att rådata kopieras in i repot.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repo = path.resolve(__dirname, "..");
const sourceRootArg = process.argv.indexOf("--source-root");
const nervesOnly = process.argv.includes("--nerves-only");
const calvariumOnly = process.argv.includes("--calvarium-only");
const sourceRoot = sourceRootArg >= 0 && process.argv[sourceRootArg+1]
  ? path.resolve(process.argv[sourceRootArg+1])
  : null;
if(!nervesOnly && !sourceRoot){
  throw new Error("Ange --source-root <sökväg till Models> eller kör --nerves-only");
}

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

function parseSourceBlocks(obj){
  const vertices = [];
  const blocks = [];
  let current = null;
  for(const line of obj.split("\n")){
    if(line.startsWith("# Source:")){
      current = {comment:line, candidateVertices:[], faces:[], sawFace:false};
      blocks.push(current);
    } else if(line.startsWith("v ")){
      vertices.push(line);
      if(current && !current.sawFace) current.candidateVertices.push(vertices.length);
    } else if(line.startsWith("f ") && current){
      current.sawFace = true;
      current.faces.push(line);
    }
  }

  return blocks.filter(block=>block.faces.length).map(block=>{
    const referenced = new Set();
    for(const face of block.faces){
      for(const token of face.slice(2).trim().split(/\s+/)){
        const index = Number(token.split("/")[0]);
        if(!Number.isInteger(index) || index < 1 || index > vertices.length){
          throw new Error(`Ogiltigt OBJ-index ${token} i ${block.comment}`);
        }
        referenced.add(index);
      }
    }
    const indices = block.candidateVertices.filter(index=>referenced.has(index));
    if(indices.length !== referenced.size){
      throw new Error(`Källblock refererar vertex utanför sitt eget block: ${block.comment}`);
    }
    const localIndex = new Map(indices.map((index,i)=>[index,i+1]));
    return {
      comment:block.comment,
      name:block.comment.split(" :: ")[1] || "",
      vertices:indices.map(index=>vertices[index-1]),
      faces:block.faces.map(face=>"f "+face.slice(2).trim().split(/\s+/).map(token=>{
        const parts = token.split("/");
        parts[0] = String(localIndex.get(Number(parts[0])));
        return parts.join("/");
      }).join(" "))
    };
  });
}

function serializeSourceBlocks(blocks, header){
  const out = [header];
  let vertexOffset = 0;
  for(const block of blocks){
    out.push(block.comment, ...block.vertices);
    for(const face of block.faces){
      out.push("f "+face.slice(2).trim().split(/\s+/).map(token=>{
        const parts = token.split("/");
        parts[0] = String(Number(parts[0])+vertexOffset);
        return parts.join("/");
      }).join(" "));
    }
    vertexOffset += block.vertices.length;
  }
  return out.join("\n")+"\n";
}

function mirrorSourceBlock(block, leftName){
  return {
    comment:`# Source: upper-limb/hand (generated mirror of canonical right) :: ${leftName}`,
    name:leftName,
    vertices:block.vertices.map(line=>{
      const parts = line.trim().split(/\s+/);
      parts[1] = String(-Number(parts[1]));
      return parts.join(" ");
    }),
    // En spegling byter koordinatsystemets handedness. Om ordningen inte vänds pekar
    // trianglarnas framsidor och beräknade normaler inåt på hela vänsterarmen.
    faces:block.faces.map(face=>"f "+face.slice(2).trim().split(/\s+/).reverse().join(" "))
  };
}

function sourceBounds(block){
  const bounds = {min:[Infinity,Infinity,Infinity], max:[-Infinity,-Infinity,-Infinity]};
  for(const line of block.vertices){
    const p = line.slice(2).trim().split(/\s+/).map(Number);
    for(let axis=0;axis<3;axis++){
      bounds.min[axis] = Math.min(bounds.min[axis],p[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis],p[axis]);
    }
  }
  return bounds;
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
  const blocks = parseSourceBlocks(source);
  const armBlocks = blocks.filter(block=>block.comment.includes("upper-limb/hand"));
  const nonArmBlocks = blocks.filter(block=>!block.comment.includes("upper-limb/hand"));
  const rightExplicit = armBlocks.filter(block=>
    !block.comment.includes("(mirrored)") && block.name.endsWith(".r"));

  // Handbiblioteket saknade ursprungligen sidsuffix och förekom i två omgångar. Sista
  // förekomsten per namn är den kompletta, senare handomgången som också hade speglats.
  const rightUnsuffixed = armBlocks.filter(block=>
    !block.comment.includes("(mirrored)") && !/[.][rl]$/.test(block.name));
  const lastUnsuffixed = new Map();
  rightUnsuffixed.forEach((block,index)=>lastUnsuffixed.set(block.name,{block,index}));
  const canonicalHand = Array.from(lastUnsuffixed.values())
    .sort((a,b)=>a.index-b.index)
    .map(entry=>entry.block);
  const canonicalInput = [...rightExplicit,...canonicalHand];

  const canonicalRight = canonicalInput.map(block=>{
    let baseName = block.name.replace(/[.]r$/,"");
    if(!/[.]r$/.test(block.name) && (baseName==="Median_nerve" || baseName==="Ulnar_nerve")){
      baseName += "_hand_segment";
    }
    return Object.assign({},block,{
      name:`${baseName}.r`,
      comment:`# Source: upper-limb/hand canonical-right (Open3DModel/anatomytool.org, CC-BY-SA 4.0) :: ${baseName}.r`
    });
  });
  const rightNames = new Set(canonicalRight.map(block=>block.name));
  if(canonicalRight.length !== 48 || rightNames.size !== 48){
    throw new Error(`Kanonisk högerarm ska ha 48 unika block, fick ${canonicalRight.length}/${rightNames.size}`);
  }

  const requiredPlexus = [
    "Upper_subscapular_nerve.r","Suprascapular_nerve.r","Lower_subscapular_nerve.r",
    "Dorsal_scapular_nerve.r","Anterior_divisions_of_brachial_plexus.r",
    "Superior_trunk_of_brachial_plexus.r","Posterior_divisions_of_brachial_plexus.r",
    "Middle_trunk_of_brachial_plexus.r","Inferior_trunk_of_brachial_plexus.r",
    "Lateral_cord_of_brachial_plexus.r","Lateral_pectoral_nerve.r",
    "Long_thoracic_nerve.r","Medial_cord_of_brachial_plexus.r",
    "Medial_pectoral_nerve.r","Posterior_cord_of_brachial_plexus.r",
    "Subclavian_nerve.r"
  ];
  const missingPlexus = requiredPlexus.filter(name=>!rightNames.has(name));
  if(missingPlexus.length){
    throw new Error(`Plexus saknar: ${missingPlexus.join(", ")}`);
  }

  const canonicalLeft = canonicalRight.map(block=>{
    const leftName = block.name.replace(/[.]r$/,".l");
    return mirrorSourceBlock(block,leftName);
  });
  for(let i=0;i<canonicalRight.length;i++){
    const rightBounds = sourceBounds(canonicalRight[i]);
    const leftBounds = sourceBounds(canonicalLeft[i]);
    const delta = Math.max(
      Math.abs(leftBounds.min[0]+rightBounds.max[0]),
      Math.abs(leftBounds.max[0]+rightBounds.min[0]),
      Math.abs(leftBounds.min[1]-rightBounds.min[1]),
      Math.abs(leftBounds.max[1]-rightBounds.max[1]),
      Math.abs(leftBounds.min[2]-rightBounds.min[2]),
      Math.abs(leftBounds.max[2]-rightBounds.max[2])
    );
    if(delta > 1e-9) throw new Error(`Felaktig spegling för ${canonicalRight[i].name}: ${delta}`);
  }

  const repaired = [...nonArmBlocks,...canonicalRight,...canonicalLeft];
  writeEmbedded(file, "BRAIN3D_OBJ", "peripheral_nerves", serializeSourceBlocks(repaired,
    "# Merged: peripheral nerves; 48 canonical right upper-limb sources + 48 generated left mirrors; complete brachial plexus"));
  console.log(`Regenererade ${nonArmBlocks.length} icke-armblock + 48 högerarm + 48 speglad vänsterarm.`);
}

if(!calvariumOnly) repairPeripheralNerves();
if(!nervesOnly) repairCalvarium();
