const R = require('ramda');
const {_arr} = require('./array')
const sf = require("sync-fetch");
const {writeFileSync} = require('jsonfile');
const {log,_func} = require('./dbug');
const __cards = function(url,ifNull){//immediately returning function
  try{
    return require(url)
  }catch(e){
    log(e);return ifNull
  }
}("../data/cards.json",[])


const _c2id=_func.cached(c=>Array.isArray(c)?c[0]:c);
const updateCards=__cards=>{
  log('Getting new cards');
  const newCards = sf("https://api.splinterlands.io/cards/get_details",{
    headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
  writeFileSync('./data/cards.json',newCards);
  for(i in newCards)__cards[i] = newCards[i];
  return __cards;
}
const xtractRules = ruleset=>{
  //const primary="Back to BasicsSilenced SummonersAim TrueSuper SneakWeak MagicUnprotectedTarget PracticeFog of WarArmored UpEqual OpportunityMelee Mayhem"; const any="Healed OutEarthquakeReverse SpeedClose RangeHeavy HittersEqualizerNoxious FumesStampedeExplosive WeaponryHoly ProtectionSpreading Fury";
  const secondary="Keep Your DistanceLost LegendariesTaking SidesRise of the CommonsUp Close & PersonalBroken ArrowsLittle LeagueLost MagicEven StevensOdd Ones Out"
  let rule = ruleset.split('|').reduce((rule,cr)=>{
    secondary.includes(cr)?(rule.card_r=cr):rule.attr_r.push(cr);
    return rule},Object.assign(new String(ruleset),{attr_r:[]}))
  rule.attr_r[0]??='Standard';rule.attr_r.sort();
  return rule
};
const _card = new Proxy(__cards,{ get: (cards, c)=>{
  const attr = ['color','name','rarity','type','editions'];
  const stats = ['ranged','magic','attack','speed','armor','health'];
  return c in cards        ? cards[c]
    : Number.isInteger(+c) ? updateCards(__cards)[c]
    : attr.includes(c)     ? (i)     => _card[_c2id(i)-1][c]
    : stats.includes(c)    ? ([i,l]) => _card[i-1].stats[c]?.[l-1]??_card[i-1].stats[c]
    : c == 'mana'          ? (i)     => [_card[_c2id(i)-1].stats.mana].flat()[0]
    : c == 'abilities'     ? ([i,l]) => _card[i-1].stats?.abilities?.slice(0,l)?.flat()||[]
    : c == 'isMon'         ? (i) => _card[_c2id(i)-1].type == 'Monster'
    : c == 'isSum'         ? (i) => _card[_c2id(i)-1].type == 'Summoner'
    : c == 'basic'         ? cards.filter(c=>c.editions.match(/7|4/)&&c.rarity<3).map(c=>c.id)
    : c == 'basicCards'    ? Object.fromEntries(_card.basic.map(c=>[c,1]))
    : null;
}})
/* const cardBox = c => new Proxy(c,{get:(o,p)=>o[p]??=
 * p.includes('basic')         ? null        :
 * Number.isInteger(+c)        ? null        :
 * typeof _card[p]=='function' ? _card[p](c) :
 * null
 * })
 * */

/** Team helper functions in _team object */
const color2Deck={'Red':'Fire','Blue':'Water','White':'Life','Black':'Death','Green':'Earth'}
const _team = t => Array.isArray(t)?Array.isArray(t[0])?t:_arr.chunk2(t):_arr.chunk2(t.split(',').map(Number));
Object.assign(_team,{
  mon:       t=>_team(t).slice(1),
  mana:      t=>_team(t).reduce((a,c)=>_card.mana(c)+a,0),
  colorPri:  t=> _card.color(_team(t)[0]),
  colorSec:  t=> _team(t).slice(1).map(_card.color).reduce((color,c)=>c in color2Deck?c:color,'Gray'),
  color:     t=> R.uniq(_team(t).map(_card.color)).join(''),
  isActive:  inactive=> t=> _team(t).every(c=>!inactive.includes(_card.color(c))),
  playable:  cards=> t=> _team(t).every(c=>c[0] in cards || c[0] in _card.basicCards),
  splinter:  inactive=> t=> color2Deck[_team.colorSec(t)]?? Object.entries(color2Deck).find(c=>!inactive.includes(c[0]))[1],
  getRules:  xtractRules
})

module.exports = {_card, _team};
