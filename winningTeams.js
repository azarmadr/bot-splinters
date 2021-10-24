const AKMap = require('array-keyed-map');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

const wT2Obj = (wt,player,fn='') => {
  const wT2Obj = {};
  for(const [[mana,...l],w] of wt.entries()){
    if(!(mana in wT2Obj))wT2Obj[mana]=[];
    wT2Obj[mana].push({l,w});
  }
  writeFile(`data/${player}_wt_${fn}.json`,wT2Obj).catch(log);
}
var c=0;
const winningTeams = (battles,player,myCards=require(`./data/${player}_cards.json`),fn) => {
  const winningTeams = new AKMap();
  //battles
  battles.filter(b=>b.teams[0][0]!=='d').map(({teams,mana,rule})=>{
    return {mana,rule,...Object.fromEntries(teams.map(([v,...t])=>[v,t]))}
  }).forEach(({w,l,mana,rule})=>{
    const teamKey = [mana,...l];
    if(winningTeams.has(teamKey)){c++;
      winningTeams.get(teamKey).push([...w,rule])}
    else winningTeams.set(teamKey,[[...w,rule]]);
  });
  return winningTeams;
}
module.exports.winningTeams = winningTeams;
log(wT2Obj(winningTeams(require('./data/battle_data.json'),'azarmadr'))[12][0])
