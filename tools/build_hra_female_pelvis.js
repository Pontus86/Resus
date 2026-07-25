#!/usr/bin/env node
"use strict";

/*
 * Bygger Kropps-atlasens kvinnliga bäckenorgan från HuBMAP Human Reference Atlas GLB-filer.
 *
 * Källfilerna ligger avsiktligt i den ignorerade Models-katalogen. Skriptet använder HRA:s
 * bäcken som kalibreringsreferens och atlasens befintliga höftben/sacrum/coccyx som mål, men
 * tar inte med ett andra bäckenskelett i resultatet eftersom det skulle ge överlappande ytor.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.resolve(
  REPO_ROOT,
  "../Resus/Models/Human Reference Atlas/Female pelvis v1.2"
);
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "Kroppsatlas/models/body/female_pelvis.js");
const SKELETAL_PATH = path.join(REPO_ROOT, "Kroppsatlas/models/body/skeletal.js");

const PARTS = [
  {file:"VH_F_Uterus.glb", name:"Uterus"},
  {file:"VH_F_Ovary_L.glb", name:"Ovary.l"},
  {file:"VH_F_Ovary_R.glb", name:"Ovary.r"},
  {file:"VH_F_Fallopian_Tube_L.glb", name:"Fallopian_tube.l"},
  {file:"VH_F_Fallopian_Tube_R.glb", name:"Fallopian_tube.r"},
  {file:"VH_F_Urinary_Bladder.glb", name:"Urinary_bladder"},
  {file:"VH_F_Ureter_L.glb", name:"Ureter.l"},
  {file:"VH_F_Ureter_R.glb", name:"Ureter.r"},
  {file:"VH_F_Vagina.glb", name:"Vagina"},
  {file:"VH_F_Ligaments_Uterus_Ovaries.glb", name:"Ligaments_uterus_ovaries"},
  {file:"VH_F_Blood_Vasculature_Uterus.glb", name:"Blood_vasculature_uterus"}
];

function parseArgs(argv){
  const result = {source:DEFAULT_SOURCE, output:DEFAULT_OUTPUT};
  for(let i=2; i<argv.length; i++){
    if(argv[i] === "--source-dir") result.source = path.resolve(argv[++i]);
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
  if(file.toString("ascii", 0, 4) !== "glTF") throw new Error(`${filename}: inte en GLB-fil`);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20+jsonLength).toString().replace(/\0+$/,""));
  const binHeader = 20 + jsonLength;
  const binLength = file.readUInt32LE(binHeader);
  const bin = file.subarray(binHeader+8, binHeader+8+binLength);
  return {json, bin};
}

const COMPONENT = {
  5120:{bytes:1, read:(b,o)=>b.readInt8(o)},
  5121:{bytes:1, read:(b,o)=>b.readUInt8(o)},
  5122:{bytes:2, read:(b,o)=>b.readInt16LE(o)},
  5123:{bytes:2, read:(b,o)=>b.readUInt16LE(o)},
  5125:{bytes:4, read:(b,o)=>b.readUInt32LE(o)},
  5126:{bytes:4, read:(b,o)=>b.readFloatLE(o)}
};
const WIDTH = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4};

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
    for(let j=0; j<width; j++) row.push(type.read(glb.bin, start+i*stride+j*type.bytes));
    values.push(width === 1 ? row[0] : row);
  }
  return values;
}

function collectGeometry(glb){
  const vertices = [];
  const triangles = [];
  const roots = glb.json.scenes[glb.json.scene||0].nodes || [];

  function visit(index, parent){
    const node = glb.json.nodes[index];
    const world = multiply(parent, nodeMatrix(node));
    if(node.mesh !== undefined){
      for(const primitive of glb.json.meshes[node.mesh].primitives){
        if(primitive.mode !== undefined && primitive.mode !== 4){
          throw new Error(`Mesh-läge ${primitive.mode} stöds inte`);
        }
        const positions = readAccessor(glb, primitive.attributes.POSITION);
        const indices = primitive.indices === undefined
          ? positions.map((_,i)=>i)
          : readAccessor(glb, primitive.indices);
        const base = vertices.length;
        positions.forEach(p=>vertices.push(transformPoint(world,p)));
        for(let i=0; i<indices.length; i+=3){
          triangles.push([base+indices[i], base+indices[i+1], base+indices[i+2]]);
        }
      }
    }
    (node.children||[]).forEach(child=>visit(child,world));
  }
  roots.forEach(root=>visit(root,identity()));
  return {vertices, triangles};
}

function bounds(points){
  const result = {min:[Infinity,Infinity,Infinity], max:[-Infinity,-Infinity,-Infinity]};
  for(const p of points){
    for(let i=0; i<3; i++){
      result.min[i] = Math.min(result.min[i],p[i]);
      result.max[i] = Math.max(result.max[i],p[i]);
    }
  }
  result.size = result.max.map((v,i)=>v-result.min[i]);
  result.center = result.max.map((v,i)=>(v+result.min[i])/2);
  return result;
}

function readSkeletalPelvisBounds(){
  const source = fs.readFileSync(SKELETAL_PATH,"utf8");
  const marker = 'window.BODY3D_OBJ["skeletal"] = ';
  const start = source.indexOf(marker);
  if(start < 0) throw new Error("Kunde inte hitta skeletal-OBJ");
  const literalStart = start + marker.length;
  const literalEnd = source.lastIndexOf(";");
  const obj = JSON.parse(source.slice(literalStart,literalEnd).trim());
  const wanted = new Set(["Coccyx","Sacrum","Hip_bone.r","Hip_bone.l"]);
  const points = [];
  let current = "";
  for(const line of obj.split("\n")){
    if(line.startsWith("o ")) current = line.slice(2).trim();
    else if(wanted.has(current) && line.startsWith("v ")){
      points.push(line.slice(2).trim().split(/\s+/).map(Number));
    }
  }
  if(!points.length) throw new Error("Kunde inte mäta atlasens bäcken");
  return bounds(points);
}

function buildCalibration(sourceBounds, targetBounds){
  // HRA: x=vänster/höger, y=kraniokaudal, z=posterior/anterior.
  // BodyParts3D: x=vänster/höger, y=anterior/posterior (omvänd riktning), z=kraniokaudal.
  // En gemensam skala är medelvärdet av de tre bäckenmåtten; det bevarar organens proportioner
  // samtidigt som avvikelsen mellan de två referensindividerna fördelas över alla axlar.
  const ratios = [
    targetBounds.size[0]/sourceBounds.size[0],
    targetBounds.size[2]/sourceBounds.size[1],
    targetBounds.size[1]/sourceBounds.size[2]
  ];
  const scale = ratios.reduce((sum,value)=>sum+value,0)/ratios.length;
  return {
    scale,
    apply(p){
      return [
        targetBounds.center[0] + (p[0]-sourceBounds.center[0])*scale,
        targetBounds.center[1] - (p[2]-sourceBounds.center[2])*scale,
        targetBounds.center[2] + (p[1]-sourceBounds.center[1])*scale
      ];
    }
  };
}

function number(value){
  const rounded = Math.abs(value) < 0.000005 ? 0 : value;
  return rounded.toFixed(5).replace(/\.?0+$/,"");
}

function main(){
  const args = parseArgs(process.argv);
  const pelvisPath = path.join(args.source,"VH_F_Pelvis.glb");
  const sourcePelvis = bounds(collectGeometry(parseGlb(pelvisPath)).vertices);
  const targetPelvis = readSkeletalPelvisBounds();
  const calibration = buildCalibration(sourcePelvis,targetPelvis);

  const lines = [
    "# Kroppsatlas: kvinnliga bäckenorgan (HRA v1.2, CC BY 4.0)",
    `# Kalibrerad HRA->BodyParts3D med bäckenskala ${calibration.scale.toFixed(6)}`
  ];
  let vertexOffset = 0;
  for(const part of PARTS){
    const geometry = collectGeometry(parseGlb(path.join(args.source,part.file)));
    lines.push(`o ${part.name}`);
    geometry.vertices.forEach(point=>{
      const p = calibration.apply(point);
      lines.push(`v ${number(p[0])} ${number(p[1])} ${number(p[2])}`);
    });
    geometry.triangles.forEach(face=>{
      lines.push(`f ${face[0]+1+vertexOffset} ${face[1]+1+vertexOffset} ${face[2]+1+vertexOffset}`);
    });
    vertexOffset += geometry.vertices.length;
  }
  const obj = `${lines.join("\n")}\n`;
  const output = [
    "window.BODY3D_OBJ = window.BODY3D_OBJ || {};",
    `window.BODY3D_OBJ[\"female_pelvis\"] = ${JSON.stringify(obj)};`,
    ""
  ].join("\n");
  fs.mkdirSync(path.dirname(args.output),{recursive:true});
  fs.writeFileSync(args.output,output);
  console.log(`Skrev ${args.output}`);
  console.log(`HRA-bäcken: ${sourcePelvis.size.map(number).join(" × ")} m`);
  console.log(`Atlasbäcken: ${targetPelvis.size.map(number).join(" × ")} mm`);
  console.log(`Gemensam kalibreringsskala: ${calibration.scale.toFixed(6)} mm/m`);
  console.log(`Resultat: ${PARTS.length} strukturer, ${vertexOffset} hörn, ${(output.length/1024/1024).toFixed(1)} MiB`);
}

main();
