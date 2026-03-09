const { test } = require('node:test');
const assert = require('node:assert/strict');
const { C, T, Ru } = require('../util/card.js');
const R = require('ramda');

test('mana matches', (t) => {
    assert.equal(C.mana([870]), 7);
    assert.equal(C.mana(870), 7);

    assert.throws(() => {
        C.mana(869);
    }, /Error: id:'869' is probably not a card/);
});

test('team and rule set number calculation', (t) => {
    const team = T('827,4,850,4,830,2,824,4,855,2,567,4');
    // const stats = 'name,armor,attack,ranged,magic,abilities'.split`,`;
    // console.table(
    //     team.map((c) => stats.reduce((a, x) => ((a[x] = C[x](c)), a), {})),
    // );
    // console.log(R.pipe(R.applySpec(Ru.pred))([team, team]));
    assert.equal(Ru.num([team, team]), 17867655348224);
});
