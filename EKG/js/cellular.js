/* ---------- Cellnivå: jonkanaler, aktionspotential och kopplingen till EKG:t ---------- */
/* En förenklad, FENOMENOLOGISK aktionspotentialmodell (inte en fullständig Hodgkin-Huxley/
   Luo-Rudy-modell med dussintals grindvariabler — det vore mycket mer arbete utan att
   tillföra pedagogiskt värde på den här nivån), men grundad i riktig cellfysiologi:
   - Vilopotentialen räknas med den RIKTIGA Nernst-ekvationen på kalium.
   - Na+-kanalernas tillgänglighet räknas med en riktig Boltzmann-inaktiveringskurva
     (h-infinity), så högt extracellulärt kalium INAKTIVERAR Na+-kanaler mekanistiskt
     (samma väg som i verkligheten breddar QRS vid svår hyperkalemi) — inte bara en
     godtycklig fudge-faktor.
   - Ca2+ styr platåfasens (fas 2) längd, K+ styr repolarisationens (fas 3) hastighet
     via en förenklad IKr-liknande konduktans (lågt kalium SÄNKER paradoxalt IKr, precis
     som den riktiga mekanismen bakom hypokalemins QT-förlängning).
   - Fas 1 (den lilla "notchen" mellan uppstroke och platå) finns med som en kort dipp
     efter toppen, precis som det verkliga Ito-medierade hacket i kammarmyocyter.
   Samma tre parametrar (K, Ca, Na-kanalblockad) driver sedan BÅDE de två AP-kurvorna
   (kammarmyocyt + SA-nodens pacemakercell) OCH en kontinuerlig EKG-profil (samma
   mergeDeltas-mekanism som resten av modulen använder för sina 38 diskreta tillstånd) —
   så skjutreglagen ger en enda, inbördes konsekvent modell i stället för fristående
   preset-knappar. */

const CELL_NORMAL = {k: 4.0, ca: 1.2, naBlock: 0};

