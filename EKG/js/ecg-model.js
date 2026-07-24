/* ---------- Delad 12-avlednings-EKG-fysiologimodell ---------- */
/* Ursprungligen kopierad från HLR:s js/ecg.js, men vidareutvecklad för simulatorns skull:
   tInvMap/rsrPrime/prDepress är kontinuerliga per-avledningsvärden (inte booleans/listor)
   just för att möjliggöra mjuk 1-sekundersövergång mellan tillstånd (se conditions-data.js
   och simulator.js). Har därför divergerat från HLR:s original — synka INTE tillbaka. */
const ECG_FRONTAL={I:0,II:60,III:120,aVR:-150,aVL:-30,aVF:90};
const ECG_RS={V1:[0,0.18,-1.05,0.12],V2:[0,0.35,-1.35,0.30],V3:[0,0.65,-0.95,0.35],
              V4:[0.03,1.05,-0.55,0.38],V5:[0.07,1.20,-0.28,0.34],V6:[0.08,1.00,-0.15,0.28]};
const ECG_ORDER=[["I","aVR","V1","V4"],["II","aVL","V2","V5"],["III","aVF","V3","V6"]];
const _g=(p,mu,sd,a)=>a*Math.exp(-((p-mu)*(p-mu))/(2*sd*sd));
const _rad=d=>d*Math.PI/180;

