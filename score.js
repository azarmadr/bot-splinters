const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const { cards, chunk2, addName} = require('./helper');
const log=(...m)=>console.log('Scoring Teams: ',...m);

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
async function scoreMap2Obj(player,scores,fn='score'){
  const scoreObj = {}
  for(const [k,s] of scores.entries()){
    //NOTE k => mana, rule, team/card
    const [mana,rule,...key] = k;
    const type = key.length>2?'team':'cards'
    if(!(rule in scoreObj))scoreObj[rule]={};
    if(!(mana in scoreObj[rule]))scoreObj[rule][mana]={team:[],cards:[]};
    scoreObj[rule][mana][type].push({[type]:chunk2(key,2),...s});
  }
  writeFile(`data/${player}_n_${fn}.json`, scoreObj).catch(log);
}
const teamScores = (battles,player,{verdictToScore={w:1,l:-1,d:-0.5},cardsToo=1,filterLessMana=1,StandardOnly,filterOutLowWR}={},fn) => {
  //NOTE team array is [verdict, summoner, monsters]
  const scores = new AKMap();
  battles.filter(filterOutByMana(filterLessMana)).forEach(({teams,mana,rule}) => teams.forEach(t=>{
    const kda = {w:0,l:0,d:0};const teamKey = [mana,rule,...t.slice(1).flat()];kda[t[0]]=1;
    if(scores.has(teamKey)){
      const stats = scores.get(teamKey)
      stats.score+=verdictToScore[t[0]];stats.count++;stats[t[0]]++;
    } else scores.set(teamKey,{score:verdictToScore[t[0]],count:1,...kda})
    if(cardsToo){
      t.slice(1).forEach(c=>{
        const cardKey = [mana,rule,...c];
        if(scores.has(cardKey)){
          const stats = scores.get(cardKey)
          stats.score+=verdictToScore[t[0]];stats.count++;stats[t[0]]++;
        }else scores.set(cardKey,{score:verdictToScore[t[0]],count:1,...kda})
      })
    }
    }))
  scoreMap2Obj(player,scores)
  return scores
}

const playableTeams = (scores,player,mana,rule,{sortByWinRate}={}) => {
  const myCards = require(`./data/${player}_cards.json`);
  //filter
  const filteredTeams = [...scores.entries()].filter(([[m,r,...t],s])=>
    m==mana&&r==rule&&t.length>2&&chunk2(t).every(c=>myCards[c[0]]>=c[1])&&s.count<2*s.w
  ).map(([[m,r,...t],s])=>{return {team:chunk2(t),...s}}).sort(sortByProperty(sortByWinRate))
  //writeFile(`data/${player}_n_pt.json`, filteredTeams).catch(log);
  return filteredTeams;
}

module.exports = {teamScores,playableTeams};
//log(playableTeams(score(require('./data/battle_data_n.json'),'azarmadr'),'azarmadr',30,'Standard')[0])
