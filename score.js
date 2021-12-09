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
function sortByProperty(sortByWinRate){
  return (...e)=>{
    const[a,b]    =e.map(x=>Array.isArray(x)?x[1]:x);
    const _byCount=(b._w*a.count-a._w*b.count)||(b._w-a._w)||(b.w-a.w);
    if(!sortByWinRate||!_byCount)return b.score-a.score;
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

const _rarityScore=(id,level,x=6)=>(level==1&&_card.basic.includes(id))?1:(x**_card.rarity(id)*level)
const scoreXer=(team,x=6)=>
  _team.adpt(team).reduce((s,[id,level])=>_rarityScore(id,level,x)*(_card.mana(id)||1)+s,0)
const _toPrcsn3=x=>Number(x.toFixed(3));
const dotP=(x,y)=>Object.keys(x).reduce((sc,k)=>sc+x[k]*y[k],0)

const teamScores = (battles,{cardscores={},oppCards,myCards,res2Score={w:1,l:-1,d:-0.5},mana_cap,inactive,_scoreAll}={}) => {
  const scores = new AKMap();
  battles.forEach(k=>{
    const {result,teams} = k.reduce((a,c)=>{
      if(c=='d'||c=='w')a.result=c;else a.teams[a.result?1:0].push(c);return a
    },{teams:[[],[]]});
    if(teams.every(t=>!_team.isActive(t,inactive)))return;
    const [w,l] = teams.map(t=>
      (t.some((c,x)=>x%2?0:(c in oppCards))?scoreXer(t,1.3)/mana_cap:1)*_team.mana(t)/mana_cap/
      (_team.isActive(t,inactive)?1:3)
    )
    let defaultScores = {w:0,_w:0,l:0,_l:0,d:0,_d:0,count:0};
    teams.forEach((t,i)=>{if(_scoreAll||t.every((c,x)=>x%2?1:c in myCards)){
      const cardScrs  = [scores.has(t)?scores.get(t):{...defaultScores},
        ..._arr.chunk2(t.slice(2)).map(([c],x,{length})=>
          (cardscores[c]??={p:{}}).p[x<length/2?x:x-length]??={...defaultScores})]
      cardScrs.forEach(cs=>{cs.count++;
        if(result=='d'){cs._d++;cs.d+=i?w:l}
        else{cs[i?'_w':'_l']++;cs[i?'w':'l']+=i?w:l;}
      });
      scores.set(t,cardScrs[0]);
    }})
  })
  // for research
  const xerDist = {};
  scores.forEach((s,t)=>xerDist[scoreXer(t)]=Math.max(xerDist[scoreXer(t)]||0,s.count))
  try{var xer = readFileSync('./data/xer.json')}catch{xer={}}
  xer[mana_cap]=xerDist;writeFileSync('./data/xer.json',xer);
  // for research
  scores.forEach((s,t)=>s.score=_toPrcsn3(scoreXer(_arr.chunk2(t),5)*dotP(res2Score,s)/mana_cap**3));
  Object.entries(cardscores).forEach(([c,cs])=>{
    Object.values(cs.p).forEach(s=>
      s.score=_toPrcsn3(_rarityScore(c,myCards[c])*dotP(res2Score,s))
    );
    cs.score=Object.values(cs.p).reduce((tt,s)=>tt+s.w,0)
    cs.pos = Object.entries(cs.p).reduce((p,[i,s])=>cs[p]?.w>s.w?p:i,'-1')
  })
  return scores
}

const teamWithBetterCards=(betterCards,mycards,{mana_cap,sortByWinRate})=>{
  return (team,idx)=>{
    if(!sortByWinRate&&idx<3){
      const co = 'Gray'
        +(_card.color(team.team[0])=='Gold'?'Gold':'')
        +team.team.reduce(
          (acc,[i])=>'RedWhiteBlueBlackGreen'.includes(_card.color(i))?_card.color(i):acc,'Red')
      const fillTeamGap=team=>{
        const gap = mana_cap-_team.mana(team);
        const card = mycards.find(c=>
          co.includes(_card.color(c))&&_card.mana(c)<=gap&&
          _card.type(c) === 'Monster' &&
            team.every(uc=>c[0]!=uc[0])&&team.length<7);
          if(card){
            const pos = card[2]<0?Math.max(-Math.floor((team.length-1)/2),card[2]):1+Math.min(Math.floor((team.length-1)/2),card[2])
            log({'+card':_card.name(card),'@':pos,'#Team':idx})
            team.splice(/*pos??*/team.length,0,card);
            fillTeamGap(team);
          }
      }
      fillTeamGap(team.team);
      team.team = team.team.map(([i,l])=>{
        const bc = betterCards[i]?.find(c=>co.includes(c.color)&&!team.team.flat().includes(c.id));
        if(bc)log({'Better Cards: Replaced':_card.name(i),'with ':_card.name(bc.id),'for team Rank':idx});
        return bc?[bc.id,bc.level]:[i,l]
      })
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
    case 'Little League':       return c=>_card.mana(c)   <5
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
    if(better.length)return[c[0],better]
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
const basicCards=Object.fromEntries(_card.basic.map(c=>[c,1]));
const playableTeams = (battles,{mana_cap,ruleset,inactive,quest,oppCards={},myCards=basicCards,sortByWinRate}/*,fn='lastMatch'*/) => {
  //const score = res2Score[v]*(_card.basic.includes(c[0])?1:_card.rarity(c))/4;
  //ruleset matching could be improved
  //Object.assign(oppCards,basicCards);
  const res2Score = {w:1,d:-0.5,l:-1};
  let {attr_r, card_r} = ruleset.split('|').reduce((rules,cr)=>{
    _team.rules.secondary.includes(cr)?(rules.card_r=cr):rules.attr_r.push(cr);
    return rules},{attr_r:[]})
  attr_r[0]??='Standard'
  log('Filtering Teams for',{ruleset,card_r,attr_r})
  var filteredTeams=[],cardscores={},battlesList = battles;
  for(let path of attr_r)battlesList=battlesList[path];//This assumes object exists
  for(let mana of Object.keys(battlesList).filter(x=>x<=mana_cap&&Number(x)).sort((a,b)=>b-a)){
    res2Score.l = -mana_cap/mana;
    const scores = teamScores(battlesList[mana]//.filter(filterOutByMana(mana))//donno if it is doing expected
      ,{res2Score,mana_cap,inactive,cardscores,myCards,oppCards});
    log({[`#battles - ${mana}`]:battlesList[mana].length,'#Scores':scores.size,
      '#teams':filteredTeams.push(
        ...[...scores.entries()].filter(([t,s])=>
          t.length>2    && _team.isActive(t,inactive) &&
          s.count<2*s._w && _arr.chunk2(t).every(c=>myCards[c[0]]>=c[1])
          && filterTeamByRules(_arr.chunk2(t),card_r)
        ).sort(sortByProperty(sortByWinRate)).filter((_,i,{length})=>i<length/3)
        .map(([t,s])=>{return {team:_arr.chunk2(t),...s}})
      )})
    if(sortByWinRate||(filteredTeams.length>27))break;
  }
  var filteredTeams_length = filteredTeams.length;
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(3+filteredTeams.length/27)
  log('trimming', {filteredTeams_length},'to',filteredTeams.length)
  if(quest)priorByQuest(filteredTeams,quest);
  //writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  const mycards = Object.entries(myCards).filter(c=>!inactive.includes(_card.color(c))&&cardPassRules(card_r)(c))
    .map(c=>[Number(c[0]),c[1],Number(cardscores[c[0]]?.pos)])
    .sort(sortMyCards(cardscores))
  //writeFileSync('./data/bc.json',Object.fromEntries(Object.entries(betterCards(mycards,ruleset)).map(([k,v])=>[_card.name(k),v])))
  return filteredTeams.map(teamWithBetterCards(betterCards(mycards,ruleset),mycards,{mana_cap,sortByWinRate}));
}
module.exports = {teamScores,playableTeams,scoreXer};
