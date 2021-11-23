//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');
const chalk = require('chalk');
const {table} = require('table');

const {SM} = require('./splinterApi');
const {playableTeams} = require('./score');
const battles = require('./battles-data');
const {_card, _team, _arr,_func, sleep,} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);

let _count = 1,__continue=1;
const sleepingTime = 60000 * (process.env.MINUTES_BATTLES_INTERVAL || 30);

async function checkForUpdate() {
  await require('async-get-json')('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
    .then(async v=>{
      const gitVersion = v.version.replace(/(\.0+)+$/,'').split('.');
      const version = require('./package.json').version.replace(/(\.0+)+$/,'').split('.');
      if(_arr.checkVer(gitVersion,version)){
        const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
        const question = require('util').promisify(rl.question).bind(rl);
        log(gitVersion.join('.'),version.join('.'))
        let answer = await question("Newer version exists!!!\nDo you want to continue? (y/N)")
        log({'Note!!':require('./package.json').description})
        if(answer.match(/y/gi)) log('Continuing with older version');
        else if(answer.match(/n/gi)) throw new Error('git pull or get newer version');
        else throw new Error('choose correctly');
      }
    })
}
async function checkForMissingConfigs() {
  await ['ACCOUNT','UPDATE_BATTLE_DATA','PASSWORD','PAUSE_BEFORE_SUBMIT','QUEST_PRIORITY','HEADLESS','KEEP_BROWSER_OPEN','CLAIM_REWARDS','ERC_THRESHOLD']
    .reduce((memo,e)=>memo.then(async()=>{
      if (!process.env[e]) {
        log(`Missing ${e} parameter in .env - see updated .env-example!`);
        await sleep(60000);
      }else if(!e.includes('PASSWORD')) log(`${e}:`,process.env[e]);
    }),Promise.resolve())
}
async function getBattles(player=process.env.ACCOUNT) {
  if(process.env.UPDATE_BATTLE_DATA)
    return battles.fromUser(player)
  else {
    const blNew = battles.fromUser(player,'-new');
    const bl = require('./data/battle_data.json');
    battles.merge(bl,blNew);
    return bl;
  }
}
async function createBrowser(headless) {
  const browser = await puppeteer.launch({
    headless,
    args: process.env.CHROME_NO_SANDBOX === 'true' ? ["--no-sandbox"] : ['--disable-web-security',
      '--disable-features=IsolateOrigins',
      ' --disable-site-isolation-trials'],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(500000);
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1, });
  return browser;
}
async function startBotPlayMatch(page, myCards,user) {
  log({account:process.env.ACCOUNT,'deck size':Object.keys(myCards).length})

  await page.waitForTimeout(10000);
  const {mana_cap, ruleset, inactive, opponent_player,} = await SM.battle(user.isRanked?'Ranked':'Practice')

  log({mana_cap, ruleset, inactive,quest:user.quest, opponent_player,})
  var battlesList = await getBattles(opponent_player)
    .catch(e=>{log(e);return require('./data/battle_data.json')});
  const teamsToPlay = playableTeams(battlesList,{mana_cap,ruleset,inactive,quest:user.quest},myCards,{sortByWinRate:!user.isRanked});

  //TEAM SELECTION
  //Can do further analysin on teamsToPlay
  log('teamsToPlay.length',teamsToPlay.length);
  const {team:[Summoner,...Monsters],...Stats} = teamsToPlay[0];
  if(!ruleset.includes('Taking Sides')){
    const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  }
  log({team:[...teamsToPlay[0].team.map(([Id,Lvl])=>{return{[_card.type(Id)]:_card.name(Id),Id,Lvl}})],Stats})

  await _func.retryFor(3,3000,!__continue,async()=>
    page.waitForXPath(`//div[@card_detail_id="${Summoner[0]}"]`,{timeout:1000}).then(btn=>btn.click()))
  if (_card.color(Summoner) === 'Gold') {
    log('Dragon play TEAMCOLOR', _team.splinter(teamsToPlay[0],inactive))
    await _func.retryFor(3,3000,!__continue,async()=>
      page.waitForXPath(`//div[@data-original-title="${_team.splinter(teamsToPlay[0],inactive)}"]`,{timeout:10000}).then(btn=>btn.click()))
  }
  //await page.waitForTimeout(5000);
  for(const [mon] of Monsters.values()){
    log({[`Playing ${_card.name(mon)}`]:mon})
    await _func.retryFor(3,3000,__continue,async()=>
      page.waitForXPath(`//div[@card_detail_id="${mon}"]`,{timeout:10000}).then(btn=>btn.click()))
  }
  if(!process.env.HEADLESS&&user.isRanked)
    await sleep(Math.min(60,Math.abs(process.env.PAUSE_BEFORE_SUBMIT))*999);
  await _func.retryFor(3,300,__continue,async()=>page.click('.btn-green')[0]);
  log('Team submitted, Waiting for opponent');
  await page.waitForSelector('#btnRumble', { timeout: 160000 }).then(() => log('btnRumble visible')).catch(() => log('btnRumble not visible'));
  await page.waitForTimeout(5000);
  await page.$eval('#btnRumble', elem => elem.click()).then(()=>log('btnRumble clicked')).catch(()=>log('btnRumble didnt click')); //start rumble
  await page.evaluate('SM.CurrentView.data').then(battle=>{
    user.won = battle.winner==user.account?1:battle.winner=='DRAW'?0:-1;
    user.decWon = null;
    if(user.won>0){
      log(chalk.green('Won!!!'));
      user.decWon = battle.reward_dec;
      user.isRanked?user.w++:user.w_p++;
    }else user.won<0?user.isRanked?user.l++:user.l_p++:user.isRanked?user.d++:user.d_p++;
    //log('Updated Rating after battle is ' + chalk.yellow(Player.rating)); user.rating=Player.rating;
  })
  await page.waitForSelector('#btnSkip', { timeout: 10000 }).then(()=>log('btnSkip visible')).catch(()=>log('btnSkip not visible'));
  await page.$eval('#btnSkip', elem => elem.click()).then(()=>log('btnSkip clicked')).catch(()=>log('btnSkip not visible')); //skip rumble
}
const preMatch=({Player,settings})=>{
  const _return = {};
  const ercThreshold = process.env.ERC_THRESHOLD;
  _return.dec = Player.balances.find(t=>t.token=='DEC')?.balance
  const erc = Math.floor(Math.min((isNaN(parseInt(Player.capture_rate)) ? 1e4 : Player.capture_rate) + (Date.now() - new Date(Player.last_reward_time)) / 3e3 * settings.dec.ecr_regen_rate, 1e4)/100)
  log('Current Energy Capture Rate is ' + (erc>ercThreshold?chalk.green(erc + "%"):chalk.red(erc + "%")));
  _return.erc = erc;
  _return.rating = Player.rating;
  log('Current Rating is ' + chalk.yellow(Player.rating));
  _return.claimSeasonReward =
    process.env.CLAIM_SEASON_REWARD && Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;

  //if quest done claim reward
  _return.claimQuestReward = [];
  _return.quest = 0;
  if (Player.quest&&!Player.quest.claim_trx_id){
    const {name,completed_items,total_items}=Player.quest;
    const quest = settings.quests.find(q=>q.name==name)
    if(completed_items<total_items){
      log('Quest details:'+chalk.yellow(name,'->',completed_items,'/',total_items));
      if(2*Math.random()<1&&process.env.QUEST_PRIORITY)
        _return.quest = {type:quest.objective_type,color:quest.data.color,value:quest.data.value};
    }
    if(completed_items>=total_items){
      _return.claimQuestReward.push(Player.quest,quest);
      _return.quest = 0;
    }
  }
  return _return;
}
;(async () => {
  await checkForMissingConfigs();
  for(let env of ['HEADLESS','KEEP_BROWSER_OPEN','QUEST_PRIORITY',/*'CLAIM_SEASON_REWARD',*/'CLAIM_REWARDS','UPDATE_BATTLE_DATA'])
    process.env[env]=JSON.parse(process.env[env].toLowerCase())||'';
  let users = process.env.ACCOUNT.split(',').map((account,i)=>{return {
    account,
    password:process.env.PASSWORD.split(',')[i],
    login:process.env?.EMAIL?.split(',')[i],
    w:0,l:0,d:0,w_p:0,l_p:0,d_p:0,
  }})
  log('Opening a browser');
  let browser = await createBrowser(process.env.HEADLESS);
  let page = (await browser.pages())[1];

  while (true) {
    await checkForUpdate();
    for (const user of users) {
      process.env.LOGIN = user.login || user.account
      process.env.PASSWORD = user.password
      process.env.ACCOUNT = user.account

      if((browser.process().killed)){
        browser = await createBrowser(process.env.HEADLESS);
        page = (await browser.pages())[1];
      }
      //log('//debug');
      await page.goto('https://splinterlands.com/');
      SM._(page);
      await SM.login(process.env.LOGIN,process.env.PASSWORD)
      await page.evaluate(()=>SM.ShowBattleHistory());
      await page.evaluate(()=>{return {Player:SM.Player,settings:SM.settings}})
        .then(preMatch).then(r=>Object.keys(r).forEach(k=>user[k]=r[k]))
      if(process.env.CLAIM_REWARDS){
        if(user.claimSeasonReward)                         await page.evaluate(()=>claim());
        if(user.claimQuestReward?.filter(x=>x)?.length==2) await SM.questClaim(...user.claimQuestReward)
      }
      user.isRanked = user.rating<400||user.erc>process.env.ERC_THRESHOLD
      log('getting user cards collection from splinterlands API...')
      const myCards = await SM.cards()
        .then(cards => cards.map(c=>
          c.owned.filter(o =>
            !(o.market_id && o.market_listing_status === 0) &&
            (!o.delegated_to || o.delegated_to === process.env.ACCOUNT) &&
            (!(o.last_used_player!==process.env.ACCOUNT&&Date.parse(o.last_used_date)>Date.now()-86400000))
          ).map(o=>[c.id,o.level]).sort((a,b)=>a[1]-b[1])).flat()
        )
        .then(entries => Object.fromEntries(entries))
        .then((x)=>{log('cards retrieved'); return x})
        .catch((e) => log(e,'cards collection api didnt respond. Did you use username? avoid email!'));
      await startBotPlayMatch(page,myCards,user).then(()=>log('Closing battle')).catch(async e=>{
        log(e)
        log('failed to submit team, so waiting for user to input manually and close the session')
        await sleep(163456);
        throw e;
      })
      await page.evaluate('SM.Logout()');
    }

    const table_list = ['account','dec','erc','cp','rating','won','decWon','w','l','d','w_p','l_p','d_p'];
    console.log(table([table_list, ...users.map(u=>table_list.map(t=>u[t]))]));
    log('Waiting for the next battle in',sleepingTime/1000/60,'minutes at',new Date(Date.now()+sleepingTime).toLocaleString());
    log('--------------------------End of Battle--------------------------------');
    if(!process.env.KEEP_BROWSER_OPEN)browser.close();
    await sleep(sleepingTime);
    if(_count++>27*Math.random())
      battles.fromUserList(users.map(u=>u.account),process.env.UPDATE_BATTLE_DATA?'':'-new')&&(_count=0);
  }
})()
