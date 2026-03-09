const R = require('ramda');
const RA = require('ramda-adjunct');
const { T, Ru, getRules, C } = require('./util/card');
const { log, _dbug } = require('./util/dbug');

const db = require('better-sqlite3')('./data/battles.db', {
    verbose: log,
    timeout: 81e3,
});
const add2nm = (nm, io, s, t, r) => {
    nm[s] ??= {};
    if (io) {
        nm[s][t] ??= [];
        nm[s][t][0] = r;
        nm[t] ??= {};
        nm[t][s] ??= [];
        nm[t][s][1] = r;
    } else nm[s][t] = r;
};

module.exports = function BattleObj(battle) {
    let mana = Math.min(
            battle.ruleset.includes('Little League') ? 28 : 99,
            battle.mana_cap,
        ),
        myCards = {},
        oppCards = {},
        rules = getRules(battle.ruleset, 1),
        inactive = `${battle.inactive}${battle.ruleset.includes`Taking Sides` ? ',Gray' : ''}`,
        opp = battle.opponent_player,
        sortByWinRate = 0,
        isModern = /modern/.test(battle.format);
    const activeColors = R.range(0, 24)
        .filter(
            (x) =>
                ![5, 11].includes(x) &&
                (inactive.includes`Gray` ? x % 12 < 6 : 1) &&
                (inactive.includes`Gold` ? x < 12 : 1) &&
                !inactive.includes(
                    ['Red', 'Blue', 'Green', 'Black', 'White'][x % 6],
                ),
        )
        .join();

    const query_string = `
    SELECT w,l,d,team1,team2 FROM battles WHERE (
      rules = '${R.pipe(
          Ru.map,
          R.toPairs,
          R.map(R.filter(RA.isNotNaN)),
          R.map(R.join`' AND r & `),
          R.join` > 0 OR\n      rules = '`,
      )(rules.attr)}'
    ) AND (
      w = 1 AND (m1 = :mana ${mana > 31 ? ` OR m1<=${mana} AND m1 > 30` : ``}) AND c1 IN (${activeColors}) OR
      l = 1 AND (m2 = :mana ${mana > 31 ? ` OR m2<=${mana} AND m2 > 30` : ``}) AND c2 IN (${activeColors}) OR
      (m1 = :mana ${mana > 31 ? ` OR m1<=${mana} AND m1 > 30` : ``}) AND (m1 = m2${mana > 31 ? ` OR m2<=${mana} AND m2>30` : ``}) AND
      c1 IN (${activeColors}) AND c2 IN (${activeColors})
    )`;
    const query = db.prepare(query_string);
    const isPlayable = (by) => {
        by ??= 0;
        const cards = [myCards, oppCards][by]; // until we have some opponent_player cards
        return (x) => T(x).every(([i, l]) => cards[i] >= (l === 1 ? by : l));
    };
    return {
        get myCards() {
            return myCards;
        },
        set myCards(_) {
            myCards = R.pipe(
                R.toPairs,
                R.filter(rules.byCard),
                R.filter((x) => !inactive.includes(C.color(x))),
                R.filter(isModern ? C.isModern : R.T),
                R.fromPairs,
            )(_);
            // log(
            //     R.map(
            //         R.juxt([
            //             R.identity,
            //             C.color,
            //             (x) => !inactive.includes(C.color(x)),
            //             rules.byCard,
            //             C.r,
            //         ]),
            //     )(R.difference(R.toPairs(_), R.toPairs(myCards))),
            // );
        },
        get oppCards() {
            return oppCards;
        },
        set oppCards(_) {
            oppCards = _;
        },
        get sortByWinRate() {
            return sortByWinRate;
        },
        set sortByWinRate(_) {
            sortByWinRate = _;
        },
        mana,
        rules,
        inactive,
        opp,
        isPlayable,
        nodeMatrix(
            io = 0,
            minWinningTeams = (222 * mana) / (rules.attr.length > 1 ? 9 : 1),
        ) {
            log({ minWinningTeams });
            const nmSize = new Proxy({}, { get: (o, n) => (o[n] ??= 0) });
            // x=>((a,b)=>x>mana?x/a-mana/a:mana/b-x/b)(2,1),
            const timeLimit = Date.now() + (practiceOn ? 27e3 : 81e3);
            const nm = RA.rangeStep(-1, Math.min(mana, 31), 8).reduce(
                (nm, Mana, _, arr) => {
                    if (timeLimit < Date.now()) return nm;
                    const battles = query.all({ mana: Math.floor(Mana) });
                    for (const { w, l, d, team1, team2 } of battles) {
                        if (w || d) nmSize[Mana] += +isPlayable(0)(team1);
                        if (l || d) nmSize[Mana] += +isPlayable(0)(team2);
                        const s = w ? team2 : team1,
                            t = w ? team1 : team2;
                        if (w === l) {
                            add2nm(nm, io, s, t, 2);
                            add2nm(nm, io, t, s, 2);
                        } else {
                            if (d) {
                                add2nm(nm, io, s, t, 3);
                                add2nm(nm, io, t, s, 1);
                            } else {
                                add2nm(nm, io, s, t, 4);
                            }
                        }
                    }
                    log({
                        [`${rules}|${Mana}`]: `${nmSize[Mana]}/${battles.length}`,
                    });
                    if (
                        R.reduce(R.add, 0, R.values(nmSize)) >
                        (sortByWinRate || practiceOn ? 0.027 : 1) *
                            minWinningTeams
                    )
                        arr.length = 0;
                    return nm;
                },
                {},
            );
            _dbug.table(nmSize);
            return nm;
        },
        unStarters(t) {
            const team = T(t);
            return (
                team.reduce((count, [id]) => count + (myCards[id] > 0), 0) /
                team.length
            );
        },
        get clone() {
            return BattleObj(battle);
        },
    };
};
