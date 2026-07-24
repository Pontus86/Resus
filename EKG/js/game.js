/* ---------- EKG-matchningsspel: mål-generering, poäng, timer ---------- */
/* Separat state från Simulator (fri lek) — spelet har sin egen "spelarens aktiva val"-mängd
   så de två lägena aldrig krockar. Återanvänder samma .cond-btn-knappar i main.js: vilket
   toggle-anrop en klick routas till avgörs av Game.isActive(). */
const GAME_SECONDS_PER_CONDITION=60;   // rundans längd skalar med antal tillstånd i målet, annars orimligt på höga nivåer
const GAME_HINT_PENALTY=0.85;   // multiplikativ straff på rundpoängen per ledtråd (2 ledtrådar ≈ 72 % kvar)
const GAME_WRONG_CLICK_PENALTY=20;   // poängavdrag per felklick, draget direkt från rundpoängen vid rundslut

// Reglage-tillstånd (spectrum/stages) och AV-block (egen rendering-väg, dubbel tidslinje)
// hålls utanför mål-poolen i den här första versionen — se conditions-data.js-kommentarer.
function isEligibleForGameTarget(c){ return !c.spectrum && !c.stages && c.group!=="avblock"; }
const GAME_ELIGIBLE_GROUPS=[...new Set(ECG_CONDITIONS.filter(isEligibleForGameTarget).map(c=>c.group))];

function gameConditionCountForLevel(level){
  return Math.min(GAME_ELIGIBLE_GROUPS.length, 1+Math.floor((level-1)/3));
}
// Inversen: första nivån som ger exakt n samtidiga tillstånd — används för att kunna
// hoppa direkt till t.ex. "3 tillstånd" i stället för att spela sig fram dit.
function gameFirstLevelForCount(n){ return Math.max(1, (n-1)*3+1); }

