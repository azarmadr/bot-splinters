const R = require('ramda');
const {log,_dbug,_func} = require('./dbug');
const {_card,getRules,_team} = require('./card');
const {_arr} = require('./array');
const _score = {};
const _defGetter=x=>new Proxy({},{get:(t,n)=>t.hasOwnProperty(n)?t[n]:x});

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
_score.eigenRank=(nm,{tolerance=6,max_iter=200}={})=>{
  const nodeScore = _defGetter(1);
  // power iterations
  for(let iter of Array(max_iter).keys()){
    const nxt = _defGetter(0);
    for(let s in nm)for(let t in nm[s])nxt[t]+=nm[s][t]*nodeScore[s];
    if(Object.values(nxt).every(x=>!x))break;
    _arr.normalizeMut(nxt);
    let diff = 0;
    for(let n in nxt)diff+=Math.abs(nxt[n]-nodeScore[n]);

    //_dbug.tt.iter = {iter,diff};
    if(diff*10**tolerance<1){log({'converged@':iter});break;}
    for(let n in nxt)nodeScore[n] = nxt[n];
  } //delete _dbug.tt.iter;

  return Object.entries(nodeScore).sort((a,b)=>b[1]-a[1])
    .map((x,i)=>({team:x[0],eigenValue:x[1],eigenRank:i}));
}

_score.forQuest=(teams,{type,value,color})=>{
  log({'Playing for Quest':value?{[value]:type}:type});
  var i =
    type == 'splinter'   ? teams.findIndex(t=>_card.color(t.team[0])===color):
    type == 'no_neutral' ? teams.findIndex(t=>t.team.every(c=>_card.color(c)!='Gray')):
    type == 'ability'    ? teams.findIndex(t=>t.team.some(c=>(_card.abilities(c)+'').includes(value))):
    null;
  if(i>0)teams.unshift(...teams.splice(i,1));
}
_score.bCopyBy=(o,battles,tPredicate=R.always(1),bPredicate=R.always(1),count={c:0,t:0})=>{
  for(let s in battles)if(tPredicate(s))for(let t in battles[s])if(count.t++,tPredicate(t)&&bPredicate(t,s))
    (count.c++,(o[s]??={})[t]=battles[s][t]);
  return o
}
_score.teamStats = (battles, teams,res2Score={w:3,d:1,l:0})=>{;
  const bs = Object.fromEntries(teams.map((x,i)=>[x.team,i]));
  const bOfTeams = _score.bCopyBy({},battles,R.has(R.__,bs))
  //{{_s
  Object.entries(bOfTeams)
    .flatMap(([s, v])=>Object.entries(v).flatMap(([t, r]) =>
      [s,t].map((x,i)=>({team:x,c_:r/2,[r==2?(i?'w_':'l_'):'d_']:r/2,}))
    ))
    .reduce((_,{team,...s}) => Object.entries(s).forEach(([k, v])=>
      teams[bs[team]][k]= (teams[bs[team]]?.[k] ?? 0) + v), null)
  //teams.forEach((x,i)=>teams[i].s_= res2Score.w*(x.w_??0) + res2Score.l*(x.l_??0) + res2Score.d*(x.d_??0))
  //}}_s
  _score.eigenRank(bOfTeams).forEach(({team:t,eigenRank:er,eigenValue:ev})=>(teams[bs[t]].er=er,teams[bs[t]].ev=ev))
}
_score.nm2inm=nm=>{
  const inm = new Set();
  for(let s in nm)for(let t of Object.keys(nm[s]))inm.add(t);
  return inm;
}
_score.cardAlias=ruleset=>c=>{ }
/* For Weak Magic the table should be as follows: t1 m 1100
 *                                                   a 1010
 *                                                t2 m 0x0x
 *                                                   a 00xx */
