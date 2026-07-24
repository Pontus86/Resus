/* ---------- Dermatom/myotom-kroppsdiagram: geometri och data ---------- */
/* Kroppen är uppbyggd av enkla trapetsformade "segment" (nacke, bål, vä/hö arm, vä/hö
   ben) som delas upp i horisontella band, ett per nivå — en förenklad skiss, inte
   anatomiskt exakta dermatomgränser. Bål och nacke delas dessutom på mittlinjen så att
   vänster/höger kan väljas var för sig, precis som armar och ben redan är separata. */
const BODY_PARTS = [
  {id:"neck",  topL:[133,58],  topR:[167,58],  botL:[98,90],   botR:[202,90],  levels:["C2","C3","C4"], splitMid:true},
  {id:"trunk", topL:[90,90],   topR:[210,90],  botL:[112,262], botR:[188,262], levels:["T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12","L1"], splitMid:true},
  {id:"armL",  topL:[60,92],   topR:[89,92],   botL:[38,340],  botR:[64,340],  levels:["C5","C6","C7","C8","T1"], side:"L"},
  {id:"armR",  topL:[211,92],  topR:[240,92],  botL:[236,340], botR:[262,340], levels:["C5","C6","C7","C8","T1"], side:"R"},
  {id:"legL",  topL:[112,262], topR:[150,262], botL:[93,500],  botR:[120,500], levels:["L1","L2","L3","L4","L5","S1","S2"], side:"L"},
  {id:"legR",  topL:[150,262], topR:[188,262], botL:[180,500], botR:[207,500], levels:["L1","L2","L3","L4","L5","S1","S2"], side:"R"}
];
const PERINEUM_REGIONS = [
  {level:"S3",  x:140, y:252, w:20, h:8},
  {level:"S4_5",x:140, y:260, w:20, h:8}
];

/* Ett urval landmärkesnivåer får en liten fast textetikett i diagrammet för orientering
   (alla 27 nivåer går att klicka, bara dessa är alltid textade). */
const LANDMARK_LABELS = ["C5","C6","C7","C8","T1","T4","T10","L1","L3","L5","S1"];

const lerp = (a,b,t) => a + (b-a)*t;

function sliceBodyPart(part, n){
  const regions = [];
  for(let i=0;i<n;i++){
    const f0 = i/n, f1 = (i+1)/n;
    const y0 = lerp(part.topL[1], part.botL[1], f0);
    const y1 = lerp(part.topL[1], part.botL[1], f1);
    const xL0 = lerp(part.topL[0], part.botL[0], f0);
    const xR0 = lerp(part.topR[0], part.botR[0], f0);
    const xL1 = lerp(part.topL[0], part.botL[0], f1);
    const xR1 = lerp(part.topR[0], part.botR[0], f1);
    const level = part.levels[i];
    if(part.splitMid){
      const midX = 150;
      regions.push({level, side:"L", pts:[[xL0,y0],[midX,y0],[midX,y1],[xL1,y1]]});
      regions.push({level, side:"R", pts:[[midX,y0],[xR0,y0],[xR1,y1],[midX,y1]]});
    } else {
      regions.push({level, side:part.side, pts:[[xL0,y0],[xR0,y0],[xR1,y1],[xL1,y1]]});
    }
  }
  return regions;
}

function buildAllBodyRegions(){
  let regions = [];
  BODY_PARTS.forEach(part => { regions = regions.concat(sliceBodyPart(part, part.levels.length)); });
  PERINEUM_REGIONS.forEach(p => {
    regions.push({level:p.level, side:null,
      pts:[[150-p.w/2,p.y],[150+p.w/2,p.y],[150+p.w/2,p.y+p.h],[150-p.w/2,p.y+p.h]]});
  });
  return regions;
}
