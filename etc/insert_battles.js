const path = require('node:path');
const fs = require('node:fs');
const B = require('../getBattles.js');
const { parseArgs } = require('node:util');

const files = ['../data/battles-processed.json'];
const args = parseArgs({ options: { all: { short: 'a', type: 'boolean' } } });

if (args.values.all) {
    const dir = 'data/processed';
    fs.readdirSync(dir)
        .map((x) => path.join('..', dir, x))
        .forEach((x) => {
            files.push(x);
        });
}
console.log(files);

for (const file of files) {
    const res = require(file);
    for (const b of res) {
        if (!b.team1 || !b.team2) continue;
        if (b.winner === 2) b.winner = -1;
        if (b.battle_queue_id_1.includes('prologue')) throw new Error('x');
        // console.log(b.battle_queue_id_1);
        b.teams = [b.team1, b.team2].map((x) => x.map((x) => [x.id, x.level]));
    }

    B.insertBattles(res);
    // console.log(res.filter((x) => x.winner < 0)[0]);
}

console.log('Done');
