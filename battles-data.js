const {readFile,writeFile} = require('jsonfile');
const {arrEquals,arrCmp,chunk} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
var pc = 0;
const RULES_ON_CARDS = 'Broken Arrows,Even Stevens,Keep Your Distance,Little League,Lost Legendaries,Lost Magic,Odd Ones Out,Rise of the Commons,Taking Sides,Up Close & Personal'
async function getBattleHistory(player = '') {
  const battleHistory = await require('async-get-json')(`https://game-api.splinterlands.io/battle/history?player=${player}`)
    .then(b=>b.battles)
    .catch((error) => {
      log('There has been a problem with your fetch operation:', error);
      return [];
    });
  require('readline').clearLine(process.stdout,0)
  require('readline').cursorTo(process.stdout,0);
  process.stdout.write(`battle-data: ${pc+++' '+player}`);
  return battleHistory;
}

const __medusa=(m)=>(m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;
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
      return{mana:mana_cap,rule:(RULES_ON_CARDS.includes(ruleset)?'Standard':ruleset),teams}
    }
  }
).filter(x=>x)

const battles = (player,fn='') => getBattleHistory(player)
  .then(bh => bh.reduce((d,c)=>[...new Set([...d,c.player_1,c.player_2])],[]))
  .then(ul=>Promise.resolve(chunk(ul,27).reduce(
    (memo,ul_chunk)=>memo.then(bl=>
      Promise.all(ul_chunk.map(u=>getBattleHistory(u).then(genBattleList)))
      .then(gbl=>[...bl,...gbl.flat()])
    ),Promise.resolve([])
  )))
  .then(bl=>{ return new Promise((res,rej) =>
    readFile(`./data/battle_data${fn}.json`,(e,d)=>{
      let battlesList = bl,__c=bl.length;
      console.log();
      log(__c,' battles this session');
      if(e){log('Error reading file: ',e)}
      else{ d && (battlesList = [...d,...battlesList])}
      log('battles',__c=battlesList.length-__c);
      battlesList = [...new Map(battlesList.map(item =>
        [item.rule+item.mana+item.teams.sort(), item]
      )).values()];
      log('battles',battlesList.length-__c,' added')
      writeFile(`data/battle_data${fn}.json`, battlesList).catch(e=>log(e))
      res(battlesList);
      })
  )})

module.exports.battlesList = battles;
//Promise.resolve(battles('azarmadr3','-test')).then(b=>log(b[0],b.at(-1),b.filter(a=>a.teams.length<2).length))
