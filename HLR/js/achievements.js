/* ---------- Låsbara läkarprofiler: register + upplåsningsvillkor (achievements) ---------- */
/* Pontus/Eric var de två ursprungliga profilerna (state.js/main.js), alltid upplåsta. De 6
   nedan är nya, låsta från start — "locked:true". Varje låst profil har ANTINGEN en
   flerspels-räknare (counterKey/target, räknas upp av evaluateGameEnd per spel) ELLER ett
   engångsvillkor kollat direkt mot slutstatet (S) i checks{} nedan — aldrig båda.
   Bilder saknas ännu (riktiga foton kommer senare, se Player_images/) — badge/color ritar en
   enkel initial-bricka i profilväljaren tills dess, se main.js:s profilkorts-rendering. */
const DOCTOR_PROFILES = [
  {id:"pontus", name:"Pontus", role:"Proceduralist", perk:"Alla procedurer 30 % snabbare.",
    img:"Player_images/Pontus, akutläk.png", locked:false},
  {id:"eric", name:"Eric", role:"Teamledare", perk:"Teamet avlastar varandra direkt, glömmer aldrig en uppgift.",
    img:"Player_images/Eric_akutläk.png", locked:false},
  {id:"freja", name:"Freja Lindqvist", role:"Anestesiolog", perk:"Luftväg/intubation 40 % snabbare.",
    locked:true, badge:"FL", color:"#8E44AD",
    achText:"Säkra luftvägen (tub, i-gel eller koniotomi) i 10 spel", counterKey:"airwaySecured", target:10},
  {id:"johan", name:"Johan Ek", role:"Ultraljudsspecialist", perk:"Ultraljudsundersökningar (hjärta/FAST/lunga) 50 % snabbare.",
    locked:true, badge:"JE", color:"#27AE60",
    achText:"Hitta och åtgärda en reversibel orsak i 5 olika spel", counterKey:"causeFound", target:5},
  {id:"alex", name:"Alex Berg", role:"IVA-sjuksköterska", perk:"Kompressionskvaliteten håller sig hög dubbelt så länge innan trötthet ger avdrag.",
    locked:true, badge:"AB", color:"#16A085",
    achText:"ROSC med minst 90 % kompressionsandel, på Avancerad svårighet eller högre"},
  {id:"maria", name:"Maria Novak", role:"Kardiolog", perk:"Defibrillatorn laddar dubbelt så snabbt (2,5 s i stället för 5 s).",
    locked:true, badge:"MN", color:"#2980B9",
    achText:"Klara Expert-läget (eller högre) utan en enda felbedömd rytm- eller pulskontroll"},
  {id:"priya", name:"Priya Sharma", role:"Farmakolog/toxikolog", perk:"Läkemedel och antidoter ges 40 % snabbare.",
    locked:true, badge:"PS", color:"#D35400",
    achText:"Adrenalin givet i tid (var 3–5 min) genom en hel återupplivning på minst 15 minuter"},
  {id:"oskar", name:"Oskar Lindberg", role:"Senior traumaläkare", perk:"Komplikationer inträffar hälften så ofta, glömmer sällan uppgifter vid hög belastning.",
    locked:true, badge:"OL", color:"#7F8C8D",
    achText:"Klara Hardcore-läget med ROSC och noll komplikationer"}
];

/* localStorage är sanningskällan (funkar helt utloggat) — inloggad speglas UPPLÅSNINGAR
   (inte flerspels-räknarna, de är medvetet bara lokala, se filkommentaren ovan) till
   Supabase-tabellen "hlr_unlocked_profiles" så de följer med mellan enheter. */
