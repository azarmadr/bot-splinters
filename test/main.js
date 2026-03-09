const { test } = require('node:test');
const assert = require('node:assert/strict');
const { C, T, Ru } = require('../util/card.js');
const B = require('../battle.js');
const R = require('ramda');

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

const battleOpts = {
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
};
const users = [
    { player: 'enochroot', count: 28 },
    { player: 'kalippo', count: 31 },
    { player: 'jinsama-2569' },
    { player: 'azarmadr3' },
].map((x) => Object.assign(x, require(`../data/test/${x.player}-cards.json`)));

test('card filter', { skip: true }, (_t) => {
    for (const u of users) {
        const procedCards = B(battleOpts).processCards(u.cards);
        assert.equal(Object.keys(procedCards).length, u.count);
    }
});

test('max call stack error', (_t) => {
    const battleOpts = {
        created_block_num: 104525568,
        expiration_block_num: 104525628,
        player: 'azarmadr3',
        team_hash: null,
        match_type: 'Ranked',
        mana_cap: 43,
        status: 1,
        team: null,
        summoner_level: null,
        ruleset: 'Heavy Hitters',
        inactive: 'Blue',
        opponent_player: 'jinsama-2569',
        opponent_team_hash: null,
        settings: '{"rating_level":4}',
        recent_opponents: null,
        submit_date: null,
        format: 'foundation',
        bracket: null,
        is_critical: true,
    };

    const battle = B(battleOpts);
    battle.cardsOfPlayers = [battleOpts.player, battleOpts.opponent_player]
        .flatMap((p) => users.filter((x) => x.player === p))
        .map((x, i) => battle.processCards(i)(x.cards));
    console.log(battle.cardsOfPlayers);
    console.table([
        {
            ...R.filter((f) => !R.is(Function, f), battle),
            cardsOfPlayers: battle.cardsOfPlayers.map(
                (x) => Object.keys(x).length,
            ),
        },
    ]);
    console.log(battle.playableTeams());
    assert.equal(1, 2);
});

test('node matrix', { skip: true }, (_t) => {
    battleOpts.inactive = '';
    battleOpts.mana_cap = 58;
    const battle = B(battleOpts);
    const { cards } = require(`../data/test/enochroot-cards.json`);
    battle.cardsOfPlayers[0] = battle.processCards(i)(cards);
    battle.cardsOfPlayers[1] = battle.cardsOfPlayers[0];
    const nm = battle.nodeMatrix();
    console.log(Object.keys(battle.cardsOfPlayers[0]));
    console.log(Object.keys(nm).length);

    assert.equal(1, 1);
});
