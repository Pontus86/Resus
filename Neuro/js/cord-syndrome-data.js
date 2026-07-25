/* ---------- Ryggmärgens tvärsnitt: klassiska inkompletta skadesyndrom ---------- */
/* affected = vilka regioner (se region-id:n i cord-syndrome-diagram.js) som skuggas
   röda = skadad vävnad vid respektive syndrom. Skuggningen visar VAR skadan sitter,
   inte var symtomen känns (texten förklarar den kliniska bilden). */
const CORD_SYNDROMES = [
  {
    id:"complete", name:"Komplett tvärsnittsskada",
    lesion:"complete",
    affected:["dorsalL","dorsalR","corticospinalL","corticospinalR","spinothalamicL","spinothalamicR","centralCore"],
    desc:"Fullständigt bortfall av motorik samt alla sensoriska modaliteter (smärta/temperatur och proprioception/vibration) bilateralt nedanför nivån. Ingen sakral sparing."
  },
  {
    id:"central", name:"Central cord syndrome",
    lesion:"central",
    affected:["centralCore"],
    desc:"Klassiskt efter cervikalt hyperextensionstrauma, ofta hos äldre med spondylos. Ger oproportionerligt större svaghet i armar/händer än i benen och varierande sensoriska bortfall. Den äldre förklaringen med en strikt arm–ben-laminering i kortikospinalbanan har svagt stöd; skadebiomekanik och segmentell gråsubstans-/nätverkspåverkan är sannolikare."
  },
  {
    id:"brownsequard", name:"Brown-Séquard (hemisektion, vä sida i denna bild)",
    lesion:"leftHalf",
    affected:["dorsalL","corticospinalL","spinothalamicL"],
    desc:"Halvsidig skada (här vänster). Ger ipsilateral (vänster) förlust av motorik samt proprioception/vibrationssinne nedanför nivån, men kontralateral (höger) förlust av smärta/temperatur — eftersom spinothalamusbanan redan korsat om ett par nivåer under inträdet i ryggmärgen."
  },
  {
    id:"anterior", name:"Anterior cord syndrome",
    lesion:"anterior",
    affected:["corticospinalL","corticospinalR","spinothalamicL","spinothalamicR"],
    desc:"Klassiskt vid a. spinalis anterior-infarkt (t.ex. efter aortakirurgi/aortadissektion). Bilateral förlust av motorik samt smärta/temperatur nedanför nivån, men bakstammarna (proprioception/vibrationssinne) är sparade eftersom de försörjs av a. spinalis posterior."
  },
  {
    id:"posterior", name:"Posterior cord syndrome",
    lesion:"posterior",
    affected:["dorsalL","dorsalR"],
    desc:"Ovanligt — isolerad förlust av proprioception/vibrationssinne (baksträngarna), med bevarad motorik och smärta/temperatur. Klassiskt vid a. spinalis posterior-infarkt. Vid B12-brist (subakut kombinerad degeneration) drabbas ofta även kortikospinalbanorna, till skillnad från den rena vaskulära bilden."
  }
];

/* Tvärsnittsprofilen växlar med HRA-segmentet. HRA bidrar med längdsegmenten; dessa
   kodritade tvärsnitt är pedagogiska nivårepresentanter, inte strukturer ur HRA-GLB:n. */
const CORD_LEVEL_PROFILES = {
  cervical:{
    outer:"M160 27 C101 25 57 55 53 115 C50 174 95 224 160 228 C225 224 270 174 267 115 C263 55 219 25 160 27 Z",
    gray:"M160 117 C149 107 143 85 129 72 C119 63 108 69 111 83 C114 97 127 106 126 120 C125 132 111 142 103 158 C97 171 107 180 121 172 C137 164 146 148 160 143 C174 148 183 164 199 172 C213 180 223 171 217 158 C209 142 195 132 194 120 C193 106 206 97 209 83 C212 69 201 63 191 72 C177 85 171 107 160 117 Z"
  },
  thoracic:{
    outer:"M160 34 C111 32 72 62 68 116 C65 169 104 210 160 214 C216 210 255 169 252 116 C248 62 209 32 160 34 Z",
    gray:"M160 116 C151 105 147 84 136 73 C127 64 118 70 121 84 C124 98 136 108 134 121 C132 134 119 145 113 157 C108 168 118 175 130 168 C143 160 151 145 160 141 C169 145 177 160 190 168 C202 175 212 168 207 157 C201 145 188 134 186 121 C184 108 196 98 199 84 C202 70 193 64 184 73 C173 84 169 105 160 116 Z"
  },
  lumbar:{
    outer:"M160 30 C106 28 62 58 58 116 C54 176 99 220 160 224 C221 220 266 176 262 116 C258 58 214 28 160 30 Z",
    gray:"M160 112 C148 102 142 80 126 68 C114 60 102 69 107 86 C111 102 126 110 123 124 C120 138 102 148 94 166 C88 181 101 192 119 182 C139 171 148 151 160 146 C172 151 181 171 201 182 C219 192 232 181 226 166 C218 148 200 138 197 124 C194 110 209 102 213 86 C218 69 206 60 194 68 C178 80 172 102 160 112 Z"
  },
  sacral:{
    outer:"M160 45 C119 43 87 70 84 117 C81 162 113 197 160 200 C207 197 239 162 236 117 C233 70 201 43 160 45 Z",
    gray:"M160 108 C147 98 139 79 124 72 C112 67 104 78 110 93 C116 107 128 114 124 128 C120 142 104 150 100 163 C97 175 111 183 126 174 C143 164 151 147 160 143 C169 147 177 164 194 174 C209 183 223 175 220 163 C216 150 200 142 196 128 C192 114 204 107 210 93 C216 78 208 67 196 72 C181 79 173 98 160 108 Z"
  }
};
