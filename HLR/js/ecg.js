const ECG_FRONTAL={I:0,II:60,III:120,aVR:-150,aVL:-30,aVF:90};
const ECG_RS={V1:[0,0.18,-1.05,0.12],V2:[0,0.35,-1.35,0.30],V3:[0,0.65,-0.95,0.35],
              V4:[0.03,1.05,-0.55,0.38],V5:[0.07,1.20,-0.28,0.34],V6:[0.08,1.00,-0.15,0.28]};
const ECG_ORDER=[["I","aVR","V1","V4"],["II","aVL","V2","V5"],["III","aVF","V3","V6"]];
const _g=(p,mu,sd,a)=>a*Math.exp(-((p-mu)*(p-mu))/(2*sd*sd));
const _rad=d=>d*Math.PI/180;

/* Per orsak: hjärtfrekvens, elaxel, och en morfologifunktion.
   st: ST-förskjutning per avledning (mV). Reciprocitet är inbyggd i värdena. */
function ecgProfile(){
  const id=S.cause?S.cause.id:"none";
  const base={hr:88,axis:60,st:null,qt:1.0,pWave:1,qrsWide:0,tScale:1,osborn:0,delta:0,irregular:0,sine:0,note:""};
  switch(id){
    case "stemi": return {...base,hr:96,
      st:{V1:0.20,V2:0.52,V3:0.58,V4:0.42,V5:0.16,V6:0.04,I:0.08,aVL:0.10,II:-0.11,III:-0.16,aVF:-0.13,aVR:-0.05},
      note:"ST-höjning V2–V4 med reciproka sänkningar inferiort"};
    case "hyperk": return {...base,hr:62,qrsWide:1.9,pWave:0.12,tScale:2.5,
      note:"Höga spetsiga T, breddökat QRS, utslätade P"};
    case "pe": return {...base,hr:124,axis:96,
      st:{III:0.06,V1:0.05,V2:-0.10,V3:-0.12,V4:-0.06},
      tInv:["V1","V2","V3","III"],note:"Sinustakykardi, S1Q3T3, T-negativitet V1–V3"};
    case "hypotermi": return {...base,hr:44,osborn:0.30,qt:1.35,
      note:"Bradykardi med Osborn-vågor (J-vågor)"};
    case "toxin": return {...base,hr:118,axis:-100,qrsWide:1.7,qt:1.30,
      note:"Breddökat QRS, förlängt QT, högerställd axel i aVR"};
    case "longqt": return {...base,hr:58,qt:1.85,tScale:1.3,
      note:"Uttalat förlängt QTc (>520 ms)"};
    case "hypok": return {...base,hr:64,qt:1.70,tScale:0.45,uWave:0.18,
      note:"Förlängt QT, utslätade T, tydliga U-vågor"};
    case "wpw": return {...base,hr:130,delta:1,irregular:0.22,
      st:{V5:-0.06,V6:-0.06,I:-0.05},note:"Kort PQ med deltavåg, oregelbunden takykardi"};
    case "digitalis": return {...base,hr:56,
      st:{V4:-0.10,V5:-0.14,V6:-0.14,II:-0.10},sag:1,qt:0.78,
      note:"Hängmatteformad ST-sänkning, förkortat QT"};
    case "tamponad": return {...base,hr:126,lowVolt:0.42,alternans:0.22,
      note:"Låg amplitud i samtliga avledningar, elektrisk alternans"};
    case "tension": return {...base,hr:130,axis:104,lowVolt:0.62,
      note:"Sinustakykardi, låg amplitud, högerställd axel"};
    case "hypoca": return {...base,hr:74,qt:1.55,
      note:"Förlängt QT på grund av förlängt ST-segment"};
    case "hypovol": return {...base,hr:132,lowVolt:0.78,note:"Sinustakykardi, i övrigt ospecifikt"};
    case "hypoxi": return {...base,hr:104,note:"Sinustakykardi, ospecifika ST-T-förändringar"};
    case "cico": return {...base,hr:108,note:"Sinustakykardi efter svår hypoxi, ospecifika ST-T-förändringar"};
    case "commotio": return {...base,hr:92,note:"Sinusrytm, ospecifika förändringar"};
    default: return {...base,note:"Sinusrytm med ospecifika ST-T-förändringar"};
  }
}

