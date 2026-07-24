/* ---------- Resus: användarnamn (Supabase-tabellen "profiles") ---------- */
/* Samma en-rads-inkluderingsmönster som auth.js/nav.js, ladda EFTER auth.js:
     <script src="usernames.js"></script> / "../usernames.js" / "../../../usernames.js"
   Ett användarnamn krävs för att kunna TAGGA en kollega på en procedur i Loggbok-modulen
   (istället för att behöva veta/dela ut mailadresser) — se sql/membership.sql sektion 7/8.
   Exponerar window.Usernames. Rent tillägg: att inte sätta ett användarnamn hindrar bara
   deltagartaggning, allt annat funkar som förut. */
(function(){
  if(!window.Auth){ console.warn("usernames.js kräver att auth.js laddas först."); return; }
  const USERNAME_RE=/^[a-zA-Z0-9_]{3,20}$/;
  let cache=null; // {user_id, username} — liten synkron cache så UI inte behöver invänta nätverket varje gång

  async function myUsername(){
    await Auth.ready;
    const user=Auth.getUser();
    if(!user)return null;
    if(cache&&cache.user_id===user.id)return cache.username;
    const {data,error}=await Auth.client.from("profiles").select("username").eq("user_id",user.id).maybeSingle();
    if(error){ console.error("profiles: kunde inte hämta användarnamn",error); return null; }
    if(data){ cache={user_id:user.id,username:data.username}; return data.username; }
    return null;
  }
  async function setUsername(name){
    await Auth.ready;
    const user=Auth.getUser();
    if(!user)throw new Error("Inte inloggad.");
    name=(name||"").trim();
    if(!USERNAME_RE.test(name))throw new Error("Användarnamn måste vara 3–20 tecken: bokstäver, siffror eller understreck.");
    const {error}=await Auth.client.from("profiles").upsert({user_id:user.id,username:name});
    if(error){
      if(error.code==="23505")throw new Error("Användarnamnet är upptaget, välj ett annat.");
      throw error;
    }
    cache={user_id:user.id,username:name};
    return name;
  }
  // Slår upp en kollega via användarnamn (skiftlägesokänsligt) -> {user_id,username} eller null.
  async function lookup(username){
    await Auth.ready;
    username=(username||"").trim();
    if(!username)return null;
    const {data,error}=await Auth.client.from("profiles").select("user_id,username").ilike("username",username).maybeSingle();
    if(error){ console.error("profiles: sökning misslyckades",error); return null; }
    return data;
  }
  // Omvänd riktning mot lookup(): flera user_id -> {user_id: username}, för att visa VEM som
  // taggat dig på en loggbokspost (Loggbok-modulen) utan ett anrop per rad.
  async function lookupByIds(ids){
    await Auth.ready;
    ids=[...new Set(ids)].filter(Boolean);
    if(!ids.length)return {};
    const {data,error}=await Auth.client.from("profiles").select("user_id,username").in("user_id",ids);
    if(error){ console.error("profiles: gruppuppslag misslyckades",error); return {}; }
    const map={};
    (data||[]).forEach(r => map[r.user_id]=r.username);
    return map;
  }
  window.Usernames={myUsername,setUsername,lookup,lookupByIds,USERNAME_RE};
})();
