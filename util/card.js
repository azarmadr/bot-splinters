const R = require('ramda');
const RA = require('ramda-adjunct');
const { _arr: A } = require('./array');
const sf = (x) =>
    require('sync-fetch')(String.raw(x), {
        headers: { Accept: 'application/vnd.citationstyles.csl+json' },
    }).json();
const { writeFileSync } = require('jsonfile');
const { log, F } = require('./dbug');
const getFromAPI = (type, uri, force = 0) => {
    //immediately returning function
    try {
        if (force) throw new Error('Dummy');
        return require(`../data/${type}.json`);
    } catch (_e) {
        require('node:fs').mkdir(
            require('node:path').join(__dirname, '../data'),
            (e) => {
                if (e) throw e;
                console.log('Created `data` directory');
            },
        );
        const newCards = sf`https://api.splinterlands.io/${uri}`;
        writeFileSync(`./data/${type}.json`, newCards);
        return newCards;
    }
};
const re_map_cards = (cards) => {
    const newCards = [];
    for (card of cards) newCards[card.id] = card;
    return newCards;
};
const __cards = re_map_cards(getFromAPI('cards', 'cards/get_details'));
const SMsettings = getFromAPI('settings', 'settings');
const updateCards = (cards) => {
    log('Getting new cards');
    cards = re_map_cards(getFromAPI('cards', 'cards/get_details', 1));
    return cards;
};

__cards.basic = __cards
    .filter((c) => c.tier === 15 && c.rarity < 4)
    // .filter((c) => c.editions.match(/7|4/) && c.rarity < 3)
    .map((c) => c.id);
const attr = ['color', 'name', 'rarity', 'type', 'editions', 'tier'];
const stats = ['ranged', 'magic', 'attack', 'speed', 'armor', 'health'];
const Cards = new Proxy(__cards, {
    get: (cards, c) => {
        if (c in cards) {
            if (!('mana' in cards[c].stats))
                throw new Error(`id:'${c}' is probably not a card`);
            return cards[c];
        }

        if (!Number.isInteger(+c) || c < 0)
            throw new Error(`'${c}' is not integer`);
        console.log(c);
        return updateCards(__cards)[c];
    },
});
var _ablt = F.cached(
    (i) => (l) =>
        Cards[i].stats?.abilities?.slice(0, Math.max(1, l))?.flat() || [],
);
var _mana = F.cached((i) => {
    const card = Cards[i[0] ?? i];
    const x = [card.stats.mana].flat()[0];
    if (x === undefined) {
        console.log(card, i);
        throw new Error('Invalid mana calculated');
    }
    return x;
});
var _attr = (c) => F.cached((i) => Cards[i[0] ?? i][c]);
var _stat = (c) =>
    F.cached(
        ([i, l]) =>
            Cards[i].stats[c]?.[Math.max(0, l - 1)] ?? Cards[i].stats[c],
    );
const C = {
    basicCards: Object.fromEntries(__cards.basic.map((c) => [c, 0])),
    mana: _mana,
    abilities: ([i, l]) => _ablt(i)(l),
    hasAbility:
        (regex) =>
        ([i, l]) =>
            _ablt(i)(l).join().match(regex),
    isMon: (i) => _attr`type`(i) === 'Monster',
    isSum: (i) => _attr`type`(i) === 'Summoner',
    ...attr.reduce((o, a) => Object.assign(o, { [a]: _attr(a) }), {}),
    ...stats.reduce((o, s) => Object.assign(o, { [s]: _stat(s) }), {}),
    stats: ([i]) => {
        const { mana, ...rem } = Cards[i];
        return rem;
    },
    get a() {
        return C.attack;
    },
    get m() {
        return C.magic;
    },
    get r() {
        return C.ranged;
    },
    get has() {
        return C.hasAbility;
    },
    attackType: (c) =>
        `${['a', 'm', 'r'].flatMap((x) =>
            C[x](c) ? [{ a: 'Melee', r: 'Ranged', m: 'Magic' }[x]] : [],
        )}`,
};

const nAtORyAb = (attack, ability) =>
    R.anyPass([R.not, (c) => !C[attack](c), C.has(ability)]);