const Game=(() => {
  let active=false;
  let level=1, totalScore=0;
  let target=[], targetProfile=null;
  let playerActive=new Set(), playerProfile=composeProfile([]);
  let roundSeconds=GAME_SECONDS_PER_CONDITION;
  let timeLeft=roundSeconds, roundStart=0, timerHandle=null;
  let roundOver=false;
  let onUpdate=null;
  let hintsGiven=[];
  // Logg över varje klick under rundan (inte bara sluttillståndet) -- en klick är "rätt" om
  // den flyttar spelarens val NÄRMARE facit för just det tillståndet (lägger till ett som
  // faktiskt ska vara med, eller tar bort ett som inte ska vara med), annars "fel". Symmetrisk
  // definition så att både felaktiga tillägg OCH att av misstag ta bort ett korrekt val räknas.
  let clickLog=[];

  function shuffled(arr){
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  function pickTarget(n){
    const groups=shuffled(GAME_ELIGIBLE_GROUPS).slice(0, n);
    return groups.map(g => {
      const opts=ECG_CONDITIONS.filter(c => c.group===g && isEligibleForGameTarget(c));
      return opts[Math.floor(Math.random()*opts.length)].id;
    });
  }

  function startRound(){
    const n=gameConditionCountForLevel(level);
    target=pickTarget(n);
    targetProfile=composeProfile(target);
    playerActive=new Set();
    playerProfile=composeProfile([]);
    roundSeconds=n*GAME_SECONDS_PER_CONDITION;
    timeLeft=roundSeconds;
    roundOver=false;
    hintsGiven=[];
    clickLog=[];
    roundStart=performance.now();
    if(timerHandle) clearInterval(timerHandle);
    timerHandle=setInterval(tick, 150);
    if(onUpdate) onUpdate({});
  }

  function tick(){
    if(roundOver) return;
    const elapsed=(performance.now()-roundStart)/1000;
    timeLeft=Math.max(0, roundSeconds-elapsed);
    if(timeLeft<=0){ endRound(); return; }
    if(onUpdate) onUpdate({tick:true});
  }

  function currentMatch(){ return computeMatchPercent(targetProfile, playerProfile); }

  function endRound(gaveUp){
    if(roundOver) return;
    roundOver=true;
    if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
    const rawMatch=currentMatch();
    const perfect=rawMatch>=99.5;
    const match=perfect?100:rawMatch;
    const elapsed=roundSeconds-timeLeft;
    const matchScore=Math.round(match*10);
    const timeBonus=perfect?Math.round((roundSeconds-elapsed)*20):0;
    const wrongClicks=clickLog.filter(c => !c.correct).length;
    const correctClicks=clickLog.filter(c => c.correct).length;
    const wrongClickPenalty=wrongClicks*GAME_WRONG_CLICK_PENALTY;
    const preRoundScore=Math.round((matchScore+timeBonus)*Math.pow(GAME_HINT_PENALTY, hintsGiven.length));
    // Poängen kan aldrig bli negativ (bara den enskilda straffposten syns som "minus" i
    // sammanfattningen) -- annars blir totalScore förvirrande att tolka över flera rundor.
    const roundScore=Math.max(0, preRoundScore-wrongClickPenalty);
    totalScore+=roundScore;
    const finishedLevel=level;
    level++;
    if(onUpdate) onUpdate({roundEnded:true, match, perfect, gaveUp:!!gaveUp, elapsed, matchScore, timeBonus, roundScore, finishedLevel,
      hintsUsed:hintsGiven.length, targetLabels:target.map(id => ECG_CONDITIONS.find(c => c.id===id).label),
      clickLog:[...clickLog], totalClicks:clickLog.length, correctClicks, wrongClicks, wrongClickPenalty});
  }

  function giveUp(){ if(active && !roundOver) endRound(true); }

  function useHint(){
    if(!active || roundOver) return null;
    const text=getHintText(targetProfile, playerProfile, hintsGiven.length);
    hintsGiven.push(text);
    if(onUpdate) onUpdate({hint:true});
    return text;
  }

  function toggle(id){
    if(!active || roundOver) return;
    const cond=ECG_CONDITIONS.find(c => c.id===id);
    if(!cond) return;
    // Räkna klicket INNAN tillståndet ändras -- bara själva knappen spelaren tryckte på räknas
    // som "ett klick", inte de gruppmedlemmar som ev. auto-avaktiveras som sidoeffekt nedan.
    const willAdd=!playerActive.has(id);
    const inTarget=target.includes(id);
    const correct=(willAdd && inTarget) || (!willAdd && !inTarget);
    clickLog.push({id, label:cond.label, added:willAdd, correct});
    if(willAdd){
      if(cond.group && !ECG_NONEXCLUSIVE_GROUPS.has(cond.group)) ECG_CONDITIONS.filter(c => c.group===cond.group && c.id!==id).forEach(c => playerActive.delete(c.id));
      playerActive.add(id);
    } else {
      playerActive.delete(id);
    }
    playerProfile=composeProfile([...playerActive]);
    const match=currentMatch();
    if(onUpdate) onUpdate({match});
    if(match>=99.5) endRound();
  }

  function start(startLevel){
    active=true; level=startLevel||1; totalScore=0;
    startRound();
  }
  function stop(){
    active=false; roundOver=true;
    if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
  }
  function nextRound(){ if(active) startRound(); }

  function isActive(){ return active; }
  function isConditionActive(id){ return playerActive.has(id); }
  function getPlayerActiveIds(){ return [...playerActive]; }
  function getState(){
    return {level, totalScore, timeLeft, roundOver, target, targetProfile, playerProfile, hintsGiven:[...hintsGiven],
      conditionCount: gameConditionCountForLevel(level), match: currentMatch(),
      wrongClicks: clickLog.filter(c => !c.correct).length, correctClicks: clickLog.filter(c => c.correct).length};
  }
  function setOnUpdate(fn){ onUpdate=fn; }

  return {start, stop, nextRound, toggle, giveUp, useHint, isActive, isConditionActive, getPlayerActiveIds, getState, setOnUpdate};
})();
