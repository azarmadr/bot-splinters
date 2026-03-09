const R = require('ramda');
const B = require('./battle');
const { C, log, sleep, E } = require('./util');
const puppeteer = require('puppeteer');
const timeout = 5000;

// TODO merge into processCards
const cards2Obj = (acc) => (cards) =>
    cards
        .filter(
            (card) =>
                !(card.market_id && card.market_listing_status === 0) &&
                (!card.delegated_to || card.delegated_to === acc) &&
                !(
                    card.last_used_player !== acc &&
                    Date.parse(card.last_used_date) > Date.now() - 86400000
                ),
        )
        .reduce(
            (agg, x) =>
                R.mergeWith(R.max, agg, {
                    [x.card_detail_id]: x.level,
                }),
            {},
        );
const processCards = ({ player, rules, inactive, format }) =>
    R.pipe(
        cards2Obj(player),
        R.toPairs,
        R.filter((c) => {
            try {
                C.mana(c);
                return true;
            } catch (_e) {
                return false;
            }
        }),
        R.filter(rules.byCard),
        R.filter(
            (x) =>
                !inactive.includes(C.color(x)) &&
                (format === 'foundation' ? [15] : [12, 14, 15]).includes(
                    C.tier(x),
                ),
        ),
        R.fromPairs,
    );
const splinterApi = (page) => {
    const clickButtonWith = (name) =>
        page.evaluate(`[...document.querySelectorAll('button')]
		.filter(x=>x.innerText === '${name}')[0].click()`);
    const getCards = async (player) => {
        const cards = await page.evaluate(
            `fetch("https://api.splinterlands.com/cards/collection/${player}")
		.then(x=>x.json()).then(x=>x.cards)`,
        );
        log({ 'Obtaining Cards': player, '#cards': cards.length });
        return cards;
    };
    return {
        questClaim: async (q, _q) => {
            log({ 'Claiming quest box': q.name });
            await page
                .evaluate(([q, _q]) => QuestClaimReward(q, _q), [q, _q])
                .then(() => page.waitForSelector('.loading', { hidden: true }))
                .then(() => E.click(page, '.card3d .card_img'))
                .then(() => E.click(page, '#btnCloseOpenPack'))
                .catch(
                    () =>
                        log('failed to open Quest Box') ??
                        page.evaluate('SM.HideLoading()'),
                );
        },
        finishBattle: async () => {
            await Promise.all([
                clickButtonWith('BATTLE'),
                page.waitForNavigation(),
            ]);
            await sleep(3e3);
            await clickButtonWith('SKIP_BATTLE').catch((x) => {
                log(x);
                return sleep(8e4);
            });
        },
        clickButtonWith,
        battle: async (type = 'Ranked', _opp = '', user) => {
            log(`Finding ${type} match`);
            await page.goto('https://splinterlands.com/battle-history');
            await sleep(7290);
            await Promise.all([
                clickButtonWith('BATTLE'),
                page.waitForNavigation(),
            ]);

            await sleep(2e3);
            await clickButtonWith('ENTER ARENA');
            const cb = await page.evaluate(`fetch(
	    "https://api.splinterlands.com/players/outstanding_match?username=${user.account}")
	    .then(x=>x.json())`);
            const battle = B(cb);
            try {
                log(cb);
            } catch (e) {
                console.error(e);
                await sleep(8e5);
            }
            await sleep(729);
            [battle.myCards, battle.oppCards] = await Promise.all(
                [user.account, cb.opponent_player]
                    .filter((x) => x !== '???')
                    .map((account) =>
                        getCards(account)
                            .then(processCards({ ...cb, rules: battle.rules }))
                            .catch(log),
                    ),
            );
            return battle;
        },
        getCards,
    };
};
async function login(page, user) {
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
    return splinterApi(page);
}
module.exports = { login, processCards };
