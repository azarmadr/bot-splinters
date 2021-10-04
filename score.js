const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const { cards, playableTeam, addName, cleanTeam, cleanCard } = require('./helper');
const log=(...m)=>console.log('Scoring Teams: ',...m);

var a=0;
function uniqueListByKey(arr, key) {
  return [...new Map(arr.map(item => [item[key], item])).values()]
}
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
    if(!(mana in scoreObj))scoreObj[mana]={};
    if(!(rule in scoreObj[mana]))scoreObj[mana][rule]={team:[],cards:[]};
    scoreObj[mana][rule][type].push({[type]:key,...s});
  }
  writeFile(`data/${player}_n_${fn}.json`, scoreObj).catch(log);
}
const score = (battles,player,{verdictToScore={w:1,l:-1,d:-0.5},cardsToo=1,filterLessMana=1,sortByWinRate,StandardOnly,filterOutLowWR}={},fn) => {
  //NOTE team array is [verdict, summoner, monsters]
  const myCards = require(`./data/${player}_cards.json`);
  const scores = new AKMap();
  battles.filter(filterOutByMana(filterLessMana)).forEach(({teams,mana,rule}) => teams.forEach(t=>{
    const kda = {w:0,l:0,d:0};const teamKey = [mana,rule,...t.slice(1).flat()];kda[t[0]]=1;
    //const playable = team.every(c=>myCards[c[0]]>=c[1])?'playable':'unplayable';
    if(scores.has(teamKey)){
      const stats = scores.get(teamKey)
      stats.score+=verdictToScore[t[0]];stats.count++;stats[t[0]]++;
    } else scores.set(teamKey,{score:verdictToScore[t[0]],count:1,...kda})
    if(cardsToo){
      //const ownership = myCards[t.summoner.id]>=t.summoner.level?'owned':'unowned';
      t.slice(1).forEach(c=>{
        const cardKey = [mana,rule,...c];
      a||(a=log(c)+'1');
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

module.exports.scores = score;
log(score(require('./data/battle_data_n.json'),'azarmadr').entries().next())
