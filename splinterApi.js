var page;
const { log, sleep, _elem } = require('./util');
const B = require('./battle');
const { modulo } = require('ramda');
const puppeteer = require('puppeteer');
const timeout = 5000;

module.exports = (page) => ({
    questClaim: async (q, _q) => {
        log({ 'Claiming quest box': q.name });
        await page
            .evaluate(([q, _q]) => QuestClaimReward(q, _q), [q, _q])
            .then(() => page.waitForSelector('.loading', { hidden: true }))
            .then(() => _elem.click(page, '.card3d .card_img'))
            .then(() => _elem.click(page, '#btnCloseOpenPack'))
            .catch(
                () =>
                    log('failed to open Quest Box') ??
                    page.evaluate('SM.HideLoading()'),
            );
    },
    battle: async (type = 'Ranked', opp = '', user) => {
        log(`Finding ${type} match`);
        if (0) {
            await page.evaluate(
                `SM.FindMatch('${type}'${
                    type == 'Challenge'
                        ? `,'${opp}',${JSON.stringify(settings)}`
                        : ''
                })`,
            );
            const cb = await page.evaluate(`new Promise(async(res,rej)=>{
	      while(SM.in_battle){ if(SM._currentBattle)break; await sleep(1729); }
	      if(SM.in_battle)res(SM._currentBattle);
	      else rej(null);
	    })`);
            await page.evaluate(
                'SM.HideDialog();SM.ShowCreateTeam(SM._currentBattle)',
            );
            // log(cb)
        }
        await page.goto('https://splinterlands.com/battle-history');
        // await page.waitForSelector('aria/chomper');
        // await page.waitForSelector('aria/chomper', { hidden: true });
        await sleep(7290);
        await page.evaluate(`
	    [...document.querySelectorAll('button')].filter(x=>x.innerText === 'BATTLE')[0].click()
	`);

        await page.waitForNavigation();
        await sleep(729);
        const cb = await page.evaluate(
            `fetch("https://api.splinterlands.com/players/outstanding_match?username=${user.account}")
	    .then(x=>x.json())`,
        );
        try {
            console.table(B(cb));
        } catch (e) {
            console.error(e);
        }
        await sleep(729);
        return B(cb);
    },
    cards: async (player) => {
        player = player ? `'${player}'` : 'SM.Player.name';
        log({ 'Obtaining Cards': player });
        return await page.evaluate(
            `new Promise((res,rej)=> SM.LoadCollection(${player}, 1, res))`,
        );
    },
});
module.exports.login = async function login(page, user, preMatch) {
    log('logging');
    await page.goto('https://splinterlands.com/login/email');
    await sleep(5e3);
    await puppeteer.Locator.race([
        page.locator('::-p-aria(email)'),
        page.locator('form > div:nth-of-type(1) input'),
        page.locator(':scope >>> form > div:nth-of-type(1) input'),
    ])
        .setTimeout(timeout * 1e3)
        .fill(user.login || user.account);
    await puppeteer.Locator.race([
        page.locator('::-p-aria(password)'),
        page.locator('form > div:nth-of-type(2) input'),
        page.locator(':scope >>> form > div:nth-of-type(2) input'),
    ])
        .setTimeout(timeout)
        .fill(user.password);
    await puppeteer.Locator.race([
        page.locator('div.c-btWakK button.c-drMScW'),
        page.locator(
            '::-p-xpath(//*[@id=\\"root\\"]/div/div[2]/div/div/div/div/form/button[2])',
        ),
        page.locator(':scope >>> div.c-btWakK button.c-drMScW'),
    ])
        .setTimeout(timeout)
        .click();
    await page.evaluate(
        `localStorage.setItem('battlePersistent:playbackSpeed', 6)`,
    );
    await sleep(5e3);
    return module.exports(page);
};
