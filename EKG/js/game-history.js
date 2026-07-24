/* ---------- Rundhistorik för EKG-matchningsspelet (localStorage, + Supabase om inloggad) ---------- */
/* Samma mönster som Checklistor/js/log-store.js: localStorage är den synkrona sanningskällan,
   inloggad speglas varje avslutad runda ÄVEN till Supabase-tabellen "ekg_game_history" i
   bakgrunden, så "Mina resultat" kan visa trend över tid oavsett enhet. Rent tillägg —
   utloggat spel funkar precis som förut, bara utan att synka mellan enheter. */
const GameHistoryStore = (() => {
  const KEY = "resus_ekg_game_history";

  function readAll(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch(e){ return []; }
  }
  function writeAll(rows){ localStorage.setItem(KEY, JSON.stringify(rows)); }

  function record(entry){
    const row = {
      ts: Date.now(), level: entry.level, conditionCount: entry.conditionCount,
      match: entry.match, roundScore: entry.roundScore, perfect: !!entry.perfect,
      gaveUp: !!entry.gaveUp, hintsUsed: entry.hintsUsed || 0, targetLabels: entry.targetLabels || []
    };
    const rows = readAll();
    rows.unshift(row);
    while(rows.length > 300) rows.pop();
    writeAll(rows);

    const user = window.Auth && Auth.getUser();
    if(user){
      Auth.client.from("ekg_game_history").insert({
        user_id: user.id, level: row.level, condition_count: row.conditionCount,
        match_pct: row.match, round_score: row.roundScore, perfect: row.perfect,
        gave_up: row.gaveUp, hints_used: row.hintsUsed, target_labels: row.targetLabels.join(", ")
      }).then(({error}) => { if(error) console.error("ekg_game_history: kunde inte spara", error); });
    }
    return row;
  }

  function allLocal(){ return readAll(); }

  async function fetchServerHistory(limit){
    if(!window.Auth) return null;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return null;
    const { data, error } = await Auth.client.from("ekg_game_history")
      .select("level,condition_count,match_pct,round_score,perfect,gave_up,hints_used,target_labels,created_at")
      .eq("user_id", user.id).order("created_at", {ascending:false}).limit(limit || 500);
    if(error){ console.error("ekg_game_history: kunde inte hämta", error); return null; }
    return data;
  }

  return {record, allLocal, fetchServerHistory};
})();
