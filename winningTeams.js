const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const { cards, chunk2, addName} = require('./helper');

const wT2Obj = async(wt,fn='') => {
  const wT2Obj = {};
  for(const [[mana,...l],w] of wt.entries()){
    if(!(mana in wT2Obj))wT2Obj[mana]=[];
    wT2Obj[mana].push({l:chunk2(l),w});
  }
  writeFile(`data/wt${fn}.json`,wT2Obj).catch(log);
}
const winningTeams = (battles,fn) => {
  const winningTeams = new AKMap();
  //battles
  battles.filter(b=>b.teams[0][0]!=='d').map(({teams,mana,rule})=>{
    return {mana,rule,...Object.fromEntries(teams.map(([v,...t])=>[v,t]))}
  }).forEach(({w,l,mana,rule})=>{
    const teamKey = [mana,...l.flat()];
    if(winningTeams.has(teamKey))
      winningTeams.get(teamKey).push([rule,...w])
    else winningTeams.set(teamKey,[[rule,...w]]);
  });
  wT2Obj(winningTeams,fn)
  return winningTeams;
}
const winVsOppTeams = (winningTeams,playableTeams,mana,rule,myCards,fn='opp_lt') => {
  const winVsOppTeams = new AKMap();
  playableTeams.forEach(({team,score})=>{
    const teamKey = [mana,...team.flat()];
    if(winningTeams.has(teamKey)){
      winningTeams.get(teamKey).forEach(([rule,...w])=>{
        const wtKey = [rule,...w.flat()];
        if(winVsOppTeams.has(wtKey)){
          const stats = winVsOppTeams.get(wtKey)
          stats.score +=score;stats.count++;
        }else winVsOppTeams.set(wtKey,{score,count:1})
      })
    }else winVsOppTeams.set(['',...team.flat()],null);
  })
  const obj = [...winVsOppTeams.entries()]
    .filter(([[r,...t],s])=>chunk2(t).every(c=>myCards[c[0]]>=c[1]))
    .map(([[rule,...t],s])=>{return{team:chunk2(t),...s,rule}}).sort((a,b)=>b.score-a.score)
  writeFile(`data/oppLt_${fn}.json`, obj).catch(log);
  return obj
}
module.exports = {
  winningTeams, winVsOppTeams
}
//log(winVsOppTeams(winningTeams(require('./data/battle_data.json'),'azarmadr'),require('./data/azarmadr3_lastMatch.json'),13,'Standard'))
//log(winningTeams(require('./data/battle_data.json'),'azarmadr').entries().next().value)
