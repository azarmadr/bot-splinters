const R = require('ramda');
const {log,_dbug,F} = require('./dbug');
const {C,T} = require('./card');
const {_arr} = require('./array');
const _score = {};
const _defGetter=x=>new Proxy({},{get:(o,n)=>o[n]??=x});

_score.rmDanglingLinks=nm=>{
  const _tail = {l:0}, dlScore = _defGetter(0);
  do{
    _tail.k=[];
    let inm = _score.nm2inm(nm);
    //_dbug.tt.hrc = {level:_tail.l,nodes:Object.keys(nm).length,iNodes:inm.size};
    for(let s in nm)if(!inm.has(s)){
      _tail.k.push(s);
      const up = (dlScore[s]/Object.keys(nm[s]).length)||0;
      for(let t in nm[s]) dlScore[t]+=(_tail.l+1)/(_tail.l+3)+up; delete dlScore[s];delete nm[s];
    }
    _tail.l++;
  }while(_tail.k.length);
  //_dbug.tt.hrc.forEach((x,i,a)=>{
  //  x['#SinkNodes']       = x.iNodes-a[i+1]?.iNodes;
  //  x['#DanglingNodes']   = x.nodes-a[i+1]?.nodes
  //});delete _dbug.tt.hrc;
  _arr.normalizeMut(dlScore,null,1);
  return dlScore;
}
_score.eigenRank=(nm,{tolerance=6,iters=200}={})=>{
  let nodeScore = _defGetter(1);
  // power iterations
  // TODO Oscillating values
  for(let iter=0;iter<iters;iter++){
    const nxt = _defGetter(0);
    for(let s in nm)if(nodeScore[s])for(let t in nm[s])nxt[t]+=nm[s][t]*nodeScore[s];
    //if(Object.values(nxt).every(x=>!x))break;
    _arr.normalizeMut(nxt);
    let diff = 0;
    for(let n in nxt)diff+=Math.abs(nxt[n]-nodeScore[n]);

    //_dbug.tt.iter = {iter,diff};
    if(diff*10**tolerance<1){log({'converged@':iter});break;}
    for(let e in nodeScore)nodeScore[e]=nxt[e];
  } //delete _dbug.tt.iter;

  if(Object.keys(nodeScore)<9)log({nodeScore})
  _arr.normalizeMut(nodeScore,null,2)
  if(Object.keys(nodeScore)<9)log({nodeScore})
  return R.sortBy(x=>-x[1],Object.entries(nodeScore))
    .map(([t,e],i)=>({team:t,eigenValue:e,eigenRank:i}));
}

_score.forQuest=(teams,{type,value,color}={})=>{
  log({'Playing for Quest':value?{[value]:type}:type});
  var i =
    type == 'splinter'   ? teams.findIndex(t=>C.color(t.team[0])===color):
    type == 'no_neutral' ? teams.findIndex(t=>t.team.every(c=>C.color(c)!='Gray')):
    type == 'ability'    ? teams.findIndex(t=>t.team.some(c=>(C.abilities(c)+'').includes(value))):
    null;
  if(i>0&&i<3)teams.unshift(...teams.splice(i,1));
}
_score.bCopyBy=(o,battles,io=0,predicate=R.always(1),count)=>{
  for(let s in battles)if(predicate(s))for(let t in battles[s])if(count&&count.t++,predicate(t)&&predicate(t,s)){
    count&&count.c++
    if(io){
      ((o[s]??={})[t]??=[])[0]=battles[s][t]
      ((o[t]??={})[s]??=[])[1]=battles[s][t]
    }else (o[s]??={})[t]=battles[s][t]
  }
  return o
}
_score.teamStats = (battles, teams/* ,res2Score={w:3,d:1,l:0} */)=>{;
  const bs = Object.fromEntries(teams.map((x,i)=>[x.team,i]));
  const bOfTeams = _score.bCopyBy({},battles,0,R.has(R.__,bs))
  /*{{_s
  Object.entries(bOfTeams)
    .flatMap(([s, v])=>Object.entries(v).flatMap(([t, r]) =>
      [s,t].map((x,i)=>({team:x,c_:r/2,[r==2?(i?'w_':'l_'):'d_']:r/2,}))
    ))
    .reduce((_,{team,...s}) => Object.entries(s).forEach(([k, v])=>
      teams[bs[team]][k]= (teams[bs[team]]?.[k] ?? 0) + v), null)
  //teams.forEach((x,i)=>teams[i].s_= res2Score.w*(x.w_??0) + res2Score.l*(x.l_??0) + res2Score.d*(x.d_??0))
  //}}_s*/
  _score.eigenRank(bOfTeams).forEach(({team:t,eigenRank:er,eigenValue:ev})=>{
    teams[bs[t]].er=er;
    teams[bs[t]].ev=ev
  })
}
_score.nm2inm=nm=>{
  const inm = new Set();
  for(let s in nm)for(let t of Object.keys(nm[s]))inm.add(t);
  return inm;
}
// _score.cardAlias=ruleset=>c=>{ }
const filterAbilities=(ruleset,c)=>ablt=>ruleset.split(',').every(rule =>
  rule=='Super Sneak'       ? !(C.attack(c)&&ablt.match(/Sneak|Opportunity|Reach/)):
  rule=='Back to Basics'    ? false:
  rule=='Fog of War'        ? !ablt.match(/Sneak|Snipe/):
  rule=='Equal Opportunity' ? !ablt.match(/Opportunity|Reach/):
  rule=='Target Practice'   ? !ablt.match(/Snipe/)://Opportunity is also being over ridden here but only for ranged & magic
  rule=='Melee Mayhem'      ? !ablt.match(/Reach/):
  rule=='Aim True'          ? !ablt.match(/Flying|Dodge/):
  rule=='Unprotected'       ? !ablt.match(/Protect|Repair|Rust|Shatter|Void Armor|Piercing/):
  rule=='Healed Out'        ? !ablt.match(/Triage|Affliction|Heal/):
  rule=='Heavy Hitters'     ? !ablt.match(/Knock Out/):
  rule=='Holy Protection'   ? !ablt.match(/Divine Shield/): // unsure
  rule=='Spreading Fury'    ? !ablt.match(/Enrage/): true)
