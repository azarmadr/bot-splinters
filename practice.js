// Parsing .env
const R = require('ramda');
const args = require('minimist')(process.argv.slice(2));
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

globalThis.practiceOn = true;
Error.stackTraceLimit = 127;

const puppeteer = require('puppeteer');
const {playableTeams} = require('./score');
const battles = require('./getBattles');
const {isLocked,rmLock,refreshLock, C, log, T, Ru,F:{retryFor}, sleep,_dbug:{in1,table}} = require('./util');
const fs = require('fs');
const {login} = require('./splinterApi')

// Logging function with save to a file
var _file='logPractice.txt';
const util = require('util');
const logFile = fs.createWriteStream(_file,{flags:'w'});
const formatEd =(...x)=> util.formatWithOptions({colors:true},...x)
if(1||args.LOG) console.log = function () {
  process.stdout.write(formatEd.apply(null, arguments) + '\n');
  logFile.write(util.format.apply(null,arguments).replace(/\033\[[0-9;]*m/g,"") + '\n');
}

let _go=1;

if(args.HEADLESS){
  args.SKIP_REPLAY=1;
}

async function createBrowser(headless,id) {
  for(let browser;!browser?.process();){
    try{
    browser = await puppeteer.launch({
      headless,
      args: [
        ...(args.PPTR_USER_DATA_DIR ? [`--user-data-dir=${args.PPTR_USER_DATA_DIR[0]}_${id}`]:[]),
        ...(args.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [
          '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials'
        ]),
        '--force-device-scale-factor=0.5', '--mute-audio', '--disable-dev-shm-usage'
      ]
    });
    const [page] = await browser.pages();
    await browser.defaultBrowserContext().overridePermissions('https://splinterlands.com/',['notifications']);
    page.setDefaultNavigationTimeout(5e5);
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
    await page.setViewport({ width: 1080*2, height: 720*2, deviceScaleFactor: 1/2, });
    await page.goto('https://splinterlands.com/'/* ,{waitUntil: 'networkidle0'} */);
    await page.evaluate(`new Promise(res=>res(SM.Logout()))`).catch(R.always(1));
    return browser;
    }catch(e){log(e)}
  }
  log(`Open ${id} browser`);
}
const postBattle=user=>battle=>{
  user.won = battle.winner==user.account?1:battle.winner=='DRAW'?0:-1;
  let pl= battle.player_1 != user.account?battle.player_1:battle.player_2
  if(pl&&!practiceOn)battles.fromUsers(pl).catch(log);
  user.count++
  if(user.won>0){
    log({[user.account]:'Won!!!'+Array(battle.current_streak).fill('_.~"(')});
    user.w++;
  }else user.won<0?user.l++:user.d++;
  user.netWon+=user.won;
}
async function startBotPlayMatch(page,teamToPlay,B) {
  // team Selection
  const {team:[Summoner,...Monsters],...Stats} = teamToPlay;
  if(!B.rules.includes('Taking Sides')){
    const __medusa = Monsters.find(m=>m[0]==17);__medusa&&(__medusa[0]=194)
  }
  table([...teamToPlay.team.map(([Id])=>({[C.type(Id)]:C.name(Id),Id,Lvl:B.myCards[Id]}))]);
  table({Stats});
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
    await retryFor(3,3000,_go,async()=>page.$eval(`[card_detail_id="${mon}"] img`,e=>e.click()))
  }
  await retryFor(3,300,_go,async()=>page.$eval('.btn-green',e=>e.click()))
  log('Team submitted, Waiting for opponent');
}
const preMatch=user=>({Player})=>user.isStarter = !Player.starter_pack_purchase;
const cards2Obj=acc=>cards=>cards
  .flatMap(card=>card.owned)
  .filter(owned=>
    !(owned.market_id && owned.market_listing_status === 0) &&
    (!owned.delegated_to || owned.delegated_to === acc) &&
    (!(owned.last_used_player!==acc&&Date.parse(owned.last_used_date)>Date.now()-86400000))
  )
  .reduce((agg,x)=>R.mergeWith(R.max,agg,{[x.card_detail_id]:x.uid.startsWith('start')?0:x.level}),{})

const tableList =['account','netWon','count','w','l','d'];
let users = args.ACCOUNT.map((account,i)=>({
  account, password:args.PASSWORD[i],
  login:args?.EMAIL[i],
  w:0,l:0,d:0,won:0,netWon:0,count:0
})).filter(x => args.u ? args.u?.split(',')?.includes(x.account) : !args.SKIP_USERS?.includes(x.account));
if(users.length<2)throw new Error`This mode needs atleast two users`
if('t'in args)args.t = args.t*60*60000+Date.now();

// async function sBattle(user)

const logNret=x=>log(x)??x
const outstanding_match =u=>Promise.race([
  fetch(`https://api.splinterlands.io/players/outstanding_match?username=${u}`).then(x=>x.json()),
  sleep(27e2)
]).then(x=>{
  /Too many/.test(x) && log(u,x);
  return /Too many requests. Please wait a few minutes and try again./.test(x)?
    sleep(8e3).then(R.always(1)):x
})

