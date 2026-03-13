const R = require('ramda');
const B = require('./battle');
const { C, log, sleep, E, D, F } = require('./util');
const puppeteer = require('puppeteer');
const timeout = 5000;
const continueAfterError = 1;
const clickElement = (e) => e.click();

const splinterApi = (page, args) => {
    const clickButtonWith = (name) =>
        page.$$eval(
            'button',
            (buttons, name) =>
                buttons.filter((e) => e.innerText === name)[0].click(),
            name,
        );
    const getCards = async (player) => {
        const cards = await page.evaluate(
            `fetch("https://api.splinterlands.com/cards/collection/${player}")
		.then(x=>x.json()).then(x=>x.cards)`,
        );
        log({ 'Obtaining Cards': player, '#cards': cards.length });
        return cards;
    };
    const waitForChomperToHide = async () => {
        while (true) {
            await page.waitForSelector('img[alt="chomper"]', { hidden: true });
            if (!(await page.$('img[alt="chomper"]').catch(log))) break;
        }
        log('Waiting finished');
    };
    const teamSelection = async (teams) => {
        // TODO add a tui to select the best team
        // TODO find better strategy B.sortByWinRate =
        // TODO can get recent battles from the opponent

        const teamToPlay = teams[0];
        const {
            team: [Summoner, ...Monsters],
            ...Stats
        } = teamToPlay;
        D.table([
            ...teamToPlay.team.map(([Id, Lvl]) => ({
                [C.type(Id)]: C.name(Id),
                Id,
                Lvl,
            })),
        ]);
        D.table([Stats]);
        await F.retryFor(3, 3000, !continueAfterError, async () =>
            page
                .waitForSelector(`[data-card_detail_id="${Summoner[0]}"]`, {
                    timeout: 1001,
                })
                .then(clickElement)
                .catch(log),
        );
        await sleep(2e3);
        // TODO fix for the gold
        if (C.color(Summoner) === 'Gold') {
            const splinter = T.splinter(B.inactive)(teamToPlay.team);
            log({ splinter });
            await F.retryFor(3, 3000, !continueAfterError, async () =>
                page.$eval(
                    `[data-data-original-title="${splinter}"] label`,
                    clickElement,
                ),
            );
        }
        for (const [mon] of Monsters) {
            //log({[`Playing ${C.name(mon)}`]:mon})
            await F.retryFor(3, 3000, continueAfterError, async () =>
                page.$eval(`[data-card_detail_id="${mon}"] img`, clickElement),
            );
        }
        if (!args.HEADLESS)
            await sleep(Math.min(60, Math.abs(args.PAUSE_BEFORE_SUBMIT)) * 1e3);
        log('Team submitted, Waiting for opponent');
        //     .then(() => page.evaluate('SM.CurrentView.data').then(postBattle(user)))
        //     .catch(() => log('Wrapping up Battle'));
    };
    const finishBattle = async () => {
        await Promise.all([
            clickButtonWith('BATTLE'),
            page.waitForNavigation(),
        ]);
        await page.waitForFunction(() => document.URL.match(/\/battle\/sl_/), {
            timeout: 1e5,
            polling: 1e4,
        });
        await sleep(8e3);
        await clickButtonWith('SKIP BATTLE').catch((x) => {
            log(x);
            return sleep(8e4);
        });
        await sleep(3e3);
    };
    const battle = async (type = 'Ranked', user) => {
        log(`Finding ${type} match`);
        await Promise.all([
            page.goto('https://splinterlands.com/battle-history'),
            page.waitForNavigation(),
        ]);
        await page.waitForFunction(
            () =>
                [...document.querySelectorAll('button')]
                    .map((x) => x.innerText)
                    .includes('BATTLE'),
            {},
        );
        await waitForChomperToHide();
        await sleep(8e3);
        await Promise.all([
            clickButtonWith('BATTLE'),
            page.waitForNavigation(),
        ]);

        await sleep(2e3);
        await clickButtonWith('ENTER ARENA');
        const battleDetails = await page.evaluate(`fetch(
	    "https://api.splinterlands.com/players/outstanding_match?username=${user.account}")
	    .then(x=>x.json())`);
        log(battleDetails);
        const battle = B(battleDetails);
        await sleep(729);
        battle.cardsOfPlayers = await Promise.all(
            [user.account, battleDetails.opponent_player]
                .filter((x) => x !== '???')
                .map((account, index) =>
                    getCards(account)
                        .then(battle.processCards(index))
                        .catch(log),
                ),
        );
        D.table([
            {
                ...R.filter((f) => !R.is(Function, f), battle),
                cardsOfPlayers: battle.cardsOfPlayers.map(
                    (x) => Object.keys(x).length,
                ),
            },
        ]);
        await teamSelection(battle.playableTeams())
            .catch(log)
            .then(finishBattle);
        return battle;
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
        battle,
        getCards,
    };
};
async function login(page, user, args) {
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
    return splinterApi(page, args);
}
module.exports = { login };
