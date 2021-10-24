const {readFile,writeFile} = require('jsonfile');
const {log,arrEquals,arrCmp} = require('./helper')(__filename.split(/[\\/]/).pop());

/** Get Battles from API
 * @param {string} player username
 * @returns {object} gets 50 battles from recent past */
async function getBattleHistory(player,counter=0) {
  const battleHistory = await require('async-get-json')(`https://game-api.splinterlands.io/battle/history?player=${player}`)
    .then(b=>b.battles)
    .catch((error) => {
      log('There has been a problem with your fetch operation:', error);
      return [];
    });
  require('readline').clearLine(process.stdout,0)
  require('readline').cursorTo(process.stdout,0);
  process.stdout.write(`battle-data: ${counter+' '+player}`);
  return battleHistory;
}

/** Replace all instances of Elven Mystic with Medusa, Since they are same till level 3
 * @param {number} m is card_detail_id number
 * @returns {null} Modifies the card_detail_id to 17 if it is 194 with level less than 3. */ 
const __medusa=(m)=>(m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;
/** Converts a team to an array of id & level arrays.
 * @param t team to convert
 * @example team1:{summoner:{card_detail_id:49,level:1},monsters:[1:{card_detail_id:50,level:1},2:{card_detail_id:191,level:1}]} =>
 * [[49,1],[50,1],[191,1]]
 * */
const xtractTeam=(t)=>[...[t.summoner,...t.monsters].map(m=>[__medusa(m),m.level])]
const genBattleList=(battles)=>battles.map(
  ({ruleset,mana_cap,created_date,details})=>{
    const {type,winner,team1,team2,seed} = JSON.parse(details);
    if (Date.parse(created_date)>1631856895886 && type != 'Surrender') {
      const teams = [team1,team2].map(xtractTeam);
      if(arrEquals(...teams)){return undefined}
      const won = new Proxy({winner},{get: (t,p,r)=>{//target,prop,reciever
        if(t.winner=='DRAW'){return 'd'}
        return t.winner==p?'w':'l';
      }});
      [team1,team2].forEach(({player},i)=>teams[i].unshift(won[player]));
      return{date:created_date,mana:mana_cap,rule:ruleset,id:seed,teams}
    }
  }
)

/** Gets battles from player and his opponents in tree style and converts them to usable format for the script
 * @param {string} player username
 * @returns {Array} BattleData
 */
const battles = (player,fn='') => getBattleHistory(player)
  .then(battles => battles.reduce((d,c)=>[...new Set([...d,c.player_1,c.player_2])],[]))
  // Important to not use curly brackets in the following statement
  .then(ul=>ul.map((u,i)=>getBattleHistory(u,i).then(genBattleList)))
  .then(promBattles=>Promise.all(promBattles).then(x=>x.flat().filter(x=>x)))
  .then(battlesList=>{ return new Promise((res,rej) =>
    readFile(`./data/battle_data${fn}.json`,(e,d)=>{
      let battlesList = battlesList,__c=battlesList.length;
      console.log();
      log(__c,' battles this session');
      if(e){log('Error reading file: ',e)}
      else{ d && (battlesList = [...d,...battlesList])}
      log('battles',__c=battlesList.length-__c);
      battlesList = [...new Map(battlesList.map(item =>
        [item.teams.map(t=>t.slice(1)).sort(arrCmp)+'', item])).values()];
      log('battles',battlesList.length-__c,' added')
      writeFile(`data/battle_data${fn}.json`, battlesList).catch(e=>log(e))
      res(battlesList);
      })
  )})

module.exports.battlesList = battles;
//Promise.resolve(battles('azarmadr')).then(b=>log(b[0],b.at(-1),b.filter(a=>a.teams.length<2).length))
