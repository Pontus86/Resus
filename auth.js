/* ---------- Resus: delat inlogg (Supabase Auth) ---------- */
/* Inkludera med EN rad på varje sida, relativ sökväg till denna fil (samma mönster som
   nav.js):
     <script src="auth.js"></script>                              (i Resus-roten)
     <script src="../auth.js"></script>                            (en mapp ner)
     <script src="../../../auth.js"></script>                      (tre mappar ner)
   Filen hittar och laddar SJÄLV lib/supabase.js (den riktiga klientbiblioteket, vendrad
   lokalt, ingen CDN) relativt sin egen plats, så resten av sidan bara behöver denna enda
   rad. Exponerar ett globalt `Auth`-objekt som andra moduler (HLR:s topplista, Checklistors
   favoriter/egna checklistor) kan använda för att läsa/skriva Supabase-tabeller SÅ ATT
   Row-Level-Security-policyer som kollar auth.uid() faktiskt fungerar — anropar man i
   stället de gamla hand-rullade fetch()-hjälparna (bara anon-nyckeln, ingen sessionstoken)
   ser RLS ingen inloggad användare alls.

   Inga lösenord att hantera: passwordless via e-post — men som en 6-siffrig KOD att skriva
   in i appen, INTE en klickbar länk. Sidan öppnas som en lokal fil (file://), och en
   webbläsare vägrar av säkerhetsskäl att navigera toppfönstret från Supabase:s https-sida
   till en file://-URL (samma sorts restriktion som blockerade ES-modul-pdf.js under
   file://) — därför skulle länken i mailet aldrig komma hela vägen tillbaka hit. Koden
   verifieras i stället via ett vanligt bakgrunds-API-anrop (verifyEmailCode), ingen
   navigering alls, så den fungerar oavsett file:// eller riktig http(s)-hosting.
   Kräver att Supabase-projektets mailmall ("Magic Link") innehåller {{ .Token }} — se
   sql/membership.sql-kommentaren eller README för exakt dashboard-inställning.

   Inloggning är en TILLÄGGSFUNKTION, inte en spärr — allt fungerar precis som förut utan
   inlogg, inlogg låser bara upp synk av favoriter/historik mellan enheter. */
(function(){
  const scriptEl = document.currentScript;
  const srcAttr = scriptEl ? scriptEl.getAttribute("src") : "auth.js";
  const BASE = srcAttr.replace(/auth\.js(\?.*)?$/, "");

  const SUPABASE_URL = "https://trkuxocctupduxwxtwkh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_zxcM6jYZnNNV32FvT0FlBA_a6ZUO1kn";

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Kunde inte ladda " + src));
      document.head.appendChild(s);
    });
  }

  const listeners = [];
  let currentUser = null;
  let client = null;

  const ready = (async () => {
    if(!window.supabase) await loadScript(BASE + "lib/supabase.js");
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session } } = await client.auth.getSession();
    currentUser = session ? session.user : null;
    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      listeners.forEach(fn => { try{ fn(currentUser); }catch(e){ console.error(e); } });
    });
    return client;
  })();

  window.Auth = {
    ready,                                     // await Auth.ready innan du litar på getUser()/client
    get client(){ return client; },            // Supabase-klienten, för .from(...) mot valfri tabell
    getUser(){ return currentUser; },          // null = inte inloggad
    async sendLoginCode(email){
      await ready;
      // shouldCreateUser: true så en förstagångsmail också fungerar (annars krävs att
      // kontot redan finns). emailRedirectTo sätts ändå, ofarligt — bara oanvänd om man
      // klickar länken i stället för att skriva koden.
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.href } });
      if(error) throw error;
    },
    async verifyEmailCode(email, token){
      await ready;
      const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
      if(error) throw error;
    },
    async signOut(){ await ready; await client.auth.signOut(); },
    onChange(fn){ listeners.push(fn); return () => { const i=listeners.indexOf(fn); if(i>=0) listeners.splice(i,1); }; }
  };
})();
