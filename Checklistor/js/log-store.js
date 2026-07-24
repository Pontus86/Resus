/* ---------- Loggning av genomförda procedurer (localStorage, + Supabase om inloggad) ---------- */
/* localStorage håller bara SJÄLVLOGGADE poster (entries den här enheten skapat, user_id=
   logged_by=jag) — det är vad som funkar helt utloggat. Inloggad speglas varje sådan post
   ÄVEN till Supabase-tabellen "checklist_logbook" (serverId sparas TILLBAKA på lokala
   entry:n när inserten svarar, så senare redigeringar/radering kan referera rätt serverrad
   även efter en sidladdning). Poster där en KOLLEGA taggat dig (logged_by != du, status
   'pending'/'confirmed'/'declined') lever bara server-sidan — de kan inte finnas innan du
   har ett konto, så de hämtas alltid live via fetchServerHistory, aldrig cachade lokalt.
   Se sql/membership.sql sektion 4+8 och Loggbok/js/main.js (som renderar bekräftelseflödet). */
const LogStore = (() => {
  const KEY = "resus_checklistor_log";
  const pendingServerIds = {}; // localId -> Promise<number|null>, för redigeringar som sker INNAN första insert hunnit svara

  function readAll(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch(e){ return []; }
  }
  function writeAll(entries){ localStorage.setItem(KEY, JSON.stringify(entries)); }
  function toIso(date){
    if(date == null) return new Date().toISOString();
    if(date instanceof Date) return date.toISOString();
    if(typeof date === "number") return new Date(date).toISOString();
    return date; // redan en ISO-sträng (t.ex. från ett datum-<input>, "YYYY-MM-DD")
  }

  function record(procedureId, opts){
    opts = opts || {};
    const localId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const iso = toIso(opts.date);
    const entry = {
      localId, procedureId, ts: new Date(iso).getTime(),
      name: opts.name || "",
      detail: opts.detail || "",
      durationS: opts.durationS != null ? opts.durationS : null,
      success: opts.success != null ? opts.success : null,
      status: "confirmed", serverId: null
    };
    const entries = readAll();
    entries.push(entry);
    writeAll(entries);

    const user = window.Auth && Auth.getUser();
    if(user){
      const p = Auth.client.from("checklist_logbook").insert({
        user_id: user.id, logged_by: user.id, status: "confirmed",
        checklist_id: procedureId, checklist_name: entry.name || null,
        detail: entry.detail || null, duration_s: entry.durationS, success: entry.success,
        created_at: iso
      }).select("id").single().then(({data, error}) => {
        if(error){ console.error("checklist_logbook: kunde inte spara", error); return null; }
        const all = readAll();
        const i = all.findIndex(e => e.localId === localId);
        if(i >= 0){ all[i].serverId = data.id; writeAll(all); }
        return data.id;
      });
      pendingServerIds[localId] = p;
    }
    return entry;
  }

  function serverIdFor(localId){
    const entry = readAll().find(e => e.localId === localId);
    if(entry && entry.serverId) return Promise.resolve(entry.serverId);
    return pendingServerIds[localId] || Promise.resolve(null);
  }

  // patch kan innehålla: date (Date/ms/ISO), durationS, success, detail, name.
  function updateEntry(localId, patch){
    const entries = readAll();
    const i = entries.findIndex(e => e.localId === localId);
    if(i < 0) return;
    const dbPatch = {};
    if("date" in patch){ const iso = toIso(patch.date); entries[i].ts = new Date(iso).getTime(); dbPatch.created_at = iso; }
    if("durationS" in patch){ entries[i].durationS = patch.durationS; dbPatch.duration_s = patch.durationS; }
    if("success" in patch){ entries[i].success = patch.success; dbPatch.success = patch.success; }
    if("detail" in patch){ entries[i].detail = patch.detail; dbPatch.detail = patch.detail; }
    if("name" in patch){ entries[i].name = patch.name; dbPatch.checklist_name = patch.name; }
    writeAll(entries);

    const user = window.Auth && Auth.getUser();
    if(!user || !Object.keys(dbPatch).length) return;
    serverIdFor(localId).then(serverId => {
      if(!serverId) return;
      Auth.client.from("checklist_logbook").update(dbPatch).eq("id", serverId)
        .then(({error}) => { if(error) console.error("checklist_logbook: kunde inte uppdatera", error); });
    });
  }

  function deleteEntry(localId){
    const entries = readAll();
    const entry = entries.find(e => e.localId === localId);
    writeAll(entries.filter(e => e.localId !== localId));
    const user = window.Auth && Auth.getUser();
    if(!user || !entry) return;
    serverIdFor(localId).then(serverId => {
      if(!serverId) return;
      Auth.client.from("checklist_logbook").delete().eq("id", serverId)
        .then(({error}) => { if(error) console.error("checklist_logbook: kunde inte radera", error); });
    });
  }

  function countFor(procedureId){
    return readAll().filter(e => e.procedureId === procedureId).length;
  }
  function recentFor(procedureId, limit){
    return readAll().filter(e => e.procedureId === procedureId)
      .sort((a,b) => b.ts - a.ts).slice(0, limit || 5);
  }
  function allLocal(){ return readAll(); }

  // ALLA rader där user_id=jag, oavsett status — Loggbok-modulen delar upp i "din historik"
  // (status confirmed/declined) och "väntar bekräftelse" (status pending, dvs. en kollega
  // har taggat dig) genom att filtrera detta enda svaret, i stället för två separata anrop.
  async function fetchServerHistory(limit){
    if(!window.Auth) return null;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return null;
    const { data, error } = await Auth.client.from("checklist_logbook")
      .select("id,checklist_id,checklist_name,detail,duration_s,success,status,logged_by,created_at")
      .eq("user_id", user.id).order("created_at", {ascending:false}).limit(limit || 1000);
    if(error){ console.error("checklist_logbook: kunde inte hämta", error); return null; }
    return data;
  }

  // Taggar en KOLLEGA (via användarnamn, se usernames.js) på en procedur — skapar en rad i
  // DERAS loggbok med status 'pending', inte i din egen (RLS tillåter bara detta: se
  // "user can create own or tag others pending" i sql/membership.sql). De ser den i sin
  // "väntar bekräftelse"-lista och måste själva acceptera den för att den ska räknas.
  async function tagParticipant(username, procedureId, opts){
    if(!window.Auth) throw new Error("Kräver inlogg.");
    await Auth.ready;
    const me = Auth.getUser();
    if(!me) throw new Error("Kräver inlogg.");
    if(!window.Usernames) throw new Error("Användarnamnsstöd saknas.");
    const person = await Usernames.lookup(username);
    if(!person) throw new Error("Hittar ingen användare med det användarnamnet.");
    opts = opts || {};
    const { error } = await Auth.client.from("checklist_logbook").insert({
      user_id: person.user_id, logged_by: me.id, status: "pending",
      checklist_id: procedureId, checklist_name: opts.name || null,
      detail: opts.detail || null, duration_s: opts.durationS != null ? opts.durationS : null,
      success: opts.success != null ? opts.success : null, created_at: toIso(opts.date)
    });
    if(error) throw error;
    return person.username;
  }

  // Direkt server-redigering/radering VIA RADENS ID, för poster som inte nödvändigtvis har
  // en lokal motsvarighet (t.ex. en rad en kollega taggat dig på — den har aldrig funnits i
  // DIN localStorage). Loggbok-modulen använder dessa (inte updateEntry/deleteEntry) så fort
  // man är inloggad, oavsett postens ursprung — se filkommentaren om varför.
  async function updateEntryByServerId(serverId, patch){
    if(!window.Auth) return;
    await Auth.ready;
    const dbPatch = {};
    if("date" in patch) dbPatch.created_at = toIso(patch.date);
    if("durationS" in patch) dbPatch.duration_s = patch.durationS;
    if("success" in patch) dbPatch.success = patch.success;
    if("detail" in patch) dbPatch.detail = patch.detail;
    if("name" in patch) dbPatch.checklist_name = patch.name;
    const { error } = await Auth.client.from("checklist_logbook").update(dbPatch).eq("id", serverId);
    if(error){ console.error("checklist_logbook: kunde inte uppdatera", error); throw error; }
  }
  async function deleteEntryByServerId(serverId){
    if(!window.Auth) return;
    await Auth.ready;
    const { error } = await Auth.client.from("checklist_logbook").delete().eq("id", serverId);
    if(error){ console.error("checklist_logbook: kunde inte radera", error); throw error; }
  }

  // Accept/avvisa en rad NÅGON ANNAN taggat dig på (serverId = raden i checklist_logbook).
  async function respondToEntry(serverId, accept){
    if(!window.Auth) return;
    await Auth.ready;
    const { error } = await Auth.client.from("checklist_logbook")
      .update({status: accept ? "confirmed" : "declined"}).eq("id", serverId);
    if(error){ console.error("checklist_logbook: kunde inte svara på taggning", error); throw error; }
  }

  // Körs en gång vid inlogg: pushar lokala poster som ALDRIG kom iväg (skapade innan
  // inlogget fanns, eller offline) — matchar mönstret i RatingStore.syncFromServer.
  async function syncFromServer(){
    if(!window.Auth) return;
    await Auth.ready;
    const user = Auth.getUser();
    if(!user) return;
    const entries = readAll();
    const toPush = entries.filter(e => !e.serverId);
    if(!toPush.length) return;
    const rows = toPush.map(e => ({
      user_id: user.id, logged_by: user.id, status: e.status || "confirmed",
      checklist_id: e.procedureId, checklist_name: e.name || null, detail: e.detail || null,
      duration_s: e.durationS, success: e.success, created_at: new Date(e.ts).toISOString()
    }));
    const { data, error } = await Auth.client.from("checklist_logbook").insert(rows).select("id");
    if(error){ console.error("checklist_logbook: kunde inte synka lokala poster", error); return; }
    const all = readAll();
    toPush.forEach((pushed, i) => {
      const idx = all.findIndex(e => e.localId === pushed.localId);
      if(idx >= 0 && data[i]) all[idx].serverId = data[i].id;
    });
    writeAll(all);
  }

  return {record, updateEntry, deleteEntry, updateEntryByServerId, deleteEntryByServerId,
    countFor, recentFor, allLocal, fetchServerHistory, tagParticipant, respondToEntry, syncFromServer};
})();
