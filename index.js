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

(async () => {
    const users = User.listFromArgs(args);
    let page = await createPage(args); // TODO move this completely into splinterApi.js

    for (let user; ; ) {
        const count = users.filter((x) => !!x.rate).length ? 1 : 5;
        table(users);
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
        for (let i = 0; i < count; i++) {
            if (args.t && Date.now() > args.t) break;
            await nSM.battle().catch(log);
            await sleep(5e3);
        }
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
