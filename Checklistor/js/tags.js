/* ---------- Taggar för filtrering + betygsättning (tumme upp/ner) ---------- */
const CHECKLIST_TAGS = ["Luftväg", "Thorax", "Kärlaccess", "Hjärta/rytm", "Ultraljudsledd", "Sedering", "Neuro/rygg"];

// Tumme upp/ner: localStorage är alltid den SYNKRONA sanningskällan (get/set måste vara
// synkrona — de anropas mitt i listrendering/sortering i main.js) och gäller lika för
// inbyggda och egna checklistor. Tristate per id: -1 (ner), 0 (obetygsatt), +1 (upp) —
// bestämmer sorteringen i listan (bäst överst).
// Inloggad (auth.js/Auth): betyg synkas ÄVEN till Supabase-tabellen "checklist_ratings" i
// bakgrunden, så favoriter följer med mellan enheter. Rent tillägg — utloggad funkar precis
// som förut, lokalt i webbläsaren, ingen nätverksväntan i get()/set().
const RatingStore = (() => {
  const KEY = "resus_checklistor_ratings";
  function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
  function writeAll(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }
  function get(id){ return readAll()[id] || 0; }
  function set(id, val, name){
    const all = readAll(); all[id] = val; writeAll(all);
    if(window.Auth && Auth.getUser()){
      Auth.client.from("checklist_ratings").upsert({user_id: Auth.getUser().id, checklist_id: id, value: val, checklist_name: name || null})
        .then(({error}) => { if(error) console.error("checklist_ratings upsert misslyckades", error); });
    }
  }
  // Körs en gång efter inloggning: hämtar användarens betyg från servern och slår ihop
  // med det som redan finns lokalt (t.ex. satt innan inloggning på samma enhet).
  // Server vinner där båda finns (redan synkat från en annan enhet); rent lokala betyg
  // som servern inte känner till skickas upp i stället för att tappas bort.
  async function syncFromServer(){
    if(!window.Auth) return false;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return false;
    const { data, error } = await Auth.client.from("checklist_ratings").select("checklist_id,value").eq("user_id", user.id);
    if(error){ console.error("checklist_ratings hämtning misslyckades", error); return false; }
    const local = readAll();
    const serverIds = new Set();
    (data||[]).forEach(row => { local[row.checklist_id] = row.value; serverIds.add(row.checklist_id); });
    writeAll(local);
    const toPush = Object.keys(local).filter(id => !serverIds.has(id) && local[id] !== 0);
    if(toPush.length){
      await Auth.client.from("checklist_ratings").upsert(
        toPush.map(id => ({user_id: user.id, checklist_id: id, value: local[id]}))
      );
    }
    return true;
  }
  // Stjärnmärkta (tumme upp) checklistor med namn, för "Mina resultat" (stats.js).
  async function fetchStarred(){
    if(!window.Auth) return null;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return null;
    const { data, error } = await Auth.client.from("checklist_ratings")
      .select("checklist_id,checklist_name").eq("user_id", user.id).eq("value", 1);
    if(error){ console.error("checklist_ratings hämtning misslyckades", error); return null; }
    return data;
  }
  return {get, set, syncFromServer, fetchStarred};
})();
