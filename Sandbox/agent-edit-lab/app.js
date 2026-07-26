(() => {
  "use strict";

  const $=id=>document.getElementById(id);
  const preview=$("preview");
  const conversation=$("conversation");
  const storageKey="resus-agent-edit-lab-v1";
  const edits={};
  const editLog=[];
  const history=[];
  let selectedId=null;
  let originalMode=false;
  let draftCreatedAt=new Date().toISOString();

  const aliases={
    patient:["patient","patienten"],doctor:["doctor","läkaren","lakaren"],nurse:["nurse","sjuksköterskan","sjukskoterskan","ssk"],
    airway:["airway","luftväg","luftvag"],bed:["bed","brits","britsen"],lucas:["lucas"],defib:["defib","defibrillator"],
    ventilator:["ventilator"],cart:["cart","vagn","akutvagn"],monitor:["monitor","väggmonitor","vaggmonitor"],
    ecgstrip:["ekg","ecg"],room:["room","rummet","bakgrund"],roomcard:["akutrum","room card"],
    statusbar:["status","statusrad","timers"],topbar:["header","sidhuvud","top bar"],sidecolumn:["högerspalt","hogerspalt","sidebar"],
    teamcard:["team","teamstatus"],actions:["actions","åtgärder","atgarder","knappar"],pagegrid:["columns","kolumner","layout"]
  };
  const colors={
    red:"#c94237",blue:"#315d82",green:"#2f7d68",yellow:"#d5a72f",orange:"#d87534",
    white:"#ffffff",black:"#171a19",grey:"#9da6a1",gray:"#9da6a1",
    röd:"#c94237",rod:"#c94237",blå:"#315d82",bla:"#315d82",grön:"#2f7d68",gron:"#2f7d68",
    gul:"#d5a72f",vit:"#ffffff",svart:"#171a19",grå:"#9da6a1",gra:"#9da6a1"
  };

  function cleanState(value){
    return Object.assign({x:0,y:0,scale:1,rotation:0,hidden:false,background:"",color:"",
      radius:null,brightness:1,opacity:1},value||{});
  }
  function elementFor(id){return preview.querySelector(`[data-edit-id="${id}"]`);}
  function selectedElement(){return selectedId?elementFor(selectedId):null;}
  function elementName(id){
    const element=elementFor(id);
    return element?element.dataset.name:id;
  }
  function snapshot(){
    return JSON.stringify({edits,editLog});
  }
  function restoreSnapshot(serialized){
    const data=JSON.parse(serialized);
    Object.keys(edits).forEach(key=>delete edits[key]);
    Object.assign(edits,data.edits||{});
    editLog.splice(0,editLog.length,...(data.editLog||[]));
    applyAll();
    updateCount();
    save();
  }
  function remember(){
    history.push(snapshot());
    if(history.length>40)history.shift();
  }
  function stateFor(id){
    if(!edits[id])edits[id]=cleanState();
    return edits[id];
  }
  function applyState(id){
    const element=elementFor(id);
    if(!element)return;
    const hasEdit=Object.prototype.hasOwnProperty.call(edits,id);
    const state=cleanState(edits[id]);
    if(originalMode||!hasEdit){
      element.style.translate="";
      element.style.scale="";
      element.style.rotate="";
      element.style.background="";
      element.style.color="";
      element.style.borderRadius="";
      element.style.filter="";
      element.style.opacity="";
      element.style.visibility="";
      return;
    }
    // Separata transformegenskaper läggs ovanpå elementets ordinarie CSS-transform.
    // Därmed behåller exempelvis britsen sin perspektivvinkel när användaren flyttar den.
    element.style.translate=state.x||state.y?`${state.x}px ${state.y}px`:"";
    element.style.scale=state.scale===1?"":String(state.scale);
    element.style.rotate=state.rotation?`${state.rotation}deg`:"";
    element.style.background=state.background;
    element.style.color=state.color;
    element.style.borderRadius=state.radius===null?"":`${state.radius}px`;
    element.style.filter=state.brightness===1?"":`brightness(${state.brightness})`;
    element.style.opacity=String(state.opacity);
    element.style.visibility=state.hidden?"hidden":"";
  }
  function applyAll(){
    preview.querySelectorAll("[data-edit-id]").forEach(element=>applyState(element.dataset.editId));
  }
  function select(id,announce=false){
    preview.querySelectorAll(".is-selected").forEach(element=>element.classList.remove("is-selected"));
    selectedId=elementFor(id)?id:null;
    const element=selectedElement();
    if(element)element.classList.add("is-selected");
    $("selectedName").textContent=element?element.dataset.name:"ingenting";
    $("hideBtn").disabled=!element;
    document.querySelectorAll("[data-nudge]").forEach(button=>button.disabled=!element);
    if(announce&&element)addMessage("agent",`Jag har markerat ${element.dataset.name}. Vad vill du ändra?`);
  }
  function addMessage(role,text,persist=true){
    const message=document.createElement("div");
    message.className=`message ${role}`;
    message.textContent=text;
    const time=document.createElement("small");
    time.textContent=role==="agent"?"Lokal prototypagent":"Du";
    message.appendChild(time);
    conversation.appendChild(message);
    conversation.scrollTop=conversation.scrollHeight;
    if(persist)save();
  }
  function logEdit(id,description,property,value){
    editLog.push({target:id,name:elementName(id),description,property,value});
    updateCount();
  }
  function updateCount(){
    const count=editLog.length;
    $("changeCount").textContent=`${count} ${count===1?"ändring":"ändringar"}`;
  }
  function describeMove(direction,amount){
    const word={left:"vänster",right:"höger",up:"upp",down:"ned"}[direction];
    return `${word} ${amount}px`;
  }
  function nudge(id,direction,amount=12,quiet=false){
    if(!id)return false;
    const state=stateFor(id);
    if(direction==="left")state.x-=amount;
    if(direction==="right")state.x+=amount;
    if(direction==="up")state.y-=amount;
    if(direction==="down")state.y+=amount;
    if(direction==="bigger")state.scale=Math.min(2.2,state.scale+amount/100);
    if(direction==="smaller")state.scale=Math.max(.35,state.scale-amount/100);
    applyState(id);
    const description=direction==="bigger"?"större":direction==="smaller"?"mindre":`flyttad ${describeMove(direction,amount)}`;
    logEdit(id,description,direction,direction==="bigger"||direction==="smaller"?state.scale:amount);
    if(!quiet)addMessage("agent",`Klart — ${elementName(id)} är ${description}.`);
    save();
    return true;
  }
  function setVisual(id,property,value,description,quiet=false){
    if(!id)return false;
    stateFor(id)[property]=value;
    applyState(id);
    logEdit(id,description,property,value);
    if(!quiet)addMessage("agent",`Klart — ${elementName(id)} är ${description}.`);
    save();
    return true;
  }
  function findTarget(text){
    const normalized=text.toLowerCase();
    for(const [id,names] of Object.entries(aliases)){
      if(names.some(name=>normalized.includes(name)))return id;
    }
    return selectedId;
  }
  function amountFrom(text){
    if(/mycket|much|far|rejält|rejalt/.test(text))return 28;
    if(/lite|slightly|a little|något|nagot/.test(text))return 8;
    const match=text.match(/(\\d+)\\s*(?:px|pixel)/);
    return match?Math.min(100,Number(match[1])):14;
  }
  function applyEquipmentCluster(){
    remember();
    [["defib","left",22],["ventilator","left",18],["cart","right",18]].forEach(([id,direction,amount])=>nudge(id,direction,amount,true));
    ["defib","ventilator","cart"].forEach(id=>nudge(id,"bigger",8,true));
    addMessage("agent","Jag har flyttat defibrillatorn, ventilatorn och akutvagnen närmare britsen och gjort dem något större.");
  }
  function handlePrompt(raw){
    const text=raw.trim();
    if(!text)return;
    addMessage("user",text);
    const normalized=text.toLowerCase();
    if(/^(undo|ångra|angra)/.test(normalized)){undo();return;}
    if(/^(reset|återställ|aterstall)/.test(normalized)){resetAll();return;}
    if(/equipment|utrustning/.test(normalized)&&/closer|närmare|narmare|tighter|tätare|tatare/.test(normalized)){
      applyEquipmentCluster();return;
    }
    const target=findTarget(normalized);
    if(target)select(target);
    if(!target){
      addMessage("agent","Jag behöver veta vad du vill ändra. Klicka på ett element i förhandsvisningen eller skriv exempelvis ”gör patienten större”.");
      return;
    }
    const amount=amountFrom(normalized);
    if(/move|flytta|shift/.test(normalized)){
      remember();
      if(/left|vänster|vanster/.test(normalized)){nudge(target,"left",amount);return;}
      if(/right|höger|hoger/.test(normalized)){nudge(target,"right",amount);return;}
      if(/up|upp|higher|högre|hogre/.test(normalized)){nudge(target,"up",amount);return;}
      if(/down|ned|lower|lägre|lagre/.test(normalized)){nudge(target,"down",amount);return;}
    }
    if(/bigger|larger|större|storre|increase.*size/.test(normalized)){
      remember();nudge(target,"bigger",amount);return;
    }
    if(/smaller|mindre|decrease.*size/.test(normalized)){
      remember();nudge(target,"smaller",amount);return;
    }
    if(/hide|dölj|dolj|remove/.test(normalized)){
      remember();setVisual(target,"hidden",true,"dold");return;
    }
    if(/show|visa|restore/.test(normalized)){
      remember();setVisual(target,"hidden",false,"synlig");return;
    }
    if(/darker|mörkare|morkare/.test(normalized)){
      remember();setVisual(target,"brightness",Math.max(.45,stateFor(target).brightness-.15),"mörkare");return;
    }
    if(/lighter|ljusare|brighter/.test(normalized)){
      remember();setVisual(target,"brightness",Math.min(1.5,stateFor(target).brightness+.15),"ljusare");return;
    }
    if(/rounder|rundare|rounded/.test(normalized)){
      remember();setVisual(target,"radius",22,"rundare");return;
    }
    for(const [name,value] of Object.entries(colors)){
      if(normalized.includes(name)){
        remember();setVisual(target,"background",value,`${name}`);return;
      }
    }
    const rotate=normalized.match(/(?:rotate|rotera).*?(-?\\d+)/);
    if(rotate){
      remember();setVisual(target,"rotation",Number(rotate[1]),`roterad ${Number(rotate[1])}°`);return;
    }
    addMessage("agent",`Jag förstår att du vill ändra ${elementName(target)}, men prototypen känner ännu bara position, storlek, färg, ljushet, rundning och synlighet. Förslaget finns kvar i chatten så projektägaren kan läsa det.`);
  }
  function undo(){
    if(!history.length){addMessage("agent","Det finns ingen tidigare ändring att ångra.");return;}
    restoreSnapshot(history.pop());
    addMessage("agent","Senaste ändringen är ångrad.");
  }
  function resetAll(){
    if(!editLog.length){addMessage("agent","Förhandsvisningen är redan i originalskick.");return;}
    remember();
    Object.keys(edits).forEach(key=>delete edits[key]);
    editLog.splice(0);
    applyAll();updateCount();save();
    addMessage("agent","Alla visuella ändringar är återställda. Chatten ligger kvar som underlag.");
  }
  function cssOverrides(){
    return Object.keys(edits).sort().map(id=>{
      const state=cleanState(edits[id]);
      const declarations=[];
      if(state.x||state.y)declarations.push(`translate: ${state.x}px ${state.y}px`);
      if(state.rotation)declarations.push(`rotate: ${state.rotation}deg`);
      if(state.scale!==1)declarations.push(`scale: ${state.scale}`);
      if(state.background)declarations.push(`background: ${state.background}`);
      if(state.color)declarations.push(`color: ${state.color}`);
      if(state.radius!==null)declarations.push(`border-radius: ${state.radius}px`);
      if(state.brightness!==1)declarations.push(`filter: brightness(${state.brightness})`);
      if(state.opacity!==1)declarations.push(`opacity: ${state.opacity}`);
      if(state.hidden)declarations.push("visibility: hidden");
      return declarations.length?`[data-edit-id="${id}"] { ${declarations.join("; ")}; }`:"";
    }).filter(Boolean).join("\\n");
  }
  function packageData(){
    const messages=[...conversation.querySelectorAll(".message")].map(node=>({
      role:node.classList.contains("user")?"user":"agent",
      text:node.childNodes[0].textContent
    }));
    return {
      schema_version:1,
      status:"PROPOSED_FOR_HUMAN_REVIEW",
      source:"Resus Sandbox agent edit lab",
      target_page:"HLR/ahlr.html (representative mock preview)",
      created_at:draftCreatedAt,
      safety:{production_modified:false,repository_access:false,remote_calls:false},
      summary:`${editLog.length} visuella ändringar föreslås`,
      edits:editLog,
      css_overrides:cssOverrides(),
      conversation:messages,
      limitations:[
        "Förhandsvisningen är en representativ mock, inte den verkliga HLR-sidan.",
        "Prototypen använder en lokal regelmotor, inte en ansluten språkmodell.",
        "Paketet måste granskas och översättas till en riktig kodändring av projektägaren."
      ]
    };
  }
  function openReview(){
    const payload=JSON.stringify(packageData(),null,2);
    $("packagePreview").value=payload;
    $("reviewDialog").showModal();
  }
  function save(){
    try{
      const messages=[...conversation.querySelectorAll(".message")].map(node=>({
        role:node.classList.contains("user")?"user":"agent",text:node.childNodes[0].textContent
      }));
      localStorage.setItem(storageKey,JSON.stringify({edits,editLog,messages,draftCreatedAt}));
    }catch(error){}
  }
  function load(){
    try{
      const data=JSON.parse(localStorage.getItem(storageKey)||"null");
      if(!data)return false;
      if(data.draftCreatedAt)draftCreatedAt=data.draftCreatedAt;
      Object.assign(edits,data.edits||{});
      editLog.push(...(data.editLog||[]));
      (data.messages||[]).forEach(message=>addMessage(message.role,message.text,false));
      applyAll();updateCount();
      return true;
    }catch(error){return false;}
  }

  preview.addEventListener("click",event=>{
    const target=event.target.closest("[data-edit-id]");
    if(!target||originalMode)return;
    event.preventDefault();event.stopPropagation();
    select(target.dataset.editId,true);
  });
  $("chatForm").addEventListener("submit",event=>{
    event.preventDefault();
    const prompt=$("prompt");
    handlePrompt(prompt.value);
    prompt.value="";prompt.focus();
  });
  $("suggestions").addEventListener("click",event=>{
    if(event.target.tagName!=="BUTTON")return;
    handlePrompt(event.target.textContent);
  });
  document.querySelectorAll("[data-nudge]").forEach(button=>button.addEventListener("click",()=>{
    if(!selectedId)return;
    remember();nudge(selectedId,button.dataset.nudge,button.dataset.nudge==="bigger"||button.dataset.nudge==="smaller"?10:12);
  }));
  $("hideBtn").addEventListener("click",()=>{
    if(!selectedId)return;
    remember();
    const hidden=!stateFor(selectedId).hidden;
    setVisual(selectedId,"hidden",hidden,hidden?"dold":"synlig");
    $("hideBtn").textContent=hidden?"Visa":"Dölj";
  });
  $("undoBtn").addEventListener("click",undo);
  $("resetBtn").addEventListener("click",resetAll);
  const showOriginal=()=>{
    originalMode=true;preview.classList.add("is-original");$("previewMode").textContent="Original";
    applyAll();
  };
  const showEdited=()=>{
    originalMode=false;preview.classList.remove("is-original");$("previewMode").textContent="Redigerad version";
    applyAll();
  };
  $("compareBtn").addEventListener("pointerdown",showOriginal);
  ["pointerup","pointerleave","pointercancel"].forEach(type=>$("compareBtn").addEventListener(type,showEdited));
  $("reviewBtn").addEventListener("click",openReview);
  $("copyBtn").addEventListener("click",async()=>{
    try{
      await navigator.clipboard.writeText($("packagePreview").value);
      $("copyBtn").textContent="Kopierat ✓";
    }catch(error){
      $("packagePreview").select();
      document.execCommand("copy");
      $("copyBtn").textContent="Kopierat ✓";
    }
  });
  $("downloadBtn").addEventListener("click",()=>{
    const blob=new Blob([$("packagePreview").value],{type:"application/json"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="resus-agent-edit-proposal.json";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  });
  window.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();undo();}
  });

  const restored=load();
  if(!restored){
    addMessage("agent","Hej! Klicka på något i förhandsvisningen eller beskriv direkt vad du vill ändra. Jag kan prova position, storlek, färg, ljushet och synlighet.");
    addMessage("agent","Jag arbetar bara i den här lokala kopian. När du är nöjd skapar jag ett granskningspaket — jag kan inte ändra eller publicera den riktiga sajten.");
  }
  select(null);
})();
