#!/usr/bin/env node
"use strict";

/*
 * Bygger Neuros nivåsegmenterade ryggmärg från HuBMAP HRA v1.2.
 *
 * Käll-GLB:n ligger i den ignorerade Models-katalogen. Varje HRA-nod bevaras som ett eget
 * OBJ-objekt (C1–S4), eftersom nivåvalet i simulatorn ska markera verklig källgeometri och
 * inte uppskattade skivor genom en sammanslagen yta.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.resolve(
  REPO_ROOT,
  "../Resus/Models/Human Reference Atlas/Female spinal cord v1.2/VH_F_Spinal_Cord.glb"
);
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "Neuro/models/spinal/hra_spinalcord.js");

function parseArgs(argv){
  const result = {source:DEFAULT_SOURCE, output:DEFAULT_OUTPUT};
  for(let i=2; i<argv.length; i++){
    if(argv[i] === "--source") result.source = path.resolve(argv[++i]);
    else if(argv[i] === "--output") result.output = path.resolve(argv[++i]);
    else throw new Error(`Okänt argument: ${argv[i]}`);
  }
  return result;
}

function identity(){
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}

function multiply(a, b){
  const out = new Array(16).fill(0);
  for(let col=0; col<4; col++){
    for(let row=0; row<4; row++){
      for(let k=0; k<4; k++) out[col*4+row] += a[k*4+row] * b[col*4+k];
    }
  }
  return out;
}

function nodeMatrix(node){
  if(node.matrix) return node.matrix;
  const t = node.translation || [0,0,0];
  const r = node.rotation || [0,0,0,1];
  const s = node.scale || [1,1,1];
  const [x,y,z,w] = r;
  return [
    (1-2*y*y-2*z*z)*s[0], (2*x*y+2*z*w)*s[0], (2*x*z-2*y*w)*s[0], 0,
    (2*x*y-2*z*w)*s[1], (1-2*x*x-2*z*z)*s[1], (2*y*z+2*x*w)*s[1], 0,
    (2*x*z+2*y*w)*s[2], (2*y*z-2*x*w)*s[2], (1-2*x*x-2*y*y)*s[2], 0,
    t[0], t[1], t[2], 1
  ];
}

function transformPoint(m, p){
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]
  ];
}

function parseGlb(filename){
  const file = fs.readFileSync(filename);
  if(file.toString("ascii",0,4) !== "glTF") throw new Error(`${filename}: inte en GLB-fil`);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20,20+jsonLength).toString().replace(/\0+$/,""));
  const binHeader = 20 + jsonLength;
  const binLength = file.readUInt32LE(binHeader);
  return {json, bin:file.subarray(binHeader+8,binHeader+8+binLength)};
}

const COMPONENT = {
  5120:{bytes:1, read:(b,o)=>b.readInt8(o)},
  5121:{bytes:1, read:(b,o)=>b.readUInt8(o)},
  5122:{bytes:2, read:(b,o)=>b.readInt16LE(o)},
  5123:{bytes:2, read:(b,o)=>b.readUInt16LE(o)},
  5125:{bytes:4, read:(b,o)=>b.readUInt32LE(o)},
  5126:{bytes:4, read:(b,o)=>b.readFloatLE(o)}
};
const WIDTH = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

function readAccessor(glb, index){
  const accessor = glb.json.accessors[index];
  if(accessor.sparse) throw new Error("Sparse accessors stöds inte");
  const view = glb.json.bufferViews[accessor.bufferView];
  const type = COMPONENT[accessor.componentType];
  const width = WIDTH[accessor.type];
  const stride = view.byteStride || type.bytes*width;
  const start = (view.byteOffset||0) + (accessor.byteOffset||0);
  const values = [];
  for(let i=0; i<accessor.count; i++){
    const row = [];
    for(let j=0; j<width; j++) row.push(type.read(glb.bin,start+i*stride+j*type.bytes));
    values.push(width === 1 ? row[0] : row);
  }
  return values;
}

const ORDINAL = {
  first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,
  eigth:8,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12
};

function levelFromName(name){
  const cervical = name.match(/_C(\d+)_segment/);
  if(cervical) return `C${cervical[1]}`;
  const named = name.match(/_(first|second|third|fourth|fifth|sixth|seventh|eigth|eighth|ninth|tenth|eleventh|twelfth)_(thoracic|lumbar|sacral)_/);
  if(!named) return null;
  const prefix = {thoracic:"T",lumbar:"L",sacral:"S"}[named[2]];
  return `${prefix}${ORDINAL[named[1]]}`;
}

function levelOrder(level){
  const base = {C:0,T:100,L:200,S:300}[level[0]];
  return base + Number(level.slice(1));
}

function collectSegments(glb){
  const segments = [];
  const roots = glb.json.scenes[glb.json.scene||0].nodes || [];

  function visit(index, parent){
    const node = glb.json.nodes[index];
    const world = multiply(parent,nodeMatrix(node));
    const level = levelFromName(node.name||"");
    if(node.mesh !== undefined && level){
      const vertices = [];
      const triangles = [];
      for(const primitive of glb.json.meshes[node.mesh].primitives){
        if(primitive.mode !== undefined && primitive.mode !== 4) throw new Error(`Mesh-läge ${primitive.mode} stöds inte`);
        const positions = readAccessor(glb,primitive.attributes.POSITION);
        const indices = primitive.indices === undefined ? positions.map((_,i)=>i) : readAccessor(glb,primitive.indices);
        const base = vertices.length;
        positions.forEach(point=>vertices.push(transformPoint(world,point)));
        for(let i=0; i<indices.length; i+=3){
          triangles.push([base+indices[i],base+indices[i+1],base+indices[i+2]]);
        }
      }
      segments.push({level,vertices,triangles});
    }
    (node.children||[]).forEach(child=>visit(child,world));
  }

  roots.forEach(root=>visit(root,identity()));
  return segments.sort((a,b)=>levelOrder(a.level)-levelOrder(b.level));
}

function number(value){
  const rounded = Math.abs(value) < 0.0000005 ? 0 : value;
  return rounded.toFixed(6).replace(/\.?0+$/,"");
}

function main(){
  const args = parseArgs(process.argv);
  const segments = collectSegments(parseGlb(args.source));
  if(segments.length !== 29) throw new Error(`Förväntade 29 HRA-segment, fick ${segments.length}`);

  const lines = ["# HRA kvinnlig ryggmärg v1.2 (CC BY 4.0), rå HRA-koordinatrymd"];
  let vertexOffset = 0;
  let faceCount = 0;
  for(const segment of segments){
    lines.push(`o ${segment.level}`);
    segment.vertices.forEach(p=>lines.push(`v ${number(p[0])} ${number(p[1])} ${number(p[2])}`));
    segment.triangles.forEach(face=>lines.push(`f ${face[0]+1+vertexOffset} ${face[1]+1+vertexOffset} ${face[2]+1+vertexOffset}`));
    vertexOffset += segment.vertices.length;
    faceCount += segment.triangles.length;
  }

  const output = [
    `window.HRA_SPINAL_CORD_OBJ = ${JSON.stringify(`${lines.join("\n")}\n`)};`,
    `window.HRA_SPINAL_LEVELS = ${JSON.stringify(segments.map(segment=>segment.level))};`,
    ""
  ].join("\n");
  fs.mkdirSync(path.dirname(args.output),{recursive:true});
  fs.writeFileSync(args.output,output);
  console.log(`Skrev ${args.output}`);
  console.log(`Resultat: ${segments.length} segment, ${vertexOffset} hörn, ${faceCount} trianglar, ${(output.length/1024/1024).toFixed(1)} MiB`);
}

main();