function ecgWaves(p,pr){
  const qw=1+(pr.qrsWide||0)*1.6;   // uttalad breddökning: VT/grenblock/svår hyperkalemi ska se tydligt breda ut
  const qt=pr.qt||1;
  return {
    P:_g(p,0.13,0.021,1)*(pr.pWave??1),
    Q:_g(p,0.238,0.006*qw,1),
    R:_g(p,0.262,0.010*qw,1),
    S:_g(p,0.290,0.008*qw,1),
    R2:_g(p,0.305,0.010*qw,1),
    T:_g(p,0.30+0.20*qt,0.042*qt,1)*(pr.tScale??1),
    T2:_g(p,0.30+0.20*qt+0.06,0.030*qt,1)*(pr.tScale??1),   // sen, motriktad lob för bifasiska T-vågor (Wellens A)
    U:pr.uWave?_g(p,0.30+0.20*qt+0.11,0.028,1)*pr.uWave:0,
    J:pr.osborn?_g(p,0.305,0.008,1)*pr.osborn:0,
    D:pr.delta?_g(p,0.228,0.016,1):0,
    PR:_g(p,0.175,0.028,1),
    // Smal, hög pacemakerspik ~120 ms före QRS (Q vid fas 0.238) — omräknat till fas
    // eftersom p är normerad mot aktuell RR-cykel (60/pr.hr), inte en fast tid.
    Spike:pr.pacerSpike?_g(p,0.238-(0.120/(60/(pr.hr||72))),0.0018,1):0,
    FL:pr.flutterRatio?(()=>{const n=pr.flutterRatio,local=(p*n)%1;return local<0.5?local*2:(1-local)*2;})():0
  };
}
function ecgFrontalVec(p,pr){
  const w=ecgWaves(p,pr),ax=pr.axis;
  const c=[[0.18*w.P,ax-15],[0.13*w.Q,ax-155],[1.10*w.R,ax],[0.22*w.S,ax+155],[0.30*w.T,ax-8]];
  if(pr.flutterRatio) c.push([0.20*w.FL,80]);   // fladdervåg, ungefär nedåtriktad axel (mest II/III/aVF)
  let vx=0,vy=0;
  for(let i=0;i<c.length;i++){vx+=c[i][0]*Math.cos(_rad(c[i][1]));vy+=c[i][0]*Math.sin(_rad(c[i][1]));}
  return [vx,vy,w];
}
function ecgSample(lead,p,pr,beatIdx){
  let v,w;
  if(lead in ECG_FRONTAL){
    const r=ecgFrontalVec(p,pr); w=r[2];
    const a=_rad(ECG_FRONTAL[lead]);
    v=r[0]*Math.cos(a)+r[1]*Math.sin(a);
  }else{
    w=ecgWaves(p,pr);
    const rs=ECG_RS[lead],Pa=(lead==="V1"||lead==="V2")?0.10:0.12;
    const normal=Pa*w.P - rs[0]*w.Q + rs[1]*w.R + rs[2]*w.S + rs[3]*w.T;
    // Konkordans (VT): alla bröstavledningar samma polaritet/monomorf form i stället för
    // varje avlednings egna R/S-förhållande — blandas mjukt in via qrsOverride (-1..1).
    const overrideAmt=pr.qrsOverride||0;
    if(overrideAmt){
      const sign=Math.sign(overrideAmt), mag=Math.min(1,Math.abs(overrideAmt));
      const overridden=sign*(1.5*w.R+0.2*w.S)+rs[3]*w.T*0.5*sign;
      v=normal*(1-mag)+overridden*mag;
    } else v=normal;
    if(pr.flutterRatio) v+=0.12*w.FL*(lead==="V1"?1:0.35);
  }
  v+=w.U*0.5 + w.J*(lead in ECG_FRONTAL?1:0.7);
  if(pr.delta) v+=w.D*0.28;
  const leadScale=lead in ECG_FRONTAL?0.30:ECG_RS[lead][3];
  const invAmt=pr.tInvMap&&pr.tInvMap[lead];
  if(invAmt) v-=2*invAmt*w.T*leadScale;
  const biAmt=pr.biphasicMap&&pr.biphasicMap[lead];
  if(biAmt) v-=2.4*biAmt*w.T2*leadScale;   // sen negativ lob läggs till → bifasisk T (positiv-negativ)
  const tAmp=pr.tAmpMap&&pr.tAmpMap[lead];
  if(tAmp) v+=tAmp*w.T;
  const rAmp=pr.rAmpMap&&pr.rAmpMap[lead];
  if(rAmp) v+=rAmp*w.R;   // hög/bred R-våg (t.ex. V1–V2 vid posterior STEMI, spegelbild av posterior Q-våg)
  const qAmp=pr.qAmpMap&&pr.qAmpMap[lead];
  if(qAmp) v-=qAmp*w.Q*leadScale*2.2;   // patologisk (djup/bred) Q-våg, tecken på genomgången infarkt
  const rsrAmt=pr.rsrPrime&&pr.rsrPrime[lead];
  if(rsrAmt) v+=rsrAmt*w.R2;
  if(pr.prDepress) v+=pr.prDepress*w.PR;
  if(pr.pacerSpike) v+=pr.pacerSpike*w.Spike*(lead in ECG_FRONTAL?0.9:1.5);
  if(pr.st&&pr.st[lead]){
    const e=pr.st[lead];
    if(p>=0.305&&p<=0.515){
      const seg=(p-0.305)/0.21;
      const arch=Math.max(0,Math.sin(Math.PI*seg));
      const sagAmt=pr.sag||0;   // 0=konkav ST-höjning/sänkning, 1=digitalis "hängmatta"
      const concave=Math.pow(arch,0.55);
      const hammock=arch*(1-0.55*seg);
      v+= e*(concave*(1-sagAmt)+hammock*sagAmt);
    }
  }
  if(pr.lowVolt) v*=pr.lowVolt;
  if(pr.alternans) v*=(beatIdx%2?1-pr.alternans:1+pr.alternans);
  // Fibrillationsvågor (förmaksflimmer): kaotisk, oregelbunden baslinje i stället för en
  // riktig P-våg — deterministisk (beroende av p+beatIdx, inte Math.random) så den inte
  // flimrar mellan omritningar, men ser aperiodisk ut över flera slag.
  if(pr.fibWave){
    v+=pr.fibWave*(0.045*Math.sin((p+beatIdx*0.37)*23)+0.03*Math.sin((p+beatIdx*0.61)*31+1.7)+0.025*Math.sin((p+beatIdx*0.19)*17+0.4));
  }
  // Torsades de pointes: QRS-amplitud/polaritet "vrider" sig långsamt slag för slag
  // kring baslinjen — den klassiska twisting-look:en vid polymorf VT.
  if(pr.torsades){
    v*=(1+1.4*Math.sin(beatIdx*0.65)*pr.torsades);
  }
  return v;
}

