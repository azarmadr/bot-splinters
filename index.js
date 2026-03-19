const { args } = require('./util/common.js');
const { splinterApi, createPage } = require('./splinterApi');
const { User } = require('./core/user.js');

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
const postBattle = (user, battle) => {
    if (battle === undefined) return;
    user.won =
        battle.winner === user.account ? 1 : battle.winner === 'DRAW' ? 0 : -1;
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

const tableList = ['account', 'wRating', `mRating`, 'netWon', 'w', 'l', 'd'];
(async () => {
    const users = User.listFromArgs(args);
    let page = await createPage(args); // TODO move this completely into splinterApi.js

    for (let user; ; ) {
        table(
            users.map((u) =>
                Object.fromEntries(tableList.map((x) => [x, u[x]])),
            ),
        );
        if (args.t && Date.now() > args.t) break;
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
        user.battle = 'MODERN'; // TODO or 'FOUNDATION'
        for (let i = 0; i < 5; i++) {
            if (args.t && Date.now() > args.t) break;
            const battleResult = await nSM.battle().catch(log);
            postBattle(user, battleResult);
            await sleep(5e3);
        }
        user.updateData();
        rmLock`.bot.playing.${user.account}`;
        await nSM.logout();
        if (!args.KEEP_BROWSER_OPEN) page.browser.close();
        log(
            'Waiting for the next session in',
            sleepingTime / 1000 / 60,
            'minutes at',
            new Date(Date.now() + sleepingTime).toLocaleString(),
            '\n\n',
        );
        await sleep(sleepingTime);
    }
    await page.browser().close();
    globalThis.END_GetBattles = 1;
})();
