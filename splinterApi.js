var page;

const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
async function __(p=page){return p.evaluate(()=>SM);}
async function login(acc,pwd){
  log(`Logging ${acc+(is_mail?' via mail':'')}`)
  if(acc.indexOf('@')>0)
    await page.evaluate(([mail,pwd])=>
      new Promise((res,rej)=>SM.EmailLogin(mail,pwd).then(r=>(r&&r.success)?res(r):rej(r))),
      [mail,pwd]
    );
  else{
    await page.evaluate(([acc,pwd])=>
      new Promise((res,rej)=>SM.Login(acc,pwd,r=>(r&&r.success)?res(r):rej(r))),
      [acc,pwd]
    );
    await page.evaluate('SM.OnLogin(0)')
  }
  await page.evaluate(async()=>{await sleep(1729);SM.HideDialog()})
}
async function questClaim(q,_q){
  log(`Claiming ${q.name} quest box`);
  await page.evaluate(([q,_q])=>
    { try{QuestClaimReward(q,_q)}catch(e){log(e,'failed to claim quest');SM.HideLoading()}; },
    [q,_q]
  );
}
async function battle(type='Ranked'){
  log(`Finding ${type} match`);
  await page.evaluate(type=>
    { SM.ShowBattleHistory(); SM.FindMatch(type); },
    type
  )
  const cb = await page.evaluate(()=>
    new Promise(async(res)=>{
      while(SM.in_battle){ if(SM._currentBattle)break; await sleep(1729); }
      if(SM.in_battle)res(SM._currentBattle);
      else rej(null);
    })
  )
  await page.evaluate(async()=>await sleep(1729))
  await page.evaluate('SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)');
  return cb;
}
async function cards(){
  log (`Obtaining Cards`);
  return await page.evaluate(()=>new Promise(res=>SM.LoadCollection(SM.Player.name,0,(c=>res(c.filter(c=>c.owned.filter(o=>!(o.market_id && o.market_listing_status === 0) && (!o.delegated_to || o.delegated_to === SM.Player.name)).length))))))
}
module.exports = {
  login,cards, battle, questClaim, __,
  _: h=>page=h
}
