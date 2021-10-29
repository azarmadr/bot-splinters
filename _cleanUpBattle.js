const AKMap = require('array-keyed-map');
const {log} = require('./helper')(__filename.split(/[\\/]/).pop());
const oldBattles                 = require('./data/battle_data.json').map(
  (b,i)=>[b.rule,b.mana,...b.teams.sort().flat(2).slice(1)]);
//const newB = new Map(oldBattles)
log(3)
//log(newB.entries().next())
//log(newA.size)
const newA = new AKMap();

oldBattles.forEach(([r,m,...k],i)=>{
  const result = k.find(a=>typeof a =='string');
  const idx = k.indexOf(result);
  const key = [r,m,result,...k.slice(0,idx)];
  if(newA.has(key))newA.get(key).push(k.slice(idx+1));
  else newA.set(key,[k.slice(idx+1)])
})
log(3);
const new_battles = {};
for(const[[rule,mana,result,...key],t] of newA.entries()){
  if(!(rule in new_battles))new_battles[rule]={};
  if(!(mana in new_battles[rule]))new_battles[rule][mana]={w:[],d:[]};
  new_battles[rule][mana][result].push([key,t]);
}
//uncomment the following line and save your file with correct name
require('jsonfile').writeFileSync(`data/battle_data_n.json`,new_battles)
/*
*/
