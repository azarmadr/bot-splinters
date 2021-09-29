//require('dotenv').config();
//const score = require('./score');
const battles = require(`./battle_data.json`);
const fs = require('fs');

const cleanTeam = (team) => {return {summoner: team.summoner,monsters: team.monsters}}
const teamsAsKey = (teams) => {
  const a = JSON.stringify(cleanTeam(teams[0]));
  const b = teams[1]?JSON.stringify(cleanTeam(teams[1])):'';
  if(a===b&&teams[0].verdict=='d'){ teams.pop(); return a; }
  return (a>b)?(a+b):(b+a);
}
battles.forEach(b=>b.teams.forEach(t=>['name','gold'].forEach(k=>t.monsters.forEach(m=>delete m[k]) + delete t.summoner[k])));
battles.forEach(b=>b.teams.forEach(t=>['battle_queue_id','player_rating_final','player_rating_initial'].forEach(k=>delete t[k])));
//var b = [...new Map(battles.map(item => [item.battle_id, item])).values()]; //unique by battle_id
var b = [...new Map(battles.map(item => [teamsAsKey(item.teams), item])).values()];
  //.filter(b=>Date.parse(b.created_date)>Date.now()-86400000*13);
  //.filter(b=>b.teams[0].verdict=='d'||b.teams[1])
console.log(
  battles.length,
  b.length,
  //b1.length,
  b.filter(b=>b.teams[0].verdict!='d'&&b.teams.length==1).length,
  battles.filter(b=>b.teams[0].verdict!='d'&&b.teams.length==1).length
);
console.log(battles.length,b[b.length-1].teams);
//uncomment the following if you find b reasonable
fs.writeFile('./data/battle_data.json',JSON.stringify(b),function(err){ if(err){ console.log(err); } });
