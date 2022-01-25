const {_arr} = require('./array')
const __cards = require("../data/cards.json");
const sf = require("sync-fetch");
const {writeFileSync} = require('jsonfile');
const {log} = require('./dbug');

/** Card helper functions in _card object */
/** small function to return id of the card if array or id is given
 * @param (Any) c if array of [id,level], or id
 * @returns id of the card */
const _c2id=c=>Array.isArray(c)?c[0]:c;
const _card = new Proxy(__cards,{ get: (cards, c)=>{
  const attr = ['color','name','rarity','type','editions'];
  const stats = ['ranged','magic','attack','speed','armor','health'];
  const i = c-1;

  if(i in cards)        return cards[i];
  else if(Number.isInteger(+i)){
    const newCards = sf("https://api.splinterlands.io/cards/get_details",{
      headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
    writeFileSync('./data/cards.json',newCards);
    for(c in newCards)__cards[c] = newCards[i];
    return __cards[i];
  }
  if(c in cards)        return cards[c];
  if(attr.includes(c))  return (i)=>_card[_c2id(i)][c];
  if(stats.includes(c)) return ([i,l])=>_card[i].stats[c]?.[l-1];
  if(c == 'mana')       return (i)=>[_card[_c2id(i)].stats.mana].flat()[0];
  if(c == 'abilities')  return ([i,l])=>_card[i].stats?.abilities?.slice(0,l)?.flat()||[];
  if(c == 'basic')      return cards.filter(c=>c.editions.match(/7|4/)&&c.rarity<3).map(c=>c.id);
  if(c == 'basicCards') return Object.fromEntries(cards.basic.map(c=>[c,1]));
}})

/** Team helper functions in _team object */
const color2Deck={'Red':'Fire','Blue':'Water','White':'Life','Black':'Death','Green':'Earth'}
const _team = {
  adpt: t=>Array.isArray(t)?Array.isArray(t[0])?t:_arr.chunk2(t):_arr.chunk2(t.split(',').map(Number)),
  mana: t=>_team.adpt(t).reduce((a,c)=>_card.mana(c)+a,0),
  colorPri: t=>_card.color(_team.adpt(t)[0]),
  colorSec: t=>_team.adpt(t).slice(1).reduce((color,c)=>
    _card.color(c)in color2Deck?_card.color(c):color,'Gray'),
  color: t=>[...new Set([_team.colorPri(t),_team.colorSec(t)])].join(),
  splinter: (team,inactive)=>color2Deck[_team.colorSec(team)]??
  Object.entries(color2Deck).find(c=>!inactive.includes(c[0]))[1],
  rules : {
    primary:"Back to BasicsSilenced SummonersAim TrueSuper SneakWeak MagicUnprotectedTarget PracticeFog of WarArmored UpEqual OpportunityMelee Mayhem",
    any:"Healed OutEarthquakeReverse SpeedClose RangeHeavy HittersEqualizerNoxious FumesStampedeExplosive WeaponryHoly ProtectionSpreading Fury",
    secondary:"Keep Your DistanceLost LegendariesTaking SidesRise of the CommonsUp Close & PersonalBroken ArrowsLittle LeagueLost MagicEven StevensOdd Ones Out"
  },
  isActive: (t,inactive)=> _team.adpt(t).every(c=>!inactive.includes(_card.color(c))),
};

module.exports = {_card, _team};