function ecgWaves(p,pr){
  const qw=1+(pr.qrsWide||0)*0.9;                 // breddar QRS
  const qt=pr.qt||1;
  return {
    P:_g(p,0.13,0.021,1)*(pr.pWave??1),
    Q:_g(p,0.238,0.006*qw,1),
    R:_g(p,0.262,0.010*qw,1),
    S:_g(p,0.290,0.008*qw,1),
    T:_g(p,0.30+0.20*qt,0.042*qt,1)*(pr.tScale??1),
    U:pr.uWave?_g(p,0.30+0.20*qt+0.11,0.028,1)*pr.uWave:0,
    J:pr.osborn?_g(p,0.305,0.008,1)*pr.osborn:0,
    D:pr.delta?_g(p,0.228,0.016,1):0               // deltavåg
  };
}
function ecgFrontalVec(p,pr){
  const w=ecgWaves(p,pr),ax=pr.axis;
  const c=[[0.18*w.P,ax-15],[0.13*w.Q,ax-155],[1.10*w.R,ax],[0.22*w.S,ax+155],[0.30*w.T,ax-8]];
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
    v=Pa*w.P - rs[0]*w.Q + rs[1]*w.R + rs[2]*w.S + rs[3]*w.T;
  }
  v+=w.U*0.5 + w.J*(lead in ECG_FRONTAL?1:0.7);
  if(pr.delta) v+=w.D*0.28;                        // slurrad uppgång
  // T-inversion i utvalda avledningar
  if(pr.tInv&&pr.tInv.indexOf(lead)>=0) v-=2*w.T*(lead in ECG_FRONTAL?0.30:ECG_RS[lead][3]);
  // ST-förskjutning
  if(pr.st&&pr.st[lead]){
    const e=pr.st[lead];
    if(p>=0.305&&p<=0.515){
      const seg=(p-0.305)/0.21;
      // sin(pi*seg) kan bli minimalt NEGATIV vid seg=1 (flyttalsfel) → Math.pow(neg,0.55)=NaN
      const arch=Math.max(0,Math.sin(Math.PI*seg));
      v+= pr.sag ? e*arch*(1-0.55*seg)                        // hängmatta
                 : e*Math.pow(arch,0.55);
    }
  }
  if(pr.lowVolt) v*=pr.lowVolt;
  if(pr.alternans) v*=(beatIdx%2?1-pr.alternans:1+pr.alternans);
  return v;
}

