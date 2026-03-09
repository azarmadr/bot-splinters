const B = require('../getBattles.js');
const res = require('../data/battles-processed.json').filter(
    (x) => x.team1 && x.team2,
);
for (const b of res) {
    if (!b.team1 || !b.team2) continue;
    if (b.winner === 2) b.winner = -1;
    if (b.battle_queue_id_1.includes('prologue')) throw new Error('x');
    // console.log(b.battle_queue_id_1);
    b.teams = [b.team1, b.team2].map((x) => x.map((x) => [x.id, x.level]));
}

B.insertBattles(res);
// console.log(res.filter((x) => x.winner < 0)[0]);

console.log('Done');