const Ru = {
    cardPred: {
        'Junior Varsity': (c) => C.mana(c) <= 6,
        'Lost Magic': (c) => C.isSum(c) || C.m(c) === 0,
        'Up Close & Personal': (c) => C.isSum(c) || C.a(c) > 0,
        'Wands Out': (c) => C.isSum(c) || C.m(c) > 0,
        'Going the Distance': (c) => C.isSum(c) || C.r(c) > 0,
        'Broken Arrows': (c) => C.isSum(c) || C.r(c) === 0,
        'Keep Your Distance': (c) => C.isSum(c) || C.a(c) === 0,
        'Rise of the Commons': (c) => C.isSum(c) || C.rarity(c) < 3,
        'Even Stevens': (c) => C.isSum(c) || C.mana(c) % 2 === 0,
        'Odd Ones Out': (c) => C.isSum(c) || C.mana(c) % 2,
        'Lost Legendaries': (c) => C.isSum(c) || C.rarity(c) < 4,
        'Little League': (c) => C.mana(c) < 5,
        'Heavy Metal': (c) => C.isSum(c) || C.armor(c) > 0,
        Beefcakes: (c) => C.isSum(c) || C.health(c) >= 5,
        'Might Makes Right': (c) =>
            C.isSum(c) || C.m(c) > 2 || C.a(c) > 2 || C.r(c) > 2,
        'Need for Speed': (c) => C.isSum(c) || C.speed(c) >= 3,
        'Shades of Gray': (c) => C.isSum(c) || C.color(c) === 'Gray',
        'Taking Sides': (c) => C.isSum(c) || C.color(c) !== 'Gray',
        '': R.T,
    },
    /** Apply the following predicates on both the teams.
     * if they match, they can be used for that ruleset as well.
     *
     * Default function should reuturn false, so as to disallow the battle to be
     * considered for the ruleset
     * */
    pred: {
        'Back to Basics': R.all((t) =>
            R.all(R.pipe(C.abilities, R.equals([])), R.drop(1, t)),
        ),
        'Born Again': R.F,
        'Up to Eleven': R.F,
        'Now You See Me...': R.F,
        'Tis but Scratches': R.F,
        'Blood and Sunder': R.F,
        Counterspell: R.F,
        'Thick Skinned': R.F,
        'Collateral Damage': R.F,
        //'': R.F,
        'Hey Jealousy': R.F,
        'Death Has No Power': R.F,
        'Fire & Regret': R.F,
        'Are You Not Entertained?': R.F,
        Maneuvers: R.F,
        'Blood Moon': R.F,
        'Brute Force': R.F,
        'Arcane Dampening': R.F,
        'Deflection Field': R.F,
        'No Pain, No Gain': R.F,
        'Shapeshift Happens': R.F,
        'Global Warming': R.F,
        Aimless: R.F,
        Ferocity: R.F,
        'Briar Patch': R.F,
        'What Doesn’t Kill You': R.F,

        'Silenced Summoners': R.all((t) =>
            R.anyPass([R.not, R.isEmpty])(R.values(R.head(t))),
        ),
        'Aim True': R.all((t) =>
            R.all((c) => (!C.a(c) && !C.r(c)) || C.has(/True Strike/)(c))(
                R.drop(1, t),
            ),
        ),
        'Super Sneak': R.all((t) =>
            R.all(nAtORyAb('a', /Sneak/))(R.drop(2, t)),
        ),
        'Weak Magic': R.pipe(
            R.map(R.juxt([R.any(C.m), R.any(nAtORyAb('armor', /Void Armor/))])),
            R.modifyPath([1])(R.reverse),
            R.apply(R.zipWith(R.multiply)),
            R.equals([0, 0]),
        ),
        Unprotected: R.all(
            R.all(R.allPass([(c) => C.armor(c) <= 0, C.has(/Protect/)])),
        ),
        'Target Practice': R.all((t) =>
            R.all((c) => (!C.a(c) && !C.r(c)) || C.has(/True Strike/)(c))(
                R.drop(1, t),
            ),
        ),
        'Fog of War': R.all(R.none(C.has(/Snipe|Sneak/))),
        'Armored Up': R.all(
            R.all(
                (c) =>
                    !C.has('Void Armor')(c) && (C.m(c) || (!C.a(c) && !C.r(c))),
            ),
        ),
        'Equal Opportunity': R.all(
            (t) =>
                (!t[2] || C.has(/Reach/)(t[2])) &&
                R.all(C.has(/Opportunity|Snipe|Sneak/))(R.drop(3, t)),
        ),
        'Melee Mayhem': R.all(
            (t) =>
                nAtORyAb('a', /Reach|Sneak|Opportunity/)(t[2]) &&
                R.all(nAtORyAb('a', /Sneak|Opportunity/))(R.drop(3, t)),
        ),
        'Healed Out': R.all(R.none(C.has(/Triage|Tank Heal|Heal/))),
        Earthquake: R.all((t) =>
            R.any(R.all(C.has(/Flying/)))(R.splitAt(1, t)),
        ),
        'Reverse Speed': R.all(R.F), //TODO
        'Close Range': R.all((t) =>
            R.all(nAtORyAb('r', /Close Range/))(R.drop(1, t)),
        ),
        'Heavy Hitters': R.all(
            R.anyPass([
                R.none(C.has(/Stun/)),
                (t) => R.all(C.has(/Knock Out/))(R.drop(1, t)),
            ]),
        ),
        Equalizer: R.pipe(
            R.map(R.tail),
            R.unnest,
            R.map(C.health),
            RA.allEqual,
        ),
        'Noxious Fumes': R.all((t) => R.all(C.has(/Immunity/))(R.drop(1, t))),
        Stampede: R.all(R.all(C.has(/Trample/))),
        'Explosive Weaponry': R.all((t) =>
            R.any(R.all(C.has(/Blast/)))(R.splitAt(1, t)),
        ),
        'Holy Protection': R.all((t) =>
            R.any(R.all(C.has(/Divine Shield/)))(R.splitAt(1, t)),
        ),
        'Spreading Fury': R.all(R.all(C.has(/Enrage/))),
    },
};
Ru.e = A.enumify(Object.keys(Ru.pred).sort());
Ru.pred.Standard = R.F;
/** return a number so that the team can be used for other ruleset */
Ru.num = R.pipe(
    R.applySpec(Ru.pred),
    R.mapObjIndexed((v, k) => (v ? 2 ** +Ru.e[k] : 0)),
    R.values,
    R.sum,
);
Ru.map = R.pipe(
    R.juxt([R.always([['Standard']]), R.splitEvery(1), R.of(Array)]),
    R.unnest,
    R.uniq,
    R.juxt([R.map(R.join`,`), R.reverse]),
    R.apply(R.zip),
    R.fromPairs,
    R.map(R.map(R.pipe(R.flip(R.prop)(Ru.e), R.curry(Math.pow)(2)))),
    R.map(R.sum),
);
Ru.getRules = (ruleset) => {
    const team_restrictions = 'High Five,Four’s a Crowd';
    const { attr, card } = ruleset.split`|`.reduce(
        (rule, cr) => {
            if (team_restrictions.includes(cr) || cr === 'Taking Sides')
                return rule;
            if (cr in Ru.cardPred) rule.card = cr;
            else rule.attr.push(cr);
            return rule;
        },
        { attr: [], card: '' },
    );
    attr.sort();
    attr[0] ??= 'Standard';
    return Object.assign(new String(ruleset), {
        attr,
        card,
        byCard: Ru.cardPred[card],
        byTeam: R.all(Ru.cardPred[card]),
    });
};
Ru.battleRule = (rs) => (teams) =>
    Ru.getRules(rs)
        .attr.filter((r) => {
            if (!(r in Ru.pred)) throw new Error(`'${r}' not found`);
            return !Ru.pred[r](teams);
        })
        .join() || 'Standard';

