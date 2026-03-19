import { readFileSync, writeFileSync } from 'jsonfile';
import * as R from 'ramda';

const User = {};
export { User };

const tableList = ['netWon', 'w', 'l', 'd'];
const userData = (() => {
    try {
        return readFileSync('./data/user_data.json');
    } catch (e) {
        console.log(e);
        return {};
    }
})();
userData[new Date().toDateString()] ??= {};
const toDaysUsers = userData[new Date().toDateString()];

const objectWithProperties = (obj, props) =>
    Object.defineProperties(
        obj,
        Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, { value }]),
        ),
    );

User.create = (account, password, email) => {
    toDaysUsers[account] ??= {};
    const data = toDaysUsers[account];
    tableList.reduce((a, e) => Object.assign(a, { [e]: a[e] ?? 0 }), data);
    const user = { account, ...toDaysUsers[account] };
    let updateCounter = 5;

    const updateCaptureRate = R.pipe(
        R.toPairs,
        R.filter((v) => v[0].endsWith`capture_rate`),
        R.sortBy((x) => x[0]),
        R.tap(console.table),
        R.map((x) => x[1]), // TODO should we handle as an object?
        R.tap((xs) => (user.rate = xs)),
    );

    const postBattle = ({ winner, ...result } = { failed: 1 }) => {
        if (result.failed) return;
        user.won = winner === user.account ? 1 : winner === 'DRAW' ? 0 : -1;
        if (user.won > 0) {
            console.log(`Won!!! with streak ${delete result.current_streak}`);
            user.w++;
        } else user.won < 0 ? user.l++ : user.d++;
        user.netWon += user.won;

        updateCaptureRate(
            result[`player_${result.player_1 === user.account ? 1 : 2}_data`],
        );
        console.log({ result });

        if (updateCounter-- < 0) {
            updateCounter = 5;
            tableList.forEach((x) => {
                if (user[x]) data[x] = user[x];
            });
            writeFileSync('./data/user_data.json', userData);
        }
    };

    const updateInfo = (progress, info) => {
        console.log(progress, Object.keys(info));
        updateCaptureRate(info);
    };

    return objectWithProperties(user, {
        // NOTE: we are matching the button text here
        // TODO need a way to skip battling altogether
        battle: () =>
            (user.rate && user.rate[0] > user.rate[1]) || Math.random() > 0.3
                ? 'MODERN'
                : 'FRONTIER',
        password: () => password,
        login: () => email || account,
        postBattle,
        updateInfo,
    });
};

User.listFromArgs = (args) =>
    args.ACCOUNT.map((account, i) =>
        User.create(account, args.PASSWORD[i], args?.EMAIL?.[i]),
    ).filter((x) =>
        args.u
            ? args.u?.split(',')?.includes(x.account)
            : !args.SKIP_USERS?.includes(x.account),
    );
