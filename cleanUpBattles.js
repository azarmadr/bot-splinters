/** Motive for the release tag 2.2:
 * Converting array of battles to objects of pattern {t1:{t2:result}} */
const { writeFileSync } = require('jsonfile');
const { _arr, _dbug, T, C, log } = require('./util');
const fileName = './data/battle_data_rb.json';
const nb = require(fileName);
const { merge } = require('./battles-data');
const R = require('ramda');
const card_aliases = require('./data/card_aliases.json');
log(card_aliases);
const ac = new Proxy({}, { get: (o, k) => (o[k] ??= 0) });
const mm = () => {};
const _mm_ = (rs, mana, crs) => {
    const c = new Proxy({}, { get: (o, k) => (o[k] ??= 0) });
    const ca =
        card_aliases[
            rs
                .join()
                .match(
                    /Standard|Armored Up|Earthquake|Reverse Speed|Silenced Summoners/,
                )
                ? 'Standard'
                : rs.join().match(/Back to Basics/)
                  ? 'Back to Basics'
                  : null
        ];
    if (ca) {
        for (const s in crs)
            for (const t in crs[s])
                if (
                    [s, t].some((x) =>
                        T(x).some(
                            ([c, l]) =>
                                c in ca &&
                                Object.keys(ca[c]).find(
                                    (x) =>
                                        C.color(x) === C.color(c) &&
                                        l <= ca[c][x],
                                ),
                        ),
                    )
                ) {
                    const [sn, tn] = [s, t]
                        .map(T)
                        .map((x) =>
                            x.map(([i, l]) => [
                                i in ca && ++c[i]
                                    ? Object.keys(ca[i]).find(
                                          (x) =>
                                              C.color(x) === C.color(i) &&
                                              l <= ca[i][x],
                                      )
                                    : i,
                                l,
                            ]),
                        )
                        .map((x) => `${x}`);
                    _dbug.$1s.a = { sn, tn, s, t };
                    c.s += merge(crs, { [sn]: { [tn]: crs[s][t] } }).c;
                    c.c += delete crs[s][t];
                }
    }
    if (_dbug.tt.n?.at(-1)?.rs !== rs.toString()) delete _dbug.tt.n;
    if (c.c) _dbug.tt.n = { rs: `${rs}`, mana, ...c };
    Object.keys(c).forEach((k) => {
        ac[k] += c[k];
    });
};
const _RefractorBattlesToMana = (rs, mana, crs) => {
    const c = { c: 0, a: 0, e: 0 };
    for (const s in crs) {
        if (T(s).length === 1) {
            delete crs[s];
            c.a++;
        } else
            for (const t in crs[s]) {
                const nmana = Math.max(T.mana(s), T.mana(t), 12);
                if (nmana !== mana) {
                    c.a++;
                    const x = rs.reduce((a, rule) => a[rule], nb);
                    x[nmana] ??= {};
                    c.c += merge(x[nmana], { [s]: { [t]: crs[s][t] } }).c;
                    delete crs[s][t];
                }
            }
        if (R.isEmpty(crs[s])) {
            delete crs[s];
            c.e++;
        }
    }
    if (_dbug.tt.n?.at(-1)?.rs !== rs.toString()) {
        delete _dbug.tt.n;
        log(`${rs}`, mana);
    }
    if (c.a) _dbug.tt.n = { ...c, rs: `${rs}`, mana };
    Object.keys(c).forEach((k) => {
        ac[k] += c[k];
    });
};

Object.entries(nb).forEach(([rs, rs_]) => {
    Object.entries(rs_).forEach(([rs1, crs]) => {
        rs1.match(/\d+/)
            ? mm([rs], rs1, crs)
            : Object.entries(crs).forEach(([mana, crs]) => {
                  mm([rs, rs1], mana, crs);
              });
    });
});
delete _dbug.tt.n;
const LOG_AC = 0;
if (LOG_AC) log(ac);
else {
    ac.e = _arr.rmEmpty(nb);
    log(ac);
    // if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
    if (Object.values(ac).some((x) => x)) {
        const { Standard, ...rem } = nb;
        writeFileSync(fileName.replace(/.json/, '-t.json'), {
            Standard,
            ...rem,
        });
        log('done');
    } else log(fileName, 'is intact');
}
