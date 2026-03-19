import { readFileSync, writeFileSync } from 'jsonfile';
const User = {};
export { User };

const tableList = ['account', 'wRating', `mRating`, 'netWon', 'w', 'l', 'd'];
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

User.create = (account, password, email) =>
    Object.defineProperties(
        {
            account,
        },
        {
            password: {
                value() {
                    return password;
                },
            },
            login: {
                value() {
                    return email || account;
                },
            },
            updateData: {
                value() {
                    // TODO explore how to forgo `this`
                    console.log(this);
                    tableList.slice(3).forEach((x) => {
                        if (this[x]) toDaysUsers[this.account][x] = this[x];
                    });
                    writeFileSync('./data/user_data.json', userData);
                },
            },
        },
    );

User.listFromArgs = (args) =>
    args.ACCOUNT.map((account, i) =>
        User.create(account, args.PASSWORD[i], args?.EMAIL?.[i]),
    )
        .filter((x) =>
            args.u
                ? args.u?.split(',')?.includes(x.account)
                : !args.SKIP_USERS?.includes(x.account),
        )
        .map((u) =>
            Object.assign(
                u,
                tableList
                    .slice(3)
                    .reduce(
                        (a, e) => Object.assign(a, { [e]: a[e] ?? 0 }),
                        toDaysUsers[u.account],
                    ),
                toDaysUsers[u.account],
            ),
        );
