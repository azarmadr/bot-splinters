var page;
const SM = {};

const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
SM.__ = async function(p=page){return p.evaluate(()=>SM);}
SM.login = async function(acc,pwd){
  log(`Logging ${acc}`)
  if(acc.indexOf('@')>0)
    await page.evaluate(([acc,pwd])=>
      new Promise((res,rej)=>SM.EmailLogin(acc,pwd).then(r=>(r&&r.success)?res(r):rej(r.error))),
      [acc,pwd]
    ).catch(log);
  else{
    await page.evaluate(([acc,pwd])=>
      new Promise((res,rej)=>SM.Login(acc,pwd,r=>(r&&r.success)?res(r):rej(r.error))),
      [acc,pwd]
    ).catch(log);
    await page.evaluate('SM.OnLogin(0)')
  }
  await page.evaluate(async()=>{await sleep(1729);SM.HideDialog()})
}
SM.questClaim = async function (q,_q){
  log(`Claiming ${q.name} quest box`);
  await page.evaluate(([q,_q])=>
    { try{QuestClaimReward(q,_q)}catch(e){log(e,'failed to claim quest');SM.HideLoading()}; },
    [q,_q]
  );
}
SM.battle = async function(type='Ranked'){
  log(`Finding ${type} match`);
  await page.evaluate(type=>
    { SM.ShowBattleHistory(); SM.FindMatch(type); },
    type
  )
  const cb = await page.evaluate(()=>
    new Promise(async(res,rej)=>{
      while(SM.in_battle){ if(SM._currentBattle)break; await sleep(1729); }
      if(SM.in_battle)res(SM._currentBattle);
      else rej(null);
    })
  )
  await page.evaluate(async()=>await sleep(1729))
  await page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)');
  return cb;
}
SM.cards = async function(){
  log (`Obtaining Cards`);
  return await page.evaluate(`new Promise((res,rej)=>
    SM.LoadCollection(
      SM.Player.name,
      1,
      col=>res(col)
    )
  )`)
}
SM._=h=>page=h;
module.exports = {SM};
