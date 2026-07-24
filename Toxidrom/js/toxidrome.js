/* ---------- Toxidrom-detektiv: matchningslogik ---------- */
/* Pedagogisk poängsättning — räknar ihop viktade träffar mellan ifyllda fynd och varje
   toxidroms klassiska mönster. Ingen diagnostisk algoritm, bara ett sätt att träna
   mönsterigenkänning och rangordna troliga toxidrom. */
function detectToxidromes(inputs){
  const results = TOXIDROMES.map(tox => {
    let score = 0;
    const matched = [];
    Object.keys(tox.signs).forEach(cat => {
      if(inputs[cat] && inputs[cat] === tox.signs[cat]){
        score += tox.weight[cat] || 1;
        matched.push(cat);
      }
    });
    return {...tox, score, matched};
  });
  results.sort((a,b) => b.score - a.score);
  return results.filter(r => r.score > 0).slice(0,4);
}

function categoryLabel(catId, value){
  const cat = TOX_CATEGORIES.find(c => c.id === catId);
  const opt = cat.options.find(o => o.v === value);
  return `${cat.label}: ${opt.t}`;
}
