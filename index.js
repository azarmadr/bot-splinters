//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');
const chalk = require('chalk');

const user = require('./user');
const {teamScores,playableTeams} = require('./score');
const {
  cards, cardColor, teamActualSplinterToPlay, checkVer, getElementText, getElementTextByXpath,
  clickOnElement, sleep,
} = require('./helper');
const battles = require('./battles-data');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const writeErrorToLog =(...m)=> console.error(__filename.split(/[\\/]/).pop(),...m)

let resultAll = [];
let captureRateAll = [];
let questRewardAll = [];
let finalRateAll = [];

async function checkForUpdate() {
  await require('async-get-json')('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
    .then(async v=>{
      const gitVersion = v.version.replace(/(\.0+)+$/,'').split('.');
      const version = require('./package.json').version.replace(/(\.0+)+$/,'').split('.');
      if(checkVer(gitVersion,version)){
        const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
        const question = require('util').promisify(rl.question).bind(rl);
        log(gitVersion.join('.'),version.join('.'))
        if(checkVer(gitVersion,version)){
          let answer = await question("Newer version exists!!!\nDo you want to continue? (y/N)")
          if(answer.match(/y/gi)) log('Continuing with older version');
          else if(answer.match(/n/gi)) throw new Error('git pull or get newer version');
          else throw new Error('choose correctly');
        }
      }
    })
}

async function checkForMissingConfigs() {
  await ['LOGIN_VIA_EMAIL','ACCOUNT','PASSWORD','PAUSE_BEFORE_SUBMIT','HEADLESS','KEEP_BROWSER_OPEN','CLAIM_QUEST_REWARD','ERC_THRESHOLD']
    .reduce((memo,e)=>memo.then(async()=>{
      if (!process.env[e]) {
        log(`Missing ${e} parameter in .env - see updated .env-example!`);
        await sleep(60000);
      }else if(!e.includes('PASSWORD')) log(`${e}:`,process.env[e]);
    }),Promise.resolve())
}

// LOAD MY CARDS
async function getCards(player=process.env.ACCOUNT.split('@')[0]) {
  return user.getPlayerCards(player).then(x=>x)
}

async function getBattles(player=process.env.ACCOUNT) {
  return battles.battlesList(player).then(x=>x)
}

async function closePopups(page) {
  if (await clickOnElement(page, '.close', 10000)) return;
  await clickOnElement(page, '.modal-close-new', 10000);
}
// await loading circle by Jones
async function waitUntilLoaded(page) {
  try {
    await page.waitForSelector('.loading', { timeout: 6000 })
      .then(() => { log('Waiting until page is loaded...'); });
  } catch (e) { log('No loading circle...');return; }

  await page.waitForFunction(() => !document.querySelector('.loading'), { timeout: 120000 });
}
async function clickMenuFightButton(page) {
  try {
    await page.waitForSelector('#menu_item_battle', {
      timeout: 6000
    })
      .then(button => button.click());
  } catch (e) {
    log('fight button not found')
  }

}

async function selectCorrectBattleType(page) {
  try {
    await page.waitForSelector("#battle_category_type", { timeout: 20000 })
    let battleType = (await page.$eval('#battle_category_type', el => el.innerText)).trim();
    while (battleType !== "RANKED") {
      log("Wrong battleType! battleType is " + battleType + " - Trying to change it");
      try {
        await page.waitForSelector('#right_slider_btn', { timeout: 500 })
          .then(button => button.click());
      } catch (e) {
        log('Slider button not found ', e)
      }
      await page.waitForTimeout(10000);
      battleType = (await page.$eval('#battle_category_type', el => el.innerText)).trim();
    }
  } catch (error) {
    log("Error: couldn't find battle category type ", error);
  }
}

async function createBrowsers(count, headless) {
  let browsers = [];
  for (let i = 0; i < count; i++) {
    const browser = await puppeteer.launch({
      headless: headless,
      args: process.env.CHROME_NO_SANDBOX === 'true' ? ["--no-sandbox"] : ['--disable-web-security',
        '--disable-features=IsolateOrigins',
        ' --disable-site-isolation-trials'],
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(500000);
    await page.on('dialog', async dialog => {
      await dialog.accept();
    });

    browsers[i] = browser;
  }

  return browsers;
}

async function startBotPlayMatch(page, myCards) {
  var battlesList = await getBattles();
  var scores = teamScores(battlesList,process.env.ACCOUNT);
  const ercThreshold = process.env.ERC_THRESHOLD;
  if(myCards) {
    log(process.env.ACCOUNT, ' deck size: '+Object.keys(myCards).length)
  } else {
    log(process.env.ACCOUNT, ' playing only basic cards')
  }
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1, });

  let username = await page.evaluate(()=>SM?.Player?.name);
  if (username != process.env.ACCOUNT) {
    log('Login')
    if(JSON.parse(process.env.LOGIN_VIA_EMAIL))
      await page.evaluate(async({email,pwd})=>
        await new Promise((res,rej)=>SM.EmailLogin(email,pwd).then(r=>{if(r&&r.success)res(r);else rej(r)}))
      ,{email:process.env.EMAIL,pwd:process.env.PASSWORD});
    else
      await page.evaluate(async({acc,pwd})=>
        await new Promise((res,rej)=>SM.Login(acc,pwd,r=>{if(r&&r.success)res(r);else rej(r)}))
      ,{acc:process.env.ACCOUNT,pwd:process.env.PASSWORD})
  }
  await page.goto('https://splinterlands.com/?p=battle_history');
  await waitUntilLoaded(page);
  await sleep(10000);
  const dec = await page.evaluate(()=>SM.Player.balances[0].balance);
  const erc = await page.evaluate(()=>SM.Player.capture_rate);
  log('Current Energy Capture Rate is ' + erc>5000?chalk.green(erc/100 + "%"):chalk.red(erc/100 + "%"));
  captureRateAll.push(process.env.ACCOUNT + erc>5000?chalk.green("ERC:" + erc/100 + "%"):chalk.red("ERC:" + erc/100 + "%"));
  if (erc < ercThreshold*100) {
    log('ERC is below threshold of ' + ercThreshold + '% - skipping this account');
    return;
  }
  await page.waitForTimeout(1000);
  await closePopups(page);
  await page.waitForTimeout(2000);
  if (!page.url().includes("battle_history")) {
    await clickMenuFightButton(page);
    await page.waitForTimeout(3000);
  }

  //check if season reward is available
  if (process.env.CLAIM_SEASON_REWARD === 'true') {
    try {
      log('Season reward check: ');
      await page.waitForSelector('#claim-btn', { visible: true, timeout: 3000 })
        .then(async(button) => {
          button.click();
          log(`claiming the season reward. you can check them here https://peakmonsters.com/@${process.env.ACCOUNT}/explorer`);
          await page.waitForTimeout(20000);
        })
        .catch(() => log('no season reward to be claimed, but you can still check your data here https://peakmonsters.com/@${process.env.ACCOUNT}/explorer'));
    } catch (e) {
      log('no season reward to be claimed');
    }
  }
  let curRating = await page.evaluate(()=>SM.Player.rating);
  await log('Current Rating is ' + chalk.yellow(curRating));

  //if quest done claim reward
  const quest = await page.evaluate(()=>SM.Player.quest);
  if (quest) log('Quest details: ' + chalk.yellow(JSON.stringify(quest)));
  else       log('NO quest details!! Get an account to have quests');
  try {
    const claimButton = await page.waitForSelector('#quest_claim_btn', { timeout: 25000, visible: true });
    if (claimButton) {
      log('Quest reward can be claimed!');
      questRewardAll.push(process.env.ACCOUNT + " Quest: " + quest.completed_items + "/" + quest.total_items + ' Quest reward can be claimed!')
      if (claimQuestReward) {
        await claimButton.click();
        await page.waitForTimeout(60000);
        await page.reload();
        await page.waitForTimeout(10000);
      }
    }
  } catch (e) {
    log('No quest reward to be claimed waiting for the battle...')
    questRewardAll.push(process.env.ACCOUNT + " Quest: " + chalk.yellow(quest.completed_items + "/" + quest.total_items) + chalk.red(' No quest reward...'));
  }

  if (!page.url().includes("battle_history")) {
    log("Seems like battle button menu didn't get clicked correctly - try again");
    log('Clicking fight menu button again');
    await clickMenuFightButton(page);
    await page.waitForTimeout(5000);
  }

  // LAUNCH the battle can get some finess
  try {
    log('waiting for battle button...')
    await selectCorrectBattleType(page);
    await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
      .then(button => {log('Battle button clicked'); button.click()})
      .catch(e=>console.error('[ERROR] waiting for Battle button. is Splinterlands in maintenance?'));
    await page.waitForTimeout(5000);

    try {
      log('waiting for battle button...')
      await selectCorrectBattleType(page);
      await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 3000 })
        .then(button => {
          log('Battle button clicked');
          button.click()
        })
        .catch(e => writeErrorToLog('[ERROR] waiting for Battle button. is Splinterlands in maintenance?'));
      await page.waitForTimeout(5000);
      log('waiting for an opponent...')
      await page.waitForSelector('.btn--create-team', { timeout: 25000 })
        .then(() => log('start the match'))
        .catch(async(e) => {
          writeErrorToLog('[Error while waiting for battle]');
          log('Clicking fight menu button again');
          await clickMenuFightButton(page);
          log('Clicking battle button again');
          await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 3000 })
            .then(button => {
              log('Battle button clicked');
              button.click()
            })
            .catch(e => writeErrorToLog('[ERROR] waiting for Battle button. is Splinterlands in maintenance?'));
          writeErrorToLog('Refreshing the page and retrying to retrieve a battle');
          await page.waitForTimeout(5000);
          await page.reload();
          await page.waitForTimeout(5000);
          await page.waitForSelector('.btn--create-team', { timeout: 50000 })
            .then(() => log('start the match'))
            .catch(async() => {
              log('second attempt failed reloading from homepage...');
              await page.goto('https://splinterlands.com/');
              await page.waitForTimeout(5000);
              await page.waitForXPath("//button[contains(., 'BATTLE')]", { timeout: 20000 })
                .then(button => button.click())
                .catch(e => writeErrorToLog('[ERROR] waiting for Battle button second time'));
              await page.waitForTimeout(5000);
              await page.waitForSelector('.btn--create-team', { timeout: 25000 })
                .then(() => log('start the match'))
                .catch((e) => {
                  log('third attempt failed');
                  throw new Error(e);
                })
            })
        })
    } catch (e) {
      writeErrorToLog('[Battle cannot start]:', e)
      throw new Error('The Battle cannot start');
    }
    await page.waitForTimeout(10000);
    const {mana_cap, ruleset, inactive, opponent_player,} = await page.evaluate(()=>SM._currentBattle)

    const teamsToPlay = playableTeams(scores,process.env.ACCOUNT,{mana_cap,ruleset,inactive},myCards);
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
        await page.waitForXPath(`//div[@data-original-title="${teamActualSplinterToPlay(Monsters)}"]`, { timeout: 10000 }).then(selector => selector.click())
      }
      await page.waitForTimeout(5000);
      for(const m of Monsters.values()){
        log('play: ', m[0])
        await page.waitForXPath(`//div[@card_detail_id="${m[0].toString()}"]`, { timeout: 10000 }).then(selector => selector.click());
        await page.waitForTimeout(1000);
      }
      await sleep(Math.min(60,Math.abs(process.env.PAUSE_BEFORE_SUBMIT))*999);
      try {
        await page.click('.btn-green')[0]; //start fight
      } catch {
        log('Start Fight didnt work, waiting 5 sec and retry');
        await page.waitForTimeout(5000);
        await page.click('.btn-green')[0]; //start fight
      }
      log('Team submitted, Waiting for opponent');
      await page.waitForTimeout(5000);
      await page.waitForSelector('#btnRumble', { timeout: 160000 }).then(() => log('btnRumble visible')).catch(() => log('btnRumble not visible'));
      await page.waitForTimeout(5000);
      await page.$eval('#btnRumble', elem => elem.click()).then(()=>log('btnRumble clicked')).catch(()=>log('btnRumble didnt click')); //start rumble
      await page.waitForSelector('#btnSkip', { timeout: 10000 }).then(()=>log('btnSkip visible')).catch(()=>log('btnSkip not visible'));
      await page.$eval('#btnSkip', elem => elem.click()).then(()=>log('btnSkip clicked')).catch(()=>log('btnSkip not visible')); //skip rumble

      const won = (await page.evaluate(()=>SM.Player.rating))-curRating;
      if(won>0){
        const decWon = (await page.evaluate(()=>SM.Player.balances[0].balance))-dec;
        resultAll.push(process.env.ACCOUNT + chalk.green(' You won! Reward: ' + decWon + ' DEC'));
      } else if(won<0) resultAll.push(process.env.ACCOUNT + chalk.red(' You lost :('));
      else resultAll.push(process.env.ACCOUNT + chalk.red(' Draw!! :('));
      await clickOnElement(page, '.btn--done', 1000, 2500);

      curRating = await page.evaluate(()=>SM.Player.rating);
      log('Updated Rating after battle is ' + chalk.yellow(curRating));
      finalRateAll.push(process.env.ACCOUNT + (' New rating is ' + chalk.yellow(curRating)));
    } catch (e) {
      throw new Error(e);
    }
  } catch (e) {
    throw new Error(e);
  }
}

