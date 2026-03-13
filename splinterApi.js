const R = require('ramda');
const B = require('./battle');
const { playableCards } = require('./core/battle.js');
const { C, log, sleep, E, D, F } = require('./util');
const puppeteer = require('puppeteer');
const ruleSet = require('./data/rulesets.json');

const timeout = 5000;
const continueAfterError = 1;
const clickElement = (e) => e.click();

async function createPage(args) {
    log('Opening a browser');
    args.CHROME_NO_SANDBOX ??= true;
    const l_browser = await puppeteer.launch({
        headless: args.HEADLESS,
        args: [
            ...(args.PPTR_USER_DATA_DIR
                ? [`--user-data-dir=${args.PPTR_USER_DATA_DIR}`]
                : []),
            ...(args.CHROME_NO_SANDBOX
                ? ['--no-sandbox']
                : [
                      '--disable-web-security',
                      '--disable-features=IsolateOrigins',
                      '--disable-site-isolation-trials',
                  ]),
            '--mute-audio',
            '--disable-dev-shm-usage',
        ],
    });
    const [l_page] = await l_browser.pages();
    await l_browser
        .defaultBrowserContext()
        .overridePermissions('https://splinterlands.com/', ['notifications']);
    l_page.setDefaultNavigationTimeout(5e5);
    // l_page.on('dialog', async (dialog) => {
    //     await dialog.accept();
    // });
    // await l_page.setUserAgent(
    //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
    // );
    // await l_page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1, });
    await l_page.setViewport({
        width: 920,
        height: 903,
        deviceScaleFactor: 0.88,
    });
    return l_page;
}

const splinterToColor = {
    Fire: 'Red',
    Water: 'Blue',
    Earth: 'Green',
    Life: 'White',
    Death: 'Black',
    Dragon: 'Gold',
};

const splinterApi = (page, user, args) => {
    const parseBattleDetails = () =>
        page.evaluate(
            (ruleSet, splinterToColor) => {
                let mana_cap,
                    inactive = [],
                    ruleset = [];
                for (let elem of document.all) {
                    if (!mana_cap) {
                        const mana = elem.innerText?.match(/^MANA\s*(\d+)$/u);
                        if (mana) mana_cap = +mana[1];
                    }
                    if (elem.ariaLabel?.match(`Element not active$`)) {
                        inactive.push(elem.ariaLabel.split` `[0]);
                    } else if (elem.ariaLabel?.match(/:/)) {
                        const rule = elem.ariaLabel.split`:`[0];
                        if (ruleSet.map((x) => x.name).includes(rule))
                            ruleset.push(rule);
                    }
                }
                inactive = inactive.map((x) => splinterToColor[x]).join`,`;
                ruleset = ruleset.join`|`;
                return { mana_cap, inactive, ruleset, format: 'foundation' }; // TODO update format somehow??
            },
            ruleSet,
            splinterToColor,
        );

    const gotoAndWait = (url) =>
        Promise.all([page.goto(url), page.waitForNavigation()]);
    const getJsonResponse = (urlPart, opts = {}, method = 'GET') =>
        page
            .waitForResponse(
                (response) =>
                    response.url().includes(urlPart) &&
                    response.request().method() == method,
                opts,
            )
            .then((x) => x.json());
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
		.then(x=>x.json())`,
        );
        log({ 'Obtaining Cards': player, '#cards': cards.length });
        return playableCards(cards);
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
        const [result] = await Promise.all([
            getJsonResponse('/battle/result'),
            clickButtonWith('BATTLE'),
            page.waitForNavigation(),
            page.waitForFunction(() => document.URL.match(/\/battle\/sl_/), {
                timeout: 1e5,
                polling: 1e4,
            }),
            clickButtonWith('SKIP BATTLE').catch((x) => {
                log(x);
                return sleep(8e4);
            }),
        ]);
        return result;
    };
    const battle = async () => {
        log(`Finding ${user.battle} match`);
        await gotoAndWait('https://splinterlands.com/battle-history');
        await page.waitForFunction(() =>
            [...document.querySelectorAll('button')]
                .map((x) => x.innerText)
                .includes('BATTLE'),
        );
        // await waitForChomperToHide();
        // await sleep(8e3);
        let [battleDetails, recent_opp_teams] = await Promise.all([
            getJsonResponse(
                `/players/outstanding_match?username=${user.account}`,
                { timeout: 0 },
            ),
            getJsonResponse(`/players/recent_teams`, { timeout: 0 }),
            clickButtonWith('BATTLE'),
            page.waitForNavigation(),
        ]);
        if (battleDetails.mana_cap === null)
            battleDetails = await parseBattleDetails();

        await sleep(2e3);
        await clickButtonWith('ENTER ARENA');
        log({ battleDetails, recent_opp_teams });
        const battle = B(battleDetails);
        await sleep(729);
        battle.cardsOfPlayers = await Promise.all(
            [user.account, battleDetails.opponent_player]
                .filter((x) => x !== '???')
                .map(getCards),
        );
        D.table([
            {
                ...R.filter((f) => !R.is(Function, f), battle),
                cardsOfPlayers: battle.cardsOfPlayers.map(
                    (x) => Object.keys(x).length,
                ),
            },
        ]);
        await teamSelection(battle.playableTeams()).catch(log);
        return await finishBattle();
    };
    async function login() {
        await gotoAndWait('https://splinterlands.com/login/email');
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
        await sleep(1e2);
        const [progress] = await Promise.all([
            getJsonResponse(`/dailies/progress`),
            puppeteer.Locator.race([
                page.locator('div.c-btWakK button.c-drMScW'),
                page.locator(
                    '::-p-xpath(//*[@id=\\"root\\"]/div/div[2]/div/div/div/div/form/button[2])',
                ),
                page.locator(':scope >>> div.c-btWakK button.c-drMScW'),
            ])
                .setTimeout(timeout)
                .click(),
            page.waitForNavigation(),
        ]);
        user.progress = progress;
        await page.evaluate(
            `localStorage.setItem('battlePersistent:playbackSpeed', 6)`,
        );
    }
    const questClaim = async (q, _q) => {
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
    };
    return {
        getJsonResponse,
        battle,
        login,
        parseBattleDetails,
    };
};

module.exports = { splinterApi, createPage };
