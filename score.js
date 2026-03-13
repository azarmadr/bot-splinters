const R = require('ramda');
const Belt = require('@mobily/ts-belt');
const { log, S, T, C, A, F, D } = require('./util');
const dotP = (x, y) => Object.keys(x).reduce((sc, k) => sc + x[k] * y[k], 0);
const defaultScores = { w: 0, _w: 0, l: 0, _l: 0, d: 0, _d: 0, count: 0 };
const pos = F.cached((i, l) => (i > l / 2 ? i - l : i));
const setScores = (scores, battle) => {
    const nm = battle.nodeMatrix();
    for (const s in nm)
        for (const t in nm[s]) {
            const p = nm[s][t];
            const teams = [s, t].map(T);
            const [sMana, tMana] = teams.map(T.mana);
            const m =
                ((sMana / battle.mana) *
                    teams.reduce(
                        (s, x) =>
                            s +
                            battle.rules.byTeam(x) *
                                T.isActive(battle.inactive)(x),
                        0,
                    )) /
                2;
            teams.forEach((x, i) => {
                if (battle.isPlayable(0)(x)) {
                    scores[i ? t : s].count += p / 4;
                    scores[i ? t : s][p === 1 ? 'd' : i ? 'w' : 'l'] += p / 4;
                    scores[i ? t : s][p === 1 ? '_d' : i ? '_w' : '_l'] +=
                        ((m * p) / 4) * (i ? 1 : sMana / tMana);
                    scores[i ? t : s].oppMark |= teams.some(
                        battle.isPlayable(1),
                    );
                }
            });
        }
    return nm;
};
const printConf = { columns: [{ name: 'team', maxLen: 35 }] };
globalThis.practiceOn = 0;
module.exports.playableTeams = (battle) => {
    const scores = new Proxy(
        {},
        { get: (t, n) => (t[n] ??= { ...defaultScores }) },
    );

    const nm = setScores(scores, battle);
    //S.eigenRank(nm).forEach(x=>{scores[x.team].ter=x.eigenRank;scores[x.team].tev=x.eigenValue})
    let teams = Object.entries(scores).map(([t, s]) => ({
        team: T(t),
        ...s,
        score: dotP({ _w: 1, _d: -0.54, _l: -1 }, s),
        adv: battle.unStarters(t),
    }));
    A.normalizeMut(teams, 'score', 2);

    const cardscores = teams.reduce(
        (cs, { team, score }) =>
            team.reduce((cs, x, i, { length }) => {
                cs[x] ??= { score: 0 };
                cs[x][pos(i, length)] ??= 0;
                cs[x].score += score;
                cs[x][pos(i, length)] += score;
                return cs;
            }, cs),
        {},
    );
    var filteredTeams_length = teams.length;
    teams = R.pipe(
        R.filter((x) => x._w > 0 || x._d > 0),
        R.sortWith(
            R.map(R.descend)([
                ...(battle.sortByWinRate ? [(x) => x.w / x.count] : []),
                ...(practiceOn ? [(x) => x.score * (x.oppMark ? 1 : 2)] : []),
                ...[
                    ...(battle.sortByWinRate ? ['w', '_w'] : []),
                    'score',
                    'adv',
                ].map((x) => R.prop(x)),
            ]),
        ),
        R.filter(
            (
                (a) =>
                ({ adv }) => {
                    a[adv] = R.has(adv, a) ? a[adv] - 1 : 27 + 27 * adv;
                    return a[adv];
                }
            )({}),
        ),
    )(teams);
    A.normalizeMut(teams, 'score', 2);
    teams.forEach((x, i, arr) => {
        arr[i].rank = i;
        arr[i].aScore = Math.sqrt(x.score ** 2 + x.adv ** 2);
        arr[i]['s/c'] = x.score / x.count;
    });
    A.normalizeMut(teams, 'aScore', 2);
    A.normalizeMut(teams, 's/c', 2);
    log('trimming', { filteredTeams_length }, 'to', teams.length);
    if (!battle.sortByWinRate) {
        S.teamStats(nm, teams);
        A.normalizeMut(teams, 'ev', 2);
    }
    battle.cardsOfPlayers[0] = Object.entries(battle.cardsOfPlayers[0]).map(
        (c) => [Number(c[0]), c[1], cardscores[c[0]]],
    );

    var pt = teams;
    const tablePrinter = R.pipe(
        Belt.A.take(6),
        Belt.A.map(
            Belt.D.updateUnsafe(
                'team',
                Belt.A.map((c) => [C.name(c), c[1]].join(', ')),
            ),
        ),
        (x) => D.table(x, printConf),
    );
    if (battle.sortByWinRate) {
        pt = pt.slice(0, 27);
        pt.sort((_) => Math.random() * 2 - 1);
    }
    tablePrinter(pt);
    if (!battle.sortByWinRate) {
        if (practiceOn) {
            R.pipe(
                R.sortWith(
                    R.map(R.descend)([
                        (x) => x.adv * Math.sqrt(x.score ** 2 + x.ev ** 2),
                        (x) => !x.oppMark,
                    ]),
                ),
                (x) => (pt = x),
                R.slice(0, 5),
                R.map(({ team, ...s }) => ({
                    team: team.map((c) => [C.name(c), c[1]]).join(),
                    ...s,
                })),
                D.table,
            )(teams);
            // pt=pt.slice(0,9);
            // pt.sort(_=>Math.random()*2-1)
        } else {
            for (const [name, fn] of [
                ['ev', R.sortBy((b) => -b.ev)],
                [
                    'aScore+ev',
                    R.sortWith(
                        [
                            (x) => x.aScore ** 2 + x.ev ** 2 * 1.27,
                            (x) => x.score,
                            (x) => x.ev,
                        ].map((fn) => R.descend(fn)),
                    ),
                ],
                ['adv', R.sortBy((x) => -x.adv)],
                ['loss-win', R.sortBy((x) => x._l - x._w)],
            ]) {
                log(name);
                pt = fn(pt);
                tablePrinter(pt);
            }
        }
    }
    return pt.slice(0, 27).map(S.wBetterCards(battle));
};
