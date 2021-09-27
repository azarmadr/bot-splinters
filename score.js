require('dotenv').config()
const fs = require('fs');
const cards = require('./data/cards.json');
const myCards = require(`./data/${process.env.ACCOUNT}_cards.json`);

function uniqueListByKey(arr, key) {
  return [...new Map(arr.map(item => [item[key], item])).values()]
}
function sortByProperty(s){
  if(s){
    return function(a,b){
      return (a.w*b.count<a.count*b.w) ? 1 :(a.w*b.count>a.count*b.w) ? -1 : 0;
    }
  } else {
    return function(a,b){
      return a.score < b.score ? 1 : a.score > b.score ? -1 : 0;
    }
  }
}
function filterOutByMana(toggle){
  const filterOut = (battle) => {
    if(battle.mana_cap == 99) return true;
    return battle.mana_cap/10 > 2*battle.mana_cap - battle.teams.map(t=> cards.find(e=>e.id===t.summoner.id).stats.mana + t.monsters.reduce((mt,m)=>mt+cards.find(e=>e.id===m.id).stats.mana[m.level],0)).reduce((s,mc)=>s+mc,0)
  }
  return toggle?filterOut:()=>true;
}
const ownedCard = (card) => {
  return myCards.find(e => e.id === card.id && e.level >= card.level && e.gold === card.gold) ? true : false;
}
const playableTeam = (team) => {
  return ownedCard(team.summoner) && team.monsters.every(v=>ownedCard(v))
}
const getCardName = (card) => {
  const name = cards.find(e => e.id === card.id).name
  return {...card,name}
}
const cleanTeam = (team) => {
  const {w, l, d, verdict, score, count, battle_queue_id, player_rating_initial, player_rating_final, ...rem} = team;
  return rem
}
const cleanCard = (card) => {
  const {w, l, d, score, count, name, ...rem} = card;
  return rem
}
const verdictToScore = {w: 1, l: -1, d: -0.5};

const score = (battles,{cardsToo:cardsToo,filterOutByMana:fo,sortByWinRate:sort,StandardOnly:std,filterOutLowWR:wro}={},fn='score') => {
  let scores = {};
  //console.log(battles.length)
  battles.filter(filterOutByMana(fo)).forEach(b => {
    if(!scores.hasOwnProperty(b.ruleset)){
      scores[b.ruleset] = {};
    }
    if(!scores[b.ruleset].hasOwnProperty(b.mana_cap)){
      scores[b.ruleset][b.mana_cap] = { team: {playable:[],unplayable:[],}, summoner: {owned:[],unowned:[]}, monsters: {owned:[],unowned:[]}};
    }
    b.teams.forEach(t=>{
      const team = cleanTeam(t);
      team.summoner = getCardName(team.summoner)
      team.monsters = team.monsters.map(m=>getCardName(m))
      const kda = {w:0,l:0,d:0};
      const playable = playableTeam(t)?'playable':'unplayable';
      const score = verdictToScore[t.verdict]
      kda[t.verdict]=1;

      //team
      var t_f = scores[b.ruleset][b.mana_cap].team[playable].find(e=>{
        return JSON.stringify(cleanTeam(e)) === JSON.stringify(team)
      })
      if(t_f) { t_f.score += score;t_f.count++;t_f[t.verdict]++; }
      else scores[b.ruleset][b.mana_cap].team[playable].push({...team,score: score,count: 1,...kda})
      if(cardsToo){
        //summoner
        const ownership = ownedCard(t.summoner)?'owned':'unowned';
        var s_f = scores[b.ruleset][b.mana_cap].summoner[ownership].find(e=>{
          return JSON.stringify(cleanCard(e)) === JSON.stringify(t.summoner)
        })
        if(s_f) { s_f.score += score;s_f.count++;s_f[t.verdict]++; }
        else scores[b.ruleset][b.mana_cap].summoner[ownership].push({...getCardName(t.summoner),score: score,count: 1,...kda})
        //monsters
        t.monsters.forEach(m => {
          const ownership = ownedCard(m)?'owned':'unowned';
          var m_f = scores[b.ruleset][b.mana_cap].monsters[ownership].find(e=>{
            return JSON.stringify(cleanCard(e)) === JSON.stringify(m)
          })
          if(m_f) { m_f.score += score;m_f.count++;m_f[t.verdict]++; }
          else scores[b.ruleset][b.mana_cap].monsters[ownership].push({...getCardName(m),score: score,count: 1,...kda})
        })
      }
    })
  })
  Object.values(scores).forEach(rs=>
    Object.values(rs).forEach(m=>
      Object.values(m).forEach(t=>
        Object.values(t).forEach(p=>{
          Object.values(p).forEach(e=>{
            e.wr = parseFloat((e.w/e.count).toFixed(2));
          })
          p.sort(sortByProperty(sort));
          if(wro){
            var key = Object.keys(t).find(k=>t[k]===p);
            if(key.match(/playable/)) t[key]=p.filter(t=>t.wr>0.5);
          }
        })
      )))
  scores = std?scores.Standard:scores;
  fs.writeFile(`data/${process.env.ACCOUNT}_${fn}.json`, JSON.stringify(scores), function (err) {
    if (err) {
      console.log(err);
    }
  });
  return scores
}

module.exports.scores = score;
