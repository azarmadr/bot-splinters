const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const {cards, chunk2} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

const basicCards = cards.filter(c=>c.editions.match(/1|4/)&&c.rarity<3).map(c=>c.id)
const RULES_ON_CARDS = 'Broken Arrows,Even Stevens,Keep Your Distance,Little League,Lost Legendaries,Lost Magic,Odd Ones Out,Rise of the Commons,Taking Sides,Up Close & Personal'
/** Finds team satisfying quest rules, and places it at head of the teams array
 * @param {Array team} teams Better to have high scoring teams
 * @param {Object} $1 quest rules
 * @param {String} $1.type of the quest
 * @param {String} $1.value quest value to satisfy
 * @param {String} $1.color if the quest is splinter, provide color of the team
 */
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
/** Sorts by score or win rate
 * @param {Boolean} byWinRate if yes, then sorts by win rate, else by score
 */
function sortByProperty(byWinRate){
  if(byWinRate) return (a,b)=>{
    const _byCount = b.w*a.count-a.w*b.count;
    if(_byCount==0)return b.score-a.score;
    return _byCount;
  }
  else return (a,b)=>b.score-a.score
}
/** Filter battles with losing team less than 90% of the mana_cap. Winning against such team is not difficult
 * @param {Boolean} byMana if yes, filter out by mana, else keep them
 */
function filterOutByMana(byMana){
  const filterOut = (battle) => {
    if(battle.mana == 99) return true;
    const losing_team = battle.teams.find(t=>t[0]=='l'||t[0]=='d');
    if(losing_team)
      return losing_team.slice(1).reduce((s,c)=>s+[cards[c[0]-1].stats.mana].flat().pop(),0)
        >battle.mana*.9
    else return true
  }
  return byMana?filterOut:()=>true;
}
async function scoreMap2Obj(scores,fn=''){
  const scoreObj = {}
  for(const [[mana,rule,...key],stats] of scores.entries()){
    const type = key.length>2?'team':'cards'
    if(!(rule in scoreObj))scoreObj[rule]={};
    if(!(mana in scoreObj[rule]))scoreObj[rule][mana]={team:[],cards:[]};
    scoreObj[rule][mana][type].push({[type]:chunk2(key),...stats});
  }
  writeFile(`data/scores${fn}.json`, scoreObj).catch(log);
}

const _mana=id=>[cards[id-1].stats.mana].flat().pop()||1
const _rarityScore=(id,level)=>basicCards.includes(id)?1:(8**cards[id-1].rarity)
const scoreXer=team=>team.reduce((s,[id,level])=>_rarityScore(id,level)*_mana(id)+s,0)

const _toPrecision3=x=>Number(x.toFixed(3));
const teamScores = (battles,{verdictToScore={w:1,l:-1,d:-0.5},cardsToo=1,filterLessMana=1,StandardOnly,filterOutLowWR}={},fn) => {
  const scores = new AKMap();
  battles.filter(filterOutByMana(filterLessMana)).forEach(({teams,mana,rule}) => teams.forEach(([v,...t])=>{
    const kda = {w:0,l:0,d:0};const teamKey = [mana,rule,...t.flat()];kda[v]=1;
    const score = verdictToScore[v];
    if(scores.has(teamKey)){
      const stats = scores.get(teamKey)
      stats.score+=score;stats.count++;stats[v]++;
    } else scores.set(teamKey,{score,count:1,...kda})
    if(cardsToo){
      t.slice(1).forEach(c=>{
        const cardKey = [mana,rule,...c];
        if(scores.has(cardKey)){
          const stats = scores.get(cardKey)
          stats.score+=score;stats.count++;stats[v]++;
        }else scores.set(cardKey,{score,count:1,...kda})
      })
    }
    }))
  scores.forEach(s=>s.score=_toPrecision3(s.score));
  scoreMap2Obj(scores,fn)
  return scores
}

const teamWithBetterCards=betterCards=>{
  return (team,idx)=>{
    const co = 'Gray'
      +(cards[team.team[0][0]-1].color=='Gold'?'Gold':'')
      +team.team.reduce(
        (acc,[i])=>'RedWhiteBlueBlackGreen'.includes(cards[i-1].color)?cards[i-1].color:acc,'Red')
    team.team = team.team.map(([i,l])=>{
      const bc = betterCards[i]?.find(c=>co.includes(c.color)&&!team.team.flat().includes(c.id));
      if(bc)log('Better Cards: Replaced',cards[i-1].name,'with',cards[bc.id-1].name,'for team Rank',idx);
      return bc?[bc.id,bc.level]:[i,l]
    })
    return team
  }
}

