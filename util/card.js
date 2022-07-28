const R = require('ramda');
const {_arr} = require('./array')
const sf = require("sync-fetch");
const {writeFileSync} = require('jsonfile');
const {log,_func} = require('./dbug');
const __cards = function(){//immediately returning function
  try{
    return require("../data/cards.json")
  }catch(e){
    //log(e)
    require('fs').mkdir(require('path').join(__dirname,'../data'),e=>{
      if(e)throw e;
      console.log('Created `data` directory')
    });
    const newCards = sf("https://api.splinterlands.io/cards/get_details",{
      headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
    writeFileSync('./data/cards.json',newCards);
    return newCards
  }
}()


const updateCards=__cards=>{
  log('Getting new cards');
  const newCards = sf("https://api.splinterlands.io/cards/get_details",{
    headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
  writeFileSync('./data/cards.json',newCards);
  for(i in newCards)__cards[i] = newCards[i];
  return __cards;
}

// TODO use battle instead of team
/* For Weak Magic the table should be as follows: t1 m 1100
 *                                                   a 1010
 *                                                t2 m 0x0x
 *                                                   a 00xx */
const move2Std=(rule='')=>t=>_team(t).every((c,i)=>
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
const pathsNpredicates=_func.cached(attr_r=>{
  const ruleCombos=R.uniq([['Standard'],...R.splitEvery(1,attr_r),attr_r])
  return {
    paths:mana=>ruleCombos.map(R.append(mana)),
    predicate:R.reverse(ruleCombos).map(R.when(R.equals(['Standard']),R.always([]))).map(rules=>
      t=>rules.map(R.construct(String)).map(move2Std).every(f=>f(t)))
  }
})
const cardRules=_func.cached(rule=>
  rule.includes('Lost Magic')   ?c=>_card.magic(c)==0     :rule.includes('Up Close & Personal')?c=>_card.attack(c)>0 :
  rule.includes('Broken Arrows')?c=>_card.ranged(c)==0    :rule.includes('Keep Your Distance') ?c=>_card.attack(c)==0:
  rule.includes('Little League')?c=>_card.mana(c)<5       :rule.includes('Rise of the Commons')?c=>_card.rarity(c)<3 :
  rule.includes('Even Stevens') ?c=>_card.mana(c)%2==0    :rule.includes('Odd Ones Out')       ?c=>_card.mana(c)%2   :
  rule.includes('Taking Sides') ?c=>_card.color(c)!='Gray':rule.includes('Lost Legendaries')   ?c=>_card.rarity(c)<4 :
  R.T)
const teamRules=rule=>
  rule.match(/Little League|Lost Legendaries|Rise of the Commons/)?team=>team.every(cardRules(rule))
    : rule.includes('Taking Sides')                               ?team=>team.slice(1).every(cardRules(rule))&&team.reduce((a,c)=>c[0]==19?a-1:a,2)
    : team=>team.slice(1).every(cardRules(rule))
const getRules=ruleset=>{
  //const primary="Back to BasicsSilenced SummonersAim TrueSuper SneakWeak MagicUnprotectedTarget PracticeFog of WarArmored UpEqual OpportunityMelee Mayhem"; const any="Healed OutEarthquakeReverse SpeedClose RangeHeavy HittersEqualizerNoxious FumesStampedeExplosive WeaponryHoly ProtectionSpreading Fury";
  const secondary="Keep Your DistanceLost LegendariesTaking SidesRise of the CommonsUp Close & PersonalBroken ArrowsLittle LeagueLost MagicEven StevensOdd Ones Out"
  let {attr,card} = ruleset.split('|').reduce((rule,cr)=>{
    secondary.includes(cr)?(rule.card=cr):rule.attr.push(cr);
    return rule},{attr:[],card:''})
  attr[0]??='Standard';attr.sort();
  return Object.assign(new String(ruleset),{
    attr,card,byCard:cardRules(card),byTeam:teamRules(card),pathsNpredicates:pathsNpredicates(attr)
  })
};
__cards.basic = __cards.filter(c=>c.editions.match(/7|4/)&&c.rarity<3).map(c=>c.id)
__cards.basicCards = Object.fromEntries(__cards.basic.map(c=>[c,1]))
const attr = ['color','name','rarity','type','editions'];
const stats = ['ranged','magic','attack','speed','armor','health'];
const ___card = new Proxy(__cards,{ get: (cards, c)=>{
  return c in cards        ? cards[c]
    : Number.isInteger(+c) ? updateCards(__cards)[c]
    : null;
}})
var _ablt=_func.cached(i=>l=>___card[i-1].stats?.abilities?.slice(0,l)?.flat()||[])
var _mana=_func.cached(i => [___card[(i[0]??i)-1].stats.mana].flat()[0]);
var _attr=c=>_func.cached(i=>___card[(i[0]??i)-1][c])
var _stat=c=>_func.cached(([i,l])=>___card[i-1].stats[c]?.[Math.min(0,l-1)]??___card[i-1].stats[c])
const _card = {
  mana: _mana,
  abilities: ([i,l]) => _ablt(i)(l),
  isMon: i => _attr('type') (i[0]??i) == 'Monster',
  isSum: i => _attr('type') (i[0]??i) == 'Summoner',
  ...attr.reduce((o,a)=>({...o,[a]:_attr(a)}),{}),
  ...stats.reduce((o,s)=>({...o,[s]:_stat(s)}),{})
}
/* const cardBox = c => new Proxy(c,{get:(o,p)=>o[p]??=
 * p.includes('basic')         ? null        :
 * Number.isInteger(+c)        ? null        :
 * typeof _card[p]=='function' ? _card[p](c) :
 * null
 * })
 * */

/** Team helper functions in _team object */
const color2Deck={'Red':'Fire','Blue':'Water','White':'Life','Black':'Death','Green':'Earth'}
const _team = t => Array.isArray(t)?Array.isArray(t[0])?t
  :_arr.chunk2(t)
  :_arr.chunk2(t.split(',').map(Number));
Object.assign(_team,{
  mon:       t=>_team(t).slice(1),
  mana:      t=>_team(t).reduce((a,c)=>_card.mana(c)+a,0),
  colorPri:  t=> _card.color(_team(t)[0]),
  colorSec:  t=> _team(t).slice(1).map(_card.color).reduce((color,c)=>c in color2Deck?c:color,'Gray'),
  color:     t=> R.uniq(_team(t).map(_card.color)).join(''),
  isActive:  inactive=> t=> _team(t).every(c=>!inactive.includes(_card.color(c))),
  playable:  cards=> t=> _team(t).every(c=>c[0] in cards || c[0] in _card.basicCards),
  splinter:  inactive=> t=> color2Deck[_team.colorSec(t)]?? Object.entries(color2Deck).find(c=>!inactive.includes(c[0]))[1],
})

module.exports = {_card,getRules,move2Std, _team};
