//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');

const splinterlandsPage = require('./splinterlandsPage');
const user = require('./user');
const helper = require('./helper');
const quests = require('./quests');
const battles = require('./battles-data');
const score = require('./score');

// LOAD MY CARDS
async function getCards() {
  return user.getPlayerCards(process.env.ACCOUNT.split('@')[0]).then(x=>x)
}

async function getQuest() {
  return quests.getPlayerQuest(process.env.ACCOUNT.split('@')[0])
    .then(x=>x)
    .catch(e=>console.log('No quest data, splinterlands API didnt respond.'))
}

async function getBattles() {
  return battles.battlesList(process.env.ACCOUNT).then(x=>x)
}

async function startBotPlayMatch(page, myCards, quest, battlesList) {
  if(myCards) {
    console.log(process.env.ACCOUNT, ' deck size: '+myCards.length)
  } else {
    console.log(process.env.ACCOUNT, ' playing only basic cards')
  }
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({
    width: 1800,
    height: 1500,
    deviceScaleFactor: 1,
  });

  await page.goto('https://splinterlands.com/');
  await page.waitForTimeout(8000);

  let item = await page.waitForSelector('#log_in_button > button', {
    visible: true,
  })
    .then(res => res)
    .catch(()=> console.log('Already logged in'))

  if (item != undefined)
  {console.log('Login')
    await splinterlandsPage.login(page).catch(e=>console.log('Login Error: ',e));
  }

  await page.waitForTimeout(8000);
  await page.reload();
  await page.waitForTimeout(8000);
  await page.reload();
  await page.waitForTimeout(8000);

  await page.click('#menu_item_battle').catch(e=>console.log('Battle Button not available'));

  //if quest done claim reward
  console.log('Quest: ', quest);
  try {
    await page.waitForSelector('#quest_claim_btn', { timeout: 5000 })
      .then(button => button.click());
  } catch (e) {
    console.info('no quest reward to be claimed waiting for the battle...')
  }

  await page.waitForTimeout(5000);

  // LAUNCH the battle can get some finess
  try {
    console.log('waiting for battle button...')
    await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
      .then(button => {console.log('Battle button clicked'); button.click()})
      .catch(e=>console.error('[ERROR] waiting for Battle button. is Splinterlands in maintenance?'));
    await page.waitForTimeout(5000);

    console.log('waiting for an opponent...')
    await page.waitForSelector('.btn--create-team', { timeout: 50000 })
      .then(()=>console.log('start the match'))
      .catch(async (e)=> {
        console.error('[Error while waiting for battle]');
        console.error('Refreshing the page and retrying to retrieve a battle');
        await page.waitForTimeout(5000);
        await page.reload();
        await page.waitForTimeout(5000);
        await page.waitForSelector('.btn--create-team', { timeout: 50000 })
          .then(()=>console.log('start the match'))
          .catch(async ()=>{
            console.log('second attempt failed reloading from homepage...');
            await page.goto('https://splinterlands.com/');
            await page.waitForTimeout(5000);
            await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
              .then(button => button.click())
              .catch(e=>console.error('[ERROR] waiting for Battle button second time'));
            await page.waitForTimeout(5000);
            await page.waitForSelector('.btn--create-team', { timeout: 50000 })
              .then(()=>console.log('start the match'))
              .catch((e)=>{
                console.log('third attempt failed');
                throw new Error(e);})
          })
      })
  } catch(e) {
    console.error('[Battle cannot start]:', e)
    throw new Error('The Battle cannot start');
  }
  await page.waitForTimeout(10000);
  let [mana, rules, splinters] = await Promise.all([
    splinterlandsPage.checkMatchMana(page).then((mana) => mana).catch(() => 'no mana'),
    splinterlandsPage.checkMatchRules(page).then((rulesArray) => rulesArray).catch(() => 'no rules'),
    splinterlandsPage.checkMatchActiveSplinters(page).then((splinters) => splinters).catch(() => 'no splinters')
  ]);

  const playableTeams = score.scores(battlesList)[rules][mana].team.playable.filter(t=>t.w*2>t.count);
  //await page.waitForTimeout(2000);

  //TEAM SELECTION
  //Can do further analysin on playableTeams
  const teamToPlay = playableTeams[0];
  const __medusa = teamToPlay.monsters.find(m=>m.id==17);
  if(__medusa){__medusa.id=194;}
  console.log(playableTeams.length,teamToPlay);

  if (teamToPlay) {
    page.click('.btn--create-team')[0];
  } else {
    throw new Error('Team Selection error');
  }
  await page.waitForTimeout(5000);
  try {
    await page.waitForXPath(`//div[@card_detail_id="${teamToPlay.summoner.id}"]`, { timeout: 10000 }).then(summonerButton => summonerButton.click());
    if (helper.color(teamToPlay.summoner) === 'Gold') {
      console.log('Dragon play TEAMCOLOR', helper.teamActualSplinterToPlay(teamToPlay.monsters))
      await page.waitForXPath(`//div[@data-original-title="${helper.teamActualSplinterToPlay(teamToPlay.monsters)}"]`, { timeout: 8000 }).then(selector => selector.click())
    }
    await page.waitForTimeout(5000);
    //teamToPlay.monsters.forEach(m=>{
    for(let i=0;i<teamToPlay.monsters.length;i++){
      const m = teamToPlay.monsters[i];
      console.log('play: ', m.id.toString())
      await page.waitForXPath(`//div[@card_detail_id="${m.id.toString()}"]`, { timeout: 10000 }).then(selector => selector.click());
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(5000);
    try {
      await page.click('.btn-green')[0]; //start fight
    } catch {
      console.log('Start Fight didnt work, waiting 5 sec and retry');
      await page.waitForTimeout(5000);
      await page.click('.btn-green')[0]; //start fight
    }
    await page.waitForTimeout(5000);
    await page.waitForSelector('#btnRumble', { timeout: 90000 }).then(()=>console.log('btnRumble visible')).catch(()=>console.log('btnRumble not visible'));
    await page.waitForTimeout(5000);
    await page.$eval('#btnRumble', elem => elem.click()).then(()=>console.log('btnRumble clicked')).catch(()=>console.log('btnRumble didnt click')); //start rumble
    await page.waitForSelector('#btnSkip', { timeout: 10000 }).then(()=>console.log('btnSkip visible')).catch(()=>console.log('btnSkip not visible'));
    await page.$eval('#btnSkip', elem => elem.click()).then(()=>console.log('btnSkip clicked')).catch(()=>console.log('btnSkip not visible')); //skip rumble
    await page.waitForTimeout(10000);
    try {
      await page.click('.btn--done')[0]; //close the fight
    } catch(e) {
      console.log('btn done not found')
      throw new Error('btn done not found');
    }
  } catch (e) {
    throw new Error(e);
  }
}

let sleepingTime = 0;

;(async () => {
  while (true) {
    try {
      console.log('START ', process.env.ACCOUNT, new Date().toLocaleString())
      const browser = await puppeteer.launch({
        headless: false,
        profile: './profile',
        //args: ['--no-sandbox']
      }); // default is true
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(500000);
      await page.on('dialog', async dialog => {
        await dialog.accept();
      });
      page.goto('https://splinterlands.com/');
      console.log('getting user cards collection from splinterlands API...')
      const myCards = await getCards()
        .then((x)=>{console.log('cards retrieved'); return x})
        .catch(()=>console.log('cards collection api didnt respond'));
      console.log('getting user quest info from splinterlands API...')
      const quest = await getQuest();
      const battlesList = await getBattles();
      const scores = score.scores(battlesList);
      await startBotPlayMatch(page, myCards, quest, battlesList)
        .then(() => {
          console.log('Closing battle', new Date().toLocaleString());
        })
        .catch((e) => {
          console.log('Error: ', e)
        })
      await page.waitForTimeout(30000);
      sleepingTime = await splinterlandsPage.sleepTime(page);
      await browser.close();
    } catch (e) {
      console.log('Routine error at: ', new Date().toLocaleString(), e)
    }
    await console.log(process.env.ACCOUNT,'waiting for the next battle in', sleepingTime / 1000 / 60 , ' minutes at ', new Date(Date.now() +sleepingTime).toLocaleString())
    await new Promise(r => setTimeout(r, sleepingTime));
  }
})()
