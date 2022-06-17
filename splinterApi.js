var page;
const {log,sleep,_elem,B} = require('./util');

const sm = {};
sm._  =h=>page=h;
sm.__ = async function(p=page){return p.evaluate('SM');}
sm.login = async function(acc,pwd){
  log({Logging:acc})
  //await sleep(3e4); await page.evaluate(`new Promise(res=>res(SM.Logout()))`);
  if(acc.indexOf('@')>0)
    await page.evaluate(`new Promise((res,rej)=>
      SM.EmailLogin('${acc}','${pwd}').then(r=>(r&&r.success)?res(r):rej(r.error))
    )`).catch(log);
  else{
    await page.evaluate(`new Promise((res,rej)=>
      SM.Login('${acc}','${pwd}',r=>(r&&r.success)?res(r):rej(r.error))
    )`).catch(log);
    await page.evaluate('SM.OnLogin(0)')
  }
  await sleep(729);
  await page.evaluate('SM.HideDialog();SM.UpdatePlayerInfo()')
}
sm.questClaim = async function (q,_q){
  log({'Claiming quest box':q.name});
  await page.evaluate(([q,_q])=>QuestClaimReward(q,_q),[q,_q])
    .then(()=>page.waitForSelector('.loading',{hidden:true}))
    .then(()=>_elem.click(page,'.card3d .card_img'))
    .then(()=>_elem.click(page,'#btnCloseOpenPack'))
    .then(()=>sleep(27e2))
    .catch(()=>log('failed to open Quest Box')??page.evaluate('SM.HideLoading()'))
}
sm.battle = async function(type='Ranked'){
  log(`Finding ${type} match`);
  await page.evaluate(`{SM.ShowBattleHistory(); SM.FindMatch('${type}');}`)
  const cb = await page.evaluate(`new Promise(async(res,rej)=>{
    while(SM.in_battle){ if(SM._currentBattle)break; await sleep(1729); }
    if(SM.in_battle)res(SM._currentBattle);
    else rej(null);
  })`)
  await sleep(729);
  await page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)');
  //log(cb)
  return B(cb);
}
sm.cards = async function(player){
  player=player?`'${player}'`:'SM.Player.name';
  log({'Obtaining Cards':player});
  return await page.evaluate(`new Promise((res,rej)=> SM.LoadCollection(${player}, 1, res))`)
}
module.exports = sm;