/* ---------- AV-block: dubbla, oberoende tidslinjer för P-vågor och QRS ---------- */
/* Alla 32 övriga tillstånd delar EN gemensam fas per slag (P och QRS låsta till varandra),
   vilket räcker för allt utom AV-block — där P-vågor måste kunna marschera i sin egen takt
   oberoende av (eller delvis oberoende av) QRS. Denna gren återanvänder ecgWaves() oförändrad,
   men anropar den en gång för en P-refererad fas och en gång för en QRS-refererad fas, och
   kombinerar dem själv i stället för att gå via ecgFrontalVec/ecgSample (som antar EN delad
   fas). Rör ENDAST tillstånd med pr.avBlock satt — de andra 32 är opåverkade. */
const AVBLOCK_WIDTH_RR=60/72;   // fast referens för vågbredder, oberoende av hur långsam ersättningsrytmen är
function ecgFrontalVecSplit(wp,wq,ax){
  const c=[[0.18*wp.P,ax-15],[0.13*wq.Q,ax-155],[1.10*wq.R,ax],[0.22*wq.S,ax+155],[0.30*wq.T,ax-8]];
  let vx=0,vy=0;
  for(let i=0;i<c.length;i++){vx+=c[i][0]*Math.cos(_rad(c[i][1]));vy+=c[i][0]*Math.sin(_rad(c[i][1]));}
  return [vx,vy];
}
function ecgSampleAVBlock(lead,pPhase,qrsPhase,pr){
  const wp=ecgWaves(pPhase,pr), wq=ecgWaves(qrsPhase,pr);
  let v;
  if(lead in ECG_FRONTAL){
    const [vx,vy]=ecgFrontalVecSplit(wp,wq,pr.axis);
    const a=_rad(ECG_FRONTAL[lead]);
    v=vx*Math.cos(a)+vy*Math.sin(a);
  }else{
    const rs=ECG_RS[lead],Pa=(lead==="V1"||lead==="V2")?0.10:0.12;
    v=Pa*wp.P - rs[0]*wq.Q + rs[1]*wq.R + rs[2]*wq.S + rs[3]*wq.T;
  }
  v+=wq.U*0.5 + wq.J*(lead in ECG_FRONTAL?1:0.7);
  const leadScale=lead in ECG_FRONTAL?0.30:ECG_RS[lead][3];
  const invAmt=pr.tInvMap&&pr.tInvMap[lead];
  if(invAmt) v-=2*invAmt*wq.T*leadScale;
  const rsrAmt=pr.rsrPrime&&pr.rsrPrime[lead];
  if(rsrAmt) v+=rsrAmt*wq.R2;
  if(pr.st&&pr.st[lead]){
    const e=pr.st[lead];
    if(qrsPhase>=0.305&&qrsPhase<=0.515){
      const seg=(qrsPhase-0.305)/0.21;
      const arch=Math.max(0,Math.sin(Math.PI*seg));
      v+=e*Math.pow(arch,0.55);
    }
  }
  if(pr.lowVolt) v*=pr.lowVolt;
  return v;
}
/* Bygger atrie- och kammartidslinjer (sekunder) för vald blocktyp. */
function buildAVBlockBeats(secs,pr){
  const atrialRR=60/(pr.atrialHr||pr.hr||72);
  const atrialBeats=[]; { let tb=0,k=0;
    while(tb<secs+atrialRR*2){ atrialBeats.push(tb);
      const jit=pr.irregular?1+pr.irregular*(2*(((k*0.6180339887)%1))-1):1;
      tb+=atrialRR*jit; k++; } }
  const prBase=pr.prInterval??0.16;
  let qrsBeats=[];
  if(pr.avBlock==="wenckebach"){
    const cyc=pr.wenckebachRatio||4;
    // Avtagande PR-tillägg per steg (inte linjärt) — ger det klassiska Wenckebach-fotavtrycket:
    // R-R-intervallen kortas successivt fram till bortfallet (trots att PR hela tiden förlängs),
    // och pausen efter bortfallet är kortare än dubbla föregående R-R.
    atrialBeats.forEach((at,i)=>{ const pos=i%cyc; if(pos<cyc-1) qrsBeats.push(at+prBase+0.045*pos-0.008*pos*pos); });
  } else if(pr.avBlock==="mobitz2"){
    const ratio=pr.mobitzRatio||3;
    atrialBeats.forEach((at,i)=>{ if(i%ratio===0) qrsBeats.push(at+prBase); });
  } else if(pr.avBlock==="chb"){
    const escRR=60/(pr.escapeHr||35);
    let tb=0.05; while(tb<secs+escRR*2){ qrsBeats.push(tb); tb+=escRR; }
  } else { // "first" (och fallback): 1:1, bara förlängd/normal PR
    atrialBeats.forEach(at=>qrsBeats.push(at+prBase));
  }
  if(!atrialBeats.length||atrialBeats[0]>0) atrialBeats.unshift(-10);
  if(!qrsBeats.length||qrsBeats[0]>0) qrsBeats.unshift(-10);
  return {atrialBeats,qrsBeats};
}

