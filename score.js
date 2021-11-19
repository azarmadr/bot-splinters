const AKMap = require('array-keyed-map');
const {readFileSync,writeFileSync} = require('jsonfile');
const {_team,_card,_arr} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

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
      log({'Playing for Quest':{[value]:type}});
      team=teams.find(t=>_card.color(t.team[0])===color);
      break;
    case 'no_neutral':
      log({'Playing for Quest':type});
      team = teams.find(t=>t.team.slice(1).every(c=>_card.color(c)!='Gray'))
      break;
    case 'ability':
      log({'Playing for Quest':{[value]:type}});
      team=teams.find(t=>t.team.some(c=>(_card.abilities(c)+'').includes(value)))
      break;
    default: team = null;
  }
  if(team)teams.unshift(team);
}
/** Sorts by score or win rate
 * @param {Boolean} byWinRate if yes, then sorts by win rate, else by score
 */
function sortByProperty(byWinRate){
  return (...e)=>{
    const [a,b] = e.map(x=>Array.isArray(x)?x[1]:x);
    const _byCount = b.w*a.count-a.w*b.count;
    if(!byWinRate||!_byCount)return b.score-a.score;
    return _byCount;
  }
}
/** Filter battles with losing team less than 90% of the mana_cap. Winning against such team is not difficult
 * @param {Boolean} byMana if yes, filter out by mana, else keep them
 */
function filterOutByMana(byMana=99){
  return battle => {
    if(byMana == 99) return true;
    const losing_team = battle.slice(0,battle.findIndex(a=>a=='d'||a=='w'))
    if(losing_team) return _team.mana(losing_team) > byMana*.81
    else return true
  }
}

const _rarityScore=(id,level)=>(level==1&&_card.basic.includes(id))?1:(8**_card.rarity(id)*level)
const scoreXer=team=>
  _team.adpt(team).reduce((s,[id,level])=>_rarityScore(id,level)*(_card.mana(id)||1)+s,0)

const _toPrecision3=x=>Number(x.toFixed(3));
const teamScores = (battles,{cardscores={},myCards,verdictToScore={w:1,l:-1,d:-0.5},mana_cap}={}) => {
  const scores = new AKMap();
  battles.forEach(k=>{
    const result = k.find(a=>a=='d'||a=='w');
    const idx = k.indexOf(result);
    [k.slice(0,idx),k.slice(idx+1)].forEach((t,i)=>{
      if(!t.every((c,i)=>i%2?c in myCards:1))return;
      const cardScrs  = [scores.has(t)?scores.get(t):{w:0,l:0,d:0,count:0},
        ..._arr.chunk2(t).map(([c],x,{length})=>(cardscores[c]??={p:{}}).p[x>length/2?x-length:x]??={w:0,l:0,d:0,count:0})]
      if(result=='d'){cardScrs.forEach(cs=>cs.d++)}else{cardScrs.forEach(cs=>cs[['l','w'][i]]++)}
      cardScrs.forEach(cs=>cs.count++)
      scores.set(t,cardScrs[0]);
    })
  })
  scores.forEach((s,t)=>s.score=_toPrecision3(scoreXer(_arr.chunk2(t))/mana_cap*['w','l','d'].reduce((sc,k)=>sc+s[k]*verdictToScore[k],0)));
  Object.entries(cardscores).forEach(([c,cs])=>{
    Object.values(cs.p).forEach(s=>s.score=_toPrecision3(_rarityScore(c,myCards[c])*['w','l','d'].reduce((sc,k)=>sc+s[k]*verdictToScore[k],0)));
    cs.score=Object.values(cs.p).reduce((tt,s)=>tt+s.w,0)
    cs.pos = Object.entries(cs.p).reduce((p,[i,s])=>cs[p]?.w>s.w?p:i,'-1')
  })
  return scores
}
//var cardscores={};teamScores(require('./data/battle_data.json').Standard[13],{cardscores,mana_cap:13,myCards:Object.fromEntries(_card.basic.map(c=>[c,1]))});log(cardscores)//Example

