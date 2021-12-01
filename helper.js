const AKM  = require('array-keyed-map');
const cards = require("./data/cards.json");
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const rl = require("readline");
rl.emitKeypressEvents(process.stdin);
var _wake;
const rlInterface=rl.createInterface({input:process.stdin,output:process.stdout});
rlInterface.pause();
process.stdin.on('keypress',(_,k)=>{
  _wake=1; rlInterface.pause();
  rl.moveCursor(process.stdout,0,(k&&k.name=='return')?-1:0);
});

const _elem = {}, _akmap = {}, _dbug = {},_func={};


// general helper functions
const _arr = {
  eq:(a,b)=>a.length===b.length&&a.every((v,i)=>Array.isArray(v)?_arr.eq(v,b[i]):v===b[i])
  ,cmp : (a,b)=> // return a>b
    a.length === b.length ?  a.reduce((r,v,i)=>r+(Array.isArray(v)?_arr.cmp(v,b[i]):v-b[i]),0):a.length-b.length
  ,checkVer:(a,b)=>{
    for(const i of Array(Math.min(a.length,b.length)).keys()){
      if(Number(a[i])>Number(b[i]))return true;
      else if(Number(a[i])<Number(b[i]))return false;
    }
    return a.length>b.length
  }
  ,chunk : (arr, n) => {
    if(n<=0)throw new Error('First argument to splitEvery must be a positive integer')
    var result = [],idx = 0;
    while(idx<arr.length)result.push(arr.slice(idx,idx+=n))
    return result
  }
  ,chunk2:arr=>_arr.chunk(arr,2)
}

/** Card helper functions in _card object */
/** small function to return id of the card if array or id is given
 * @param (Any) c if array of [id,level], or id
 * @returns id of the card */
const cardToIdx=c=>Array.isArray(c)?c[0]:c;
const {color,name,rarity,type} = ['color','name','rarity','type'].reduce(
  (obj,attribute)=>(obj[attribute]=c=>cards[cardToIdx(c)-1][attribute])&&obj,{}
)
const {ranged,magic,attack,speed,armor,health} = ['ranged','magic','attack','speed','armor','health'].reduce(
  (obj,stat)=>(obj[stat]=([i,l])=>cards[i-1].stats[stat]?.[l-1])&&obj,{}
)
const _card = {
  mana:      c=>       [cards[cardToIdx(c)-1].stats.mana].flat()[0],
  abilities: ([i,l])=> cards[i-1].stats?.abilities?.slice(0,l)?.flat()||[],
  basic:     cards.filter(c=>c.editions.match(/1|4/)&&c.rarity<3).map(c=>c.id),
  ranged,magic,attack,speed,armor,health,color,name,rarity,type,
}

/** Team helper functions in _team object */
const color2Deck={'Red':'Fire','Blue':'Water','White':'Life','Black':'Death','Green':'Earth'}
const _team = {
  adpt: t=>Array.isArray(t[0])?t:_arr.chunk2(t),
  mana: t=>_team.adpt(t).reduce((a,c)=>_card.mana(c)+a,0),
  colorPri: t=>_card.color(_team.adpt(t)[0]),
  colorSec: t=>_team.adpt(t).slice(1).reduce((color,c)=>
    _card.color(c)in color2Deck?_card.color(c):color,'Gray'),
  splinter: (team,inactive)=>color2Deck[_team.colorSec(team)]??
    Object.entries(color2Deck).find(c=>!inactive.includes(c[0]))[1],
  rules : {
    primary:"Back to BasicsSilenced SummonersAim TrueSuper SneakWeak MagicUnprotectedTarget PracticeFog of WarArmored UpEqual OpportunityMelee Mayhem",
    any:"Healed OutEarthquakeReverse SpeedClose RangeHeavy HittersEqualizerNoxious FumesStampedeExplosive WeaponryHoly ProtectionSpreading Fury",
    secondary:"Keep Your DistanceLost LegendariesTaking SidesRise of the CommonsUp Close & PersonalBroken ArrowsLittle LeagueLost MagicEven StevensOdd Ones Out"
  },
  isActive: (t,inactive)=> _team.adpt(t).every(c=>!inactive.includes(_card.color(c))),
};

_akmap.toPlainObject = akmap => {
  const out = {}
  for (const [path, value] of akmap.entries()) {
    setAtPath(out, path, value)
  }
  return out

  function setAtPath (obj, path, value) {
    for (const key of path) obj = obj[key] ??= {}
    obj['__DATA__'] = value
  }
}
_akmap.fromPlainObject = obj => {
  const akmap = new AKM()
  for (const [path, value] of allPaths(obj)) {
    akmap.set(path, value)
  }
  return akmap

  function* allPaths(obj, stack = []) {
    for (let [key, value] of Object.entries(obj)) {
      if (key === '__DATA__') yield [stack, value]
      else yield* allPaths(value, stack.concat([key]))
    }
  }
}

function sleep(ms,msg='') {
  rlInterface.resume();
  process.stdout.write("\x1B[?25l");
  [...Array(27).keys()].forEach(()=>process.stdout.write("\u2591"))
  rl.cursorTo(process.stdout, 0);
  return [...Array(27).keys()].reduce((memo,e)=>memo.then(async()=>{
    process.stdout.write("\u2588");
    if(e==26){
      rl.clearLine(process.stdout,0)&&rl.cursorTo(process.stdout,0);
      if(msg)console.log(msg);
      _wake=0;
    }
    if(_wake&&e<27)return;
    return new Promise((resolve) => setTimeout(resolve, ms/27));
  }),Promise.resolve())
}

_elem.click = async function(page, selector, timeout = 20000, delayBeforeClicking = 0) {
  try {
    const elem = await page.waitForSelector(selector, { timeout });
    if (elem) {
      await sleep(delayBeforeClicking);
      log('Clicking element ' + selector);
      await elem.click();
      return true;
    }
  } catch (e) {/*log(e)*/}
  log('Error: Could not find element ' + selector);
  return false;
}

_elem.getText = async function(page, selector, timeout=20000) {
  const element = await page.waitForSelector(selector,  { timeout: timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}

_elem.getTextByXpath = async function(page, selector, timeout=20000) {
  const element = await page.waitForXPath(selector,  { timeout: timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}

/** debug helpers
 */
_dbug.in1 = m=>{
  rl.clearLine(process.stdout,0)
  rl.cursorTo(process.stdout,0);
  process.stdout.write(`tt: ${m}`);
}

_func.retryFor=(n,to,continueAfterAllRetries=0,func,err='')=>{
  if(!--n){
    log({'Failed after multiple retries':''});
    if(continueAfterAllRetries)return Promise.resolve(err);
    else return Promise.reject(err);
  }
  return func().catch(async err=>{
    log({'nth retry':n})
    await sleep(to).then(()=>
      _func.retryFor(n,to,continueAfterAllRetries,func,err))
  })
}

module.exports = {
  _card,     _team, _elem, _akmap, _dbug,  sleep,  log,
  _arr, cards,_func,
};
