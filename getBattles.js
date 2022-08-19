const R = require('ramda')
const {writeFileSync} = require('jsonfile');
const {log,_dbug,sleep} = require('./util/dbug');
const {T,Ru,getRules} = require('./util/card');
const {_arr} = require('./util/array');
const getJson=(player)=>Promise.race([
  fetch(`https://game-api.splinterlands.com/battle/history?player=${player}`)
  .catch(()=>fetch(`https://api2.splinterlands.com/battle/history?player=${player}`))
  .then(x=>x.json())
  .then(b=>b.battles??[]),
  new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),17290)),
]).catch(()=>[])
const _battles = {},_dbugBattles=[];
//const __medusa=(m,t)=>(T.colorSec(t)=='Blue'&&m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;

const db = require('better-sqlite3')('./data/battles.db',{timeout:81e3});
db.prepare(`CREATE TABLE IF NOT EXISTS battles (
  team1 TEXT,
  team2 TEXT,
  rules TEXT,
  r INTEGER,
  m1 INTEGER,
  m2 INTEGER,
  c1 INTEGER,
  c2 INTEGER,
  w INTEGER,
  l INTEGER,
  d INTEGER,
  CONSTRAINT uid PRIMARY KEY(team1,team2,rules)
)`).run()
const rStmt = ['w','l','d'].reduce((a,k)=>{
  a[k]=db.prepare(`
    INSERT INTO battles (team1, team2, rules, r, m1, m2, ${k}, c1, c2)
    VALUES (:team1, :team2, :rules, :r, :m1, :m2, :${k}, :c1, :c2)
    ON CONFLICT(team1, team2, rules)
    DO UPDATE SET ${k}=excluded.${k}
  `);
  return a
},{})

const dbCount = db.prepare(`SELECT COUNT(*) AS c FROM battles`)
var BC={count:dbCount.get().c,pc:0}

async function getBattles(player = '',nuSet=new Set(),rFilter=R.T,drs=R.F){
  const battleHistory = await getJson(player)
    .then(b=>b.filter(b=>
      rFilter(Math.max(b.player_1_rating_final,b.player_2_rating_final))
      &&!b.details.includes('"type":"Surrender"')
    )).catch(e=>log(e)??[])
  _dbug.in1(BC.pc++,BC.lastInsertRowid,player);
  db.transaction(_=>battleHistory.map(b=>{
    const {winner,team1,team2} = JSON.parse(b.details);
    nuSet.add(team1.player); nuSet.add(team2.player);
    let teams = [team1,team2].map(t=>
      [t.summoner,...t.monsters].map(m=>[m.card_detail_id,m.level]));
    if(!_arr.eq(...teams)&&!teams.some(x=>T(x).length<2)){
      if(drs({rules:b.ruleset,mana:b.mana_cap,teams}))_dbugBattles.push(b);
      let res = winner==team1.player?1:winner==team2.player?-1:0;
      if(teams[1]>teams[0]){
        teams.reverse();
        res*=-1;
      }
      let [m1,m2] = teams.map(T.mana);
      let [c1,c2] = teams.map(T.colors).map(colors=>{
        let res = ['Red','Blue','Green','Black','White'].reduce((a,x,i)=>colors.includes(x)?i:a,5)
        res+=colors.includes('Gray')?6:0
        res+=colors.includes('Gold')?12:0
        return res
      })
      let k = res==1?'w':res==-1?'l':'d'
      BC.lastInsertRowid = rStmt[k].run({
        team1:teams[0].toString(),
        team2:teams[1].toString(),
        rules:Ru.battleRule (b.ruleset) (teams),
        r: Ru.num(teams),
        m1,m2,c1,c2,[k]:1
      }).lastInsertRowid
    }
  }))()
  return nuSet
}

const checkIfPresent=(obj,delay)=>x=>Date.now()-obj[x]<delay?0:(obj[x]=Date.now());
const blackSet = checkIfPresent({},practiceOn?27e3:81e4);
_battles.fromUsers=(players,{depth=2,rFilter,drs,cl=27}={})=>new Promise(res=>{
  const ul = [...new Set(Array.isArray(players)?players:players.split(','))].filter(blackSet).filter((_,i)=>i<243);
  if(practiceOn)log({ul,depth})
  Promise.resolve(_arr.chunk(cl,ul).reduce(
    (memo,ul_chunk)=>memo.then(nuSet=>
      Promise.all(ul_chunk.map(u=>getBattles(u,nuSet,rFilter,drs))).then(()=>nuSet)
    ),Promise.resolve(new Set())
  )).then(x=>depth<3?x:sleep(27e3).then(_=>x)).then(nuSet=>{
    log({'added':-(BC.count-(BC.count=dbCount.get().c))})
    if(--depth>0&&nuSet.size&&_dbugBattles.length<3&&!globalThis.END_GetBattles)
      return res(_battles.fromUsers([...nuSet],{drs,depth,rFilter,cl}))
    else {
      if(_dbugBattles.length){
        log({L:_dbugBattles.length})
        writeFileSync('data/dbugBattles.json',_dbugBattles)
      }
      _dbugBattles.length=0;
      return res('done')
    }
  })
});
module.exports = _battles;

if(db.prepare('SELECT COUNT(*) AS x FROM battles').get().x<1e5){
  fetch("https://api.splinterlands.io/players/leaderboard_with_player?leaderboard=0")
    .then(x=>x.json()).then(x=>_battles.fromUsers(x.leaderboard.map(x=>x.player),{depth:2})).catch(log)
}
