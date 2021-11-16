const {readFile,writeFile} = require('jsonfile');
const {_arr,_team,_dbug} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

const _battles = {};
var _bc={count:0,pc:0,'original battles':0,'battles this session':0,'uniq Battles':0};
async function getBattleHistory(player = '') {
  const battleHistory = await require('async-get-json')(`https://api2.splinterlands.com/battle/history?player=${player}`)
    .catch((error) => async function getBattleHistory(player = '') {
      log('fetching another api');
      const battleHistory = await require('async-get-json')(`https://game-api.splinterlands.com/battle/history?player=${player}`)
        .catch((error) => {
          log('There has been a problem with your fetch operation:', error);
          return {battles:[]};
        });
    }).then(b=>b.battles.filter(b=>!b.details.includes('"type":"Surrender"')))
  require('readline').clearLine(process.stdout,0)
  require('readline').cursorTo(process.stdout,0);
  process.stdout.write(`battle-data: ${_bc.pc+++' '+player}`);
  return battleHistory;
}

const __medusa=(m)=>(m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;
const xtractTeam=(t)=>[...[t.summoner,...t.monsters].map(m=>[__medusa(m),m.level])]
const genBattleList=(battles,battle_obj)=>battles.reduce(
  (battle_obj,{ruleset,mana_cap,created_date,details})=>{
    const {winner,team1,team2} = JSON.parse(details);
    //if (Date.parse(created_date)>1631856895886) {
    const teams = [team1,team2].map(xtractTeam);
    if(!_arr.eq(...teams)){
      const won = new Proxy({winner},{get: (t,p,r)=>{//target,prop,reciever
        if(t.winner=='DRAW'){return 'd'}
        return t.winner==p?'w':'l';
      }});
      [team1,team2].forEach(({player},i)=>teams[i].unshift(won[player]));
      let obj = battle_obj;
      const [_,...rem] = teams.sort().flat(2);
      for(let path of (ruleset.split('|').reduce((rules,cr)=>
        _team.rules.secondary.includes(cr)?rules:rules.concat(cr)
        ,[]).sort().join()||'Standard').split(','))obj=obj[path]??={};
      obj=obj[mana_cap]??=[];
      obj.push(rem);
    }
    return battle_obj
  },battle_obj
)

_battles.merge=(obj,obj2merge)=>{
  for(let[key,value] of Object.entries(obj2merge)){
    if(Array.isArray(value)){
      obj[key]??=[];
      _bc['original battles']+=obj[key].length;
      obj[key]= [...new Map([...obj[key],...value].map(i=>[i+'',i])).values()]
      if(value.length!=obj[key].length)
        _dbug.in1(JSON.stringify({
          '#':_bc.count++,'original array':_bc['original battles'],'by#':_bc['battles this session']+=value.length,'new uniqBattles':_bc['uniq Battles']+=obj[key].length
        }))
    }
    else _battles.merge(obj[key]??={},value);
  }
}
_battles.save=(bl,fn='')=>{
  return new Promise((res,rej) =>
    readFile(`./data/battle_data${fn}.json`,(e,d)=>{
      let battlesList = d||{};
      console.log()
      if(e){log('Error reading file: ',e)}
      _battles.merge(battlesList,bl)
      console.log();log({..._bc,'uniq battles added':_bc['uniq Battles']-_bc['original battles']});Object.keys(_bc).forEach(k=>_bc[k]=0)
      writeFile(`data/battle_data${fn}.json`, battlesList).catch(e=>log(e))
      res(battlesList);
    })
  )}
/** Generates battles list from an array of users. First it is chunked to an array of smaller array, and then gets battlesList for each chunk, concats them all to a final array.
 * @param {Array String} ul array of users
 * @param {Number} cl chunk length
 * @param {String} fn additional filename postfix to be added to `./data/battle_data`
 * @returns {Array battle} array of battles and saves the same
 */
_battles.userList2Battles=(ul,cl=27)=>Promise.resolve(_arr.chunk(ul,cl).reduce(
  (memo,ul_chunk)=>memo.then(bl=>
    Promise.all(ul_chunk.map(u=>getBattleHistory(u).then(b=>genBattleList(b,bl)))).then(()=>bl)
  ),Promise.resolve({})
))

/** Generates user list from a given player battle history, and passes it on to _battles.userList2Battles function to create aggregate battles list, and saves it to a file
 * @param {String} player Splinterlands account name of a player
 * @param {String} fn additional filename postfix to be added to `./data/battle_data`
 * @returns {Array battle} array of battles
 */
_battles.fromUser = (player,fn) => getBattleHistory(player)
  .then(bh => [...new Set(bh.map(c=>[c.player_1,c.player_2]).flat())])
  .then(ul=>_battles.userList2Battles(ul,27))
  .then(bl=>_battles.save(bl,fn))

_battles.fromUserList = (players,fn,cl=27) =>Promise.resolve(
  _arr.chunk(Array.isArray(players)?players:players.split(','),cl).reduce(
    (memo,ul_chunk)=>memo.then(us=>
      Promise.all(ul_chunk.map(u=>getBattleHistory(u).then(bh=>
        bh.map(c=>us.add(c.player_1)&&us.add(c.player_2))
      ))).then(()=>us)
    ),Promise.resolve(new Set())
  ))
  .then(us=>_battles.userList2Battles([...us],27))
  .then(bl=>_battles.save(bl,fn))

module.exports = _battles;
//Promise.resolve(_battles.fromUserList('azarmadr3,azarmadr,enochroot','')).then(b=>log('a'))
