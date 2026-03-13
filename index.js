const { writeFileSync } = require('jsonfile');
const { args } = require('./util/common.js');
const { splinterApi, createPage } = require('./splinterApi');

const {
    isLocked,
    rmLock,
    log,
    A,
    sleep,
    D: { table },
} = require('./util');

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
    let page = await createPage(args);

    while (true) {
        //await checkForUpdate();
        for (let user; ; ) {
            log({ users: users.map((x) => x.account) });
            user = users.shift();
            if (!user) break;
            users.push(user);
            if (isLocked`.bot.playing.${user.account}`) {
                await sleep(3e3);
                continue;
            }
            if (page.browser().process().killed) page = await createPage(args);

            const nSM = splinterApi(page, user, args);
            await nSM.login();
            log(user.progress);
            for (let i = 0; i < 5; i++) {
                const battleResult = await nSM.battle().catch(async (e) => {
                    log(
                        e,
                        'failed to submit team, so waiting for user to input manually and close the session',
                    );
                    await sleep(81e3);
                    throw e; //can we continue here without throwing error
                });
                await sleep(5e3);
            }
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
        if (!args.KEEP_BROWSER_OPEN) page.browser.close();
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
    await page.browser.close();
    globalThis.END_GetBattles = 1;
})();
