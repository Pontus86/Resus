/* ---------- NIHSS: totalpoäng + heuristisk lokalisationsgissning ---------- */
/* Detta är EN pedagogisk tumregelsmotor, inte en validerad diagnostisk algoritm.
   Den poängsätter ett antal klassiska mönster (kärlterritorium/lakunärt/bakre
   skallgrop) mot de ifyllda NIHSS-posterna och returnerar de mest sannolika
   alternativen med kort motivering, så användaren tränar mönsterigenkänning. */

function nihssTotal(scores){
  return NIHSS_ITEMS.reduce((sum,item) => sum + (scores[item.id] ?? 0), 0);
}

function nihssLocalize(s){
  const armMax = Math.max(s.motorArmL||0, s.motorArmR||0);
  const legMax = Math.max(s.motorLegL||0, s.motorLegR||0);
  const leftWeak = (s.motorArmL||0) > 0 || (s.motorLegL||0) > 0;
  const rightWeak = (s.motorArmR||0) > 0 || (s.motorLegR||0) > 0;
  const leftArmVsLeg = (s.motorArmL||0) - (s.motorLegL||0);
  const rightArmVsLeg = (s.motorArmR||0) - (s.motorLegR||0);
  const aphasia = (s.language||0) > 0;
  const neglect = (s.neglect||0) > 0;
  const cortical = aphasia || neglect;
  const visualCut = (s.visual||0) > 0;
  const gazeAbn = (s.gaze||0) > 0;
  const anyWeak = leftWeak || rightWeak;
  const bilateralWeak = leftWeak && rightWeak;
  const locAbn = (s.loc||0) > 0 || (s.locq||0) > 0 || (s.locc||0) > 0;
  const ataxia = (s.ataxia||0) > 0;
  const dysarthria = (s.dysarthria||0) > 0;
  // Kontralateral sida av lesionen utifrån vilken kroppssida som är svag, om entydigt
  const lesionSide = (leftWeak && !rightWeak) ? "R" : (rightWeak && !leftWeak) ? "L" : null;

  const candidates = [];

  // Vänster MCA (dominant hemisfär, oftast vänster)
  if(rightWeak && aphasia){
    candidates.push({name:"Vänster mediacerebri-territorium (a. cerebri media, dominant hemisfär)",
      score: 3 + (armMax>=legMax?1:0) + (visualCut?1:0), region:"mca", side:"L",
      why:["Högersidig svaghet (arm ofta mer uttalad än ben)","Afasi talar för dominant (oftast vänster) hemisfär", visualCut?"Samtidigt högersidigt synfältsbortfall stärker kortikal lokalisation":null].filter(Boolean)});
  }
  // Höger MCA (icke-dominant)
  if(leftWeak && neglect && !aphasia){
    candidates.push({name:"Höger mediacerebri-territorium (a. cerebri media, icke-dominant hemisfär)",
      score: 3 + (armMax>=legMax?1:0) + (visualCut?1:0), region:"mca", side:"R",
      why:["Vänstersidig svaghet (arm ofta mer uttalad än ben)","Neglekt utan afasi talar för icke-dominant (oftast höger) hemisfär", visualCut?"Samtidigt vänstersidigt synfältsbortfall stärker kortikal lokalisation":null].filter(Boolean)});
  }
  // Isolerad afasi utan pares -- liten ytlig kortikal MCA-gren (t.ex. Brocas/Wernickes område).
  // Utan detta faller en sådan patient mellan stolarna: ovanstående två kräver BÅDA samtidig
  // extremitetssvaghet, så "afasi men inga pareser alls" matchade tidigare ingenting.
  if(aphasia && !anyWeak){
    candidates.push({name:"Isolerad afasi utan pares (liten kortikal MCA-gren, t.ex. Brocas/Wernickes område)",
      score: 2 + ((s.language||0)>=2?1:0), region:"mca", side:"L",
      why:["Afasi utan samtidig extremitetssvaghet talar för en liten, ytlig gren-infarkt snarare än ett helt MCA-territorium","Språk är i praktiken nästan alltid en vänsterhemisfärsfunktion, oavsett kroppssidans fynd"]});
  }
  // ACA
  if(leftWeak && leftArmVsLeg<0 && !cortical){
    candidates.push({name:"Höger anteriorcerebri-territorium (a. cerebri anterior)",
      score: 2 + (legMax>armMax?1:0), region:"aca", side:"R",
      why:["Bensvaghet mer uttalad än armsvaghet vänster sida","Avsaknad av tydlig kortikal signatur (afasi/neglekt)"]});
  }
  if(rightWeak && rightArmVsLeg<0 && !cortical){
    candidates.push({name:"Vänster anteriorcerebri-territorium (a. cerebri anterior)",
      score: 2 + (legMax>armMax?1:0), region:"aca", side:"L",
      why:["Bensvaghet mer uttalad än armsvaghet höger sida","Avsaknad av tydlig kortikal signatur (afasi/neglekt)"]});
  }
  // PCA / talamus
  if(visualCut && !anyWeak && !cortical){
    candidates.push({name:"Posteriorcerebri-territorium (a. cerebri posterior) / talamus",
      score: 3 + ((s.sensory||0)>0?1:0), region:"pca", side:null,
      why:["Isolerat synfältsbortfall utan pares eller tydliga kortikala fynd", (s.sensory||0)>0?"Samtidig sensibilitetsnedsättning talar för talamisk komponent":null].filter(Boolean)});
  }
  // Bilateralt PCA / Antons syndrom -- särskiljs från raden ovan genom att kräva HÖGSTA
  // synfältspoängen specifikt (bilateral hemianopsi/kortikal blindhet, inte bara ensidig),
  // se NIHSS_ITEMS "3. Synfält" i nihss-data.js. Högre score än raden ovan så den vinner
  // rankingen när den stämmer (strikt mer specifik/informativ än en generisk ensidig PCA-post).
  if((s.visual||0)===3 && !anyWeak){
    candidates.push({name:"Bilateralt posteriorcerebri-territorium — kortikal blindhet (Antons syndrom)",
      score: 5, region:"pca", side:null,
      why:["Bilateral hemianopsi/kortikal blindhet (högsta synfältspoängen) utan pares talar för bilateral occipital skada", "Vid samtidig konfabulation/bristande sjukdomsinsikt kring synbortfallet: klassiskt Antons syndrom"]});
  }
  // Arteria choroidea anterior (AChA) -- klassisk triad (hemipares + hemisensorisk nedsättning +
  // homonym hemianopsi) UTAN kortikal signatur. Faller annars mellan stolarna: MCA kräver
  // afasi/neglekt, PCA/talamus kräver frånvaro av pares, ACA kräver just bendominans -- en tät,
  // odifferentierad triad utan kortikala fynd matchade tidigare ingenting alls.
  if(anyWeak && visualCut && (s.sensory||0)>0 && !cortical){
    candidates.push({name:"Arteria choroidea anterior-territorium (djup capsulo-talamo-optisk skada)",
      score: 3 + (Math.max(armMax,legMax)>=3?1:0), region:"achoroidea", side:lesionSide,
      why:["Klassisk triad: hemipares + hemisensorisk nedsättning + homonym hemianopsi, UTAN afasi/neglekt","Talar för en djup skada som samtidigt drabbar capsula interna, thalamus och synbanan"]});
  }
  // Lakunärt: rent motoriskt
  if(anyWeak && !cortical && !visualCut && !ataxia && (s.sensory||0)===0){
    candidates.push({name:"Lakunär infarkt — ren motorisk hemipares (capsula interna/pons)",
      score: 2, region:"capsule", side:lesionSide,
      why:["Motorisk svaghet utan kortikala tecken (ingen afasi/neglekt), synfält och sensibilitet normala","Klassiskt mönster vid litet subkortikalt/pontint infarktfokus"]});
  }
  // Lakunärt: ren sensorisk
  if(!anyWeak && (s.sensory||0)>0 && !cortical && !visualCut){
    candidates.push({name:"Lakunär infarkt — ren sensorisk stroke (talamus)",
      score: 2, region:"thalamus", side:null,
      why:["Isolerad sensibilitetsnedsättning utan pares eller kortikala fynd — klassiskt talamiskt lakunärt mönster"]});
  }
  // Ataktisk hemipares / dysartri-clumsy hand
  if(ataxia && anyWeak && !cortical){
    candidates.push({name:"Lakunär infarkt — ataktisk hemipares (pons/capsula interna/cerebellum)",
      score: 2, region:"capsule", side:lesionSide,
      why:["Ataxi som är oproportionerligt uttalad i förhållande till pareseraden, utan kortikala fynd"]});
  }
  if(dysarthria && !anyWeak && !cortical && !ataxia){
    candidates.push({name:"Lakunär infarkt — dysartri/\"clumsy hand\" (pons/capsula interna)",
      score: 1, region:"capsule", side:null,
      why:["Isolerad dysartri utan pares, kortikala fynd eller ataxi"]});
  }
  // Bakre skallgrop / hjärnstam / basilaris
  if((ataxia && dysarthria) || (gazeAbn && bilateralWeak) || (locAbn && !cortical && (gazeAbn||bilateralWeak))){
    candidates.push({name:"Vertebrobasilärt territorium / hjärnstam (basilaristopp vid uttalad bild)",
      score: 2 + (bilateralWeak?1:0) + (gazeAbn?1:0) + (locAbn?1:0), region:"brainstem", side:null,
      why:[ataxia&&dysarthria?"Ataxi kombinerat med dysartri":null,
           gazeAbn?"Avvikande blickriktning (kärnpares/internukleär oftalmoplegi vid hjärnstamsskada)":null,
           bilateralWeak?"Bilaterala/korsade fynd talar mot ett enskilt supratentoriellt kärlterritorium":null,
           locAbn&&!cortical?"Sänkt medvetande utan kortikala fynd (afasi/neglekt) kan tala för hjärnstamsengagemang":null
          ].filter(Boolean)});
  }
  // Cerebellärt
  if(ataxia && !anyWeak && !cortical){
    candidates.push({name:"Cerebellärt territorium (PICA/AICA/SCA)",
      score: 2, region:"cerebellum", side:null,
      why:["Ataxi utan pares eller kortikala fynd talar för ett renodlat cerebellärt fokus"]});
  }

  if(candidates.length===0){
    candidates.push({name:"Inget tydligt fokalt mönster",
      score:0, region:"none", side:null,
      why:["De ifyllda posterna ger ingen stark signatur för ett specifikt kärlterritorium — överväg normalfynd, mycket lindrig skada, eller att flera mönster överlappar"]});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates.slice(0,3);
}

/* ---------- Stroke-mimics: differentialdiagnoser att alltid överväga ---------- */
/* Dessa ersätter inte den vaskulära lokalisationen ovan — de är påminnelser om vanliga
   "stroke mimics" som kan ge ett liknande NIHSS-mönster, med korta tips för att skilja ut dem. */
function nihssDifferentials(s){
  const anyWeak = (s.motorArmL||0)>0 || (s.motorArmR||0)>0 || (s.motorLegL||0)>0 || (s.motorLegR||0)>0;
  const aphasia = (s.language||0) > 0;
  const visualCut = (s.visual||0) > 0;
  const dysarthria = (s.dysarthria||0) > 0;
  const faceWeak = (s.face||0) > 0;
  const locAbn = (s.loc||0) > 0 || (s.locq||0) > 0 || (s.locc||0) > 0;
  const focalDeficit = anyWeak || aphasia || visualCut || dysarthria;

  const diffs = [];

  diffs.push({name:"Hypoglykemi",
    tip:"Kontrollera alltid P-glukos direkt vid varje akut fokalt bortfall — hypoglykemi kan ge stroke-liknande symtom som är helt reversibla efter glukostillförsel."});

  if(focalDeficit){
    diffs.push({name:"Postiktalt tillstånd (Todds pares) efter ett ospesifikt/\"tyst\" anfall",
      tip:"Fråga om känt krampanfall (skallbett, urinavgång, vittnesuppgift), postiktal förvirring/trötthet, tidigare epilepsi. Todds pares brukar klinga av gradvis inom timmar. Överväg EEG vid osäkerhet."});
  }

  if(locAbn){
    diffs.push({name:"Meningit/encefalit",
      tip:"Feber, nackstyvhet, fotofobi, snabbt insättande huvudvärk eller känd infektion talar för detta. Överväg blododling och LP (efter att blödning/expansivitet uteslutits) om misstanke finns."});
  }

  if(visualCut && !anyWeak){
    diffs.push({name:"Migrän med aura",
      tip:"Fråga om symtomen spred sig gradvis över 20–60 minuter (t.ex. synaura som vandrar över synfältet, följt av sensoriska symtom och sedan huvudvärk) snarare än kom plötsligt. Vanligare hos yngre patienter med tidigare liknande episoder."});
  }

  if(faceWeak){
    diffs.push({name:"Perifer facialispares (Bells pares)",
      tip:"Be patienten rynka pannan bilateralt. Central facialispares SPARAR pannan (bilateral kortikal innervering) — vid perifer pares är hela ansiktshalvan, inklusive pannan, drabbad."});
  }

  return diffs;
}
