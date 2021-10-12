const AKMap = require('array-keyed-map');
const bC = require('./data/basicCards').filter(c=>c);
const {readFile,writeFile} = require('jsonfile');
const { cards, chunk2, addName} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

function sortByProperty(s){
  if(s){
    return function(a,b){
      return (a.w*b.count<a.count*b.w) ? 1 :(a.w*b.count>a.count*b.w) ? -1 : 0;
    }
  } else {
    return function(a,b){
      return a.score < b.score ? 1 : a.score > b.score ? -1 : 0;
    }
  }
}
function filterOutByMana(toggle){
  const filterOut = (battle) => {
    if(battle.mana == 99) return true;
    const losing_team = battle.teams.find(t=>t[t.length-1]=='l')||[];
    return battle.mana*.9 > losing_team.reduce((s,c)=>s+cards[c[0]-1].stats.mana,0)
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
const scoreXer=t=>t.reduce((s,[i,l])=>(bC.includes(i)?1:(8**cards[i-1].rarity))*(cards[i-1].stats.mana?.[l-1]||cards[i-1].stats.mana||1)+s,0)
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

const playableTeams = (scores,player,mana,rule,myCards=require(`./data/${player}_cards.json`),{sortByWinRate}={},fn='lastMatch') => {
  //const score = verdictToScore[v]*(bC.includes(c[0])?1:cards[c[0]-1].rarity)/4;
  const playableTeams = [...scores.entries()].filter(([[m,r,...t],s])=>
    m==mana&&r==rule&&t.length>2&&chunk2(t).every(c=>myCards[c[0]]>=c[1])&&s.count<2*s.w
  )
    .map(([[m,r,...t],s])=>{return {team:chunk2(t),...s}})
  playableTeams.forEach(t=>t.score=_toPrecision3(t.score*scoreXer(t.team)/mana))
  playableTeams.sort(sortByProperty(sortByWinRate))
  writeFile(`data/${player}_${fn}.json`, playableTeams).catch(log);
  return playableTeams;
}

module.exports = {teamScores,playableTeams,scoreMap2Obj};
//log(playableTeams(score(require('./data/battle_data.json'),'azarmadr'),'azarmadr',30,'Standard')[0])
