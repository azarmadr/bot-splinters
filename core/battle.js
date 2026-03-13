const R = require('ramda');

const playableCards = ({ player, cards }) =>
    cards.filter(
        (card) =>
            !(card.market_id && card.market_listing_status === 0) &&
            (!card.delegated_to || card.delegated_to === player) &&
            !(
                card.last_used_player !== player &&
                Date.parse(card.last_used_date) > Date.now() - 86400000
            ),
    );

const possibleAttrRules = R.pipe(
    R.juxt([R.of(Array), R.splitEvery(1), R.always([['Standard']])]),
    R.unnest,
    R.uniq,
);

function Battle(opts) {
    const battle = {
        ...opts,
        mana: Math.min(
            opts.ruleset.includes('Little League') ? 28 : 99,
            opts.mana_cap,
        ),
    };
    return battle;
}

const battlesDB = (opts = { timeout: 81e3 }) =>
    require('better-sqlite3')('./data/battles.db', opts);

module.exports = { playableCards, possibleAttrRules, Battle, battlesDB };