const teamWithBetterCards=(betterCards,mycards,mana_cap)=>{
  return (team,idx)=>{
    if(idx<3){
      const co = 'Gray'
        +(_card.color(team.team[0])=='Gold'?'Gold':'')
        +team.team.reduce(
          (acc,[i])=>'RedWhiteBlueBlackGreen'.includes(_card.color(i))?_card.color(i):acc,'Red')
      team.team = team.team.map(([i,l])=>{
        const bc = betterCards[i]?.find(c=>co.includes(c.color)&&!team.team.flat().includes(c.id));
        if(bc)log({'Better Cards: Replaced':_card.name(i),'with ':_card.name(bc.id),'for team Rank':idx});
        return bc?[bc.id,bc.level]:[i,l]
      })
      const fillTeamGap=(team)=>{
        const gap = mana_cap-_team.mana(team);
        const card = mycards.find(c=>
          co.includes(_card.color(c))&&_card.mana(c)<=gap&&
          _card.type(c) === 'Monster' &&
            team.every(uc=>c[0]!=uc[0])&&team.length<7);
          if(card){
            log({'adding card':_card.name(card),'at pos':card[2],'Team of Rank':idx})
            team.splice(/*card[2]??*/-1,0,card);
            fillTeamGap(team);
          }
      }
      //log({'Mana Cap':mana_cap,'Team Current Mana':_team.mana(team.team), 'DIFFERENCE':mana_cap-_team.mana(team.team),'for Team of Rank':idx});
      fillTeamGap(team.team);
    }
    return team
  }
}

const cardPassRules=rule=>{
  switch(rule){
    case 'Broken Arrows':       return c=>_card.ranged(c) ==0
    case 'Lost Magic':          return c=>_card.magic(c)  ==0
    case 'Keep Your Distance':  return c=>_card.attack(c) ==0
    case 'Up Close & Personal': return c=>_card.attack(c) >0
    case 'Little League':       return c=>_card.mana(c)   <4
    case 'Lost Legendaries':    return c=>_card.rarity(c) <4
    case 'Rise of the Commons': return c=>_card.rarity(c) <3
    case 'Taking Sides':        return c=>_card.color(c)  !='Gray'
    case 'Even Stevens':        return c=>_card.mana(c)%2==0
    case 'Odd Ones Out':        return c=>_card.mana(c)   %2
    default:                    return ()=>true;
  }
}
const filterTeamByRules=(team,rule)=>{
  if('Little League,Lost Legendaries,Rise of the Commons'.includes(rule))
    return team.every(cardPassRules(rule));
  else if('Taking Sides'===rule)
    return (team.reduce((a,c)=>c[0]==19?a+1:a,0)<2)&&team.slice(1).every(cardPassRules(rule));
  else if(_team.rules.secondary.includes(rule))
    return team.slice(1).every(cardPassRules(rule));
  else return true
}
/**
 * @example log(betterCards(require('./data/azarmadr3_cards.json'),'Standard'))
 */
