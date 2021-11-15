const {_card, _team, _elem, sleep,} = require('./helper');
const {SM} = require('./splinterApi');
require('dotenv').config()
const puppeteer = require('puppeteer');
const log=(...m)=>console.log(__filename.split(/[\\/]/).pop(),...m);
const headless=0;
;(async()=>{
  const browser = await puppeteer.launch({
    headless,
    args: process.env.CHROME_NO_SANDBOX === 'true' ? ["--no-sandbox"] : ['--disable-web-security',
      '--disable-features=IsolateOrigins',
      ' --disable-site-isolation-trials'],
  });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(500000);
  await page.on('dialog', async dialog => { await dialog.accept(); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1, });
  let users = process.env.ACCOUNT.split(',').map((account,i)=>{return {
    account,
    password:   process.env.PASSWORD.split(',')[i],
    active_key: process.env.ACTIVE_KEY.split(',')[i],
    login:      process.env?.EMAIL?.split(',')[i],
  }})
  SM._(page);
  while(users.length){
    log('users:',users.length);
    for (const [idx,user] of users.entries()) {
      await page.goto('https://splinterlands.com/');
      process.env.LOGIN      = user.login || user.account
      process.env.PASSWORD   = user.password
      process.env.ACTIVE_KEY = user.active_key
      process.env.ACCOUNT    = user.account
      await SM.login(process.env.LOGIN,process.env.PASSWORD)
      const cb=c=>!c.owned.filter(o=>
        !o.uid.includes('starter')&&
        !(o.market_id && o.market_listing_status === 0)&&
        (!o.delegated_to || o.delegated_to === user.account)
      ).length
      const card_ids = await SM.cards().then(c=>c.filter(cb).map(c=>c.id))
      log({'card ids':card_ids.length})
      const _ctn = await page.evaluate(`SM.Player.collection_power>=5000`);
      if(_ctn){users.splice(idx,1);await page.evaluate('SM.Logout()');continue}

      await page.evaluate(`SM.ShowMarket('rentals')`)
      await page.waitForSelector('.loading',{hidden:true})
      await page.select('#filter-sort','price')
      for (var [i,max_price] of [[3,0.5],[2,0.19],[1,0.1]]){
        await _elem.click(page,`.filter-section-rarities .filter-option-button:nth-child(${i}) > label`);
        await sleep(333);
        await page.waitForSelector('.market-price')
        const card = await page.$$eval('.card.card_market',
          (cards,[uoc,mp])=>cards.find(a=>(parseFloat(a.innerText.match(/\d+.\d+/))
            <SM.settings.dec_price*mp)&&uoc.includes(parseInt(a.id.match(/\d+/))))?.id,[card_ids,max_price]);
        if(card){
          log(card);
          await _elem.click(page,`#${card}`);
          break;
        }
      }
      await page.waitForSelector('tbody > tr:nth-child(1) > .price')
      const _credits = await page.evaluate(
        `SM.Player.balances.find(a=>a.token==='CREDITS').balance>81*${max_price}`)
      await page.select('#payment_currency',_credits?'CREDITS':'DEC')
      const id = await page.$$eval('tbody > tr > .price',
        (tb,max_price)=>
        tb.findIndex(n=>parseFloat(n.innerText.replaceAll(',',''))<=max_price),max_price)
      log(id)
      if(id>-1){
        await _elem.click(page,`tr:nth-child(${id+1}) .card-checkbox`)
        await _elem.click(page,'#btn_buy')
        await sleep(333);
        await _elem.click(page,'#btn_rent_popup_rent')
        if(user.account!='azarmadr3'){
          try{
            await page.waitForSelector('#active_key',{timeout:10000})
            await sleep(1231);
            await page.focus('#active_key')
            await page.type('#active_key',process.env.ACTIVE_KEY)
            await _elem.click(page,'#approve_tx')
          }catch(e){log(e)}
        }
        await sleep(333);
        await page.waitForSelector('.loading',{hidden:true})
      }
      //await sleep(12312);
      await page.evaluate('SM.Logout()');
      //await sleep(123123);
    }}
    browser.close();
  })()
