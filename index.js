// Parsing .env
const args = require('minimist')(process.argv.slice(2));
const l2s=s=>s.split('_').map(x=>x[0]).join('').toLowerCase();
Object.entries(require('dotenv').config().parsed).map(([e,v])=>args[e]??=v.includes(',')
  ?(args[l2s(e)]??v).split(',') :args[l2s(e)]??=JSON.parse(v)
);
if(!['ACCOUNT','PASSWORD'].every(e=>args[e]))
  throw console.error('Missing ACCOUNT/PASSWORD,the REQUIRED parameter(s) in .env' +
    '\nsee `cat .env-example` for help',args);

const puppeteer = require('puppeteer');
const SM = require('./splinterApi');
const {playableTeams} = require('./score');
const battles = require('./battles-data');
const {_card, log, _team, _arr,_func:{retryFor}, sleep,_dbug:{table}} = require('./util');

// Logging function with save to a file
var _file='log.txt';
const util = require('util');
const logFile = require('fs').createWriteStream(_file,{flags:'w'});
const formatEd =(...x)=> util.formatWithOptions({colors:true},...x)
console.log = function () {
  process.stdout.write(formatEd.apply(null, arguments) + '\n');
  logFile.write(util.format.apply(null,arguments).replace(/\033\[[0-9;]*m/g,"") + '\n');
}

let _go=1;
const sleepingTime = 6e4 * (args.SESSION_INTERVAL ?? 27);

async function checkForUpdate() {
  await require('async-get-json')('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
    .then(async v=>{
      const gitVersion = v.version.replace(/(\.0+)+$/,'').split('.');
      const version = require('./package.json').version.replace(/(\.0+)+$/,'').split('.');
      if(_arr.checkVer(gitVersion,version)){
        const rl = require("readline/promises")
          .createInterface({ input: process.stdin, output: process.stdout });
        let answer = await rl.question(gitVersion.join('.')+version.join('.')
          +"Newer version exists!!!\nDo you want to continue? (y/N)\n")
        log({'Note!!':require('./package.json').description})
        if(answer.match(/y/gi)) log('Continuing with older version');
        else if(answer.match(/n/gi)) throw new Error('git pull or get newer version');
        else throw new Error('choose correctly');
      }
    })
}
const fn = args.UPDATE_BATTLE_DATA?'':'_new';
async function getBattles(player) {
  const cl = 55;
  if(args.UPDATE_BATTLE_DATA)
    return battles.fromUsers(player,{cl})
  else {
    battles.fromUsers(player,{fn,cl});
    //battles.merge(bl,blNew);
    return require('./data/battle_data.json');
  }
}
async function createBrowser(headless) {
  const browser = await puppeteer.launch({
    headless,
    args: [
      ...(args.PPTR_USER_DATA_DIR ? [`--user-data-dir=${args.PPTR_USER_DATA_DIR[0]}`]:[]),
      ...(args.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [
        '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials'
      ]),
    ]
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
  await page.waitForSelector(`[card_detail_id="${Summoner[0]}"]`,{timeout:1001}).catch(()=>page.reload()
    .then(()=>sleep(7001)).then(()=>page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)')))
  await retryFor(3,3000,!_go,async()=>page.$eval(`[card_detail_id="${Summoner[0]}"] img`,e=>e.click())
    .then(()=>page.waitForSelector('.item--summoner.item--selected',{timeout:1e3})
  ))
  if (_card.color(Summoner) === 'Gold') {
    const splinter = _team.splinter(inactive)(teamToPlay.team); log({splinter});
    await retryFor(3,3000,!_go,async()=>page.$eval(`[data-original-title="${splinter}"] label`,e=>e.click()))
  }
  for(const[mon]of Monsters){
    //log({[`Playing ${_card.name(mon)}`]:mon})
    await retryFor(3,3000,_go,async()=>page.$eval(`[card_detail_id="${mon}"] img`,e=>e.click()))
  }
  if(notifyUser)await sleep(Math.min(60,Math.abs(args.PAUSE_BEFORE_SUBMIT))*999);
  await retryFor(3,300,_go,async()=>page.click('.btn-green')).catch(log);
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
  console.table([{mana_cap, ruleset, inactive,...user.quest,[`${user.account} Deck`]:Object.keys(myCards).length,[`${opponent_player} Deck`]:Object.keys(oppCards).length}])
  //if(Object.keys(oppCards).length)table(__oppDeck=Object.entries(oppCards).map(([Id,Lvl])=>{ return{[_card.type(Id).slice(0,3)]:_card.name(Id),Id,Lvl,[_card.color(Id).slice(0,2)]:_card.abilities([Id,Lvl]).join()}}) .sort((a,b)=>('Mon'in a)-('Mon'in b)))
  var battlesList =await getBattles(opponent_player).catch(e=>{log(e);return require('./data/battle_data.json')});
  const pt = playableTeams(battlesList,{mana_cap,ruleset:_team.getRules(ruleset),inactive,quest:user.quest,oppCards,myCards,sortByWinRate:user.isStarter||!user.isRanked});
  table(pt.slice(0,5).map(({team,...s})=>({team:team.map(c=>[_card.name(c),c[1]]).join(),...s})));
  if(!user.isStarter) table(pt.sort((a,b)=>b._w+a._l-a._w-b._l).slice(0,5)
    .map(({team,...s})=>({team:team.map(c=>[_card.name(c),c[1]]).join(),...s})));
  if(!user.isStarter) table(pt.sort((a,b)=>b.score+b.ev-a.score-a.ev).slice(0,5)
    .map(({team,...s})=>({team:team.map(c=>[_card.name(c),c[1]]).join(),...s})));
  const teamToPlay = pt[0];
  // team Selection
  await teamSelection(teamToPlay,{page,ruleset,inactive,notifyUser:!args.HEADLESS&&user.isRanked&&!user.isStarter}); // Eof teamSelection
  await Promise.any([
    page.waitForSelector('#btnRumble', { timeout: 16e4 })
    .then(()=>page.evaluate(`startFightLoop();localStorage.setItem('sl:battle_speed', 6)`))
    .then(()=>args.SKIP_REPLAY||
      page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(2e3*mana_cap)})),
    page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(3e5)}),
  ]).then(()=>page.evaluate('SM.CurrentView.data').then(postBattle(user)))
    .catch(() => log('Wrapping up Battle'));
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
    args.CLAIM_SEASON_REWARD && Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;
  user.isRanked = user.isStarter||erc>81&&user.rating<400||erc>args.ERC_THRESHOLD||
    args.t-Date.now()>(99.81-erc)*3e5/settings.dec.ecr_regen_rate

  //if quest done claim reward
  user.claimQuestReward = [];
  user.quest = 0;
  if (Player.quest&&!Player.quest.claim_trx_id){
    var {name,completed_items,total_items}=Player.quest;
    const quest = settings.quests.find(x=>x.name==name)
    if(completed_items<total_items){
      if((Number(args.q)||3)*Math.random()<1&&args.QUEST_PRIORITY)
        user.quest = {type:quest.objective_type,color:quest.data.color,value:quest.data.value};
    }
    if(completed_items>=total_items){
      user.claimQuestReward.push(Player.quest,quest);
      user.quest = 0;
    }
  }
  table([{Rating:Player.rating,ECRate:erc,t:(args.t-Date.now())/36e5,et:(user.et=(100-erc)/12/settings.dec.ecr_regen_rate),...(completed_items&&{Quest:name,completed_items,total_items})}]);
}
const cards2Obj=acc=>cards=>cards
  .flatMap(card=>card.owned.filter(owned=>
    !(owned.market_id && owned.market_listing_status === 0) &&
    (!owned.delegated_to || owned.delegated_to === acc) &&
    (!(owned.last_used_player!==acc&&Date.parse(owned.last_used_date)>Date.now()-86400000))
  ))
  .reduce((agg,{card_detail_id,level})=>Object.assign(
    agg,agg[card_detail_id]>level?agg[card_detail_id]:{[card_detail_id]:level}
  ),{})
;(async () => {
  const tableList =['account','erc','et','won','cp','dec','rating','netWon','decWon','w','l','d',/*'w_p','l_p','d_p'*/], toDay = new Date().toDateString();
  const userData=require('./data/user_data.json');
  let users = args.ACCOUNT.map((account,i)=>{
    const u = (userData[toDay]??={})?.[account];
    return{
      account,
      password:args.PASSWORD[i],
      login:args?.EMAIL[i],
      w:u?.w??0,l:u?.l??0,d:u?.d??0,w_p:0,l_p:0,d_p:0,won:0,decWon:u?.decWon??0,netWon:u?.netWon??0,erc:100,
      rating:u?.rating??0,dec:u?.dec??0,isStarter:0,isRanked:1,claimQuestReward:[],claimSeasonReward:0,
    }
  }).filter(x=>!args.SKIP_USERS?.includes(x.account));
  if('t'in args)args.t = args.t*60*60000+Date.now();
  log('Opening a browser');
  let browser = await createBrowser(args.HEADLESS);
  let page = (await browser.pages())[1];

  while(!args.CLOSE_AFTER_ERC||users.some(x=>!x.isStarter&&x.isRanked)){
    await checkForUpdate();
    for (const user of users.filter(u=>!args.SKIP_PRACTICE||u.isRanked)) {
      if(browser.process().killed){
        browser = await createBrowser(args.HEADLESS);
        page = (await browser.pages())[1];
      }
      await page.goto('https://splinterlands.com/',{waitUntil: 'networkidle0'});
      SM._(page);
      await SM.login(user.login || user.account,user.password);
      await page.evaluate('SM.ShowBattleHistory()'); await sleep(1729);
      await SM.cards(user.account)
      await page.evaluate('Object.assign({},{Player:SM.Player,settings:SM.settings})').then(preMatch(user))
      if(args.CLAIM_REWARDS){
        if(user.claimSeasonReward)                         await page.evaluate('claim()');
        if(user.claimQuestReward?.filter(x=>x)?.length==2) await SM.questClaim(...user.claimQuestReward)
      }
      if(!args.SKIP_PRACTICE||user.isRanked)await startBotPlayMatch(page,user).then(()=>console.log({
        '      ':' '+Array(9).fill('    ').join(' ')+' ','         ':'        '})).catch(async e=>{
        log(e,'failed to submit team, so waiting for user to input manually and close the session')
        await sleep(81e3);
        throw e;//can we continue here without throwing error
      })
      await page.evaluate('SM.Logout()');
      tableList.map((x,i)=>i>3&&((userData[toDay][user.account]??={})[x]=user[x]))
      require('jsonfile').writeFileSync('./data/user_data.json',userData);
    }
    table(users.map(u=>Object.fromEntries(tableList.map(x=>[x,u[x]]))));
    if(!args.KEEP_BROWSER_OPEN)browser.close();
    await battles.fromUsers(users.filter(u=>!args.SKIP_PRACTICE||u.isRanked)
      .map(user=>user.account),{depth:1,fn});
    log('Waiting for the next battle in',sleepingTime/1000/60,'minutes at',new Date(Date.now()+sleepingTime).toLocaleString());
    log('--------------------------End of Session--------------------------------\n\n');
    await sleep(sleepingTime);
  }
  await browser.close();
})()
