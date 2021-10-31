const cards = require("./data/cards.json");
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

const _card = {},_team = {}, _elem = {};
// Teams and Cards
/** small function to return id of the card if array or id is given
 * @param (Any) c if array of [id,level], or id
 * @returns id of the card */
const cardToIdx=c=>Array.isArray(c)?c[0]:c;
_card.color=c=>cards[cardToIdx(c)-1].color;
_card.name =c=>cards[cardToIdx(c)-1].name;
const validDecks = ['Red', 'Blue', 'White', 'Black', 'Green']
const colorToDeck = { 'Red': 'Fire', 'Blue': 'Water', 'White': 'Life', 'Black': 'Death', 'Green': 'Earth' }

const deckValidColor=(accumulator,currentValue)=>validDecks.includes(_card.color(currentValue))?colorToDeck[_card.color(currentValue)]:accumulator;

_team.splinterToPlay=(team,inactive)=>
  team.reduce(deckValidColor,colorToDeck[validDecks.find(c=>inactive.indexOf(c)<0)])

// general helper functions
const arrEquals = (a, b) =>
  a.length === b.length &&
    a.every((v, i) => Array.isArray(v)?arrEquals(v,b[i]):v === b[i]);
const arrCmp = (a,b)=> // return a>b
  a.length === b.length ?
    a.reduce((r,v,i)=>r+(Array.isArray(v)?arrCmp(v,b[i]):v-b[i]),0):a.length-b.length;
const checkVer=(a,b)=>{
  for(const i of Array(Math.min(a.length,b.length)).keys()){
    if(Number(a[i])>Number(b[i]))return true;
    else if(Number(a[i])<Number(b[i]))return false;
  }
  return a.length>b.length
}
const chunk = (input_arr, size) => {
  return input_arr.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
}
const chunk2=arr=>chunk(arr,2);

//const 

function sleep(ms) {
  process.stdout.write("\x1B[?25l");
  [...Array(27).keys()].forEach(()=>process.stdout.write("\u2591"))
  require("readline").cursorTo(process.stdout, 0);
  return [...Array(27).keys()].reduce((memo,e)=>memo.then(async()=>{
    process.stdout.write("\u2588");
    if(e==26)console.log();
    return new Promise((resolve) => setTimeout(resolve, ms/27));
  }),Promise.resolve())
}

_elem.click = async function(page, selector, timeout = 20000, delayBeforeClicking = 0) {
  try {
    const elem = await page.waitForSelector(selector, { timeout: timeout });
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
//const team = [{"id":62,"level":1,"name":"Living Lava"},{"id":61,"level":1,"name":"Kobold Miner"}]; console.log(teamActualSplinterToPlay(team)); console.log(_card.color({"id":224,"level":1,"name":"Drake of Arnak"}))

module.exports = {
  _card,     _team, _elem, sleep, log,
  arrEquals,    cards,   chunk,     chunk2,    arrCmp, checkVer,
};
