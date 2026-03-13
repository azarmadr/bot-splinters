const R = require('ramda');
const RA = require('ramda-adjunct');
const { T, Ru, C } = require('./util/card');
const { log } = require('./util/dbug');
const { playableTeams } = require('./score');

const db = require('better-sqlite3')('./data/battles.db', {
    // verbose: log,
    timeout: 81e3,
});
const add2nm = (nm, io, s, t, r) => {
    nm[s] ??= {};
    if (io) {
        nm[t] ??= {};
        nm[t][s] ??= [];
        nm[s][t] ??= [];
        nm[s][t][0] ??= r;
        nm[t][s][1] ??= r;
    } else {
        // if (t in nm[s]) log('duplicate battle', s, t, r, nm[s][t]);
        nm[s][t] ??= r;
    }
};

// const BASE_MANA = 30;

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

module.exports = function BattleObj(battle) {
    let mana = Math.min(
            battle.ruleset.includes('Little League') ? 28 : 99,
            battle.mana_cap,
        ),
        cardsOfPlayers = [],
        rules = Ru.getRules(battle.ruleset, 1),
        inactive = `${battle.inactive}${battle.ruleset.includes`Taking Sides` ? ',Gray' : ''}`,
        sortByWinRate = 0;
    const activeColors = R.range(0, 24)
        .filter(
            (x) =>
                ![5, 11].includes(x) &&
                (inactive.includes`Gray` ? x % 12 < 6 : true) &&
                (inactive.includes`Gold` ? x < 12 : true) &&
                !inactive.includes(
                    ['Red', 'Blue', 'Green', 'Black', 'White'][x % 6],
                ),
        )
        .join();
    const processCards = (i) =>
        R.pipe(
            cards2Obj(i ? battle.opponent_player : battle.player),
            R.toPairs,
            R.filter((c) => {
                try {
                    C.mana(c);
                    return true;
                } catch (_e) {
                    // TODO log if not already seen error comes
                    // if log(e);
                    return false;
                }
            }),
            R.filter(rules.byCard),
            R.filter(
                (x) =>
                    !battle.inactive.includes(C.color(x)) &&
                    (battle.format === 'foundation'
                        ? [15]
                        : [12, 14, 15]
                    ).includes(C.tier(x)),
            ),
            R.fromPairs,
        );
    const colorQuery = [1, 2].map((x) => `c${x} IN (${activeColors})`);
    const manaQuery = [1, 2].map((x) => `m${x} = :mana`);
    // `(m${x} = :mana${mana > BASE_MANA ? ` OR m${x} <=${mana} AND m${x} > ${BASE_MANA}` : ``})`,

    const isPlayable = (by) => {
        by ??= 0;
        const cards = cardsOfPlayers[by]; // until we have some opponent_player cards
        return R.pipe(
            // R.tap(log),
            T,
            R.map((x) => [cards[x[0]], x[1]]),
            R.both(
                R.all(([l, r]) => l >= r),
                rules.byTeam,
            ),
        );
    };
    function nodeMatrix(
        io = 0,
        minWinningTeams = (22 * mana) / (rules.attr.length > 1 ? 9 : 1),
    ) {
        log({ minWinningTeams });
        // x=>((a,b)=>x>mana?x/a-mana/a:mana/b-x/b)(2,1),
        const timeLimit = Date.now() + 81e3;
        // RA.rangeStep(-1, Math.min(mana, BASE_MANA), 8)
        const possibleAttrRules = R.pipe(
            R.juxt([R.of(Array), R.splitEvery(1), R.always([['Standard']])]),
            R.unnest,
            R.uniq,
        );
        let nm = {};
        for (const attrRule of possibleAttrRules(rules.attr)) {
            const query_string = `
            SELECT w,l,d,team1,team2 FROM battles WHERE (
              rules = '${R.pipe(
                  possibleAttrRules,
                  R.reverse,
                  R.juxt([R.map(R.join`,`), R.reverse]),
                  R.apply(R.zip),
                  R.fromPairs,
                  R.map(
                      R.map(R.pipe(R.flip(R.prop)(Ru.e), R.curry(Math.pow)(2))),
                  ),
                  R.map(R.sum),
                  R.toPairs,
                  R.map(R.filter(RA.isNotNaN)),
                  R.map(R.join`' AND r & `),
                  R.join` > 0 OR\n      rules = '`,
              )(attrRule)}'
            ) AND (
              ${manaQuery[0]} AND ${colorQuery[0]} OR
              ${manaQuery[1]} AND ${colorQuery[1]}
            )`;
            log(query_string);
            const query = db.prepare(query_string);
            const nmSize = new Proxy({}, { get: (o, n) => (o[n] ??= 0) });
            nm = R.range(1, mana)
                .reverse()
                .reduce((nm, Mana, _, arr) => {
                    if (timeLimit < Date.now()) return nm;
                    // let count = 0;
                    for (const { w, l, d, team1, team2 } of query.iterate({
                        mana: Math.floor(Mana),
                    })) {
                        // count++;
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
                    // log(`${rules}|${Mana}: ${nmSize[Mana]}/${count}`);
                    if (R.reduce(R.add, 0, R.values(nmSize)) > minWinningTeams)
                        arr.length = 0;
                    return nm;
                }, nm);
        }
        return nm;
    }
    const ret = {
        get cardsOfPlayers() {
            return cardsOfPlayers;
        },
        set cardsOfPlayers(_) {
            cardsOfPlayers = _;
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
        isPlayable,
        processCards,
        nodeMatrix,
        unStarters(t) {
            const team = T(t);
            return (
                team.reduce(
                    (count, [id]) => count + (cardsOfPlayers[0][id] > 0),
                    0,
                ) / team.length
            );
        },
        clone() {
            return BattleObj(battle);
        },
    };

    ret.playableTeams = () => playableTeams(ret);
    return ret;
};
