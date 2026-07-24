/* ---------- Färgglada kort-bakgrunder ---------- */
/* Självständiga, inline SVG-illustrationer (data-URI, inga externa bildfiler) — en per
   inbyggd procedur plus en generisk standard för egna checklistor. Rent dekorativt: en
   gradient + ett lager av mjuka "bokeh"-cirklar + ett prickmönster för textur + ett
   stiliserat ikonmotiv, inte en anatomiskt exakt illustration. */
function _cardSvgBg(id, colorA, colorB, iconSvg){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/>
      </linearGradient>
      <pattern id="${id}-dots" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.6" fill="#fff" opacity=".18"/>
      </pattern>
      <radialGradient id="${id}-glow" cx="0.72" cy="0.22" r="0.75">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="260" fill="url(#${id})"/>
    <rect width="400" height="260" fill="url(#${id}-glow)"/>
    <rect width="400" height="260" fill="url(#${id}-dots)"/>
    <circle cx="60" cy="220" r="90" fill="#fff" opacity=".05"/>
    <circle cx="350" cy="40" r="70" fill="#fff" opacity=".06"/>
    ${iconSvg}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Fotorealistiska bakgrunder (beskurna ur images/Procedures.png, ett 4x4-rutnät) för de
// procedurer som redan finns som checklistor. Övriga 11 beskurna bilder i images/ (t.ex.
// cricothyrotomy.png, cardioversion.png) väntar på framtida checklistor med samma id.
const CARD_ART = {
  "sedation": "images/sedation.png",
  "chest-tube": "images/chest-tube.png",
  "central-line": "images/central-line.png",
  "lumbar-puncture": "images/lumbar-puncture.png",
  "intubation": "images/intubation.png",

  "_default": _cardSvgBg("g-def", "#E0685A", "#B23B7A",
    `<rect x="152" y="42" width="128" height="182" rx="14" fill="#fff" opacity=".1" transform="rotate(-4 216 133)"/>
    <g fill="#fff" opacity=".28">
      <rect x="140" y="30" width="140" height="200" rx="16"/>
      <rect x="185" y="18" width="50" height="22" rx="8"/>
    </g>
    <g stroke="#fff" stroke-width="7" opacity=".45" stroke-linecap="round">
      <line x1="163" y1="95" x2="200" y2="95"/><polyline points="158,95 163,101 172,86" fill="none"/>
      <line x1="163" y1="135" x2="255" y2="135"/>
      <line x1="163" y1="170" x2="255" y2="170"/>
      <line x1="163" y1="200" x2="225" y2="200"/>
    </g>`)
};
function cardArtFor(id){ return CARD_ART[id] || CARD_ART._default; }
