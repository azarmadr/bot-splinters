// Parsing .env
const { writeFileSync } = require('jsonfile');
const { args } = require('./util/common.js');

const {
    isLocked,
    rmLock,
    log,
    A,
    sleep,
    D: { table },
} = require('./util');

const puppeteer = require('puppeteer');
const { login } = require('./splinterApi');

// Logging function with save to a file
args.LOG = 1;
if (args.LOG) {
    console.log = require('./util/common.js').logger();
}

const sleepingTime = 6e4 * (args.SESSION_INTERVAL ?? 27);

async function _checkForUpdate() {
    await fetch(
        'https://raw.githubusercontent.com/azarmadr/bot-splinters/master/package.json',
    )
        .then((x) => x.json())
        .then(async (v) => {
            const gitVersion = v.version.replace(/(\.0+)+$/, '').split('.');
            const version = require('./package.json')
                .version.replace(/(\.0+)+$/, '')
                .split('.');
            if (A.checkVer(gitVersion, version)) {
                const rl = require('node:readline/promises').createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                const answer = await rl.question(
                    gitVersion.join('.') +
                        version.join('.') +
                        'Newer version exists!!!\nDo you want to continue? (y/N)\n',
                );
                log({ 'Note!!': require('./package.json').description });
                if (answer.match(/y/gi)) log('Continuing with older version');
                else if (answer.match(/n/gi))
                    throw new Error('git pull or get newer version');
                else throw new Error('choose correctly');
            }
        });
}
async function createBrowser(headless) {
    const l_browser = await puppeteer.launch({
        headless,
        args: [
            ...(args.PPTR_USER_DATA_DIR
                ? [`--user-data-dir=${args.PPTR_USER_DATA_DIR}`]
                : []),
            ...(args.CHROME_NO_SANDBOX
                ? ['--no-sandbox']
                : [
                      '--disable-web-security',
                      '--disable-features=IsolateOrigins',
                      ' --disable-site-isolation-trials',
                  ]),
            '--mute-audio',
            '--disable-dev-shm-usage',
        ],
    });
    const [page] = await l_browser.pages();
    await l_browser
        .defaultBrowserContext()
        .overridePermissions('https://splinterlands.com/', ['notifications']);
    page.setDefaultNavigationTimeout(5e5);
    page.on('dialog', async (dialog) => {
        await dialog.accept();
    });
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
    );
    // await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1, });
    await page.setViewport({
        width: 920,
        height: 903,
        deviceScaleFactor: 0.81,
    });
    return l_browser;
}
const _postBattle = (user) => (battle) => {
    user.won =
        battle.winner === user.account ? 1 : battle.winner === 'DRAW' ? 0 : -1;
    // log({
    //     getBattles:
    //         battle.player_1 !== user.account
    //             ? battle.player_1
    //             : battle.player_2,
    // });
    // const pl =
    //     battle.player_1 !== user.account ? battle.player_1 : battle.player_2;
    // if (pl) getBattles(pl).catch(log);
    if (user.won > 0) {
        log({ Result: `Won!!!${Array(battle.current_streak).fill('_.~"(')}` });
        user.w++;
    } else user.won < 0 ? user.l++ : user.d++;
    user.netWon += user.won;
};
const _preMatch =
    (user) =>
    ({ Player, settings }) => {
        user.wRating = Player.rating;
        user.mRating = Player.modern_rating;
        const roll = 1; //Math.random()>0.27;
        user.rating = roll ? user.mRating : user.wRating;
        user.cp = Player.collection_power;
        user.sp = Player.current_season_player?.rshares;
        user.qp = Player.quest?.rshares;
        user.claimSeasonReward =
            args.CLAIM_SEASON_REWARD &&
            Player?.season_reward.reward_packs > 0 &&
            Player.starter_pack_purchase;

        user.battle = `${roll ? 'Modern ' : ''}Ranked`;
        // TODO if quest done claim reward
        user.claimQuestReward = [];
        user.quest = 0;
        if (Player.quest && !Player.quest.claim_trx_id) {
            const { name } = Player.quest;
            const quest = settings.daily_quests.find((x) => x.name === name);
            if (
                (Number(args.qp) || 3) * Math.random() < 1 &&
                args.QUEST_PRIORITY
            )
                user.quest = {
                    type: quest.objective_type,
                    ...quest.data,
                };
            //if(completed_items<total_items){ }
            // if(completed_items>=total_items){
            //   user.claimQuestReward.push(Player.quest,quest);
            //   //user.quest = 0;
            // }
        }
        Player.quest ??= {};
        table([
            {
                Rating: Player.rating,
                t: (args.t - Date.now()) / 36e5,
                ...Player.quest,
            },
        ]);
    };

