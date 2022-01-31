const {log} = require('./dbug');
const {_card,_team} = require('./card');
const {_arr} = require('./array');
const _score = {};

/** Finds team satisfying quest rules, and places it at head of the teams array
 * @param {Array team} teams Better to have high scoring teams
 * @param {Object} $1 quest rules
 * @param {String} $1.type of the quest
 * @param {String} $1.value quest value to satisfy
 * @param {String} $1.color if the quest is splinter, provide color of the team
 */
_score.forQuest=(teams,{type,value,color})=>{
  var i;
  switch(type){
    case 'splinter':
      log({'Playing for Quest':{[value]:type}});
      i=teams.findIndex(t=>_card.color(t.team[0])===color);
      break;
    case 'no_neutral':
      log({'Playing for Quest':type});
      i = teams.findIndex(t=>t.team.slice(1).every(c=>_card.color(c)!='Gray'))
      break;
    case 'ability':
      log({'Playing for Quest':{[value]:type}});
      i=teams.findIndex(t=>t.team.some(c=>(_card.abilities(c)+'').includes(value)))
      break;
    default: i = null;
  }
  if(i>0)teams.unshift(...teams.splice(i,1));
}
_score.rare=(id,level,x=6)=>(+level==1&&_card.basic.includes(id))?1:(x**Math.min(2,_card.rarity(id))*level)
_score.Xer=(team,x=6)=>
  _team.adpt(team).reduce((s,[id,level])=>_score.rare(id,level,x)*(_card.mana(id)||1)+s,0)
