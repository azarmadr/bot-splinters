//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');

const splinterlandsPage = require('./splinterlandsPage');
const user = require('./user');
const {teamScores,playableTeams} = require('./score');
const { cards, cardColor, teamActualSplinterToPlay, arrCmp} = require('./helper');
const battles = require('./battles-data');
const log=(...m)=>console.log('index.js:',...m)

async function checkForUpdate() {
  await require('async-get-json')('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
  .then(v=>{
    const gitVersion = v.version.replace(/(\.0+)+$/,'').split('.');
    const version = require('./package.json').version.replace(/(\.0+)+$/,'').split('.');
    if(arrCmp(gitVersion,version)>0){
      const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
      do{
        rl.question("Newer version exists!!!\nDo you want to continue? (y/N)", function(d) {
          if(d.match(/y/gi)) log('Continuing with older version');
          else if(d.match(/n/gi)) throw new Error('git pull or get newer version');
          rl.close();
        });
      }while(!decision)
    }
  })
}

// LOAD MY CARDS
async function getCards() {
  return user.getPlayerCards(process.env.ACCOUNT.split('@')[0]).then(x=>x)
}

async function getQuest() {
  return splinterlandsPage.getPlayerQuest(process.env.ACCOUNT.split('@')[0])
    .then(x=>x)
    .catch(e=>log('No quest data, splinterlands API didnt respond.'))
}

async function getBattles() {
  return battles.battlesList(process.env.ACCOUNT).then(x=>x)
}

async function selectCorrectBattleType(page) {
  try {
    await page.waitForSelector("#battle_category_type", { timeout: 20000 })
    let battleType = (await page.$eval('#battle_category_type', el => el.innerText)).trim();
    while (battleType !== "RANKED") {
      log("Wrong battleType! battleType is " +  battleType +  " - Trying to change it");
      try {
        await page.waitForSelector('#right_slider_btn', { timeout: 500 })
          .then(button => button.click());
      } catch (e) {
        log('Slider button not found ', e)
      }
      await page.waitForTimeout(1000);
      battleType = (await page.$eval('#battle_category_type', el => el.innerText)).trim();
    }
  } catch (error) {
    log("Error: couldn't find battle category type ", error);
  }
}

async function startBotPlayMatch(page, myCards, quest) {
  var battlesList = await getBattles();
  var scores = teamScores(battlesList,process.env.ACCOUNT);
  if(myCards) {
    log(process.env.ACCOUNT, ' deck size: '+Object.keys(myCards).length)
  } else {
    log(process.env.ACCOUNT, ' playing only basic cards')
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
    .catch(()=> log('Already logged in'))

  if (item != undefined)
  {log('Login')
    await splinterlandsPage.login(page).catch(e=>log('Login Error: ',e));
  }

  await page.waitForTimeout(8000);
  await page.reload();
  await page.waitForTimeout(8000);
  await page.reload();
  await page.waitForTimeout(8000);

  await page.click('#menu_item_battle').catch(e=>log('Battle Button not available'));

  //if quest done claim reward
  log('Quest: ', quest);
  try {
    await page.waitForSelector('#quest_claim_btn', { timeout: 5000 })
      .then(button => button.click());
  } catch (e) {
    console.info('no quest reward to be claimed waiting for the battle...')
  }

  await page.waitForTimeout(5000);

  // LAUNCH the battle can get some finess
  try {
    log('waiting for battle button...')
    await selectCorrectBattleType(page);
    await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
      .then(button => {log('Battle button clicked'); button.click()})
      .catch(e=>console.error('[ERROR] waiting for Battle button. is Splinterlands in maintenance?'));
    await page.waitForTimeout(5000);

    log('waiting for an opponent...')
    await page.waitForSelector('.btn--create-team', { timeout: 50000 })
      .then(()=>log('start the match'))
      .catch(async (e)=> {
        console.error('[Error while waiting for battle]');
        console.error('Refreshing the page and retrying to retrieve a battle');
        await page.waitForTimeout(5000);
        await page.reload();
        await page.waitForTimeout(5000);
        await page.waitForSelector('.btn--create-team', { timeout: 50000 })
          .then(()=>log('start the match'))
          .catch(async ()=>{
            log('second attempt failed reloading from homepage...');
            await page.goto('https://splinterlands.com/?p=battle_history');
            await page.waitForTimeout(5000);
            await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
              .then(button => button.click())
              .catch(e=>console.error('[ERROR] waiting for Battle button second time'));
            await page.waitForTimeout(5000);
            await page.waitForSelector('.btn--create-team', { timeout: 50000 })
              .then(()=>log('start the match'))
              .catch((e)=>{
                log('third attempt failed');
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

  const teamsToPlay = playableTeams(scores,process.env.ACCOUNT,mana,rules);
  //await page.waitForTimeout(2000);

  //TEAM SELECTION
  //Can do further analysin on teamsToPlay
  const [Summoner,...Monsters] = teamsToPlay[0].team;
  const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  log('teamsToPlay.length',teamsToPlay.length);
  log('Summoner:',cards[Summoner[0]-1].name,'Level:',Summoner[1]);
  Monsters.forEach(m=>log('Monster:',cards[m[0]-1].name,'Level:',m[1]));

  if (Summoner) {
    page.click('.btn--create-team')[0];
  } else {
    throw new Error('Team Selection error');
  }
  await page.waitForTimeout(5000);
  try {
    await page.waitForXPath(`//div[@card_detail_id="${Summoner[0]}"]`, { timeout: 10000 }).then(summonerButton => summonerButton.click());
    if (cardColor(Summoner) === 'Gold') {
      log('Dragon play TEAMCOLOR', teamActualSplinterToPlay(Monsters))
      await page.waitForXPath(`//div[@data-original-title="${teamActualSplinterToPlay(Monsters)}"]`, { timeout: 8000 }).then(selector => selector.click())
    }
    await page.waitForTimeout(5000);
    for(const m of Monsters.values()){
      log('play: ', m[0])
      await page.waitForXPath(`//div[@card_detail_id="${m[0].toString()}"]`, { timeout: 10000 }).then(selector => selector.click());
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(5000);
    try {
      await page.click('.btn-green')[0]; //start fight
    } catch {
      log('Start Fight didnt work, waiting 5 sec and retry');
      await page.waitForTimeout(5000);
      await page.click('.btn-green')[0]; //start fight
    }
    await page.waitForTimeout(5000);
    await page.waitForSelector('#btnRumble', { timeout: 90000 }).then(()=>log('btnRumble visible')).catch(()=>log('btnRumble not visible'));
    await page.waitForTimeout(5000);
    await page.$eval('#btnRumble', elem => elem.click()).then(()=>log('btnRumble clicked')).catch(()=>log('btnRumble didnt click')); //start rumble
    await page.waitForSelector('#btnSkip', { timeout: 10000 }).then(()=>log('btnSkip visible')).catch(()=>log('btnSkip not visible'));
    await page.$eval('#btnSkip', elem => elem.click()).then(()=>log('btnSkip clicked')).catch(()=>log('btnSkip not visible')); //skip rumble
    await page.waitForTimeout(10000);
    try {
      await page.click('.btn--done')[0]; //close the fight
    } catch(e) {
      log('btn done not found')
      throw new Error('btn done not found');
    }
  } catch (e) {
    throw new Error(e);
  }
}

let sleepingTime = 0;

;(async () => {
  let browser,page;
  while (true) {
    await checkForUpdate();
    try {
      log('START ', process.env.ACCOUNT, new Date().toLocaleString())
      browser = browser || await puppeteer.launch({
        headless: false,
        //profile: './profile',
        //args: ['--no-sandbox']
      }); // default is true
      if(!page){
        page = await browser.newPage();
        await page.setDefaultNavigationTimeout(500000);
        await page.on('dialog', async dialog => {
          await dialog.accept();
        });
      }
      page.goto('https://splinterlands.com/?p=battle_history');
      log('getting user cards collection from splinterlands API...')
      const myCards = await getCards()
        .then((x)=>{log('cards retrieved'); return x})
        .catch(()=>log('cards collection api didnt respond'));
      log('getting user quest info from splinterlands API...')
      const quest = await getQuest();
      await startBotPlayMatch(page, myCards, quest)
        .then(() => {
          log('Closing battle', new Date().toLocaleString());
        })
        .catch((e) => {
          log('Error: ', e)
        })
      await page.waitForTimeout(30000);
      sleepingTime = await splinterlandsPage.sleepTime(page);
      //await browser.close();
    } catch (e) {
      log('Routine error at: ', new Date().toLocaleString(), e)
    }
    await log(process.env.ACCOUNT,'waiting for the next battle in', sleepingTime / 1000 / 60 , ' minutes at ', new Date(Date.now() +sleepingTime).toLocaleString())
    await new Promise(r => setTimeout(r, sleepingTime));
  }
})()
