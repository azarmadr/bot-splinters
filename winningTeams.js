const fs = require('fs');
const { playableTeam, teamWithNames } = require('./helper');

const winningTeams = (battles,user,fn='') => {
  let winningTeams = {};
  const myCards = require(`./data/${user}_cards.json`);
  //battles
  battles.filter(b=>b.teams[1]&&b.teams[0].verdict!=='d').map(b=>{
    const r={};
    r.mana_cap = b.mana_cap;r.ruleset = b.ruleset;
    b.teams.forEach(t=>r[t.verdict]={summoner:t.summoner,monsters:t.monsters})
    return r;
  }).forEach(b=>{
    if(!winningTeams.hasOwnProperty(b.mana_cap)){
      winningTeams[b.mana_cap] = [];
    }
    winByMana = winningTeams[b.mana_cap];
    var l_f = winByMana.find(t=>JSON.stringify(t.l)==JSON.stringify(b.l));
    if(l_f){ l_f.w.push({...teamWithNames(b.w),ruleset:b.ruleset,playable:playableTeam(b.w,myCards)}); }
    else{ winByMana.push({l:b.l,w:[{...teamWithNames(b.w),ruleset:b.ruleset,playable:playableTeam(b.w,myCards)}]}) }
  });
  fs.writeFile(`data/${user}_wt_${fn}.json`,JSON.stringify(winningTeams),function(err){
    if (err) { console.log(err); }
  });
  return winningTeams;
}
module.exports.winningTeams = winningTeams;
