require("dotenv").config();
const { log, _card, _dbug, _arr, _elem, sleep } = require("./util");
const SM = require("./splinterApi");
const puppeteer = require("puppeteer");
const args = require("minimist")(process.argv.slice(2));
const headless = 0;

const cb=acc=>c=>!c.owned.filter(o=>o.delegated_to==acc||o.player==acc&&o.delgated_to).length;
(async () => {
  const browser = await puppeteer.launch({
    headless,
    args:
      process.env.CHROME_NO_SANDBOX === "true"
        ? ["--no-sandbox"]
        : [
            "--disable-web-security",
            "--disable-features=IsolateOrigins",
            " --disable-site-isolation-trials",
          ],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(500000);
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
  );
  await page.setViewport({ width: 1800, height: 1500, deviceScaleFactor: 1 });
  let users = process.env.ACCOUNT.split(",")
    .map((account, i) => {
      if (
        args.u ? args.u?.split(',')?.includes(account) :
        !(args.su ?? process.env.SKIP_USERS ?? "").split(",")?.includes(account)
      ) {
        return {
          account,
          password: process.env.PASSWORD.split(",")[i],
          active_key: process.env.ACTIVE_KEY.split(",")[i],
          login: process.env?.EMAIL?.split(",")[i],
        };
      }
    })
    .filter((x) => x);
  SM._(page);
  while (users.length) {
    log({ "#users": users.length });
    for (let [ idx, { login, account, password, active_key } ] of users.entries()) {
      await page.goto("https://splinterlands.com/");
      await SM.login(login || account, password);
      const card_ids = await SM.cards(account).then((c) =>
        c.filter(cb(account)).map((c) => c.id)
      );
      const { collection_power, starter_pack_purchase, balances, leagues, rating} =
        await page.evaluate(`new Promise(r=>r({...SM.Player,...SM.settings}))`);
      //console.table(balances)
      let cp0=0,cp1=0;
      for(let {min_rating, min_power} of leagues)if(min_rating<rating){
        [cp1,cp0] = [min_power,cp1];_dbug.tt.cp = {cp0,cp1,rating,min_rating};
      }
      delete _dbug.tt.cp;
      if (!starter_pack_purchase || collection_power >= args.c) {
        users.splice(idx, 1);
        await page.evaluate("SM.Logout()");
        continue;
      }
      log({cpu:(args.c??args.l?cp1:cp0),collection_power});
      const cp = Math.max(101,(args.c??args.l?cp1:cp0) - collection_power);
      log(cp,args.c);
      _dbug.tt.userSummary = {
        account,
        collection_power,
        "card ids": card_ids.length,
        ...(starter_pack_purchase && { starter_pack_purchase }),
      };

      await page.evaluate(`SM.ShowMarket('rentals')`);
      await page.waitForSelector(".loading", { hidden: true });
      await page.select("#filter-sort", "price");
      await _elem.click(
        page,
        `.filter-section-foil .filter-option-button:nth-child(2) > label`
      );

      const minx = await page.$$eval(
        ".card.card_market",
        (a, cp,card_ids,g) =>
          a.reduce((minx, x) => {
            let [card_detail_id, gold, edition] = [
              ...(x.onclick + "").matchAll(/\((.*)\)/g),
            ][1][1]
              .split(",")
              .slice(0, 3)
              .map((x) => JSON.parse(x.trim()));
            let c = calculateCP({
              xp: 1,
              alpha_xp: 0,
              card_detail_id,
              gold,
              edition,
            });
            console.log(card_ids.length,card_ids);
            let lp = parseFloat(x.innerText.match(/\d+.\d+/));
            if (c < cp && (g?!gold:1)&& (gold||card_ids.includes(card_detail_id)
              //&&SM.cards.find(x=>x.id==card_detail_id).rarity>2
            ))
              minx.push([ c, lp,(0.0001+lp)/SM.settings.dec_price,card_detail_id,gold,edition]);
            return minx.sort((a,b)=>b[0]/b[1]-a[0]/a[1]).slice(0,3);
          }, []),
        cp,args.i?[]:card_ids,args.g
      );
      console.table(minx.map(x=>[...x,_card.name(x[3])]));
      for(let [_,lpDoll,lpDec,...cardDetails] of minx){try{
        if (!cardDetails) continue;
        await page.evaluate(`SM.ShowCardDetails(${cardDetails.join()},'rentals')`);
        await page.waitForSelector("tbody > tr:nth-child(1) > .price");
        const _credits =
          balances.find((a) => a.token === "CREDITS")?.balance > 7e3 * lpDoll;
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
          await _elem.click(page, "#btn_buy");
          await sleep(333);
          await page.waitForSelector("#txt_rent_days");
          await sleep(33);
          //await page.type('#txt_rent_days','2');
          await _elem.click(page, "#btn_rent_popup_rent");
          if (account != "azarmadr3") await page.waitForSelector("#active_key", { timeout: 4e3 })
            .then(()=>sleep(1231))
            .then(()=>page.focus("#active_key"))
            .then(()=>page.type("#active_key", active_key))
            .then(()=>_elem.click(page, "#approve_tx"))
            .catch(()=>page.evaluate(`SM.HideDialog()`))
          await sleep(333);
          await page.waitForSelector(".loading", { hidden: true, timeout: 1e5 });
        }
        await sleep(81e2);
      }catch(e){log(e)}}
      if(users.length>1)await page.evaluate("SM.Logout()");
      await sleep(81e3);
    }
    delete _dbug.tt.userSummary;
  }
  browser.close();
})();