// 30 MINUTES INTERVAL BETWEEN EACH MATCH (if not specified in the .env file)
const sleepingTimeInMinutes = process.env.MINUTES_BATTLES_INTERVAL || 30;
const sleepingTime = sleepingTimeInMinutes * 60000;

;(async () => {
  await checkForUpdate();
  try {
    await checkForUpdate();
    await checkForMissingConfigs();
    const loginViaEmail = JSON.parse(process.env.LOGIN_VIA_EMAIL.toLowerCase());
    const accountusers = process.env.ACCOUNT.split(',');
    const accounts = loginViaEmail ? process.env.EMAIL.split(',') : accountusers;
    const passwords = process.env.PASSWORD.split(',');
    const headless = JSON.parse(process.env.HEADLESS.toLowerCase());
    const keepBrowserOpen = JSON.parse(process.env.KEEP_BROWSER_OPEN.toLowerCase());
    const claimQuestReward = JSON.parse(process.env.CLAIM_QUEST_REWARD.toLowerCase());

    let browsers = [];

    while (true) {
      for (let i = 0; i < accounts.length; i++) {
        process.env['EMAIL'] = accounts[i];
        process.env['PASSWORD'] = passwords[i];
        process.env['ACCOUNT'] = accountusers[i];

        if (keepBrowserOpen && browsers.length == 0) {
          log('Opening browsers');
          browsers = await createBrowsers(accounts.length, headless);
        } else if (!keepBrowserOpen && browsers.length == 0) { // close browser, only have 1 instance at a time
          log('Opening browser');
          browsers = await createBrowsers(1, headless);
        }
        const page = (await(keepBrowserOpen ? browsers[i] : browsers[0]).pages())[1];
        await page.goto('https://splinterlands.com/');
        log('getting user cards collection from splinterlands API...')
        const myCards = await getCards()
          .then((x)=>{log('cards retrieved'); return x})
          .catch(() => log('cards collection api didnt respond. Did you use username? avoid email!'));
        await startBotPlayMatch(page, myCards)
          .then(() => { log('Closing battle'); }) .catch(log)
        //await page.waitForTimeout(5000);
        if (keepBrowserOpen) {
          await page.goto('about:blank');
        } else {
          await page.evaluate(function () { SM.Logout(); });
          //let pages = await browsers[0].pages();
          //await Promise.all(pages.map(page =>page.close()));
          //await browsers[0].close();
          //browsers[0].process().kill('SIGKILL');
        }
      }

      log('--------------------------Battle Result Summary:----------------------');
      for (const i of resultAll.keys())      { log(resultAll[i]);      }
      for (const i of finalRateAll.keys())   { log(finalRateAll[i]);   }
      for (const i of captureRateAll.keys()) { log(captureRateAll[i]); }
      for (const i of questRewardAll.keys()) { log(questRewardAll[i]); }
      log('----------------------------------------------------------------------');
      log('Waiting for the next battle in', sleepingTime / 1000 / 60, ' minutes at ', new Date(Date.now() + sleepingTime).toLocaleString());
      log('--------------------------End of Battle--------------------------------');
      await sleep(sleepingTime);
      resultAll = [];
      captureRateAll = [];
      questRewardAll = [];
      finalRateAll = [];
      log('//debug');
    }
  } catch (e) {
    log('Routine error at: ', new Date().toLocaleString(), e)
  } })()
