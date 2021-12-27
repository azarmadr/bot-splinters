const {readFile,writeFile} = require('jsonfile');
const {_arr,_team,_dbug} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const getJson=url=>Promise.race([
  require('async-get-json')(url),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),17290))
]);

const _battles = {},_dbugBattles=[];
var _bc={count:0,pc:0,'|Battles':0,'+Battles':0};
const __medusa=(m,t)=>(_team.colorSec(t)=='Blue'&&m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;

async function getBattles(player = '',bd,minRank=0,drs='') {
  const battleHistory = await getJson(`https://api2.splinterlands.com/battle/history?player=${player}`)
    .catch(() =>getJson(`https://game-api.splinterlands.com/battle/history?player=${player}`)
      .catch((error) => {
        log('There has been a problem with your fetch operation:', error);
        return {battles:[]};
      })
    ).then(b=>b.battles.filter(b=>minRank<Math.max(b.player_1_rating_final,b.player_2_rating_final)&&!b.details.includes('"type":"Surrender"')))
  _dbug.in1(_bc.pc++,player);
  return battleHistory.reduce(
    ({battle_obj,nuSet},b)=>{
      if(drs&&b.ruleset.split('|').some(x=>drs.includes(x)))_dbugBattles.push(b);
      const {winner,team1,team2} = JSON.parse(b.details);
      nuSet.add(team1.player); nuSet.add(team2.player);
      const teams = [team1,team2].map(t=>
        [winner=='DRAW'?'d':winner==t.player?'w':'l',...[t.summoner,...t.monsters].map(m=>[__medusa(m,t),m.level])]);
      if(!_arr.eq(...teams)){
        const [_,...rem] = teams.sort().flat(2);
        let obj = battle_obj;
        for(let path of (b.ruleset.split('|').reduce((rules,cr)=>
          _team.rules.secondary.includes(cr)?rules:rules.concat(cr)
          ,[]).sort().join()||'Standard').split(','))obj=obj[path]??={};
        obj=obj[b.mana_cap]??=[];
        obj.push(rem);
      }
      return {battle_obj,nuSet}
    },bd
  )
}

_battles.merge=(obj,obj2merge)=>{
  for(let[key,value] of Object.entries(obj2merge)){
    if(Array.isArray(value)){
      obj[key]??=[];
      const _ob=obj[key].length;
      obj[key]= [...new Map([...obj[key],...value].map(i=>[i+'',i])).values()]
      if(value.length!=obj[key].length)
        _dbug.in1(JSON.stringify({
          '#':_bc.count++,'orig len':_ob,'by#':_bc['|Battles']+=value.length,'+uniq':_bc['+Battles']+=(obj[key].length-_ob)
        }))
    }
    else _battles.merge(obj[key]??={},value);
  }
}
_battles.save=(bl,fn='')=>{return new Promise(res =>
  readFile(`./data/battle_data${fn}.json`,(e,d)=>{
    let battlesList = d||{};
    require('readline').cursorTo(process.stdout,0);
    if(e){log('Error reading file: ',e)}
    _battles.merge(battlesList,bl);
    require('readline').cursorTo(process.stdout,0);
    log(_bc);Object.keys(_bc).forEach(k=>_bc[k]=0)
    writeFile(`data/battle_data${fn}.json`, battlesList).catch(log)
    if(_dbugBattles.length)writeFile('data/dbugBattles.json',_dbugBattles).catch(log)
    res(battlesList);
  })
)}
_battles.fromUsers=(players,{depth=2,minRank,drs,blackSet=new Set(),fn='',cl=27}={})=>new Promise(res=>{
  const ul = [...new Set(Array.isArray(players)?players:players.split(','))];
  blackSet=new Set([...ul,...blackSet]);
  Promise.resolve(_arr.chunk(ul,cl).reduce(
    (memo,ul_chunk)=>memo.then(bd=>
      Promise.all(ul_chunk.map(u=>getBattles(u,bd,minRank,drs))).then(()=>bd)
    ),Promise.resolve({battle_obj:{},nuSet:new Set()})
  )).then(({battle_obj,nuSet})=>{
    const _b = _battles.save(battle_obj,fn);
    for(p of nuSet)if(blackSet.has(p))nuSet.delete(p);
    if(--depth>0&&nuSet.size)
      return res(_battles.fromUsers([...nuSet].filter((_,i)=>i<243),{drs,depth,minRank,blackSet,fn,cl}))
    else return res(_b)
  })
});

module.exports = _battles;