function drawECG12(cv,pr,opts){
  opts=opts||{};
  const color=opts.color||"#12181C";
  const drawFrame=opts.drawFrame!==false;
  const winStart=opts.windowStart||0;   // sek — låter en rita ett glidande "band" i stället för alltid från t=0 (EKG-löparspelet)
  const g=cv.getContext("2d"),W=cv.width,H=cv.height;
  const MM=W/250;
  if(drawFrame){
    g.fillStyle="#FFF6F4";g.fillRect(0,0,W,H);
    g.strokeStyle="#F7D2CE";g.lineWidth=0.5;g.beginPath();
    for(let x=0;x<=W;x+=MM){g.moveTo(x,0);g.lineTo(x,H);}
    for(let y=0;y<=H;y+=MM){g.moveTo(0,y);g.lineTo(W,y);}
    g.stroke();
    g.strokeStyle="#E08D86";g.lineWidth=0.9;g.beginPath();
    for(let x=0;x<=W;x+=MM*5){g.moveTo(x,0);g.lineTo(x,H);}
    for(let y=0;y<=H;y+=MM*5){g.moveTo(0,y);g.lineTo(W,y);}
    g.stroke();
  }

  const rr=60/pr.hr, PXS=25*MM, PXMV=10*MM;
  const COLW=(W-14*MM)/4, SEC=(COLW-9*MM)/PXS;
  const rowY=[H*0.20,H*0.40,H*0.60];

  g.lineJoin="round";
  const drawLead=(lead,x0,y0,secs,px)=>{
    if(drawFrame){
      g.strokeStyle="#12181C";g.lineWidth=1.35;
      g.beginPath();
      g.moveTo(x0-6*MM,y0);g.lineTo(x0-5*MM,y0);g.lineTo(x0-5*MM,y0-PXMV);
      g.lineTo(x0-2*MM,y0-PXMV);g.lineTo(x0-2*MM,y0);g.lineTo(x0,y0);
      g.stroke();
    }
    const N=Math.round(secs*440);
    g.strokeStyle=typeof color==="function" ? color(lead) : color;g.lineWidth=opts.lineWidth||1.35;
    g.beginPath();
    if(pr.avBlock){
      const {atrialBeats,qrsBeats}=buildAVBlockBeats(winStart+secs+rr,pr);
      let ai=0,qi=0;
      while(ai+1<atrialBeats.length && atrialBeats[ai+1]<=winStart) ai++;
      while(qi+1<qrsBeats.length && qrsBeats[qi+1]<=winStart) qi++;
      for(let i=0;i<=N;i++){
        const t=winStart+i/440;
        while(ai+1<atrialBeats.length && atrialBeats[ai+1]<=t) ai++;
        while(qi+1<qrsBeats.length && qrsBeats[qi+1]<=t) qi++;
        const pPhase=0.13+(t-atrialBeats[ai])/AVBLOCK_WIDTH_RR;
        const qrsPhase=0.238+(t-qrsBeats[qi])/AVBLOCK_WIDTH_RR;
        const v=ecgSampleAVBlock(lead,pPhase,qrsPhase,pr);
        const x=x0+(t-winStart)*px, y=y0-v*PXMV;
        i?g.lineTo(x,y):g.moveTo(x,y);
      }
    } else {
      const beats=[]; let tb=0, k=0;
      while(tb<winStart+secs+rr){ beats.push(tb);
        const jit = pr.irregular ? 1 + pr.irregular*(2*(((k*0.6180339887)%1))-1) : 1;
        tb += rr*jit; k++; }
      let bi=0; while(bi+1<beats.length && beats[bi+1]<=winStart) bi++;
      for(let i=0;i<=N;i++){
        const t=winStart+i/440;
        while(bi+1<beats.length && beats[bi+1]<=t) bi++;
        const span=(beats[bi+1]??(beats[bi]+rr))-beats[bi];
        const p=(t-beats[bi])/span;
        const v=ecgSample(lead,p,pr,bi);
        const x=x0+(t-winStart)*px, y=y0-v*PXMV;
        i?g.lineTo(x,y):g.moveTo(x,y);
      }
    }
    g.stroke();
    if(drawFrame){
      g.fillStyle="#12181C";g.font=`bold ${Math.round(3.6*MM)}px ui-monospace,monospace`;
      g.fillText(lead,x0+1*MM,y0-8.5*MM);
    }
  };

  for(let r=0;r<3;r++)for(let c=0;c<4;c++){
    const x0=9*MM+c*COLW, y0=rowY[r];
    drawLead(ECG_ORDER[r][c],x0,y0,SEC,PXS);
    if(c && drawFrame) {g.strokeStyle="#C9A5A0";g.lineWidth=0.7;
      g.beginPath();g.moveTo(x0-7.5*MM,y0-9*MM);g.lineTo(x0-7.5*MM,y0+9*MM);g.stroke();}
  }
  drawLead("II",9*MM,H*0.845,(W-14*MM)/PXS,PXS);

  if(drawFrame){
    g.fillStyle="#5A4A48";g.font=`${Math.round(3.1*MM)}px ui-monospace,monospace`;
    g.fillText("25 mm/s    10 mm/mV    0,05–150 Hz",9*MM,H-2.2*MM);
    g.fillText(Math.round(pr.hr)+" slag/min",W-32*MM,H-2.2*MM);
  }
}

