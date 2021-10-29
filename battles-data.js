const AKMap = require('array-keyed-map');
const {readFileSync,writeFileSync} = require('jsonfile');
const {log,arrEquals,arrCmp} = require('./helper')(__filename.split(/[\\/]/).pop());

const __medusa=(card)=>(card.card_detail_id==194&&card.level<3)?17:card.card_detail_id;

/** A wrapper for Battle Data that we collect, with methods to interact*/
class BattleData {
  /** Construct a battle data with existing data, mostly from a file
   * @param {Object} battles stored as ruleset -> mana -> team1 as array -> result as team2 won or draw against team1 -> team2 as array */
  constructor (battles){
    this._bd = new AKMap();
    Object.entries(battles).forEach(
      ([r,v])=>Object.entries(v).forEach( ([m,v])=>Object.entries(v).forEach(
          ([res,v])=>v.forEach( ([t1,v])=>v.forEach( t2=>this._bd.set([r,m,...t1,res,...t2],null)))
      ))
    )
  }

  /** Get Battles for a given ruleset and mana_cap
   * @param {string} ruleSet Eg., 'Standard'
   * @param {number} mana Eg., 13
   * @return {AKMap} a map of losing teams with their respective winning and drwaing teams, in the ascending order of battles
   */
  getBattles=(ruleSet,mana)=>{
    const battles = new AKMap();
    [...this._bd.keys()].filter(k=>k[0]==ruleSet&&k[1]==mana).forEach(([r,mana,...k])=>{
      const result = k.find(a=>a=='d'||a=='w');
      const idx = k.indexOf(result);
      const key = k.slice(0,idx);
      if(battles.has(key))battles.get(key).push([result,...k.slice(idx+1)]);
      else battles.set(key,[[result,...k.slice(idx+1)]])
    })
    return [...battles.entries()].sort((a,b)=>a[1].length-b[1].length)
  }

  /** adds given battles to the battle Map
   * @param {Object} battles straight from the api
   * Converts a team to an array of id & level arrays.
   * @param t team to convert
   * @example {team1:{summoner:{card_detail_id:49,level:1},monsters:[1:{card_detail_id:50,level:1},2:{card_detail_id:191,level:1}]}} =>
   * [[49,1],[50,1],[191,1]]
   * */
  setBattles=(battles)=>{
    battles.forEach(({ruleset,mana_cap,details})=>{
      const {type,winner,team1,team2} = JSON.parse(details);
      if (type != 'Surrender') {
        const teams = [team1,team2].map(t=>
          [...[t.summoner,...t.monsters].map(m=>[__medusa(m),m.level])]);
        if(arrEquals(...teams)){return undefined}
        const won = new Proxy({winner},{get: (t,p,r)=>{//target,prop,reciever
          if(t.winner=='DRAW'){return 'd'}
          return t.winner==p?'w':'l';
        }});
        [team1,team2].forEach(({player},i)=>teams[i].unshift(won[player]));
        this._bd.set([ruleset,mana_cap,...teams.sort().flat(2).slice(1)],0)
      }
    })
  }

  /** save to a given file name
   * @param {file path} file to save the battle data as an object
   */
  save=(file='./data/battle_data_n.json')=>{
    const newA = new AKMap();
    [...this._bd.keys()].forEach(([r,m,...k])=>{
      const result = k.find(a=>typeof a =='string');
      const idx = k.indexOf(result);
      const key = [r,m,result,...k.slice(0,idx)];
      if(newA.has(key))newA.get(key).push(k.slice(idx+1));
      else newA.set(key,[k.slice(idx+1)])
    })
    const new_battles = {};
    for(const[[rule,mana,result,...key],t] of newA.entries()){
      if(!(rule in new_battles))new_battles[rule]={};
      if(!(mana in new_battles[rule]))new_battles[rule][mana]={w:[],d:[]};
      new_battles[rule][mana][result].push([key,t]);
    }
    writeFileSync(file,new_battles);
  }

  /** get the size of the battledata, does not give a correct size*/
  get size () { return this._bd.size }
}

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

/** Gets battles from player and his opponents in tree style and converts them to usable format for the script
 * @param {string} player username
 * @returns {Array} BattleData
 */
const battles=(player,battleData)=>getBattleHistory(player)
  .then(u => u.reduce((d,c)=>[...new Set([...d,c.player_1,c.player_2])],[]))
  .then(ul=>ul.map((u,i)=>getBattleHistory(u,i).then(battleData.setBattles)))
  .then(ul=>Promise.all(ul))

module.exports = {
  BattleData, getBattleHistory:battles,
}
const b = new BattleData(readFileSync('./data/battle_data_n.json'));log(b.size)
Promise.resolve(battles('azarmadr',b)).then(()=>log(b.size,b.save('./data/battle_data_n.json')));
/*
*/