const Achievements = (() => {
  const KEY = "resus_hlr_achievements";
  function readAll(){
    try{ return Object.assign({unlocked:[], counters:{}}, JSON.parse(localStorage.getItem(KEY))); }
    catch(e){ return {unlocked:[], counters:{}}; }
  }
  function writeAll(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }

  function isUnlocked(id){
    const p = DOCTOR_PROFILES.find(x => x.id === id);
    if(!p || !p.locked) return true;
    return readAll().unlocked.includes(id);
  }
  function unlockedIds(){ return readAll().unlocked; }
  function getCounter(key){ return readAll().counters[key] || 0; }

  function unlock(id){
    const data = readAll();
    if(data.unlocked.includes(id)) return false;
    data.unlocked.push(id); writeAll(data);
    const user = window.Auth && Auth.getUser();
    if(user){
      Auth.client.from("hlr_unlocked_profiles").upsert({user_id: user.id, profile_id: id})
        .then(({error}) => { if(error) console.error("hlr_unlocked_profiles: kunde inte spara", error); });
    }
    return true;
  }
  function bumpCounter(key){
    const data = readAll();
    data.counters[key] = (data.counters[key] || 0) + 1;
    writeAll(data);
    return data.counters[key];
  }

  async function syncFromServer(){
    if(!window.Auth) return;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return;
    const { data, error } = await Auth.client.from("hlr_unlocked_profiles").select("profile_id").eq("user_id", user.id);
    if(error){ console.error("hlr_unlocked_profiles: kunde inte hämta", error); return; }
    const local = readAll();
    const known = new Set((data||[]).map(r => r.profile_id));
    const merged = new Set(local.unlocked);
    known.forEach(id => merged.add(id));
    local.unlocked = [...merged];
    writeAll(local);
    // Lokala upplåsningar som servern inte kände till (samma enhet låste upp innan inlogg).
    const toPush = local.unlocked.filter(id => !known.has(id));
    if(toPush.length){
      Auth.client.from("hlr_unlocked_profiles").upsert(toPush.map(id => ({user_id: user.id, profile_id: id})))
        .then(({error}) => { if(error) console.error("hlr_unlocked_profiles: kunde inte synka", error); });
    }
  }

  // Körs EN gång per avslutat spel (showResults() i tick.js). Räknar upp flerspels-räknarna,
  // utvärderar samtliga låsta profilers villkor mot slutstatet S, och låser upp nya profiler.
  // Returnerar de profilobjekt som PRECIS låstes upp (för en hyllningsruta i resultatvyn).
  function evaluateGameEnd(S){
    if(["freja","johan","alex","maria","priya","oskar"].every(isUnlocked)) return [];

    if(["tub","igel","koniotomi"].includes(S.airway)) bumpCounter("airwaySecured");
    if((S.causes||[]).some(c => c.treatedAt != null)) bumpCounter("causeFound");

    const levelRank = {guided:0, normal:1, advanced:2, expert:3, hardcore:4};
    const rank = levelRank[S.level] || 0;
    const arrestSpan = Math.max(1, S.arrestTime || S.t || 1);
    const compressionFraction = 1 - Math.min(1, (S.handsOff||0) / arrestSpan);
    const adr = S.adrenalin || [];
    const adrGaps = []; for(let i=1;i<adr.length;i++) adrGaps.push(adr[i]-adr[i-1]);
    const adrOnTime = S.t >= 900 && adr.length >= 3 && adrGaps.every(g => g >= 150 && g <= 330);
    const rq = S.rhythmQuiz || {total:0, correct:0, pulseTotal:0, pulseCorrect:0};
    const perfectRhythm = rq.total > 0 && rq.correct === rq.total && rq.pulseTotal === rq.pulseCorrect;

    const checks = {
      freja: () => getCounter("airwaySecured") >= 10,
      johan: () => getCounter("causeFound") >= 5,
      alex:  () => S.rosc && rank >= 2 && compressionFraction >= 0.9,
      maria: () => S.rosc && rank >= 3 && perfectRhythm,
      priya: () => S.rosc && adrOnTime,
      oskar: () => S.rosc && S.level === "hardcore" && (S.complicationsFired||0) === 0
    };
    const newlyUnlocked = [];
    Object.keys(checks).forEach(id => {
      if(!isUnlocked(id) && checks[id]() && unlock(id)) newlyUnlocked.push(DOCTOR_PROFILES.find(p => p.id === id));
    });
    return newlyUnlocked;
  }

  return {isUnlocked, unlockedIds, unlock, getCounter, syncFromServer, evaluateGameEnd};
})();
