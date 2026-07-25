#!/usr/bin/env node
"use strict";

/*
 * Bäddar in BodyParts3D:s officiella cauda equina-OBJ i samma format som atlasens övriga
 * hjärn-/ryggmärgsfiler. Ingen geometrisk transform görs: källan använder redan atlasens
 * BodyParts3D-koordinater.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.resolve(
  REPO_ROOT,
  "../Resus/Models/BodyParts3D_20181210i412/Cauda equina/cauda_equina_BP105718/" +
    "FJ4425_BP105718_FMA52590_Cauda equina.obj"
);
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "Kroppsatlas/models/body/brain/cauda_equina.js"
);

function parseArgs(argv){
  const result = {source:DEFAULT_SOURCE, output:DEFAULT_OUTPUT};
  for(let i=2; i<argv.length; i++){
    if(argv[i] === "--source") result.source = path.resolve(argv[++i]);
    else if(argv[i] === "--output") result.output = path.resolve(argv[++i]);
    else throw new Error(`Okänt argument: ${argv[i]}`);
  }
  return result;
}

function main(){
  const args = parseArgs(process.argv);
  const obj = fs.readFileSync(args.source, "utf8").replace(/\r\n?/g, "\n");
  if(!obj.includes("# Representation ID : BP105718") || !obj.includes("# Concept ID : FMA52590")){
    throw new Error("Källfilen är inte den förväntade officiella cauda equina-representationen");
  }
  if(!/^v /m.test(obj) || !/^f /m.test(obj)){
    throw new Error("Källfilen saknar OBJ-geometri");
  }

  const output = [
    "window.BRAIN3D_OBJ = window.BRAIN3D_OBJ || {};",
    `window.BRAIN3D_OBJ["cauda_equina"] = ${JSON.stringify(obj.endsWith("\n") ? obj : `${obj}\n`)};`,
    ""
  ].join("\n");
  fs.mkdirSync(path.dirname(args.output), {recursive:true});
  fs.writeFileSync(args.output, output);
  console.log(`Skrev ${args.output}`);
  console.log(`Källa: BP105718 / FJ4425 / FMA52590, ${(output.length/1024).toFixed(1)} KiB`);
}

main();
