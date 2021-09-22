require('dotenv').config()
const fetch = require("node-fetch");
const fs = require('fs');

let pc = 0;
const distinct = (value, index, self) => {
  return self.indexOf(value) === index;
}
const cleanTeam = (team) => {return {summoner: team.summoner,monsters: team.monsters}}
const teamsAsKey = (teams) => {
  const a = JSON.stringify(cleanTeam(teams[0]));
  const b = teams[1]?JSON.stringify(cleanTeam(teams[1])):'';
  if(a===b&&teams[0].verdict=='d'){ teams.pop(); return a; }
  return (a>b)?(a+b):(b+a);
}

async function getBattleHistory(player = '', data = {}) {
  const battleHistory = await fetch('https://game-api.splinterlands.io/battle/history?player=' + player)
    .then((response) => {
      if (!response.ok) { throw new Error('Network response was not ok '+player); }
      return response;
    })
    .then((battleHistory) => { return battleHistory.json(); })
    .catch((error) => {
      console.log('There has been a problem with your fetch operation:', error);
      return [];
    });
  require('readline').clearLine(process.stdout,0);
  require('readline').cursorTo(process.stdout,0);
  process.stdout.write(`${pc+++' '+player}`);
  return battleHistory.battles;
}

const extractGeneralInfo = (x) => {
  return {
    created_date:  x.created_date ? x.created_date :  '',
    match_type:    x.match_type   ? x.match_type :    '',
    mana_cap:      x.mana_cap     ? x.mana_cap :      '',
    ruleset:       x.ruleset      ? x.ruleset :       '',
    inactive:      x.inactive     ? x.inactive :      ''
  }
}

const extractMonster = (team) => {
  monsters = team.monsters.map(m => {
    return {
      id:     m.card_detail_id,
      level:  m.level,
      gold:   m.gold,
    }
  })
  return {
    summoner: {
      id:      team.summoner.card_detail_id,
      level:   team.summoner.level,
      gold:    team.summoner.gold,
    },
    monsters: [...monsters],
  }
}
const teamFromBattles = (battles) => battles.map(
  battle => {
    const details = JSON.parse(battle.details);
    if (Date.parse(battle.created_date)>1631856895886 && details.type != 'Surrender') {
      const teams = [];
      const info = extractGeneralInfo(battle)
      const t1mon = extractMonster(details.team1)
      const t2mon = extractMonster(details.team2)
      teams.push({
        ...t1mon,
        battle_queue_id: battle.battle_queue_id_1,
        player_rating_initial: battle.player_1_rating_initial,
        player_rating_final: battle.player_1_rating_final,
        verdict: (battle.winner && battle.winner == battle.player_1)?'w':(battle.winner == 'DRAW')? 'd' :'l',
      })
      if(JSON.stringify(t1mon)!==JSON.stringify(t2mon)){
        teams.push({
          ...t2mon,
          battle_queue_id: battle.battle_queue_id_2,
          player_rating_initial: battle.player_2_rating_initial,
          player_rating_final: battle.player_2_rating_final,
          verdict: (battle.winner && battle.winner == battle.player_2)?'w':(battle.winner == 'DRAW')? 'd' :'l',
        })}
      return {
        ...info,
        battle_id: details.seed,
        teams: teams,
      }
    }
  })
let battlesList = [];
async function battleHistoryTo(user){
  return new Promise(res=>res(
    getBattleHistory(user)
    .then(teamFromBattles)
    .then(x => battlesList = [...battlesList, ...x])))
}
const battles = (player,fn='') => getBattleHistory(player)
  .then(u => u.map(x => {
    return [x.player_1, x.player_2]
  }).flat().filter(distinct))
  .then(ul => Promise.resolve( ul.reduce(
    (memo,user)=>memo.then(()=>battleHistoryTo(user)),Promise.resolve(null)
  )))
  .then(() => { return new Promise((res,rej) => {
    console.log(battlesList.length,' battles this session')
    fs.readFile(`./data/battle_data${fn}.json`, 'utf8', (err, data) => {
      if (err) {
        console.log(`Error reading file from disk: ${err}`);
      } else {
        battlesList = data ? [...JSON.parse(data),...battlesList] : battlesList;
      }
      console.log('battles',battlesList.length-2550)
      battlesList = battlesList.filter(x => x != undefined);
      battlesList.forEach(b=>b.teams.forEach(t=>{
        const m = t.monsters.find(m=>m.id===194 && m.level<3);m?m.id=17:'';
      }))
      battlesList = [...new Map(battlesList.map(item => [teamsAsKey(item.teams), item])).values()];
      console.log('battles',battlesList.length)
      fs.writeFile(`data/battle_data${fn}.json`, JSON.stringify(battlesList), function (err) {
        if (err) {
          console.log(err)//;rej(err)
        }
      });
      res(battlesList)
    });
  })})

module.exports.battlesList = battles;
