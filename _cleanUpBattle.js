/** Motive for the release tag 2.2:
 * Converting array of battles to objects of pattern {t1:{t2:result}} */
const AKMap = require("array-keyed-map");
const {readFileSync,writeFileSync} = require('jsonfile');
const {_arr,log}=require('./helper');
const old_battles = require('./data/bdn.json');
var nb;
try {
  // temporary file to store battle_data while cleaning or merging multiple older battle_data
  nb = readFileSync('./data/battle_data-temp.json')
}catch(e){
  log(e)
  nb = {}
}
const nBattles = (obj, obj2merge) => {
  console.count();require('readline').moveCursor(process.stdout,0,-1);
  for (let [key, value] of Object.entries(obj2merge)) {
    if (Array.isArray(value)) {
      const dups = new AKMap();
      value.forEach((k) => {
        let {
          result,
          teams: [l, w],
        } = k.reduce(
          (a, c) => {
            if (c == "d" || c == "w") a.result = c;
            else a.teams[a.result ? 1 : 0].push(c);
            return a;
          },
          { teams: [[], []] }
        );
        if (_arr.cmp(l, w) < 0 && result == "w") [result, l, w] = ["l", w, l];
        const _l = dups.has(l) ? dups.get(l) : new AKMap();
        const _w = _l.has(w) ? _l.get(w) : result;
        result != _w ? _l.set(w, "d") : _l.set(w, result);
        dups.set(l, _l);
        //dups.has(l) ? dups.get(l).set(w, result) : dups.set(l, new AKMap([[w, result]]));
      });
      dups.forEach((v, l) => dups.set(l, Object.fromEntries(v.entries())));
      obj[key] = Object.fromEntries(dups);
    } else nBattles((obj[key] ??= {}), value);
  }
};
nBattles(nb, old_battles);
log()
// if satisfied,rename the `battle_data-temp.json` to `battle_data.json`
writeFileSync(`data/battle_data-temp.json`,nb)
log('done')
