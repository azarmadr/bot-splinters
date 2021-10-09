const AKMap = require('array-keyed-map');
const log=(...m)=>console.log('Winning Teams:',...m);

const wT2Obj = (wt,player,fn='') => {
  const wT2Obj = {};
  for(const [[mana,...l],wt] of wt.entries()){
    if(!(mana in wT2Obj))wT2Obj[mana]=[];
    wT2Obj[mana].push({l,wt});
  }
  writeFile(`data/${player}_wt_${fn}.json`,wT2Obj).catch(log);
}
const winningTeams = (battles,player,myCards=require(`./data/${player}_cards.json`),fn) => {
  const winningTeams = new AKMap();
  //battles
  battles.filter(b=>b.teams[0][0]!=='d').map(({teams,mana,rule})=>{
    return {mana,rule,...Object.fromEntries(teams.map(([v,...t])=>[v,t]))}
  }).forEach(({w,l,mana,rule})=>{
    log(w,l)
    const teamKey = [mana,...l];
    if(winningTeams.has(teamKey))
      winningTeams.get(teamKey).push([...w,rule])
    else winningTeams.set(teamKey,[[...w,rule]]);
  });
  return winningTeams;
}
module.exports.winningTeams = winningTeams;
log(winningTeams(require('./data/battle_data.json'),'azarmadr').entries().next())
