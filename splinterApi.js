const { log, sleep, _elem } = require('./util');
const B = require('./battle');
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
    battle: async (type = 'Ranked', _opp = '', user) => {
        log(`Finding ${type} match`);
        await page.goto('https://splinterlands.com/battle-history');
        // await page.waitForSelector('aria/chomper');
        // await page.waitForSelector('aria/chomper', { hidden: true });
        await sleep(7290);
        await Promise.all([
            page.evaluate(`[...document.querySelectorAll('button')]
		.filter(x=>x.innerText === 'BATTLE')[0].click()`),
            page.waitForNavigation(),
        ]);

        await sleep(2e3);
        await page.evaluate(`[...document.querySelectorAll('button')]
		.filter(x=>x.innerText === 'ENTER ARENA')[0].click()`);
        const cb = await page.evaluate(`fetch(
	    "https://api.splinterlands.com/players/outstanding_match?username=${user.account}")
	    .then(x=>x.json())`);
        try {
            log(cb);
            log(B(cb));
        } catch (e) {
            console.error(e);
            await sleep(8e5);
        }
        await sleep(729);
        return B(cb);
    },
    cards: async (player) => {
        const cards = await page.evaluate(
            `fetch("https://api.splinterlands.com/cards/collection/${player}")
		.then(x=>x.json()).then(x=>x.cards)`,
        );
        log({ 'Obtaining Cards': player, '#cards': cards.length });
        return cards;
    },
});
module.exports.login = async function login(page, user, _preMatch) {
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
