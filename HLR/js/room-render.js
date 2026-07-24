function currentWaveSpec(){
  const r=S.rhythm;
  if(r==="VF") return S.fineVF?WAVE_SPECS.VF_fine:WAVE_SPECS.VF;
  if(r==="pVT"){
    if(S.cause.polymorf) return WAVE_SPECS.torsades;
    if(S.cause.id==="digitalis") return WAVE_SPECS.bidirVT;
    return WAVE_SPECS.pVT_mono;
  }
  if(r==="asystoli") return WAVE_SPECS.asystoli;
  if(S.rosc) return WAVE_SPECS.rosc;
  if(r==="organiserad") return WAVE_SPECS.organiserad;
  // PEA-varianter
  const pt=S.causeTreatedAt?null:(S.cause.peaType||null);
  const wide=S.cause.bredQRS&&!S.causeTreatedAt&&!S.rosc;
  if(pt==="sine"&&!S.rosc) return WAVE_SPECS.pea_sine;
  if(pt==="idio"&&!S.rosc) return WAVE_SPECS.pea_idio;
  if(pt==="brady"&&!S.rosc) return WAVE_SPECS.pea_brady;
  if(pt==="narrowfast") return WAVE_SPECS.pea_narrowfast;
  if(wide) return WAVE_SPECS.pea_wide;
  return WAVE_SPECS.pea_narrow;
}
function miniSig(tt){
  return _rhythmSample(currentWaveSpec(), tt);
}
function miniTrace(g,x,y,w,h,col){
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  g.strokeStyle=col;g.lineWidth=1.2;g.beginPath();
  for(let i=0;i<=w;i+=2){
    const v=miniSig(S.t-(w-i)*0.02);
    const yy=y+h*0.55-v*h*0.38;
    i===0?g.moveTo(x+i,yy):g.lineTo(x+i,yy);
  }
  g.stroke();g.restore();
}
function limb(g,x1,y1,x2,y2,w,col){
  g.strokeStyle=col;g.lineWidth=w;g.lineCap="round";
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
}
function shadow(g,x,y,rx,ry){
  g.fillStyle="rgba(28,27,27,0.08)";g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fill();
}
function staffHead(g,x,y,skin,hair){
  g.fillStyle=skin;g.beginPath();g.arc(x,y,12.5,0,7);g.fill();     // ansiktskant (större)
  g.fillStyle=hair;g.beginPath();g.arc(x,y,11,0,7);g.fill();       // hår (uppifrån)
  g.fillStyle="rgba(255,255,255,.22)";                              // hjässglans
  g.beginPath();g.ellipse(x-2.5,y-2.5,5,3,-0.6,0,7);g.fill();
}
// Kort, framåtböjd arm (axel → armbåge → hand), ger lutande hållning
function benderArm(g,ax,ay,hx,hy,w,col,bend){
  const mx=(ax+hx)/2, my=(ay+hy)/2;
  const dx=hx-ax, dy=hy-ay, L=Math.hypot(dx,dy)||1;
  const px=-dy/L, py=dx/L;
  const ex=mx+px*(bend||4), ey=my+py*(bend||4);
  g.strokeStyle=col;g.lineWidth=w;g.lineCap="round";g.lineJoin="round";
  g.beginPath();g.moveTo(ax,ay);g.quadraticCurveTo(ex,ey,hx,hy);g.stroke();
}
let ROOMLABELS=[];
function labelUnder(g,x,y,txt){ ROOMLABELS.push({x,y,txt}); }
// Rita alla rumsetiketter sist, med kollisionsundvikande (ingen text överlappar)
function drawRoomLabels(g){
  g.font="8.5px 'IBM Plex Mono'";
  const LH=10, PAD=3, W=560, Hc=330;
  const placed=[];
  const collides=(x1,y1,x2,y2)=>placed.some(p=>!(x2<p.x1-PAD||p.x2+PAD<x1||y2<p.y1-PAD||p.y2+PAD<y1));
  // stabil ordning: uppifrån och ned
  ROOMLABELS.sort((a,b)=>a.y-b.y||a.x-b.x);
  for(const l of ROOMLABELS){
    const mw=(g.measureText?g.measureText(l.txt).width:NaN);
    const w=(isFinite(mw)&&mw>0)?mw:l.txt.length*5.1, hw=w/2;
    let y=clamp(l.y,10,Hc-3), x=clamp(l.x,hw+2,W-hw-2);
    // sicksack: original, +1 rad, -1 rad, +2, -2 … tills fri plats
    for(let k=0;k<26;k++){
      const cand=l.y + (k===0?0:(k%2? Math.ceil(k/2):-Math.ceil(k/2))*(LH+PAD));
      const yy=clamp(cand,10,Hc-3);
      if(!collides(x-hw,yy-8,x+hw,yy+2)){ y=yy; break; }
    }
    placed.push({x1:x-hw,y1:y-8,x2:x+hw,y2:y+2,x,y,txt:l.txt});
    // svag läsplatta + text
    g.fillStyle="rgba(239,235,233,.78)";
    g.fillRect(x-hw-1,y-8,w+2,10);
    g.fillStyle="#5B5B5B";g.textAlign="center";g.fillText(l.txt,x,y);
  }
  g.textAlign="left";
  ROOMLABELS=[];
  if(typeof window!=="undefined")window._labelBoxes=placed;
}

