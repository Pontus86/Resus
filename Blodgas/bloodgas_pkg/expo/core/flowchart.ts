// Auto-generated from web/flowchart.svg. Uniform-padding 5-step layout.
export const FLOWCHART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 1104" width="100%" style="height:auto;max-width:560px;display:block;margin:0 auto" role="img" aria-labelledby="fc-title fc-desc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <title id="fc-title">Flödesschema för blodgastolkning</title>
  <desc id="fc-desc">En femstegsmetod för syra-bastolkning: korrigera för venöst prov, identifiera den dominerande rubbningen, kontrollera kompensationen, beräkna anjongapet, leta dolda rubbningar med Na-Cl-gapet och överväg sedan diagnoser.</desc>
  <defs>
    <marker id="fcArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
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

  <rect class="band" x="130" y="20" width="420" height="81" rx="12"/>
  <text class="step" x="152" y="47">OM VENÖST PROV</text>
  <text class="sub" x="152" y="67">Venöst pH är lägre och pCO₂ högre, så lägg till 0,03 på pH och</text>
  <text class="sub" x="152" y="85">dra bort 0,6 kPa från pCO₂ för att approximera arteriellt.</text>
  <line class="ln" x1="340" y1="101" x2="340" y2="125" marker-end="url(#fcArrow)"/>
  <rect class="card" x="110" y="127" width="460" height="89" rx="14"/>
  <text class="step" x="132" y="154">STEG 1 · DOMINERANDE RUBBNING</text>
  <text class="h" x="132" y="178">Klassificera utifrån pH</text>
  <text class="sub" x="132" y="200">pH &lt; 7,35 = acidemi · pH &gt; 7,45 = alkalemi · 7,35–7,45 = kolla gapet.</text>
  <line class="ln" x1="340" y1="216" x2="340" y2="240" marker-end="url(#fcArrow)"/>
  <text class="step" x="120" y="256" fill="#777">RESPIRATORISKT (pCO₂)</text>
  <text class="step" x="560" y="256" fill="#777" text-anchor="end">METABOLT (HCO₃⁻ / BE)</text>
  <rect class="fcpill" x="40" y="268" width="270" height="79" rx="11"/>
  <text class="fcpillh" x="58" y="295">Respiratorisk acidos</text>
  <text class="fcpills" x="58" y="314">pH lågt, pCO₂ &gt; 5,6 kPa</text>
  <text class="fcpills" x="58" y="331">Orsaker: DEPRESS</text>
  <rect class="fcpill" x="370" y="268" width="270" height="79" rx="11"/>
  <text class="fcpillh" x="388" y="295">Metabol acidos</text>
  <text class="fcpills" x="388" y="314">pH lågt, HCO₃⁻ / BE lågt</text>
  <text class="fcpills" x="388" y="331">→ gå till steg 3 (anjongap)</text>
  <rect class="fcpill" x="40" y="357" width="270" height="79" rx="11"/>
  <text class="fcpillh" x="58" y="384">Respiratorisk alkalos</text>
  <text class="fcpills" x="58" y="403">pH högt, pCO₂ &lt; 5,1 kPa</text>
  <text class="fcpills" x="58" y="420">Orsaker: APA / STAPLES</text>
  <rect class="fcpill" x="370" y="357" width="270" height="79" rx="11"/>
  <text class="fcpillh" x="388" y="384">Metabol alkalos</text>
  <text class="fcpills" x="388" y="403">pH högt, HCO₃⁻ / BE högt</text>
  <text class="fcpills" x="388" y="420">Orsaker: CLEVER PD</text>
  <line class="ln" x1="340" y1="436" x2="340" y2="454" marker-end="url(#fcArrow)"/>
  <rect class="card" x="110" y="456" width="460" height="125" rx="14"/>
  <text class="step" x="132" y="483">STEG 2 · KOMPENSATION</text>
  <text class="h" x="132" y="507">Är det sekundära svaret adekvat?</text>
  <text class="sub" x="132" y="529">Metabolt: förväntat ΔpCO₂ = SBE × 0,1 (± 1) kPa.</text>
  <text class="sub" x="132" y="547">Respiratoriskt: akut SBE ≈ 0; kroniskt SBE ≈ ΔpCO₂ × 3 (± 3).</text>
  <text class="sub" x="132" y="565">Utanför förväntat intervall → en andra, blandad rubbning.</text>
  <line class="ln" x1="340" y1="581" x2="340" y2="605" marker-end="url(#fcArrow)"/>
  <rect class="card" x="110" y="607" width="460" height="89" rx="14"/>
  <text class="step" x="132" y="634">STEG 3 · ANJONGAP</text>
  <text class="h" x="132" y="658">AG = Na⁺ − Cl⁻ − HCO₃⁻</text>
  <text class="sub" x="132" y="680">Om pCO₂ &lt; 3,3 eller &gt; 7,3 kPa, använd faktiskt HCO₃⁻ (ej standard).</text>
  <line class="ln" x1="340" y1="696" x2="340" y2="720" marker-end="url(#fcArrow)"/>
  <rect class="fcpill" x="40" y="722" width="190" height="62" rx="11"/>
  <text class="fcpillh" x="58" y="749">Högt gap (&gt; 12)</text>
  <text class="fcpills" x="58" y="768">MUDPILERS · kolla laktat</text>
  <rect class="fcpill" x="245" y="722" width="190" height="62" rx="11"/>
  <text class="fcpillh" x="263" y="749">Normalt gap</text>
  <text class="fcpills" x="263" y="768">USEDCRAP (hyperkloremiskt)</text>
  <rect class="fcpill" x="450" y="722" width="190" height="62" rx="11"/>
  <text class="fcpillh" x="468" y="749">Lågt / negativt gap</text>
  <text class="fcpills" x="468" y="768">LIMB</text>
  <line class="ln" x1="340" y1="784" x2="340" y2="808" marker-end="url(#fcArrow)"/>
  <rect class="card" x="110" y="810" width="460" height="107" rx="14"/>
  <text class="step" x="132" y="837">STEG 4 · DOLDA RUBBNINGAR</text>
  <text class="h" x="132" y="861">Na–Cl-gap = Na⁺ − Cl⁻ − 33 (normalt ~0)</text>
  <text class="sub" x="132" y="883">Högt → samtidig metabol alkalos · Lågt → samtidig NAGMA.</text>
  <text class="sub" x="132" y="901">Klassiskt alternativ: ΔAG + HCO₃⁻ &gt; 26 alkalos, &lt; 22 NAGMA.</text>
  <line class="ln" x1="340" y1="917" x2="340" y2="941" marker-end="url(#fcArrow)"/>
  <rect class="band" x="110" y="943" width="460" height="107" rx="14"/>
  <text class="step" x="132" y="970">STEG 5 · DIAGNOSER</text>
  <text class="h" x="132" y="994">Väv in siffrorna i den kliniska bilden</text>
  <text class="sub" x="132" y="1016">Integrera anamnes, status och övriga prover (laktat, glukos,</text>
  <text class="sub" x="132" y="1034">kreatinin). Om laktat förklarar hela ΔAG talar det mot andra anjoner.</text>
  <text class="sub" x="340" y="1084" text-anchor="middle" font-size="11" fill="#999">Baserat på Olsson de Capretz, Lindeman &amp; Dryver, Läkartidningen 2021;118:21087.</text>
</svg>`;
