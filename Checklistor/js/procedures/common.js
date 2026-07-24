/* ---------- Delad journaltext-byggare för procedurmallar ---------- */
/* Alla procedurmallars buildNote(ctx) kan anropa denna i stället för att upprepa
   samma uppbyggnad (rubrik, indikation, vikt, läkemedel, ikryssad checklista, komplikationer). */
function buildStandardNote(procName, drugHeading, checklist, ctx){
  const lines = [];
  lines.push(procName.toUpperCase());
  if(ctx.indication) lines.push(`Indikation: ${ctx.indication}`);
  if(ctx.weight) lines.push(`Patientvikt: ${ctx.weight} kg`);
  if(ctx.chosenDrugs && ctx.chosenDrugs.length){
    lines.push("");
    lines.push(drugHeading + ":");
    ctx.chosenDrugs.forEach(d => {
      lines.push(`- ${d.name}: ${d.doseText}${d.volumeText ? " (" + d.volumeText + ")" : ""}`);
    });
  }
  lines.push("");
  checklist.forEach(group => {
    const checkedInPhase = group.items.filter((_, i) => ctx.checkedItems.has(group.phase + "|" + i));
    if(checkedInPhase.length){
      lines.push(`${group.phase}:`);
      checkedInPhase.forEach(t => lines.push(`- ${t}`));
      lines.push("");
    }
  });
  lines.push(`Proceduren genomförd enligt ovan. Komplikationer: ${ctx.complications || "_____"}`);
  return lines.join("\n").trim();
}