const c2v=F.cached((a,b)=>(b-a)**2*(a<b)); //comparison2value
_score.statCmp=F.cached((c,ruleset/* ,sStats=null */)=>oc=>{
  // sStats - abilities should also be filtered
  // some times attack and ranged or ..., will be similar, then sStats should play a hand
  const stats = ['speed','ranged','magic','attack','armor','health'].filter(s=>
    ruleset.includes('Reverse Speed')?s!='speed':
    ruleset.includes('Unprotected')  ?s!='armor':
    ruleset.includes('Equalizer')    ?s!='health':true)
  const abilities = [c,oc].map(x=>C.abilities(x).filter(filterAbilities(ruleset,x)));
  const speed = ruleset.includes('Reverse Speed')?c2v(C.speed(oc),C.speed(c)):0;

  return ['speed',...stats].every(t=>C[t](c)==C[t](oc)) && _arr.eqSet(...abilities)
    ? c2v(C.mana(oc),C.mana(c))
    : (stats.every(t=>C[t](c)<=C[t](oc)) && _arr.subSet(...abilities) && (!ruleset.includes('Reverse Speed')||C.speed(oc)<=C.speed(c)))
      *(stats.reduce((s,t)=>s+c2v(C[t](c),C[t](oc)),0) + _arr.strictSubSet(...abilities) + speed)
})
const teamColorPass =F.cached(t=>c=>('Gray'+T.colors(t)).includes(C.color(c)));
const cardPosScore = mycards=>(c,pos)=>c==null?-1:
  mycards.find(x=>x[0]==(Array.isArray(c)?c[0]:c))?.[2]?.[pos]??0;
_score.betterTeam=B=>t=>{
  const cps = cardPosScore(B.mycards)
  const filteredCards =nt=>tc=>B.mycards.filter(c=>
    C.isMon(c) && teamColorPass(nt)(c) &&
    T(nt).every(x=>x[0]!=c[0]) &&
    C.mana(c)<=B.mana-T.mana(nt)+(tc?C.mana(tc):0)
  );
  const nTeam = t.reduce((nt,tc,i)=>{if(i){
    nt[i] = filteredCards(nt)(tc).reduce((bc,c)=>
      _score.statCmp(bc,B.rules)(c)/*&&cps(bc,pos)<cps(c,pos)*/?c:bc,tc
    ).slice(0,2);
  }
    return nt;
  },[...t])
  if(nTeam.length<7&&B.mana>T.mana(nTeam)){
    let c = filteredCards(nTeam)().reduce((bc,c)=>cps(bc,'score')<cps(c,'score')?c:bc,null)
    if(c)nTeam.push(c);
  }
  if(R.not(R.equals(nTeam,t)))return _score.betterTeam(B)(nTeam);
  return nTeam;
}
_score.wBetterCards=B=>({team,...stats},idx)=>{
  //if(!wBetterCards&&!sortByWinRate&&idx<3){
    betterTeam = _score.betterTeam(B);
    if(B.rules.includes('Silenced Summoners')){
      const smnrClrs = C.color(team[0]);//+(team.slice(1).some(c=>C.color(c)=='Gold')||T.colorSec(team)).replace(/Gray/,'RedWhiteBlueBlackGreen');
      const bs=B.mycards.filter(c=>C.type(c)=='Summoner'&&smnrClrs.includes(C.color(c)))
        .reduce((r,c)=>C.mana(team[0])>C.mana(c)?c:r,team[0])
      if(!R.equals(bs,team[0])){
        log(bs,team[0],(!_arr.eq(bs,team[0])))
        log({[`-${C.name(team[0])}`]:'+'+C.name(bs),'Smnr@Team':idx});
        team[0]=bs;
      }
    }
    //team = betterTeam(team);
  //}
  return {team:betterTeam(team),...stats}
}
module.exports = {_score}
//let e = _score.eigenRank; e({a:{c:2},b:{c:2},c:{d:2,b:1}})
