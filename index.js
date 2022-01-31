//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');

const SM = require('./splinterApi');
const {playableTeams} = require('./score');
const battles = require('./battles-data');
const {_card, log, _team, _arr,_func:{retryFor}, sleep,_dbug:{table,tt}} = require('./util');
const args = require('minimist')(process.argv.slice(2));

// Logging function with save to a file
var _file='log.txt';
const util = require('util');
const logFile = require('fs').createWriteStream(_file,{flags:'w'});
const formatEd =(...x)=> util.formatWithOptions({colors:true},...x)
console.log = function () {
  process.stdout.write(formatEd.apply(null, arguments) + '\n');
  logFile.write(util.format.apply(null,arguments).replace(/\033\[[0-9;]*m/g,"") + '\n');
}

const focusQueue = [];
let queueStarted = false;
function requestFocus(page) {
  return new Promise(resolve => {
    focusQueue.push(() => {
      queueStarted = true;
      page.bringToFront();
      resolve(dequeue);
    });
    // do first dequeue if queue was empty
    if (!queueStarted) dequeue();
  });
}

function dequeue() {
  const nextFocus = focusQueue.shift();
  if (nextFocus) nextFocus(); else queueStarted = false;
}

let __goOn=1;
const sleepingTime = 6e4 * (args.i ?? process.env.MINUTES_BATTLES_INTERVAL ?? 27);

async function checkForUpdate() {
  await require('async-get-json')('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
    .then(async v=>{
      const gitVersion = v.version.replace(/(\.0+)+$/,'').split('.');
      const version = require('./package.json').version.replace(/(\.0+)+$/,'').split('.');
      if(_arr.checkVer(gitVersion,version)){
        const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
        const question = util.promisify(rl.question).bind(rl);
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
  await [['ACCOUNT'],['PASSWORD'],['PAUSE_BEFORE_SUBMIT','p'],['ERC_THRESHOLD','e']]
    .reduce((memo,[e,a])=>memo.then(async()=>{
      process.env[e]=args[a]??process.env[e];
      if (!process.env[e]) {
        log(`Missing ${e} parameter in .env - see updated .env-example!`);
        await sleep(60000);
      }else if(!e.includes('PASSWORD')) log(`${e}:`,process.env[e]);
    }),Promise.resolve())
}
async function getBattles(player) {
  const cl = 55;
  if(process.env.UPDATE_BATTLE_DATA)
    return battles.fromUsers(player,{cl})
  else {
    const blNew = battles.fromUsers(player,{fn:'-new',cl});
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
  await browser.defaultBrowserContext().overridePermissions('https://splinterlands.com/',['notifications']);
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(5e5);
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1, });
  return browser;
}
const postBattle=user=>battle=>{
  user.won = battle.winner==user.account?1:battle.winner=='DRAW'?0:-1;
  if(user.won>0){
    log({Result:'Won!!!'+Array(battle.current_streak).fill('_.~"(')});
    user.decWon = Number((user.decWon+Number.parseFloat(battle.reward_dec)).toFixed(3));
    user.isRanked?user.w++:user.w_p++;
  }else user.won<0?user.isRanked?user.l++:user.l_p++:user.isRanked?user.d++:user.d_p++;
  user.netWon+=user.won;
}
async function teamSelection(teamToPlay,{page,inactive,ruleset,notifyUser}){
  const {team:[Summoner,...Monsters],...Stats} = teamToPlay;
  if(!ruleset.includes('Taking Sides')){
    const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  }
  table([...teamToPlay.team.map(([Id,Lvl])=>({[_card.type(Id)]:_card.name(Id),Id,Lvl}))]);
  table({Stats});
  if(notifyUser)await page.evaluate(`var n=new Notification('Battle Ready');
      n.addEventListener('click',(e)=>{window.focus();e.target.close();},false);`);
  await page.waitForSelector(`[card_detail_id="${Summoner[0]}"] `,{timeout:1001}).catch(()=>page.reload()
    .then(()=>sleep(5000)).then(()=>page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)')))
  await retryFor(3,3000,!__goOn,async()=>page.click(`[card_detail_id="${Summoner[0]}"] img`).then(()=>
    page.waitForSelector('.item--summoner.item--selected',{timeout:1e3})
  ))
  if (_card.color(Summoner) === 'Gold') {
    const splinter = _team.splinter(teamToPlay.team,inactive); log({splinter});
    await retryFor(3,3000,!__goOn,async()=>page.click(`[data-original-title="${splinter}"] label`))
  }
  for(const[mon]of Monsters){
    //log({[`Playing ${_card.name(mon)}`]:mon})
    await retryFor(3,3000,__goOn,async()=>page.click(`[card_detail_id="${mon}"] img`))
  }
  if(notifyUser)await sleep(Math.min(60,Math.abs(process.env.PAUSE_BEFORE_SUBMIT))*999);
  await retryFor(3,300,__goOn,async()=>page.click('.btn-green')).catch(log);
  log('Team submitted, Waiting for opponent');
}
async function startBotPlayMatch(page,user) {
  const {mana_cap, ruleset, inactive, opponent_player,} = await SM.battle(user.isRanked?'Ranked':'Practice')
  const myCards = await SM.cards(user.account).then(cards2Obj(user.account))
    .then(c=>Object.fromEntries(Object.entries(c).filter(x=>!inactive.includes(_card.color(x)))))
    .catch(e => log(e,'cards collection api didnt respond. Did you use username? avoid email!')??{});
  const oppCards = await SM.cards(opponent_player).then(cards2Obj(opponent_player))
    .then(c=>Object.fromEntries(Object.entries(c).filter(x=>!inactive.includes(_card.color(x)))))
    .catch(e=>log(e,'Opp Cards Failed')??{})
  table([{mana_cap, ruleset, inactive,...user.quest,[`${user.account} Deck`]:Object.keys(myCards).length,[`${opponent_player} Deck`]:Object.keys(oppCards).length}])
  if(Object.keys(oppCards).length)table(__oppDeck=Object.entries(oppCards).map(([Id,Lvl])=>{
    return{[_card.type(Id).slice(0,3)]:_card.name(Id),Id,Lvl,[_card.color(Id).slice(0,2)]:_card.abilities([Id,Lvl]).join()}})
    .sort((a,b)=>('Mon'in a)-('Mon'in b)))
  var battlesList =await getBattles(opponent_player).catch(e=>{log(e);return require('./data/battle_data.json')});
  const pt = playableTeams(battlesList,{mana_cap,ruleset,inactive,quest:user.quest,oppCards,myCards,sortByWinRate:user.isStarter||!user.isRanked});
  table(pt.slice(0,5).map(({team,...s})=>({...team.map(c=>_card.name(c)+c[1]),...s})));
  const teamToPlay = pt[0];
  // team Selection
  const rf = await requestFocus(page);
  await teamSelection(teamToPlay,{page,ruleset,inactive,notifyUser:!process.env.HEADLESS&&user.isRanked&&!user.isStarter}); // Eof teamSelection
  await Promise.any([
    page.waitForSelector('#btnRumble', { timeout: 16e4 })
    .then(()=>page.evaluate(`startFightLoop();localStorage.setItem('sl:battle_speed', 6)`))
    .then(()=>process.env.SKIP_REPLAY||
      page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(2e3*mana_cap)})),
    page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(3e5)}),
  ]).then(()=>page.evaluate('SM.CurrentView.data').then(postBattle(user)))
    .catch(() => log('Wrapping up Battle'));
  rf();
}
const calculateECR=({capture_rate, last_reward_time},{dec})=>
  Math.min(10000,(parseInt(capture_rate) || 10000) + (Date.now() - new Date(last_reward_time)) / 3000 * dec.ecr_regen_rate)/100;
const preMatch=user=>({Player,settings})=>{
  user.dec = Player.balances.find(x=>x.token=='DEC')?.balance
  const erc = calculateECR(Player,settings);
  user.erc = erc;
  user.rating = Player.rating;
  user.isStarter = !Player.starter_pack_purchase;
  user.cp = Player.collection_power;
  user.claimSeasonReward =
    process.env.CLAIM_SEASON_REWARD && Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;
  user.isRanked = user.isStarter||erc>81&&user.rating<400||erc>(args.e??process.env.ERC_THRESHOLD)||
    args.t-Date.now()>(99.81-erc)*3e5/settings.dec.ecr_regen_rate

  //if quest done claim reward
  user.claimQuestReward = [];
  user.quest = 0;
  if (Player.quest&&!Player.quest.claim_trx_id){
    var {name,completed_items,total_items}=Player.quest;
    const quest = settings.quests.find(x=>x.name==name)
    if(completed_items<total_items){
      if((Number(args.q)||3)*Math.random()<1&&process.env.QUEST_PRIORITY)
        user.quest = {type:quest.objective_type,color:quest.data.color,value:quest.data.value};
    }
    if(completed_items>=total_items){
      user.claimQuestReward.push(Player.quest,quest);
      user.quest = 0;
    }
  }
  table([{Rating:Player.rating,ECRate:erc,t:(args.t-Date.now())/36e5,et:(user.et=(100-erc)/12/settings.dec.ecr_regen_rate),...(completed_items&&{Quest:name,completed_items,total_items})}]);
}
const cards2Obj=acc=>cards=>Object.fromEntries(cards.map(card=>
  card.owned.filter(owned=>
    !(owned.market_id && owned.market_listing_status === 0) &&
    (!owned.delegated_to || owned.delegated_to === acc) &&
    (!(owned.last_used_player!==acc&&Date.parse(owned.last_used_date)>Date.now()-86400000))
  ).map(owned=>[card.id,owned.level]).sort((a,b)=>a[1]-b[1])
).flat())
;(async () => {
  await checkForMissingConfigs();
  for(let [env,arg] of [['CLOSE_AFTER_ERC','c'],['SKIP_REPLAY','sr'],['HEADLESS','h'],['KEEP_BROWSER_OPEN'],['SKIP_PRACTICE','sp'],['QUEST_PRIORITY'],['CLAIM_SEASON_REWARD'],['CLAIM_REWARDS'],['UPDATE_BATTLE_DATA','ubd']])
    process.env[env]=(args[arg]??JSON.parse(process.env[env]?.toLowerCase()??false))||'';
  const tableList =['account','erc','et','won','cp','dec','rating','netWon','decWon','w','l','d',/*'w_p','l_p','d_p'*/], toDay = new Date().toDateString();
  const userData=require('./data/user_data.json');
  let users = process.env.ACCOUNT.split(',').map((account,x)=>{
    const u = (userData[toDay]??={})?.[account];
    if(!(args.su??process.env.SKIP_USERS??'').split(',').includes(account))return{
      account,
      password:process.env.PASSWORD.split(',')[x],
      login:process.env?.EMAIL?.split(',')[x],
      w:u?.w??0,l:u?.l??0,d:u?.d??0,w_p:0,l_p:0,d_p:0,won:0,decWon:u?.decWon??0,netWon:u?.netWon??0,
      erc:100,rating:u?.rating??0,dec:u?.dec??0,isStarter:0,isRanked:1,claimQuestReward:[],claimSeasonReward:0,
    }
  }).filter(x=>x);
  if('t'in args)args.t = args.t*60*60000+Date.now();
  log('Opening a browser');
  let browser = await createBrowser(process.env.HEADLESS);
  let page = (await browser.pages())[1];

  while (true) {
    await checkForUpdate();
    for (const user of users.filter(u=>!process.env.SKIP_PRACTICE||u.isRanked)) {
      if(browser.process().killed){
        browser = await createBrowser(process.env.HEADLESS);
        page = (await browser.pages())[1];
      }
      await page.goto('https://splinterlands.com/');
      SM._(page);
      await SM.login(user.login || user.account,user.password)
      await page.evaluate('SM.ShowBattleHistory()'); await sleep(1729);
      await SM.cards(user.account)
      await page.evaluate('Object.assign({},{Player:SM.Player,settings:SM.settings})').then(preMatch(user))
      if(process.env.CLAIM_REWARDS){
        if(user.claimSeasonReward)                         await page.evaluate('claim()');
        if(user.claimQuestReward?.filter(x=>x)?.length==2) await SM.questClaim(...user.claimQuestReward)
      }
      if(!process.env.SKIP_PRACTICE||user.isRanked)await startBotPlayMatch(page,user).then(()=>console.log({
        '      ':'['+Array(9).fill('    ').join(' ')+'>','<        ':'|(xxxxx)'})).catch(async e=>{
        log(e,'failed to submit team, so waiting for user to input manually and close the session')
        await sleep(1.6e4);
        throw e;//can we continue here without throwing error
      })
      await page.evaluate('SM.Logout()');
    }
    table(users.map(u=>Object.fromEntries(tableList.map((x,i)=>[x,i>3?((userData[toDay][u.account]??={})[x]=u[x]):u[x]]))));
    require('jsonfile').writeFileSync('./data/user_data.json',userData);
    if(!process.env.KEEP_BROWSER_OPEN)browser.close();
    await battles.fromUsers(users.filter(u=>!process.env.SKIP_PRACTICE||u.isRanked).map(user=>user.account),{depth:1});
    log('Waiting for the next battle in',sleepingTime/1000/60,'minutes at',new Date(Date.now()+sleepingTime).toLocaleString());
    log('--------------------------End of Session--------------------------------\n\n');
    if(process.env.CLOSE_AFTER_ERC&&users.every(x=>x.isStarter||!x.isRanked)){ await browser.close(); break; }
    await sleep(sleepingTime);
  }
})()