/* Ritar ett komplett 12-avlednings-EKG på canvas. */
function drawECG12(cv,pr){
  const g=cv.getContext("2d"),W=cv.width,H=cv.height;
  const MM=W/250;                                  // 250 mm papper på bredden
  g.fillStyle="#FFF6F4";g.fillRect(0,0,W,H);
  // rutnät: 1 mm fint, 5 mm grovt
  g.strokeStyle="#F7D2CE";g.lineWidth=0.5;g.beginPath();
  for(let x=0;x<=W;x+=MM){g.moveTo(x,0);g.lineTo(x,H);}
  for(let y=0;y<=H;y+=MM){g.moveTo(0,y);g.lineTo(W,y);}
  g.stroke();
  g.strokeStyle="#E08D86";g.lineWidth=0.9;g.beginPath();
  for(let x=0;x<=W;x+=MM*5){g.moveTo(x,0);g.lineTo(x,H);}
  for(let y=0;y<=H;y+=MM*5){g.moveTo(0,y);g.lineTo(W,y);}
  g.stroke();

  const rr=60/pr.hr, PXS=25*MM, PXMV=10*MM;        // 25 mm/s, 10 mm/mV
  const COLW=(W-14*MM)/4, SEC=(COLW-9*MM)/PXS;     // sekunder som ryms per ruta
  const rowY=[H*0.20,H*0.40,H*0.60];

  g.lineWidth=1.35;g.strokeStyle="#12181C";g.lineJoin="round";
  const drawLead=(lead,x0,y0,secs,px)=>{
    // kalibreringspuls: 10 mm hög, 5 mm bred
    g.beginPath();
    g.moveTo(x0-6*MM,y0);g.lineTo(x0-5*MM,y0);g.lineTo(x0-5*MM,y0-PXMV);
    g.lineTo(x0-2*MM,y0-PXMV);g.lineTo(x0-2*MM,y0);g.lineTo(x0,y0);
    g.stroke();
    // Slagtider: vid oregelbunden rytm (förmaksflimmer) varierar RR-intervallet
    // på riktigt, det räcker inte att förskjuta fasen.
    const beats=[]; let tb=0, k=0;
    while(tb<secs+rr){ beats.push(tb);
      const jit = pr.irregular ? 1 + pr.irregular*(2*(((k*0.6180339887)%1))-1) : 1;
      tb += rr*jit; k++; }
    const N=Math.round(secs*440);
    g.beginPath();
    for(let i=0;i<=N;i++){
      const t=i/440;
      let bi=0; while(bi+1<beats.length && beats[bi+1]<=t) bi++;
      const span=(beats[bi+1]??(beats[bi]+rr))-beats[bi];
      const p=(t-beats[bi])/span;
      const v=ecgSample(lead,p,pr,bi);
      const x=x0+t*px, y=y0-v*PXMV;
      i?g.lineTo(x,y):g.moveTo(x,y);
    }
    g.stroke();
    g.fillStyle="#12181C";g.font=`bold ${Math.round(3.6*MM)}px ui-monospace,monospace`;
    g.fillText(lead,x0+1*MM,y0-8.5*MM);
  };

  for(let r=0;r<3;r++)for(let c=0;c<4;c++){
    const x0=9*MM+c*COLW, y0=rowY[r];
    drawLead(ECG_ORDER[r][c],x0,y0,SEC,PXS);
    if(c) {g.strokeStyle="#C9A5A0";g.lineWidth=0.7;
      g.beginPath();g.moveTo(x0-7.5*MM,y0-9*MM);g.lineTo(x0-7.5*MM,y0+9*MM);g.stroke();
      g.strokeStyle="#12181C";g.lineWidth=1.35;}
  }
  // rytmremsa: avledning II över hela bredden
  drawLead("II",9*MM,H*0.845,(W-14*MM)/PXS,PXS);

  g.fillStyle="#5A4A48";g.font=`${Math.round(3.1*MM)}px ui-monospace,monospace`;
  g.fillText("25 mm/s    10 mm/mV    0,05–150 Hz",9*MM,H-2.2*MM);
  g.fillText(Math.round(pr.hr)+" slag/min",W-32*MM,H-2.2*MM);
}