/** Team helper functions in T object */
const color2Deck = {
    Red: 'Fire',
    Blue: 'Water',
    White: 'Life',
    Black: 'Death',
    Green: 'Earth',
};
const T = (t) =>
    Array.isArray(t)
        ? Array.isArray(t[0])
            ? t
            : A.chunk2(t)
        : A.chunk2(t.split`,`.map(Number));
Object.assign(T, {
    mon: (t) => T(t).slice(1),
    mana: (t) =>
        T(t).reduce((a, c) => {
            try {
                const cardMana = C.mana(c);
                return cardMana + a;
            } catch (e) {
                log(e);
                throw new Error(`Teams mana calculation failed for ${t}`);
            }
        }, 0),
    colorPri: (t) => C.color(T(t)[0]),
    colorSec: (t) =>
        T(t)
            .slice(1)
            .map(C.color)
            .reduce((color, c) => (c in color2Deck ? c : color), 'Gray'),
    colors: (t) => R.uniq(T(t).map(C.color)).join`,`,
    isActive: (inactive) => (t) =>
        T(t).every((c) => !inactive.includes(C.color(c))),
    playable: (cards) => (t) =>
        T(t).every((c) => c[0] in cards || c[0] in C.basicCards),
    splinter: (inactive) => (t) =>
        color2Deck[T.colorSec(t)] ??
        Object.entries(color2Deck).find((c) => !inactive.includes(c[0]))[1],
    print: R.pipe(
        T,
        R.applySpec({
            Summoner: (x) => C.name(x[0]),
            Monsters: (x) => R.tail(x).map(C.name),
        }),
    ),
});

module.exports = { C, Ru, T };
