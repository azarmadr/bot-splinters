const cards = require("./data/cards.json");
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

// Teams and Cards
const cardColor=(c)=>cards[c[0]-1]?.color;
const validDecks = ['Red', 'Blue', 'White', 'Black', 'Green']
const colorToDeck = { 'Red': 'Fire', 'Blue': 'Water', 'White': 'Life', 'Black': 'Death', 'Green': 'Earth' }

const deckValidColor=(accumulator,currentValue)=>validDecks.includes(cardColor(currentValue))?colorToDeck[cardColor(currentValue)]:accumulator;

const teamActualSplinterToPlay=(teamIdsArray)=>teamIdsArray.reduce(deckValidColor,'Fire')
const playableTeam = (team,myCards) => myCards[team.summoner.id]>=team.summoner.level && team.monsters.every(v=>myCards[v.id]>=v.level)//mostly depr
const addName = (card)=>{return{...card,name:cards[card.id-1].name}}
const cleanTeam=(team)=>{return{summoner:team.summoner,monsters:team.monsters}}
const cleanCard=(card)=>{return{id:card.id,level:card.level}}
const teamWithNames=(team)=>{
  return {summoner:addName(team.summoner),monsters:[...team.monsters.map(m=>addName(m))]}
}//mostly depr

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
const chunk = (input, size) => {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
};
const chunk2 = t => chunk(t,2);
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function clickOnElement(page, selector, timeout = 20000, delayBeforeClicking = 0) {
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

async function getElementText(page, selector, timeout=20000) {
  const element = await page.waitForSelector(selector,  { timeout: timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}

async function getElementTextByXpath(page, selector, timeout=20000) {
  const element = await page.waitForXPath(selector,  { timeout: timeout });
  const text = await element.evaluate(el => el.textContent);
  return text;
}
//const teamIdsArray = [{"id":62,"level":1,"name":"Living Lava"},{"id":61,"level":1,"name":"Kobold Miner"}]; console.log(teamActualSplinterToPlay(teamIdsArray)); console.log(cardColor({"id":224,"level":1,"name":"Drake of Arnak"}))

module.exports = {
  cardColor,     playableTeam, addName, cleanCard, cleanTeam, teamActualSplinterToPlay,
  teamWithNames, arrEquals,    cards,   chunk,     chunk2,    arrCmp, checkVer,
  getElementText, getElementTextByXpath, clickOnElement, sleep,
};