_score.move2Std=(rule='')=>t=>_team(t).every((c,i)=>
  rule.match(/Armored Up|Back to Basics|Target Practice|Aim True|Earthquake|Weak Magic|Close Range/)&&i<1?true:
  rule.match(/Melee Mayhem|Super Sneak|Equal Opportunity/)&&i<2?true:
  rule=='Melee Mayhem'     ?_card.attack(c)==0:
  rule=='Super Sneak'      ?(_card.attack(c)==0||_card.abilities(c).join().match(/Sneak/)):
  rule=='Back to Basics'   ?_card.abilities(c).length==0:
  rule=='Target Practice'  ?!(_card.ranged(c)||_card.magic(c))||_card.abilities(c).join().match(/Snipe/):
  rule=='Equal Opportunity'?_card.abilities(c).join().match(/Opportunity|Snipe|Sneak/)||i<3&&_card.abilities(c).includes('Reach'):
  rule=='Aim True'         ?!_card.attack(c)&&!_card.ranged(c)||_card.abilities(c).includes('True Strike'):
  rule=='Earthquake'       ?_card.abilities(c).join().match(/Flying/):
  rule=='Weak Magic'       ?_card.magic(c)==0://||_card.armor(c)==0): complicated rule.
  rule=='Close Range'      ?_card.ranged(c)==0||_card.abilities(c).join().match(/Close Range/):
  rule=='Unprotected'      ?_card.armor(c)<=0:
  rule=='Fog of War'       ?!_card.abilities(c).join().match(/Snipe|Sneak/):
  rule=='Healed Out'       ?!_card.abilities(c).join().match(/Triage|Tank Heal|Heal/):
  rule=='Armored Up'       ?!_card.abilities(c).includes('Void Armor')&&(_card.magic(c)||!_card.attack(c)&&!_card.ranged(c)):
  false
)
const filterAbilities=(ruleset,c)=>ablt=>ruleset.split(',').every(rule =>
  rule=='Super Sneak'       ? !(_card.attack(c)&&ablt.match(/Sneak|Opportunity|Reach/)):
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
const c2v=_func.cached((a,b)=>(b-a)**2*(a<b)); //comparison2value
_score.statCmp=_func.cached((c,ruleset,sStats=null)=>oc=>{
  // sStats - abilities should also be filtered
  // some times attack and ranged or ..., will be similar, then sStats should play a hand
  const stats = ['speed','ranged','magic','attack','armor','health'].filter(s=>
    ruleset.includes('Reverse Speed')?s!='speed':
    ruleset.includes('Unprotected')  ?s!='armor':
    ruleset.includes('Equalizer')    ?s!='health':true)
  const abilities = [c,oc].map(x=>_card.abilities(x).filter(filterAbilities(ruleset,x)));
  const speed = ruleset.includes('Reverse Speed')?c2v(_card.speed(oc),_card.speed(c)):0;

  return ['speed',...stats].every(t=>_card[t](c)==_card[t](oc)) && _arr.eqSet(...abilities)
    ? c2v(_card.mana(oc),_card.mana(c))
    : (stats.every(t=>_card[t](c)<=_card[t](oc)) && _arr.subSet(...abilities) && (!ruleset.includes('Reverse Speed')||_card.speed(oc)<=_card.speed(c)))
      *(stats.reduce((s,t)=>s+c2v(_card[t](c),_card[t](oc)),0) + _arr.strictSubSet(...abilities) + speed)
})
const teamColorPass =_func.cached(t=>c=>('Gray'+_team.color(t)).includes(_card.color(c)));
const cardPosScore = mycards=>(c,pos)=>c==null?-1:
  mycards.find(x=>x[0]==(Array.isArray(c)?c[0]:c))?.[2]?.[pos]??0;
_score.betterTeam=B=>t=>{
  const cps = cardPosScore(B.mycards)
  const filteredCards =nt=>tc=>B.mycards.filter(c=>
    _card.isMon(c) && teamColorPass(nt)(c) &&
    _team(nt).every(x=>x[0]!=c[0]) &&
    _card.mana(c)<=B.mana-_team.mana(nt)+(tc?_card.mana(tc):0)
  );
  const nTeam = t.reduce((nt,tc,i)=>{if(i){
    nt[i] = filteredCards(nt)(tc).reduce((bc,c)=>
      _score.statCmp(bc,B.rules)(c)/*&&cps(bc,pos)<cps(c,pos)*/?c:bc,tc
    ).slice(0,2);
  }
    return nt;
  },[...t])
  if(nTeam.length<7&&B.mana>_team.mana(nTeam)){
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
      const smnrClrs = _card.color(team[0]);//+(team.slice(1).some(c=>_card.color(c)=='Gold')||_team.colorSec(team)).replace(/Gray/,'RedWhiteBlueBlackGreen');
      const bs=B.mycards.filter(c=>_card.type(c)=='Summoner'&&smnrClrs.includes(_card.color(c)))
        .reduce((r,c)=>_card.mana(team[0])>_card.mana(c)?c:r,team[0])
      if(!R.equals(bs,team[0])){
        log(bs,team[0],(!_arr.eq(bs,team[0])))
        log({[`-${_card.name(team[0])}`]:'+'+_card.name(bs),'Smnr@Team':idx});
        team[0]=bs;
      }
    }
    //team = betterTeam(team);
  //}
  return {team:betterTeam(team),...stats}
}
const pathsNpredicates=_func.cached(attr_r=>{
  const ruleCombos=R.uniq([['Standard'],...R.splitEvery(1,attr_r),attr_r])
  return {
    paths:mana=>ruleCombos.map(R.append(mana)),
    predicate:R.reverse(ruleCombos).map(R.when(R.equals(['Standard']),R.always([]))).map(rules=>
      t=>rules.map(R.construct(String)).map(_score.move2Std).every(f=>f(t)))
  }
})
let battlesList = require('../data/battle_data.json');
const B=function(battle){
  let mana = battle.mana_cap,
    myCards = {},
    oppCards = {},
    rules= getRules(battle.ruleset),
    inactive= battle.inactive + (battle.ruleset.includes('Taking Sides') ? 'Gray' : ''),
    opp= battle.opponent_player,
    sortByWinRate=0;
  const isPlayable=who=>{
    const cards = who?myCards:R.mergeWith(R.max,myCards,oppCards)
    return x=>{
      const team = _team(x);
      return _team.mana(team)<=mana&&
        team.every(([i,l])=>cards[i]>=(l==1?0:l))&&
        _team.isActive(inactive)(team)&&
        rules.byTeam(team)
    }
  }
  return {
    get myCards(){return myCards},set myCards(_){myCards=_},
    get oppCards(){return oppCards},set oppCards(_){oppCards=_},
    get sortByWinRate(){return sortByWinRate},set sortByWinRate(_){sortByWinRate=_},
    mana,rules,inactive,opp,battlesList,isPlayable,
    nodeMatrix(minBattles=1729/* ?disputable*/){
      const {paths,predicate}=pathsNpredicates(rules.attr);
      let nmSize = _defGetter(0);
      const nm = R.sortBy(x=>((a,b)=>x>mana?x/a-mana/a:mana/b-x/b)(2,1),R.range(12,100))
        .map(paths).reduce((nm,paths,_,arr)=>{
          if(rules.card?.includes('Little League')&&paths[0].at(-1)>28) return nm
          paths.reduce((nm,path,i)=>_score.bCopyBy(
            nm, R.pathOr({},path,battlesList), predicate[i], (...t)=>t.some(isPlayable(0))?nmSize[path]++:t.some(isPlayable(1))
          ),nm)
          if(R.reduce(R.add,0,R.values(nmSize))>(sortByWinRate?1:minBattles))arr.length=0;
          return nm;
        },{})
      _dbug.table(nmSize);
      return nm
    },
    unStarters(t){
      let team = _team(t)
      return team.reduce((count,[id])=>count+(myCards[id]>0),0)/team.length
    },
  }
}
module.exports = {_score,B}
