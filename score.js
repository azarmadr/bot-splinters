const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const { cards, chunk2, addName} = require('./helper');
const bC = cards.filter(c=>c.editions.match(/1|4/)&&c.rarity<3).map(c=>c.id)
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

const priorByQuest=(teams,{type,value,color})=>{
  var team;
  switch(type){
    case 'splinter':
      log(`playing for ${value} ${type} quest`);
      team=teams.find(t=>cards[t.team[0][0]-1].color===color);
      break;
    case 'no_neutral':
      log(`playing for ${type} quest`);
      team = teams.find(t=>t.team.slice(1).every(c=>cards[c[0]-1].color!='Gray'))
      break;
    case 'ability':
      log(`playing for ${value} ${type} quest`);
      team=teams.find(t=>!(t.team.every(c=>!(cards[c[0]-1].stats.abilities?.slice(0,c[1])+'').includes(value))))
      break;
    default: team = null;
  }
  if(team)teams.unshift(team);
}
function sortByProperty(s){
  if(s) return (a,b)=>{
    const _byCount = b.w*a.count-a.w*b.count;
    if(_byCount==0)return b.score-a.score;
    return _byCount;
  }
  else return (a,b)=>b.score-a.score
}
function filterOutByMana(toggle){
  const filterOut = (battle) => {
    if(battle.mana == 99) return true;
    const losing_team = battle.teams.find(t=>t[t.length-1]=='l')||[];
    return battle.mana*.9 < losing_team.reduce((s,c)=>s+cards[c[0]-1].stats.mana,0)
  }
  return toggle?filterOut:()=>true;
}
async function scoreMap2Obj(scores,fn=''){
  const scoreObj = {}
  for(const [[mana,rule,...key],stats] of scores.entries()){
    const type = key.length>2?'team':'cards'
    if(!(rule in scoreObj))scoreObj[rule]={};
    if(!(mana in scoreObj[rule]))scoreObj[rule][mana]={team:[],cards:[]};
    scoreObj[rule][mana][type].push({[type]:chunk2(key),...stats});
  }
  writeFile(`data/scores${fn}.json`, scoreObj).catch(log);
}
const scoreXer=t=>t.reduce((s,[i,l])=>
  (bC.includes(i)?1:(8**cards[i-1].rarity))*([cards[i-1].stats.mana].flat().pop()||1)+s,0)
const _toPrecision3=x=>Number(x.toFixed(3));
const teamScores = (battles,{verdictToScore={w:1,l:-1,d:-0.5},cardsToo=1,filterLessMana=1,StandardOnly,filterOutLowWR}={},fn) => {
  const scores = new AKMap();
  battles.filter(filterOutByMana(filterLessMana)).forEach(({teams,mana,rule}) => teams.forEach(([v,...t])=>{
    const kda = {w:0,l:0,d:0};const teamKey = [mana,rule,...t.flat()];kda[v]=1;
    const score = verdictToScore[v];
    if(scores.has(teamKey)){
      const stats = scores.get(teamKey)
      stats.score+=score;stats.count++;stats[v]++;
    } else scores.set(teamKey,{score,count:1,...kda})
    if(cardsToo){
      t.slice(1).forEach(c=>{
        const cardKey = [mana,rule,...c];
        if(scores.has(cardKey)){
          const stats = scores.get(cardKey)
          stats.score+=score;stats.count++;stats[v]++;
        }else scores.set(cardKey,{score,count:1,...kda})
      })
    }
    }))
  scores.forEach(s=>s.score=_toPrecision3(s.score));
  scoreMap2Obj(scores,fn)
  return scores
}

const playableTeams = (battles,player,{mana_cap,ruleset,inactive,quest},myCards=require(`./data/${player}_cards.json`),{sortByWinRate}={},fn='lastMatch') => {
  //const score = verdictToScore[v]*(bC.includes(c[0])?1:cards[c[0]-1].rarity)/4;
  //ruleset matching could be improved
  let mana=mana_cap;
  do{
    const scores = teamScores(battles.filter(b=>b.mana==mana&&b.rule==ruleset));
    var filteredTeams = [...scores.entries()].filter(([[m,r,...t],s])=>
      t.length>2    && chunk2(t).every(c=>inactive.indexOf(cards[c[0]-1].color)<0) &&
      s.count<2*s.w && chunk2(t).every(c=>myCards[c[0]]>=c[1])
    )
      .map(([[m,r,...t],s])=>{return {team:chunk2(t),...s}})
    mana--;
  }while(filteredTeams.length<1&&(mana>12))
  filteredTeams.forEach(t=>t.score=_toPrecision3(t.score*scoreXer(t.team)/mana_cap))
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(1+filteredTeams.length/27)
  if(quest)priorByQuest(filteredTeams,quest);
  writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  return filteredTeams;
}

module.exports = {teamScores,playableTeams,scoreMap2Obj};
