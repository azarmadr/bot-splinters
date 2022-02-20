//const {readFileSync,writeFileSync} = require('jsonfile');
const R = require('ramda')
const {log,_score,_team,_card,_func,_dbug} = require('./util');
function sortByProperty(sortByWinRate){
  return (...e)=>{
    const[a,b]    =e.map(x=>Array.isArray(x)?x[1]:x);
    return (sortByWinRate&&(b._w*a.count-a._w*b.count||b.w-a.w||b._w-a._w))||b.score-a.score;
  }
}

const dotP=(x,y)=>Object.keys(x).reduce((sc,k)=>sc+x[k]*y[k],0)
let defaultScores = {w:0,_w:0,l:0,_l:0,d:0,_d:0,count:0};

const teamScores = (nm,{/*cardscores={},*/oppCards,myCards,res2Score={w:1,l:-1.1,d:-0.5},xer={r:1.2,s:6},mana_cap,inactive,_scoreAll,card_r}={}) => {
  const scores = new Proxy({},{get:(t,n)=>t[n]??={...defaultScores}});
  const setScores = (s,t,p,xr=1)=>{
    let teams = [s,t].map(_team);
    if(!teams.some(x=>_team.isActive(inactive)(x)&&_score.filterTeamByRules(x,card_r)))return;
    const sm = teams.reduce((s,x)=>s+_score.filterTeamByRules(x,card_r)/4+_team.isActive(inactive)(x)/4,0);
    let [w,l] = teams.map((t,_x)=>(t.some((c,x)=>x%2?0:(c in oppCards))?_score.Xer(t,xer.r)/mana_cap:1)*
      (_team.mana(t)/mana_cap)**(_x?-1:1)*sm
    );
    teams.forEach((t,i)=>{if(_scoreAll||t.every(c=>c[0] in myCards)){
      scores[t].count+=p/2;
      scores[t][p==1?'d':i?'w':'l']+=p/2;
      scores[t][p==1?'_d':i?'_w':'_l']+=xr*(i?w:l)*p/2;
      /*if(p==2&&i)t.forEach(([c],i,{length})=>
        ((cardscores[c]??={})[i>length/2?i-length:i]??=0,cardscores[c][i>length/2?i-length:i]+=xr*w))*/
    }})
  }
  const _tail = {l:0};
  do{
    _tail.k=[];
    //_dbug.tt.hrc = {level:_tail.l,nodes:Object.keys(nm).length};
    let inm = _score.nm2inm(nm);
    for(let s in nm)if(!inm.has(s)){
      _tail.k.push(s);
      const up = (scores[s]/Object.keys(nm[s]).length)||0;
      for(let[t,p] of Object.entries(nm[s]))
        setScores(s,t,p,up+(_tail.l+1)/(_tail.l+3));
      delete nm[s];
      delete scores[s];
    }
    _tail.l++;
  }while(_tail.k.length);
  //_dbug.tt.hrc.forEach((x,i,a)=>x['#DanglingNodes']=x.nodes-a[i+1]?.nodes);delete _dbug.tt.hrc;
  Object.keys(nm).forEach(s=>Object.entries(nm[s]).forEach(t=>setScores(s,...t)))
  return Object.entries(scores)
    .filter(([t,s])=>
      _team.isActive(inactive)(t)  && _team(t).every(c=>myCards[c[0]]>=c[1])    &&
      s.count<2*Math.max(s._w,s.w) && _score.filterTeamByRules(_team(t),card_r)
    )
    .map(([t,s])=>({team:_team(t),...s,score:_score.Xer(t,xer.s)*dotP(res2Score,s)/mana_cap**3}))
}
const pos=_func.cached((i,l)=>i>l/2?i-l:i);
const attrRules=_func.cached(attr_r=>{
  const ruleCombos=R.uniq([['Standard'],...R.splitEvery(1,attr_r),attr_r])
  return {
    path:mana=>ruleCombos.map(R.append(mana)),
    predicate:R.reverse(ruleCombos).map(R.when(R.equals(['Standard']),R.always([])))
  }
})
const mergeBattlesByPredicate=(battles,predicate)=>(nm,path,i)=>{
  let p=t=>predicate[i].map(_score.move2Std).every(f=>f(t));
  let b=R.path(path,battles)??{}
  let count = {c:0,pr:predicate[i].join(),path:path.join()}
  //log(predicate[i].map(_score.move2Std))
  //R.forEachObjIndexed(1,R.pickBy(predicate,b));
  for(let s in b)if(p(s))for(let t in b[s])if(p(t)){
    (nm[s]??={})[t] = b[s][t]
    count.c++
  }
  if(count.c)_dbug.tt.mbp = count
  return nm
}
const playableTeams = (battles,{mana_cap,ruleset,inactive,quest,oppCards={},myCards=_card.basicCards,sortByWinRate,wBetterCards}) => {
  const {attr_r,card_r}=_team.getRules(ruleset);
  if(ruleset.includes('Taking Sides'))inactive+='Gray';
  const res2Score = {w:1,d:-0.81,l:-1.27},xer = {r:1.27,s:5};
  //_dbug.table({RuleSet:{ruleset,card_r,attr_r}})
  var filteredTeams=[]/*,cardscores={}*/;
  const {path,predicate} = attrRules(attr_r);
  const nm=_func.cached(mana=>path(mana).reduce(mergeBattlesByPredicate(battles,predicate),{}));
  for(let mana of R.range(12,mana_cap+1).reverse())if(!R.isEmpty(nm(mana))){
    res2Score.l*=mana_cap/mana;res2Score.w*=mana/mana_cap;res2Score.d*=mana_cap/mana;
    xer.r*=mana/mana_cap;xer.s*=mana/mana_cap;
    teamScores(nm(mana)
      ,{res2Score,xer,mana_cap,inactive/*,cardscores*/,myCards,oppCards,card_r})
      .sort(sortByProperty(sortByWinRate)).filter((_,i,{length})=>i<length/3)
      .forEach(x=>filteredTeams.push(x))
    _dbug.tt.score = {'#Scores':filteredTeams.length,...res2Score,...xer}
    if(sortByWinRate||(filteredTeams.length>27))break;
  }delete _dbug.tt.score;delete _dbug.tt.mbp;
  const cardscores = filteredTeams.reduce((cs,{team,score})=>{
    team.forEach((x,i,{length})=>
      (cs[x]??={score:0},cs[x][pos(i,length)]??=0,cs[x].score+=score,cs[x][pos(i,length)]+=score));
    return cs;
  }
    ,{});
  var filteredTeams_length = filteredTeams.length;
  filteredTeams.sort(sortByProperty(sortByWinRate)).splice(3+filteredTeams_length/27)
  filteredTeams.forEach((_,i,arr)=>arr[i].rank=i);
  log('trimming', {filteredTeams_length},'to',filteredTeams.length)
  _score.teamStats(nm(mana_cap),filteredTeams);
  if(quest)_score.forQuest(filteredTeams,quest);
  //writeFile(`data/${player}_${fn}.json`, filteredTeams).catch(log);
  const mycards = Object.entries(myCards)
    .filter(c=>!inactive.includes(_card.color(c))&&_score.cardRules(card_r)(c))
    .map(c=>[Number(c[0]),c[1],cardscores[c[0]]])
  return filteredTeams.map(_score.wBetterCards(ruleset,mycards,mana_cap,{wBetterCards,sortByWinRate}));
}
module.exports = {teamScores,playableTeams};