const filterTeamByRules=(team,ruleset)=>{
  switch(ruleset){
    case 'Broken Arrows':
      return team.slice(1).every(c=>cards[c[0]-1].stats.abilities.ranged[c[1]-1]==0);break;
    case 'Lost Magic':
      return team.slice(1).every(c=>cards[c[0]-1].stats.abilities.magic[c[1]-1]==0);break;
    case 'Keep Your Distance':
      return team.slice(1).every(c=>cards[c[0]-1].stats.abilities.attack[c[1]-1]==0);break;
    case 'Up Close & Personal':
      return team.slice(1).every(c=>cards[c[0]-1].stats.abilities.attack[c[1]-1]>0);break;
    case 'Little League':
      return team.every(c=>[cards[c[0]-1].stats.mana].flat().pop()<4);break;
    case 'Lost Legendaries':
      return team.every(c=>cards[c[0]-1].rarity<4);break;
    case 'Rise of the Commons':
      return team.every(c=>cards[c[0]-1].rarity<2);break;
    case 'Taking Sides':
      return (team.reduce((a,c)=>c[0]==19?a+1:a,0)<2)&&team.slice(1).every(c=>cards[c[0]-1].color!='Gray');break//medusa
    case 'Even Stevens':
      return team.slice(1).every(c=>[cards[c[0]-1].stats.mana].flat().pop()%2==0);break;
    case 'Odd Ones Out':
      return team.slice(1).every(c=>[cards[c[0]-1].stats.mana].flat().pop()%2==1);break;
    default: return true;
  }
}
/** Generate an array of playable Teams by scoring and sorting by score or winrate
 * @param {Array} battles handle to array of battlesList
 * @param {String} player username to filter teams based on their capacity to play the team
 * @param {Object} $2 various aspects of the current battle to filter the battles list
 * @param {Object} myCards cards to filter the teams
 * @param {Object} $4 options to set the final array by.
 * @param {Boolean} $4.sortByWinRate sort the array of teams by winrate, or else by score
 * @param {String} fn file name to store the array of playable teams
 * @returns {Array} array of playable teams
 */
const playableTeams = (battles,player,{mana_cap,ruleset,inactive,quest},myCards=require(`./data/${player}_cards.json`),{sortByWinRate}={},fn='lastMatch') => {
  //const score = verdictToScore[v]*(basicCards.includes(c[0])?1:cards[c[0]-1].rarity)/4;
  //ruleset matching could be improved
  /** Get better cards from myCards*/
  const betterCards = Object.fromEntries(
    Object.entries(myCards)
    .filter(c=>c[0]!='gold'&&cards[c[0]-1].type=='Monster').map(([id,l])=>{
      const {stats,color} = cards[id-1];
      var allowedColors=('RedWhiteBlueBlackGreen'.includes(color)?
        ['Gold',color]:'RedWhiteBlueBlackGreenGold')+
        (ruleset.includes('Taking Sides')?'':'Gray')
      const statCmp=(s1,s2,level)=>
        !Object.keys(s1).every(t=>""+s1[t][l-1]==""+s2[t][level])&&
          ["attack","ranged","magic","armor","health","speed",].every(t=>s1[t][l-1]<=s2[t][level])//speed can be inverted here for a different ruleset
          &&s1.mana[l-1]>=s2.mana[level]
          &&(s1.abilities.slice(0,l).flat()+''==''||s1.abilities.slice(0,l).flat()+''==s2.abilities.slice(0,level+1).flat()+'')
      const better = cards.filter(c=>
        c.id in myCards&&id!=c.id&&c.type=='Monster'&&
        allowedColors.includes(c.color)&&statCmp(stats,c.stats,myCards[c.id]-1)
      ).map(({color,id})=>{return{color,id,level:myCards[id]}})
      if(better.length)return[[id],better]
    }).filter(x=>x)
  )
  let mana=mana_cap,rule=RULES_ON_CARDS.includes(ruleset)?'Standard':ruleset;
  if(rule!=ruleset) log('Filtering Teams for',ruleset)
  do{
    const scores = teamScores(battles.filter(b=>b.mana==mana&&b.rule==rule));
    var filteredTeams = [...scores.entries()].filter(([[m,r,...t],s])=>
      t.length>2    && chunk2(t).every(c=>inactive.indexOf(cards[c[0]-1].color)<0) &&
      s.count<2*s.w && chunk2(t).every(c=>myCards[c[0]]>=c[1]) &&
      filterTeamByRules(chunk2(t),ruleset)
    )
      .map(([[m,r,...t],s])=>{return {team:chunk2(t),...s}})
    mana--;
  }while(filteredTeams.length<1&&(mana>12))
  filteredTeams.forEach(t=>t.score=_toPrecision3(t.score*scoreXer(t.team)/mana_cap))
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(1+filteredTeams.length/27)
  if(quest)priorByQuest(filteredTeams,quest);
  writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  return filteredTeams.map(teamWithBetterCards(betterCards));
}

module.exports = {teamScores,playableTeams,scoreMap2Obj};
