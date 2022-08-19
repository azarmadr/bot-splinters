var page;
const {log,sleep,_elem} = require('./util');
const B = require('./battle');
const { modulo } = require('ramda');

module.exports = page => ({
  login: async function Login(acc,pwd){
    log({Logging:acc})
    if(acc.indexOf('@')>0) await page.evaluate(`new Promise((res,rej)=>
      SM.EmailLogin('${acc}','${pwd}').then(r=>(r&&r.success)?res(r):rej(r.error))
    )`).catch(log);
    else await page.evaluate(`new Promise((res,rej)=>
      SM.Login('${acc}','${pwd}',r=>setTimeout(() => { 
        if (r && r.success) {
          SM.OnLogin().then(_=>res(r.success))
        } else rej(r.error)
      }, 0)))`).catch(log)
    await page.evaluate('SM.HideDialog();SM.UpdatePlayerInfo()')
  },
  questClaim: async function (q,_q){
    log({'Claiming quest box':q.name});
    await page.evaluate(([q,_q])=>QuestClaimReward(q,_q),[q,_q])
      .then(()=>page.waitForSelector('.loading',{hidden:true}))
      .then(()=>_elem.click(page,'.card3d .card_img'))
      .then(()=>_elem.click(page,'#btnCloseOpenPack'))
      .catch(()=>log('failed to open Quest Box')??page.evaluate('SM.HideLoading()'))
  },
  battle: async function(type='Ranked',opp='',settings={}){
    log(`Finding ${type} match`);
    let outstanding_match;
    // const outstanding_match = await page.evaluate(`SM.Player?.outstanding_match`);
    // log({outstanding_match},`{SM.ShowBattleHistory(); SM.FindMatch('${type}'${
    //   type=='Challenge'?`,'${opp}',${JSON.stringify(settings)}`:''
    // });}`)
    await page.evaluate(outstanding_match?
      `SM.OutstandingMatch(SM.Player.outstanding_match)`:
      `SM.FindMatch('${type}'${
        type=='Challenge'?`,'${opp}',${JSON.stringify(settings)}`:''
      })`
    )
    const cb = await page.evaluate(`new Promise(async(res,rej)=>{
      while(SM.in_battle){ if(SM._currentBattle)break; await sleep(1729); }
      if(SM.in_battle)res(SM._currentBattle);
      else rej(null);
    })`)
    await sleep(729);
    await page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)');
    // log(cb)
    return B(cb);
  },
  cards: async function(player){
    player=player?`'${player}'`:'SM.Player.name';
    log({'Obtaining Cards':player});
    return await page.evaluate(`new Promise((res,rej)=> SM.LoadCollection(${player}, 1, res))`)
  }
})
module.exports.login = async function login(page,user,preMatch){
  await page.goto('https://splinterlands.com/');
  const SM = module.exports(page);
  await SM.login(user.login || user.account,user.password);
  user.isStarter??(await page.evaluate('Object.assign({},{settings:SM.settings,Player:SM.Player})').then(preMatch(user)))
  await page.evaluate(`localStorage.setItem('sl:battle_speed', 6)`)
  return SM
}

