const AKMap = require('array-keyed-map');
//const {readFileSync,writeFileSync} = require('jsonfile');
const {log,_score,_team,_card,_arr,_dbug} = require('./util');
/** Sorts by score or win rate
 * @param {Boolean} byWinRate if yes, then sorts by win rate, else by score
 */
function sortByProperty(sortByWinRate){
  return (...e)=>{
    const[a,b]    =e.map(x=>Array.isArray(x)?x[1]:x);
    return (sortByWinRate&&(b._w*a.count-a._w*b.count||b.w-a.w||b._w-a._w))||b.score-a.score;
  }
}
/* Filter battles with losing team less than 90% of the mana_cap. Winning against such team is not difficult
 * @param {Boolean} byMana if yes, filter out by mana, else keep them
function filterOutByMana(byMana=99){
  return battle => {
    if(byMana == 99) return true;
    const losing_team = battle.slice(0,battle.findIndex(a=>a=='d'||a=='w'))
    if(losing_team) return _team.mana(losing_team) > byMana*.81
    else return true
  }
}
 */

const dotP=(x,y)=>Object.keys(x).reduce((sc,k)=>sc+x[k]*y[k],0)
let defaultScores = {w:0,_w:0,l:0,_l:0,d:0,_d:0,count:0};

const teamScores = (nm,{cardscores={},oppCards,myCards,res2Score={w:1,l:-1.1,d:-0.5},xer={r:1.2,s:6},mana_cap,inactive,_scoreAll,card_r}={}) => {
  const scores = new AKMap();
  const setScores = (t,t1,p,xr=1)=>{
    let teams = [t,t1].map(x=>x.split(',').map(Number));
    const sm = teams.reduce((s,x)=>s+_score.filterTeamByRules(x,card_r)/4+_team.isActive(x,inactive)/4,0);
    if(!sm)return;
    let [w,l] = teams.map((t,_x)=>(t.some((c,x)=>x%2?0:(c in oppCards))?_score.Xer(t,xer.r)/mana_cap:1)*
      (_team.mana(t)/mana_cap)**(_x?-1:1)*sm
    );
    teams.forEach((t,i)=>{if(_scoreAll||t.every((c,x)=>x%2?1:c in myCards)){
      const cardScrs  = [scores.has(t)?scores.get(t):{...defaultScores},
        ..._arr.chunk2(t.slice(2)).map(([c],x,{length})=>
          (cardscores[c]??={p:{}}).p[x<length/2?x:x-length]??={...defaultScores})]
      cardScrs.forEach(cs=>{cs.count++;
        if(p==1){cs._d+=1/2;cs.d+=xr*(i?w:l)/2;}
        else{cs[i?'_w':'_l']++;cs[i?'w':'l']+=xr*(i?w:l);}
      });
      scores.set(t,cardScrs[0]);
    }})
  }
  const _tail = {l:0};
  do{
    _tail.k=[];
    _dbug.tt.hrc = {level:_tail.l,nodes:Object.keys(nm).length};
    let inm = _score.nm2inm(nm);
    for(let t in nm)if(!inm.has(t)){
      _tail.k.push(t);
      for(let[t1,p] of Object.entries(nm[t]))setScores(t,t1,p,(_tail.l+1)/(_tail.l+3));
      delete nm[t];
      scores.delete(t.split(',').map(Number));
    }
    _tail.l++;
  }while(_tail.k.length);
  _dbug.tt.hrc.forEach((x,i,a)=>x['#DanglingNodes']=x.nodes-a[i+1]?.nodes);delete _dbug.tt.hrc;
  for(let t in nm)for(let[t1,p]of Object.entries(nm[t]))setScores(t,t1,p);
  /* for research
  const xerDist = {};
  scores.forEach((s,t)=>xerDist[_score.Xer(t)]=Math.max(xerDist[_score.Xer(t)]||0,s.count))
  try{var xer = readFileSync('./data/xer.json')}catch{xer={}}
  xer[mana_cap]=xerDist;writeFileSync('./data/xer.json',xer);
  // for research*/
  scores.forEach((s,t)=>s.score=_score.Xer(t,xer.s)*dotP(res2Score,s)/mana_cap**3);
  Object.entries(cardscores).forEach(([c,cs])=>{
    Object.values(cs.p).forEach(s=>s.score=_score.rare(c,myCards[c])*dotP(res2Score,s));
    cs.score=Object.values(cs.p).reduce((tt,s)=>tt+s.w,0)
    cs.pos = Object.entries(cs.p).reduce((p,[i,s])=>cs[p]?.w>s.w?p:i,'-1')
  })
  return scores
}

const sortMyCards=cardscores=>{
  return (...c)=>{
    const [as,bs] = c.map(x=>cardscores[x[0]]?.score);
    return bs-as
  }
}
const playableTeams = (battles,{mana_cap,ruleset,inactive,quest,oppCards={},myCards=_card.basicCards,sortByWinRate,wBetterCards}) => {
  //ruleset matching could be improved
  //Object.assign(oppCards,_card.basicCards);
  const {attr_r,card_r}=_score.xtrctRules(ruleset);
  const res2Score = {w:1,d:-0.81,l:-1.27},xer = {r:1.27,s:4};
  _dbug.table({RuleSet:{ruleset,card_r,attr_r}})
  var filteredTeams=[],cardscores={},battlesList = battles;
  for(let path of attr_r)battlesList=battlesList[path];//This assumes object exists
  for(let mana of Object.keys(battlesList).filter(x=>x<=mana_cap&&Number(x)).sort((a,b)=>b-a)){
    res2Score.l*=mana_cap/mana;res2Score.w*=mana/mana_cap;res2Score.d*=mana_cap/mana;
    xer.r*=mana/mana_cap;xer.s*=mana/mana_cap;
    const scores = teamScores(_score.battle2nm(battlesList[mana])
      ,{res2Score,xer,mana_cap,inactive,cardscores,myCards,oppCards});
    _dbug.tt.score = {'#Scores':scores.size,
      '#teams':filteredTeams.push(
        ...[...scores.entries()].filter(([t,s])=>
          t.length>2    && _team.isActive(t,inactive) &&
          (s.count<2*s._w || s.count<2*s.w) && _arr.chunk2(t).every(c=>myCards[c[0]]>=c[1])
          && _score.filterTeamByRules(_arr.chunk2(t),card_r)
        ).sort(sortByProperty(sortByWinRate)).filter((_,i,{length})=>i<length/3)
        .map(([t,s])=>({team:_arr.chunk2(t),...s}))
      ),...res2Score,...xer}
    if(sortByWinRate||(filteredTeams.length>27))break;
  }delete _dbug.tt.score;
  var filteredTeams_length = filteredTeams.length;
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(3+filteredTeams_length/27)
  filteredTeams.forEach((_,i,arr)=>arr[i].rank=i);
  log('trimming', {filteredTeams_length},'to',filteredTeams.length)
  if(quest)_score.forQuest(filteredTeams,quest);
  //writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  const mycards = Object.entries(myCards).filter(c=>!inactive.includes(_card.color(c))&&_score.cardRules(card_r)(c))
    .map(c=>[Number(c[0]),c[1],Number(cardscores[c[0]]?.pos)])
    .sort(sortMyCards(cardscores))
  return filteredTeams.map(_score.wBetterCards(_score.bCards(mycards,ruleset),mycards,{wBetterCards,mana_cap,sortByWinRate,ruleset}));
}
module.exports = {teamScores,playableTeams};