async function getBattleId(acc,page){
  let id;
  await sleep(1e2)
  for(;!id;await sleep(9e2)) await outstanding_match(acc).then(x=>id=x?.id).catch(log)
  await page.evaluate(`SM.AcceptChallenge('${id}')`)
}

const db = require('better-sqlite3')('./data/battles.db',{timeout: 81e3})
const countBattles = db.prepare(`
  SELECT count(*) AS x FROM battles WHERE (
    team1=:team1 AND team2=:team2 OR team1=:team2 AND team2=:team1
  ) AND rules=:rules
`)
const findNewBattle=(pt,pt0,rules)=>{
  let count = 0
  let bRule = Ru.battleRule(rules)
  for(let s of pt){
    let team1 = s.team+''
    for(let t of pt0){
      let team2 = t.team+'',rules=bRule([s.team,t.team])
      if(team1!=team2){
        in1(count++)
        let {x} = countBattles.get({team1,team2,rules})
        log({team1,team2,rules,x})
        if(x==0) return [s,t]
      }
    }
  }
  log`returning first two`
  return [pt[0],pt0[0]]
}

;(async () => {
  let [sBrowser,tBrowser] = await Promise.all([
    createBrowser(args.HEADLESS,'s'),createBrowser(args.HEADLESS,'t')
  ]);
  let [[sPage],[tPage]] = await Promise.all([sBrowser.pages(),tBrowser.pages()]);

  // while((args.t??=Date.now()+Infinity)>Date.now()){
  for(let user;user=users.shift();users.push(user)){
    if(user.isStarter||isLocked`.bot.playing.${user.account}`) continue

    [sBrowser,tBrowser].forEach(async (browser,i)=>{if(browser.process().killed){
      browser = await createBrowser(args.HEADLESS);
      if(i)[tPage] = await browser.pages()[0];
      else [sPage] = await browser.pages()[0];
    }})

    const sSM = await login(sPage,user,preMatch)
    for(let opp of users){
      await sleep(1e2)
      if(isLocked`.bot.playing.${opp.account}`)continue

      const tSM = await login(tPage,opp,preMatch)
      const [B] = await Promise.all([
        sSM.battle('Challenge',opp.account,{rating_level:4,allowed_cards: 'all'}),
        getBattleId(user.account,tPage),
      ])

      console.table([{
        ...R.filter(f=>!R.is(Function,f),B),
        myCards:Object.keys(B.myCards).length,
        oppCards:Object.keys(B.oppCards).length
      }])

      await Promise.all([tPage,sPage].map(x=>x.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)')))

      user.cards??=(await sSM.cards(user.account).then(cards2Obj(user.account))
        .catch(e => log(e,'cards collection api didnt respond. Did you use username? avoid email!')??{}))
      opp.cards??=(await tSM.cards(opp.account).then(cards2Obj(opp.account))
        .catch(e => log(e,'cards collection api didnt respond. Did you use oppname? avoid email!')??{}))

      B.myCards = user.cards;
      B.oppCards = opp.cards;
      const pt = playableTeams(B);
      let B0 = B.clone
      B0.oppCards = user.cards;
      B0.myCards = opp.cards;
      if(opp.isStarter)B0.sortByWinRate=1
      const pt0 = playableTeams(B0)
      log({pt:pt.length,pt0:pt0.length})

      let [t1,t2] = findNewBattle(pt,pt0,B.rules.attr.join`|`)
      await [[sPage,t1,B],[tPage,t2,B0]].reduce((memo,x)=>memo.then(_=>
        startBotPlayMatch(...x).then(()=>console.log(`Team submitted`)).catch(async e=>{
          log(e,'failed to submit team, so waiting for user to input manually and close the session')
          await sleep(81e3); throw e;//can we continue here without throwing error
        })),Promise.resolve(null))

      await Promise.all([tPage,sPage].map(page=>
        Promise.any([
          page.waitForSelector('#btnRumble', { timeout: 16e4 })
          .then(()=>page.evaluate(`startFightLoop()`))
          .then(()=>args.SKIP_REPLAY||
            page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(2e3*B.mana)})),
          page.waitForSelector('div.modal.fade.v2.battle-results.in',{timeout:(3e5)}),
        ])
      )).catch(() => log('Wrapping up Battle'));

      rmLock`.bot.playing.${opp.account}`

      await Promise.all([tPage,sPage].map((page,i)=>page.evaluate('SM.CurrentView.data')
        .then(postBattle(i?opp:user))
        .then(_=>page.evaluate(`SM.ShowBattleHistory()`))
      ))
      await sleep(9e2)
      await tPage.evaluate(`new Promise(res=>res(SM.Logout()))`).catch(R.always(1));
      refreshLock`.bot.playing.${user.account}`
    }
    await battles.fromUsers(user.account,{depth:1});
    table([user,...users].map(u=>Object.fromEntries(tableList.map(x=>[x,u[x]]))));
    log('--------------------------End of Session--------------------------------\n\n');
    rmLock`.bot.playing.${user.account}`
    await sPage.evaluate(`new Promise(res=>res(SM.Logout()))`).catch(R.always(1));
  }
  await sBrowser.close();
  await tBrowser.close();
  globalThis.END_GetBattles=1;
})()