/* ---------- EKG-matchningsspel: overlay-ritning + vågforms-baserad träffprocent ---------- */
/* Ritar mål-EKG:t och spelarens eget försök på samma canvas, så man visuellt ser hur de
   överlappar. Mål-kurvans FÄRG sätts per avledning (inte en enda global färg för hela
   mål-EKG:t) — annars syns aldrig VAR den återstående skillnaden sitter, bara att en global
   procentsats är låg. Varje avlednings egen träffprocent (samma normaliserings-idé som
   computeMatchPercent, men räknad på just den avledningen) glider kontinuerligt mellan grått
   (matchar) och rött (matchar inte) — leder som redan stämmer syns knappt mot det svarta,
   medan leder som fortfarande skiljer sig lyser rött, oavsett hur den GLOBALA procenten ser ut. */
function _lerpColorHex(c1, c2, t){
  t=Math.max(0,Math.min(1,t));
  const p1=parseInt(c1.slice(1),16), p2=parseInt(c2.slice(1),16);
  const r=Math.round(((p1>>16)&255)+((( p2>>16)&255)-((p1>>16)&255))*t);
  const g=Math.round(((p1>>8)&255)+(((p2>>8)&255)-((p1>>8)&255))*t);
  const b=Math.round((p1&255)+((p2&255)-(p1&255))*t);
  return `rgb(${r},${g},${b})`;
}
function _ecgRmseBetweenLead(lead, prA, prB){
  const N=48; let sumSq=0;
  for(let i=0;i<N;i++){ const p=i/N; const a=ecgSample(lead,p,prA,0), b=ecgSample(lead,p,prB,0); const d=a-b; sumSq+=d*d; }
  return Math.sqrt(sumSq/N);
}
function perLeadMatchPercent(lead, targetPr, playerPr){
  if(!_ecgBaselineProfile) _ecgBaselineProfile=composeProfile([]);
  const rmseTP=_ecgRmseBetweenLead(lead, targetPr, playerPr);
  const rmseBase=_ecgRmseBetweenLead(lead, targetPr, _ecgBaselineProfile);
  if(rmseBase<1e-6) return rmseTP<1e-6 ? 100 : 0;
  return Math.max(0, Math.min(100, 100*(1-rmseTP/rmseBase)));
}
function drawECG12Overlay(cv, targetPr, playerPr){
  const leadColor=(lead)=>{
    const pct=perLeadMatchPercent(lead, targetPr, playerPr);
    return _lerpColorHex("#F44336", "#B7B2AF", pct/100);
  };
  drawECG12(cv, targetPr, {color:leadColor, drawFrame:true});
  drawECG12(cv, playerPr, {color:"#12181C", drawFrame:false, lineWidth:1.5});
}