const betterCards =(myCards,rule)=> Object.fromEntries(
  myCards.filter(c=>_card.type(c)=='Monster')
  .map((c,_,mycards)=>{
    const color = _card.color(c);
    const allStats = ['abilities','mana','speed','ranged','magic','attack','armor','health'].filter(s=>
      !(rule.includes('Unprotected')&&s=='armor')&&!(rule.includes('Equalizer')&&s=='health'))
    const upStats = allStats.slice(rule.includes('Reverse Speed')?3:2);
    const downStats = allStats.slice(1,rule.includes('Reverse Speed')?3:2);
    var allowedColors=('RedWhiteBlueBlackGreen'.includes(color)?
      ['Gold',color]:'RedWhiteBlueBlackGreenGold')+
      (rule.includes('Taking Sides')?'':'Gray')
    const statCmp=oc=>
      allStats.some(t=>_card[t](c)+''!=_card[t](oc)+'')
        &&upStats.every(t=>_card[t](c)<=_card[t](oc))
        && downStats.every(t=>_card[t](c)>=_card[t](oc))
        && (rule.includes('Back to Basics')||
          (_card.abilities(c).length<1||
            _card.abilities(c).filter(a=>!(rule.includes('Fog of War')&&a.match(/Sneak|Snipe/)))+''
            ==_card.abilities(oc).filter(a=>!(rule.includes('Fog of War')&&a.match(/Sneak|Snipe/)))+''));
    const better = mycards.filter(oc=>
      c[0]!=oc.id&&allowedColors.includes(_card.color(oc))&&statCmp(oc)
    ).map(c=>{return{color:_card.color(c),id:c[0],level:c[1],name:_card.name(c)}})
    if(better.length)return[_card.name(c),better]
  }).filter(x=>x)
)
const sortMyCards=cardscores=>{
  return (...c)=>{
    const [as,bs] = c.map(x=>cardscores[x[0]]?.score);
    return bs-as
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
const playableTeams = (battles,{mana_cap,ruleset,inactive,quest},myCards=Object.fromEntries(_card.basic.map(c=>[c,1])),{sortByWinRate}={}/*,fn='lastMatch'*/) => {
  //const score = verdictToScore[v]*(_card.basic.includes(c[0])?1:_card.rarity(c))/4;
  //ruleset matching could be improved
  /** Get better cards from myCards*/
  let {attr_r, card_r} = ruleset.split('|').reduce((rules,cr)=>{
    _team.rules.secondary.includes(cr)?(rules.card_r=cr):rules.attr_r.push(cr);
    return rules},{attr_r:[]})
  attr_r[0]??='Standard'
  log('Filtering Teams for',{ruleset,card_r,attr_r})
  var filteredTeams=[],cardscores={},battlesList = battles;
  for(let path of attr_r)battlesList=battlesList[path];//This assumes object exists
  for(let mana of Object.keys(battlesList).filter(x=>x<=mana_cap&&Number(x)).sort((a,b)=>b-a)){
    const scores = teamScores(battlesList[mana].filter(filterOutByMana(mana)),{mana_cap,cardscores,myCards});
    log({[`battles length for ${mana}`]:battlesList[mana].length,'Scores Size':scores.size,
      'Adding teams':filteredTeams.push(
        ...[...scores.entries()].filter(([t,s])=>
          t.length>2    && _arr.chunk2(t).every(c=>!inactive.includes(_card.color(c))) &&
          s.count<2*s.w && _arr.chunk2(t).every(c=>myCards[c[0]]>=c[1])
          && filterTeamByRules(_arr.chunk2(t),card_r)
        ).sort(sortByProperty(sortByWinRate)).filter((_,i,{length})=>i<length/9)
        .map(([t,s])=>{return {team:_arr.chunk2(t),...s}})
      )})
    // for research
    const xerDist = {};
    filteredTeams.forEach(t=>xerDist[scoreXer(t.team)]=Math.max(xerDist[scoreXer(t.team)]||0,t.count))
    try{var xer = readFileSync('./data/xer.json')}catch{xer={}}
    xer[mana]=xerDist;writeFileSync('./data/xer.json',xer);
    // for research
    if(filteredTeams.length>243)break;
  }
  var filteredTeams_length = filteredTeams.length;
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(3+filteredTeams.length/27)
  log('trimming', {filteredTeams_length},'to',filteredTeams.length)
  if(quest)priorByQuest(filteredTeams,quest);
  //writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  const mycards = Object.entries(myCards).filter(c=>c[0]!='gold'&&cardPassRules(card_r)(c))
    .map(c=>[Number(c[0]),c[1],cardscores[c[0]]?.pos])//,Math.min(...Object.entries(cardscores[c[0]]).map(x=>[x[0],x[1].score]))
    .sort(sortMyCards(cardscores))
  return filteredTeams.map(teamWithBetterCards(betterCards(mycards,ruleset),mycards,mana_cap));
}

module.exports = {teamScores,playableTeams};
//log(playableTeams(require('./data/battle_data.json'),{ mana_cap: 14, ruleset: 'Stampede', inactive: 'White,Gold', quest: { type: 'splinter', color: 'Green', value: 'Earth' }, opponent_player: 'doihai943' }).map(a=>{return{c:a.count,s:a.score}})/*.map(({team})=>team.map(c=>_card.name(c)))*/)
