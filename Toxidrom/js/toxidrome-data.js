/* ---------- Toxidrom-detektiv: kategorier och toxidromdefinitioner ---------- */
/* Varje kategori har ett antal ömsesidigt uteslutande fynd, default "normal". Varje
   toxidrom anger vilka fynd som är klassiska (signs) och hur tungt de väger (weight) —
   matchningspoängen är bara en pedagogisk rangordning, inte en diagnostisk algoritm. */
const TOX_CATEGORIES = [
  {id:"pupils", label:"Pupiller", options:[
    {v:"miosis",t:"Mios (pinpoint)"},{v:"mydriasis",t:"Mydriasis (vida)"},{v:"normal",t:"Normala"}]},
  {id:"skin", label:"Hud", options:[
    {v:"dry",t:"Torr"},{v:"wet",t:"Fuktig/svettig"},{v:"normal",t:"Normal"}]},
  {id:"hr", label:"Hjärtfrekvens", options:[
    {v:"brady",t:"Bradykardi"},{v:"tachy",t:"Takykardi"},{v:"normal",t:"Normal"}]},
  {id:"bp", label:"Blodtryck", options:[
    {v:"hypo",t:"Hypotension"},{v:"hyper",t:"Hypertension"},{v:"normal",t:"Normalt"}]},
  {id:"breathing", label:"Andning", options:[
    {v:"depression",t:"Andningsdepression"},{v:"hyperventilation",t:"Hyperventilation/takypné"},{v:"normal",t:"Normal"}]},
  {id:"temp", label:"Temperatur", options:[
    {v:"hypo",t:"Hypotermi"},{v:"hyper",t:"Hypertermi"},{v:"normal",t:"Normal"}]},
  {id:"mental", label:"Mentalt status", options:[
    {v:"depression",t:"CNS-dämpning/sedering"},{v:"agitation",t:"Agitation/delirium"},{v:"normal",t:"Normalt/vaken"}]},
  {id:"tone", label:"Muskeltonus/reflexer", options:[
    {v:"hyperreflexia_clonus",t:"Hyperreflexi/klonus"},{v:"rigidity",t:"Rigiditet (\"blyrör\")"},
    {v:"fasciculations_weakness",t:"Fascikulationer/svaghet"},{v:"normal",t:"Normalt"}]},
  {id:"secretions", label:"Sekretion (saliv/tårar/luftvägar)", options:[
    {v:"increased",t:"Ökad (våt)"},{v:"decreased",t:"Minskad (torr)"},{v:"normal",t:"Normal"}]},
  {id:"bowel", label:"Tarmljud", options:[
    {v:"increased",t:"Ökade/diarré"},{v:"decreased",t:"Minskade/tysta"},{v:"normal",t:"Normala"}]}
];