/* Jämför två profiler genom att sampla samtliga 12 avledningar över en slagcykel (fas 0..1)
   och räkna ut ett RMSE, i stället för att jämföra vilka tillstånds-id:n som är aktiva —
   så en annan kombination som råkar ge en nästan identisk kurva också belönas rättvist.
   Normaliserat MOT målets egen avvikelse från normalt sinusrytm (inte en fast konstant) —
   annars skulle subtila tillstånd (t.ex. tidig repolarisation) ge nästan 100 % gratis bara
   för att stå still, medan dramatiska tillstånd (VT) alltid skulle straffa hårt. Genom att
   dela med avståndet mellan MÅLET och ett normalt EKG blir 0 aktiva knappar alltid exakt 0 %,
   oavsett hur stort eller litet målets eget fynd är. */
const ECG_MATCH_LEADS=[...Object.keys(ECG_FRONTAL), ...Object.keys(ECG_RS)];
function _ecgRmseBetween(prA, prB){
  const N=48;
  let sumSq=0, count=0;
  for(const lead of ECG_MATCH_LEADS){
    for(let i=0;i<N;i++){
      const p=i/N;
      const a=ecgSample(lead,p,prA,0), b=ecgSample(lead,p,prB,0);
      const diff=a-b; sumSq+=diff*diff; count++;
    }
  }
  return Math.sqrt(sumSq/count);
}
let _ecgBaselineProfile=null;
function computeMatchPercent(targetPr, playerPr){
  if(!_ecgBaselineProfile) _ecgBaselineProfile=composeProfile([]);
  const rmseTP=_ecgRmseBetween(targetPr, playerPr);
  const rmseBase=_ecgRmseBetween(targetPr, _ecgBaselineProfile);
  if(rmseBase<1e-6) return rmseTP<1e-6 ? 100 : 0;
  return Math.max(0, Math.min(100, 100*(1-rmseTP/rmseBase)));
}
// "Pixel-avstånd": samma punktvisa jämförelse (12 avledningar × 48 punkter/slag) som
// computeMatchPercent gör internt, men UTAN normalisering mot en baslinje -- ett rakt,
// bokstavligt mått på hur långt isär kurvorna faktiskt ritas i y-led, i samma mV→pixel-skala
// som drawECG12 använder (10 mm/mV, MM=bredd/250). Den normaliserade procenten är statistiskt
// rättvisare (se kommentaren ovanför _ecgRmseBetween) men känns abstrakt på egen hand --
// det här ger ett konkret "X px i snitt" som direkt går att jämföra mot vad man SER på
// skärmen, som ett komplement i spelets HUD, inte en ersättning.
function computeAvgPixelDistance(targetPr, playerPr, canvasWidth){
  const N=48;
  const MM=(canvasWidth||1000)/250, PXMV=10*MM;
  let sumAbs=0, count=0;
  for(const lead of ECG_MATCH_LEADS){
    for(let i=0;i<N;i++){
      const p=i/N;
      const a=ecgSample(lead,p,targetPr,0), b=ecgSample(lead,p,playerPr,0);
      sumAbs+=Math.abs(a-b)*PXMV; count++;
    }
  }
  return count ? sumAbs/count : 0;
}

/* ---------- Ledtrådar till matchningsspelet ----------
   Pekar ut VILKEN sorts fynd och VILKA avledningar som skiljer sig mest mellan mål och eget
   försök — men aldrig VILKET tillstånd det handlar om. En öppen fråga att resonera vidare
   kring, inte facit. Jämför profilernas fält (inte råa sampel) eftersom det ger en mycket
   mer meningsfull, förklarbar avvikelse än att bara peka på råa vågformsskillnader. */