/* ---------- 12-EKG-tolkning efter ROSC ---------- */
const EKG_FIND={
  stemi:"Kraftiga ST-höjningar i V2–V4 med reciproka ST-sänkningar inferiort. Begynnande Q-vågor anteriort.",
  hyperk:"Höga, spetsiga T-vågor, breddökat QRS och utslätade P-vågor. Ingen ST-höjning.",
  pe:"Sinustakykardi, S1Q3T3-mönster och T-negativitet i V1–V3. Högerkammarbelastning, ingen ST-höjning.",
  hypotermi:"Bradykardi med tydliga Osborn-vågor (J-vågor) i inferolaterala avledningar. Ingen ST-höjning.",
  toxin:"Breddökat QRS och förlängt QT. Högerställd axel i aVR. Ingen ST-höjning.",
  longqt:"Uttalat förlängt QTc (>520 ms). Sinusrytm, ingen ST-höjning.",
  wpw:"Kort PQ med deltavåg och sekundära ST-T-förändringar. Ingen äkta ST-höjning.",
  digitalis:"Hängmatteformad ST-sänkning, förkortat QT och AV-block I. Ingen ST-höjning.",
  tamponad:"Låg amplitud i samtliga avledningar och elektrisk alternans. Ingen ST-höjning.",
  tension:"Sinustakykardi med låg amplitud högersidigt och högerställd axel. Ingen ST-höjning."
};
function ekgFinding(){
  const pr=ecgProfile();
  return pr.note || EKG_FIND[S.cause.id] || "Sinusrytm med ospecifika ST-T-förändringar.";
}
function openEkgModal(){
  if(S.ended)return;
  if(!S.rosc&&!(DBG.on&&DBG.unlock))return;
  S.post.ekgRight=S.causes.some(c=>c.id==="stemi");
  if(typeof window!=="undefined"&&window.AUTO_EKG){ answerEkg(S.post.ekgRight?"stemi":"nostemi"); return; }
  S._speedBeforeRM=S.speed; S.speed=0; if(window.syncSpeed)window.syncSpeed();
  $("ekgModal").classList.remove("hidden");
  const pr=ecgProfile();
  drawECG12($("ekg12"),pr);
  $("ekTitle").textContent="12-avlednings-EKG";
  $("ekSub").textContent="Allt är pausat. Granska alla tolv avledningar och avgör om detta är en ST-höjningsinfarkt.";
  $("ekStage").innerHTML=
    `<div class="rm-q">Föreligger ST-höjningsinfarkt?</div>`+
    `<div class="rm-opts two" id="rmEkgOpts">`+
      `<button class="rm-opt" data-k="stemi">STEMI<small>Aktivera PCI-lab, direkt till angiografi</small></button>`+
      `<button class="rm-opt" data-k="nostemi">Ingen STEMI<small>Sök annan orsak, IVA-vård</small></button>`+
    `</div>`;
  document.querySelectorAll("#rmEkgOpts .rm-opt").forEach(b=>b.onclick=()=>answerEkg(b.dataset.k));
}
function answerEkg(pick){
  const correct = (S.post.ekgRight ?? S.causes.some(c=>c.id==="stemi")) ? "stemi" : "nostemi";
  const good = pick===correct;
  S.post.ekg=true; S.post.ekgCall=pick;
  const opts=document.querySelectorAll("#rmEkgOpts .rm-opt");
  opts.forEach(b=>{b.disabled=true;
    if(b.dataset.k===correct)b.classList.add("correct");
    else if(b.dataset.k===pick)b.classList.add("wrong");});
  const fb=document.createElement("div");
  fb.className="rm-feedback"+(good?"":" bad");
  const fynd=`<br><span style="opacity:.85">Fynd: ${ekgFinding()}</span>`;
  if(good && correct==="stemi"){ fb.innerHTML="<b>Rätt.</b> ST-höjningarna är signifikanta. Aktivera PCI-lab omgående, tid är myokard."+fynd; flag("Korrekt STEMI-tolkning på 12-EKG",+5); }
  else if(good){ fb.innerHTML="<b>Rätt.</b> Ingen ST-höjning. Orsaken ligger någon annanstans."+fynd; flag("Korrekt EKG-tolkning efter ROSC",+3); }
  else if(pick==="nostemi"){ fb.innerHTML="<b>Missad STEMI.</b> ST-höjningarna i V2–V4 med reciproka sänkningar inferiort är diagnostiska. Utan PCI fortsätter infarkten."+fynd; flag("Missad STEMI på 12-EKG efter ROSC",-8); }
  else { fb.innerHTML="<b>Överdiagnostik.</b> Det här är inte ST-höjningar. Att larma PCI-lab i onödan fördröjer rätt behandling."+fynd; flag("Feltolkat 12-EKG som STEMI",-4); }
  $("ekStage").appendChild(fb);
  const b=document.createElement("button");b.className="big";b.textContent="Fortsätt";
  b.onclick=()=>{ $("ekgModal").classList.add("hidden");
    S.speed=S._speedBeforeRM||1; if(window.syncSpeed)window.syncSpeed(); renderActions(true); };
  $("ekStage").appendChild(b);
}

