const {readFile,writeFile} = require('jsonfile');
const {log,_arr,_team,_dbug} = require('./util');
const getJson=url=>Promise.race([
  require('async-get-json')(url),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),17290))
]);

const _battles = {},_dbugBattles=[];
var _bc={count:0,pc:0}//,'|Battles':0,'+Battles':0};
//const __medusa=(m,t)=>(_team.colorSec(t)=='Blue'&&m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;

async function getBattles(player = '',bd,minRank=0,drs='') {
  const battleHistory = await getJson(`https://api2.splinterlands.com/battle/history?player=${player}`)
    .catch(() =>getJson(`https://game-api.splinterlands.com/battle/history?player=${player}`)
      .catch((error) => {
        log('There has been a problem with your fetch operation:', error);
        return {battles:[]};
      })
    ).then(b=>b.battles.filter(b=>minRank<Math.max(b.player_1_rating_final,b.player_2_rating_final)
      &&!b.details.includes('"type":"Surrender"')
    ))
  _dbug.in1(_bc.pc++,player);
  return battleHistory.reduce(({battle_obj,nuSet},b)=>{
    if(drs&&b.ruleset.split('|').some(x=>drs.includes(x)))_dbugBattles.push(b);
    const {winner,team1,team2} = JSON.parse(b.details);
    nuSet.add(team1.player); nuSet.add(team2.player);
    const teams = [team1,team2].map(t=>
      [winner=='DRAW'?'d':winner==t.player?'w':'l',...[t.summoner,...t.monsters]
        .map(m=>[m.card_detail_id,m.level]).flat()]);
    if(!_arr.eq(...teams)){
      const [[_,...t1],[r,...t2]] = teams.sort((a,b)=>_arr.cmp(a.slice(1),b.slice(1)));
      let obj = battle_obj;
      for(let path of (b.ruleset.split('|').reduce((rules,cr)=>
        _team.rules.secondary.includes(cr)?rules:rules.concat(cr)
        ,[]).sort().join()||'Standard').split(','))obj=obj[path]??={};
      obj=((obj[b.mana_cap]??={})[t1.join()]??={})[t2.join()]??=r;
      if(obj!==r)obj='d';
    }
    return {battle_obj,nuSet}
  },bd)
}
_battles.merge=(obj,obj2merge)=>{
  //console.count();require('readline').moveCursor(process.stdout,0,-1);
  for(let[key,value] of Object.entries(obj2merge)){
    if('wld'.includes(value))obj[key]=(key in obj && obj[key]!=value)?'d':value;
    else _battles.merge(obj[key]??={},value);
  }
}
_battles.save=(bl,fn='')=>new Promise(res=>readFile(`./data/battle_data${fn}.json`,(e,d)=>{
  let battlesList = d||{};
  require('readline').cursorTo(process.stdout,0);
  if(e){log('Error reading file: ',e)}
  _battles.merge(battlesList,bl);
  //console.countReset();
  require('readline').cursorTo(process.stdout,0);//log(_bc);
  Object.keys(_bc).forEach(k=>_bc[k]=0)
  writeFile(`data/battle_data${fn}.json`, battlesList).catch(log)
  if(_dbugBattles.length)writeFile('data/dbugBattles.json',_dbugBattles).catch(log)
  res(battlesList);
}))
_battles.fromUsers=(players,{depth=2,minRank,drs,blackSet=new Set(),bObj={},fn='',cl=27}={})=>new Promise(res=>{
  const ul = [...new Set(Array.isArray(players)?players:players.split(','))];
  blackSet=new Set([...ul,...blackSet]);
  Promise.resolve(_arr.chunk(ul,cl).reduce(
    (memo,ul_chunk)=>memo.then(bd=>
      Promise.all(ul_chunk.map(u=>getBattles(u,bd,minRank,drs))).then(()=>bd)
    ),Promise.resolve({battle_obj:{},nuSet:new Set()})
  )).then(({battle_obj,nuSet})=>{
    _battles.merge(bObj,battle_obj);
    for(p of nuSet)if(blackSet.has(p))nuSet.delete(p);
    if(--depth>0&&nuSet.size)
      return res(_battles.fromUsers([...nuSet].filter((_,i)=>i<243),{bObj,drs,depth,minRank,blackSet,fn,cl}))
    else return res(_battles.save(battle_obj,fn))
  })
});
module.exports = _battles;
