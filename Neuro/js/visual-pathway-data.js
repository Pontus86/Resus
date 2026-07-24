/* ---------- Synbanan: skadelägen (båda sidor) och resulterande synfältsbortfall ---------- */
/* "level" grupperar vänster/höger-motsvarigheter av samma anatomiska nivå (kiasma finns
   bara en gång, den är medellinjestrukturen). Fältform per öga: se visual-pathway.js
   för hur "none"/"full"/"half" (med ev. offset för inkongruens)/"quad"/"halfSparing" ritas. */
const VISUAL_LESION_SITES = [
  {
    id:"nerve-R", level:1, sideLabel:"Höger", x:238, y:90,
    name:"Höger synnerv (n. opticus)",
    desc:"Total blindhet på höger öga (monokulärt bortfall) — vänster öga opåverkat. Skadan sitter före kiasma, drabbar bara det egna ögat.",
    L:{type:"none"}, R:{type:"full"}
  },
  {
    id:"nerve-L", level:1, sideLabel:"Vänster", x:122, y:90,
    name:"Vänster synnerv (n. opticus)",
    desc:"Total blindhet på vänster öga (monokulärt bortfall) — höger öga opåverkat. Skadan sitter före kiasma, drabbar bara det egna ögat.",
    L:{type:"full"}, R:{type:"none"}
  },
  {
    id:"chiasm", level:2, sideLabel:null, x:180, y:128,
    name:"Synnervskorsningen (chiasma opticum)",
    desc:"Bitemporal hemianopsi — bortfall av det yttre (temporala) synfältet på båda ögonen. Klassiskt vid hypofystumör som trycker på kiasma underifrån. Mittlinjestruktur, finns bara i ett exemplar.",
    L:{type:"half", side:"L", offset:0}, R:{type:"half", side:"R", offset:0}
  },
  {
    id:"tract-R", level:3, sideLabel:"Höger", x:258, y:176,
    name:"Höger traktus opticus",
    desc:"Vänstersidig homonym hemianopsi, klassiskt inkongruent (olika utbredning i de två ögonen) eftersom fibrerna ännu inte sorterats om fullständigt.",
    L:{type:"half", side:"L", offset:6}, R:{type:"half", side:"L", offset:-6}
  },
  {
    id:"tract-L", level:3, sideLabel:"Vänster", x:102, y:176,
    name:"Vänster traktus opticus",
    desc:"Högersidig homonym hemianopsi, klassiskt inkongruent (olika utbredning i de två ögonen) eftersom fibrerna ännu inte sorterats om fullständigt.",
    L:{type:"half", side:"R", offset:-6}, R:{type:"half", side:"R", offset:6}
  },
  {
    id:"temporal-R", level:4, sideLabel:"Höger", x:272, y:258,
    name:"Höger temporallob (Meyers loop)",
    desc:"Vänster övre kvadrantanopsi (\"pie in the sky\") — de nedre fibrerna i radiatio optica som slingrar genom temporalloben drabbas.",
    L:{type:"quad", side:"L", vert:"U"}, R:{type:"quad", side:"L", vert:"U"}
  },
  {
    id:"temporal-L", level:4, sideLabel:"Vänster", x:88, y:258,
    name:"Vänster temporallob (Meyers loop)",
    desc:"Höger övre kvadrantanopsi (\"pie in the sky\") — de nedre fibrerna i radiatio optica som slingrar genom temporalloben drabbas.",
    L:{type:"quad", side:"R", vert:"U"}, R:{type:"quad", side:"R", vert:"U"}
  },
  {
    id:"parietal-R", level:5, sideLabel:"Höger", x:228, y:228,
    name:"Höger parietallob",
    desc:"Vänster nedre kvadrantanopsi (\"pie on the floor\") — de övre fibrerna i radiatio optica genom parietalloben drabbas.",
    L:{type:"quad", side:"L", vert:"D"}, R:{type:"quad", side:"L", vert:"D"}
  },
  {
    id:"parietal-L", level:5, sideLabel:"Vänster", x:132, y:228,
    name:"Vänster parietallob",
    desc:"Höger nedre kvadrantanopsi (\"pie on the floor\") — de övre fibrerna i radiatio optica genom parietalloben drabbas.",
    L:{type:"quad", side:"R", vert:"D"}, R:{type:"quad", side:"R", vert:"D"}
  },
  {
    id:"occipital-R", level:6, sideLabel:"Höger", x:224, y:338,
    name:"Höger occipitallob (större lesion)",
    desc:"Vänstersidig homonym hemianopsi, kongruent (likartad på båda ögonen) — hela synbarken drabbad, inklusive makulaarean.",
    L:{type:"half", side:"L", offset:0}, R:{type:"half", side:"L", offset:0}
  },
  {
    id:"occipital-L", level:6, sideLabel:"Vänster", x:136, y:338,
    name:"Vänster occipitallob (större lesion)",
    desc:"Högersidig homonym hemianopsi, kongruent (likartad på båda ögonen) — hela synbarken drabbad, inklusive makulaarean.",
    L:{type:"half", side:"R", offset:0}, R:{type:"half", side:"R", offset:0}
  },
  {
    id:"pole-R", level:7, sideLabel:"Höger", x:206, y:372,
    name:"Höger occipitalpol (endast spetsen)",
    desc:"Vänstersidig homonym hemianopsi med makulasparande — den yttersta occipitalpolen (makularepresentationen, med dubbel blodförsörjning) klarar sig, central syn kvarstår.",
    L:{type:"halfSparing", side:"L", offset:0}, R:{type:"halfSparing", side:"L", offset:0}
  },
  {
    id:"pole-L", level:7, sideLabel:"Vänster", x:154, y:372,
    name:"Vänster occipitalpol (endast spetsen)",
    desc:"Högersidig homonym hemianopsi med makulasparande — den yttersta occipitalpolen (makularepresentationen, med dubbel blodförsörjning) klarar sig, central syn kvarstår.",
    L:{type:"halfSparing", side:"R", offset:0}, R:{type:"halfSparing", side:"R", offset:0}
  }
];
