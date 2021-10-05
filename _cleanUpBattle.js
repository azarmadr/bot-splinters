const log=(...m)=>console.log('data-cleaner:',...m);
const old_battles = require('./data/battle_data.json');
//*
const new_battles=old_battles.filter(({teams})=>teams.length>1).map(bt=>bt={id:bt.battle_id,date:bt.created_date,mana:bt.mana_cap,rule:bt.ruleset,teams:bt.teams})
log(new_battles[0].teams)
new_battles.forEach(({teams})=>teams.forEach((t,i)=>
  teams[i]=[t.verdict,Object.values(t.summoner),...t.monsters.map(m=>Object.values(m))]
))
const [v,s,...mon]=new_battles[0].teams[0];
log(new_battles[0].teams)
log(s);log(mon,'v',v)
// unComment the following to permanently modify your battle_data or try with different name checkout the file and make it permanent
//require('jsonfile').writeFile(`data/battle_data.json`,new_battles).catch(log);
