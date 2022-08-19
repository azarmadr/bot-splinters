const args = require('minimist')(process.argv.slice(2));
const l2s=s=>s.split('_').map(x=>x[0]).join('').toLowerCase();
Object.entries(require('dotenv').config().parsed).map(([e,v])=>args[e]??=v.includes(',')
  ?(args[l2s(e)]??v).split(',') :args[l2s(e)]??=JSON.parse(v)
);
if(!['ACCOUNT','PASSWORD'].every(e=>args[e]))
  throw console.error('Missing ACCOUNT/PASSWORD,the REQUIRED parameter(s) in .env' +
    '\nsee `cat .env-example` for help',args);

const R = require('ramda');
const { log, C, _dbug, _arr,F, _elem, sleep } = require("./util");
const puppeteer = require("puppeteer");
const headless = 0;

const waitList = {};

const rentDuration=ends=>parseInt((Date.parse(ends)-Date.now())/24/36e5+1.5)+'';
const cb=acc=>x=>x.owned.filter(x=>x.delegated_to==acc||x.player==acc&&!x.delegated_to);
(async () => {
  // const browserFetcher = puppeteer.createBrowserFetcher();
  // const {executablePath} = await browserFetcher.download('1022525');
  // const executablePath = 'E:\\dl\\.pptr\\win64-1011831\\chrome-win\\chrome.exe'
  // const executablePath = 'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  // log({executablePath})
  const browser = await puppeteer.launch({
    headless,
    // executablePath,
    args: [
      ...(args.PPTR_USER_DATA_DIR ? [`--user-data-dir=${args.PPTR_USER_DATA_DIR[0]}_market`]:[]),
      ...(args.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [
        '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials'
      ]),
    ],
  });
  log('started')
  const [page] = await browser.pages();
  page.setDefaultNavigationTimeout(500000);
  page.on("dialog", async (dialog) => { await dialog.accept(); });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
  );
  // await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1 });
  await page.setViewport({ width: 720, height: 1080, /* deviceScaleFactor: 1, */ });
  let users = args.ACCOUNT.map((account, i) => ({
    account,password:args.PASSWORD[i],login:args?.EMAIL[i],active_key:args.ACTIVE_KEY[i],
  }))
    .filter(x => args.u ? args.u?.split(',')?.includes(x.account) : !args.SKIP_USERS?.includes(x.account));
  const nSM = require("./splinterApi")(page);
  await page.goto('https://splinterlands.com/',{waitUntil: 'networkidle0'});
  log({ "#users": users.length });
  const {leagues,season:{ends}} = await page.evaluate(`new Promise(r=>r({...SM.settings}))`);
  const leaguesRating=F.cached(r=>leagues.reduce(([cp0,cp1],{min_rating, min_power})=>
    min_rating>r ? [cp0,cp1] : (_dbug.tt.cp = [cp1,min_power]),[0,0])[args.l?1:0])
  for (let { login, account, password, active_key } of users) {
    await nSM.login(login || account, password);
    do{
      const { collection_power, starter_pack_purchase, balances, rating} =
        await page.evaluate(`new Promise(r=>r({...SM.Player}))`);
      const card_ids = await nSM.cards(account).then(c => c.flatMap(cb(account)).map(x=>x.card_detail_id));
      let cpu =Math.max(1e3,args.c??Math.min(15e3,leaguesRating(rating)));
      delete _dbug.tt.cp;
      log({cpu,collection_power});
      if (!starter_pack_purchase || collection_power >= cpu) break;
      const cp = Math.max(101,cpu - collection_power);
      log(cp,args.c);
      _dbug.table({[account]:{
        collection_power,
        "card ids": card_ids.length,
        ...(starter_pack_purchase && { starter_pack_purchase }),
      }});

      await page.evaluate(`SM.ShowMarket('rentals')`);
      await page.waitForSelector(".loading", { hidden: true });
      await page.select("#filter-sort", "price");
      await _elem.click( page, `.filter-section-foil .filter-option-button:nth-child(2) > label`);

      Object.keys(waitList).forEach(k=>Date.now()-81e4>waitList[k]&&delete waitList[k]);

      const minx = await page.$$eval(
        ".card.card_market",
        (a, cp,card_ids,g,waitList) => a.flatMap(x => {
          let [id, gold, edition] = [...x.onclick.toString().matchAll(/\((\d.*)\)/g)][0][1].split(",")
            .map((x,i)=>i>2?0:JSON.parse(x.trim()));
          if([id, gold, edition] in waitList) return [];
          let c = calculateCP({ xp: 1, alpha_xp: 0, card_detail_id: id, gold, edition });
          let lp = parseFloat(x.innerText.match(/\d+.\d+/));
          return(!card_ids.includes(id)&&!(g&&gold)&&c<cp)?[
            [c,lp,(0.0001+lp)/SM.settings.dec_price,id,gold,edition]
          ] : [];
        }).reduce((minx,x)=>[x,...minx].sort((a,b)=>b[0]/b[1]-a[0]/a[1]).slice(0,1),[]),
        cp,args.i?[]:card_ids,args.g,waitList
      );
      console.table(minx.map(x=>[...x,C.name(x[3])]));
      minx.forEach(x=>waitList[[x[3],x[4],x[5]]]=Date.now());
      require('readline').moveCursor(process.stdout,0,-13);
      try{
        let [_,lpDoll,lpDec,...cardDetails] = minx[0];
        if (cardDetails){
        await page.evaluate(`SM.ShowCardDetails(${cardDetails.join()},'rentals')`);
        await page.waitForSelector("tbody > tr:nth-child(1) > .price");
        const _credits =
          balances.find((a) => a.token === "CREDITS")?.balance > 10e3 * lpDoll;
        //log({_credits,lpDoll});
        await page.select("#payment_currency", _credits ? "CREDITS" : "DEC");
        const id = (
          await page.$$eval("tbody > tr > .price", (tb) =>
            tb.map((n) => parseFloat(n.innerText.replaceAll(",", "")))
          )
        ).reduce(
          _arr.indexOfminBy((x) => (x < lpDec ? x : undefined)),
          -1
        );
        if (id > -1) {
          await _elem.click(page, `tr:nth-child(${id + 1}) .card-checkbox`);
          await _elem.click(page, "#btn_buy").then(R.always(sleep(333)));
          await page.waitForSelector("#txt_rent_days")
            .then(R.always(sleep(33)))
            .then(()=>page.focus('#txt_rent_days',''))
            .then(()=>page.keyboard.press('Delete'))
            .then(()=>page.keyboard.press('Backspace'))
            .then(()=>page.type('#txt_rent_days',rentDuration(ends)));
          await _elem.click(page, "#btn_rent_popup_rent");
          if (account != "azarmadr3") await page.waitForSelector("#active_key", { timeout: 4e3 })
            .then(()=>sleep(1231))
            .then(()=>page.focus("#active_key"))
            .then(()=>page.type("#active_key", active_key))
            .then(()=>_elem.click(page, "#approve_tx"))
            .catch(()=>page.evaluate(`SM.HideDialog()`))
          await page.waitForSelector(".loading", { visible: true, timeout: 1e2 }).catch(()=>{})
          await page.waitForSelector(".loading", { hidden:  true, timeout: 1e5 });
        }
        await page.evaluate('SM.HideDialog()');
      }}catch(e){log(e)}
      await sleep(3e2);
      delete _dbug.tt.userSummary;
    }while(true)
    await page.evaluate("SM.Logout()");
  }
  browser.close();
})();
