// Parsing .env
const R = require('ramda');
const args = require('minimist')(process.argv.slice(2));
const {writeFileSync} = require('jsonfile');
const l2s=s=>s.split('_').map(x=>x[0]).join('').toLowerCase();
try{
  Object.entries(require('dotenv').config().parsed)
    .map(([e,v])=>args[e]??=v.includes(',')
      ?(args[l2s(e)]??v).split(',')
      :args[l2s(e)]??=JSON.parse(v)
  );
}catch(e){
  console.error(e);
  throw `NO '.env' file present
  Please create a new '.env' file following the '.env-example'`;
}
if(!['ACCOUNT','PASSWORD'].every(e=>args[e]))
  throw console.error('Missing ACCOUNT/PASSWORD,the REQUIRED parameter(s) in .env' +
    '\nsee `cat .env-example` for help',args);

globalThis.practiceOn=0

const {C,isLocked,rmLock, log,_score:{forQuest}, T, _arr,F:{retryFor}, sleep,_dbug:{table}} = require('./util');

log`init`
const puppeteer = require('puppeteer');
const {playableTeams} = require('./score');
const battles = require('./getBattles');
const fs = require('fs');
const {login} = require('./splinterApi')

// Logging function with save to a file
var _file='log.txt';
const util = require('util');
const logFile = fs.createWriteStream(_file,{flags:'w'});
const formatEd =(...x)=> util.formatWithOptions({colors:true},...x)
if(1||args.LOG) console.log = function () {
  process.stdout.write(formatEd.apply(null, arguments) + '\n');
  logFile.write(util.format.apply(null,arguments).replace(/\033\[[0-9;]*m/g,"") + '\n');
}

let _go=1;
const sleepingTime = 6e4 * (args.SESSION_INTERVAL ?? 27);
log`init1`

async function checkForUpdate() {
  await fetch('https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json')
    .then(x=>x.json())
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
  if(args.UPDATE_BATTLE_DATA) return battles.fromUsers(player,{cl})
  else {
    battles.fromUsers(player,{fn,cl});
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
      '--mute-audio', '--disable-dev-shm-usage'
    ]
  });
  const [page] = await browser.pages();
  await browser.defaultBrowserContext().overridePermissions('https://splinterlands.com/',['notifications']);
  page.setDefaultNavigationTimeout(5e5);
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  // await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1, });
  await page.setViewport({ width: 720, height: 1080, /* deviceScaleFactor: 1, */ });
  return browser;
}
const postBattle=user=>battle=>{
  user.won = battle.winner==user.account?1:battle.winner=='DRAW'?0:-1;
  log({getBattles:battle.player_1 != user.account?battle.player_1:battle.player_2});
  let pl= battle.player_1 != user.account?battle.player_1:battle.player_2
  if(pl)getBattles(pl).catch(log);
  if(user.won>0){
    log({Result:'Won!!!'+Array(battle.current_streak).fill('_.~"(')});
    user.decWon = Number((user.decWon+Number.parseFloat(battle.reward_dec)).toFixed(3));
    user.isRanked?user.w++:user.w_p++;
  }else user.won<0?user.isRanked?user.l++:user.l_p++:user.isRanked?user.d++:user.d_p++;
  user.netWon+=user.won;
}
async function teamSelection(teamToPlay,B,page,notifyUser){
  const {team:[Summoner,...Monsters],...Stats} = teamToPlay;
  if(!B.rules.includes('Taking Sides')){
    const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  }
  table([...teamToPlay.team.map(([Id,Lvl])=>({[C.type(Id)]:C.name(Id),Id,Lvl}))]);
  table({Stats});
  if(notifyUser)await page.evaluate(`var n=new Notification('Battle Ready');
      n.addEventListener('click',(e)=>{window.focus();e.target.close();},false);`);
  await page.waitForSelector(`[card_detail_id="${Summoner[0]}"]`,{timeout:1001}).catch(()=>page.reload()
    .then(()=>sleep(7001)).then(()=>page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)')))
  await retryFor(3,3000,!_go,async()=>page.$eval(`[card_detail_id="${Summoner[0]}"] img`,e=>e.click())
    .then(()=>page.waitForSelector('.item--summoner.item--selected',{timeout:1e3})
  ))
  if (C.color(Summoner) === 'Gold') {
    const splinter = T.splinter(B.inactive)(teamToPlay.team); log({splinter});
    await retryFor(3,3000,!_go,async()=>page.$eval(`[data-original-title="${splinter}"] label`,e=>e.click()))
  }
  for(const[mon]of Monsters){
    //log({[`Playing ${C.name(mon)}`]:mon})
    await retryFor(3,3000,_go,async()=>page.$eval(`[card_detail_id="${mon}"] img`,e=>e.click()))
  }
  if(notifyUser)await sleep(Math.min(60,Math.abs(args.PAUSE_BEFORE_SUBMIT))*999);
  await retryFor(3,300,_go,async()=>page.$eval('.btn-green',e=>e.click()))
  log('Team submitted, Waiting for opponent');
}
async function startBotPlayMatch(B,page,user) {
  B.sortByWinRate = user.isStarter||!user.isRanked;
  console.table([{...R.filter(f=>!R.is(Function,f),B),myCards:Object.keys(B.myCards).length,oppCards:Object.keys(B.oppCards).length}])
  //if(Object.keys(oppCards).length)table(__oppDeck=Object.entries(oppCards).map(([Id,Lvl])=>{ return{[C.type(Id).slice(0,3)]:C.name(Id),Id,Lvl,[C.color(Id).slice(0,2)]:C.abilities([Id,Lvl]).join()}}) .sort((a,b)=>('Mon'in a)-('Mon'in b)))
  //B.battles=await getBattles(B.opp).catch(e=>{log(e);return require('./data/battle_data.json')});
  const pt = playableTeams(B);
  forQuest(pt,user.quest);
  const [teamToPlay] = pt;
  // team Selection
  await teamSelection(teamToPlay,B,page,!args.HEADLESS&&user.isRanked&&!user.isStarter);
  await Promise.any([
    page.waitForSelector('#btnRumble', { timeout: 16e4 })
    .then(()=>page.evaluate(`startFightLoop();localStorage.setItem('sl:battle_speed', 6)`))
    .then(()=>args.SKIP_REPLAY||
      page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(2e3*B.mana)})),
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
  user.wRating = Player.rating;
  user.mRating = Player.modern_rating;
  let roll = 1//Math.random()>0.27;
  user.rating = roll?user.mRating:user.wRating;
  user.isStarter = !Player.starter_pack_purchase;
  user.cp = Player.collection_power;
  if(!user.isStarter){
    user.sp = Player.current_season_player?.rshares
    user.qp = Player.quest?.rshares
  }
  user.claimSeasonReward =
    args.CLAIM_SEASON_REWARD && Player?.season_reward.reward_packs>0&&Player.starter_pack_purchase;
  user.isRanked = user.isStarter||erc>75&&user.rating<400||erc>args.ERC_THRESHOLD||
    args.t-Date.now()>(99.81-erc)*3e5/settings.dec.ecr_regen_rate

  user.battle = user.isRanked?`${roll?'Modern ':''}Ranked`:'Practice'
  //if quest done claim reward
  user.claimQuestReward = [];
  user.quest = 0;
  if (Player.quest&&!Player.quest.claim_trx_id){
    var {name,completed_items,total_items}=Player.quest;
    const quest = settings.daily_quests.find(x=>x.name==name);
    if((Number(args.q)||3)*Math.random()<1&&args.QUEST_PRIORITY) user.quest = {
      type:quest.objective_type, ...quest.data,
    };
    //if(completed_items<total_items){ }
    // if(completed_items>=total_items){
    //   user.claimQuestReward.push(Player.quest,quest);
    //   //user.quest = 0;
    // }
  }
  table([{Rating:Player.rating,ECRate:erc,t:(args.t-Date.now())/36e5,et:(user.et=(100-erc)/12/settings.dec.ecr_regen_rate),...(completed_items&&{Quest:name,completed_items,total_items})}]);
}
const outstanding_match =u=>Promise.race([
  fetch(`https://api.splinterlands.io/players/outstanding_match?username=${u}`).then(x=>x.json()),
  new Promise(res=>setTimeout(res,27e2,1))
])
  .then(x=>(log(u,x),x?sleep(27e3).then(R.always(x)):x))

const cards2Obj=acc=>cards=>cards
  .flatMap(card=>card.owned)
  .filter(owned=>
    !(owned.market_id && owned.market_listing_status === 0) &&
    (!owned.delegated_to || owned.delegated_to === acc) &&
    (!(owned.last_used_player!==acc&&Date.parse(owned.last_used_date)>Date.now()-86400000))
  )
  .reduce((agg,x)=>R.mergeWith(R.max,agg,{[x.card_detail_id]:x.uid.startsWith('start')?0:x.level}),{})
;(async () => {
  const tableList =['account','erc','et','won','cp','dec','wRating',`mRating`,'sp','qp','netWon','decWon','w','l','d'], toDay = new Date().toDateString();
  const userData=(function(){try{return require('./data/user_data.json');}catch(e){return {}}})()
  let users = args.ACCOUNT.map((account,i)=>{
    const u = (userData[toDay]??={})?.[account];
    return{
      account,
      password:args.PASSWORD[i],
      login:args?.EMAIL[i],
      w:u?.w??0,l:u?.l??0,d:u?.d??0,w_p:0,l_p:0,d_p:0,won:0,decWon:u?.decWon??0,netWon:u?.netWon??0,erc:100,
      rating:u?.rating??0,dec:u?.dec??0,isStarter:0,isRanked:1,claimQuestReward:[],claimSeasonReward:0,
    }
  }).filter(x => args.u ? args.u?.split(',')?.includes(x.account) : !args.SKIP_USERS?.includes(x.account));
  if('t'in args)args.t = args.t*60*60000+Date.now();
  log('Opening a browser');
  let browser = await createBrowser(args.HEADLESS);
  let [page]  = await browser.pages();
  await page.goto('https://splinterlands.com/'/* ,{waitUntil: 'networkidle0'} */);
  await page.evaluate(`new Promise(res=>res(SM.Logout()))`).catch(R.always(1));

  while(!args.CLOSE_AFTER_ERC||users.some(x=>!x.isStarter&&x.isRanked)){
    //await checkForUpdate();
    let aUsers = users.filter(u=>!args.SKIP_PRACTICE||u.isRanked);
    for (let user;user = aUsers.shift();) {
      if(isLocked`.bot.playing.${user.account}`){
        aUsers.push(user)
        await sleep(1e3)
        continue
      }
      if(browser.process().killed){
        browser = await createBrowser(args.HEADLESS);
        [page] = await browser.pages();
      }

      const nSM = await login(page,user,preMatch);
      if(args.CLAIM_REWARDS){
        if(user.claimSeasonReward)                         await page.evaluate('claim()');
        if(user.claimQuestReward?.filter(x=>x)?.length==2)
          await nSM.questClaim(...user.claimQuestReward).then(()=>sleep(4e3))
      }
      if(!args.SKIP_PRACTICE||user.isRanked){
        const B = await nSM.battle(user.battle)
        B.myCards = await nSM.cards(user.account).then(cards2Obj(user.account))
          .catch(e => log(e,'cards collection api didnt respond. Did you use username? avoid email!')??{});
        // B.oppCards = B.opp=='???' ? {}:(await nSM.cards(B.opp).then(cards2Obj(B.opp)) .catch(e=>log(e,'Opp Cards Failed')??{}))
        await startBotPlayMatch(B,page,user).then(()=>console.log({
          '      ':' '+Array(9).fill('    ').join(' ')+' ','         ':'        '})).catch(async e=>{
            log(e,'failed to submit team, so waiting for user to input manually and close the session')
            await sleep(81e3);
            throw e;//can we continue here without throwing error
          })
      }
      rmLock`.bot.playing.${user.account}`
      await page.evaluate('SM.Logout()');
      tableList.map((x,i)=>i>3&&((userData[toDay][user.account]??={})[x]=user[x]))
      writeFileSync('./data/user_data.json',userData);
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
  globalThis.END_GetBattles=1;
})()
