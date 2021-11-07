const AKMap = require('array-keyed-map');
const {readFile,writeFile} = require('jsonfile');
const {_team,_card,chunk2} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const chalk = require('chalk');

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
      log(chalk`playing for {yellow ${value}} {red ${type}} quest`);
      team=teams.find(t=>_card.color(t.team[0])===color);
      break;
    case 'no_neutral':
      log(chalk`playing for {yellow ${value}} quest`);
      team = teams.find(t=>t.team.slice(1).every(c=>_card.color(c)!='Gray'))
      break;
    case 'ability':
      log(chalk`playing for {yellow ${value}} {red ${type}} quest`);
      team=teams.find(t=>!(t.team.every(c=>!(_card.abilities(c)+'').includes(value))))
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
    const [v,...losing_team] = battle.teams.find(t=>t[0]=='l'||t[0]=='d');
    if(losing_team) return _team.mana(losing_team) >battle.mana*.9
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

const _rarityScore=(id,level)=>_card.basic.includes(id)?1:(8**_card.rarity(id))
const scoreXer=team=>
  team.reduce((s,[id,level])=>_rarityScore(id,level)*(_card.mana(id)||1)+s,0)

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

const teamWithBetterCards=(betterCards,myCards,mana_cap)=>{
  return (team,idx)=>{
    const co = 'Gray'
      +(_card.color(team.team[0])=='Gold'?'Gold':'')
      +team.team.reduce(
        (acc,[i])=>'RedWhiteBlueBlackGreen'.includes(_card.color(i))?_card.color(i):acc,'Red')
    team.team = team.team.map(([i,l])=>{
      const bc = betterCards[i]?.find(c=>co.includes(c.color)&&!team.team.flat().includes(c.id));
      if(bc)log('Better Cards: Replaced',_card.name(i),'with',_card.name(bc.id),'for team Rank',idx);
      return bc?[bc.id,bc.level]:[i,l]
    })
    const fillTeamGap=(team)=>{
      const gap = mana_cap-_team.mana(team);
      if(gap){
        const card = Object.entries(myCards).find(c=>
          co.includes(_card.color(c))&&_card.mana(c)<=gap&&
          team.every(uc=>c[0]!=uc[0])&&team.length<8);
        if(card){
          team.push(card);
          log({'adding card':_card.name(card),'Team of Rank':idx})
          fillTeamGap(team,myCards,mana_cap);
        }
      }
    }
    if(idx<3){
      //log({'Mana Cap':mana_cap,'Team Current Mana':_team.mana(team.team), 'DIFFERENCE':mana_cap-_team.mana(team.team),'for Team of Rank':idx});
      fillTeamGap(team.team);
    }
    return team
  }
}

const cardPassRules=ruleset=>{
  switch(ruleset){
    case 'Broken Arrows':
      return c=>_card.ranged(c)==0;break;
    case 'Lost Magic':
      return c=>_card.magic(c)==0;break;
    case 'Keep Your Distance':
      return c=>_card.attack(c)==0;break;
    case 'Up Close & Personal':
      return c=>_card.attack(c)>0;break;
    case 'Little League':
      return c=>_card.mana(c)<4;break;
    case 'Lost Legendaries':
      return c=>_card.rarity(c)<4;break;
    case 'Rise of the Commons':
      return c=>_card.rarity(c)<2;break;
    case 'Taking Sides':
      return c=>_card.color(c)!='Gray';break
    case 'Even Stevens':
      return c=>!_card.mana(c)%2;break;
    case 'Odd Ones Out':
      return c=>_card.mana(c)%2;break;
    default: return ()=>true;
  }
}
const filterTeamByRules=(team,ruleset)=>{
  if('Little League,Lost Legendaries,Rise of the Commons'.includes(ruleset))
    return team.every(cardPassRules(ruleset));
  else if('Taking Sides'===ruleset)
    return (team.reduce((a,c)=>c[0]==19?a+1:a,0)<2)&&team.slice(1).every(cardPassRules(ruleset));
  else if(_team.rules.secondary.includes(ruleset))
    return team.slice(1).every(cardPassRules(ruleset));
  else return true
}
/**
 * @example log(betterCards(require('./data/azarmadr3_cards.json'),'Standard'))
 */
const betterCards =(myCards,ruleset)=> Object.fromEntries(
  Object.entries(myCards)
  .filter(c=>c[0]!='gold'&&_card.type(c)=='Monster'&&cardPassRules(ruleset)(c))
  .map((c,_,mycards)=>{
    c[0]=Number(c[0]);
    const color = _card.color(c);
    const allStats = ['mana','ranged','magic','attack','speed','armor','health'];
    const [,...upStats] = allStats;
    const downStats = ['mana'];
    var allowedColors=('RedWhiteBlueBlackGreen'.includes(color)?
      ['Gold',color]:'RedWhiteBlueBlackGreenGold')+
      (ruleset.includes('Taking Sides')?'':'Gray')
    const statCmp=oc=>
      !allStats.every(t=>_card[t](c)==_card[t](oc))&&
        upStats.every(t=>_card[t](c)<=_card[t](oc))&&//speed can be inverted here for a different ruleset
        downStats.every(t=>_card[t](c)>=_card[t](oc))&&
        (_card.abilities(c).length<1||_card.abilities(c)+''==_card.abilities(oc)+'')
    const better = mycards.map(c=>[Number(c[0]),c[1]]).filter(oc=>
      c[0]!=oc.id&&
      allowedColors.includes(_card.color(oc))&&statCmp(oc)
    ).map(c=>{return{color:_card.color(c),id:c[0],level:c[1]}})
    if(better.length)return[c[0],better]
  }).filter(x=>x)
)
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
  //const score = verdictToScore[v]*(_card.basic.includes(c[0])?1:_card.rarity(c))/4;
  //ruleset matching could be improved
  /** Get better cards from myCards*/
  let {attr_r, card_r} = ruleset.split('|').reduce((rules,cr)=>{
    _team.rules.secondary.includes(cr)?(rules.card_r=cr):rules.attr_r.push(cr);
    return rules
  },{attr_r:[]})
  attr_r.length||attr_r.push('Standard');
  let mana=mana_cap;
  log('Filtering Teams for',{ruleset,card_r,attr_r})
  do{
    log('Finding teams based on: '+chalk.yellow(mana)+' mana');
    const scores = teamScores(battles.filter(b=>b.mana==mana&&b.rule==attr_r.sort().join()));
    var filteredTeams = [...scores.entries()].filter(([[m,r,...t],s])=>
      t.length>2    && chunk2(t).every(c=>inactive.indexOf(_card.color(c))<0) &&
      s.count<2*s.w && chunk2(t).every(c=>myCards[c[0]]>=c[1]) &&
      filterTeamByRules(chunk2(t),card_r)
    )
      .map(([[m,r,...t],s])=>{return {team:chunk2(t),...s}})
    mana--;
  }while(filteredTeams.length<1&&(mana>12))
  var filteredTeams_length = filteredTeams.length;
  filteredTeams.forEach(t=>t.score=_toPrecision3(t.score*scoreXer(t.team)/mana_cap))
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(1+filteredTeams.length/27)
  log('trimming', {filteredTeams_length},'to',filteredTeams.length)
  if(quest)priorByQuest(filteredTeams,quest);
  writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  return filteredTeams.map(teamWithBetterCards(betterCards(myCards,ruleset),myCards,mana_cap));
}

module.exports = {teamScores,playableTeams,scoreMap2Obj};
