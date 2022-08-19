const R = require('ramda')
const {log,_score,T,C,_arr,F,_dbug} = require('./util');
const dotP=(x,y)=>Object.keys(x).reduce((sc,k)=>sc+x[k]*y[k],0)
let defaultScores = {w:0,_w:0,l:0,_l:0,d:0,_d:0,count:0};
const pos=F.cached((i,l)=>i>l/2?i-l:i);
const setScores=(scores,B)=>{
  const nm = B.nodeMatrix();
  for(let s in nm)for(let t in nm[s]){
    let p = nm[s][t]
    let teams = [s,t].map(T)
    let [sMana,tMana] = teams.map(T.mana);
    let m = sMana/B.mana
      *teams.reduce((s,x)=>s+B.rules.byTeam(x)*T.isActive(B.inactive)(x),0)/2;
    teams.forEach((x,i)=>{if(B.isPlayable(0)(x)){
      scores[i?t:s].count+=p/4;
      scores[i?t:s][p==1?'d':i?'w':'l']+=p/4;
      scores[i?t:s][p==1?'_d':i?'_w':'_l']+=m*p/4*(i?1:sMana/tMana);
      scores[i?t:s].oppMark |= teams.some(B.isPlayable(1))
    }})
  }
  return nm
}
module.exports.playableTeams=B=>{
  const scores = new Proxy({},{get:(t,n)=>t[n]??={...defaultScores}});

  const nm = setScores(scores,B);
  //_score.eigenRank(nm).forEach(x=>{scores[x.team].ter=x.eigenRank;scores[x.team].tev=x.eigenValue})
  let teams = Object.entries(scores).map(([t,s])=>({
    team:T(t),...s,score:dotP({_w:1,_d:-0.54,_l:-1},s),adv:B.unStarters(t)
  }))
  _arr.normalizeMut(teams,'score',2)

  const cardscores = teams.reduce((cs,{team,score})=>team.reduce((cs,x,i,{length})=>
    (cs[x]??={score:0},cs[x][pos(i,length)]??=0,cs[x].score+=score,cs[x][pos(i,length)]+=score,cs)
  ,cs),{});
  var filteredTeams_length = teams.length;
  teams = R.pipe(
    R.filter (x=>x._w>0||x._d>0),
    R.sortWith(
      R.map (R.descend) ([
        ...(B.sortByWinRate?[x=>x.w/x.count]:[]),
        ...(practiceOn?[x=>x.score*(x.oppMark?1:2)]:[]),
        ...[
          ...(B.sortByWinRate?['w','_w']:[]),'score','adv'
        ].map(x=>R.prop(x))
      ])
    ),
    R.filter ((a=>({adv})=> R.has(adv,a)?a[adv]--:a[adv]=27+27*adv)({}))
  )(teams)
  _arr.normalizeMut(teams,'score',2)
  teams.forEach((x,i,arr)=>{
    arr[i].rank=i
    arr[i].aScore=Math.sqrt(x.score**2+x.adv**2)
    arr[i]['s/c']=x.score/x.count
  });
  _arr.normalizeMut(teams,'aScore',2)
  _arr.normalizeMut(teams,'s/c',2)
  log('trimming', {filteredTeams_length},'to',teams.length)
  if(!B.sortByWinRate){
    _score.teamStats(nm,teams);
    _arr.normalizeMut(teams,'ev',2)
  }
  B.mycards = Object.entries(B.myCards)
    .filter(c=>!B.inactive.includes(C.color(c))&&B.rules.byCard(c))
    .map(c=>[Number(c[0]),c[1],cardscores[c[0]]])

  var pt = teams
  if(B.sortByWinRate&&practiceOn){
    pt=pt.slice(0,27);
    pt.sort(_=>Math.random()*2-1)
  }
  _dbug.table(pt.slice(0,5).map(({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})));
  if(!B.sortByWinRate){
    if(practiceOn){
      R.pipe (
        R.sortWith (R.map (R.descend) ([
          x=>x.adv*Math.sqrt(x.score**2+x.ev**2),
          x=>!x.oppMark,
        ])),
        (x=>pt=x),
        R.slice (0,5),
        R.map (({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})),
        _dbug.table
      ) (teams);
      // pt=pt.slice(0,9);
      // pt.sort(_=>Math.random()*2-1)
    } else{
      log({'sort by':'adv'})
      _dbug.table((pt=R.sortBy(x=>-x.adv,pt)).slice(0,5)
        .map(({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})));
      log({'sort by':'loss-win'})
      _dbug.table((pt=R.sortBy(x=>x._l-x._w,pt)).slice(0,5)
        .map(({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})));
      log({'sort by':'ev'})
      _dbug.table((pt=R.sortBy(b=>-b.ev,pt)).slice(0,5)
        .map(({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})));
      log({'sort by':'aScore+ev'})
      _dbug.table((pt=R.sortWith([
        x=>x.aScore**2+x.ev**2*1.27,x=>x.score,x=>x.ev
      ].map(fn=>R.descend(fn)),pt)).slice(0,5)
        .map(({team,...s})=>({team:team.map(c=>[C.name(c),c[1]]).join(),...s})));
    }
  }
  return pt.slice(0,27).map(_score.wBetterCards(B))
}
