const R = require('ramda')
const {log,_score,_team,_card,_arr,_func,_dbug} = require('./util');
function sortByProperty(sortByWinRate){
  return (...e)=>{
    const[a,b]    =e.map(x=>Array.isArray(x)?x[1]:x);
    return (sortByWinRate&&(b._w*a.count-a._w*b.count||b.w-a.w||b._w-a._w))||b.score-a.score;
  }
}
const dotP=(x,y)=>Object.keys(x).reduce((sc,k)=>sc+x[k]*y[k],0)
let defaultScores = {w:0,_w:0,l:0,_l:0,d:0,_d:0,count:0};
const pos=_func.cached((i,l)=>i>l/2?i-l:i);
const setScores=({scores,oppCards,myCards,xer={r:1.2,s:6},mana_cap,inactive,card_r})=>(s,t,p,xr=1)=>{
  let teams = [s,t].map(_team)
  const sm = teams.reduce((s,x)=>s+_score.filterTeamByRules(x,card_r)/4+_team.isActive(inactive)(x)/4,0);
  let [w,l] = teams.map((t,_x)=>(t.some((c,x)=>x%2?0:(c in oppCards))?_score.Xer(t,xer.r)/mana_cap:1)*
    (_team.mana(t)/mana_cap)**(_x?-1:1)*sm
  );
  teams.forEach((t,i)=>{if(t.every(c=>c[0] in myCards)){
    scores[t].count+=p/2;
    scores[t][p==1?'d':i?'w':'l']+=p/2;
    scores[t][p==1?'_d':i?'_w':'_l']+=xr*(i?w:l)*p/2;
  }})
}
const pathsNpredicates=_func.cached(attr_r=>{
  const ruleCombos=R.uniq([['Standard'],...R.splitEvery(1,attr_r),attr_r])
  return {
    paths:mana=>ruleCombos.map(R.append(mana)),
    predicate:R.reverse(ruleCombos).map(R.when(R.equals(['Standard']),R.always([]))).map(rules=>
      t=>rules.map(R.construct(String)).map(_score.move2Std).every(f=>f(t)))
  }
})
const countBattles=(nm,p=R.always(1))=>
  Object.keys(nm).reduce((c,s)=>c+Object.keys(nm[s]).filter(t=>[s,t].map(_team).some(p)).length,0)
const __bc={};
const playableTeams = (battles,{mana_cap,ruleset,inactive,quest,oppCards={},myCards=_card.basicCards,sortByWinRate,wBetterCards}) => {
  const minBattles = 729//?disputable
  if(ruleset.includes('Taking Sides'))inactive+='Gray';
  const xer={r:1.27,s:7};
  const {attr_r,card_r}=ruleset;
  const scores = new Proxy({},{get:(t,n)=>t[n]??={...defaultScores}});
  const isPlayable=(myCards=new Proxy({},{has:()=>2}))=>x=>_team.mana(x)<=mana_cap&&
    _team(x).every(c=>c[0]in myCards)&&_team.isActive(inactive)(x)&&_score.filterTeamByRules(_team(x),card_r)

  const {paths,predicate}=pathsNpredicates(attr_r);
  const nm = R.sortBy(x=>((a,b)=>x>mana_cap?x/a-mana_cap/a:mana_cap/b-x/b)(2,1),R.range(12,100))
    .map(paths).reduce((nm,paths,_,arr)=>{
      paths.map(R.pathOr({},R.__,battles)).reduce((nm,b,i)=>_score.bCopyBy(
        nm,b,predicate[i],(s,t)=>predicate[i](t)&&[s,t].some(isPlayable())),nm)
      const nmSize = __bc[mana_cap+paths+ruleset+inactive+JSON.stringify(myCards)]??=countBattles(nm,isPlayable(myCards));
      const origSize = paths.reduce((c,p)=>
        (c['origSize']+=(c[R.init(p)]=__bc[p]??=countBattles(R.path(p,battles)??{})),c),{origSize:0})
      _dbug.tt.score = {mana:paths[0].at(-1),nmSize,...origSize}
      if(sortByWinRate&&nmSize||nmSize>minBattles)arr.length=0;
      return nm;
    },{})
  _dbug.tt.score.forEach((x,i,a)=>(x.added=x.nmSize-(a[i-1]?.nmSize??0),x.added||x.origSize||delete a[i]));
  delete _dbug.tt.score;

  const dlScore = _score.rmDanglingLinks(nm)
  for(let t in dlScore)scores[t].w = dlScore[t];
  for(let s in nm)for(let t in nm[s])
    setScores({scores,oppCards,myCards,xer,mana_cap,inactive,card_r})(s,t,nm[s][t])
  const teams = Object.entries(scores).filter(([t,s])=>_team.mana(t)<=mana_cap &&
    _team.isActive(inactive)(t)  && _team(t).every(c=>myCards[c[0]]>=c[1])    &&
    s.count<2*Math.max(s._w,s.w) && _score.filterTeamByRules(_team(t),card_r)
  ).map(([t,s])=>({team:_team(t),...s,score:_score.Xer(t,xer.s)*dotP({w:1,d:-0.81,l:-1.27},s)/mana_cap**3}))

  const cardscores = teams.reduce((cs,{team,score})=>team.reduce((cs,x,i,{length})=>
    (cs[x]??={score:0},cs[x][pos(i,length)]??=0,cs[x].score+=score,cs[x][pos(i,length)]+=score,cs)
  ,cs),{});
  var filteredTeams_length = teams.length;
  teams.sort(sortByProperty(sortByWinRate)).splice(3+filteredTeams_length/27)
  _arr.normalizeMut(teams,'score')
  teams.forEach((x,i,arr)=>(arr[i].rank=i,arr[i]['s/c']=x.score/x.count));
  log('trimming', {filteredTeams_length},'to',teams.length)
  if(!sortByWinRate){
    _score.teamStats(nm,teams);
    //_arr.normalizeMut(teams,'s_')
    _arr.normalizeMut(teams,'ev')
    if(quest)_score.forQuest(teams,quest);
  }
  const mycards = Object.entries(myCards)
    .filter(c=>!inactive.includes(_card.color(c))&&_score.cardRules(card_r)(c))
    .map(c=>[Number(c[0]),c[1],cardscores[c[0]]])
  return teams.map(_score.wBetterCards(ruleset,mycards,mana_cap,{wBetterCards,sortByWinRate}));
}
module.exports = {playableTeams};
