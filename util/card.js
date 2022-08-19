const R = require('ramda');
const RA = require('ramda-adjunct');
const {_arr} = require('./array')
const sf = x=>require("sync-fetch")(String.raw(x),{headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
const {writeFileSync} = require('jsonfile');
const {ruleEnum} = require('./constants')
const {log,F} = require('./dbug');
const __cards = function(){//immediately returning function
  try{
    return require("../data/cards.json")
  }catch(e){
    //log(e)
    require('fs').mkdir(require('path').join(__dirname,'../data'),e=>{
      if(e)throw e;
      console.log('Created `data` directory')
    });
    const newCards = sf`https://api.splinterlands.io/cards/get_details`
    writeFileSync('./data/cards.json',newCards);
    return newCards
  }
}()
const SMsettings = function(){
  let settings = sf`https://api.splinterlands.io/settings`
  writeFileSync('./data/settings.json',settings)
  return settings
}()
const updateCards=__cards=>{
  log('Getting new cards');
  const newCards = sf("https://api.splinterlands.io/cards/get_details",{
    headers: { Accept: 'application/vnd.citationstyles.csl+json' }}).json();
  writeFileSync('./data/cards.json',newCards);
  for(i in newCards)__cards[i] = newCards[i];
  return __cards;
}

__cards.basic = __cards.filter(c=>c.editions.match(/7|4/)&&c.rarity<3).map(c=>c.id)
const attr = ['color','name','rarity','type','editions','tier'];
const stats = ['ranged','magic','attack','speed','armor','health'];
const ___card = new Proxy(__cards,{ get: (cards, c)=>{
  return c in cards        ? cards[c]
    : Number.isInteger(+c)&&c>=0 ? updateCards(__cards)[c]
    : null;
}})
var _ablt=F.cached(i=>l=>___card[i-1].stats?.abilities?.slice(0,Math.max(1,l))?.flat()||[])
var _mana=F.cached(i => [___card[(i[0]??i)-1].stats.mana].flat()[0]);
var _attr=c=>F.cached(i=>___card[(i[0]??i)-1][c])
var _stat=c=>F.cached(([i,l])=>___card[i-1].stats[c]?.[Math.max(0,l-1)]??___card[i-1].stats[c])
const C = {
  basicCards: Object.fromEntries(__cards.basic.map(c=>[c,0])),
  mana: _mana,
  abilities: ([i,l]) => _ablt(i)(l),
  hasAbility: regex=>([i,l])=>_ablt(i)(l).join().match(regex),
  isMon: i => _attr`type` (i) == 'Monster',
  isSum: i => _attr`type` (i) == 'Summoner',
  ...attr.reduce((o,a)=>({...o,[a]:_attr(a)}),{}),
  ...stats.reduce((o,s)=>({...o,[s]:_stat(s)}),{}),
  stats: ([i])=>{let {mana,...rem}=__cards[i-1]; return rem},
  isModern: F.cached ( R.anyPass ([
    x=>SMsettings.battles.modern.tiers.includes(C.tier(x)),
    x=>SMsettings.battles.modern.editions.includes(C.editions(x)),
  ])),
  get a(){return C.attack},
  get m(){return C.magic},
  get r(){return C.ranged},
  get has(){return C.hasAbility},
  attackType: c=>['a','m','r'].flatMap(x=>C[x](c)?[{a:'Melee',r:'Ranged',m:'Magic'}[x]]:[])+''
}

const nAtORyAb=(attack,ability)=>R.anyPass ([R.not,c=>!C[attack](c),C.has(ability)])
const Ru = {
  e:ruleEnum,
  pred:{
    'Standard': R.F,
    'Back to Basics':R.all (t=>R.all (R.pipe(C.abilities,R.equals([]))) (R.drop(1,t))),
    'Silenced Summoners': R.all (t=> R.anyPass ([R.not, R.isEmpty]) (R.values (R.head (t)))),
    'Aim True':R.all (t=>R.all (c=>!C.a(c)&&!C.r(c)||C.has(/True Strike/) (c)) (R.drop(1,t))),
    'Super Sneak':   R.all (t=>R.all (nAtORyAb('a',/Sneak/)) (R.drop(2,t))),
    'Weak Magic':R.pipe (
      R.map (R.juxt ([R.any (C.m), R.any (nAtORyAb('armor', /Void Armor/))])),
      R.modifyPath ([1]) (R.reverse),
      R.apply (R.zipWith (R.multiply)),
      R.equals ([0,0])
    ),
    'Unprotected': R.all (R.all (R.allPass ([c=>C.armor(c)<=0,C.has(/Protect/)]))),
    'Target Practice':R.all(t=>R.all (c=>!C.a(c)&&!C.r(c)||C.has(/True Strike/)(c)) (R.drop(1,t))),
    'Fog of War':R.all (R.none (C.has(/Snipe|Sneak/))),
    'Armored Up':R.all (R.all (c=>!C.has('Void Armor') (c)&&(C.m(c)||!C.a(c)&&!C.r(c)))),
    'Equal Opportunity':R.all(t=>(!t[2]||C.has(/Reach/)(t[2]))&&R.all(C.has(/Opportunity|Snipe|Sneak/)) (R.drop(3,t))),
    'Melee Mayhem':  R.all (t=>
      nAtORyAb('a',/Reach|Sneak|Opportunity/)(t[2])&&
      R.all (nAtORyAb('a',/Sneak|Opportunity/)) (R.drop(3,t))
    ),
    'Healed Out':R.all (R.none (C.has(/Triage|Tank Heal|Heal/))),
    'Earthquake': R.all (t=>R.any (R.all (C.has(/Flying/))) (R.splitAt(1,t))),
    'Reverse Speed':R.all (R.F), //TODO
    'Close Range':R.all (t=> R.all (nAtORyAb('r',/Close Range/)) (R.drop(1,t))),
    'Heavy Hitters':R.all (R.anyPass ([R.none (C.has(/Stun/)), t=>R.all (C.has(/Knock Out/)) (R.drop(1,t))])),
    'Equalizer': R.pipe ( R.map (R.tail), R.unnest, R.map (C.health), RA.allEqual),
    'Noxious Fumes': R.all (t=>R.all (C.has(/Immunity/)) (R.drop(1,t))),
    'Stampede':R.all (R.all (C.has(/Trample/))),
    'Explosive Weaponry': R.all (t=>R.any (R.all (C.has(/Blast/))) (R.splitAt(1,t))),
    'Holy Protection': R.all (t=>R.any (R.all (C.has(/Divine Shield/))) (R.splitAt(1,t))),
    'Spreading Fury':R.all (R.all (C.has(/Enrage/))),
  },
  num:teams=>R.sum (R.values (R.mapObjIndexed ((v,k)=>v?2**+ruleEnum[k]:0) (R.applySpec (Ru.pred) (teams)))),
  map:R.pipe (
    R.juxt ([R.always ([['Standard']]),R.splitEvery (1), R.of]),
    R.unnest, R.uniq,
    R.juxt ([R.map (R.join`,`),R.reverse]),
    R.apply (R.zip),  R.fromPairs,
    R.map (R.map (R.pipe (
      R.flip (R.prop) (ruleEnum),
      R.curry (Math.pow) (2)
    ))),
    R.map (R.sum)
  ),
  battleRule:rs=>teams=>getRules(rs).attr.filter(r=>!Ru.pred[r](teams)).join()||'Standard',
  cardPred:{
    'Lost Magic':   c=>C.isSum(c)||C.m(c)==0, 'Up Close & Personal':c=>C.isSum(c)||C.a(c)>0, 
    'Broken Arrows':c=>C.isSum(c)||(C.r(c)==0), 'Keep Your Distance': c=>C.isSum(c)||C.a(c)==0,
    'Rise of the Commons':c=>C.isSum(c)||C.rarity(c)<3, 'Even Stevens': c=>C.isSum(c)||C.mana(c)%2==0,
    'Odd Ones Out':       c=>C.isSum(c)||C.mana(c)%2,   'Lost Legendaries': c=>C.isSum(c)||C.rarity(c)<4,
    'Little League':c=>C.mana(c)<5, ['']: R.T
  }
}
const getRules=ruleset=>{
  //const primary="Back to Basics,Silenced Summoners,Aim True,Super Sneak,Weak Magic,Unprotected,Target Practice,Fog of War,Armored Up,Equal Opportunity,Melee Mayhem"; const any="Healed Out,Earthquake,Reverse Speed,Close Range,Heavy Hitters,Equalizer,Noxious Fumes,Stampede,Explosive Weaponry,Holy Protection,Spreading Fury";
  const secondary="Keep Your Distance,Lost Legendaries,Rise of the Commons,Up Close & Personal,Broken Arrows,Little League,Lost Magic,Even Stevens,Odd Ones Out"
  let {attr,card} = ruleset.split`|`.reduce((rule,cr)=>{
    if(cr=='Taking Sides') return rule
    secondary.includes(cr)?(rule.card=cr):rule.attr.push(cr);
    return rule
  },{attr:[],card:''})
  attr.sort();attr[0]??='Standard';
  return Object.assign(new String(ruleset),{
    attr,card,
    byCard:Ru.cardPred[card],
    byTeam:R.all (Ru.cardPred[card]),
  })
};
/** Team helper functions in T object */
const color2Deck={'Red':'Fire','Blue':'Water','White':'Life','Black':'Death','Green':'Earth'}
const T = t => Array.isArray(t)?Array.isArray(t[0])?t
  :_arr.chunk2(t)
  :_arr.chunk2(t.split`,`.map(Number));
Object.assign(T,{
  mon:       t=>T(t).slice(1),
  mana:      t=>T(t).reduce((a,c)=>C.mana(c)+a,0),
  colorPri:  t=> C.color(T(t)[0]),
  colorSec:  t=> T(t).slice(1).map(C.color).reduce((color,c)=>c in color2Deck?c:color,'Gray'),
  colors:    t=> R.uniq(T(t).map(C.color)).join`,`,
  isActive:  inactive=> t=> T(t).every(c=>!inactive.includes(C.color(c))),
  playable:  cards=> t=> T(t).every(c=>c[0] in cards || c[0] in C.basicCards),
  splinter:  inactive=> t=> color2Deck[T.colorSec(t)]?? Object.entries(color2Deck).find(c=>!inactive.includes(c[0]))[1],
  print: R.pipe (T, R.applySpec ({Summoner: x=>C.name(x[0]), Monsters: x=>R.tail(x).map(C.name)}))
})

module.exports = {C,Ru,getRules,T};
