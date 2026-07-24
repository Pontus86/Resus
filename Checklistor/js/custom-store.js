/* ---------- Egna checklistor: lagring i Supabase ---------- */
/* Samma Supabase-projekt som HLR:s topplista, egen tabell "custom_checklists". Läsning är
   fortsatt öppen för alla (delade referenser är nyttiga för hela teamet), men skrivning
   (redigera/radera) är nu låst till ÄGAREN via owner_id + RLS — se sql/membership.sql.
   Checklistor skapade INNAN inlogget fanns (owner_id null) förblir fritt redigerbara av
   alla, så inget befintligt innehåll låses ute retroaktivt.
   Använder Auth.client (auth.js) i stället för en hand-rullad fetch med bara anon-nyckeln
   — annars bär förfrågan ingen sessionstoken, och RLS-policyer som kollar auth.uid() ser
   ingen inloggad användare alls även om man faktiskt är inloggad. */
const CustomStore = {
  async list(){
    await Auth.ready;
    const { data, error } = await Auth.client.from("custom_checklists").select("*").order("created_at", {ascending:false});
    if(error) throw error;
    return data;
  },
  async create(obj){
    await Auth.ready;
    const user = Auth.getUser();
    const row = Object.assign({owner_id: user ? user.id : null}, obj);
    const { data, error } = await Auth.client.from("custom_checklists").insert(row).select();
    if(error) throw error;
    return data[0];
  },
  async update(id, obj){
    await Auth.ready;
    const { data, error } = await Auth.client.from("custom_checklists").update(obj).eq("id", id).select();
    if(error) throw error;
    return data[0];
  },
  async remove(id){
    await Auth.ready;
    const { error } = await Auth.client.from("custom_checklists").delete().eq("id", id);
    if(error) throw error;
    return true;
  }
};

function customRowToProcedure(row){
  return {
    id: row.id,
    isCustom: true,
    ownerId: row.owner_id || null,
    name: row.name,
    shortDesc: row.short_desc || "",
    drugs: row.drugs || [],
    checklist: row.checklist || [],
    tags: row.tags || [],
    buildNote(ctx){ return buildStandardNote(this.name, "Läkemedel", this.checklist, ctx); }
  };
}
