async function login(page) {
  try {
    page.waitForSelector('#log_in_button > button').then(() => page.click('#log_in_button > button'))
    await page.waitForSelector('#email')
      .then(() => page.waitForTimeout(3000))
      .then(() => page.focus('#email'))
      .then(() => page.type('#email', process.env.ACCOUNT))
      .then(() => page.focus('#password'))
      .then(() => page.type('#password', process.env.PASSWORD))

    // .then(() => page.waitForSelector('#login_dialog_v2 > div > div > div.modal-body > div > div > form > div > div.col-sm-offset-1 > button', { visible: true }).then(() => page.click('#login_dialog_v2 > div > div > div.modal-body > div > div > form > div > div.col-sm-offset-1 > button')))
      .then(() => page.keyboard.press('Enter'))
      .then(() => page.waitForTimeout(5000))
      .then(() => page.reload())
      .then(() => page.waitForTimeout(3000))

  } catch (e) {
    console.log('login error', e);
  }
}

async function checkMana(page) {
  var manas = await page.evaluate(() => {
    var manaCap = document.querySelectorAll('div.mana-total > span.mana-cap')[0].innerText;
    var manaUsed = document.querySelectorAll('div.mana-total > span.mana-used')[0].innerText;
    var manaLeft = manaCap - manaUsed
    return { manaCap, manaUsed, manaLeft };
  });
  console.log('manaLimit', manas);
  return manas;
}

async function checkMatchMana(page) {
  const mana = await page.$$eval("div.col-md-12 > div.mana-cap__icon", el => el.map(x => x.getAttribute("data-original-title")));
  const manaValue = parseInt(mana[0].split(':')[1], 10);
  console.log(manaValue);
  return manaValue;
}

async function checkMatchRules(page) {
  const rules = await page.$$eval("div.combat__rules > div.row > div>  img", el => el.map(x => x.getAttribute("data-original-title")));
  return rules.map(x => x.split(':')[0]).join('|')
}

async function checkMatchActiveSplinters(page) {
  const splinterUrls = await page.$$eval("div.col-sm-4 > img", el => el.map(x => x.getAttribute("src")));
  return splinterUrls.map(splinter => splinterIsActive(splinter)).filter(x => x);
}

async function sleepTime(page) {
  try {
    const sleepTime = await page.evaluate(()=> {
      const dec_rr = parseFloat(document.querySelector(".dec-options .value:nth-child(3) > div").innerText);
      const curr_rating = parseInt(document.querySelector(".league_status_panel_progress_bar_pos .number_text").innerText.replace(/,/g,''));
      console.log(dec_rr,curr_rating);
      return 54321*(27*Math.tanh(curr_rating/729)+81/Math.cosh(dec_rr/27));
    });
    return sleepTime;
  } catch (e) {
    console.log('login error', e);
  }
  return 3210123;
}

const quests = {
  "Defend the Borders":    "life",    "Pirate Attacks":   "water",
  "High Priority Targets": "snipe",   "Lyanna's Call":    "earth",
  "Stir the Volcano":      "fire",    "Rising Dead":      "death",
  "Stubborn Mercenaries":  "neutral", "Gloridax Revenge": "dragon",
  "Stealth Mission":       "sneak",
};

const getPlayerQuest = (username) => (require('async-get-json')(`https://game-api.splinterlands.io/players/quests?username=${username}`)
  .then(x => {
    if (x[0]) {
      const questDetails = {name: x[0].name, splinter: quests[x[0].name], total: x[0].total_items, completed: x[0].completed_items}
      return questDetails;
    }})
  .catch(e => console.log('[ERROR QUEST] Check if Splinterlands is down. Are you using username or email? please use username'))
)

//UNUSED ?
const splinterIsActive = (splinterUrl) => {
  const splinter = splinterUrl.split('/').slice(-1)[0].replace('.svg', '').replace('icon_splinter_', '');
  return splinter.indexOf('inactive') === -1 ? splinter : '';
}

module.exports = {
  login,                     checkMana, checkMatchMana,   checkMatchRules,
  checkMatchActiveSplinters, sleepTime, splinterIsActive, getPlayerQuest,
}
