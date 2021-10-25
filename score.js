const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const {log,cards, chunk2} = require('./helper')(__filename.split(/[\\/]/).pop());
const bC = cards.filter(c=>c.editions.match(/1|4/)&&c.rarity<3).map(c=>c.id)

const priorByQuest=(teams,{type,value,color})=>{
  var team;
  switch(type){
    case 'splinter':
      log(`playing for ${value} ${type} quest`);
      team=teams.find(t=>cards[t.team[0][0]-1].color===color);
      break;
    case 'no_neutral':
      log(`playing for ${type} quest`);
      team = teams.find(t=>t.team.slice(1).every(c=>cards[c[0]-1].color!='Gray'))
      break;
    case 'ability':
      log(`playing for ${value} ${type} quest`);
      team=teams.find(t=>!(t.team.every(c=>!(cards[c[0]-1].stats.abilities?.slice(0,c[1])+'').includes(value))))
      break;
    default: team = null;
  }
  if(team)teams.unshift(team);
}
function sortByProperty(s){
  if(s) return (a,b)=>{
    const _byCount = b.w*a.count-a.w*b.count;
    if(_byCount==0)return b.score-a.score;
    return _byCount;
  }
  else return (a,b)=>b.score-a.score
}
function filterOutByMana(toggle,mana){
  const filterOut = ([t1]) => {
    if(mana == 99) return true;
    return mana*.9 <= chunk2(t1).reduce((s,c)=>s+[cards[c[0]-1].stats.mana].flat().pop(),0)
  }
  return toggle?filterOut:()=>true;
}
const scoreXer=t=>t.reduce((s,[i,l])=>(bC.includes(i)?1:(8**cards[i-1].rarity))*(cards[i-1].stats.mana?.[l-1]||cards[i-1].stats.mana||1)+s,0)
const _toPrecision3=x=>Number(x.toFixed(3));

const playableTeams = (battles,player,{verdictToScore={w:1,l:-1,d:-0.5},filterLessMana=1,mana_cap,ruleset,inactive,quest},myCards=require(`./data/${player}_cards.json`),{sortByWinRate}={},fn='lastMatch') => {
  //const score = verdictToScore[v]*(bC.includes(c[0])?1:cards[c[0]-1].rarity)/4;
  //ruleset matching could be improved
  let mana=mana_cap;
  do{
    const scores = new AKMap();
    const _battles = battles.getBattles(ruleset,mana)
      .filter(filterOutByMana(filterLessMana,mana))
    _battles.forEach(([t1,v])=>v.forEach(([r,...t2])=>{
        const [s1,s2]=[t1,t2].map(t=>scores.has(t)?scores.get(t):{w:0,l:0,d:0,count:0})
        if(r=='d'){s1.d++;s2.d++,s1.count++,s2.count++}
        else      {s1.l++;s2.w++,s1.count++,s2.count++}
        scores.set(t1,s1); scores.set(t2,s2);
      }))
    var filteredTeams = [...scores.entries()].filter(([t,s])=>
      chunk2(t).every(c=>inactive.indexOf(cards[c[0]-1].color)<0) &&
      s.count<2*s.w && chunk2(t).every(c=>myCards[c[0]]>=c[1])
    )
      .map(([t,s])=>{return {team:chunk2(t),...s}})
    mana--;
  }while(filteredTeams.length<1&&(mana>12))
  filteredTeams.forEach(t=>
    t.score=_toPrecision3(
      ['w','l','d'].reduce((s,c)=>s+verdictToScore[c]*t[c],0)
      *scoreXer(t.team)/mana))
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(1+filteredTeams.length/27)
  if(quest)priorByQuest(filteredTeams,quest);
  writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  return filteredTeams;
}

module.exports = {playableTeams};