function _fmtHintLeads(arr){ return arr.join(", "); }
function computeHintCandidates(targetPr, playerPr){
  const c=[];
  const addScalar=(field,threshold,text)=>{
    const t=targetPr[field]??0, p=playerPr[field]??0;
    const diff=Math.abs(t-p);
    if(diff>threshold) c.push({score:diff/threshold, text});
  };
  const addMap=(field,threshold,textFn)=>{
    const t=targetPr[field]||{}, p=playerPr[field]||{};
    const leads=new Set([...Object.keys(t), ...Object.keys(p)]);
    let total=0; const diffs=[];
    leads.forEach(l=>{ const d=Math.abs((t[l]||0)-(p[l]||0)); if(d>threshold){ diffs.push([l,d]); total+=d; } });
    if(diffs.length){ diffs.sort((a,b)=>b[1]-a[1]); c.push({score:total/threshold, text:textFn(diffs.slice(0,3).map(x=>x[0]))}); }
  };
  addScalar("qrsWide",0.3,"Titta på QRS-bredden — är den smalare eller bredare än ditt förslag?");
  addScalar("qt",0.15,"Jämför QT-tiden — för lång, för kort, eller rätt?");
  addScalar("hr",15,"Är hjärtfrekvensen för hög, för låg, eller ungefär rätt?");
  addScalar("pWave",0.3,"Finns P-vågor där de borde — eller är de förändrade/saknade?");
  addScalar("tScale",0.3,"Titta på T-vågornas storlek — för höga, för flacka, eller rätt?");
  addScalar("irregular",0.15,"Är rytmen regelbunden eller oregelbunden jämfört med ditt förslag?");
  addScalar("lowVolt",0.15,"Jämför den totala amplituden/voltagen i avledningarna.");
  addScalar("alternans",0.1,"Växlar komplexens storlek slag för slag (alternans)?");
  addScalar("prDepress",0.05,"Titta på PR-sträckan — ligger den still på baslinjen?");
  addScalar("pacerSpike",0.3,"Finns en spik strax före QRS?");
  addScalar("flutterRatio",0.5,"Titta på baslinjen mellan komplexen — sågtandad eller lugn?");
  addScalar("qrsOverride",0.3,"Jämför bröstavledningarnas polaritet med varandra.");
  addScalar("fibWave",0.3,"Är baslinjen helt lugn eller ojämn/kaotisk?");
  addScalar("torsades",0.3,"Vrider sig komplexens utseende slag för slag kring baslinjen?");
  addScalar("osborn",0.3,"Leta efter en liten extra knagg precis vid QRS-slutet.");
  if((targetPr.avBlock||null)!==(playerPr.avBlock||null)) c.push({score:2, text:"Jämför PR-tiden och om varje P-våg verkligen följs av en QRS."});
  addMap("st",0.05,leads=>`Jämför ST-sträckan i ${_fmtHintLeads(leads)} — höjd, sänkt eller normal?`);
  addMap("tInvMap",0.05,leads=>`Titta på T-vågens RIKTNING i ${_fmtHintLeads(leads)}.`);
  addMap("tAmpMap",0.05,leads=>`Jämför T-vågens HÖJD i ${_fmtHintLeads(leads)}.`);
  addMap("rAmpMap",0.05,leads=>`Jämför R-vågens storlek i ${_fmtHintLeads(leads)}.`);
  addMap("qAmpMap",0.05,leads=>`Leta efter onormalt djupa/breda Q-vågor i ${_fmtHintLeads(leads)}.`);
  addMap("rsrPrime",0.05,leads=>`Titta på QRS-formen i ${_fmtHintLeads(leads)} — enkel topp eller kluven?`);
  addMap("biphasicMap",0.05,leads=>`Är T-vågen i ${_fmtHintLeads(leads)} enkel, eller tvåfasig?`);
  c.sort((a,b)=>b.score-a.score);
  return c;
}
function getHintText(targetPr, playerPr, rank){
  const c=computeHintCandidates(targetPr, playerPr);
  if(!c.length) return "Du är väldigt nära — dubbelkolla alla tolv avledningar en gång till.";
  if(rank>=c.length) return "Inga fler tydliga skillnader att peka på — finjustera det du redan valt.";
  return c[rank].text;
}
