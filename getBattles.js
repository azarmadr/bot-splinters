const R = require('ramda');
const { writeFileSync } = require('jsonfile');
const { log, _dbug, sleep } = require('./util/dbug');
const { C, T, Ru } = require('./util/card');
const { _arr } = require('./util/array');
const getJson = (player) =>
    Promise.race([
        fetch(
            `https://game-api.splinterlands.com/battle/history?player=${player}`,
        )
            .catch(() =>
                fetch(
                    `https://api2.splinterlands.com/battle/history?player=${player}`,
                ),
            )
            .then((x) => x.json())
            .then((b) => b.battles ?? []),
        new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timeout')), 17290),
        ),
    ]).catch(() => []);
const B = {},
    _dbugBattles = [];
//const __medusa=(m,t)=>(T.colorSec(t)=='Blue'&&m.card_detail_id==194&&m.level<3)?17:m.card_detail_id;

const db = require('better-sqlite3')('./data/battles.db', { timeout: 81e3 });
db.prepare(`CREATE TABLE IF NOT EXISTS battles (
  team1 TEXT, team2 TEXT, rules TEXT, r INTEGER,
  m1 INTEGER, m2 INTEGER, c1 INTEGER, c2 INTEGER,
  w INTEGER, l INTEGER, d INTEGER,
  CONSTRAINT uid PRIMARY KEY(team1,team2,rules)
)`).run();
const write_statement = ['w', 'l', 'd'].reduce((a, k) => {
    a[k] = db.prepare(`
    INSERT INTO battles (team1, team2, rules, r, m1, m2, ${k}, c1, c2)
    VALUES (:team1, :team2, :rules, :r, :m1, :m2, :${k}, :c1, :c2)
    ON CONFLICT(team1, team2, rules)
    DO UPDATE SET ${k}=excluded.${k}
  `);
    return a;
}, {});

const dbCount = db.prepare(`SELECT COUNT(*) AS c FROM battles`);
const BC = { count: dbCount.get().c, pc: 0 };

B.insertBattles = db.transaction((battles) => {
    for (const b of battles) {
        let { winner, teams } = b;
        if (!teams) console.trace(teams);
        if (teams[1] > teams[0]) {
            teams.reverse();
            winner *= -1;
        }
        const [m1, m2] = teams.map(T.mana);
        if (!m1 || !m2) {
            console.log(b, m1, m2);
            if (!m1) console.log(b.team1, teams[0].map(C.mana));
            throw new Error('Mana cannot be 0');
        }
        const [c1, c2] = teams.map(T.colors).map((colors) => {
            let teamColor = ['Red', 'Blue', 'Green', 'Black', 'White'].reduce(
                (a, x, i) => (colors.includes(x) ? i : a),
                5,
            );
            teamColor += colors.includes('Gray') ? 6 : 0;
            teamColor += colors.includes('Gold') ? 12 : 0;
            return teamColor;
        });
        const k = winner === 1 ? 'w' : winner === -1 ? 'l' : 'd';
        BC.lastInsertRowid = write_statement[k].run({
            team1: teams[0].toString(),
            team2: teams[1].toString(),
            rules: Ru.battleRule(b.ruleset)(teams),
            r: Ru.num(teams),
            m1,
            m2,
            c1,
            c2,
            [k]: 1,
        }).lastInsertRowid;
    }
});
async function getBattles(
    player = '',
    nuSet = new Set(),
    rFilter = R.T,
    drs = R.F,
) {
    const battleHistory = await getJson(player)
        .then((b) =>
            b.filter(
                (b) =>
                    rFilter(
                        Math.max(
                            b.player_1_rating_final,
                            b.player_2_rating_final,
                        ),
                    ) && !b.details.includes('"type":"Surrender"'),
            ),
        )
        .catch((e) => log(e) ?? []);
    _dbug.in1(BC.pc++, BC.lastInsertRowid, player);
    B.insertBattles(
        battleHistory.filterMap((b_old) => {
            let b = b_old;
            const { winner, team1, team2 } = JSON.parse(b.details);
            nuSet.add(team1.player);
            nuSet.add(team2.player);
            if (_arr.eq(...teams) || teams.some((x) => T(x).length < 2))
                return [];
            if (drs({ rules: b.ruleset, mana: b.mana_cap, teams }))
                _dbugBattles.push(b);
            const teams = [team1, team2].map((t) =>
                [t.summoner, ...t.monsters].map((m) => [
                    m.card_detail_id,
                    m.level,
                ]),
            );

            b.teams = teams;
            b.winner =
                winner === team1.player ? 1 : winner === team2.player ? -1 : 0;
            return [b];
        }),
    );
    return nuSet;
}

const checkIfPresent = (obj, delay) => (x) => {
    if (Date.now() - obj[x] < delay) return 0;
    obj[x] = Date.now();
    return 1;
};
const practiceOn = false;
const blackSet = checkIfPresent({}, practiceOn ? 27e3 : 81e4);
B.fromUsers = (players, { depth = 2, rFilter, drs, cl = 27 } = {}) =>
    new Promise((res) => {
        const ul = [
            ...new Set(Array.isArray(players) ? players : players.split(',')),
        ]
            .filter(blackSet)
            .filter((_, i) => i < 243);
        if (practiceOn) log({ ul, depth });
        Promise.resolve(
            _arr
                .chunk(cl, ul)
                .reduce(
                    (memo, ul_chunk) =>
                        memo.then((nuSet) =>
                            Promise.all(
                                ul_chunk.map((u) =>
                                    getBattles(u, nuSet, rFilter, drs),
                                ),
                            ).then(() => nuSet),
                        ),
                    Promise.resolve(new Set()),
                ),
        )
            .then((x) => (depth < 3 ? x : sleep(27e3).then((_) => x)))
            .then((nuSet) => {
                log({ added: -(BC.count - dbCount.get().c) });
                BC.count = dbCount.get().c;
                if (
                    --depth > 0 &&
                    nuSet.size &&
                    _dbugBattles.length < 3 &&
                    !globalThis.END_GetBattles
                )
                    return res(
                        B.fromUsers([...nuSet], {
                            drs,
                            depth,
                            rFilter,
                            cl,
                        }),
                    );
                else {
                    if (_dbugBattles.length) {
                        log({ L: _dbugBattles.length });
                        writeFileSync('data/dbugBattles.json', _dbugBattles);
                    }
                    _dbugBattles.length = 0;
                    return res('done');
                }
            });
    });
module.exports = B;

const BUILD_DB_DATA = false;
if (
    BUILD_DB_DATA &&
    db.prepare('SELECT COUNT(*) AS x FROM battles').get().x < 1e5
) {
    fetch(
        'https://api.splinterlands.io/players/leaderboard_with_player?leaderboard=0',
    )
        .then((x) => x.json())
        .then((x) =>
            B.fromUsers(
                x.leaderboard.map((x) => x.player),
                { depth: 2 },
            ),
        )
        .catch(log);
}