/* ---------- Post-ROSC-fysiologi ---------- */
function tickPostROSC(dt){
  const p=S.post;
  if(p.rearrested)return;

  // Grundtakten gäller obehandlad orsak. Åtgärdad orsak halverar. Noradrenalin är det som
  // faktiskt lyfter trycket, men bara om orsaken är åtgärdad; annars bromsar det bara fallet.
  const treated = S.causeTreatedAt!==null;
  let r = p.decline * (treated ? 0.45 : 1);
  if(p.noradr) r = treated ? -2.2/60 : r*0.45;
  if(p.fluid)  r -= (treated?0.5:0.25)*p.fluid/60;   // volym hjälper, mest när orsaken är fixad
  if(p.dest==="pci" && S.causes.some(c=>c.id==="stemi")) r = Math.min(r, -3.0/60);
  if(S.causes.some(c=>c.id==="hypovol") && treated && p.fluid && p.noradr) r = Math.min(r, -3.4/60);   // volym återställd + pressor: trycket svarar snabbt

  p.sbt=clamp(p.sbt-r*dt, 24, p.noradr?128:112);
  const s=p.sbt;

  // Varningar
  if(s<75&&!p._w75){p._w75=true;log("Blodtrycket sjunker, systoliskt "+Math.round(s)+" mmHg. Åtgärda.","warn");}
  if(s<60&&!p.crashWarned){p.crashWarned=true;
    log("KRITISKT: systoliskt "+Math.round(s)+" mmHg. Patienten är på väg tillbaka i stopp.","bad");}
  if(s>=95&&p.crashWarned&&p.stableAt===null){p.stableAt=S.t;p.crashWarned=false;p._w75=false;
    log("Trycket är tillbaka över målet, cirkulationen stabiliseras.","ok");}

  // Under 50 mmHg för länge → nytt hjärtstopp
  if(s<52){ if(p.lowSince===null)p.lowSince=S.t;
    if(S.t-p.lowSince>12) reArrest();
  } else p.lowSince=null;
}
function reArrest(){
  const p=S.post;
  p.reArrests++; p.rearrested=true; p.lowSince=null; p.crashWarned=false; p._w75=false;
  S.rosc=false; S.perfusing=false; S.roscAt=null;
  S.comp=false; S.charged=false; S.charging=false;
  S.recoverAt=null; S.refibArmed=false; S.roscRecognizeAt=null;
  // Ny chans till ROSC, men fönstret krymper för varje stopp, och tar det slut dör patienten.
  p.deadline = S.t + Math.max(150, 300 - 60*p.reArrests);
  // Rytmen vid re-arrest: kardiella orsaker flimrar, övriga går i PEA/asystoli
  const c=S.cause.id;
  S.rhythm = (c==="stemi"||c==="wpw"||c==="longqt"||c==="commotio"||c==="digitalis"||c==="hypok")
    ? "VF" : (p.reArrests>=2 ? "asystoli" : "PEA");
  mark("Re-arrest","rearrest");
  flag("Patienten gick om i hjärtstopp efter ROSC",-8);
  log("⚠ NYTT HJÄRTSTOPP, patienten förlorar pulsen igen. Rytm: "+S.rhythm+". Återuppta HLR omedelbart.","bad");
  if(p.reArrests>=3){ log("Tredje stoppet. Myokardiet orkar inte mer.","bad"); postDeath("rearrest3"); return; }
  log("Post-ROSC-fasen är avbruten. Du måste få tillbaka ROSC, och den här gången åtgärda det som fick trycket att falla.","sys");
  S.unlockedTabs&&S.unlockedTabs.add("hlr");
  setTab("hlr"); renderActions(true); buildTabs&&buildTabs();
}
function tickReArrest(dt){
  const p=S.post;
  if(S.rosc){ p.rearrested=false; return; }
  if(p.deadline==null)return;
  const left=p.deadline-S.t;
  if(left<=0){ postDeath("rearrest_timeout"); return; }
  if(left<60&&!p._d60){p._d60=true;log("Myokardiet håller på att ge upp, mindre än en minut av meningsfull chans kvar.","bad");}
  else if(left<120&&!p._d120){p._d120=true;log("Tiden rinner ut. Utan ROSC snart går patienten inte att rädda.","warn");}
}
function postDeath(reason){
  S.rosc=false;S.perfusing=false;S.rhythm="asystoli";S.comp=false;
  mark("Dödsfall","death"); S.deaths++;
  log("Patienten avlider. Ingen cirkulation går att återställa.","bad");
  endScenario(reason||"death");
}

/* ---------- Hjälpfunktioner sim ---------- */
function recentAdrenalin(){return S.adrenalin.length&&(S.t-S.adrenalin[S.adrenalin.length-1])<240;}
function hypotermiVarm(){return S.warming&&(S.t-S.warming)>75;}
function qualityAvg(){ if(!S.qWindow.length)return 0;
  return S.qWindow.reduce((a,b)=>a+b,0)/S.qWindow.length; }

/* ---------- Guidad genomgång ---------- */
