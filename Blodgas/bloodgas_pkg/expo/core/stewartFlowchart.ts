// Stewart method flowchart (SIDa -> SIDe -> SIG -> tolkning).
export const STEWART_FLOWCHART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 662" width="100%" style="height:auto;max-width:560px;display:block;margin:0 auto" role="img" aria-labelledby="sfc-title sfc-desc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <title id="sfc-title">Flödesschema för Stewarts metod</title>
  <desc id="sfc-desc">Stegen i Stewarts tolkning: beräkna SIDa, beräkna SIDe, jämför till strong ion gap (SIG) och tolka utifrån SIDa och SIG.</desc>
  <defs>
    <marker id="sfcArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#b0b0b0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .step  { font-size: 11px; font-weight: 700; letter-spacing: .03em; fill: #d32f2f; }
      .h     { font-size: 15px; font-weight: 700; fill: #1a1a1a; }
      .sub   { font-size: 12px; fill: #555; }
      .fcpillh { font-size: 12.5px; font-weight: 700; fill: #b3261e; }
      .fcpills { font-size: 11px; fill: #5f5f5f; }
      .card  { fill: #fff; stroke: #e4e4e4; stroke-width: 1; }
      .band  { fill: #fdecea; stroke: #f3c5bf; stroke-width: 1; }
      rect, line, circle, path, polygon, text { display: inline; }
      .fcpill { fill: #fdecea; stroke: #d9534f; stroke-width: 2; }
      .ln    { stroke: #c8c8c8; stroke-width: 1.4; fill: none; }
    </style>
  </defs>

  <rect class="band" x="90" y="20" width="500" height="81" rx="12"/>
  <text class="step" x="112" y="47">TRE OBEROENDE STORHETER</text>
  <text class="sub" x="112" y="67">pH och HCO₃⁻ bestäms av: pCO₂, svaga syror (albumin, fosfat)</text>
  <text class="sub" x="112" y="85">och differensen mellan starka katjoner och starka anjoner (SID).</text>
  <line class="ln" x1="340" y1="101" x2="340" y2="125" marker-end="url(#sfcArrow)"/>
  <rect class="card" x="110" y="127" width="460" height="89" rx="14"/>
  <text class="step" x="132" y="154">STEG 1 · SIDa (apparent)</text>
  <text class="h" x="132" y="178">SIDa = Na⁺ + K⁺ + 2·Ca²⁺ + 2·Mg²⁺ − Cl⁻</text>
  <text class="sub" x="132" y="200">De uppmätta starka jonerna. Normalt cirka 40 mmol/L.</text>
  <line class="ln" x1="340" y1="216" x2="340" y2="240" marker-end="url(#sfcArrow)"/>
  <rect class="card" x="110" y="242" width="460" height="89" rx="14"/>
  <text class="step" x="132" y="269">STEG 2 · SIDe (effektiv)</text>
  <text class="h" x="132" y="293">SIDe = HCO₃⁻ + laddning från albumin och fosfat</text>
  <text class="sub" x="132" y="315">Den laddning som balanseras av kända komponenter.</text>
  <line class="ln" x1="340" y1="331" x2="340" y2="355" marker-end="url(#sfcArrow)"/>
  <rect class="card" x="110" y="357" width="460" height="89" rx="14"/>
  <text class="step" x="132" y="384">STEG 3 · SIG (strong ion gap)</text>
  <text class="h" x="132" y="408">SIG = SIDa − SIDe</text>
  <text class="sub" x="132" y="430">Skillnaden = omätta starka anjoner (ketoner, sulfat, toxiner).</text>
  <line class="ln" x1="340" y1="446" x2="340" y2="470" marker-end="url(#sfcArrow)"/>
  <rect class="fcpill" x="40" y="470" width="190" height="79" rx="11"/>
  <text class="fcpillh" x="58" y="497">Lågt SIDa</text>
  <text class="fcpills" x="58" y="516">metabol acidos</text>
  <text class="fcpills" x="58" y="533">(hyperkloremi)</text>
  <rect class="fcpill" x="245" y="470" width="190" height="79" rx="11"/>
  <text class="fcpillh" x="263" y="497">Högt SIDa</text>
  <text class="fcpills" x="263" y="516">metabol alkalos</text>
  <text class="fcpills" x="263" y="533">(stark jon)</text>
  <rect class="fcpill" x="450" y="470" width="190" height="79" rx="11"/>
  <text class="fcpillh" x="468" y="497">Förhöjt SIG</text>
  <text class="fcpills" x="468" y="516">omätta anjoner</text>
  <text class="fcpills" x="468" y="533">(jfr. laktat)</text>
  <line class="ln" x1="340" y1="549" x2="340" y2="573" marker-end="url(#sfcArrow)"/>
  <rect class="band" x="110" y="575" width="460" height="63" rx="14"/>
  <text class="h" x="132" y="602">Störst nytta vid onormalt albumin</text>
  <text class="sub" x="132" y="622">Stewart korrigerar automatiskt för lågt albumin, som annars maskerar acidos.</text>
</svg>`;