_score.add2map=(m,k,v,p)=>(m[k]??={})[v]=p;
_score.battle2nm=(b,{inactive='',card_r}={})=>{
  const nm = {};
  for(let s in b)for(let [t,r] of Object.entries(b[s])){
    const p = (r=='d'?1:2)*
      (1+
        (_team.isActive(s,inactive)&&1/4)+(_team.isActive(t,inactive)&&1/4)+
        (_score.filterTeamByRules(s,card_r)&&1/4)+(_score.filterTeamByRules(t,card_r)&&1/4)
      );
    if(r=='l'||r=='d')_score.add2map(nm,t,s,p)
    if(r=='w'||r=='d')_score.add2map(nm,s,t,p)
  }
  return nm;
}
_score.nm2inm=nm=>{
  const inm = new Set();
  for(let s in nm)for(let t of Object.keys(nm[s]))inm.add(t);
  return inm;
}
_score.xtrctRules=ruleset=>{
  let {attr_r, card_r} = ruleset.split('|').reduce((rules,cr)=>{
    _team.rules.secondary.includes(cr)?(rules.card_r=cr):rules.attr_r.push(cr);
    return rules},{attr_r:[]})
  attr_r[0]??='Standard';attr_r.sort();
  return {attr_r,card_r}
}
const co=t=>'Gray'+_team.color(t).replace(/dGray/,'dRedWhiteBlueBlackGreen')
_score.wBetterCards=(betterCards,mycards,{mana_cap,wBetterCards,ruleset,sortByWinRate})=>({team,...stats},idx)=>{
  if(!wBetterCards&&!sortByWinRate&&idx<3){
    const bc=c=>{
      const  bc = betterCards[c[0]]?.find(x=>co(team).includes(x.color)&&!team.some(y=>y[0]==x.id));
      return bc?(log({[`-${_card.name(c)}`]:'+'+_card.name(bc.id),'@Team':idx})??[bc.id,bc.level]):c
    }
    const fillTeamGap=t=>{
      const gap = mana_cap-_team.mana(t);
      var card = mycards.find(c=>
        co(t).includes(_card.color(c))&&_card.mana(c)<=gap&&
        _card.type(c) === 'Monster' &&
        t.every(uc=>c[0]!=uc[0])&&t.length<7);
      if(card){
        card = bc(card);
        const pos = card[2]<0?Math.max(-Math.floor((t.length-1)/2),card[2]):1+Math.min(Math.floor((t.length-1)/2),card[2])
        log({'+card':_card.name(card),'@':pos,'#Team':idx})
        t.splice(/*pos??*/t.length,0,card);
        fillTeamGap(t);
      }
    }
    if(ruleset.includes('Silenced Summoners')){
      const smnrClrs = _card.color(team[0]);//+(team.slice(1).some(c=>_card.color(c)=='Gold')||_team.colorSec(team)).replace(/Gray/,'RedWhiteBlueBlackGreen');
      const bs=mycards.filter(c=>_card.type(c)=='Summoner'&&smnrClrs.includes(_card.color(c)))
        .reduce((r,c)=>_card.mana(team[0])>_card.mana(c)?c:r,team[0])
      if(!_arr.eq(bs,team[0])){
        log(bs,team[0],(!_arr.eq(bs,team[0])))
        log({[`-${_card.name(team[0])}`]:'+'+_card.name(bs),'Smnr@Team':idx});
        team[0]=bs;
      }
    }
    for(x in team) team[x]=bc(team[x]);
    fillTeamGap(team);
  }
  return {team,...stats}
}
_score.cardRules=rule=>c=>{
  switch(rule){
    case'Lost Magic':return    _card.magic(c)==0;case'Up Close & Personal':return   _card.attack(c)>0
    case'Broken Arrows':return _card.ranged(c)==0;case'Keep Your Distance':return   _card.attack(c)==0
    case'Little League':return _card.mana(c)<5;case'Rise of the Commons':return     _card.rarity(c)<3
    case'Even Stevens':return  _card.mana(c)%2==0;case'Odd Ones Out':return         _card.mana(c)%2
    case'Taking Sides':return  _card.color(c)!='Gray';case'Lost Legendaries':return _card.rarity(c)<4
    default:return true;
  }
}
_score.filterTeamByRules=(team,card_r)=>{
  if('Little League,Lost Legendaries,Rise of the Commons'.includes(card_r))
    return team.every(_score.cardRules(card_r));
  else if('Taking Sides'===card_r)
    return (team.reduce((a,c)=>c[0]==19?a+1:a,0)<2)&&team.slice(1).every(_score.cardRules(card_r));
  else if(_team.rules.secondary.includes(card_r))
    return team.slice(1).every(_score.cardRules(card_r));
  else return true
}
const filterAbilities=(ruleset,c)=>ablt=>{for(rule of ruleset.split(','))switch(rule){
  case'Super Sneak':return!(_card.attack(c)&&ablt.match(/Sneak|Opportunity|Reach/))
  case'Back to Basics':return false
  case'Fog of War':return!ablt.match(       /Sneak|Snipe/)
  case'Equal Opportunity':return!ablt.match(/Snipe|Sneak|Opportunity|Reach/)//Should i add Sneak and Snipe too?
  case'Target Practice':return!ablt.match(  /Snipe/)
  case'Melee Mayhem':return!ablt.match(     /Reach/)
  case'Aim True':return!ablt.match(         /Flying|Dodge/)
  case'Unprotected':return!ablt.match(      /Protect|Repair|Rust|Shatter|Void Armor|Piercing/)
  case'Healed Out':return!ablt.match(       /Triage|Affliction|Heal/)
  case'Heavy Hitters':return!ablt.match(    /Knock Out/)
  case'Equalizer':return!ablt.match(        /Strengthen|Weaken/)
  case'Holy Protection':return!ablt.match(  /Divine Shield/)
  case'Spreading Fury':return!ablt.match(   /Enrage/)
}return true}
_score.bCards =(myCards,rule)=> Object.fromEntries(
  myCards.filter(c=>_card.type(c)=='Monster').map((c,_,mycards)=>{
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
        && upStats  .every(t=>_card[t](c)<=_card[t](oc))
        && downStats.every(t=>_card[t](c)>=_card[t](oc))
        && _arr.eqSet(...[c,oc].map(x=>_card.abilities(x).filter(filterAbilities(rule,x))));
    const better = mycards.filter(oc=>
      c[0]!=oc.id&&allowedColors.includes(_card.color(oc))&&statCmp(oc)
    ).map(oc=>({color:_card.color(oc),id:oc[0],level:oc[1],name:_card.name(oc)}))
    if(better.length)return[c[0],better]
  }).filter(x=>x)
)
module.exports = {_score}
