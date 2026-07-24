/* ===== Delad vågformsmodell (samma som vågforms-editorn) ===== */
/* ==========================================================================
   DELAD VÅGFORMSMODELL  (används av både spelet och vågforms-editorn)
   rhythmSample(spec, t, opts) -> normaliserat värde ~[-1.2, 1.2]
   Varje rytm beskrivs av en 'spec' med kind + parametrar. "beat"-rytmer
   ritas från kontrollpunkter (fas 0..1, värde) som interpoleras mjukt.
   ========================================================================== */
(function(root){
  function lerp(a,b,t){return a+(b-a)*t;}
  // monoton kubisk-ish interpolation mellan kontrollpunkter {p,v}
  function samplePoints(points, ph){
    if(!points||!points.length)return 0;
    if(ph<=points[0].p)return points[0].v;
    if(ph>=points[points.length-1].p)return points[points.length-1].v;
    let i=0; while(i<points.length-1 && points[i+1].p<ph)i++;
    const a=points[i], b=points[i+1];
    const span=(b.p-a.p)||1e-6; let t=(ph-a.p)/span;
    // smoothstep för mjukare kurvor (undviker hackiga hörn som ser "dåliga" ut)
    const s = t*t*(3-2*t);
    return lerp(a.v,b.v,s);
  }
  function phaseOf(t, rate, irregular, seed){
    const per=60/rate;
    if(!irregular){ return {ph:(((t%per)+per)%per)/per, beat:Math.floor(t/per)}; }
    // oregelbunden: bygg slagtider deterministiskt
    let tb=0,k=0,prev=0;
    const golden=0.6180339887;
    while(tb<=t){ prev=tb; const jit=1+irregular*(2*(((k*golden)%1))-1); tb+=per*jit; k++; }
    const span=tb-prev||per;
    return {ph:(t-prev)/span, beat:k-1};
  }
  function rhythmSample(spec, t, opts){
    opts=opts||{};
    const noise = opts.noise!=null?opts.noise:(spec.noise||0);
    const nz = noise? (Math.sin(t*137.13)*0.5+Math.sin(t*51.7)*0.5)*noise : 0; // pseudo-brus (deterministiskt)
    switch(spec.kind){
      case "flat":
        return Math.sin(t*2.2)*(spec.wander||0.05) + nz;
      case "sine": {
        const per=60/(spec.rate||38), ph=(((t%per)+per)%per)/per;
        return Math.sin(ph*Math.PI*2)*(spec.amp||0.8) + nz;
      }
      case "fib": {
        return Math.sin(t*(spec.f1||17))*(spec.amp||0.85)
             + Math.sin(t*(spec.f2||31))*(spec.amp2||0.45)*Math.sin(t*(spec.env||3)) + nz;
      }
      case "torsades": {
        const env=Math.abs(Math.sin(t*(spec.envF||0.9)));
        return Math.sin(t*(spec.osc||22))*((spec.ampMin||0.2)+(spec.ampMax||0.8)*env) + nz;
      }
      case "beat": {
        const {ph,beat}=phaseOf(t, spec.rate||70, spec.irregular||0);
        let v=samplePoints(spec.points, ph)*(spec.amp!=null?spec.amp:1);
        if(spec.flip && (beat%2)) v=-v;      // bidirektionell
        return v + nz;
      }
      default: return nz;
    }
  }
  root.rhythmSample = rhythmSample;
  root.samplePoints = samplePoints;

  /* ---- standardspecar för alla rytmer i spelet ---- */
  // beat-punkter: fas 0..1. Ett smalt, skarpt QRS = punkter tätt ihop.
  const QRS = (p0,rH,qD,sD,rV,qV,sV)=>[
    {p:p0-0.02,v:0},{p:p0-qD,v:qV},{p:p0,v:rV},{p:p0+sD,v:sV},{p:p0+sD+0.02,v:0}
  ];
  const RHYTHM_SPECS = {
    VF:        {kind:"fib", f1:17, f2:31, amp:0.85, amp2:0.45, env:3, noise:0.06, label:"VF (grovvågigt)"},
    VF_fine:   {kind:"fib", f1:17, f2:31, amp:0.25, amp2:0.18, env:3, noise:0.05, label:"VF (finvågigt)"},
    pVT_mono:  {kind:"beat", rate:190, amp:1, noise:0.03, label:"Pulslös VT (monomorf)",
                points:[{p:0,v:0},{p:0.20,v:0},{p:0.32,v:0.85},{p:0.55,v:0},{p:0.70,v:-0.20},{p:0.9,v:0},{p:1,v:0}]},
    torsades:  {kind:"torsades", osc:22, envF:0.9, ampMin:0.18, ampMax:0.80, noise:0.03, label:"Polymorf VT (torsades)"},
    bidirVT:   {kind:"beat", rate:170, amp:0.9, flip:true, noise:0.03, label:"Bidirektionell VT (digitalis)",
                points:[{p:0,v:0},{p:0.12,v:0},{p:0.26,v:0.9},{p:0.42,v:0},{p:1,v:0}]},
    asystoli:  {kind:"flat", wander:0.05, noise:0.05, label:"Asystoli"},
    organiserad:{kind:"beat", rate:80, amp:1, noise:0.02, label:"Organiserad rytm",
                points:[{p:0,v:0},{p:0.06,v:0.14},{p:0.10,v:0},{p:0.12,v:-0.16},{p:0.15,v:1.0},{p:0.18,v:-0.28},{p:0.20,v:0},{p:0.42,v:0.22},{p:0.5,v:0},{p:1,v:0}]},
    rosc:      {kind:"beat", rate:95, amp:1, noise:0.015, label:"Sinusrytm · ROSC",
                points:[{p:0,v:0},{p:0.06,v:0.16},{p:0.10,v:0},{p:0.12,v:-0.16},{p:0.15,v:1.0},{p:0.18,v:-0.28},{p:0.20,v:0},{p:0.40,v:0.26},{p:0.5,v:0},{p:1,v:0}]},
    // PEA-varianter
    pea_narrow:{kind:"beat", rate:55, amp:1, noise:0.03, label:"PEA (smala QRS)",
                points:[{p:0,v:0},{p:0.06,v:0.14},{p:0.10,v:0},{p:0.12,v:-0.14},{p:0.15,v:0.95},{p:0.18,v:-0.24},{p:0.21,v:0},{p:1,v:0}]},
    pea_narrowfast:{kind:"beat", rate:112, amp:0.75, noise:0.03, label:"PEA (smala, takykard)",
                points:[{p:0,v:0},{p:0.06,v:0.1},{p:0.10,v:0},{p:0.12,v:-0.12},{p:0.15,v:0.9},{p:0.18,v:-0.2},{p:0.21,v:0},{p:1,v:0}]},
    pea_brady: {kind:"beat", rate:32, amp:1, noise:0.03, label:"PEA (bradykard/agonal)",
                points:[{p:0,v:0},{p:0.10,v:0},{p:0.14,v:-0.16},{p:0.18,v:0.9},{p:0.24,v:-0.28},{p:0.30,v:0},{p:1,v:0}]},
    pea_idio:  {kind:"beat", rate:26, amp:1, noise:0.03, label:"PEA (idioventrikulär, breda)",
                points:[{p:0,v:0},{p:0.10,v:-0.45},{p:0.24,v:0.85},{p:0.40,v:-0.35},{p:0.5,v:0},{p:1,v:0}]},
    pea_sine:  {kind:"sine", rate:38, amp:0.8, noise:0.03, label:"PEA (sinusvåg, hyperkalemi)"},
    pea_wide:  {kind:"beat", rate:55, amp:0.85, noise:0.03, label:"PEA (breddökade QRS)",
                points:[{p:0,v:0},{p:0.06,v:0.1},{p:0.10,v:0},{p:0.14,v:-0.18},{p:0.22,v:0.85},{p:0.32,v:-0.24},{p:0.40,v:0},{p:1,v:0}]},
  };
  root.RHYTHM_SPECS = RHYTHM_SPECS;
})(typeof module!=="undefined"&&module.exports?module.exports:(this.WaveModel=this.WaveModel||{}));

