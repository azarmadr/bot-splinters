//'use strict';
require('dotenv').config()
const puppeteer = require('puppeteer');

const SM = require('./splinterApi');
const {playableTeams} = require('./score');
const battles = require('./battles-data');
const {_card, _team, _arr,_func, sleep,_dbug} = require('./helper');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const args = require('minimist')(process.argv.slice(2));

let __goOn=1;
const sleepingTime = 60000 * (args.bi ?? process.env.MINUTES_BATTLES_INTERVAL ?? 27);

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
  await [['ACCOUNT'],['PASSWORD'],['PAUSE_BEFORE_SUBMIT','p'],['ERC_THRESHOLD','e']]
    .reduce((memo,[e,a])=>memo.then(async()=>{
      process.env[e]=args[a]??process.env[e];
      if (!process.env[e]) {
        log(`Missing ${e} parameter in .env - see updated .env-example!`);
        await sleep(60000);
      }else if(!e.includes('PASSWORD')) log(`${e}:`,process.env[e]);
    }),Promise.resolve())
}
async function getBattles(player=process.env.ACCOUNT) {
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
  page.setDefaultNavigationTimeout(500000);
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1, });
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
//async function teamSelection(teamToPlay,{page,inactive,ruleset,notifyUser}){ }
async function startBotPlayMatch(page,user) {
  const {mana_cap, ruleset, inactive, opponent_player,} = await SM.battle(user.isRanked?'Ranked':'Practice')
  const myCards = await SM.cards(process.env.ACCOUNT).then(cards2Obj(process.env.ACCOUNT))
    .then(c=>Object.fromEntries(Object.entries(c).filter(i=>!inactive.includes(_card.color(i)))))
    .catch(e => log(e,'cards collection api didnt respond. Did you use username? avoid email!')??{});
  const oppCards = await SM.cards(opponent_player).then(cards2Obj(opponent_player))
    .then(c=>Object.fromEntries(Object.entries(c).filter(i=>!inactive.includes(_card.color(i)))))
    .catch(e=>log(e,'Opp Cards Failed')??{})
  log({mana_cap, ruleset, inactive,quest:user.quest,[`${process.env.ACCOUNT} Deck`]:Object.keys(myCards).length,[`${opponent_player} Deck`]:Object.keys(oppCards).length})
  if(Object.keys(oppCards).length)_dbug.table(__oppDeck=Object.entries(oppCards).map(([Id,Lvl])=>{
    return{[_card.type(Id).slice(0,3)]:_card.name(Id),Id,Lvl,[_card.color(Id).slice(0,2)]:_card.abilities([Id,Lvl]).join()}})
    .sort((a,b)=>('Mon'in a)-('Mon'in b)))
  var battlesList =await getBattles(opponent_player).catch(e=>{log(e);return require('./data/battle_data.json')});
  const teamToPlay = playableTeams(battlesList,
    {mana_cap,ruleset,inactive,quest:user.quest,oppCards,myCards,sortByWinRate:user.isStarter||!user.isRanked})[0];
  // team Selection await teamSelection(teamToPlay,{page,ruleset,inactive,notifyUser:!process.env.HEADLESS&&user.isRanked&&!user.isStarter});
  const notifyUser=!process.env.HEADLESS&&user.isRanked&&!user.isStarter;
  const {team:[Summoner,...Monsters],...Stats} = teamToPlay;
  if(!ruleset.includes('Taking Sides')){
    const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  }
  _dbug.table([...teamToPlay.team.map(([Id,Lvl])=>{return{[_card.type(Id)]:_card.name(Id),Id,Lvl}})]);
  _dbug.table({Stats});
  if(notifyUser)await page.evaluate(`var n=new Notification('Battle Ready');
      n.addEventListener('click',(e)=>{window.focus();e.target.close();},false);`);
  await page.waitForSelector(`[card_detail_id="${Summoner[0]}"] `,{timeout:1001}).catch(()=>page.reload()
    .then(()=>sleep(5000)).then(()=>page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)')))
  await _func.retryFor(3,3000,!__goOn,async()=>page.click(`[card_detail_id="${Summoner[0]}"] img`))
  if (_card.color(Summoner) === 'Gold') {
    const splinter = _team.splinter(teamToPlay.team,inactive);
    log({splinter});
    await _func.retryFor(3,3000,!__goOn,async()=>page.click(`[data-original-title="${splinter}"] label`))
  }
  for(const[mon]of Monsters){
    log({[`Playing ${_card.name(mon)}`]:mon})
    await _func.retryFor(3,3000,__goOn,async()=>page.click(`[card_detail_id="${mon}"] img`))
  }
  if(notifyUser)await sleep(Math.min(60,Math.abs(process.env.PAUSE_BEFORE_SUBMIT))*999);
  await _func.retryFor(3,300,__goOn,async()=>page.click('.btn-green')).catch(log);
  log('Team submitted, Waiting for opponent');
  // Eof TeamSelection
  await Promise.any([
    page.waitForSelector('#btnRumble', { timeout: 160000 })
    .then(()=>page.evaluate(`startFightLoop();localStorage.setItem('sl:battle_speed', 6)`))
    .then(()=>process.env.SKIP_REPLAY||
      page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(1999*mana_cap)})),
    page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(60000*5)}),
  ]).then(()=>page.evaluate('SM.CurrentView.data').then(postBattle(user)))
    .catch(() => log('Wrapping up Battle'));
}
const calculateECR=({capture_rate, last_reward_time},{dec})=>
  Math.min(10000,(parseInt(capture_rate) || 10000) + (Date.now() - new Date(last_reward_time)) / 3000 * dec.ecr_regen_rate)/100;