async function logout(page) {
    await sleep(1e4);
    await page.goto('https://splinterlands.com').catch(log);
    await page.goto('https://splinterlands.com/logout').catch(log);
}

(async () => {
    const tableList = [
            'account',
            'won',
            'cp',
            'wRating',
            `mRating`,
            'sp',
            'qp',
            'netWon',
            'w',
            'l',
            'd',
        ],
        toDay = new Date().toDateString();
    const userData = (() => {
        try {
            return require('./data/user_data.json');
        } catch (e) {
            log(e);
            return {};
        }
    })();
    const users = args.ACCOUNT.map((account, i) => {
        userData[toDay] ??= {};
        const u = userData[toDay]?.[account];
        return {
            account,
            password: args.PASSWORD[i],
            login: args?.EMAIL?.[i],
            w: u?.w ?? 0,
            l: u?.l ?? 0,
            d: u?.d ?? 0,
            won: 0,
            netWon: u?.netWon ?? 0,
            rating: u?.rating ?? 0,
            claimQuestReward: [],
            claimSeasonReward: 0,
        };
    }).filter((x) =>
        args.u
            ? args.u?.split(',')?.includes(x.account)
            : !args.SKIP_USERS?.includes(x.account),
    );
    if ('t' in args) args.t = args.t * 60 * 60000 + Date.now();
    log('Opening a browser');
    let browser = await createBrowser(args.HEADLESS);
    let [page] = await browser.pages();
    await page.goto('https://splinterlands.com/');

    while (!args.CLOSE_AFTER_ERC) {
        //await checkForUpdate();
        for (let user; ; ) {
            log({ users: users.map((x) => x.account) });
            user = users.shift();
            if (!user) break;
            users.push(user);
            if (isLocked`.bot.playing.${user.account}`) {
                await sleep(1e3);
                continue;
            }
            if (browser.process().killed) {
                browser = await createBrowser(args.HEADLESS);
                [page] = await browser.pages();
            }

            const nSM = await login(page, user, args);
            const _battle = await nSM
                .battle(user.battle, user)
                .catch(async (e) => {
                    log(
                        e,
                        'failed to submit team, so waiting for user to input manually and close the session',
                    );
                    await sleep(81e3);
                    throw e; //can we continue here without throwing error
                });
            rmLock`.bot.playing.${user.account}`;
            logout(page);
            tableList.forEach((x, i) => {
                if (i > 3) {
                    userData[toDay][user.account] ??= {};
                    userData[toDay][user.account][x] = user[x];
                }
            });
            writeFileSync('./data/user_data.json', userData);
        }
        table(
            users.map((u) =>
                Object.fromEntries(tableList.map((x) => [x, u[x]])),
            ),
        );
        if (!args.KEEP_BROWSER_OPEN) browser.close();
        log(
            'Waiting for the next battle in',
            sleepingTime / 1000 / 60,
            'minutes at',
            new Date(Date.now() + sleepingTime).toLocaleString(),
        );
        log(
            '--------------------------End of Session--------------------------------\n\n',
        );
        await sleep(sleepingTime);
    }
    await browser.close();
    globalThis.END_GetBattles = 1;
})();
