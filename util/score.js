const R = require('ramda');
const {log,_dbug,_func} = require('./dbug');
const {_card,_team} = require('./card');
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
      for(let t in nm[s]) dlScore[t]+=(_tail.l+1)/(_tail.l+3)+up;
      delete dlScore[s];delete nm[s];
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
  const dlScore = _score.rmDanglingLinks(nm);
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

  for(let n in dlScore)nodeScore[n]+=dlScore[n];
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
_score.rare=(id,level)=>(+level==1&&_card.basic.includes(id))?0:((_card.rarity(id)/3+2/3)*level)
_score.Xer=(team,x=2)=>_team(team).reduce((s,[id,level])=>(x**_score.rare(id,level))*(_card.mana(id)||1)+s,0)
_score.bCopyBy=(o,battles,predicate=_=>true,predicate1=predicate,count={c:0,t:0})=>{
  for(let s in battles)if(predicate(s))for(let t in battles[s])if(count.t++,predicate1(t,s))
    (count.c++,(o[s]??={})[t]=battles[s][t]);
  return o
}
_score.teamStats = (battles, teams,{res2Score={w:3,d:1,l:0}}={})=>{;
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
_score.battle2nm=(battles,{oppCards={},inactive='',card_r}={})=>{
  const nm = {};
  for(let s in battles)for(let [t,r] of Object.entries(battles[s])){
    const p = r *
      (1+
        _team.isActive(inactive)(s)/4+_team.isActive(inactive)(t)/4+
        _score.filterTeamByRules(_team(s),card_r)/4+_score.filterTeamByRules(_team(t),card_r)/4+
        _team(s).some(c=>''+c[0] in oppCards)/4 +
        _team(s).every(c=>''+c[0] in oppCards || ''+c[0] in _card.basicCards)/6 +
        _team(t).some(c=>''+c[0] in oppCards)/4 +
        _team(t).every(c=>''+c[0] in oppCards || ''+c[0] in _card.basicCards)/6
      );
    if(!p)_dbug.tt.nm = {p,r,t,s};
    (nm[s]??={})[t]=p;
  }delete _dbug.tt.nm;
  return nm;
}
_score.nm2inm=nm=>{
  const inm = new Set();
  for(let s in nm)for(let t of Object.keys(nm[s]))inm.add(t);
  return inm;
}
_score.cardAlias=ruleset=>c=>{
}
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
_score.cardRules=(rule='')=>c=>
  rule.includes('Lost Magic')   ?_card.magic(c)==0     :rule.includes('Up Close & Personal')?_card.attack(c)>0 :
  rule.includes('Broken Arrows')?_card.ranged(c)==0    :rule.includes('Keep Your Distance') ?_card.attack(c)==0:
  rule.includes('Little League')?_card.mana(c)<5       :rule.includes('Rise of the Commons')?_card.rarity(c)<3 :
  rule.includes('Even Stevens') ?_card.mana(c)%2==0    :rule.includes('Odd Ones Out')       ?_card.mana(c)%2   :
  rule.includes('Taking Sides') ?_card.color(c)!='Gray':rule.includes('Lost Legendaries')   ?_card.rarity(c)<4 :
  true;
_score.filterTeamByRules=(team,rule='')=>team.slice(1).every(_score.cardRules(rule))&&(
  rule.match(/Little League|Lost Legendaries|Rise of the Commons/)?_score.cardRules(rule)(team[0])
    : rule.includes('Taking Sides')                                     ?team.reduce((a,c)=>c[0]==19?a-1:a,2)
    : true)
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
_score.betterTeam=(ruleset,mycards,mana_cap)=>t=>{
  const cps = cardPosScore(mycards)
  const filteredCards =nt=>tc=>mycards.filter(c=>
    _card.isMon(c)       && _team(nt).every(x=>x[0]!=c[0]) &&
    teamColorPass(nt)(c) && _score.cardRules(ruleset)(c)  &&
    _card.mana(c)<=mana_cap-_team.mana(nt)+(tc?_card.mana(tc):0)
  );
  const nTeam = t.reduce((nt,tc,i)=>{if(i){
    nt[i] = filteredCards(nt)(tc).reduce((bc,c)=>
      _score.statCmp(bc,ruleset)(c)/*&&cps(bc,pos)<cps(c,pos)*/?c:bc,tc
    ).slice(0,2);
  }
    return nt;
  },[...t])
  if(nTeam.length<7&&mana_cap>_team.mana(nTeam)){
    let c = filteredCards(nTeam)().reduce((bc,c)=>cps(bc,'score')<cps(c,'score')?c:bc,null)
    if(c)nTeam.push(c);
  }
  if(R.not(R.equals(nTeam,t)))return _score.betterTeam(ruleset,mycards,mana_cap)(nTeam);
  return nTeam;
}
_score.wBetterCards=(ruleset,mycards,mana_cap,{wBetterCards,sortByWinRate})=>({team,...stats},idx)=>{
  //if(!wBetterCards&&!sortByWinRate&&idx<3){
    betterTeam = _score.betterTeam(ruleset,mycards,mana_cap);
    if(ruleset.includes('Silenced Summoners')){
      const smnrClrs = _card.color(team[0]);//+(team.slice(1).some(c=>_card.color(c)=='Gold')||_team.colorSec(team)).replace(/Gray/,'RedWhiteBlueBlackGreen');
      const bs=mycards.filter(c=>_card.type(c)=='Summoner'&&smnrClrs.includes(_card.color(c)))
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
module.exports = {_score}
