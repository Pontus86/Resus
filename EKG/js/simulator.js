/* ---------- EKG-simulator: knapp-logik och mjuk övergångsanimation ---------- */
const TRANSITION_MS = 1000;

const Simulator = (() => {
  let active = new Set();
  let severities = {};   // id -> 0..1, tolkas som svårighetsgrad (spectrum) eller tidsförlopp (stages)
  let currentProfile = composeProfile([]);
  let animFrame = null;
  let canvasEl = null;
  let onFrame = null;   // anatomy.js-panelen (elektrisk axel/territorium/3D) prenumererar via setOnFrame

  function lerp(a, b, t){ return a + (b - a) * t; }

  function buildSeverityMap(){
    const m = {};
    active.forEach(id => { m[id] = getSeverity(id); });
    return m;
  }

  function getSeverity(id, fallback){
    if(severities[id]!=null) return severities[id];
    if(fallback!=null) return fallback;
    const c = ECG_CONDITIONS.find(x => x.id === id);
    return c ? defaultLevel(c) : 0.5;
  }

  function setSeverity(id, val){
    severities[id] = val;
    if(!active.has(id)) return;
    // Direkt omritning utan 1-sekundersövergång — reglaget ska kännas omedelbart lyhört
    // under drag, till skillnad från toggle() som medvetet glider mjukt över en sekund.
    if(animFrame){ cancelAnimationFrame(animFrame); animFrame = null; }
    const target = composeProfile([...active], buildSeverityMap());
    currentProfile = target;
    if(canvasEl) drawECG12(canvasEl, target);
    if(onFrame) onFrame(target);
  }

  function lerpProfile(from, to, t){
    const out = {};
    ECG_SCALAR_KEYS.forEach(k => { out[k] = lerp(from[k] ?? 0, to[k] ?? 0, t); });
    ["st", "tInvMap", "rsrPrime", "biphasicMap", "tAmpMap", "rAmpMap", "qAmpMap"].forEach(mapKey => {
      out[mapKey] = {};
      const leads = new Set([...Object.keys(from[mapKey]||{}), ...Object.keys(to[mapKey]||{})]);
      leads.forEach(l => { out[mapKey][l] = lerp((from[mapKey]||{})[l]||0, (to[mapKey]||{})[l]||0, t); });
    });
    // avBlock är ett diskret läge ("first"/"wenckebach"/"mobitz2"/"chb"/null), inte ett tal —
    // går inte att glida mellan, så det byts direkt till målets läge medan övriga fält
    // (hr, prInterval, atrialHr, escapeHr ...) ändå glider mjukt under övergångssekunden.
    out.avBlock = to.avBlock;
    return out;
  }

  function animateTo(targetProfile){
    if(animFrame) cancelAnimationFrame(animFrame);
    const fromProfile = currentProfile;
    const startTime = performance.now();
    function step(now){
      const t = Math.min(1, (now - startTime) / TRANSITION_MS);
      const interp = lerpProfile(fromProfile, targetProfile, t);
      currentProfile = interp;
      if(canvasEl) drawECG12(canvasEl, interp);
      if(onFrame) onFrame(interp);
      if(t < 1){ animFrame = requestAnimationFrame(step); }
      else { currentProfile = targetProfile; animFrame = null; if(onFrame) onFrame(targetProfile); }
    }
    animFrame = requestAnimationFrame(step);
  }

  function recompute(){
    const target = composeProfile([...active], buildSeverityMap());
    animateTo(target);
  }

  function toggle(id){
    const cond = ECG_CONDITIONS.find(c => c.id === id);
    if(!cond) return;
    if(active.has(id)){
      active.delete(id);
    } else {
      if(cond.group && !ECG_NONEXCLUSIVE_GROUPS.has(cond.group)){
        ECG_CONDITIONS.filter(c => c.group === cond.group && c.id !== id).forEach(c => active.delete(c.id));
      }
      active.add(id);
    }
    recompute();
    return [...active];
  }

  function reset(){
    active = new Set();
    recompute();
  }

  // Avbryter en ev. pågående 1-sekundersövergång utan att rita något — används när spelet
  // (game.js) tar över canvasen, så Simulators egen animateTo-loop inte målar över
  // spelets overlay-rendering under den sekund den annars skulle fortsätta snurra.
  function silentReset(){
    if(animFrame){ cancelAnimationFrame(animFrame); animFrame = null; }
    active = new Set();
    currentProfile = composeProfile([]);
  }

  function init(canvas){
    canvasEl = canvas;
    drawECG12(canvasEl, currentProfile);
  }

  function isActive(id){ return active.has(id); }
  function getActive(){ return [...active]; }
  function getProfile(){ return currentProfile; }
  function setOnFrame(fn){ onFrame = fn; }

  return {toggle, reset, silentReset, init, isActive, getActive, getSeverity, setSeverity, getProfile, setOnFrame};
})();
