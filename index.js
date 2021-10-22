//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');
const chalk = require('chalk');
const {table} = require('table');

const user = require('./user');
const SM = require('./splinterApi');
const {teamScores,playableTeams} = require('./score');
const {
  cards, cardColor, teamActualSplinterToPlay, checkVer, getElementText, getElementTextByXpath,
  clickOnElement, sleep,
} = require('./helper');
const battles = require('./battles-data');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

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
  await ['ACCOUNT','PASSWORD','PAUSE_BEFORE_SUBMIT','QUEST_PRIORITY','HEADLESS','KEEP_BROWSER_OPEN','CLAIM_REWARDS','ERC_THRESHOLD']
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

async function createBrowser(headless) {
  const browser = await puppeteer.launch({
    headless,
    args: process.env.CHROME_NO_SANDBOX === 'true' ? ["--no-sandbox"] : ['--disable-web-security',
      '--disable-features=IsolateOrigins',
      ' --disable-site-isolation-trials'],
  });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(500000);
  await page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1, });
  return browser;
}

async function startBotPlayMatch(page, myCards,user) {
  var battlesList = await getBattles();
  var scores = teamScores(battlesList,process.env.ACCOUNT);
  log(process.env.ACCOUNT, ' deck size: '+Object.keys(myCards).length)

  await page.waitForTimeout(10000);
  const {mana_cap, ruleset, inactive, opponent_player,} = await SM.battle('Ranked')

  const teamsToPlay = playableTeams(scores,process.env.ACCOUNT,{mana_cap,ruleset,inactive,quest:user.quest},myCards);

  //TEAM SELECTION
  //Can do further analysin on teamsToPlay
  const [Summoner,...Monsters] = teamsToPlay[0].team;
  const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  log('teamsToPlay.length',teamsToPlay.length);
  log('Summoner:',cards[Summoner[0]-1].name,'Level:',Summoner[1]);
  Monsters.forEach(m=>log('Monster:',cards[m[0]-1].name,'Level:',m[1]));

  await page.waitForTimeout(10000);
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

    await getBattles(opponent_player);
    await page.evaluate('SM.Player').then(Player=>{
      user.won = Player.rating-user.rating;
      user.decWon = null;
      if(user.won>0){
        log(chalk.green('Won!!!'));
        user.decWon = (Player.balances.find(t=>t.token=='DEC')?.balance-user.dec).toFixed(3);
        user.w++
      }else user.won<0?user.l++:user.d++;
      log('Updated Rating after battle is ' + chalk.yellow(Player.rating));
      user.rating=Player.rating;
    })
  } catch (e) {
    log('failed to submit team, so waiting for user to input manually and close the session')
    await sleep(123456);
    throw new Error(e);
  }
}

// 30 MINUTES INTERVAL BETWEEN EACH MATCH (if not specified in the .env file)
const sleepingTimeInMinutes = process.env.MINUTES_BATTLES_INTERVAL || 30;
const sleepingTime = sleepingTimeInMinutes * 60000;

const preMatch=(__sm)=>{
  const _return = {};
  const ercThreshold = process.env.ERC_THRESHOLD;
  const Player = __sm.Player,settings = __sm.settings;
  _return.dec = Player.balances.find(t=>t.token=='DEC')?.balance
  const erc = Math.floor(Math.min((isNaN(parseInt(Player.capture_rate)) ? 1e4 : Player.capture_rate) + (Date.now() - new Date(Player.last_reward_time)) / 3e3 * settings.dec.ecr_regen_rate, 1e4)/100)
  log('Current Energy Capture Rate is ' + (erc>ercThreshold?chalk.green(erc + "%"):chalk.red(erc + "%")));
  _return.erc = erc;
  _return.rating = Player.rating;
  log('Current Rating is ' + chalk.yellow(Player.rating));
  _return.claimSeasonReward = process.env.CLAIM_SEASON_REWARD === 'true'&&Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;

  //if quest done claim reward
  _return.claimQuestReward = [];
  if (Player.quest&&!Player.quest.claim_trx_id){
    const {name,completed_items,total_items,rewards}=Player.quest;
    const quest = settings.quests.find(q=>q.name==name)
    if(2*Math.random()<1&&JSON.parse(process.env.QUEST_PRIORITY)) _return.quest = {type:quest.objective_type,color:quest.data.color,value:quest.data.value};
    if(completed_items<=total_items)log('Quest details:'+chalk.yellow(name,'->',completed_items,'/',total_items));
    if(completed_items>=total_items){
      _return.claimQuestReward.push(Player.quest,quest);
      delete _return.quest;
    }
  }
  return _return;
}
;(async () => {
  try {
    await checkForMissingConfigs();
    const headless = JSON.parse(process.env.HEADLESS.toLowerCase());
    const keepBrowserOpen = JSON.parse(process.env.KEEP_BROWSER_OPEN.toLowerCase());
    const claimRewards = JSON.parse(process.env.CLAIM_REWARDS.toLowerCase());
    let users = process.env.ACCOUNT.split(',').map((account,i)=>{return {
      account,
      password:process.env.PASSWORD.split(',')[i],
      login:process.env?.EMAIL?.split(',')[i],
      w:0,l:0,d:0,
    }})
    log('Opening a browser');
    let browser = await createBrowser(headless);

    while (true) {
      await checkForUpdate();
      for (const user of users) {
        process.env['LOGIN'] = user.login || user.account
        process.env['PASSWORD'] = user.password
        process.env['ACCOUNT'] = user.account

        if(!browser) browser = await createBrowser(headless);
        const page = (await browser.pages())[1];
        log('//debug');
        await page.goto('https://splinterlands.com/');
        SM._(page);
        // Login
        let username = await page.evaluate('SM?.Player?.name');
        if (username != process.env.ACCOUNT) await SM.login(process.env.LOGIN,process.env.PASSWORD)
        await page.evaluate(()=>SM.ShowBattleHistory());
        await page.evaluate(()=>{return {Player:SM.Player,settings:SM.settings}})
          .then(preMatch).then(r=>Object.keys(r).forEach(k=>user[k]=r[k]))
        if(claimRewards){
          if(user.claimSeasonReward)                         await page.evaluate(()=>claim());
          if(user.claimQuestReward?.filter(x=>x)?.length==2) await SM.questClaim(...user.claimQuestReward)
        }
        if(user.erc>process.env.ERC_THRESHOLD){
          log('getting user cards collection from splinterlands API...')
          const myCards = await getCards()
            .then((x)=>{log('cards retrieved'); return x})
            .catch(() => log('cards collection api didnt respond. Did you use username? avoid email!'));
          await startBotPlayMatch(page, myCards, user)
            .then(() => { log('Closing battle'); }) .catch(log)
        }
        await page.evaluate('SM.Logout()');
      }

      console.log(table([['account','dec','erc','rating','won','decWon','w','l','d'],...users.map(u=>['account','dec','erc','rating','won','decWon','w','l','d'].map(t=>u[t]))]));
      log('Waiting for the next battle in',sleepingTime/1000/60,'minutes at',new Date(Date.now()+sleepingTime).toLocaleString());
      log('--------------------------End of Battle--------------------------------');
      //if(!keepBrowserOpen)browser.close();
      await sleep(sleepingTime);
    }
  } catch (e) {
    log('Routine error at: ', new Date().toLocaleString(), e)
  } })()