const preMatch=({Player,settings})=>{
  const _return = {};
  _return.dec = Player.balances.find(x=>x.token=='DEC')?.balance
  const erc = calculateECR(Player,settings);
  _return.erc = erc;
  _return.rating = Player.rating;
  _return.isStarter = !Player.starter_pack_purchase;
  _return.cp = Player.collection_power;
  _return.claimSeasonReward =
    process.env.CLAIM_SEASON_REWARD && Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;
  _return.isRanked = _return.isStarter||erc>75&&_return.rating<400||erc>(args.e??process.env.ERC_THRESHOLD)||
    args.t-Date.now()>(100-erc)*3e5/settings.dec.ecr_regen_rate
  _dbug.table({_:{'Current Rating':Player.rating,'Current ECRate':erc,t:(args.t-Date.now())/36e5,et:(100-erc)/12/settings.dec.ecr_regen_rate}});

  //if quest done claim reward
  _return.claimQuestReward = [];
  _return.quest = 0;
  if (Player.quest&&!Player.quest.claim_trx_id){
    const {name,completed_items,total_items}=Player.quest;
    const quest = settings.quests.find(q=>q.name==name)
    if(completed_items<total_items){
      log({'Quest details':{completed_items,total_items}});
      if((Number(args.q)||3)*Math.random()<1&&process.env.QUEST_PRIORITY)
        _return.quest = {type:quest.objective_type,color:quest.data.color,value:quest.data.value};
    }
    if(completed_items>=total_items){
      _return.claimQuestReward.push(Player.quest,quest);
      _return.quest = 0;
    }
  }
  return _return;
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
  let users = process.env.ACCOUNT.split(',').map((account,i)=>{
    if(!(args.su??process.env.SKIP_USERS??'').split(',').includes(account))return{
        account,
        password:process.env.PASSWORD.split(',')[i],
        login:process.env?.EMAIL?.split(',')[i],
        w:0,l:0,d:0,w_p:0,l_p:0,d_p:0,won:0,decWon:0,netWon:0,
        erc:100,rating:0,isStarter:0,isRanked:1,claimQuestReward:[],claimSeasonReward:0,
      }
  }).filter(x=>x);
  if('t'in args)args.t = args.t*60*60000+Date.now();
  log('Opening a browser');
  let browser = await createBrowser(process.env.HEADLESS);
  let page = (await browser.pages())[1];

  while (true) {
    await checkForUpdate();
    for (const user of users.filter(u=>!process.env.SKIP_PRACTICE||u.isRanked)) {
      process.env.LOGIN = user.login || user.account
      process.env.PASSWORD = user.password
      process.env.ACCOUNT = user.account

      if((browser.process().killed)){
        browser = await createBrowser(process.env.HEADLESS);
        page = (await browser.pages())[1];
      }
      await page.goto('https://splinterlands.com/');
      SM._(page);
      await SM.login(process.env.LOGIN,process.env.PASSWORD)
      await page.evaluate('SM.ShowBattleHistory()'); await sleep(1729);
      await page.evaluate('Object.assign({},{Player:SM.Player,settings:SM.settings})')
        .then(preMatch).then(r=>Object.keys(r).forEach(k=>user[k]=r[k]))
      if(process.env.CLAIM_REWARDS){
        if(user.claimSeasonReward)                         await page.evaluate('claim()');
        if(user.claimQuestReward?.filter(x=>x)?.length==2) await SM.questClaim(...user.claimQuestReward)
      }
      if(!process.env.SKIP_PRACTICE||user.isRanked)await startBotPlayMatch(page,user).then(()=>console.log({
        '[]++++':'['+Array(9).fill(';;;;').join('')+'>','<~~~~~~~~':'|(xxxxx)'})).catch(async e=>{
        log(e,'failed to submit team, so waiting for user to input manually and close the session')
        await sleep(163456);
        throw e;//can we continue here without throwing error
      })
      await page.evaluate('SM.Logout()');
    }
    const tableList =['account','dec','erc','cp','rating','won','netWon','decWon','w','l','d','w_p','l_p','d_p'];
    _dbug.table(users.map(u=>Object.fromEntries(tableList.map(x=>[x,u[x]]))));
    if(!process.env.KEEP_BROWSER_OPEN)browser.close();
    await battles.fromUsers(users.map(user=>user.account),{depth:1});
    log('Waiting for the next battle in',sleepingTime/1000/60,'minutes at',new Date(Date.now()+sleepingTime).toLocaleString());
    log('--------------------------End of Session--------------------------------');
    if(process.env.CLOSE_AFTER_ERC&&users.every(x=>x.isStarter||!x.isRanked)){ await browser.close(); break; }
    await sleep(sleepingTime);
  }
})()
