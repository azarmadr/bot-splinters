const R = require('ramda')
const {readFile,writeFile} = require('jsonfile');
const {log,_arr,_team,getRules,_score,_dbug} = require('./util');
const getJson=(player)=>Promise.race([
  require('async-get-json')(`https://game-api.splinterlands.com/battle/history?player=${player}`)
    .catch(()=>require('async-get-json')(`https://api2.splinterlands.com/battle/history?player=${player}`))
    .then(b=>b.battles),
  new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),17290)),
]).catch(()=>[])
const _battles = {},_dbugBattles=[];
var _bc={count:0,pc:0}//,'|Battles':0,'+Battles':0};
//const __medusa=(m,t)=>(_team.colorSec(t)=='Blue'&&m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;

async function getBattles(player = '',bd,minRank=0,drs=''){
  const battleHistory = await getJson(player)
    .then(b=>b.filter(b=>minRank<Math.max(b.player_1_rating_final,b.player_2_rating_final)
      &&!b.details.includes('"type":"Surrender"')
    ))
  _dbug.in1(_bc.pc++,player);
  return battleHistory.reduce(({battle_obj,nuSet},b)=>{
    if(drs&&b.ruleset.split('|').some(x=>drs.includes(x)))_dbugBattles.push(b);
    const {winner,team1,team2} = JSON.parse(b.details);
    nuSet.add(team1.player); nuSet.add(team2.player);
    const [t1,t2] = [team1,team2].map(t=>
      [t.summoner,...t.monsters].flatMap(m=>[m.card_detail_id,m.level]));
    if(!_arr.eq(t1,t2)&&![t1,t2].some(x=>_team(x).length<2)){
      const attr_r= getRules(b.ruleset).attr.filter(rs=>![t1,t2].every(_score.move2Std(rs)))
      if(R.isEmpty(attr_r))attr_r.push('Standard')
      let obj = [...attr_r,Math.max(12,...[t1,t2].map(_team.mana))]
        .reduce((obj,path)=>obj[path]??={},battle_obj)
      if(winner=='DRAW'){
        (obj[t1]??={})[t2]??=1;
        (obj[t2]??={})[t1]??=1;
      }else if(winner == team1.player) (obj[t2]??={})[t1]=2;
      else  if(winner == team2.player) (obj[t1]??={})[t2]=2;
      else log('Error!! Should not have happened')
    }
    return {battle_obj,nuSet}
  },bd)
}
_battles.merge=(obj,obj2merge,count={c:0})=>{
  //console.count();require('readline').moveCursor(process.stdout,0,-1);
  for(let[key,value] of Object.entries(obj2merge)){
    if([1,2].includes(value)){
      if(obj[key]!=value&&obj[key]!=2){
        obj[key]=value;
        count.c++;
      }
    }
    else _battles.merge(obj[key]??={},value,count);
  }
  return count;
}
_battles.save=(bl,fn='')=>new Promise(res=>readFile(`./data/battle_data${fn}.json`,(e,d)=>{
  let battlesList = d||{};
  require('readline').cursorTo(process.stdout,0);
  if(e){log('Error reading file: ',e)}
  const mR = _battles.merge(battlesList,bl);
  //console.countReset();
  require('readline').cursorTo(process.stdout,0);//log(_bc);
  Object.keys(_bc).forEach(k=>_bc[k]=0)
  if(mR.c)writeFile(`data/battle_data${fn}.json`, battlesList).catch(log)
  if(_dbugBattles.length)writeFile('data/dbugBattles.json',_dbugBattles).catch(log)
  res(battlesList);
}))

const checkIfPresent=(obj,delay)=>x=>Date.now()-obj[x]<delay?0:(obj[x]=Date.now());
const bS = checkIfPresent({},81e4);
_battles.fromUsers=(players,{depth=2,minRank,drs,blackSet=bS,bObj={},fn='',cl=27}={})=>new Promise(res=>{
  const ul = [...new Set(Array.isArray(players)?players:players.split(','))].filter(blackSet);
  Promise.resolve(_arr.chunk(cl,ul).reduce(
    (memo,ul_chunk)=>memo.then(bd=>
      Promise.all(ul_chunk.map(u=>getBattles(u,bd,minRank,drs))).then(()=>bd)
    ),Promise.resolve({battle_obj:{},nuSet:new Set()})
  )).then(({battle_obj,nuSet})=>{
    _battles.merge(bObj,battle_obj);
    if(--depth>0&&nuSet.size)
      return res(_battles.fromUsers([...nuSet].filter((_,i)=>i<243),{bObj,drs,depth,minRank,blackSet,fn,cl}))
    else return res(_battles.save(battle_obj,fn))
  })
});
module.exports = _battles;
