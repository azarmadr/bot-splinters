const { test } = require('node:test');
const assert = require('node:assert/strict');
const { C, T, Ru } = require('../util/card.js');
const _R = require('ramda');

test('mana matches', (_t) => {
    assert.equal(C.mana([870]), 7);
    assert.equal(C.mana(870), 7);

    assert.throws(() => {
        C.mana(869);
    }, /Error: id:'869' is probably not a card/);
});

test('team and rule set number calculation', (_t) => {
    const team = T('827,4,850,4,830,2,824,4,855,2,567,4');
    // const stats = 'name,armor,attack,ranged,magic,abilities'.split`,`;
    // console.table(
    //     team.map((c) => stats.reduce((a, x) => ((a[x] = C[x](c)), a), {})),
    // );
    // console.log(R.pipe(R.applySpec(Ru.pred))([team, team]));
    assert.equal(Ru.num([team, team]), 17867655348224);
});

test('card filter', (_t) => {
    const { processCards } = require('../splinterApi.js');
    for (const u of [
        { player: 'enochroot', count: 28 },
        { player: 'kalippo', count: 31 },
    ]) {
        const { cards } = require(`../data/test/${u.player}-cards.json`);
        const opts = {
            match_type: 'Ranked',
            mana_cap: 28,
            team: null,
            summoner_level: null,
            ruleset: 'Standard',
            inactive: 'Red,Black,Gold',
            opponent_player: 'bestgameever',
            opponent_team_hash: null,
            submit_expiration_block_num: 0,
            settings: '{"rating_level":4}',
            created_date: '2026-03-10T05:04:10.086Z',
            expiration_date: '2026-03-10T05:07:10.086Z',
            match_date: '2026-03-10T05:04:14.710Z',
            submit_expiration_date: '2026-03-10T05:07:42.710Z',
            recent_opponents: null,
            submit_date: null,
            format: 'foundation',
            bracket: null,
            is_critical: true,
            rules: Ru.getRules('Standard'),
            ...u,
        };
        const procedCards = processCards(opts)(cards);

        assert.equal(Object.keys(procedCards).length, u.count);
    }
});