function drawRoom(){
  if(roomView==="sprite"){ drawRoomSprite(); return; }
  drawRoomClassic();
}
function drawRoomClassic(){
  const g=roomC,W=560,H=330;
  g.clearRect(0,0,W,H);
  /* ---- golv ---- */
  g.fillStyle="#EFEBE9";g.fillRect(0,0,W,H);
  g.strokeStyle="#E4DFDC";g.lineWidth=1;
  for(let x=20;x<W;x+=45){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
  for(let y=15;y<H;y+=45){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  /* ---- väggar ---- */
  g.strokeStyle="#CFC9C6";g.lineWidth=8;g.strokeRect(4,4,W-8,H-8);
  /* dörr vänster */
  g.strokeStyle="#EFEBE9";g.lineWidth=10;g.beginPath();g.moveTo(4,225);g.lineTo(4,295);g.stroke();
  g.strokeStyle="#B9B2AE";g.lineWidth=3;g.beginPath();g.moveTo(6,225);g.lineTo(62,250);g.stroke();
  g.strokeStyle="#D8D2CE";g.lineWidth=1;g.setLineDash([3,4]);
  g.beginPath();g.arc(6,225,62,0,Math.PI*0.42);g.stroke();g.setLineDash([]);
  labelUnder(g,34,312,"DÖRR");

  /* ---- väggmonitor (topp, mitt) ---- */
  g.fillStyle="#B9B2AE";g.fillRect(272,8,6,14);
  g.fillStyle="#3A3F42";g.beginPath();g.roundRect(216,16,118,46,4);g.fill();
  g.fillStyle="#141A17";g.fillRect(221,20,86,38);
  if(S.pads){ miniTrace(g,221,20,86,38,"#35E08E");
    g.fillStyle="#35E08E";g.font="10px 'IBM Plex Mono'";
    g.fillText(S.rosc?"96":(S.rhythm==="PEA"||S.rhythm==="organiserad")?"55":"--",311,34);
    g.fillStyle="#F2A93B";g.fillText($("vCO2").textContent,311,52);
  } else {g.fillStyle="#5b6f66";g.font="9px 'IBM Plex Mono'";g.fillText("-- ej kopplad --",236,42);}

  /* ---- gasuttag på väggen (vid huvudändan) ---- */
  g.fillStyle="#F7F5F4";g.strokeStyle="#CFC9C6";g.lineWidth=1.5;
  g.beginPath();g.roundRect(96,10,52,20,3);g.fill();g.stroke();
  g.fillStyle="#2E7D32";g.beginPath();g.arc(110,20,5,0,7);g.fill();
  g.fillStyle="#7C8790";g.beginPath();g.arc(134,20,5,0,7);g.fill();
  labelUnder(g,122,40,"O₂ · AIR");

  /* ---- geometri säng/patient ---- */
  const bx=176,by=104,bw=232,bh=112,cy=by+bh/2;
  const P=S.patient, female=P.sex==="kvinna";
  const heave=S.comp?Math.sin(compPhase)*1.4:0;

  /* ---- syrgas: slang eller undanflyttad tub ---- */
  if(S.o2max&&!S.o2Safe){
    g.strokeStyle="#57A05B";g.lineWidth=2;
    g.beginPath();g.moveTo(110,26);g.bezierCurveTo(90,70,120,110,bx+6,cy-14);g.stroke();
  }
  if(S.o2Safe){
    g.fillStyle="#DDE8DD";g.strokeStyle="#8FB491";g.lineWidth=1.5;
    g.beginPath();g.roundRect(30,120,16,40,5);g.fill();g.stroke();
    g.fillStyle="#2E7D32";g.fillRect(34,114,8,7);
    labelUnder(g,38,175,"O₂ >1m");
  }

  /* ---- brits ---- */
  shadow(g,bx+bw/2,by+bh+12,bw/2+8,10);
  g.fillStyle="#B9B2AE";
  [[bx-8,by-8],[bx+bw-6,by-8],[bx-8,by+bh-4],[bx+bw-6,by+bh-4]].forEach(([wx,wy])=>{
    g.beginPath();g.arc(wx+7,wy+6,6,0,7);g.fill();});
  g.fillStyle="#D8D2CE";g.beginPath();g.roundRect(bx-10,by-10,bw+20,bh+20,10);g.fill();
  g.strokeStyle="#B9B2AE";g.lineWidth=2;g.stroke();
  g.fillStyle="#FFFFFF";g.beginPath();g.roundRect(bx-2,by-2,bw+4,bh+4,7);g.fill();
  g.strokeStyle="#E7E4E3";g.stroke();
  /* sänggrindar */
  g.strokeStyle="#B9B2AE";g.lineWidth=3;
  g.beginPath();g.moveTo(bx+70,by-7);g.lineTo(bx+bw-16,by-7);g.stroke();
  g.beginPath();g.moveTo(bx+70,by+bh+7);g.lineTo(bx+bw-16,by+bh+7);g.stroke();
  /* kudde */
  g.fillStyle="#F1EFEE";g.beginPath();g.roundRect(bx+4,cy-26,44,52,10);g.fill();
  g.strokeStyle="#E0DCDA";g.stroke();

  /* geometri som personalkoden behöver även när britsen är tom */
  const hx=bx+30, fx=hx+2, toW=female?19:22, blX=bx+126;

  /* ---- patienten är inte inne än: tom brits ---- */
  if(!S.patientPresent){
    g.save();
    g.fillStyle="#8E8880";g.font="bold 9px 'IBM Plex Mono'";g.textAlign="center";
    g.fillText("PATIENT PÅ VÄG IN",bx+bw/2,cy+3);
    g.font="8px 'IBM Plex Mono'";g.fillStyle="#A9A29A";
    g.fillText("00:"+String(Math.ceil(S.arrivalIn||0)).padStart(2,"0"),bx+bw/2,cy+16);
    g.restore();
  } else {

  /* ---- ryggplatta vid LUCAS ---- */
  if(S.lucas){g.fillStyle="#F2D06B";g.beginPath();g.roundRect(bx+58,cy-34,70,68,6);g.fill();
    g.strokeStyle="#D9B23F";g.lineWidth=1.5;g.stroke();}

  /* ---- filt över ben ---- */
  g.fillStyle="#EAF0F5";g.beginPath();g.roundRect(blX,by+8,bw-(blX-bx)-8,bh-16,9);g.fill();
  g.strokeStyle="#CFDBE4";g.lineWidth=1.5;g.stroke();
  g.strokeStyle="#DCE6ED";
  for(const off of [18,40,62]){g.beginPath();g.moveTo(blX+off,by+11);g.lineTo(blX+off+8,by+bh-11);g.stroke();}
  /* fötter under filt */
  g.fillStyle="rgba(180,195,208,.5)";
  g.beginPath();g.ellipse(bx+bw-22,cy-13,9,7,0,0,7);g.fill();
  g.beginPath();g.ellipse(bx+bw-22,cy+13,9,7,0,0,7);g.fill();

  /* ---- patientkropp ---- */
  g.fillStyle=P.skin;
  /* armar (mjukt böjda utåt) */
  g.lineJoin="round";
  limb(g,bx+66,cy-(toW-4),blX-2,cy-(toW+6),10,P.skin);
  limb(g,bx+66,cy+(toW-4),blX-2,cy+(toW+6),10,P.skin);
  g.beginPath();g.arc(blX+2,cy-(toW+6),6,0,7);g.fill();   /* hand upp */
  g.beginPath();g.arc(blX+2,cy+(toW+6),6,0,7);g.fill();   /* hand ned (PVK) */
  /* hals */
  g.fillStyle=P.skin;g.beginPath();g.roundRect(bx+40,cy-8,20,16,6);g.fill();
  /* bål: axlar -> midja -> höft, som en sammansatt kropp */
  g.beginPath();
  g.moveTo(bx+58,cy-(toW-2));
  g.quadraticCurveTo(bx+74,cy-(toW+3+heave),bx+96,cy-(toW-4+heave));   /* övre bröst */
  g.quadraticCurveTo(bx+120,cy-(toW-8),bx+130,cy-(female?16:19));      /* midja upp */
  g.lineTo(bx+130,cy+(female?18:19));                                   /* höft */
  g.quadraticCurveTo(bx+120,cy+(toW-8),bx+96,cy+(toW-4+heave));         /* nedre buk */
  g.quadraticCurveTo(bx+74,cy+(toW+3+heave),bx+58,cy+(toW-2));
  g.quadraticCurveTo(bx+46,cy,bx+58,cy-(toW-2));                        /* axelrundning */
  g.closePath();g.fill();
  /* skuldermjukhet */
  g.beginPath();g.ellipse(bx+64,cy,15,toW-3,0,0,7);g.fill();
  /* höftbredd för kvinna */
  if(female){g.beginPath();g.ellipse(bx+120,cy,18,20,0,0,7);g.fill();}
  /* diskret bröstskugga / bröstkorgslinje */
  if(female){
    g.fillStyle="rgba(28,27,27,.06)";
    g.beginPath();g.ellipse(bx+82,cy-12,9,7,-0.2,0,7);g.fill();
    g.beginPath();g.ellipse(bx+82,cy+12,9,7,0.2,0,7);g.fill();
  } else {
    g.strokeStyle="rgba(28,27,27,.06)";g.lineWidth=1.5;
    g.beginPath();g.moveTo(bx+70,cy);g.lineTo(bx+118,cy);g.stroke();
    g.beginPath();g.ellipse(bx+92,cy,26,toW-4,0,-0.9,0.9);g.stroke(); /* revbensantydan */
  }
  /* EKG-elektroder */
  if(S.pads){g.fillStyle="#fff";g.strokeStyle="#C9C4C1";g.lineWidth=1;
    [[bx+72,cy-15],[bx+72,cy+15],[bx+108,cy+17]].forEach(([ex,ey])=>{
      g.beginPath();g.arc(ex,ey,3,0,7);g.fill();g.stroke();});}

  /* ---- huvud & ansikte ---- */
  if(female){ /* utslaget hår på kudden */
    g.fillStyle=P.hair;
    g.beginPath();g.ellipse(hx-5,cy,16,18,0,0,7);g.fill();
    g.beginPath();g.ellipse(hx-2,cy-13,8,5,-0.5,0,7);g.fill();
    g.beginPath();g.ellipse(hx-2,cy+13,8,5,0.5,0,7);g.fill();
  } else {
    g.fillStyle=P.hair;g.beginPath();g.arc(hx-3,cy,11.5,0,7);g.fill();
  }
  g.fillStyle=P.skin;g.beginPath();g.arc(fx,cy,10,0,7);g.fill();
  /* öron */
  g.beginPath();g.arc(fx,cy-10,2.4,0,7);g.fill();
  g.beginPath();g.arc(fx,cy+10,2.4,0,7);g.fill();
  /* slutna ögon */
  g.strokeStyle="#5a4a3c";g.lineWidth=1.4;g.lineCap="round";
  g.beginPath();g.moveTo(fx+2,cy-7);g.quadraticCurveTo(fx+5,cy-5.5,fx+2,cy-4);g.stroke();
  g.beginPath();g.moveTo(fx+2,cy+7);g.quadraticCurveTo(fx+5,cy+5.5,fx+2,cy+4);g.stroke();
  /* näsa + mun (cyanotisk före ROSC) */
  g.strokeStyle=P.skin;g.lineWidth=2;
  g.beginPath();g.moveTo(fx+7,cy-1);g.lineTo(fx+8,cy+1);g.stroke();
  g.strokeStyle=S.rosc?"#C77B6E":"#7D93B8";g.lineWidth=2;
  g.beginPath();g.moveTo(fx+11,cy-2.5);g.lineTo(fx+11,cy+2.5);g.stroke();

  }

  /* ---- luftväg ---- */
  if(S.airway==="mask"){
    g.fillStyle="rgba(130,190,200,.5)";g.strokeStyle="#6FA8B2";g.lineWidth=1.3;
    g.beginPath();g.ellipse(fx+8,cy,7,10,0,0,7);g.fill();g.stroke();
  } else if(S.airway==="igel"){
    g.fillStyle="#F2C233";g.beginPath();g.roundRect(fx+10,cy-3,13,6,3);g.fill();
    g.strokeStyle="#D9A410";g.lineWidth=1;g.stroke();
  } else if(S.airway==="tub"){
    g.strokeStyle="#FFFFFF";g.lineWidth=4;g.beginPath();g.moveTo(fx+11,cy);g.lineTo(fx+30,cy);g.stroke();
    g.strokeStyle="#B9B2AE";g.lineWidth=1;g.beginPath();g.moveTo(fx+11,cy);g.lineTo(fx+30,cy);g.stroke();
    /* tubhållare */
    g.strokeStyle="#63C7EE";g.lineWidth=2.5;
    g.beginPath();g.moveTo(fx+9,cy-12);g.lineTo(fx+9,cy+12);g.stroke();
    if(S.capno){g.fillStyle="#F2A93B";g.fillRect(fx+26,cy-4,7,8);
      g.strokeStyle="#C9871B";g.lineWidth=1;g.strokeRect(fx+26,cy-4,7,8);}
  }

  /* ---- defibrilleringsplattor + kablar ---- */
  const defX=452,defY=58;
  if(S.pads){
    g.strokeStyle="#9c9693";g.lineWidth=1.6;
    g.beginPath();g.moveTo(defX,defY+22);g.bezierCurveTo(430,150,380,90,bx+92,cy-8);g.stroke();
    g.fillStyle="#F2A93B";g.strokeStyle="#C9871B";g.lineWidth=1.2;
    if(S.padPos==="AL"){
      g.save();g.translate(bx+72,cy-15);g.rotate(-0.45);
      g.beginPath();g.roundRect(-9,-6,18,12,4);g.fill();g.stroke();g.restore();
      g.save();g.translate(bx+110,cy+18);g.rotate(0.45);
      g.beginPath();g.roundRect(-9,-6,18,12,4);g.fill();g.stroke();g.restore();
    } else {
      g.save();g.translate(bx+86,cy-2);
      g.beginPath();g.roundRect(-9,-6,18,12,4);g.fill();g.stroke();g.restore();
      g.setLineDash([3,3]);g.strokeStyle="#C9871B";
      g.beginPath();g.roundRect(bx+94,cy+6,18,12);g.stroke();g.setLineDash([]);
      g.fillStyle="#B25A00";g.font="8px 'IBM Plex Mono'";g.fillText("AP",bx+114,cy+24);
    }
  }

  /* ---- LUCAS ---- */
  if(S.lucas){
    const sx=bx+92;
    g.fillStyle="#FFFFFF";g.strokeStyle="#B9B2AE";g.lineWidth=1.5;
    g.beginPath();g.roundRect(sx-7,cy-40,14,80,5);g.fill();g.stroke();   /* båge */
    g.fillStyle="#F2D06B";g.strokeStyle="#D9B23F";
    g.beginPath();g.roundRect(sx-12,cy-44,24,10,3);g.fill();g.stroke();  /* klämfäste */
    g.beginPath();g.roundRect(sx-12,cy+34,24,10,3);g.fill();g.stroke();
    const press=S.comp?(Math.sin(compPhase)+1)/2:0;
    g.fillStyle="#3E3B39";g.beginPath();g.arc(sx,cy,9-press*2,0,7);g.fill(); /* kolv */
    g.strokeStyle="#3E3B39";g.lineWidth=1.5;g.beginPath();g.arc(sx,cy,12,0,7);g.stroke(); /* sugkopp */
    g.fillStyle="#1C1B1B";g.font="bold 7px 'IBM Plex Mono'";g.fillText("LUCAS",sx-11,cy-31);
  }

  /* ---- IV/IO-infart + droppställning ---- */
  if(S.access){
    const handX=blX+2,handY=cy+(toW+6);
    g.fillStyle="#FFFFFF";g.strokeStyle="#C9C4C1";g.lineWidth=1;
    g.save();g.translate(handX-6,handY+1);g.rotate(0.25);g.fillRect(-4,-3,10,6);g.strokeRect(-4,-3,10,6);g.restore();
    g.fillStyle=S.access==="iv"?"#63C7EE":"#C77B6E";
    g.beginPath();g.arc(handX-6,handY+1,2,0,7);g.fill();
    /* slang till droppställning (ovanför sängen) */
    const poleX=bx+bw-6,poleY=54;
    g.strokeStyle="#9CC8DE";g.lineWidth=1.6;
    g.beginPath();g.moveTo(handX-6,handY+1);g.bezierCurveTo(bx+bw,cy+20,poleX+14,120,poleX,poleY+30);g.stroke();
    shadow(g,poleX,by-8,14,4);
    g.strokeStyle="#8f8a87";g.lineWidth=2.5;
    g.beginPath();g.moveTo(poleX,poleY);g.lineTo(poleX,by-10);g.stroke();
    g.beginPath();g.moveTo(poleX-11,by-10);g.lineTo(poleX+11,by-10);g.stroke();
    g.fillStyle="#D6ECF7";g.strokeStyle="#63C7EE";g.lineWidth=1.2;
    g.beginPath();g.roundRect(poleX-7,poleY-2,14,26,3);g.fill();g.stroke();
    labelUnder(g,poleX,poleY-6,S.access.toUpperCase());
  }

  /* ---- KOMPRESSÖR (person) ---- */
  if(!S.lucas){
    const sx=bx+92;
    const press=S.comp?Math.max(0,Math.sin(compPhase))*3:0;
    const py0=by-16+(S.comp?press*0.5:6);       // står nära patienten och lutar sig fram
    shadow(g,sx,py0+18,22,7);
    g.fillStyle=S.comp?"#5B7C99":"#8FA3B5";
    g.beginPath();g.ellipse(sx,py0,19,12,0,0,7);g.fill();          // bål (lutad framåt)
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1;g.stroke();
    if(S.comp){
      /* korta, framåtböjda armar rakt ned mot sternum */
      benderArm(g,sx-11,py0+6,sx-3,cy-toW+9+press,7.5,"#EBC8A4",-4);
      benderArm(g,sx+11,py0+6,sx+3,cy-toW+9+press,7.5,"#EBC8A4",4);
      g.fillStyle="#EBC8A4";
      g.beginPath();g.ellipse(sx,cy-toW+12+press,8,6,0,0,7);g.fill();
      g.beginPath();g.ellipse(sx,cy-toW+9+press,7,4.5,0,0,7);g.fill();
    } else {
      benderArm(g,sx-11,py0+6,sx-14,py0+20,7.5,"#EBC8A4",-2);
      benderArm(g,sx+11,py0+6,sx+14,py0+20,7.5,"#EBC8A4",2);
    }
    staffHead(g,sx,py0+6,"#EBC8A4","#3B332C");                     // huvud framåt över patienten
    // Etiketten följer den som faktiskt håller händerna på bröstet
    const cr=compressor();
    labelUnder(g,sx,py0-18,(cr?COMP_LABEL[cr]:"KOMPRESSÖR")+(S.comp?" · HLR":""));
  } else {
    /* personen står i beredskap vid väggen (LUCAS sköter tryck) */
    shadow(g,120,90,22,7);
    g.fillStyle="#8FA3B5";g.beginPath();g.ellipse(120,82,19,13,0,0,7);g.fill();
    staffHead(g,120,82,"#EBC8A4","#3B332C");
    labelUnder(g,120,106,"FRIGJORD AV LUCAS");
  }

  /* ---- LUFTVÄGSPERSON (undersköterska el. narkosläkare) ---- */
  {
    const vx=bx-28;
    const airwayTask=S.queues.narkos[0]||S.queues.ambulans[0];
    const isNarkos=available("narkos");
    shadow(g,vx,cy+16,18,7);
    const target=S.airway==="tub"?{x:fx+26,y:cy}:{x:fx+6,y:cy};
    g.fillStyle=(airwayTask||S.vent)?"#4E8F87":"#86ABA6";
    g.beginPath();g.ellipse(vx,cy,13,16,0,0,7);g.fill();          // bål (lutad framåt)
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1;g.stroke();
    if(airwayTask){
      /* korta, framåtlutade armar vid patientens huvud + instrument */
      benderArm(g,vx+8,cy-9,fx-5,cy-6,7,"#DFB289",-3);
      benderArm(g,vx+8,cy+9,fx-5,cy+6,7,"#DFB289",3);
      const blink=Math.sin(S.t*8)>0;
      g.strokeStyle=blink?"#63C7EE":"#8fbfd4";g.lineWidth=3;
      g.beginPath();g.moveTo(fx-2,cy-8);g.lineTo(fx+12,cy);g.stroke();
      g.fillStyle="#2C3033";g.beginPath();g.arc(fx+12,cy,3,0,7);g.fill();
    } else if(S.vent||S.airway!=="ingen"){
      benderArm(g,vx+9,cy-10,target.x-8,target.y-6,7,"#DFB289",-3);
      benderArm(g,vx+9,cy+10,target.x-8,target.y+6,7,"#DFB289",3);
      const sq=S.vent?1-0.22*Math.max(0,Math.sin(compPhase/5)):1;
      g.fillStyle="#BFE3F2";g.strokeStyle="#63C7EE";g.lineWidth=1.2;
      g.beginPath();g.ellipse(vx+18,cy-19,8*sq,11*sq,0.3,0,7);g.fill();g.stroke();
      g.strokeStyle="#8fbfd4";g.beginPath();g.moveTo(vx+21,cy-11);g.lineTo(target.x,target.y-3);g.stroke();
    } else {
      benderArm(g,vx+8,cy-10,vx+4,cy-23,7,"#DFB289",-2);
      benderArm(g,vx+8,cy+10,vx+4,cy+23,7,"#DFB289",2);
    }
    staffHead(g,vx+5,cy,"#DFB289",isNarkos?"#2E3A46":"#B5563F");   // huvud lutat mot patienten
    const nm=isNarkos?"NARKOS (LUFTVÄG)":"AMBULANS (LUFTVÄG)";
    labelUnder(g,vx,cy+32,airwayTask?nm+" •":nm);
  }

  /* ---- LÄKARE = DU ---- */
  {
    const dx=bx+bw-30,dy=by+bh+40;
    shadow(g,dx,dy+16,22,7);
    g.fillStyle="#FFFFFF";g.strokeStyle="#C9C4C1";g.lineWidth=1.5;
    g.beginPath();g.ellipse(dx,dy,21,14,0,0,7);g.fill();g.stroke();   // större rock
    // korta armar mot patienten (lutad)
    benderArm(g,dx-8,dy-8,dx-4,dy-20,6.5,"#BE8757",-3);
    benderArm(g,dx+8,dy-8,dx+4,dy-20,6.5,"#BE8757",3);
    g.strokeStyle="#B25A00";g.lineWidth=1.8; /* stetoskop */
    g.beginPath();g.arc(dx,dy+2,8,Math.PI*0.15,Math.PI*0.85);g.stroke();
    staffHead(g,dx,dy-6,"#BE8757","#1C1B1B");
    g.fillStyle="#FFF";g.strokeStyle="#B9B2AE";g.lineWidth=1;
    g.fillRect(dx+18,dy-6,12,16);g.strokeRect(dx+18,dy-6,12,16);
    g.strokeStyle="#D8D2CE";
    for(let i=0;i<3;i++){g.beginPath();g.moveTo(dx+20,dy-2+i*4);g.lineTo(dx+28,dy-2+i*4);g.stroke();}
    labelUnder(g,dx,dy+32,"LÄKARE (DU)");
  }

  /* ---- SJUKSKÖTERSKA ---- */
  {
    const isBusy=roleBusy("ssk");
    const nx=isBusy?bx+bw-2:474, ny=isBusy?by-32:250;
    shadow(g,nx,ny+16,20,7);
    g.fillStyle=isBusy?"#6A4E8A":"#8E76A8";g.beginPath();g.ellipse(nx,ny,18,13,0,0,7);g.fill();
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1;g.stroke();
    if(isBusy){ /* framåtlutad med spruta */
      benderArm(g,nx-9,ny+6,nx-17,ny+20,6,"#EBC8A4",-2);
      g.fillStyle="#FFF";g.strokeStyle="#8f8a87";g.lineWidth=1;
      g.save();g.translate(nx-19,ny+22);g.rotate(0.7);g.fillRect(0,-2,14,4);g.strokeRect(0,-2,14,4);
      g.beginPath();g.moveTo(14,0);g.lineTo(19,0);g.stroke();g.restore();
    }
    staffHead(g,nx,ny+(isBusy?5:0),"#DFB289","#8B6B4A");
    labelUnder(g,nx,ny+30,isBusy?"SSK •":"SJUKSKÖTERSKA");
  }

  /* ---- Narkos-ssk (förstärkning efter 4 min) ---- */
  if(S.teamArrived){
    const isBusy=roleBusy("ivassk");
    const nx=isBusy?bx+bw-24:512, ny=isBusy?by+bh+8:196;
    shadow(g,nx,ny+16,20,7);
    g.fillStyle=isBusy?"#4E7A6A":"#6FA090";g.beginPath();g.ellipse(nx,ny,18,13,0,0,7);g.fill();
    g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=1;g.stroke();
    if(isBusy){ benderArm(g,nx-9,ny+6,nx-16,ny+19,6,"#DFB289",-2); }
    staffHead(g,nx,ny+(isBusy?5:0),"#DFB289","#54402E");
    labelUnder(g,nx,ny+30,isBusy?"NARKOS-SSK •":"NARKOS-SSK");
  }

  /* ---- defibrillator på vagn ---- */
  shadow(g,defX+40,100,46,7);
  g.fillStyle="#D8D2CE";g.beginPath();g.roundRect(defX-14,defY-34,108,72,6);g.fill();
  g.strokeStyle="#B9B2AE";g.lineWidth=1.5;g.stroke();
  g.fillStyle="#F7F5F4";g.beginPath();g.roundRect(defX-8,defY-28,96,58,5);g.fill();
  g.strokeStyle="#C9C4C1";g.stroke();
  g.fillStyle="#101512";g.fillRect(defX-2,defY-22,58,32);
  if(S.pads)miniTrace(g,defX-2,defY-22,58,32,"#35E08E");
  else {g.fillStyle="#3a4a42";g.font="8px 'IBM Plex Mono'";g.fillText("PLATTOR?",defX+6,defY-4);}
  /* energiratt + laddindikator */
  g.fillStyle="#E7E4E3";g.beginPath();g.arc(defX+72,defY-8,9,0,7);g.fill();
  g.strokeStyle="#8f8a87";g.lineWidth=2;g.beginPath();g.moveTo(defX+72,defY-8);g.lineTo(defX+78,defY-14);g.stroke();
  g.fillStyle=S.charged?"#F44336":"#C9C4C1";
  g.beginPath();g.arc(defX+72,defY+12,5,0,7);g.fill();
  if(S.charged){g.fillStyle="#C5362B";g.font="bold 8px 'IBM Plex Mono'";
    g.fillText((S.shocks===0?"200J":"360J")+" KLAR",defX-2,defY+22);}
  labelUnder(g,defX+40,defY+48,"DEFIBRILLATOR");
  /* dedikerad LADDA+CHOCK-knapp, under etiketten så inget överlappar */
  {
    const bx0=defX-6,by0=defY+56,bw0=64,bh0=18;
    const activeBtn=S.pads&&!S.rosc;
    const flash=S.charging&&(Math.sin(S.t*10)>0);
    g.fillStyle=flash?"#FF7A70":(activeBtn?"#F44336":"#E7B7B2");
    g.strokeStyle=activeBtn?"#C5362B":"#D8B4B0";g.lineWidth=1.2;
    g.beginPath();g.roundRect(bx0,by0,bw0,bh0,5);g.fill();g.stroke();
    g.fillStyle="#fff";g.font="bold 8px 'IBM Plex Mono'";g.textAlign="center";
    g.fillText(S.charging?"LADDAR…":"⚡ LADDA+CHOCK",bx0+bw0/2,by0+12);g.textAlign="left";
  }

  /* ---- ultraljudsapparat (vy ovanifrån), alltid synlig/klickbar ---- */
  {
    shadow(g,96,272,26,6);
    g.fillStyle="#EBE7E5";g.strokeStyle="#C9C4C1";g.lineWidth=1.5;
    g.beginPath();g.roundRect(70,244,52,26,6);g.fill();g.stroke();      // apparatens ovansida
    g.fillStyle="#2C3033";g.beginPath();g.roundRect(76,248,24,18,3);g.fill(); // vänd skärm
    if(S.usActive){g.strokeStyle="#35E08E";g.lineWidth=1;g.beginPath();
      for(let i=0;i<22;i+=2){g.moveTo(78+i,257+Math.sin((S.t*6)+i)*3);g.lineTo(80+i,257+Math.sin((S.t*6)+i+1)*3);}g.stroke();}
    else {g.fillStyle="#3a4a42";g.font="7px 'IBM Plex Mono'";g.fillText("UL",84,259);}
    g.fillStyle="#8f8a87";g.beginPath();g.roundRect(104,250,12,14,2);g.fill(); // kontrollpanel
    if(S.usActive){ /* proben på sladd mot patienten */
      g.strokeStyle="#9c9693";g.lineWidth=1.4;
      g.beginPath();g.moveTo(118,256);g.bezierCurveTo(150,250,150,cy+30,bx+88,cy+18);g.stroke();
      g.fillStyle="#5B6660";g.beginPath();g.roundRect(bx+84,cy+14,10,8,2);g.fill();
    }
    labelUnder(g,96,282,"ULTRALJUD");
  }

  /* ---- värmetäcke ---- */
  if(S.treatProgress.varme){
    g.fillStyle="rgba(242,169,59,.25)";g.strokeStyle="rgba(178,90,0,.5)";g.lineWidth=1.5;
    g.beginPath();g.roundRect(bx+52,by+6,bw-64,bh-12,10);g.fill();g.setLineDash([5,4]);g.stroke();g.setLineDash([]);
  }

  /* ---- väggklocka ---- */
  g.fillStyle="#DFDAD7";g.strokeStyle="#C9C4C1";g.lineWidth=1;
  g.beginPath();g.roundRect(30,14,66,22,4);g.fill();g.stroke();
  g.fillStyle="#C5362B";g.font="12px 'IBM Plex Mono'";g.textAlign="center";
  g.fillText(mmss(S.t),63,29);g.textAlign="left";

  /* ---- chockblixt ---- */
  if(S.shockFlash>0){
    g.fillStyle=`rgba(255,252,245,${S.shockFlash*0.75})`;g.fillRect(0,0,W,H);
    g.strokeStyle=`rgba(244,67,54,${S.shockFlash})`;g.lineWidth=5;
    g.strokeRect(8,8,W-16,H-16);
  }
  /* ---- ROSC-banner ---- */
  if(S.rosc){
    g.fillStyle="#E9F3EA";g.strokeStyle="#2E7D32";g.lineWidth=1.5;
    g.beginPath();g.roundRect(W/2-105,H-34,210,24,12);g.fill();g.stroke();
    g.fillStyle="#2E7D32";g.font="bold 12px Archivo";g.textAlign="center";
    g.fillText("ROSC, spontan cirkulation",W/2,H-18);g.textAlign="left";
  }
  /* ---- alla etiketter sist, kollisionsundvikande ---- */
  drawRoomLabels(g);
}

/* =====================================================================
   SPRITE-VY  —  Akutrum 1 i konceptarkets visuella språk:
   kraftiga mörka konturer, mättad palett, kaklat golv, yrkesfärgade
   scrubs. Ritas som vektor (arket är ett stil-/konceptark, inte ett
   användbart atlas). Speglar exakt samma S.*-tillstånd som klassiska
   vyn och delar klickzoner via HOT_SPRITE.
   ===================================================================== */
const SPR = {
  OUT:"#22201E", OUT2:"#3A362F", floorA:"#E7EAE6", floorB:"#DCE3DC", floorC:"#CBD8CC",
  wall:"#E9E7E4", wallEdge:"#B9B4AE",
  bed:"#F4F2F0", bedRail:"#9AA3AA", gown:"#CFE0D4", gownLine:"#AFCBB6",
  skinM:"#E7B98C", skinF:"#EEC59B",
  // yrkesfärger (matchar arket): EP marinblå, SSK mellanblå, USK ljusblå,
  // ambulans hi-vis, kirurg teal, narkos blå m keps
  scrub:{ ep:"#2B3D63", ssk:"#3F73B5", usk:"#7FB0D8", amb:"#C6D34A", kir:"#4C7A6A", nark:"#3E6FA6" },
  cart:"#C0392B", metal:"#B7BEC3", metalD:"#8C949A", screen:"#12201B", ecg:"#35E08E",
  o2:"#2E9E52", amber:"#F2A93B", iv:"#63C7EE"
};
// fylld, konturerad form
function sBox(g,x,y,w,h,r,fill){ g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();
  g.strokeStyle=SPR.OUT;g.lineWidth=2;g.stroke(); }
function sCircle(g,x,y,rad,fill){ g.beginPath();g.arc(x,y,rad,0,7);g.fillStyle=fill;g.fill();
  g.strokeStyle=SPR.OUT;g.lineWidth=2;g.stroke(); }
// litet hjul (utrustning uppifrån)
function sWheel(g,x,y){ g.fillStyle=SPR.OUT;g.beginPath();g.arc(x,y,3,0,7);g.fill(); }
// topdown-figur i sprite-stil: konturerad bål + huvud (håret uppifrån)
function spriteFigure(g,x,y,bodyCol,skin,hair,rx,ry,lean){
  ry=ry||13; rx=rx||16; lean=lean||0;
  shadow(g,x,y+ry-2,rx+2,5);
  g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fillStyle=bodyCol;g.fill();
  g.strokeStyle=SPR.OUT;g.lineWidth=2.2;g.stroke();
  // ljus mittlinje (scrub-öppning)
  g.strokeStyle="rgba(255,255,255,.28)";g.lineWidth=1.4;
  g.beginPath();g.moveTo(x,y-ry+3);g.lineTo(x,y+ry-3);g.stroke();
  // huvud sitter mot lutningsriktningen
  const hy=y-ry*0.35+lean;
  g.beginPath();g.arc(x,hy,10.5,0,7);g.fillStyle=skin;g.fill();
  g.strokeStyle=SPR.OUT;g.lineWidth=2;g.stroke();
  g.beginPath();g.arc(x,hy,9,0,7);g.fillStyle=hair;g.fill();
  g.fillStyle="rgba(255,255,255,.22)";g.beginPath();g.ellipse(x-2,hy-2,4,2.4,-0.6,0,7);g.fill();
}
function drawRoomSprite(){
  const g=roomC,W=560,H=330;
  g.save(); g.clearRect(0,0,W,H);
  const L=ROOM_LAYOUT;

  /* ===== BAKGRUND / GOLV ===== */
  if((L.bgMode==="image")&&ROOM_BG_IMG&&ROOM_BG_IMG.complete&&ROOM_BG_IMG.naturalWidth){
    const iw=ROOM_BG_IMG.naturalWidth, ih=ROOM_BG_IMG.naturalHeight, fit=L.bgFit||"cover";
    if(fit==="stretch"){ g.drawImage(ROOM_BG_IMG,0,0,W,H); }
    else { const s=fit==="cover"?Math.max(W/iw,H/ih):Math.min(W/iw,H/ih); const w=iw*s,h=ih*s;
      if(fit==="contain"){g.fillStyle="#20262b";g.fillRect(0,0,W,H);} g.drawImage(ROOM_BG_IMG,(W-w)/2,(H-h)/2,w,h); }
  } else if(L.bgMode==="color"){ g.fillStyle=L.bgColor||"#39434c"; g.fillRect(0,0,W,H); }
  else {
    const floor=SPRITES[L.floor||"floor_er1"];
    if((L.floor==null||L.floor!=="none")&&floor&&floor.width){const cell=56;for(let y=0;y<H;y+=cell)for(let x=0;x<W;x+=cell)g.drawImage(floor,x,y,cell,cell);}
    else{g.fillStyle="#D9DEE3";g.fillRect(0,0,W,H);}
  }
  /* ===== AUTO-VÄGGAR ===== */
  if(L.autoWalls!==false){
    const wall=SPRITES.wall_plain, wt=26;
    if(wall&&wall.width){for(let x=0;x<W;x+=wt)g.drawImage(wall,x,0,wt,wt*1.1);}else{g.fillStyle="#E9E7E4";g.fillRect(0,0,W,wt);}
    g.fillStyle="#9Fc3c2";g.fillRect(0,wt-4,W,3);
    g.fillStyle="#E4E6E4";g.fillRect(0,0,10,H);g.fillRect(W-10,0,10,H);
    g.fillStyle="rgba(34,32,30,.15)";g.fillRect(10,0,1,H);g.fillRect(W-11,0,1,H);
    g.fillStyle="#DfE3E6";g.fillRect(0,H-16,W,16);g.fillStyle="#8FB7C4";g.fillRect(0,H-16,W,3);
  }

  /* hitta bäddens item för relativa detaljer */
  const bedIt=(L.items||[]).find(it=>it.role==="bed");
  const bcx=bedIt?bedIt.x:272, bcy=bedIt?bedIt.y:176, bH=bedIt?bedIt.h:118;
  const headY=bcy-bH*0.30, footY=bcy+bH*0.30;

  /* ===== rita alla items i z-ordning ===== */
  const list=(L.items||[]).slice().map((it,i)=>({it,i})).sort((a,b)=>((a.it.z||0)-(b.it.z||0))||(a.i-b.i));
  for(const {it} of list){ if(!roleVisible(it))continue; drawItem(g,it,{bcx,bcy,bH,headY,footY}); }

  /* ===== state-overlays som inte är egna items (plattor, LUCAS, luftväg, kablar) ===== */
  drawPatientOverlays(g,{bcx,bcy,bH,headY,footY,bedIt});

  /* ===== BLIXT + ROSC ===== */
  if(S.shockFlash>0){g.fillStyle=`rgba(255,252,245,${S.shockFlash*0.75})`;g.fillRect(0,0,W,H);g.strokeStyle=`rgba(244,67,54,${S.shockFlash})`;g.lineWidth=5;g.strokeRect(8,8,W-16,H-16);}
  if(S.rosc){g.fillStyle="#E9F3EA";g.strokeStyle="#2E7D32";g.lineWidth=1.5;g.beginPath();g.roundRect(W/2-105,H-40,210,24,12);g.fill();g.stroke();g.fillStyle="#2E7D32";g.font="bold 12px Archivo";g.textAlign="center";g.fillText("ROSC, spontan cirkulation",W/2,H-24);g.textAlign="left";}
  g.restore(); drawRoomLabels(g);
}

/* ---- är denna roll synlig i nuvarande läge? ---- */
function roleVisible(it){
  const r=it.role; if(!r)return true;
  switch(r){
    case "patient": return S.patientPresent;
    case "narkos_ssk": return S.teamArrived;
    case "compressor": return !S.lucas;
    case "iv_pole": return !!S.access;
    case "o2_cyl": return S.o2Safe;
    case "ekg_trace": case "hr_value": case "spo2_value": case "etco2_value":
    case "rr_value": case "temp_value": return true;
    default: return true;
  }
}
/* ---- vilken sprite ska en roll rita just nu ---- */
function roleSprite(it){
  const r=it.role;
  if(r==="patient") return spriteKeyForPatient();
  if(r==="defib") return S.charging?"defib_charging":S.charged?"defib_shock":"defib_open";
  if(r==="airway_staff") return available("narkos")?"staff_nark":"staff_amb";
  if(r==="compressor"){const cr=compressor();return cr==="lakare"?"staff_ep":cr==="ssk"?"staff_ssk":cr==="ivassk"?"staff_nark":cr==="ambulans"?"staff_amb":"staff_usk";}
  return it.sprite;
}
function spriteKeyForPatient(){ if(S.airway==="tub"||S.airway==="koniotomi")return "pat_intubated";
  if(S.pads)return "pat_pads"; if(S.access)return "pat_iv"; return "pat_unconscious"; }

/* ---- rita ett item (sprite eller widget) ---- */
function drawItem(g,it,ctx){
  if(it.widget){ drawWidget(g,it,ctx); return; }
  const key = it.role? roleSprite(it) : it.sprite;
  const img=SPRITES[key]; if(!img||!img.width)return;
  const h=it.h, w=it.w? it.w : h*(img.width/img.height);
  let yoff=0; if(it.role==="patient"&&S.comp)yoff=Math.sin(compPhase)*1.5*0.5;
  g.save(); g.translate(it.x,it.y+yoff); if(it.rot)g.rotate(it.rot*Math.PI/180); if(it.flip)g.scale(-1,1);
  g.drawImage(img,-w/2,-h/2,w,h); g.restore();
  // rollspecifika tillägg + etikett
  if(it.role==="airway_staff"&&S.vent){const sq=1-0.22*Math.max(0,Math.sin(compPhase/5));g.fillStyle="#BFE3F2";g.strokeStyle=SPR.iv;g.lineWidth=1.3;g.beginPath();g.ellipse(it.x+14,it.y+12,7*sq,10*sq,0.3,0,7);g.fill();g.stroke();}
  if(it.role==="compressor"&&S.comp){g.fillStyle="#EBC8A4";g.strokeStyle=SPR.OUT;g.lineWidth=1.4;g.beginPath();g.ellipse(it.x+22,it.y,6,4,0,0,7);g.fill();g.stroke();}
  if(showRoomLabels()){const lb=roleLabel(it); if(lb)labelUnder(g,it.x,it.y+h/2+2,lb);}
}
function roleLabel(it){ const r=it.role;
  if(r==="crash_cart"||it.sprite==="crashcart")return "AKUTVAGN";
  if(r==="defib")return "DEFIBRILLATOR";
  if(r==="ultrasound")return "ULTRALJUD";
  if(r==="iv_pole")return S.access?S.access.toUpperCase():"IV";
  if(r==="o2_cyl")return "O₂ >1m";
  if(r==="airway_staff")return (available("narkos")?"NARKOS (LUFTVÄG)":"AMBULANS (LUFTVÄG)")+((S.queues.narkos[0]||S.queues.ambulans[0])?" •":"");
  if(r==="compressor"){const cr=compressor();return (cr?COMP_LABEL[cr]:"KOMPRESSÖR")+(S.comp?" · HLR":"");}
  if(r==="doctor")return "LÄKARE (DU)";
  if(r==="nurse_ssk")return roleBusy("ssk")?"SSK •":"SJUKSKÖTERSKA";
  if(r==="ambulance")return "AMBULANS";
  if(r==="narkos_ssk")return "NARKOS-SSK";
  return null;
}

/* ---- widgets: live-värden, EKG-kurva, knapp, monitor-ram, klocka ---- */
function drawWidget(g,it,ctx){
  const r=it.role, w=it.w||40, h=it.h||20, x=it.x-w/2, y=it.y-h/2;
  const val=widgetValue(r,it);
  if(r==="monitor_wall"){
    g.fillStyle="#2C302E";g.strokeStyle="#1C1B1B";g.lineWidth=2;g.beginPath();g.roundRect(x,y,w,h,4);g.fill();g.stroke();
    if(!S.pads){g.fillStyle="#5b6f66";g.font=Math.max(8,h*0.22)+"px 'IBM Plex Mono'";g.textAlign="center";g.fillText("— ej kopplad —",it.x,it.y+3);g.textAlign="left";}
    return;
  }
  if(r==="ladda_button"){
    const active=S.pads&&!S.rosc, flash=S.charging&&(Math.sin(S.t*10)>0);
    g.fillStyle=flash?"#FF7A70":(active?"#F44336":"#E7B7B2");g.strokeStyle=SPR.OUT;g.lineWidth=1.5;
    g.beginPath();g.roundRect(x,y,w,h,5);g.fill();g.stroke();
    g.fillStyle="#fff";g.font="bold "+Math.max(7,h*0.5)+"px 'IBM Plex Mono'";g.textAlign="center";
    g.fillText(S.charging?"LADDAR…":"⚡ LADDA+CHOCK",it.x,it.y+h*0.18);g.textAlign="left";return;
  }
  if(r==="clock"){
    g.fillStyle="#F2F0EE";g.strokeStyle="#8f8a87";g.lineWidth=1.5;g.beginPath();g.arc(it.x,it.y,h/2,0,7);g.fill();g.stroke();
    g.strokeStyle="#1C1B1B";g.lineWidth=1;g.beginPath();g.moveTo(it.x,it.y);g.lineTo(it.x,it.y-h*0.3);g.moveTo(it.x,it.y);g.lineTo(it.x+h*0.25,it.y+h*0.1);g.stroke();return;
  }
  if(r==="ekg_trace"){
    if(S.pads){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
      g.strokeStyle="#35e08e";g.lineWidth=1.4;g.beginPath();
      const n=Math.round(w);for(let i=0;i<=n;i++){const t=(S.t*2)+(i/n)*6;const yy=it.y-ekgSample(t)*h*0.42;i?g.lineTo(x+i,yy):g.moveTo(x+i,yy);}g.stroke();g.restore();}
    else{g.strokeStyle="rgba(120,150,140,.5)";g.lineWidth=1;g.beginPath();g.moveTo(x,it.y);g.lineTo(x+w,it.y);g.stroke();}
    return;
  }
  // numeriska värden (HR/SpO2/EtCO2/AF/Temp) + fri text
  const col=WIDGET_COLOR[r]||"#e8ebee";
  g.fillStyle=col;g.font="bold "+Math.max(8,Math.min(h*0.8,26))+"px 'IBM Plex Mono'";g.textAlign="center";g.textBaseline="middle";
  g.fillText(val,it.x,it.y);g.textBaseline="alphabetic";g.textAlign="left";
}
const WIDGET_COLOR={hr_value:"#8ff0b0",spo2_value:"#8fd0ff",etco2_value:"#f4c04a",rr_value:"#c9b8ff",temp_value:"#ffb28f",text:"#e8ebee"};
function widgetValue(r,it){
  if(r==="text")return it.text!=null?it.text:"";
  if(it.text!=null && it.text!=="") return it.text; // manuellt satt värde vinner
  if(r==="hr_value")return S.rosc?"96":(S.rhythm==="PEA"||S.rhythm==="organiserad")?"55":(S.pads?"--":"--");
  if(r==="spo2_value")return S.rosc? (S.o2max?"97":"90") : (S.pads?"88":"--");
  if(r==="etco2_value"){const el=document.getElementById("vCO2");return el?el.textContent:"—";}
  if(r==="rr_value")return S.vent?"12":"0";
  if(r==="temp_value")return "36.2";
  return it.text!=null?it.text:"";
}
function ekgSample(t){ // enkel QRS-liknande kurva
  const p=t%1; let v=Math.sin(t*6)*0.08;
  if(p>0.18&&p<0.22)v+=1.0; if(p>0.22&&p<0.26)v-=0.5; if(p>0.5&&p<0.62)v+=0.18*Math.sin((p-0.5)*26);
  return v;
}

/* ---- patient-overlays (plattor, luftväg, LUCAS, defib-kabel) som inte är egna items ---- */
function drawPatientOverlays(g,c){
  const {bcx,bcy,bH,headY,footY,bedIt}=c;
  if(!S.patientPresent){ if(bedIt){g.fillStyle="#5b6b60";g.font="bold 9px 'IBM Plex Mono'";g.textAlign="center";
      g.fillText("PATIENT PÅ VÄG IN",bcx,bcy);g.font="8px 'IBM Plex Mono'";g.fillStyle="#7d8a80";
      g.fillText("00:"+String(Math.ceil(S.arrivalIn||0)).padStart(2,"0"),bcx,bcy+13);g.textAlign="left";} return; }
  // luftväg
  if(S.airway==="tub"){g.strokeStyle=SPR.iv;g.lineWidth=2.4;g.beginPath();g.moveTo(bcx-10,headY-2);g.lineTo(bcx+10,headY-2);g.stroke();if(S.capno)sBox(g,bcx-4,headY-12,8,8,1,SPR.amber);}
  else if(S.airway==="koniotomi"){g.strokeStyle="#FFFFFF";g.lineWidth=3.5;g.beginPath();g.moveTo(bcx,headY+6);g.lineTo(bcx,headY-8);g.stroke();g.strokeStyle=SPR.OUT;g.lineWidth=1;g.stroke();if(S.capno)sBox(g,bcx-4,headY-16,8,8,1,SPR.amber);}
  else if(S.airway==="mask"){g.fillStyle="rgba(130,190,200,.55)";g.strokeStyle="#4E9AA6";g.lineWidth=1.6;g.beginPath();g.ellipse(bcx,headY,7,9,0,0,7);g.fill();g.stroke();}
  else if(S.airway==="igel"){sBox(g,bcx-3,headY-8,6,14,3,SPR.amber);}
  // plattor
  if(S.pads){g.fillStyle=SPR.amber;g.strokeStyle="#C9871B";g.lineWidth=1.4;
    if(S.padPos==="AL"){g.save();g.translate(bcx-10,headY+22);g.rotate(-0.4);g.beginPath();g.roundRect(-8,-6,16,11,3);g.fill();g.stroke();g.restore();
      g.save();g.translate(bcx+13,headY+52);g.rotate(0.4);g.beginPath();g.roundRect(-8,-6,16,11,3);g.fill();g.stroke();g.restore();}
    else{g.save();g.translate(bcx,headY+26);g.beginPath();g.roundRect(-8,-6,16,11,3);g.fill();g.stroke();g.restore();g.fillStyle="#B25A00";g.font="8px 'IBM Plex Mono'";g.fillText("AP",bcx+10,headY+50);}
    // elektroder
    g.fillStyle="#fff";g.strokeStyle="#C9C4C1";g.lineWidth=1;[[bcx-9,headY+24],[bcx+9,headY+24],[bcx+11,headY+44]].forEach(([ex,ey])=>{g.beginPath();g.arc(ex,ey,3,0,7);g.fill();g.stroke();});}
  // LUCAS
  if(S.lucas){sBox(g,bcx-8,headY+20,16,60,5,"#FFFFFF");const press=S.comp?(Math.sin(compPhase)+1)/2:0;sCircle(g,bcx,headY+50,9-press*2,"#3E3B39");g.fillStyle="#1C1B1B";g.font="bold 7px 'IBM Plex Mono'";g.fillText("LUCAS",bcx-11,headY+18);}
  // värmetäcke
  if(S.treatProgress.varme&&bedIt){g.fillStyle="rgba(242,169,59,.22)";g.strokeStyle="rgba(178,90,0,.55)";g.lineWidth=1.6;g.beginPath();g.roundRect(bcx-30,bcy-6,60,bH*0.42,8);g.fill();g.setLineDash([5,4]);g.stroke();g.setLineDash([]);}
  // IV-slang till närmaste iv_pole
  if(S.access){const pole=(ROOM_LAYOUT.items||[]).find(it=>it.role==="iv_pole");if(pole){g.strokeStyle="#9CC8DE";g.lineWidth=1.8;g.beginPath();g.moveTo(pole.x,pole.y);g.bezierCurveTo(pole.x+30,pole.y+18,bcx-40,bcy,bcx-24,bcy+6);g.stroke();}}
  // defib-kabel
  if(S.pads){const d=(ROOM_LAYOUT.items||[]).find(it=>it.role==="defib");if(d){g.strokeStyle="#8C949A";g.lineWidth=1.8;g.beginPath();g.moveTo(d.x-24,d.y+10);g.bezierCurveTo(420,150,360,110,bcx+16,headY+30);g.stroke();}}
  // ultraljudsprob
  if(S.usActive){const u=(ROOM_LAYOUT.items||[]).find(it=>it.role==="ultrasound");if(u){g.strokeStyle=SPR.metalD;g.lineWidth=1.6;g.beginPath();g.moveTo(u.x-16,u.y);g.bezierCurveTo(440,u.y,bcx+40,bcy+10,bcx+22,bcy+10);g.stroke();sBox(g,bcx+18,bcy+6,10,8,2,"#5B6660");}}
  // laddindikator-text vid defib
  if(S.charged){const d=(ROOM_LAYOUT.items||[]).find(it=>it.role==="defib");if(d){g.fillStyle="#C5362B";g.font="bold 8px 'IBM Plex Mono'";g.textAlign="center";g.fillText((S.shocks===0?"200J":"360J")+" KLAR",d.x,d.y+d.h*0.4+8);g.textAlign="left";}}
}
function showRoomLabels(){ return true; }


/* ---------- EKG ---------- */
let qrsTimer=0;
function drawECG(dt){
  if(dt<=0)return;                 // pausat (dialog/rytmkontroll) → EKG fryser som allt annat
  const g=ecgC,W=540,H=96,mid=H*0.55;
  const speed=90; // px/s
  const step=Math.max(1,Math.round(speed*dt));
  // fade-kolumn
  g.fillStyle="#141A17";
  g.fillRect(ecgX,0,step+14,H);
  // rutnät i kolumnen
  g.strokeStyle="#20302a";g.lineWidth=1;
  g.beginPath();
  for(let y=0;y<H;y+=16){g.moveTo(ecgX,y);g.lineTo(ecgX+step+14,y);}
  g.stroke();
  if(!S.pads){ecgX=(ecgX+step)%W;return;}
  // Delad vågformsmodell: samma spec som monitorn och vågforms-editorn.
  const AMP=34;                                   // px per normaliserad enhet
  let y=mid - _rhythmSample(currentWaveSpec(), S.t)*AMP;
  // kompressionsartefakt
  if(S.comp&&!S.rosc)y+=Math.sin(compPhase)*9;
  g.strokeStyle="#35e08e";g.lineWidth=1.6;
  g.beginPath();g.moveTo(ecgX===0?0:ecgX-1,ecgLast);g.lineTo(ecgX+step,y);g.stroke();
  ecgLast=y;
  ecgX+=step;if(ecgX>=W){ecgX=0;ecgLast=y;}
  // sweep-linje
  g.fillStyle="#35e08e";g.fillRect((ecgX+2)%W,0,2,H);
  // etikett — visa ALDRIG rytmnamnet (skulle avslöja svaret vid rytmkontroll).
  // Endast avledning, pappershastighet och ev. kompressionsartefakter.
  const showTrace = S.pads;
  $("rytmlabel").textContent = showTrace
    ? "II · 25 mm/s"+(S.comp?"  ·  kompressionsartefakter":"")
    : "Koppla defibrillatorplattor för att se rytm";
}

function dbpNow(){ // diastoliskt tryck under HLR (fysiologiguidad)
  if(S.rosc)return 70;
  if(!S.comp)return 0;
  let d=10+34*qualityAvg();
  if(recentAdrenalin())d+=10;
  if(S.lucas)d+=4;
  return Math.round(clamp(d,0,60));
}
function sbpNow(){
  if(S.rosc){const sb=Math.round(S.post.sbt||90);return sb;}
  return 0;
}
function bpText(){
  if(S.rosc){const s=Math.round(sbpNow());return s+"/"+Math.round(s*0.6);}
  return "–";
}
/* Vem som ventilerar spelar roll. Narkossköterskan är van vid mask och tub:
   bättre tätning, jämnare volymer, ingen hyperventilation. Ambulanspersonalen
   gör ett fullgott men mindre skickligt jobb. */
function ventQuality(){
  if(!S.vent)return 0;
  if(S.ventBy==="ivassk"||S.ventBy==="narkos")return 1.0;
  if(S.ventBy==="ambulans")return 0.72;
  return 0.6;
}
function spo2Value(){
  if(!S.spo2probe)return "--";
  if(S.rosc)return String(S.post.o2?96:99);
  // Under HLR: förenklad uppskattning utifrån syrgas, luftväg och orsak
  let base=70;
  if(S.o2max)base+=13; else if(S.airway==="tub"||S.airway==="igel"||S.airway==="koniotomi")base+=4;
  if(S.airway==="tub"||S.airway==="koniotomi")base+=8; else if(S.airway==="igel")base+=6; else if(S.airway==="mask"&&S.vent)base+=3; else if(S.svalgtub)base+=1;
  if(S.vent)base-=Math.round(7*(1-ventQuality()));   // sämre tätning/volymer → sämre syresättning
  if(S.perfusing)base+=6;
  // Summerar bidrag från VARJE aktiv orsak (i stället för en enda if/else-kedja) så att två
  // samtidiga orsaker (hardcore) båda påverkar signalen, och varje orsak använder sin EGEN
  // behandlad-status i stället för den globala (som bara blir sann när ALLA är åtgärdade).
  S.causes.forEach(cause=>{
    const treated=cause.treatedAt!=null;
    if(cause.id==="hypoxi") base+= treated?2:-28;
    else if(cause.id==="cico") base+= treated?2:-32;   // ingen syresättning alls före koniotomin
    else if(cause.id==="tension") base+= S.treatProgress.naldekomp?0:-14;
    else if(cause.id==="pe") base+= treated?-2:-9;
    else if(cause.id==="tamponad") base-=3;
    else if(cause.id==="hypovol") base-=4;        // dålig perfusion → dålig signal
  });
  if(!S.comp&&!S.perfusing)base-=6;                   // ingen framåtflöde utan kompressioner
  return String(clamp(Math.round(base),35,99));
}
function co2Value(){
  if(!S.capno)return "--";
  // EtCO₂ i kPa (normal ~4,5–6,0; under HLR ofta ~1,5–2,5; stiger vid ROSC)
  if(S.rosc)return (4.8+rnd(-0.2,0.3)).toFixed(1);
  if(S.airway==="tub"||S.airway==="igel")
    return clamp(0.9+1.3*qualityAvg()+(S.perfusing?2.6:0)+rnd(-0.1,0.1),0.4,7.5).toFixed(1);
  return "--";
}
function updateVitals(){
  $("vHR").textContent=S.rosc?"96":(S.pads&&(S.rhythm==="PEA"||S.rhythm==="organiserad")?"55":"--");
  // Jittriga värden uppdateras ~1 ggr/sek så siffrorna går att läsa
  if(S._vitAt===undefined||Math.abs(S.t-S._vitAt)>=1.0||S._vitCache===undefined){
    S._vitAt=S.t;
    S._vitCache={co2:co2Value(), spo2:spo2Value(), bp:null, temp:S.kad?coreTemp().toFixed(1):"--"};
    let bp="--";
    if(S.artline){ bp=S.rosc?bpText():("d"+dbpNow()); }
    else if(S.nibp){ bp=S.rosc?bpText():"--"; }
    else if(S.rosc&&S.post.bt){ bp=bpText(); }
    S._vitCache.bp=bp;
  }
  $("vCO2").textContent=S._vitCache.co2;
  $("vSpO2").textContent=S._vitCache.spo2;
  $("vBP").textContent=S._vitCache.bp;
  $("vTemp").textContent=S._vitCache.temp;
  const bpEl=$("vBP");
  if(S.artline&&!S.rosc){bpEl.parentElement.classList.add("cy");}
  $("vShock").textContent=S.shocks;
  if(S.artline&&!S.rosc&&dbpNow()>=30)S.dbpAchieved=true;
}

function updateChips(){
  const frac=S.arrestTime>0?1-S.handsOff/S.arrestTime:1;
  const cykel=S.lastAnalysis===null?"–":mmss(S.t-S.lastAnalysis);
  const chips=[
    {t:"HLR: "+(S.comp?(S.lucas?"LUCAS":"PÅGÅR"):"PAUSAD"),c:S.comp?"on":(S.rosc?"":"bad")},
    {t:"Kompr.fraktion "+(frac*100).toFixed(0)+"%",c:frac>0.8?"on":frac>0.6?"warn":"bad"},
    {t:"Cykel "+cykel,c:(S.lastAnalysis!==null&&S.t-S.lastAnalysis>130)?"warn":""},
    {t:"Luftväg: "+S.airway.toUpperCase()+(S.capno?" +CO₂":""),c:S.airway==="tub"||S.airway==="igel"?"on":""},
    {t:"Infart: "+(S.cvk?"CVK":(S.access?S.access.toUpperCase():"SAKNAS")),c:S.access?"on":"warn"},
    {t:"Plattor: "+(S.pads?S.padPos:"SAKNAS"),c:S.pads?"on":"warn"},
    {t:"Adrenalin: "+(S.adrenalin.length?mmss(S.t-S.adrenalin[S.adrenalin.length-1])+" sedan":"ej givet"),
      c:S.adrenalin.length&&S.t-S.adrenalin[S.adrenalin.length-1]>300&&!S.rosc?"warn":""}
  ];
  if(S.artline&&!S.rosc)chips.push({t:"Diast. BT "+dbpNow()+" mmHg",c:dbpNow()>=30?"on":"warn"});
  if(S.protokoll&&!S.rosc){const q=S.protokollQuality;chips.push({t:"Protokoll "+Math.round(q)+"%",c:q>=70?"on":q>=40?"warn":"bad"});}
  $("chips").innerHTML=chips.map(c=>`<span class="chip ${c.c}">${c.t}</span>`).join("");
}

/* ---------- Actions UI ---------- */
