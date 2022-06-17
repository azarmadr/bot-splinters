const R = require('ramda');
const {_arr} = require('./array')
const sf = require("sync-fetch");
const {writeFileSync} = require('jsonfile');
const {log,_func,_dbug} = require('./dbug');
const __cards = function(url,ifNull){//immediately returning function
  try{
    return require(url)
  }catch(e){
    log(e);return ifNull
  }
}("../data/cards.json",[])


const updateCards=__cards=>{
  log('Getting new cards');
  const newCards = sf("https://api.splinterlands.io/cards/get_details",{
    headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
  writeFileSync('./data/cards.json',newCards);
  for(i in newCards)__cards[i] = newCards[i];
  return __cards;
}

const cardRules=_func.cached(rule=>c=>
  rule.includes('Lost Magic')   ?_card.magic(c)==0     :rule.includes('Up Close & Personal')?_card.attack(c)>0 :
  rule.includes('Broken Arrows')?_card.ranged(c)==0    :rule.includes('Keep Your Distance') ?_card.attack(c)==0:
  rule.includes('Little League')?_card.mana(c)<5       :rule.includes('Rise of the Commons')?_card.rarity(c)<3 :
  rule.includes('Even Stevens') ?_card.mana(c)%2==0    :rule.includes('Odd Ones Out')       ?_card.mana(c)%2   :
  rule.includes('Taking Sides') ?_card.color(c)!='Gray':rule.includes('Lost Legendaries')   ?_card.rarity(c)<4 :
  true)
const teamRules=rule=>team=>team.slice(1).every(cardRules(rule))&&(
  rule.match(/Little League|Lost Legendaries|Rise of the Commons/)?cardRules(rule)(team[0])
    : rule.includes('Taking Sides')                               ?team.reduce((a,c)=>c[0]==19?a-1:a,2)
    : true)
const getRules=ruleset=>{
  //const primary="Back to BasicsSilenced SummonersAim TrueSuper SneakWeak MagicUnprotectedTarget PracticeFog of WarArmored UpEqual OpportunityMelee Mayhem"; const any="Healed OutEarthquakeReverse SpeedClose RangeHeavy HittersEqualizerNoxious FumesStampedeExplosive WeaponryHoly ProtectionSpreading Fury";
  const secondary="Keep Your DistanceLost LegendariesTaking SidesRise of the CommonsUp Close & PersonalBroken ArrowsLittle LeagueLost MagicEven StevensOdd Ones Out"
  let {attr,card} = ruleset.split('|').reduce((rule,cr)=>{
    secondary.includes(cr)?(rule.card=cr):rule.attr.push(cr);
    return rule},{attr:[],card:''})
  attr[0]??='Standard';attr.sort();
  return Object.assign(new String(ruleset),{
    attr,card,byCard:cardRules(card),byTeam:teamRules(card)
  })
};
__cards.basic = __cards.filter(c=>c.editions.match(/7|4/)&&c.rarity<3).map(c=>c.id)
__cards.basicCards = Object.fromEntries(__cards.basic.map(c=>[c,1]))
const _card = new Proxy(__cards,{ get: (cards, c)=>{
  const attr = ['color','name','rarity','type','editions'];
  const stats = ['ranged','magic','attack','speed','armor','health'];
  return c in cards        ? cards[c]
    : Number.isInteger(+c) ? updateCards(__cards)[c]
    : attr.includes(c)     ? i=>_attr(c,i[0]??i)
    : stats.includes(c)    ? ([i,l]) => _stat(c,i,l)
    : c == 'mana'          ? i=>_mana(i[0]??i)
    : c == 'abilities'     ? ([i,l]) => _ablt(i)(l)
    : c == 'isMon'         ? i => _attr('type',i[0]??i) == 'Monster'
    : c == 'isSum'         ? i => _attr('type',i[0]??i) == 'Summoner'
    : null;
}})
var _ablt=_func.cached(i=>l=>_card[i-1].stats?.abilities?.slice(0,l)?.flat()||[])
var _mana=_func.cached(i => [_card[i-1].stats.mana].flat()[0]);
var _attr=_func.cached((c,i)=>_card[i-1][c])
var _stat=_func.cached((c,i,l)=>_card[i-1].stats[c]?.[l-1]??_card[i-1].stats[c])
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

module.exports = {_card,getRules, _team};