function clamp01r(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function lerpC(a, b, t){ return a + (b - a) * t; }
function sigmoid01(p){ const x = clamp01r(p, 0, 1); return 1 / (1 + Math.exp(-12 * (x - 0.5))); }
function gaussC(x, mu, sd){ return Math.exp(-((x - mu) * (x - mu)) / (2 * sd * sd)); }

// Vilopotential via Nernst-ekvationen på K+ (61,5*log10(ut/in) vid 37°C, [K]in ~140 mM)
// plus en fast +10 mV-offset för att fånga de icke-K+-beroende läckströmmar som gör att
// riktiga myocyters vilopotential (~-85 mV) ligger något mindre negativt än ren E_K.
function restingPotential(k){ return 61.5 * Math.log10(Math.max(k, 0.3) / 140) + 10; }

// Na+-kanalernas steady-state-inaktivering (h-infinity), en riktig Boltzmann-kurva:
// vid normal vilopotential (~-85 mV) är de flesta kanalerna redo (h≈0,9); vid en
// depolariserad vilopotential (svår hyperkalemi) faller tillgängligheten kraftigt.
function naAvailabilityFromRestingV(vRest){
  const Vh = -70, slope = 6;
  return 1 / (1 + Math.exp((vRest - Vh) / slope));
}
// Total effektiv Na+-konduktans: K+-medierad inaktivering (mekanistisk, automatisk)
// MULTIPLICERAD med en oberoende, manuell "extra blockad"-reglage (läkemedel: TCA,
// flekainid, eller bara ett sätt att utforska ren Na+-kanalblockad isolerat).
function effectiveNaConductance(k, naBlockPct){
  const hInf = naAvailabilityFromRestingV(restingPotential(k));
  const blockFactor = 1 - clamp01r(naBlockPct, 0, 100) / 100;
  return Math.max(0.02, hInf * blockFactor);
}
// Platåfasens (fas 2) längd: högre Ca2+ förkortar den (kliniskt: hyperkalcemi -> kort QT),
// lägre Ca2+ förlänger den (hypokalcemi -> lång QT) — samma riktning som de redan
// etablerade qt-faktorerna för hyperca/hypoca i conditions-data.js.
function plateauDurationMs(ca){ return 220 * (1.2 / Math.max(ca, 0.15)); }
// IKr-liknande repolarisationskonduktans: lågt kalium SÄNKER paradoxalt IKr (en riktig,
// väldokumenterad kanalegenskap) -> långsammare fas 3 -> förlängd QT + tydligare U-våg.
function ikrConductance(k){ return clamp01r(k / 4.0, 0.35, 1.4); }

function saNodeCycleLengthMs(k){
  const base = 800; // ~75/min normalt
  const factor = clamp01r(k / 4.0, 0.85, 2.5); // hyperkalemi bromsar SA-noden mycket mer än hypokalemi snabbar upp den
  return base * factor;
}
function saNodeRateBpm(k){ return Math.round(60000 / saNodeCycleLengthMs(k)); }

// Delad färgpalett för fasbakgrunderna — subtila toner så kurvan och etiketterna
// förblir läsbara. Samma nycklar används av både kammarmyocyten och SA-noden där det
// är fysiologiskt relevant (SA-noden saknar riktig fas 1/2, se PHASE_INFO_SA).
const PHASE_COLORS = {
  rest4: "rgba(107,107,107,.08)",
  sa4:   "rgba(33,150,243,.13)",
  p0:    "rgba(76,175,80,.14)",
  p1:    "rgba(255,193,7,.20)",
  p2:    "rgba(33,150,243,.13)",
  p3:    "rgba(244,67,54,.10)"
};
// Fas 0–3 följer en given palett (röd/blå/grön/gul); kammarcellens vilofas (4) har ingen
// egen kulör i den paletten och behåller en neutral grå ton. SA-nodens fas 4 (den egna
// diastoliska rampen) återanvänder samma blå som fas 2.
const PHASE_SWATCH = {
  rest4: "#6B6B6B",
  sa4:   "#2196F3",
  p0:    "#4CAF50",
  p1:    "#FFC107",
  p2:    "#2196F3",
  p3:    "#F44336"
};
const PHASE_INFO_VENT = [
  {key:"rest4", label:"Fas 4 — Vilopotential", desc:"K⁺-läckström håller cellen polariserad i vila."},
  {key:"p0", label:"Fas 0 — Snabb depolarisering", desc:"Na⁺ strömmar snabbt in genom spänningsstyrda kanaler."},
  {key:"p1", label:"Fas 1 — Tidig repolarisering (notch)", desc:"Kortvarigt utflöde av K⁺ (Ito) ger ett litet hack strax efter toppen."},
  {key:"p2", label:"Fas 2 — Platå", desc:"Ca²⁺ strömmar in och balanseras av utgående K⁺ — det här sätter QT-tidens längd."},
  {key:"p3", label:"Fas 3 — Repolarisering", desc:"K⁺ strömmar ut (IKr/IKs) och cellen återgår till vilopotentialen."}
];
const PHASE_INFO_SA = [
  {key:"sa4", label:"Fas 4 — Spontan diastolisk depolarisering", desc:"”Funny current” (Na⁺) och T-typs-Ca²⁺ driver självmant cellen mot tröskeln — det här är det som SÄTTER hjärtfrekvensen."},
  {key:"p0", label:"Fas 0 — Uppstroke", desc:"L-typs-Ca²⁺ strömmar in — långsammare än kammarcellens Na⁺-uppstroke, ingen skarp spik."},
  {key:"p3", label:"Fas 3 — Repolarisering", desc:"K⁺ strömmar ut, tillbaka mot maximal diastolisk potential."}
];

/* ---------- Kammarmyocytens aktionspotential ---------- */
function buildVentricularAP(params){
  const k = params.k, ca = params.ca, naBlock = params.naBlock;
  const vRest = restingPotential(k);
  const naCond = effectiveNaConductance(k, naBlock);
  const vPeak = vRest + naCond * 115;                  // reducerad overshoot vid nedsatt Na+-konduktans
  const upstrokeDur = clamp01r(2 / Math.max(naCond, 0.04), 1, 60); // ms — långsammare uppstroke vid färre kanaler
  const notchDur = 14;                                 // fas 1: kort Ito-medierad "notch"
  const notchDepth = (vPeak - vRest) * 0.16;
  const plateauV = Math.min(vPeak - 8, 18) - notchDepth * 0.15;
  const plateauEnd = plateauV - 12;                    // platån lutar svagt nedåt, inte helt flat
  const platDur = plateauDurationMs(ca);
  const tau3 = 40 / ikrConductance(k);                 // ms, tidskonstant för fas 3
  const tPre = 40;                                     // ms synlig vila FÖRE aktionspotentialen börjar

  const t0 = 0, t1 = t0 + upstrokeDur, t1b = t1 + notchDur, t2 = t1b + platDur;
  const apd90 = 2.303 * tau3;                          // tid för 90% repolarisation efter platåns slut
  // EAD-risken beror på den TOTALA aktionspotentialens längd (fas 2 + fas 3 tillsammans)
  // — en förlängd platå (lågt Ca2+) OCH en långsam fas 3 (lågt K+) bidrar båda till samma
  // förlängda "sårbara fönster", precis som klinisk QT-förlängning kan drivas av endera
  // eller båda. Tröskeln (480 ms totalt, från fas 2:s start) motsvarar ungefär den svårt
  // förlängda QT (QTc >500 ms) som kliniskt används som varningsgräns för torsades-risk.
  const totalApDur = platDur + apd90;
  const eadRisk = totalApDur > 480;
  const eadCenter = t2 + apd90 * 0.55;
  const eadAmp = eadRisk ? clamp01r((totalApDur - 480) / 3.5, 0, 28) : 0;

  function v(tMs){
    if(tMs < t0) return vRest;
    if(tMs < t1){
      const p = (tMs - t0) / upstrokeDur;
      return vRest + (vPeak - vRest) * sigmoid01(p);
    }
    if(tMs < t1b){
      const p = (tMs - t1) / notchDur;
      const base = lerpC(vPeak, plateauV, sigmoid01(p));
      const dip = notchDepth * Math.sin(Math.PI * clamp01r(p, 0, 1));
      return base - dip;
    }
    if(tMs < t2){
      const p = (tMs - t1b) / platDur;
      return lerpC(plateauV, plateauEnd, p);
    }
    const dt = tMs - t2;
    let val = vRest + (plateauEnd - vRest) * Math.exp(-dt / tau3);
    if(eadAmp > 0) val += eadAmp * gaussC(tMs, eadCenter, 22);
    return val;
  }
  // ARP (absolut refraktärperiod): till ungefär -55 mV under fas 3 (då börjar en
  // meningsfull andel Na+-kanaler ha återhämtat sig). RRP (relativ refraktärperiod):
  // därifrån till nästan fullständig repolarisation.
  const arpEnd = t2 + tau3 * Math.log(Math.max(1e-6, (plateauEnd - vRest) / (-55 - vRest)));
  const rrpEnd = t2 + apd90;
  const winEnd = rrpEnd + 60;
  return {
    v, vRest, vPeak, plateauV, naCond, upstrokeDur, notchDur, platDur, tau3,
    t0, t1, t1b, t2, arpEnd: Math.max(t1, arpEnd), rrpEnd, apd90, eadRisk, eadCenter: eadRisk ? eadCenter : null,
    winStart: -tPre, winEnd,
    phases: [
      {from: -tPre, to: t0, key: "rest4"},
      {from: t0, to: t1, key: "p0"},
      {from: t1, to: t1b, key: "p1"},
      {from: t1b, to: t2, key: "p2"},
      {from: t2, to: rrpEnd, key: "p3"},
      {from: rrpEnd, to: winEnd, key: "rest4"}
    ]
  };
}

/* ---------- SA-nodens (pacemaker) aktionspotential ---------- */
// Ingen stabil fas 4 — i stället en långsam diastolisk depolarisering (funny current-
// liknande) från MDP upp till tröskeln, som utlöser en långsammare, Ca2+-buren uppstroke
// (inga snabba Na+-kanaler i SA-noden, därför mycket lägre overshoot än kammarcellen).
// Nodceller saknar en riktig fas 1 (notch) och fas 2 (platå) — bara 4, 0 och 3.
function buildSANodeAP(params){
  const k = params.k;
  const cycleLen = saNodeCycleLengthMs(k);
  const mdp = -60, threshold = -40, vPeak = 8;
  // upstrokeDur satt till 22 ms (inte 8) — SA-nodens uppstroke bärs av L-typs-Ca2+, inte
  // snabba Na+-kanaler, och är därför verkligen långsammare än kammarcellens ~2 ms. Det
  // gör samtidigt fas 0 bredare och lättare att se i diagrammet.
  const upstrokeDur = 22, repolDur = 100;
  const phase4Dur = Math.max(50, cycleLen - upstrokeDur - repolDur);
  function v(tMs){
    const t = ((tMs % cycleLen) + cycleLen) % cycleLen;
    if(t < phase4Dur){
      const p = t / phase4Dur;
      // En enda mjukt accelererande kurva (linjär + p^n-blandning), INTE flera separata
      // steg — I_f (funny current) driver en jämn, långsamt tilltagande lutning genom
      // hela fas 4, med T-typs-Ca2+ som lägger på ytterligare acceleration mot slutet.
      // Den lilla linjära andelen (aLin) ger fortfarande en synlig, icke-noll lutning
      // direkt vid MDP (vinkelbrottet mot föregående slags fas 3) utan att skapa en
      // konstlad "platå" i mitten.
      const aLin = 0.32;
      return mdp + (threshold - mdp) * (aLin * p + (1 - aLin) * Math.pow(p, 2.6));
    }
    if(t < phase4Dur + upstrokeDur){
      const p = (t - phase4Dur) / upstrokeDur;
      return threshold + (vPeak - threshold) * sigmoid01(p);
    }
    // Fas 3 är KONVEX (accelererande nedgång: långsamt först, brantare mot slutet) —
    // inte en "snabbt-ner-och-plana-ut"-exponential. En ren potensfunktion p^n möter
    // ändå EXAKT mdp vid dt=repolDur (samma skydd mot hack i övergången som tidigare),
    // men med en brant, icke-noll lutning just DÄR — vilket är precis det som skapar
    // vinkelbrottet mot nästa cykels fas 4 (som börjar om med sin egen, flackare lutning).
    const dt = t - phase4Dur - upstrokeDur;
    const p3 = clamp01r(dt / repolDur, 0, 1);
    return vPeak - (vPeak - mdp) * Math.pow(p3, 1.8);
  }
  // Fönstret CENTRERAS kring fas 0 (uppstroken), men bredden är satt till EXAKT en hel
  // cykellängd (inte ett godtyckligt tal) — v(t) är periodisk med period cycleLen (byggd
  // via modulo), så v(winStart) === v(winStart+cycleLen) garanterat, oavsett var winStart
  // ligger. Det är vad som säkerställer att vänster- och högerkanten alltid möts vid
  // EXAKT samma y-koordinat (samma punkt i fas 4:s kurva), inte bara ungefär.
  const lead = cycleLen / 2 - upstrokeDur / 2;
  const winStart = phase4Dur - lead, winEnd = winStart + cycleLen;
  return {
    v, cycleLen, mdp, threshold, vPeak, phase4Dur, rateBpm: Math.round(60000 / cycleLen),
    winStart, winEnd, markAt: phase4Dur, vMin: -60, vMax: 30,
    // widthFrac: fas 4 tar upp >80% av den VERKLIGA tiden men ska bara ta upp hälften av
    // BILDBREDDEN (fas 0+3 ska synas tydligt, inte försvinna som en strimma) — därför
    // tilldelas varje segment en FAST bildbreddsandel oberoende av sin verkliga varaktighet
    // (se drawActionPotential:s styckvisa x-mappning). Den underliggande tidsaxeln/
    // kurvan är opåverkad, så periodiciteten (v(winStart)===v(winEnd)) gäller fortfarande.
    phases: [
      {from: winStart, to: phase4Dur, key: "sa4", widthFrac: 0.25},
      {from: phase4Dur, to: phase4Dur + upstrokeDur, key: "p0", widthFrac: 0.20},
      {from: phase4Dur + upstrokeDur, to: cycleLen, key: "p3", widthFrac: 0.30},
      {from: cycleLen, to: winEnd, key: "sa4", widthFrac: 0.25}
    ]
  };
}

/* ---------- Cellparametrar -> kontinuerlig EKG-profil ---------- */
// Samma fält som de 38 diskreta tillstånden använder (mergeDeltas i conditions-data.js),
// men beräknade KONTINUERLIGT från jonvärdena i stället för som fasta presets — reglagen
// ger alltså en verkligt glidande skala, inte bara av/på-lägen.
function cellularToECGDelta(params){
  const k = params.k, ca = params.ca;
  const naCond = effectiveNaConductance(k, params.naBlock);
  const naCondNormal = effectiveNaConductance(CELL_NORMAL.k, 0);
  const qrsWide = clamp01r((1 - naCond / naCondNormal) * 3.4, 0, 3.6);
  const tScale = clamp01r(1 + (k - 4.0) * 0.5, 0.3, 2.7);
  const qtFromCa = Math.sqrt(plateauDurationMs(ca) / 220);
  const qtFromK = Math.sqrt(ikrConductance(CELL_NORMAL.k) / ikrConductance(k));
  const qt = clamp01r(qtFromCa * qtFromK, 0.55, 1.85);
  const pWave = clamp01r(1 - Math.max(0, k - 6.5) / 3.5, 0, 1);
  const uWave = clamp01r((ikrConductance(CELL_NORMAL.k) / ikrConductance(k) - 1) * 1.6, 0, 1.5);
  return {qrsWide, tScale, qt, pWave, uWave, hr: saNodeRateBpm(k)};
}
function cellularToECGProfile(params){ return mergeDeltas([cellularToECGDelta(params)]); }

/* ---------- Ritning: en AP-kurva med axlar, fasbakgrunder och refraktärmarkering ---------- */
function drawActionPotential(cv, ap, opts){
  opts = opts || {};
  const g = cv.getContext("2d"), W = cv.width, H = cv.height;
  const vMin = opts.vMin ?? ap.vMin ?? -110, vMax = opts.vMax ?? ap.vMax ?? 40;
  const padL = 44, padR = 14, padT = 14, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const winStart = opts.winStart ?? ap.winStart ?? 0;
  const winEnd = opts.winEnd ?? ap.winEnd ?? 400;
  const span = winEnd - winStart;
  // Styckvis (icke-linjär) x-mappning när faserna har en egen widthFrac (SA-noden) — varje
  // fas får sin TILLDELADE andel av bildbredden oberoende av hur lång den är i verklig
  // tid, så den mycket långa fas 4 inte gör fas 0/3 osynliga. Kurvan/tidsaxeln (v(t)) är
  // helt opåverkad, bara PROJEKTIONEN på x — periodiciteten (v(winStart)===v(winEnd))
  // som fönstrets bredd bygger på gäller därför fortfarande exakt.
  const hasWidthFrac = (ap.phases || []).length && ap.phases.every(s => s.widthFrac != null);
  let x;
  if(hasWidthFrac){
    let cum = 0;
    const segs = ap.phases.map(s => { const seg = {from: s.from, to: s.to, x0: cum, x1: cum + s.widthFrac}; cum += s.widthFrac; return seg; });
    x = ms => {
      for(let i = 0; i < segs.length; i++){
        const s = segs[i];
        if(ms <= s.to || i === segs.length - 1){
          const p = clamp01r((ms - s.from) / ((s.to - s.from) || 1), 0, 1);
          return padL + (s.x0 + p * (s.x1 - s.x0)) * plotW;
        }
      }
      return padL;
    };
  } else {
    x = ms => padL + ((ms - winStart) / span) * plotW;
  }
  const y = mv => padT + (1 - (mv - vMin) / (vMax - vMin)) * plotH;

  g.fillStyle = "#FFF6F4"; g.fillRect(0, 0, W, H);

  // fasbakgrunder — subtila färgband, en per fysiologisk fas (se PHASE_COLORS ovan)
  (ap.phases || []).forEach(seg => {
    const x0 = Math.max(padL, x(seg.from)), x1 = Math.min(W - padR, x(seg.to));
    if(x1 > x0){ g.fillStyle = PHASE_COLORS[seg.key] || "transparent"; g.fillRect(x0, padT, x1 - x0, plotH); }
  });

  g.strokeStyle = "#F0D9D5"; g.lineWidth = 1; g.beginPath();
  for(let mv = vMin; mv <= vMax; mv += 20){ g.moveTo(padL, y(mv)); g.lineTo(W - padR, y(mv)); }
  const tickStep = span > 900 ? 200 : span > 400 ? 100 : 50;
  const firstTick = Math.ceil(winStart / tickStep) * tickStep;
  for(let t = firstTick; t <= winEnd; t += tickStep){ g.moveTo(x(t), padT); g.lineTo(x(t), H - padB); }
  g.stroke();
  g.strokeStyle = "#C9A5A0"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, H - padB); g.lineTo(W - padR, H - padB); g.stroke();
  // Streckad markering vid fas 0:s början (uppstroken) — för kammarcellen är det samma
  // som fönstrets egen t=0; SA-nodens fönster är centrerat kring uppstroken mitt i en
  // mycket längre cykel, så dess markering (markAt) ligger vid phase4Dur i stället.
  // Axelsiffrorna förblir ABSOLUT cykeltid i båda fallen (lättare att resonera om var i
  // cykeln man är, särskilt för SA-noden där "800" tydligt är cykelns slut/nästa fas 4).
  const markAt = ap.markAt ?? 0;
  g.strokeStyle = "#C9A5A0"; g.lineWidth = 1; g.setLineDash([2, 2]);
  g.beginPath(); g.moveTo(x(markAt), padT); g.lineTo(x(markAt), H - padB); g.stroke(); g.setLineDash([]);

  g.fillStyle = "#8a6f6b"; g.font = "10px ui-monospace,monospace";
  g.fillText("mV", 4, padT + 8);
  g.fillText("ms", W - padR - 16, H - padB + 12);
  for(let mv = vMin; mv <= vMax; mv += 40){ g.fillText(String(mv), 4, y(mv) + 3); }
  for(let t = firstTick; t <= winEnd; t += tickStep){ g.fillText(String(Math.round(t)), x(t) - 8, H - padB + 12); }

  g.strokeStyle = "#12181C"; g.lineWidth = 2; g.lineJoin = "round"; g.beginPath();
  // Fler samplingspunkter än annars nödvändigt — med en styckvis x-mappning kan en
  // fas som är KOMPRIMERAD i realtid (fas 0/3, mycket bildbredd men lite verklig tid)
  // annars bli underprovad och se hackig ut.
  const N = hasWidthFrac ? 600 : 260;
  for(let i = 0; i <= N; i++){
    const t = winStart + (i / N) * span;
    const px = x(t), py = y(clamp01r(ap.v(t), vMin, vMax));
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();

  if(ap.eadCenter != null){
    g.fillStyle = "#F44336"; g.font = "bold 10px Archivo,sans-serif";
    g.fillText("EAD", x(ap.eadCenter) - 10, y(ap.v(ap.eadCenter)) - 8);
  }
  // Refraktärperiod: en tunn markeringslinje UNDER tidsaxeln (i stället för ett andra,
  // konkurrerande bakgrundslager ovanpå fasfärgerna) — röd = absolut, gul = relativ.
  if(ap.arpEnd != null){
    const ly = H - padB + 20;
    g.lineWidth = 3; g.lineCap = "butt";
    g.strokeStyle = "#F44336"; g.beginPath(); g.moveTo(x(ap.t0), ly); g.lineTo(x(ap.arpEnd), ly); g.stroke();
    g.strokeStyle = "#FFC107"; g.beginPath(); g.moveTo(x(ap.arpEnd), ly); g.lineTo(x(ap.rrpEnd), ly); g.stroke();
    g.fillStyle = "#6B6B6B"; g.font = "9px Archivo,sans-serif";
    g.fillText("ARP", x(ap.t0) + 2, ly + 10);
    if(x(ap.rrpEnd) - x(ap.arpEnd) > 22) g.fillText("RRP", x(ap.arpEnd) + 2, ly + 10);
  }
}