const TOXIDROMES = [
  {
    id:"opioid", name:"Opioid",
    signs:{pupils:"miosis", mental:"depression", breathing:"depression", hr:"brady", temp:"hypo"},
    weight:{pupils:3, mental:2, breathing:3, hr:1, temp:1},
    antidote:"Naloxon 0,4–2 mg iv/im/intranasalt, upprepa vid behov (kort halveringstid jämfört med många opioider).",
    tips:["Klassisk triad: mios + CNS-dämpning + andningsdepression.","Ofta normal till låg puls och kroppstemperatur.","Naloxon kan ges diagnostiskt-terapeutiskt."]
  },
  {
    id:"sedative", name:"Sedativ-hypnotiskt (bensodiazepiner/alkohol/barbiturater)",
    signs:{mental:"depression", breathing:"depression", pupils:"normal", hr:"normal"},
    weight:{mental:2, breathing:1, pupils:1, hr:1},
    antidote:"Flumazenil endast vid ren bensodiazepinintox och med försiktighet (kramprisk vid blandintox/kroniskt bruk) — annars understödjande behandling.",
    tips:["Mindre uttalad andningsdepression än vid opioider om inte blandintox.","Ataxi och sluddrigt tal är typiskt.","Pupiller ofta normala eller lätt små."]
  },
  {
    id:"sympathomimetic", name:"Sympatomimetiskt (kokain/amfetamin m.fl.)",
    signs:{pupils:"mydriasis", skin:"wet", hr:"tachy", bp:"hyper", temp:"hyper", mental:"agitation"},
    weight:{pupils:2, skin:2, hr:3, bp:2, temp:2, mental:2},
    antidote:"Bensodiazepiner i första hand. Undvik betablockad i monoterapi (risk för oemotstådd alfastimulering).",
    tips:["Skiljs från antikolinergt genom FUKTIG hud och normala tarmljud (antikolinergt ger torr hud och tysta tarmljud)."]
  },
  {
    id:"anticholinergic", name:"Antikolinergt (TCA, antihistamin, Datura m.fl.)",
    signs:{pupils:"mydriasis", skin:"dry", hr:"tachy", temp:"hyper", mental:"agitation", bowel:"decreased", secretions:"decreased"},
    weight:{pupils:2, skin:3, hr:2, temp:1, mental:2, bowel:2, secretions:2},
    antidote:"Fysostigmin i utvalda fall (undvik vid TCA-intox pga kramp-/arytmirisk) — annars understödjande behandling.",
    tips:["Minnesregel: \"torr som ett ben, röd som en pepparkaka, blind som en fladdermus, het som en hare, galen som en hattmakare\".","Torr hud, urinretention och tysta tarmljud skiljer ut detta från sympatomimetiskt."]
  },
  {
    id:"cholinergic", name:"Kolinergt (organofosfater/nervgas/vissa svampar)",
    signs:{pupils:"miosis", secretions:"increased", bowel:"increased", hr:"brady", tone:"fasciculations_weakness", breathing:"depression"},
    weight:{pupils:2, secretions:3, bowel:2, hr:1, tone:2, breathing:1},
    antidote:"Atropin titrerat mot sekretion, ev. tillägg av pralidoxim (organofosfat).",
    tips:["Minnesregel SLUDGE/DUMBELS: salivation, tårflöde, urinavgång, diarré, GI-kramper, kräkning, mios, bronkorré/bronkospasm.","Muskelfascikulationer och svaghet är typiskt vid uttalad förgiftning."]
  },
  {
    id:"serotonin", name:"Serotonergt syndrom",
    signs:{temp:"hyper", mental:"agitation", tone:"hyperreflexia_clonus", hr:"tachy"},
    weight:{temp:2, mental:1, tone:3, hr:1},
    antidote:"Cyproheptadin (serotoninantagonist) i uttalade fall, i övrigt bensodiazepiner, kylning och understödjande behandling.",
    tips:["Klonus och hyperreflexi (särskilt nedre extremiteter) skiljer ut detta från malignt neuroleptikasyndrom.","Debuterar oftast snabbt (timmar) efter start/dosökning av serotonergt läkemedel eller interaktion."]
  },
  {
    id:"nms", name:"Malignt neuroleptikasyndrom (NMS)",
    signs:{temp:"hyper", tone:"rigidity", mental:"depression", hr:"tachy"},
    weight:{temp:2, tone:3, mental:1, hr:1},
    antidote:"Utsättning av antipsykotika, dantrolen eller bromokriptin i uttalade fall, kylning och understödjande behandling.",
    tips:["\"Blyrörsrigiditet\" och nedsatta reflexer — motsatsen till serotonergt syndroms klonus/hyperreflexi.","Debuterar över dagar snarare än timmar. CK ofta kraftigt förhöjt."]
  },
  {
    id:"salicylate", name:"Salicylatförgiftning",
    signs:{breathing:"hyperventilation", temp:"hyper", mental:"agitation"},
    weight:{breathing:3, temp:1, mental:1},
    antidote:"Natriumbikarbonat för att alkalinisera serum/urin, hemodialys vid uttalad förgiftning.",
    tips:["Tinnitus och hyperventilation (initial respiratorisk alkalos) är typiskt tidigt.","Vid uttalad förgiftning ses ofta en blandad syra-bas-rubbning."]
  }
];
